import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
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
      
      req.userId = decoded.userId;
      
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