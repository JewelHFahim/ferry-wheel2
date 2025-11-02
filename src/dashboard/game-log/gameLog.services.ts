// src/dashboard/game-log/gameLog.service.ts
import mongoose, { Types } from "mongoose";
import { GameLogDaily } from "./GameLogDaily.model";
import { startOfDayUTC } from "../../utils/date";

export type RequiredDatasInput = {
  gameId: string | Types.ObjectId;
  roundId: string | Types.ObjectId;
  gameName: string;
  identification: string;
  consumption: number;
  rewardAmount: number;
  platformRevenue: number;
  gameVictoryResult?: string;
  date?: Date | string;
};

const LAST_N = 50;

export async function logGameRound(input: {
  gameId: string | Types.ObjectId;
  roundId: string | Types.ObjectId;
  gameName: string;
  identification: string;
  consumption: number;      // total bets
  rewardAmount: number;     // total payouts
  platformRevenue: number;  // company cut
  gameVictoryResult?: string;
  date?: Date | string;
}) {
  const gameId = typeof input.gameId === "string" ? new mongoose.Types.ObjectId(input.gameId) : input.gameId;
  const roundId = typeof input.roundId === "string" ? new mongoose.Types.ObjectId(input.roundId) : input.roundId;
  const date = input.date ? new Date(input.date) : new Date();
  const day = startOfDayUTC(date);

  const roundMeta = {
    roundId,
    identification: input.identification,
    consumption: Number(input.consumption || 0),
    rewardAmount: Number(input.rewardAmount || 0),
    platformRevenue: Number(input.platformRevenue || 0),
    gameVictoryResult: input.gameVictoryResult ?? "",
    date,
  };

  // Atomic daily upsert
const update = {
  $setOnInsert: {
    gameId,
    gameName: input.gameName,
    day,
    "totals.consumption": 0,
    "totals.rewardAmount": 0,
    "totals.platformRevenue": 0,
    "totals.rounds": 0,
    lastRounds: [],
  },
  $inc: {
    "totals.consumption": Number(input.consumption || 0),
    "totals.rewardAmount": Number(input.rewardAmount || 0),
    "totals.platformRevenue": Number(input.platformRevenue || 0),
    "totals.rounds": 1,
  },
  $push: { lastRounds: { $each: [roundMeta], $slice: -LAST_N } },
};

const doc = await GameLogDaily.findOneAndUpdate(
  { gameId, day },
  update,
  { upsert: true, new: true }
).lean();

  return { day, doc };
}


export async function requiredDatas(payload: RequiredDatasInput) {
  return logGameRound(payload);  // <-- delegate to the working service
}