import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMet extends Document {
  currentRoundId: Types.ObjectId | null;
  lastRoundEndedAt: Date | null;
  totalBets: number;
  totalPayouts: number;
  companyWallet: number;
  reserveWallet: number;
  roundCounter: number;
  totalUsers: number;
  createdAt: Date;
  updatedAt: Date;
}

const MetSchema = new Schema<IMet>(
  {
    currentRoundId: { type: Schema.Types.ObjectId, ref: "Round", default: null },
    lastRoundEndedAt: { type: Date, default: null },
    totalBets: { type: Number, default: 0 },
    totalPayouts: { type: Number, default: 0 },
    companyWallet: { type: Number, default: 0 },
    reserveWallet: { type: Number, default: 0 },
    roundCounter: { type: Number, default: 0 },
    totalUsers: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const MetModel = mongoose.model<IMet>("Met", MetSchema);
