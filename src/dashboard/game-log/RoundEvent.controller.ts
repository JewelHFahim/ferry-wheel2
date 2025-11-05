import { Request, Response } from "express";
import mongoose from "mongoose";
import { RoundEvent } from "./gameLog.model";

// --- UTC helpers (use Dhaka/local if you prefer) ---
const startOfUTCDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
const endOfUTCDay   = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

function monthRangeUTC(ref: Date, offsetMonths = 0) {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth() + offsetMonths;
  const first = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const last  = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { from: first, to: last };
}

// Get round logs
export async function getRoundLogs(req: Request, res: Response) {
  try {
    const {
      gameId,
      gameName,            
      preset,             
      from, to,           
      search,             
      limit = "50",
      cursor,             
    } = req.query as Record<string, string>;

    console.log("req.query: ", req.query)

    // ---------- Build query ----------
    const q: any = {};

    // gameId filter
    if (gameId) {
      if (!mongoose.isValidObjectId(gameId)) {
        return res.status(400).json({ status: false, message: "Invalid gameId" });
      }
      q.gameId = new mongoose.Types.ObjectId(gameId);
    }
    if (gameName) {
      q.gameName = new RegExp(gameName, "i"); // contains
    }

    // date filter (preset OR explicit range)
    const now = new Date();
    let rangeFrom: Date | undefined;
    let rangeTo: Date | undefined;

    if (preset) {
      const p = preset.toLowerCase();
      if (p === "today") {
        rangeFrom = startOfUTCDay(now);
        rangeTo   = endOfUTCDay(now);
      } else if (p === "this_month") {
        const r = monthRangeUTC(now, 0);
        rangeFrom = r.from; rangeTo = r.to; 
      } else if (p === "last_month") {
        const r = monthRangeUTC(now, -1);
        rangeFrom = r.from; rangeTo = r.to;
      } else {
        return res.status(400).json({ status: false, message: "Invalid preset (use today | this_month | last_month)" });
      }
    } else if (from || to) {
      if (from) rangeFrom = new Date(from);
      if (to)   rangeTo   = new Date(to);
    }

    if (rangeFrom || rangeTo || cursor) {
      q.date = q.date || {};
      if (rangeFrom) q.date.$gte = rangeFrom;
      if (rangeTo)   q.date.$lte = rangeTo;
      if (cursor)    q.date.$lt  = new Date(cursor);     
    }


    // escape regex from user input
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (search) {
      const or: any[] = [];

      // ObjectId match (id or gameId if you want)
      if (mongoose.isValidObjectId(search)) {
        or.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      // String fields (regex)
      const rx = new RegExp(escapeRegExp(search), "i");
      or.push({ userName: rx }, { gameName: rx });

      // Numeric field: identification
      const isDigits = /^\d+$/.test(search);
      if (isDigits) {
        or.push({ identification: Number(search) });
        or.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$identification" },
              regex: escapeRegExp(search),
              options: "i",
            },
          },
        });
      }

      if (or.length) q.$or = or;
    }


    const pageSize = Math.min(Number(limit) || 50, 500);

    // ---------- Query page ----------
    const items = await RoundEvent.find(q)
      .sort({ date: -1 })
      .limit(pageSize)
      .lean();

    const nextCursor = items.length ? items[items.length - 1].date.toISOString() : null;

    // ---------- Totals for the whole filter range (ignoring cursor) ----------
    const totalsMatch: any = { ...q };
    if (totalsMatch.date && totalsMatch.date.$lt) {
      const { $lt, ...rest } = totalsMatch.date;
      totalsMatch.date = Object.keys(rest).length ? rest : undefined;
      if (!totalsMatch.date) delete totalsMatch.date;
    }

    const totalsAgg = await RoundEvent.aggregate([
      { $match: totalsMatch },
      {
        $group: {
          _id: null,
          totalConsumption:     { $sum: "$consumption" },
          totalRewardAmount:    { $sum: "$rewardAmount" },
          totalPlatformRevenue: { $sum: "$platformRevenue" },
          totalPlatformReserve: { $sum: "$platformReserve" },
          rounds:               { $sum: 1 },
        }
      },
      { $project: { _id: 0 } }
    ]); 

    const totals = totalsAgg[0] || {
      totalConsumption: 0,
      totalRewardAmount: 0,
      totalPlatformRevenue: 0,
      totalPlatformReserve: 0,
      rounds: 0,
    };

    return res.json({ status: true, items, nextCursor, totals });
  } catch (e: any) {
    return res.status(500).json({ status: false, message: e?.message || "Server error" });
  }
}