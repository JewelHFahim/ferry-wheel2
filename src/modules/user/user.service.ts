// // src/modules/user/user.service.ts
// import bcrypt from "bcryptjs";
// import { MetService } from "../met/met.service";
// import { SettingsService } from "../settings/settings.service";
// import { UserModel } from "./user.model";
// import { IUser } from "./user.types";

// export const UserService = {
//   async createUser(data: { username: string; password: string; role?: "user" | "bot" | "admin" }): Promise<IUser> {
//     const hostedUserId = Date.now().toString();
//     const settings = await SettingsService.getSettings();
//     const initialBalance = settings.minBet || 0;

//     const hashedPassword = await bcrypt.hash(data.password, 10);

//     const user = await UserModel.create({
//       hostedUserId,
//       username: data.username,
//       password: hashedPassword,
//       role: data.role ?? "user",
//       balance: initialBalance,
//     });

//     await MetService.incrementTotalUsers();
//     return user;
//   },

//   async findByUsername(username: string): Promise<IUser | null> {
//     return UserModel.findOne({ username });
//   },

//   async getById(userId: string) {
//   return UserModel.findById(userId);
// },

//   async verifyPassword(user: IUser, password: string): Promise<boolean> {
//     if (!user.password) return false;
//     return bcrypt.compare(password, user.password);
//   },

//   async updateBalance(userId: string, amount: number): Promise<IUser> {
//     const updated = await UserModel.findByIdAndUpdate(userId, { $inc: { balance: amount } }, { new: true });
//     if (!updated) throw new Error("User not found");
//     return updated;
//   },

//   async getProfile(userId: string): Promise<IUser | null> {
//     return UserModel.findById(userId).select("-password");
//   },
// };

// New User Services
import { UserModel, IUser } from "./user.model";
import bcrypt from "bcryptjs";
import { SettingsService } from "../settings/settings.service";
import { MetService } from "../met/met.service";

export const UserService = {
  async createUser({
    username,
    password,
    role = "user" as const,
  }): Promise<IUser> {
    const s = await SettingsService.getSettings();
    const initial = s.minBet || 0;
    const hashed = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      username,
      password: hashed,
      role,
      balance: initial,
    });
    await MetService.incrementTotalUsers();
    return user;
  },

  async getById(userId: string): Promise<IUser | null> {
    return UserModel.findById(userId);
  },

  // update  user balance
  async updateBalance(userId: string, amount: number): Promise<IUser> {
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { balance: amount } },
      { new: true, projection: { balance: 1 } } // return new balance quickly
    );
    if (!updated) throw new Error("User not found");
    return updated;
  },
};
