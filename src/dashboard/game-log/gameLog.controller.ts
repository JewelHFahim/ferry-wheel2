// src/dashboard/game-log/gameLog.controller.ts
import mongoose, { Types } from "mongoose";
import { Request, Response } from "express";
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

export async function requiredDatas(input: RequiredDatasInput) {
  if (!input?.gameId || !mongoose.isValidObjectId(String(input.gameId))) throw new Error("Invalid gameId");
  if (!input?.roundId || !mongoose.isValidObjectId(String(input.roundId))) throw new Error("Invalid roundId");
  if (!input?.gameName) throw new Error("gameName required");
  if (!input?.identification) throw new Error("identification required");

  const gameId = new mongoose.Types.ObjectId(String(input.gameId));
  const roundId = new mongoose.Types.ObjectId(String(input.roundId));
  const date = input.date ? new Date(input.date) : new Date();
  const day = startOfDayUTC(date);

  const cons = Number(input.consumption ?? 0);
  const reward = Number(input.rewardAmount ?? 0);
  const revenue = Number(input.platformRevenue ?? 0);

  // optional duplicate guard
  const already = await GameLogDaily.findOne({ gameId, day, "lastRounds.roundId": roundId }).lean();
  if (already) return { status: "duplicate", day, doc: already };

  const roundMeta = {
    roundId,
    identification: input.identification,
    consumption: cons,
    rewardAmount: reward,
    platformRevenue: revenue,
    gameVictoryResult: input.gameVictoryResult ?? "",
    date,
  };

  const update = {
    $setOnInsert: {
      gameId,
      gameName: input.gameName,
      day,
      // IMPORTANT: dotted paths (avoid ancestor/child conflict with $inc)
      "totals.consumption": 0,
      "totals.rewardAmount": 0,
      "totals.platformRevenue": 0,
      "totals.rounds": 0,
      lastRounds: [],
    },
    $inc: {
      "totals.consumption": cons,
      "totals.rewardAmount": reward,
      "totals.platformRevenue": revenue,
      "totals.rounds": 1,
    },
    $push: { lastRounds: { $each: [roundMeta], $slice: -50 } },
  };

  const doc = await GameLogDaily.findOneAndUpdate(
    { gameId, day },   // <-- FILTER
    update,            // <-- UPDATE
    { upsert: true, new: true } // <-- OPTIONS
  ).lean();

  const count = await GameLogDaily.countDocuments({ gameId: new mongoose.Types.ObjectId("66f3b5c2e5f8f2d456789012") });
console.log("daily docs for test gameId:", count);


  return { status: "logged", day, doc };
}

/* Optional GET remains the same */
export const getDaily = async (req: Request, res: Response) => {
  try {
    const { gameId, from, to, limit = "50", cursor } = req.query as Record<string,string>;
    const q: any = {};
    if (gameId) {
      if (!mongoose.isValidObjectId(gameId)) {
        return res.status(400).json({ status: false, message: "Invalid gameId" });
      }
      q.gameId = new mongoose.Types.ObjectId(gameId);
    }
    if (from || to || cursor) {
      q.day = q.day || {};
      if (from) q.day.$gte = new Date(from);
      if (to) q.day.$lte = new Date(to);
      if (cursor) q.day.$lt = new Date(cursor);
    }
    const items = await GameLogDaily.find(q).sort({ day: -1 }).limit(Math.min(Number(limit) || 50, 200)).lean();
    const nextCursor = items.length ? items[items.length - 1].day.toISOString() : null;
    res.json({ status: true, items, nextCursor });
  } catch (e: any) {
    res.status(500).json({ status: false, message: e?.message || "Server error" });
  }
};
