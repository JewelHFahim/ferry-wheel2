// import mongoose, { Schema } from "mongoose";
// import { IUser } from "./user.types";

// const userSchema = new Schema<IUser>(
//   {
    
//     hostedUserId: { type: String, required: true, unique: true },
//     role: { type: String, enum: ["user", "bot", "admin"], default: "user" },
//     username: { type: String, required: true },
//     password: { type: String, required: true },
//     balance: { type: Number, default: 0 },
//     totalDeposite: { type: Number, default: 0 },
//     totalWithdraw: { type: Number, default: 0 },
//   },
//   { timestamps: true }
// );

// export const UserModel = mongoose.model<IUser>("User", userSchema);


// New User Modal
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  password?: string;
  role: "user" | "bot" | "admin";
  balance: number;
  totalDeposite: number;
  totalWithdraw: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, default: "" },
    role: { type: String, enum: ["user", "bot", "admin"], default: "user" },
    balance: { type: Number, default: 0 },
    totalDeposite: { type: Number, default: 0 },
    totalWithdraw: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>("User", UserSchema);
