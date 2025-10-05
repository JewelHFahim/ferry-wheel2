// import { Schema, model, Document, Types } from "mongoose";

// export interface IBet extends Document {
//   userId: Types.ObjectId;
//   roundId: Types.ObjectId;
//   box: string;
//   amount: number;
//   createdAt: Date;
// }

// const betSchema = new Schema<IBet>(
//   {
//     userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
//     roundId: { type: Schema.Types.ObjectId, ref: "Round", required: true },
//     box: { type: String, required: true },
//     amount: { type: Number, required: true },
//   },
//   { timestamps: true }
// );

// export default model<IBet>("Bet", betSchema);


// New Bet Model
import { Schema, model, Document, Types } from "mongoose";

export interface IBet extends Document {
  userId: Types.ObjectId;
  roundId: Types.ObjectId;
  box: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BetSchema = new Schema<IBet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roundId: { type: Schema.Types.ObjectId, ref: "Round", required: true },
    box: { type: String, required: true },
    amount: { type: Number, required: true }
  },
  { timestamps: true }
);

export default model<IBet>("Bet", BetSchema);
