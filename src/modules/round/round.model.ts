import mongoose, { Schema, Types, HydratedDocument, Model } from "mongoose";

/** Status enum (reusable in services) */
export const ROUND_STATUS = {
  BETTING: "betting",
  CLOSED: "closed",
  COMPLETED: "completed",
} as const;
export type RoundStatus = typeof ROUND_STATUS[keyof typeof ROUND_STATUS];

/** Individual box stats for a round */
export interface IRoundBox {
  title: string;          // e.g., "Meat", "Tomato"
  icon: string;           // emoji/icon
  multiplier?: number;    // undefined => treat as 2x in your logic if desired
  totalBet: number;
  userCount: number;
}

/** Stats for bonus calculation and payout */
export interface IBoxStat {
  box: string | null;     // allow null
  totalAmount: number;
  bettorsCount: number;
}

/** Main round shape (do NOT extend Document; keep it plain) */
export interface IRound {
  _id: Types.ObjectId;
  roundNumber: number;
  roundStatus: RoundStatus;       // "betting" | "closed" | "completed"
  startTime: Date;
  endTime: Date;
  boxes: IRoundBox[];
  winningBox?: string | null;
  totalPool: number;
  companyCut: number;
  distributedAmount: number;
  bets: Types.ObjectId[];
  boxStats: IBoxStat[];
  topWinners: { userId: Types.ObjectId; amountWon: number }[];
  createdAt: Date;
  updatedAt: Date;
}

/** Subdocs */
const RoundBoxSchema = new Schema<IRoundBox>(
  {
    title: { type: String, required: true },
    icon: { type: String, required: true },
    multiplier: { type: Number },              // optional
    totalBet: { type: Number, default: 0 },
    userCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const BoxStatSchema = new Schema<IBoxStat>(
  {
    box: { type: String, default: null },      // allow null to match interface
    totalAmount: { type: Number, default: 0 },
    bettorsCount: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Round schema */
const roundSchema = new Schema<IRound>(
  {
    // DO NOT define _id yourself — let Mongoose/Mongo handle it
    roundNumber: { type: Number, required: true, unique: true, index: true },
    roundStatus: {
      type: String,
      enum: Object.values(ROUND_STATUS),
      default: ROUND_STATUS.BETTING,
      index: true,
    },
    startTime: { type: Date, required: true },
    endTime:   { type: Date, required: true },

    boxes: { type: [RoundBoxSchema], required: true },

    winningBox: { type: String, default: null },

    totalPool: { type: Number, default: 0 },
    companyCut: { type: Number, default: 0 },
    distributedAmount: { type: Number, default: 0 },

    bets: [{ type: Schema.Types.ObjectId, ref: "Bet", default: [] }],
    boxStats: { type: [BoxStatSchema], default: [] },

    topWinners: {
      type: [
        new Schema(
          {
            userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
            amountWon: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

/** Types for convenience */
export type RoundDoc = HydratedDocument<IRound>;
export type RoundModel = Model<IRound>;

/** Model */
const Round = mongoose.model<IRound, RoundModel>("Round", roundSchema);
export default Round;
