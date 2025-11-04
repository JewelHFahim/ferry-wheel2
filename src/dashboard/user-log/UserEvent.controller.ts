import { Request, Response } from "express";
import mongoose from "mongoose";
import { UserEvent } from "./UserEvent.model";

const startOfUTCDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
const endOfUTCDay   = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

function monthRangeUTC(ref: Date, offsetMonths = 0) {
  const y = ref.getUTCFullYear(), m = ref.getUTCMonth() + offsetMonths;
  return { from: new Date(Date.UTC(y, m, 1, 0,0,0,0)), to: new Date(Date.UTC(y, m+1, 0, 23,59,59,999)) };
}

export async function getUserEvents(req: Request, res: Response) {
  try {
    const {
      gameId, userId, roundId, gameName, userName,
      preset, from, to,
      search,
      limit = "50", cursor
    } = req.query as Record<string, string>;

    console.log("req.query: ", req.query)

    const q: any = {};

    console.log("query: ", q)

    if (gameId) {
      if (!mongoose.isValidObjectId(gameId)) return res.status(400).json({ status: false, message: "Invalid gameId" });
      q.gameId = new mongoose.Types.ObjectId(gameId);
    }
    if (userId) {
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ status: false, message: "Invalid userId" });
      q.userId = new mongoose.Types.ObjectId(userId);
    }
    if (roundId) {
      if (!mongoose.isValidObjectId(roundId)) return res.status(400).json({ status: false, message: "Invalid roundId" });
      q.roundId = new mongoose.Types.ObjectId(roundId);
    }
    if (gameName) {
      q.gameName = new RegExp(gameName, "i"); // contains
    }
    if (userName) {
      q.userName = new RegExp(userName, "i");
    }

// helpers
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (search) {
  if (mongoose.isValidObjectId(search)) {
    const oid = new mongoose.Types.ObjectId(search);
    q.$or = [
      { userId: oid },
      { roundId: oid },
      { _id: oid },
      { gameId: oid },
    ];
  } else {
    // optional: enforce a minimum length (2) to avoid super-broad scans
    if (search.length < 2) {
      return res.status(400).json({ status: false, message: "Search term too short" });
    }
    const rx = new RegExp(escapeRegex(search), "i");
    q.$or = [
      { userName: rx },
      { identification: rx },
    ];
  }
}


    // date filters
    const now = new Date();
    let rangeFrom: Date | undefined;
    let rangeTo: Date | undefined;

    if (preset) {
      const p = preset.toLowerCase();
      if (p === "today") {
        rangeFrom = startOfUTCDay(now); rangeTo = endOfUTCDay(now);
      } else if (p === "this_month") {
        const r = monthRangeUTC(now, 0); rangeFrom = r.from; rangeTo = r.to;
      } else if (p === "last_month") {
        const r = monthRangeUTC(now, -1); rangeFrom = r.from; rangeTo = r.to;
      } else {
        return res.status(400).json({ status: false, message: "Invalid preset" });
      }
    } else if (from || to) {
      if (from) rangeFrom = new Date(from);
      if (to) rangeTo = new Date(to);
    }

    if (rangeFrom || rangeTo || cursor) {
      q.date = q.date || {};
      if (rangeFrom) q.date.$gte = rangeFrom;
      if (rangeTo) q.date.$lte = rangeTo;
      if (cursor) q.date.$lt = new Date(cursor);
    }

    const pageSize = Math.min(Number(limit) || 50, 500);

    // items page
    const items = await UserEvent.find(q).sort({ date: -1 }).limit(pageSize).lean();
    const nextCursor = items.length ? items[items.length - 1].date.toISOString() : null;

    // totals (ignore cursor)
    const totalsMatch: any = { ...q };
    if (totalsMatch.date && totalsMatch.date.$lt) {
      const { $lt, ...rest } = totalsMatch.date;
      totalsMatch.date = Object.keys(rest).length ? rest : undefined;
      if (!totalsMatch.date) delete totalsMatch.date;
    }

    const totalsAgg = await UserEvent.aggregate([
      { $match: totalsMatch },
      {
        $group: {
          _id: null,
          totalUserConsumption:  { $sum: "$userConsumption" },
          totalUserRewardAmount: { $sum: "$userRewardAmount" },
          totalUserPlatformRevenue: { $sum: "$userPlatformRevenue" },
          rows: { $sum: 1 },
        }
      },
      { $project: { _id: 0 } }
    ]);

    const totals = totalsAgg[0] || {
      totalUserConsumption: 0,
      totalUserRewardAmount: 0,
      totalUserPlatformRevenue: 0,
      rows: 0,
    };

    res.json({ status: true, items, nextCursor });
  } catch (e: any) {
    res.status(500).json({ status: false, message: e?.message || "Server error" });
  }
}
