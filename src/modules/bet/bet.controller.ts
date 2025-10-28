import { UserModel } from "../user/user.model";
import { Request, Response } from "express";
import Round from "../round/round.model";
import mongoose from "mongoose";
import Bet from "./bet.model";

// ==========================
// @role    ADMIN
// @desc    Betting History Winners
// @route   GET /api/v1/bettings/bet-history
// ==========================
export const handleGetBettingHistory = async (req: Request, res: Response) => {
    try {
        // Validate and set pagination parameters
        let limit = parseInt(req.query.limit as string) || 10;
        let page = parseInt(req.query.page as string) || 1;

        // Ensure limit is a reasonable number (e.g., between 1 and 1000)
        limit = Math.min(limit, 1000);
        page = Math.max(page, 1);

        const skip = (page - 1) * limit;

        // Optional: Add filtering logic (if needed)
        const filters: any = {};
        // Handle date range filtering (with validation)
        if (req.query.dateFrom || req.query.dateTo) {
            const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
            const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

            // Ensure both dateFrom and dateTo are valid dates
            if (dateFrom instanceof Date && !isNaN(dateFrom.getTime())) {
                filters.createdAt = { ...filters.createdAt, $gte: dateFrom };
            }
            if (dateTo instanceof Date && !isNaN(dateTo.getTime())) {
                filters.createdAt = { ...filters.createdAt, $lte: dateTo };
            }
        }

        // Fetch betting history with pagination and filtering
        const bettingHistory = await Bet.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const count = await Bet.countDocuments(filters);

        if (bettingHistory.length === 0) {
            return res.status(200).json({ 
                status: true, 
                message: "No betting history available now", 
                bettingHistory: [] 
            });
        }

        res.status(200).json({ 
            status: true, 
            message: "Betting history retrieved", 
            count,
            currentPage: page,
            bettingHistory 
        });
    } catch (error) {
        console.log("Server error", error);
        return res.status(500).json({
            status: false,
            message: "Server error, try again later",
            error
        });
    }
};

