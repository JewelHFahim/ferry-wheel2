import mongoose from "mongoose";
import { IRoundEvent, RoundEvent, TopWinnersType } from "./gameLog.model";
import { SettingsService } from "../../modules/settings/settings.service";

export async function logRoundEvent(payload: {
  gameId: string;
  roundId: string;
  identification: number;
  consumption: number;
  rewardAmount: number;
  platformRevenue: number;
  platformReserve: number;
  gameVictoryResult: TopWinnersType[];
  winnerBox: string;
  date?: Date | string;
}) {
  
  const settings = await SettingsService.getSettings();
  if (!settings) {
    return { status: "skipped" as const };
  }  

  const doc: IRoundEvent = {
    _id: new mongoose.Types.ObjectId(payload.roundId),
    gameId: new mongoose.Types.ObjectId(payload.gameId),
    gameName: settings.siteName,
    identification: payload.identification,
    consumption: Number(payload.consumption || 0),
    rewardAmount: Number(payload.rewardAmount || 0),
    platformRevenue: Number(payload.platformRevenue || 0),
    platformReserve: Number(payload.platformReserve || 0),
    gameVictoryResult: payload.gameVictoryResult || [],
    winnerBox: payload.winnerBox,
    date: payload.date ? new Date(payload.date) : new Date(),
  };

  try {
    await RoundEvent.collection.insertOne(doc as any);
    return { status: "inserted" as const };
  } catch (e: any) {
    if (e?.code === 11000) return { status: "duplicate" as const }; // same round retried
    throw e;
  }
}
