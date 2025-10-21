import mongoose, { Schema, Types, HydratedDocument, Model } from "mongoose";

/** Public shape you’ll read */
export interface IUserRoundStats {
  userId: Types.ObjectId;
  roundId: Types.ObjectId;

  // betting
  totalBet: number;        // sum of amounts staked by the user in this round
  betCount: number;        // how many individual bet records they placed
  firstBetAt?: Date | null;
  lastBetAt?: Date | null;

  // settlement
  winAmount: number;       // total credited to user as winnings for this round
  loseAmount: number;      // OPTIONAL: if you want to track "loss" explicitly = totalBet - refunded - win? (we’ll set equal to totalBet for simple games)
  // NOTE: if your game refunds some stakes in certain outcomes, you can subtract refunds from loseAmount during settlement.

  createdAt: Date;
  updatedAt: Date;
}

export type UserRoundStatsDoc = HydratedDocument<IUserRoundStats>;

export interface UserRoundStatsModel extends Model<IUserRoundStats> {
  /** Upsert on bet placement */
  upsertOnBet(args: {
    userId: string | Types.ObjectId;
    roundId: string | Types.ObjectId;
    amount: number;
    at?: Date;
  }, session?: mongoose.ClientSession): Promise<UserRoundStatsDoc>;

  /** Apply payout on settlement */
  applyPayout(args: {
    userId: string | Types.ObjectId;
    roundId: string | Types.ObjectId;
    winAmount: number;       // amount credited to user at endRound
    // If you want a custom loseAmount (e.g., refunds), pass it; otherwise we’ll default to += 0 here and
    // you can set it explicitly in endRound based on game rules.
    loseAmountDelta?: number;
  }, session?: mongoose.ClientSession): Promise<UserRoundStatsDoc | null>;
}

const UserRoundStatsSchema = new Schema<IUserRoundStats, UserRoundStatsModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roundId: { type: Schema.Types.ObjectId, ref: "Round", required: true, index: true },

    totalBet:   { type: Number, default: 0 },
    betCount:   { type: Number, default: 0 },
    firstBetAt: { type: Date, default: null },
    lastBetAt:  { type: Date, default: null },

    winAmount:  { type: Number, default: 0 },
    loseAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Uniqueness per (user, round)
UserRoundStatsSchema.index({ userId: 1, roundId: 1 }, { unique: true });

// Virtual: net = win - lose
UserRoundStatsSchema.virtual("netAmount").get(function (this: IUserRoundStats) {
  return (this.winAmount || 0) - (this.loseAmount || 0);
});

/** Static: upsert on bet */
UserRoundStatsSchema.statics.upsertOnBet = async function (
  { userId, roundId, amount, at }: { userId: string | Types.ObjectId; roundId: string | Types.ObjectId; amount: number; at?: Date },
  session?: mongoose.ClientSession
) {
  const now = at ?? new Date();
  const res = await this.findOneAndUpdate(
    { userId, roundId },
    {
      $inc: { totalBet: amount, betCount: 1 },
      $setOnInsert: { firstBetAt: now },
      $set: { lastBetAt: now },
    },
    { upsert: true, new: true, session }
  );
  return res;
};

/** Static: apply payout on round settlement */
UserRoundStatsSchema.statics.applyPayout = async function (
  { userId, roundId, winAmount, loseAmountDelta = 0 }:
  { userId: string | Types.ObjectId; roundId: string | Types.ObjectId; winAmount: number; loseAmountDelta?: number },
  session?: mongoose.ClientSession
) {
  const res = await this.findOneAndUpdate(
    { userId, roundId },
    {
      $inc: {
        winAmount: Math.max(0, winAmount || 0),
        loseAmount: Math.max(0, loseAmountDelta || 0),
      },
    },
    { new: true, session }
  );
  return res;
};

const UserRoundStats = mongoose.model<IUserRoundStats, UserRoundStatsModel>(
  "UserRoundStats",
  UserRoundStatsSchema
);

export default UserRoundStats;
