import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserService } from "./user.service";
import { env } from "../../config/env";

const generateToken = (userId: string, role: string) => {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: "7d" });
};

export const UserController = {
  // ==========================
  // @desc    Register a new user
  // @route   POST /api/users/register
  // @access  Public
  // ==========================
  register: async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res
          .status(400)
          .json({ message: "Username and password required" });
      }

      const existing = await UserService.findByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await UserService.createUser({ username, password });

      const token = generateToken(user._id.toString(), user.role);

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
  },

  /**
   * Login
   */
  login: async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res
          .status(400)
          .json({ message: "Username and password required" });
      }

      const user = await UserService.findByUsername(username);
      if (!user)
        return res.status(400).json({ message: "Invalid credentials" });

      const isMatch = await UserService.verifyPassword(user, password);
      if (!isMatch)
        return res.status(400).json({ message: "Invalid credentials" });

      const token = generateToken(user._id.toString(), user.role);

      res.status(200).json({
        id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balance,
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Server error" });
    }
  },

  /**
   * Get user profile
   */
  getProfile: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = req.user.userId;
      const profile = await UserService.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "User not found" });

      res.status(200).json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
};
