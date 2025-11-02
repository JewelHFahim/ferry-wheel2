// src/dashboard/game-log/RoundEvent.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { RoundEvent } from "./gameLog.model";

export async function getRoundLogs(req: Request, res: Response) {
  try {
    const { gameId, from, to, limit = "50", cursor } = req.query as Record<string, string>;

    const q: any = {};
    if (gameId) {
      if (!mongoose.isValidObjectId(gameId)) {
        return res.status(400).json({ status: false, message: "Invalid gameId" });
      }
      q.gameId = new mongoose.Types.ObjectId(gameId);
    }
    if (from || to) {
      q.date = q.date || {};
      if (from) q.date.$gte = new Date(from);
      if (to)   q.date.$lte = new Date(to);
    }
    if (cursor) {
      // keyset pagination: fetch strictly older than cursor date
      q.date = q.date || {};
      q.date.$lt = new Date(cursor);
    }

    const pageSize = Math.min(Number(limit) || 50, 500);

    // 1) page of items (newest first)
    const items = await RoundEvent.find(q)
      .sort({ date: -1 })
      .limit(pageSize)
      .lean();

    const nextCursor = items.length ? items[items.length - 1].date.toISOString() : null;

    // 2) totals for the same filter (ignore cursor so you get full-range totals)
    const totalsAgg = await RoundEvent.aggregate([
      { $match: { ...q, ...(cursor ? { date: { ...(q.date || {}), $lt: undefined } } : {}) } }, // remove $lt from totals
      ...(q.date && cursor ? [{ $match: { date: { ...(q.date || {}), $ne: undefined, $gte: q.date.$gte, $lte: q.date.$lte } } }] : []),
      { $group: {
          _id: null,
          totalConsumption: { $sum: "$consumption" },
          totalRewardAmount: { $sum: "$rewardAmount" },
          totalPlatformRevenue: { $sum: "$platformRevenue" },
          rounds: { $sum: 1 },
      } },
      { $project: { _id: 0 } }
    ]).exec();

    const totals = totalsAgg[0] || {
      totalConsumption: 0,
      totalRewardAmount: 0,
      totalPlatformRevenue: 0,
      rounds: 0,
    };

    return res.json({ status: true, items, nextCursor, totals });
  } catch (e: any) {
    return res.status(500).json({ status: false, message: e?.message || "Server error" });
  }
}
