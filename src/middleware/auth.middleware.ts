import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from '../config.js';
import { getRepo } from "../db/index.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'user' | 'admin';
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid token.",
      });
      return;
    }

    const token = authHeader.substring(7);
    const secret = config.jwt.secret;
    
    try {
      const decoded = jwt.verify(token, secret) as { userId: string, tokenVersion?: number, iat?: number };

      const { user: userRepo } = getRepo();
      const user = await userRepo.findById(decoded.userId);
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: "User not found. Please login again.",
        });
        return;
      }

      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
        res.status(401).json({
          success: false,
          message: "Token has been invalidated. Please login again.",
        });
        return;
      }

      if (user.passwordChangedAt) {
        const tokenIssuedAt = decoded.iat! * 1000;
        const passwordChangedTime = user.passwordChangedAt.getTime();
        
        if (passwordChangedTime > tokenIssuedAt) {
          res.status(401).json({
            success: false,
            message: "Password was changed. Please login again.",
          });
          return;
        }
      }
    
      req.userId = decoded.userId;
      req.userRole = user.role;
      
      next();
    } catch (jwtError) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please login again.",
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Authentication error",
      error: error,
    });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
      return;
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Authorization error",
      error: error,
    });
  }
};
