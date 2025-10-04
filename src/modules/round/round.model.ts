import mongoose, { Document, Schema, Types } from "mongoose";

// Individual box stats for a round
export interface IRoundBox {
  title: string;             // Box name (e.g., "Meat", "Tomato", "Pizza", "Salad")
  icon: string;              // Emoji/icon for display
  multiplier?: number;       // Multiplier, undefined means double payout
  totalBet: number;          // Total amount bet on this box
  userCount: number;         // Number of users who placed bet on this box
}

// Stats for bonus calculation and payout
export interface IBoxStat {
  box: string | null;        // Box title
  totalAmount: number;       // Total bet on this box
  bettorsCount: number;      // Number of users who bet
}

// Main round interface
export interface IRound extends Document {
  //  _id: Types.ObjectId;
  roundNumber: number;
  roundStatus: "betting" | "closed" | "completed"; // Phase of round
  startTime: Date;
  endTime: Date;
  boxes: IRoundBox[];        // 8 main + 2 bonus boxes
  winningBox?: string;       // Title of winning box
  totalPool: number;         // Total amount bet in this round
  companyCut: number;        // 10% company cut
  distributedAmount: number; // Total amount distributed to users
  bets: Types.ObjectId[];    // References to Bet documents
  boxStats: IBoxStat[];      // For easy calculation of each box
  topWinners: { userId: Types.ObjectId; amountWon: number }[];
  createdAt: Date;
  updatedAt: Date;
}

// Box schema
const RoundBoxSchema = new Schema<IRoundBox>({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  multiplier: { type: Number },
  totalBet: { type: Number, default: 0 },
  userCount: { type: Number, default: 0 },
});

// BoxStat schema
const BoxStatSchema = new Schema<IBoxStat>({
  box: { type: String, required: true },
  totalAmount: { type: Number, default: 0 },
  bettorsCount: { type: Number, default: 0 },
});

// Round schema
const roundSchema = new Schema<IRound>(
  {
    _id: { type: Schema.Types.ObjectId },
    roundNumber: { type: Number, required: true, unique: true },
    roundStatus: { type: String, enum: ["betting", "closed", "completed"], default: "betting" },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    boxes: { type: [RoundBoxSchema], required: true },
    winningBox: { type: String, default: null },
    totalPool: { type: Number, default: 0 },
    companyCut: { type: Number, default: 0 },
    distributedAmount: { type: Number, default: 0 },
    bets: [{ type: Schema.Types.ObjectId, ref: "Bet" }],
    boxStats: { type: [BoxStatSchema], default: [] },
    topWinners: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        amountWon: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

const Round = mongoose.model<IRound>("Round", roundSchema);

export default Round;
