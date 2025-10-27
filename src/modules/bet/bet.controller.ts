import { UserModel } from "../user/user.model";
import { Request, Response } from "express";
import Round from "../round/round.model";
import mongoose from "mongoose";
import Bet from "./bet.model";

// ==========================
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
            .sort({ createdAt: -1 }); // latest first

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
// @desc    Betting History Last 10 Data
// @route   GET /api/v1/bettings/current-history
// ==========================
export const handleGetBettingHistoryTenData = async (req: Request, res: Response) => {
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
// @desc    Round Top Three Winners
// @route   GET /api/v1/bettings/top-winners/:roundId
// ==========================
export const handleGetTopWinners = async (req: Request, res: Response) => {
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
// @desc    30 Days Round Top 10 Winners
// @route   GET /api/v1/bettings/user-bet-history
// ==========================
export const handleGetUserLast10Records = async (req: Request, res: Response) => {
  
  try {
    const userId = req.user?.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ status: false, message: "Invalid userId" });
    }

    const uid = new mongoose.Types.ObjectId(userId);

    const records = await Bet.aggregate([
      // 1) Match by ObjectId
      { $match: { userId: uid } },

      // 2) Join Round (to get winningBox, roundNumber, boxStats, createdAt)
      {
        $lookup: {
          from: "rounds",               // default collection name for Round model
          localField: "roundId",
          foreignField: "_id",
          as: "round",
        },
      },
      { $unwind: "$round" },

      // 3) Normalize for robust comparisons (case/whitespace)
      {
        $addFields: {
          _boxNorm: { $toLower: { $trim: { input: "$box" } } },
          _winBoxNorm: { $toLower: { $trim: { input: "$round.winningBox" } } },
        },
      },

      // 4) Find THIS bet’s box in round.boxStats to fetch its multiplier
      {
        $addFields: {
          boxStatsMatch: {
            $filter: {
              input: "$round.boxStats",
              as: "bs",
              cond: { $eq: [{ $toLower: "$$bs.box" }, "$_boxNorm"] },
            },
          },
        },
      },
      {
        $addFields: {
          // use array operator to grab first item; then fallback to 1
          multiplier: {
            $ifNull: [{ $arrayElemAt: ["$boxStatsMatch.multiplier", 0] }, 1],
          },
        },
      },

      // 5) Tag each bet row as winner / loser (own-box mode)
      {
        $addFields: {
          isWinner: { $eq: ["$_boxNorm", "$_winBoxNorm"] },
        },
      },

      // 6) Group to one line per (roundId, normalized box)
      {
        $group: {
          _id: { roundId: "$roundId", box: "$_boxNorm" },
          roundId: { $first: "$roundId" },
          boxNorm: { $first: "$_boxNorm" },
          box: { $first: "$box" }, // keep original label for display

          // sums
          totalAmount: { $sum: "$amount" },
          betCount: { $sum: 1 },

          // latest timestamps
          lastBetAt: { $max: "$createdAt" },

          // preserve win if any bet in this (round, box) won
          isWinner: { $max: "$isWinner" },

          // multiplier for this box (same across group)
          multiplier: { $max: "$multiplier" },

          // pass-through round info
          roundNumber: { $first: "$round.roundNumber" },
          roundCreatedAt: { $first: "$round.createdAt" },
          winningBox: { $first: "$round.winningBox" },
        },
      },

      // 7) Compute win/lose amounts
      {
        $addFields: {
          winAmount: {
            $cond: [{ $eq: ["$isWinner", true] }, { $multiply: ["$totalAmount", "$multiplier"] }, 0],
          },
          loseAmount: {
            $cond: [{ $eq: ["$isWinner", true] }, 0, "$totalAmount"],
          },
          multiplierUsed: "$multiplier",
          outcome: { $cond: [{ $eq: ["$isWinner", true] }, "win", "lose"] },
          reason: { $cond: [{ $eq: ["$isWinner", true] }, "win", "lose"] },
        },
      },

      // 8) Sort and limit
      { $sort: { roundCreatedAt: -1, lastBetAt: -1 } },
      { $limit: 10 },

      // 9) Final shape
      {
        $project: {
          _id: 0,
          roundId: 1,
          box: 1,
          roundNumber: 1,
          roundCreatedAt: 1,
          winningBox: 1,

          totalAmount: 1,
          betCount: 1,
          lastBetAt: 1,

          multiplierUsed: 1,
          winAmount: 1,
          loseAmount: 1,
          outcome: 1,
          reason: 1,
        },
      },
    ]);

    return res.json({
      status: true,
      message: "User bet history retrieved",
      count: records.length,
      records,
      config: { groupMultiplierMode: "own" },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};


// ==========================
// @desc    Monthly Leaderboard
// @route   GET /api/v1/bettings/leaderboard
// ==========================

/**
 * Defaults: current month (from 1st 00:00 to now).
 * Optional query: ?year=2025&month=10  (1..12)
 */

export const handleGetMonthlyTopWinners = async (req: Request, res: Response) => {

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
// @desc    Daily Leaderboad
// @route   GET /api/v1/bettings/leaderboard
// ==========================

// Helper: start-of-today and now in a given IANA timezone (fallback to UTC)
function getTodayWindow(tz?: string) {
  try {
    if (tz) {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      });
      const [y, m, d] = fmt.format(now).split("-");
      const localMidnight = new Date(`${y}-${m}-${d}T00:00:00`);
      const start = new Date(
        localMidnight.toLocaleString("en-US", { timeZone: "UTC" })
      );
      const end = now;  // Ensure that 'now' is in UTC time zone
      console.log(`Timezone: ${tz}, Start of day (UTC): ${start}, End of day (UTC): ${end}`);
      return { start, end };
    }
  } catch (err) {
    console.error("Error while determining today’s window", err);
  }
  
  // Fallback to UTC
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = now;  // Current time (UTC)
  console.log(`Using UTC Start: ${start}, End: ${end}`);
  return { start, end };
}


/**
 * GET /api/v1/leaderboard/top-winners-today
 * Optional: ?tz=Asia/Dhaka  (IANA timezone for “today” window)
 */

export const handleGetTodaysTopWinners = async (req: Request, res: Response) => {
  try {
    const tz = typeof req.query.tz === "string" ? req.query.tz : undefined;
    const { start, end } = getTodayWindow(tz);  // Get today's time window

    const leaders = await Round.aggregate([
      { 
        $unwind: "$topWinners" 
      },
      { 
        $match: { 
          // Filter based on the 'lastWinAt' of the winners, instead of 'createdAt'
          createdAt: { $gte: start, $lt: end } 
        } 
      },
      {
        $group: {
          _id: "$topWinners.userId",  // Group by user ID
          totalWon: { $sum: "$topWinners.amountWon" },
          winsCount: { $sum: 1 },
          biggestWin: { $max: "$topWinners.amountWon" },
          lastWinAt: { $max: "$topWinners.lastWinAt" },
        },
      },
      {
        $lookup: {
          from: "users",  // Look up user data
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },  // Unwind the user array for the result
      { $sort: { totalWon: -1, biggestWin: -1, lastWinAt: -1 } },
      { $limit: 10 },
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

    console.log("leaders: ", leaders)

    res.status(200).json({
      status: true,
      message: "Top winners (today)",
      userId: req.user?.userId,
      count: leaders.length,
      leaders,
    });
  } catch (err: any) {
    console.error("handleGetTodaysTopWinners error:", err);
    res.status(500).json({ status: false, message: err?.message || "Server error" });
  }
};



// export const handleGetTodaysTopWinners = async (req: Request, res: Response) => {
//   try {
//     const tz = typeof req.query.tz === "string" ? req.query.tz : undefined;
//     const { start, end } = getTodayWindow(tz);

//     const leaders = await Round.aggregate([
//       { 
//         $match: { 
//           // createdAt: { $gte: start, $lt: end }, 
//           topWinners: { $exists: true, $ne: [] } 
//         } 
//       },
//       { $unwind: "$topWinners" },
//       {
//         $group: {
//           _id: "$topWinners.userId",
//           totalWon: { $sum: "$topWinners.amountWon" },
//           winsCount: { $sum: 1 },
//           biggestWin: { $max: "$topWinners.amountWon" },
//           lastWinAt: { $max: "$updatedAt" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       { $unwind: "$user" },
//       { $sort: { totalWon: -1, biggestWin: -1, lastWinAt: -1 } },
//       { $limit: 10 },
//       {
//         $project: {
//           _id: 0,
//           userId: "$_id",
//           totalWon: 1,
//           winsCount: 1,
//           biggestWin: 1,
//           lastWinAt: 1,
//           user: {
//             _id: "$user._id",
//             username: "$user.username",
//             email: "$user.email",
//             role: "$user.role",
//             balance: "$user.balance",
//             createdAt: "$user.createdAt",
//           },
//         },
//       },
//     ]).exec();

//     console.log("leaders: ", leaders)

//     res.status(200).json({
//       status: true,
//       message: "Top winners (today)",
//       // window: { from: start, to: end, tz: tz ?? "UTC" },
//       userId: req.user?.userId,
//       count: leaders.length,
//       leaders,
//     });
//   } catch (err: any) {
//     console.error("handleGetTodaysTopWinners error:", err);
//     res.status(500).json({ status: false, message: err?.message || "Server error" });
//   }
// };
