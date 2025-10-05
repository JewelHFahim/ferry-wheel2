import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
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
    _id: { type: Schema.Types.ObjectId },
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
