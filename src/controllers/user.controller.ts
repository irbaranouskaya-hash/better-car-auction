import { type Request, type Response } from "express";
import User from "../models/User.model.js";
import jwt from "jsonwebtoken";


const generateToken = (userId: string): string => {
  
  const secret = process.env.JWT_SECRET || "default_secret";

  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

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
    
    const token = generateToken(user._id.toString());

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

    const token = generateToken(user._id.toString());
    res.status(200).json({
      success: true,
      message: "Login successful",
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

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

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