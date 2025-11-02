// src/dashboard/game-log/RoundEvent.model.ts
import mongoose, { Schema, Types } from "mongoose";

export interface IRoundEvent {
  _id: Types.ObjectId;                 // = roundId (unique → idempotent)
  gameId: Types.ObjectId;
  gameName: string;
  identification: string;
  consumption: number;
  rewardAmount: number;
  platformRevenue: number;
  gameVictoryResult: string;
  date: Date;
}

const RoundEventSchema = new Schema<IRoundEvent>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },           // roundId
    gameId: { type: Schema.Types.ObjectId, required: true, index: true },
    gameName: { type: String, required: true },
    identification: { type: String, required: true },
    consumption: { type: Number, required: true, default: 0 },
    rewardAmount: { type: Number, required: true, default: 0 },
    platformRevenue: { type: Number, required: true, default: 0 },
    gameVictoryResult: { type: String, default: "" },
    date: { type: Date, required: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: "round_events" }
);

// fast queries by (gameId, date)
RoundEventSchema.index({ gameId: 1, date: -1 });
// optional: if you often query *all games* by date
RoundEventSchema.index({ date: -1 });

export const RoundEvent =
  mongoose.models.RoundEvent || mongoose.model<IRoundEvent>("RoundEvent", RoundEventSchema);
