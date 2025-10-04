import mongoose, { Document, Schema, Types } from "mongoose";

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  type: "withdraw" | "deposite" | "bet" | "win" | "refund";
  balance: number;
  balanceAfter: number;
  roundId?: Types.ObjectId;
  createdAt: Date;
}


const transactionSchema = new Schema<ITransaction>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, enum: ["withdraw", "deposite", "bet", "win", "refund"], required: true },
        balance: { type: Number, required: true, default: 0 },
        balanceAfter: { type: Number, required: true, default: 0 },
        roundId: { type: Schema.Types.ObjectId, ref: "Round" }
    },
    {
        timestamps: true
    }
);

const Transaction = mongoose.model<ITransaction>("Transaction", transactionSchema);

export default Transaction;