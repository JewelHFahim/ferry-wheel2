import mongoose, { Schema } from "mongoose";
import { IUser } from "./user.types";

const userSchema = new Schema<IUser>(
  {
    
    hostedUserId: { type: String, required: true, unique: true },
    role: { type: String, enum: ["user", "bot", "admin"], default: "user" },
    username: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    totalDeposite: { type: Number, default: 0 },
    totalWithdraw: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>("User", userSchema);
