import mongoose, { Schema, Types, HydratedDocument, Model } from "mongoose";

export interface IBet {
  userId: Types.ObjectId;
  roundId: Types.ObjectId;
  box: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

const betSchema = new Schema<IBet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roundId: { type: Schema.Types.ObjectId, ref: "Round", required: true },
    box: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

export type BetDoc = HydratedDocument<IBet>;
export type BetModel = Model<IBet>;

const Bet = mongoose.model<IBet, BetModel>("Bet", betSchema);
export default Bet;
