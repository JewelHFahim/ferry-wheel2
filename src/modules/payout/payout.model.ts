import mongoose, { Schema, Types } from "mongoose";

export interface IPayout {
  roundId: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  multiplierUsed: number;
  reason: "direct" | "group:Pizza" | "group:Salad";
  createdAt: Date;
}

const PayoutSchema = new Schema<IPayout>(
  {
    roundId: { type: Schema.Types.ObjectId, ref: "Round", index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    amount: { type: Number, required: true },
    multiplierUsed: { type: Number, required: true },
    reason: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// PayoutSchema.index({ roundId: 1, userId: 1 });
// PayoutSchema.index({ userId: 1, createdAt: -1 });


const Payout = mongoose.model<IPayout>("Payout", PayoutSchema);

export default Payout;