// ==========================
// @role    USER
// @desc    Recent Bet History
// @route   GET /api/v1/bettings/current-history
// ==========================
export const handleGetRecentBetHistories = async (req: Request, res: Response) => {
  try {
    // Optional override via query (?limit=10)
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));

    // Get the latest N bets
    const bettingHistory = await Round.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("_id roundNumber winningBox createdAt updatedAt")

    const total = await Round.estimatedDocumentCount(); 

    return res.status(200).json({
      status: true,
      message: bettingHistory.length ? "Betting history retrieved" : "No betting history available now",
      count: bettingHistory.length,
      total,             
      bettingHistory,
    });
  } catch (error) {
    console.error("Server error", error);
    return res.status(500).json({
      status: false,
      message: "Server error, try again later",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// ==========================
// @role    USER
// @desc    Round Top Winners
// @route   GET /api/v1/bettings/top-winners/:roundId
// ==========================
export const handleGetRoundTopWinners = async (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;
    if (!roundId || !mongoose.isValidObjectId(roundId)) {
      return res.status(400).json({ status: false, message: "roundId not valid" });
    }

    const round = await Round.findById(roundId)
    .select("_id roundNumber topWinners winningBox createdAt updatedAt")
    .lean();

    if (!round) {
      return res.status(404).json({ status: false, message: "Round not found" });
    }

    const winners = Array.isArray(round.topWinners) ? round.topWinners : [];
    if (winners.length === 0) {
      return res.status(200).json({
        status: true,
        message: "Top winners empty",
        _id: round._id,
        roundNumber: round.roundNumber,
        count: 0,
        topWinners: [],
        winningBox: round.winningBox
      });
    }

    // 1) Collapse duplicates by userId (sum amountWon)
    const winMap = new Map<string, number>();
    for (const w of winners) {
      const uid = String(w.userId);
      winMap.set(uid, (winMap.get(uid) ?? 0) + (w.amountWon ?? 0));
    }
    const userIds = [...winMap.keys()];
    const userObjIds = userIds.map(id => new mongoose.Types.ObjectId(id));

    // 2) Fetch user info
    const users = await UserModel.find(
      { _id: { $in: userObjIds } },
      { username: 1, email: 1, role: 1, balance: 1, createdAt: 1 }
    ).lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    // 3) Aggregate each user’s total bet in this round
    const totals = await Bet.aggregate([
      { $match: { roundId: new mongoose.Types.ObjectId(roundId), userId: { $in: userObjIds } } },
      { $group: { _id: "$userId", totalBet: { $sum: "$amount" }, betCount: { $sum: 1 } } },
    ]);
    const totalsMap = new Map(
      totals.map(t => [String(t._id), { totalBet: t.totalBet, betCount: t.betCount }])
    );

    // 4) Build unique array
    const merged = userIds
      .map(uid => ({
        userId: uid,
        amountWon: winMap.get(uid) ?? 0,
        ...(totalsMap.get(uid) ?? { totalBet: 0, betCount: 0 }),
        ... userMap.get(uid) || null,
      }))
      .sort((a, b) => b.amountWon - a.amountWon);

    return res.status(200).json({
      status: true,
      message: "Top winners retrieved",
      _id: round._id,
      userId: req.user?.userId,
      roundNumber: round.roundNumber,
      count: merged.length,
      topWinners: merged,
      winningBox: round.winningBox
    });
  } catch (error) {
    console.error("handleGetTopWinners error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error, try again later",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// ==========================
// @role    USER
// @desc    User Bet History
// @route   GET /api/v1/bettings/user-bet-history
// ==========================
export const handleGetUserBetHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ status: false, message: "Invalid userId" });
    }
    const uid = new mongoose.Types.ObjectId(userId);

    const qLimit = Number(req.query.limit);
    const limit = Number.isFinite(qLimit) ? Math.max(10, Math.min(50, qLimit)) : 10;

    // 1) Find the latest distinct rounds this user has bet in (by last bet time)
    const roundHeads = await Bet.aggregate([
      { $match: { userId: uid } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$roundId", lastBetAt: { $first: "$createdAt" } } },
      { $sort: { lastBetAt: -1 } },
      { $limit: limit },
      { $project: { roundId: "$_id", lastBetAt: 1, _id: 0 } },
    ]).exec();

    if (roundHeads.length === 0) {
      return res.json({
        status: true,
        message: "No recent rounds for user",
        userId,
        count: 0,
        rounds: [],
      });
    }

    // 2) For these rounds, compute per-box summaries with correct group logic
    const ridSet = roundHeads.map(r => r.roundId);
    const perRound = await Bet.aggregate([
      { $match: { userId: uid, roundId: { $in: ridSet } } },

      // Join the Round
      {
        $lookup: {
          from: "rounds",
          localField: "roundId",
          foreignField: "_id",
          as: "round",
        },
      },
      { $unwind: "$round" },

      // Normalize labels for robust comparisons
      {
        $addFields: {
          _boxNorm: { $toLower: { $trim: { input: "$box" } } },
          _winBoxNorm: { $toLower: { $trim: { input: "$round.winningBox" } } },
        },
      },

      // Bet's box stat from round.boxStats
      {
        $addFields: {
          _betBoxStats: {
            $filter: {
              input: "$round.boxStats",
              as: "bs",
              cond: { $eq: [{ $toLower: "$$bs.box" }, "$_boxNorm"] },
            },
          },
        },
      },
      { $addFields: { betBoxStat: { $arrayElemAt: ["$_betBoxStats", 0] } } },

      // Representative stat for the winning box (if group rep)
      {
        $addFields: {
          _repBoxStats: {
            $filter: {
              input: "$round.boxStats",
              as: "bs2",
              cond: { $eq: [{ $toLower: "$$bs2.box" }, "$_winBoxNorm"] },
            },
          },
        },
      },
      { $addFields: { repBoxStat: { $arrayElemAt: ["$_repBoxStats", 0] } } },

      // Compute state flags
      {
        $addFields: {
          _betGroupNorm: {
            $cond: [
              { $ifNull: ["$betBoxStat.group", false] },
              { $toLower: { $trim: { input: "$betBoxStat.group" } } },
              null,
            ],
          },
          _isGroupWinner: { $in: ["$_winBoxNorm", ["pizza", "salad"]] },
          _hasWinner: { $ne: ["$round.winningBox", null] },
        },
      },

      // Determine isWinner & multiplierUsed (rep multiplier for group win)
      {
        $addFields: {
          isWinner: {
            $cond: [
              "$_hasWinner",
              {
                $cond: [
                  "$_isGroupWinner",
                  { $eq: ["$_betGroupNorm", "$_winBoxNorm"] },
                  { $eq: ["$_boxNorm", "$_winBoxNorm"] },
                ],
              },
              false,
            ],
          },
          multiplierUsed: {
            $cond: [
              "$_isGroupWinner",
              { $ifNull: ["$repBoxStat.multiplier", 1] },
              { $ifNull: ["$betBoxStat.multiplier", 1] },
            ],
          },
        },
      },

      // Compute winAmount / loseAmount (pending rounds → both zero)
      {
        $addFields: {
          winAmount: {
            $cond: [
              { $and: ["$_hasWinner", "$isWinner"] },
              { $multiply: ["$amount", { $toDouble: "$multiplierUsed" }] },
              0,
            ],
          },
          loseAmount: {
            $cond: [{ $and: ["$_hasWinner", { $not: ["$isWinner"] }] }, "$amount", 0],
          },
          outcome: {
            $cond: [
              { $not: ["$_hasWinner"] },
              "pending",
              { $cond: ["$isWinner", "win", "lose"] },
            ],
          },
        },
      },

      // Group by (roundId, box)
      {
        $group: {
          _id: { roundId: "$roundId", box: "$box" },
          roundId: { $first: "$roundId" },
          box: { $first: "$box" },
          roundNumber: { $first: "$round.roundNumber" },
          roundStatus: { $first: "$round.roundStatus" },
          winningBox: { $first: "$round.winningBox" },
          totalAmount: { $sum: "$amount" },
          betCount: { $sum: 1 },
          lastBetAt: { $max: "$createdAt" },

          // computed aggregates
          winAmount: { $sum: "$winAmount" },
          loseAmount: { $sum: "$loseAmount" },
          isWinner: { $max: "$isWinner" },
          // max multiplier used (display)
          multiplierUsed: { $max: "$multiplierUsed" },
        },
      },

      // Group by roundId → pack perBox, compute per-round totals
      {
        $group: {
          _id: "$roundId",
          roundId: { $first: "$roundId" },
          roundNumber: { $first: "$roundNumber" },
          roundStatus: { $first: "$roundStatus" },
          winningBox: { $first: "$winningBox" },
          lastBetAt: { $max: "$createdAt" },
          perBox: {
            $push: {
              box: "$box",
              totalAmount: "$totalAmount",
              betCount: "$betCount",
              lastBetAt: "$lastBetAt",
              multiplierUsed: "$multiplierUsed",
              isWinner: "$isWinner",
              winAmount: "$winAmount",
              loseAmount: "$loseAmount",
              outcome: {
                $cond: [{ $eq: ["$isWinner", true] }, "win",
                  { $cond: [{ $eq: ["$isWinner", false] }, "lose", "pending"] }
                ],
              },
            },
          },

          totalBet: { $sum: "$totalAmount" },
          totalWin: { $sum: "$winAmount" },
          totalLose: { $sum: "$loseAmount" },
        },
      },

      // Preserve order by the user's last bet time in that round
      { $sort: { lastBetAt: -1 } },
    ]).exec();

    // 3) Merge the head list order (if any round had no results due to edge cases)
    //    and annotate with the original lastBetAt for stable ordering.
    const headMap = new Map<string, Date>(
      roundHeads.map(h => [String(h.roundId), h.lastBetAt as Date])
    );
    const rounds = perRound
      .map(r => ({
        ...r,
        lastBetAt: headMap.get(String(r.roundId)) ?? r.lastBetAt,
      }))
      .sort((a, b) => (b.lastBetAt as any) - (a.lastBetAt as any));

    return res.json({
      status: true,
      message: "User recent round bet history",
      userId,
      count: rounds.length,
      rounds,
    });
  } catch (e: any) {
    console.error("handleGetUserRecentBetHistory error:", e);
    return res.status(500).json({ status: false, message: e?.message || "Server error" });
  }
};

// ==========================
// @role    USER
// @desc    Monthly Leaderboard
// @route   GET /api/v1/bettings/leaderboard
// ==========================
export const handleGetMonthlyLeaderboard = async (req: Request, res: Response) => {

  try {
    // ---- Resolve month window ----
    const now = new Date();
    const qYear = Number(req.query.year);
    const qMonth = Number(req.query.month); // 1..12

    const year = Number.isInteger(qYear) ? qYear : now.getUTCFullYear();
    const monthIndex = Number.isInteger(qMonth) ? qMonth - 1 : now.getUTCMonth(); // 0..11

    // Start = first day 00:00:00 UTC of the chosen month
    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    // End   = first day of next month 00:00:00 UTC
    const endExclusive = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));

    // If querying the current month, you may choose to cap by "now"
    const end = (year === now.getUTCFullYear() && monthIndex === now.getUTCMonth())
      ? now
      : endExclusive;

    const leaders = await Round.aggregate([
      // Only rounds within the month window that have winners
      {
        $match: {
          createdAt: { $gte: start, $lt: end },
          topWinners: { $exists: true, $ne: [] },
        },
      },
      // Flatten winners per round
      { $unwind: "$topWinners" },

      // Sum per user across the month
      {
        $group: {
          _id: "$topWinners.userId",
          totalWon: { $sum: "$topWinners.amountWon" },
          winsCount: { $sum: 1 },
          biggestWin: { $max: "$topWinners.amountWon" },
          lastWinAt: { $max: "$updatedAt" }, // or $createdAt
        },
      },


      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      // Sort by month performance
      { $sort: { totalWon: -1, biggestWin: -1, lastWinAt: -1 } },

      // Top 10
      { $limit: 10 },

      // Output
      {
        $project: {
          _id: 0,
          userId: "$_id",
          totalWon: 1,
          winsCount: 1,
          biggestWin: 1,
          lastWinAt: 1,
          user: {
            _id: "$user._id",
            username: "$user.username",
            email: "$user.email",
            role: "$user.role",
            balance: "$user.balance",
            createdAt: "$user.createdAt",
          },
        },
      },
    ]).exec();

    return res.status(200).json({
      status: true,
      message: "Top winners monthly",
      // window: { from: start, to: end },/
      userId: req.user?.userId,
      count: leaders.length,
      leaders,
    });
  } catch (err: any) {
    console.error("handleGetMonthlyTopWinners error:", err);
    return res.status(500).json({ status: false, message: err?.message || "Server error" });
  }
};

