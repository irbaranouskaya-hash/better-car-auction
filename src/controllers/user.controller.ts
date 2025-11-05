import { type Request, type Response } from "express";
import User, { UserRole } from "../models/User.model.js";
import jwt from "jsonwebtoken";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { sendErrorResponse } from "../utils/validation.utils.js";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiration } from "../utils/token.utils.js";


export const register = async (req: Request, res: Response) => {
  try {
    const {name, email, password} = req.body;

    if(!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    if(password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User with this email already exists" 
      });
    }

    const user = await User.create({name, email, password});
    
    const token = generateAccessToken(user._id.toString(), user.tokenVersion || 0);
    const refreshToken = generateRefreshToken();
    user.refreshTokens.push({
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: getRefreshTokenExpiration(),
    });
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error during registration" ,
      error: error
    });
  }
}

export const refreshTokens = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required"
      });
    }

    // Ищем пользователя с таким refresh token
    const user = await User.findOne({
      'refreshTokens.token': refreshToken
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
    }

    const tokenData = user.refreshTokens?.find(
      rt => rt.token === refreshToken
    );

    if (!tokenData) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
    }

    if (tokenData.expiresAt < new Date()) {
      user.refreshTokens = (user.refreshTokens?.filter(
        rt => rt.token !== refreshToken
      ) as any) || [];
      await user.save();

      return res.status(401).json({
        success: false,
        message: "Refresh token expired. Please login again."
      });
    }

    const newAccessToken = generateAccessToken(
      user._id.toString(), 
      user.tokenVersion || 0
    );
    const newRefreshToken = generateRefreshToken();

    user.refreshTokens = (user.refreshTokens?.filter(
      rt => rt.token !== refreshToken
    ) as any) || [];
    
    user.refreshTokens.push({
      token: newRefreshToken,
      createdAt: new Date(),
      expiresAt: getRefreshTokenExpiration(),
      deviceInfo: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip || req.socket.remoteAddress || 'Unknown'
    });

    await user.save();

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
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error
    });
  }
};


export const login = async (req: Request, res: Response) => {
  try {
    const {email, password} = req.body;

    if(!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({ email });
    if(!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // @ts-expect-error: comparePassword is a custom method defined on the User schema
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
      return;
    }

    const token = generateAccessToken(user._id.toString(), user.tokenVersion || 0);
    const refreshToken = generateRefreshToken();
    user.refreshTokens.push({
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: getRefreshTokenExpiration(),
    });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        accessToken: token,
        refreshToken: refreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error during login" ,
      error: error
    });
  }
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message: "Logout successful. Please remove token from client.",
  });
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    // @ts-expect-error: comparePassword is a custom method defined on the User schema
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
      return;
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.passwordChangedAt = new Date();
    await user.save();

    const token = generateAccessToken(user._id.toString(), user.tokenVersion || 0);
    const refreshToken = generateRefreshToken();
    user.refreshTokens.push({
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: getRefreshTokenExpiration(),
    });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully. All other sessions have been logged out.",
      data: { accessToken: token, refreshToken: refreshToken }
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password change",
      error: error
    });
  }
};

export const logoutAllDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const token = generateAccessToken(user._id.toString(), user.tokenVersion || 0);
    const refreshToken = generateRefreshToken();
    user.refreshTokens.push({
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: getRefreshTokenExpiration(),
    });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully. Use new token for future requests.",
      data: { accessToken: token, refreshToken: refreshToken }
    });
  } catch (error) {
    console.error("Logout all devices error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error
    });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const isTargetUser = targetUser._id.toString() === req.userId;
    const isAdmin = req.userRole === UserRole.ADMIN;
    
    if (!isTargetUser && !isAdmin) {
      return sendErrorResponse(
        res, 
        403, 
        "You are not authorized to delete this user. Only the user himself or admin can delete his account."
      );
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
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

const validateTargetUser = async (
  req: AuthRequest,
  res: Response
): Promise<{ targetUser: any } | null> => {
  const { userId } = req.body;
  
  if (!userId) {
    sendErrorResponse(res, 400, "User ID is required");
    return null;
  }

  const targetUser = await User.findById(userId);
  
  if (!targetUser) {
    sendErrorResponse(res, 404, "User not found");
    return null;
  }

  return { targetUser };
};

export const assignAdminRole = async (req: AuthRequest, res: Response) => {
  try {
    const validation = await validateTargetUser(req, res);
    if (!validation) return;
    
    const { targetUser } = validation;

    if (targetUser.role === UserRole.ADMIN) {
      return res.status(400).json({
        success: false,
        message: "User is already an admin"
      });
    }

    targetUser.role = UserRole.ADMIN;
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: "Admin role assigned successfully",
      data: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        }
      }
    });
  } catch (error) {
    console.error("Assign admin role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error
    });
  }
};

export const revokeAdminRole = async (req: AuthRequest, res: Response) => {
  try {
    const validation = await validateTargetUser(req, res);
    if (!validation) return;
    
    const { targetUser } = validation;

    if (targetUser._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot revoke your own admin role"
      });
    }

    if (targetUser.role !== UserRole.ADMIN) {
      return res.status(400).json({
        success: false,
        message: "User is not an admin"
      });
    }

    targetUser.role = UserRole.USER;
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: "Admin role revoked successfully",
      data: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        }
      }
    });
  } catch (error) {
    console.error("Revoke admin role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error
    });
  }
};