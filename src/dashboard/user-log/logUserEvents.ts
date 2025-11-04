import mongoose, { Types } from "mongoose";
import { UserEvent } from "./UserEvent.model";
import { SettingsService } from "../../modules/settings/settings.service";

type Bet = { userId: string; box: string; amount: number };
type PayoutRow = { userId: string; amount: number };

export async function logUserEventsForRound(opts: {
  gameId: string;
  roundId: string;
  identification: number;
  winnerBox: string;
  bets: Bet[];
  date: Date | string;
  payouts: PayoutRow[];
  resolveUserName?: (userId: Types.ObjectId) => Promise<string> | string;
}) {

  const settings = await SettingsService.getSettings();
  if (!settings) {
    return { status: "skipped" as const };
  }

  const gameId = new mongoose.Types.ObjectId(opts.gameId);
  const roundId = new mongoose.Types.ObjectId(opts.roundId);
  const roundDate = new Date(opts.date);

  // --- Aggregate per user ---
  const perUserBetTotals = new Map<string, number>();
  const perUserBoxTotals = new Map<string, Map<string, number>>();

  for (const b of opts.bets) {
    perUserBetTotals.set(b.userId, (perUserBetTotals.get(b.userId) || 0) + b.amount);
    let boxMap = perUserBoxTotals.get(b.userId);
    if (!boxMap) { boxMap = new Map(); perUserBoxTotals.set(b.userId, boxMap); }
    boxMap.set(b.box, (boxMap.get(b.box) || 0) + b.amount);
  }

  const perUserPayout = new Map<string, number>();
  for (const p of opts.payouts) {
    perUserPayout.set(p.userId, (perUserPayout.get(p.userId) || 0) + p.amount);
  }

  // --- Build bulk upserts (idempotent via unique {roundId,userId}) ---
  const ops = [];
  for (const [userIdStr, userConsumption] of perUserBetTotals.entries()) {
    const userId = new mongoose.Types.ObjectId(userIdStr);
    const userRewardAmount = perUserPayout.get(userIdStr) || 0;

    const boxMap = perUserBoxTotals.get(userIdStr) || new Map();
    const userBetHistory = Array.from(boxMap.entries()).map(([box, boxTotal]) => ({ box, boxTotal }));

    const userName = (opts.resolveUserName ? await opts.resolveUserName(userId) : undefined) || userId;

    ops.push({
      updateOne: {
        filter: { roundId, userId },
        update: {
          $setOnInsert: { _id: new mongoose.Types.ObjectId() },
          $set: {
            gameId,
            roundId,
            userId,
            userName,
            gameName: settings.siteName,
            identification: opts.identification,
            userConsumption,
            userRewardAmount,
            userBetHistory,
            winnerBox: opts.winnerBox,
            date: roundDate,
          },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) {
    await UserEvent.bulkWrite(ops, { ordered: false });
  }

  return { insertedOrUpserted: ops.length };
}
