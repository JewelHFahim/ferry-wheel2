// src/dashboard/game-log/GameLogDaily.model.ts
import { Schema, model, Types } from "mongoose";

export interface IRoundMeta {
  roundId: Types.ObjectId;
  identification: string;
  consumption: number;
  rewardAmount: number;
  platformRevenue: number;
  gameVictoryResult: string;
  date: Date;
}

export interface IGameLogDaily {
  gameId: Types.ObjectId;
  gameName: string;
  day: Date; // 00:00:00.000Z
  totals: {
    consumption: number;
    rewardAmount: number;
    platformRevenue: number;
    rounds: number;
  };
  lastRounds: IRoundMeta[]; // capped array
}

const RoundMeta = new Schema<IRoundMeta>(
  {
    roundId: { type: Schema.Types.ObjectId, required: true },
    identification: { type: String, required: true },
    consumption: { type: Number, required: true, default: 0 },
    rewardAmount: { type: Number, required: true, default: 0 },
    platformRevenue: { type: Number, required: true, default: 0 },
    gameVictoryResult: { type: String, default: "" },
    date: { type: Date, required: true },
  },
  { _id: false }
);

const GameLogDailySchema = new Schema<IGameLogDaily>(
  {
    gameId: { type: Schema.Types.ObjectId, required: true, index: true },
    gameName: { type: String, required: true, index: true },
    day: { type: Date, required: true, index: true },
    totals: {
      consumption: { type: Number, required: true, default: 0 },
      rewardAmount: { type: Number, required: true, default: 0 },
      platformRevenue: { type: Number, required: true, default: 0 },
      rounds: { type: Number, required: true, default: 0 },
    },
    lastRounds: { type: [RoundMeta], default: [] },
  },
  { timestamps: true, versionKey: false }
);

GameLogDailySchema.index({ gameId: 1, day: 1 }, { unique: true });

export const GameLogDaily =
  (global as any).GameLogDaily || model<IGameLogDaily>("GameLogDaily", GameLogDailySchema);
