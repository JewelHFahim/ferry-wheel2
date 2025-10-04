import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Global meta document for tracking live game stats, round counters, payouts, and reserves.
 * Only one document is expected in the collection.
 */
export interface IMet extends Document {
  currentRoundId: Types.ObjectId | null;    // Current active round
  lastRoundEndedAt: Date | null;            // Timestamp of last round end
  totalBets: number;                        // Sum of all bets across all rounds
  totalPayouts: number;                     // Sum of all payouts distributed
  companyWallet: number;                    // Total commission accumulated for the company
  reserveWallet: number;                    // Reserved amount that couldn't be paid in previous rounds
  roundCounter: number;                     // Total number of rounds started
  totalUsers: number;                       // Total number of users
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
    totalUsers: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Ensure only one global meta document exists
MetSchema.index({ _id: 1 }, { unique: true });

export const MetModel = mongoose.model<IMet>("Met", MetSchema);
