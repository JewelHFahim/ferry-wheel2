import bcrypt from "bcryptjs";
import { MetService } from "../met/met.service";
import { SettingsService } from "../settings/settings.service";
import { UserModel } from "./user.model";
import { IUser } from "./user.types";

export const UserService = {
  /**
   * Create a new user
   */
  async createUser(data: {
    username: string;
    password: string;
    role?: "user" | "bot" | "admin";
  }): Promise<IUser> {
    const hostedUserId = Date.now().toString(); // temporary hosted id

    const settings = await SettingsService.getSettings();
    const initialBalance = settings.minBet || 0;

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await UserModel.create({
      hostedUserId,
      username: data.username,
      password: hashedPassword,
      role: data.role ?? "user",
      balance: initialBalance,
    });

    // Increment totalUsers in MetService
    await MetService.incrementTotalUsers();

    return user;
  },

  /**
   * Find user by username or email (for login)
   */
  async findByUsername(username: string): Promise<IUser | null> {
    return await UserModel.findOne({ username });
  },

  async getById(userId: string): Promise<IUser | null> {
    return await UserModel.findOne({ userId });
  },

  /**
   * Verify password
   */
  async verifyPassword(user: IUser, password: string): Promise<boolean> {
    if (!user.password) return false;
    return bcrypt.compare(password, user.password);
  },

  /**
   * Update user balance (atomic)
   */
  async updateBalance(userId: string, amount: number): Promise<IUser> {
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { balance: amount } },
      { new: true }
    );
    if (!updated) throw new Error("User not found");
    return updated;
  },

  /**
   * Get profile
   */
  async getProfile(userId: string): Promise<IUser | null> {
    return await UserModel.findById(userId).select("-password");
  },
};