// ==========================
// @role    USER
// @desc    Daily Leaderboad
// @route   GET /api/v1/bettings/leaderboard
// ==========================
export const handleGetDailyLeaderboard = async (req: Request, res: Response) => {
  try {
    const tz = typeof req.query.tz === "string" ? req.query.tz : undefined;
    const { start, end } = getTodayWindow(tz);

    const leaders = await Round.aggregate([
      { $match: { updatedAt: { $gte: start, $lt: end }, topWinners: { $exists: true, $ne: [] } } },
      { $unwind: "$topWinners" },

      {
        $group: {
          _id: "$topWinners.userId",
          totalWon:   { $sum: "$topWinners.amountWon" },
          winsCount:  { $sum: 1 },
          biggestWin: { $max: "$topWinners.amountWon" },
          lastWinAt:  { $max: "$updatedAt" },
        },
      },

      // Join user info
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      // Sort winners of the day
      { $sort: { totalWon: -1, biggestWin: -1, lastWinAt: -1 } },
      { $limit: 10 },

      // Shape output
      {
        $project: {
          _id: 0,
          userId: "$_id",
          totalWon: 1,
          winsCount: 1,
          biggestWin: 1,
          lastWinAt: 1,
          user: {
            _id: "$user._id",
            username: "$user.username",
            email: "$user.email",
            role: "$user.role",
            balance: "$user.balance",
            createdAt: "$user.createdAt",
          },
        },
      },
    ]).exec();

    return res.status(200).json({
      status: true,
      message: "Top winners (today)",
      window: { from: start, to: end, tz: tz ?? "UTC" },
      userId: req.user?.userId,
      count: leaders.length,
      leaders,
    });
  } catch (err: any) {
    console.error("handleGetTodaysTopWinners error:", err);
    return res.status(500).json({ status: false, message: err?.message || "Server error" });
  }
};

function getTodayWindow(tz?: string) {
  try {
    if (tz) {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
      const [y, m, d] = fmt.format(now).split("-");
      // local midnight in that tz, converted to a real Date in UTC
      const startLocal = new Date(`${y}-${m}-${d}T00:00:00`);
      const start = new Date(startLocal.toLocaleString("en-US", { timeZone: "UTC" }));
      return { start, end: now };
    }
  } catch {}
  // Fallback: UTC midnight → now
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return { start, end: now };
}
