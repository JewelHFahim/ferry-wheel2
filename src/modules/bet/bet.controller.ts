import { Request, Response } from "express";
import Bet from "./bet.model";
import Round from "../round/round.model";
import mongoose from "mongoose";
import { UserModel } from "../user/user.model";
import { match } from "assert";

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
// @route   GET /api/v1/bettings/top-winners/:roundId
// ==========================

/**
 * GET /api/v1/bets/history/:userId?groupMultiplier=special|own
 * - Last 10 entries for a user
 * - Grouped by (roundId, box), summing amounts
 * - Includes outcome and win/lose amounts
 * - Handles Pizza/Salad group-win logic
 */
export const handleGetUserLast10Data = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const groupMultiplierMode = String(req.query.groupMultiplier || "own"); // "special" | "own"

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ status: false, message: "Invalid userId" });
    }

    // Toggle for multiplier rule on Pizza/Salad group wins
    const useSpecialMultiplier = groupMultiplierMode === "special";

    const history = await Bet.aggregate([
      // 1) Only this user
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },

      // 2) Sort newest first so $first gives us the latest time for this (round, box)
      { $sort: { createdAt: -1 } },

      // 3) Group by (roundId, box): sum amounts, keep last bet timestamp
      {
        $group: {
          _id: { roundId: "$roundId", box: "$box" },
          totalAmount: { $sum: "$amount" },
          lastBetAt: { $first: "$createdAt" },
        },
      },

      // 4) Sort groups by most recent activity and take 10
      { $sort: { lastBetAt: -1 } },
      { $limit: 10 },

      // 5) Join round to know winnerBox + boxStats (with multipliers/groups)
      {
        $lookup: {
          from: Round.collection.name,
          localField: "_id.roundId",
          foreignField: "_id",
          as: "round",
        },
      },
      { $unwind: { path: "$round", preserveNullAndEmptyArrays: true } },

      // 6) Compute outcome & amounts using round data
      {
        $addFields: {
          // my bet box data from round.boxStats
          myBox: {
            $let: {
              vars: {
                matched: {
                  $filter: {
                    input: "$round.boxStats",
                    as: "bs",
                    cond: { $eq: ["$$bs.box", "$_id.box"] },
                  },
                },
              },
              in: { $arrayElemAt: ["$$matched", 0] },
            },
          },
          // winning box data
          winBox: {
            $let: {
              vars: {
                matched: {
                  $filter: {
                    input: "$round.boxStats",
                    as: "bs",
                    cond: { $eq: ["$$bs.box", "$round.winningBox"] },
                  },
                },
              },
              in: { $arrayElemAt: ["$$matched", 0] },
            },
          },
        },
      },

      {
        $addFields: {
          // Derived fields
          myGroup: { $ifNull: ["$myBox.group", null] },
          myMult: { $ifNull: ["$myBox.multiplier", 1] },

          winBoxGroup: { $ifNull: ["$winBox.group", null] },
          winBoxMult: { $ifNull: ["$winBox.multiplier", 1] },

          // direct win if my exact box equals winnerBox
          isDirectWin: { $eq: ["$_id.box", "$round.winningBox"] },

          // group win if winner is a special group and my group equals that group
          isGroupWin: {
            $and: [
              { $in: ["$winBoxGroup", ["Pizza", "Salad"]] },
              { $eq: ["$myGroup", "$winBoxGroup"] },
            ],
          },

          // which multiplier to use when it's a win?
          multiplierUsed: {
            $cond: [
              { $or: ["$isDirectWin", "$isGroupWin"] },
              {
                $cond: [
                  // if group win and you chose "special", use winning box multiplier
                  { $and: ["$isGroupWin", { $eq: [useSpecialMultiplier, true] }] },
                  "$winBoxMult",
                  // otherwise use your own box multiplier
                  "$myMult",
                ],
              },
              0,
            ],
          },

          isWin: { $or: ["$isDirectWin", "$isGroupWin"] },

          // amounts
          winAmount: {
            $cond: [
              { $or: ["$isDirectWin", "$isGroupWin"] },
              { $multiply: ["$totalAmount", "$multiplierUsed"] },
              0,
            ],
          },
          loseAmount: {
            $cond: [{ $or: ["$isDirectWin", "$isGroupWin"] }, 0, "$totalAmount"],
          },

          // reason string for clarity
          reason: {
            $cond: [
              "$isDirectWin",
              "direct",
              {
                $cond: [
                  "$isGroupWin",
                  { $concat: ["group:", { $ifNull: ["$winBoxGroup", ""] }] },
                  "lose",
                ],
              },
            ],
          },
        },
      },

      // 7) Final shape
      {
        $project: {
          _id: 0,
          roundId: "$_id.roundId",
          box: "$_id.box",
          totalAmount: 1,
          lastBetAt: 1,
          roundNumber: "$round.roundNumber",
          roundCreatedAt: "$round.createdAt",
          winningBox: "$round.winningBox",

          outcome: {
            $cond: ["$isWin", "win", "lose"],
          },
          multiplierUsed: 1,
          winAmount: 1,
          loseAmount: 1,
          reason: 1,
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "User bet history retrieved",
      count: history.length,
      history,
      config: { groupMultiplierMode }, // echo back config to help UI
    });

  } catch (error) {
    console.error("handleGetUserBetHistory error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error, try again later",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// 6. Personal 10 Bets Records- Time-bet, Bet Amount-bet, Winebox-round, Win/Lose Amount-round, Result +-

// export const handleGetUserLAst10Datas = async (req: Request, res: Response) => {

//   try {
//     const {userId} = req.params;
//     if(!userId || !mongoose.isValidObjectId(userId)){
//       return res.status(400).json({status: false, message: "Invalid userId"})
//     }

//     const history = await Bet.aggregate([
//       { $match: {userId: new mongoose.Types.ObjectId(userId) } },

//       { $sort: { createdAt: -1 } },

//       {
//         $group: {
//           _id: { roundId: "$roundId", box: "$box" },
//           totalAmount: { $sum : "$amount" },
//           lastBetAt: { $first: "$createdAt" }
//         }
//       },

//       { $sort: { lastBetAt: -1 } },
//       { $limit: 3 },

//       {
//         $lookup: {
//           from: Round.collection.name,
//           foreignField: "_id.roundId",
//           localField: "_id",
//           as: "round"
//         }
//       },
//       { $unwind: { path: "$round", preserveNullAndEmptyArrays: true} },

//       {
//         $addFields: {
//           myBet: {
//             $let:{
//               vars: {
//                 matched:{
//                   $filters:{
//                     input: "$round.boxStats",
//                     as: "bs",
//                     cond: { $eq: ["$$bs.box", "$_id.box"] },
//                   }
//                 }
//                 }
//               },
//               in: { $arrayElemAt: ["$$matched", 0] },
//             }
//           }
//         }
      


//     ]);


//     console.log("history: ", history)



//     return res.status(200).json({ status: true, message: "Success" })
    
//   } catch (error) {
//     console.log("handleGetUserLAst10Datas error: ", error);
//     return res.status(500).json({ status: false, message: "Server error, try again later", error: error instanceof Error ? error.message : error })
//   }

// } 