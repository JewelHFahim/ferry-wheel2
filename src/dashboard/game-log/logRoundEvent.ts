// src/dashboard/game-log/logRoundEvent.ts
import mongoose from "mongoose";
import { IRoundEvent, RoundEvent } from "./gameLog.model";

export async function logRoundEvent(payload: {
  gameId: string;
  roundId: string;           // will be used as _id
  gameName: string;
  identification: string;
  consumption: number;
  rewardAmount: number;
  platformRevenue: number;
  gameVictoryResult?: string;
  date?: Date | string;
}) {
  const doc: IRoundEvent = {
    _id: new mongoose.Types.ObjectId(payload.roundId),
    gameId: new mongoose.Types.ObjectId(payload.gameId),
    gameName: payload.gameName,
    identification: payload.identification,
    consumption: Number(payload.consumption || 0),
    rewardAmount: Number(payload.rewardAmount || 0),
    platformRevenue: Number(payload.platformRevenue || 0),
    gameVictoryResult: payload.gameVictoryResult ?? "",
    date: payload.date ? new Date(payload.date) : new Date(),
  };

  try {
    await RoundEvent.collection.insertOne(doc as any); // fastest, idempotent via _id
    return { status: "inserted" as const };
  } catch (e: any) {
    if (e?.code === 11000) return { status: "duplicate" as const }; // same round retried
    throw e;
  }
}
