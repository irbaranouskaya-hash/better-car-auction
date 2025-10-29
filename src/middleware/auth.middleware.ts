import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { UserRole } from "../models/User.model.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
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
    const secret = process.env.JWT_SECRET || "default_secret";
    
    try {
      const decoded = jwt.verify(token, secret) as { userId: string };
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: "User not found. Please login again.",
        });
        return;
      }
      
      req.userId = decoded.userId;
      req.userRole = user.role as UserRole;
      
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
    if (req.userRole !== UserRole.ADMIN) {
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