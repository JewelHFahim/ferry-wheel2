import { UserModel, IUser } from "./user.model";
import bcrypt from "bcryptjs";
import { SettingsService } from "../settings/settings.service";
import { MetService } from "../met/met.service";

export const UserService = {
  


  async getById(userId: string): Promise<IUser | null> {
    return UserModel.findById(userId);
  },

  async getByUsername(username: string): Promise<IUser | null> {
    return UserModel.findOne({ username });
  },

  // update user balance
  async updateBalance(userId: string, amount: number): Promise<IUser> {
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { balance: amount } },
      { new: true, projection: { balance: 1 } } // return new balance quickly
    );
    if (!updated) throw new Error("User not found");
    return updated;
  },

  // Verify Password
  async verifyPassword(user: IUser, password: string): Promise<boolean> {
    if (!user.password) {
      throw new Error("User does not have password");
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password);
      return isMatch;
    } catch (error) {
      throw new Error("Error verifying password.");
    }
  },

};
