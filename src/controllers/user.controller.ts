import { type Request, type Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { handleControllerError, sendErrorResponse } from "../utils/validation.utils.js";
import { generateAccessToken } from "../utils/token.utils.js";
import { 
  generateRefreshTokenForRedis,
  saveRefreshToken,
  verifyRefreshToken,
  removeRefreshToken,
  removeAllRefreshTokens,
  getUserActiveSessions
} from "../utils/redis-token.utils.js";
import { getRepo } from "../db/index.js";

export const register = async (req: Request, res: Response) => {
  try {
    const { user: userRepo } = getRepo();
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long"
      });
    }

    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User with this email already exists" 
      });
    }

    const user = await userRepo.create({ name, email, password, role: 'user' });
    
    const accessToken = generateAccessToken(user.id, user.tokenVersion || 0);
    const refreshToken = generateRefreshTokenForRedis();
    
    await saveRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip || req.socket.remoteAddress
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    handleControllerError(error, res, "registration");
  }
};

export const refreshTokens = async (req: AuthRequest, res: Response) => {
  try {
    const { user: userRepo } = getRepo();
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required"
      });
    }

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token"
      });
    }

    const tokenId = await verifyRefreshToken(req.userId, refreshToken);
    
    if (!tokenId) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please login again."
      });
    }

    const user = await userRepo.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await removeRefreshToken(req.userId, refreshToken);

    const newAccessToken = generateAccessToken(user.id, user.tokenVersion || 0);
    const newRefreshToken = generateRefreshTokenForRedis();

    await saveRefreshToken(
      user.id,
      newRefreshToken,
      req.headers['user-agent'],
      req.ip || req.socket.remoteAddress
    );

    res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      }
    });
  } catch (error) {
    handleControllerError(error, res, "refresh tokens");
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { user: userRepo } = getRepo();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const isPasswordValid = await userRepo.comparePassword(user, password);
    if (!isPasswordValid) {
      res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.tokenVersion || 0);
    const refreshToken = generateRefreshTokenForRedis();
    
    await saveRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip || req.socket.remoteAddress
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    handleControllerError(error, res, "login");
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required"
      });
      return;
    }

    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
      return;
    }

    const removed = await removeRefreshToken(req.userId, refreshToken);

    if (!removed) {
      res.status(404).json({
        success: false,
        message: "Refresh token not found or already expired"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    handleControllerError(error, res, "logout");
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user: userRepo } = getRepo();
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long"
      });
      return;
    }

    const user = await userRepo.findById(req.userId!);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    const isPasswordValid = await userRepo.comparePassword(user, currentPassword);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
      return;
    }

    const hashedPassword = await userRepo.hashPassword(newPassword);
    await userRepo.update(user.id, { 
      password: hashedPassword,
      tokenVersion: (user.tokenVersion || 0) + 1,
      passwordChangedAt: new Date()
    });

    await removeAllRefreshTokens(user.id);

    const updatedUser = await userRepo.findById(user.id);
    const accessToken = generateAccessToken(user.id, updatedUser?.tokenVersion || 0);
    const refreshToken = generateRefreshTokenForRedis();
    
    await saveRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip || req.socket.remoteAddress
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully. All other sessions have been logged out.",
      data: { accessToken, refreshToken }
    });
  } catch (error) {
    handleControllerError(error, res, "change password");
  }
};

export const logoutAllDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user: userRepo } = getRepo();
    
    const user = await userRepo.findById(req.userId!);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    const removedCount = await removeAllRefreshTokens(user.id);

    await userRepo.update(user.id, { tokenVersion: (user.tokenVersion || 0) + 1 });

    const updatedUser = await userRepo.findById(user.id);
    const accessToken = generateAccessToken(user.id, updatedUser?.tokenVersion || 0);
    const refreshToken = generateRefreshTokenForRedis();
    
    await saveRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip || req.socket.remoteAddress
    );

    res.status(200).json({
      success: true,
      message: `Logged out from all devices successfully. ${removedCount} session(s) terminated.`,
      data: { accessToken, refreshToken }
    });
  } catch (error) {
    handleControllerError(error, res, "logout all devices");
  }
};

export const getActiveSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
      return;
    }

    const sessions = await getUserActiveSessions(req.userId);

    res.status(200).json({
      success: true,
      message: "Active sessions retrieved successfully",
      data: {
        sessions,
        totalSessions: sessions.length
      }
    });
  } catch (error) {
    handleControllerError(error, res, "get active sessions");
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user: userRepo } = getRepo();
    const { id } = req.params;

    const targetUser = await userRepo.findById(id);
    if (!targetUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const isTargetUser = targetUser.id === req.userId;
    const isAdmin = req.userRole === 'admin';
    
    if (!isTargetUser && !isAdmin) {
      return sendErrorResponse(
        res, 
        403, 
        "You are not authorized to delete this user. Only the user himself or admin can delete his account."
      );
    }

    const deleted = await userRepo.delete(id);

    if (!deleted) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

export const assignAdminRole = async (req: AuthRequest, res: Response) => {
  try {
    const { user: userRepo } = getRepo();
    const { userId } = req.body;
    
    if (!userId) {
      return sendErrorResponse(res, 400, "User ID is required");
    }

    const targetUser = await userRepo.findById(userId);
    if (!targetUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: "User is already an admin"
      });
    }

    const updatedUser = await userRepo.update(userId, { role: 'admin' });

    res.status(200).json({
      success: true,
      message: "Admin role assigned successfully",
      data: {
        user: {
          id: updatedUser!.id,
          name: updatedUser!.name,
          email: updatedUser!.email,
          role: updatedUser!.role
        }
      }
    });
  } catch (error) {
    handleControllerError(error, res, "assign admin role");
  }
};

export const revokeAdminRole = async (req: AuthRequest, res: Response) => {
  try {
    const { user: userRepo } = getRepo();
    const { userId } = req.body;
    
    if (!userId) {
      return sendErrorResponse(res, 400, "User ID is required");
    }

    const targetUser = await userRepo.findById(userId);
    if (!targetUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    if (targetUser.id === req.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot revoke your own admin role"
      });
    }

    if (targetUser.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: "User is not an admin"
      });
    }

    const updatedUser = await userRepo.update(userId, { role: 'user' });

    res.status(200).json({
      success: true,
      message: "Admin role revoked successfully",
      data: {
        user: {
          id: updatedUser!.id,
          name: updatedUser!.name,
          email: updatedUser!.email,
          role: updatedUser!.role
        }
      }
    });
  } catch (error) {
    handleControllerError(error, res, "revoke admin role");
  }
};
