// roundEngine.ts
import Round from "../modules/round/round.model";
import { SettingsService } from "../modules/settings/settings.service";
import { startNewRound } from "./startNewRound.job";
import { endRound } from "./endRound.job";
import { ROUND_STATUS } from "../modules/round/round.types";

let loopRunning = false;

export async function startRoundLoop(nsp: import("socket.io").Namespace) {
  if (loopRunning) return;
  loopRunning = true;

  // On boot, try to resume if a round is active; otherwise start a new one.
  const now = Date.now();
  let current = await Round.findOne({
    roundStatus: { $in: [ROUND_STATUS.BETTING, ROUND_STATUS.REVEALING, ROUND_STATUS.PREPARE] },
  }).sort({ createdAt: -1 }).lean();

  if (!current) {
    await startNewRound(nsp);
    current = await Round.findOne().sort({ createdAt: -1 }).lean();
  }

  scheduleNextTick(current!, nsp);
}

function scheduleNextTick(round: any, nsp: import("socket.io").Namespace) {
  const now = Date.now();
  const betEnd = new Date(round.endTime).getTime();
  const revEnd = new Date(round.revealTime).getTime();
  const prepEnd = new Date(round.prepareTime).getTime();

  if (now < betEnd) {
    // Still betting → schedule endRound when betting closes
    setTimeout(async () => {
      await endRound(String(round._id), nsp);
      const next = await Round.findOne().sort({ createdAt: -1 }).lean();
      scheduleNextTick(next!, nsp);
    }, betEnd - now);
  } else if (now < prepEnd) {
    // We’re already in reveal/prepare; just wait out the prepare end and start next round
    setTimeout(async () => {
      await startNewRound(nsp);
      const next = await Round.findOne().sort({ createdAt: -1 }).lean();
      scheduleNextTick(next!, nsp);
    }, prepEnd - now);
  } else {
    // Round fully finished → start a new one right away
    (async () => {
      await startNewRound(nsp);
      const next = await Round.findOne().sort({ createdAt: -1 }).lean();
      scheduleNextTick(next!, nsp);
    })();
  }
}


// src/dashboard/game-log/RoundEvent.controller.ts
// import { Request, Response } from "express";
// import mongoose from "mongoose";
// import { RoundEvent } from "./gameLog.model";

// export async function getRoundLogs(req: Request, res: Response) {
//   try {
//     const { gameId, from, to, limit = "50", cursor } = req.query as Record<string, string>;

//     const q: any = {};
//     if (gameId) {
//       if (!mongoose.isValidObjectId(gameId)) {
//         return res.status(400).json({ status: false, message: "Invalid gameId" });
//       }
//       q.gameId = new mongoose.Types.ObjectId(gameId);
//     }
//     if (from || to) {
//       q.date = q.date || {};
//       if (from) q.date.$gte = new Date(from);
//       if (to)   q.date.$lte = new Date(to);
//     }
//     if (cursor) {
//       // keyset pagination: fetch strictly older than cursor date
//       q.date = q.date || {};
//       q.date.$lt = new Date(cursor);
//     }

//     const pageSize = Math.min(Number(limit) || 50, 500);

//     // 1) page of items (newest first)
//     const items = await RoundEvent.find(q)
//       .sort({ date: -1 })
//       .limit(pageSize)
//       .lean();

//     const nextCursor = items.length ? items[items.length - 1].date.toISOString() : null;

//     // 2) totals for the same filter (ignore cursor so you get full-range totals)
//     const totalsAgg = await RoundEvent.aggregate([
//       { $match: { ...q, ...(cursor ? { date: { ...(q.date || {}), $lt: undefined } } : {}) } }, // remove $lt from totals
//       ...(q.date && cursor ? [{ $match: { date: { ...(q.date || {}), $ne: undefined, $gte: q.date.$gte, $lte: q.date.$lte } } }] : []),
//       { $group: {
//           _id: null,
//           totalConsumption: { $sum: "$consumption" },
//           totalRewardAmount: { $sum: "$rewardAmount" },
//           totalPlatformRevenue: { $sum: "$platformRevenue" },
//           rounds: { $sum: 1 },
//       } },
//       { $project: { _id: 0 } }
//     ]).exec();

//     const totals = totalsAgg[0] || {
//       totalConsumption: 0,
//       totalRewardAmount: 0,
//       totalPlatformRevenue: 0,
//       rounds: 0,
//     };

//     return res.json({ status: true, items, nextCursor, totals });
//   } catch (e: any) {
//     return res.status(500).json({ status: false, message: e?.message || "Server error" });
//   }
// }
