import { Request, Response } from "express";
import GameLog from "./gameLog.model";
import Round from "../../modules/round/round.model";

const startOfDayUTC = (d:Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMinutes(), d.getUTCDate(), 0, 0, 0, 0));
const endOfDayUTC = (d:Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

export const handleGetGameLogs = async (req: Request, res: Response) => {
  try {
    const gameName = "Ferry Wheel";
    const gameId = 1;
    const fromDate = req.query.from ? new Date(String(req.query.from)) : undefined;
    const toDate = req.query.to ? new Date(String(req.query.to)) : undefined;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit) || "20")) , 10);


    // Validate query parameters
    if (!gameId || !fromDate || !toDate) {
      return res.status(400).json({ status: false, message: "Missing required query parameters" });
    }

    // Fetch game logs
    const gameLogs = await GameLog.find({});
    const round = await Round.aggregate([
        { $match: { $gte: { createdAt: fromDate }, $lte: { createdat: toDate} } },
        {
            $group: {
                _id: "$roundNumber",
                totalPool: { $sum: "$totalPool"},


            }
        }
    ])

    console.log("gamelogs");

    if(!gameLogs){
      return res.status(404).json({ status: false, message: "No game logs found" });
    }

    res.status(200).json({ status: true, data: gameLogs });

  } catch (error) {
    console.log("handleGetGameLogs error:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};


// ---------- Helpers ----------
// const startOfDayUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
// const endOfDayUTC   = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

const parseDateOrNow = (v?: string) => (v ? new Date(v) : new Date());
// const toObjectId = (id?: string) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : undefined);

// ---------- POST /game-logs/round  (upsert one round into daily doc) ----------
// export const addRoundToGameLog = async (req: Request, res: Response) => {
//   try {
//     // Expected payload for one round
//     const {
//       gameId,
//       roundId,
//       gameName,
//       identification,
//       consumption,      // total bets from all users for this round
//       rewardAmount,     // total payout to users for this round
//       platformRevenue,  // company cut (and/or net) for this round
//       gameVictoryResult,
//       date              // ISO string or omitted -> now
//     } = req.body as Partial<RoundLog>;

//     // Basic validation
//     if (!gameId || !mongoose.isValidObjectId(gameId)) {
//       return res.status(400).json({ status: false, message: "Invalid gameId" });
//     }
//     if (!roundId || !mongoose.isValidObjectId(roundId)) {
//       return res.status(400).json({ status: false, message: "Invalid roundId" });
//     }
//     if (!gameName || typeof gameName !== "string") {
//       return res.status(400).json({ status: false, message: "gameName required" });
//     }
//     if (!identification || typeof identification !== "string") {
//       return res.status(400).json({ status: false, message: "identification required" });
//     }

//     const cons = Number(consumption ?? 0);
//     const reward = Number(rewardAmount ?? 0);
//     const revenue = Number(platformRevenue ?? 0);
//     const roundDate = date ? new Date(date) : new Date();

//     if ([cons, reward, revenue].some((n) => Number.isNaN(n))) {
//       return res.status(400).json({ status: false, message: "Numeric fields invalid" });
//     }

//     // Group by day (UTC) and gameName
//     const dayStart = startOfDayUTC(roundDate);
//     const dayEnd   = endOfDayUTC(roundDate);

//     // Try to find an existing daily document for that gameName & day (based on log date)
//     const existing = await GameLog.findOne({
//       gameName,
//       "logs.date": { $gte: dayStart, $lte: dayEnd },
//     }).lean();

//     const roundLog: RoundLog = {
//       gameId: new mongoose.Types.ObjectId(gameId),
//       roundId: new mongoose.Types.ObjectId(roundId),
//       gameName,
//       identification,
//       consumption: cons,
//       rewardAmount: reward,
//       platformRevenue: revenue,
//       gameVictoryResult: gameVictoryResult ?? "",
//       date: roundDate,
//     };

//     let doc: IGameLog | null;

//     if (existing) {
//       // Upsert into existing daily bucket: push + inc totals
//       doc = await GameLog.findByIdAndUpdate(
//         existing._id,
//         {
//           $push: { logs: roundLog },
//           $inc: {
//             totalConsumption: cons,
//             totalRewardAmount: reward,
//             totalPlatformRevenue: revenue,
//           },
//         },
//         { new: true }
//       ).lean() as unknown as IGameLog;
//     } else {
//       // New daily doc
//       doc = await GameLog.create({
//         totalConsumption: cons,
//         totalRewardAmount: reward,
//         totalPlatformRevenue: revenue,
//         logs: [roundLog],
//       });
//     }

//     return res.json({
//       status: true,
//       message: "Round logged",
//       gameName,
//       dayStart,
//       dayEnd,
//       doc,
//     });
//   } catch (e: any) {
//     console.error("addRoundToGameLog error:", e);
//     return res.status(500).json({ status: false, message: e?.message || "Server error" });
//   }
// };

// ---------- GET /game-logs  (list docs with filters + pagination) ----------
// query: gameName?, gameId?, from?, to?, page?, limit?
// export const listGameLogs = async (req: Request, res: Response) => {
//   try {
//     const { gameName, gameId } = req.query as { gameName?: string; gameId?: string };
//     const from = req.query.from ? new Date(String(req.query.from)) : undefined;
//     const to   = req.query.to   ? new Date(String(req.query.to))   : undefined;

//     const page  = Math.max(1, parseInt(String(req.query.page || "1"), 10));
//     const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit || "20"), 10)));

//     // Build filter:
//     // We filter by date-range on logs.date (since totals represent those logs)
//     const filter: any = {};
//     if (gameName) filter.gameName = gameName; // NOTE: gameName is inside logs too — this matches top-level doc only
//     if (gameId && mongoose.isValidObjectId(gameId)) {
//       filter["logs.gameId"] = new mongoose.Types.ObjectId(gameId);
//     }
//     if (from || to) {
//       filter["logs.date"] = {};
//       if (from) filter["logs.date"].$gte = startOfDayUTC(from);
//       if (to)   filter["logs.date"].$lte = endOfDayUTC(to);
//     }

//     // Pagination on createdAt (doc-level)
//     const skip = (page - 1) * limit;

//     const [rows, total] = await Promise.all([
//       GameLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
//       GameLog.countDocuments(filter),
//     ]);

//     return res.json({
//       status: true,
//       page,
//       pageSize: rows.length,
//       totalDocs: total,
//       totalPages: Math.ceil(total / limit),
//       rows,
//     });
//   } catch (e: any) {
//     console.error("listGameLogs error:", e);
//     return res.status(500).json({ status: false, message: e?.message || "Server error" });
//   }
// };

// ---------- GET /game-logs/:id ----------
// export const getGameLogById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({ status: false, message: "Invalid id" });
//     }
//     const doc = await GameLog.findById(id).lean();
//     if (!doc) return res.status(404).json({ status: false, message: "Not found" });
//     return res.json({ status: true, doc });
//   } catch (e: any) {
//     console.error("getGameLogById error:", e);
//     return res.status(500).json({ status: false, message: e?.message || "Server error" });
//   }
// };

// ---------- GET /game-logs/summary (sum totals across range) ----------
// query: gameName?, gameId?, from?, to?
// export const getGameLogSummary = async (req: Request, res: Response) => {
//   try {
//     const { gameName, gameId } = req.query as { gameName?: string; gameId?: string };
//     const from = req.query.from ? new Date(String(req.query.from)) : undefined;
//     const to   = req.query.to   ? new Date(String(req.query.to))   : undefined;

//     const match: any = {};
//     if (gameName) match.gameName = gameName;
//     if (gameId && mongoose.isValidObjectId(gameId)) {
//       match["logs.gameId"] = new mongoose.Types.ObjectId(gameId);
//     }
//     if (from || to) {
//       match["logs.date"] = {};
//       if (from) match["logs.date"].$gte = startOfDayUTC(from);
//       if (to)   match["logs.date"].$lte = endOfDayUTC(to);
//     }

//     // Aggregate over matching documents, but totals in the doc might include logs outside range.
//     // To be precise over the requested window, unwind logs and re-sum precisely by range.
//     const rows = await GameLog.aggregate([
//       { $match: match },
//       { $unwind: "$logs" },
//       // If date range provided, enforce here too (in case doc matched loosely)
//       ...(from || to ? [{
//         $match: {
//           "logs.date": {
//             ...(from ? { $gte: startOfDayUTC(from) } : {}),
//             ...(to ? { $lte: endOfDayUTC(to) } : {}),
//           }
//         }
//       }] : []),
//       {
//         $group: {
//           _id: null,
//           totalConsumption: { $sum: "$logs.consumption" },
//           totalRewardAmount: { $sum: "$logs.rewardAmount" },
//           totalPlatformRevenue: { $sum: "$logs.platformRevenue" },
//           rounds: { $sum: 1 },
//         }
//       }
//     ]);

//     const summary = rows[0] || {
//       totalConsumption: 0,
//       totalRewardAmount: 0,
//       totalPlatformRevenue: 0,
//       rounds: 0,
//     };

//     return res.json({ status: true, summary });
//   } catch (e: any) {
//     console.error("getGameLogSummary error:", e);
//     return res.status(500).json({ status: false, message: e?.message || "Server error" });
//   }
// };

// ---------- DELETE /game-logs/:docId/round/:roundId  (remove a round & resync totals) ----------
// export const removeRoundFromGameLog = async (req: Request, res: Response) => {
//   try {
//     const { docId, roundId } = req.params;
//     if (!mongoose.isValidObjectId(docId) || !mongoose.isValidObjectId(roundId)) {
//       return res.status(400).json({ status: false, message: "Invalid ids" });
//     }

//     const doc = await GameLog.findById(docId);
//     if (!doc) return res.status(404).json({ status: false, message: "GameLog not found" });

//     const before = doc.toObject() as IGameLog;
//     const idx = before.logs.findIndex((l) => String(l.roundId) === String(roundId));
//     if (idx === -1) {
//       return res.status(404).json({ status: false, message: "Round log not found in document" });
//     }

//     const removed = before.logs[idx];
//     // Remove the round and decrement totals
//     before.logs.splice(idx, 1);
//     before.totalConsumption    = Math.max(0, (before.totalConsumption    || 0) - (removed.consumption || 0));
//     before.totalRewardAmount   = Math.max(0, (before.totalRewardAmount   || 0) - (removed.rewardAmount || 0));
//     before.totalPlatformRevenue =       (before.totalPlatformRevenue || 0) - (removed.platformRevenue || 0);

//     await GameLog.findByIdAndUpdate(docId, {
//       $set: {
//         logs: before.logs,
//         totalConsumption: before.totalConsumption,
//         totalRewardAmount: before.totalRewardAmount,
//         totalPlatformRevenue: before.totalPlatformRevenue,
//       }
//     });

//     return res.json({ status: true, message: "Round removed & totals updated", removed });
//   } catch (e: any) {
//     console.error("removeRoundFromGameLog error:", e);
//     return res.status(500).json({ status: false, message: e?.message || "Server error" });
//   }
// };
