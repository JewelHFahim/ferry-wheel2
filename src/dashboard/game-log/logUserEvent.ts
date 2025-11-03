import mongoose from "mongoose";
import { IRoundEvent, RoundEvent, TopWinnersType } from "./gameLog.model";
import { SettingsService } from "../../modules/settings/settings.service";
import { IUserEvent, UserBetsType, UserEvent } from "./gameLogUser.model";

export async function logUserEvent(payload: {
  gameId: string;
  roundId: string;
  identification: string;
  userName: string,
  userConsumption: number;
  userRewardAmount: number;
  platformRevenue: number;
  platformReserve: number;
  userVictoryResult: UserBetsType[];
  winnerBox: string;
  date?: Date | string;
}) {


  const doc: IUserEvent = {
    _id: new mongoose.Types.ObjectId(payload.roundId),
    gameId: new mongoose.Types.ObjectId(payload.gameId),
    userName: payload.userName,
    identification: payload.identification,
    userConsumption: Number(payload.userConsumption || 0),
    userRewardAmount: Number(payload.userRewardAmount || 0),
    platformRevenue: Number(payload.platformRevenue || 0),
    platformReserve: Number(payload.platformReserve || 0),
    userVictoryResult: payload.userVictoryResult || [],
    winnerBox: payload.winnerBox,
    date: payload.date ? new Date(payload.date) : new Date(),
  };

  try {
    await UserEvent.collection.insertOne(doc as any);
    return { status: "inserted" as const };
  } catch (e: any) {
    if (e?.code === 11000) return { status: "duplicate" as const }; // same round retried
    throw e;
  }
}
