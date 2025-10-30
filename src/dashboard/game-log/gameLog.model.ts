import mongoose, { Schema, Types } from "mongoose";

export interface RoundLog {
  gameId: Types.ObjectId;
  roundId: Types.ObjectId;
  gameName: string;
  identification: string;
  consumption: number;
  rewardAmount: number;
  platformRevenue: number;
  gameVictoryResult: string;
  date: Date;
}

export interface IGameLog {
  totalConsumption: number;
  totalRewardAmount: number;
  totalPlatformRevenue: number;
  logs: RoundLog[];
}

const roundSchema = new Schema<RoundLog>({
  gameId: { type: Schema.Types.ObjectId, required: true },
  roundId: { type: Schema.Types.ObjectId, required: true },
  gameName: { type: String, required: true },
  identification: { type: String, required: true },
  consumption: { type: Number, required: true },
  rewardAmount: { type: Number, required: true },
  platformRevenue: { type: Number, required: true },
  gameVictoryResult: { type: String, required: true },
  date: { type: Date, required: true },
});

const gameLogSchema = new Schema<IGameLog>(
  {
    totalConsumption: { type: Number, required: true },
    totalRewardAmount: { type: Number, required: true },
    totalPlatformRevenue: { type: Number, required: true },
    logs: { type: [roundSchema], required: true },
  },
  {
    timestamps: true,
  }
);

const GameLog = mongoose.model<IGameLog>("GameLog", gameLogSchema);
export default GameLog;
