import mongoose, { Schema, Types, HydratedDocument, Model } from "mongoose";
import { ROUND_STATUS } from "./round.types";

/** Status enum (reusable in services) */
// export const ROUND_STATUS = {
//   OPEN: "open",
//   BETTING: "betting",
//   CLOSED: "closed",
//   REVEAL: "reveal",
//   PREPARE: "prepare",
//   COMPLETED: "completed",
// } as const;

export type RoundStatus = (typeof ROUND_STATUS)[keyof typeof ROUND_STATUS];

/** Individual box stats for a round */
export interface IRoundBox {
  title: string;
  icon: string;
  multiplier?: number;
  totalBet: number;
  userCount: number;
}

/** Stats for bonus calculation and payout */
export interface IBoxStat {
  box: string | null;
  title: string | null;
  group: string | null,
  icon: string | null;
  multiplier: string | null;
  totalAmount: number;
  bettorsCount: number;
}

/** Main round shape (do NOT extend Document; keep it plain) */
export interface IRound {
  _id: Types.ObjectId;
  roundNumber: number;
  roundStatus: RoundStatus;
  startTime: Date;
  endTime: Date;
  revealTime: Date,
  prepareTime: Date,
  boxes: IRoundBox[];
  winningBox?: string | null;
  totalPool: number;
  companyCut: number;
  reserveWallet: Number;
  distributedAmount: number;
  bets: Types.ObjectId[];
  boxStats: IBoxStat[];
  topWinners: { userId: Types.ObjectId; amountWon: number }[];
  phase: string;
  phaseEndTime: Date
  createdAt: Date;
  updatedAt: Date;
}

/** Subdocs */
const RoundBoxSchema = new Schema<IRoundBox>(
  {
    title: { type: String, required: true },
    icon: { type: String, required: true },
    multiplier: { type: Number },
    totalBet: { type: Number, default: 0 },
    userCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const BoxStatSchema = new Schema<IBoxStat>(
  {
    box: { type: String, default: null }, // allow null to match interface
    title: { type: String, default: null },
    icon: { type: String, default: null },
    multiplier: { type: Number },
    totalAmount: { type: Number, default: 0 },
    bettorsCount: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Round schema */
const roundSchema = new Schema<IRound>(
  {
    roundNumber: { type: Number, required: true, unique: true, index: true },
    roundStatus: {
      type: String,
      enum: Object.values(ROUND_STATUS),
      default: ROUND_STATUS.CLOSED,
      index: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    revealTime: { type: Date },
    prepareTime: { type: Date },
    boxes: { type: [RoundBoxSchema], required: true },
    winningBox: { type: String, default: null },
    totalPool: { type: Number, default: 0 },
    companyCut: { type: Number, default: 0 },
    distributedAmount: { type: Number, default: 0 },
    reserveWallet: { type: Number, default: 0 },
    bets: [{ type: Schema.Types.ObjectId, ref: "Bet", default: [] }],
    boxStats: { type: [BoxStatSchema], default: [] },

    topWinners: {
      type: [
        new Schema(
          {
            userId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            amountWon: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    phase: { type: String },
    phaseEndTime: { type: Date }
  },
  { timestamps: true }
);

/** Types for convenience */
export type RoundDoc = HydratedDocument<IRound>;
export type RoundModel = Model<IRound>;

/** Model */
const Round = mongoose.model<IRound, RoundModel>("Round", roundSchema);
export default Round;
