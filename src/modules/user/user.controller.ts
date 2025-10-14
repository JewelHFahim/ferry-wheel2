import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { UserService } from "./user.service";
import { env } from "../../config/env";
import { UserModel } from "./user.model";

const generateToken = (userId: string, role: string) => {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: "7d" });
};

export const UserController = {
  // Get user profile
  getProfile: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = req.user.userId;
      const profile = await UserService.getById(userId);
      if (!profile) return res.status(404).json({ message: "User not found" });

      res.status(200).json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
};

// ==========================
// @desc    Register a new user
// @route   POST /api/v1/users/register
// ==========================
export const handleRegistration = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const existing = await UserModel.findOne({
      $or: [{ username }, { email }],
    });
    if (existing) {
      return res.status(400).json({ message: "Username or Email already exists" });
    }

    // Generate a unique hostedUserId
    let hostedUserId: string;
    while (true) {
      hostedUserId = Math.ceil(Math.random() * 10000000).toString();
      const exists = await UserModel.findOne({ hostedUserId });
      if (!exists) break;
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);


    const user = await UserModel.create({ username, email, password: hashedPassword, hostedUserId });
    console.log(user);

    res.status(201).json({
      status: true,
      message: "Account created successfully",
      user,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// ==========================
// @desc    Login a new user
// @route   POST /api/v1/users/login
// ==========================
export const handleLogin = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await UserService.getByUsername(username);
      if (!user)
        return res.status(400).json({ message: "Invalid credentials" });

      const isMatch = await UserService.verifyPassword(user, password);

      if (!isMatch)
        return res.status(400).json({ message: "Invalid credentials" });

      const token = generateToken(user._id.toString(), user.role, );

      res.status(201).json({
        id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balance,
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Server error" });
    }
  }

// ==========================
// @desc    Login a new user
// @route   POST /api/v1/users/profile
// ==========================
  export const handleGetProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const user = await UserModel.findById(userId).lean().select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ status: true, user });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({ message: error.message || "Server error" });
  }
};
