import { Types } from "mongoose";

export interface IUser {
  _id: Types.ObjectId;
  hostedUserId: string;
  role: "user" | "bot" | "admin";
  username: string;
  balance: number;
  password: string;
  totalDeposite: number;
  totalWithdraw: number;
  createdAt: Date;
  updatedAt: Date;
}
