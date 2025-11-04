import mongoose, { Schema, Types } from "mongoose";

export interface TopWinnersType {
  box: string;
  boxTotal: number;
}

export interface IRoundEvent {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  gameName: string;
  identification: number;
  consumption: number;
  rewardAmount: number;
  platformRevenue: number;
  platformReserve: number;
  gameVictoryResult: TopWinnersType[];
  winnerBox: string;
  date: Date;
}

const RoundEventSchema = new Schema<IRoundEvent>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    gameId: { type: Schema.Types.ObjectId, required: true, index: true },
    gameName: { type: String, required: true },
    identification: { type: Number, required: true },
    consumption: { type: Number, required: true, default: 0 },
    rewardAmount: { type: Number, required: true, default: 0 },
    platformRevenue: { type: Number, required: true, default: 0 },
    platformReserve: { type: Number, required: true, default: 0 },
    gameVictoryResult: [
      {
        box: { type: String },
        boxTotal: { type: Number },
      },
    ],
    winnerBox:{ type: String, required: true },
    date: { type: Date, required: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: "round_events" }
);

// fast queries by (gameId, date)
RoundEventSchema.index({ gameId: 1, date: -1 });
RoundEventSchema.index({ date: -1 });

export const RoundEvent = mongoose.models.RoundEvent || mongoose.model<IRoundEvent>("RoundEvent", RoundEventSchema);
