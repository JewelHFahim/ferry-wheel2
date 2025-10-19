import { Request, Response } from "express";
import Bet from "./bet.model";
import Round from "../round/round.model";
import mongoose from "mongoose";
import { UserModel } from "../user/user.model";

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
// @desc    Top Winners
// @route   GET /api/v1/bettings/top-winners/:roundId
// ==========================
// export const handleGetTopWinners = async (req:Request, res: Response) => {
//     try {
//         const roundId = req.params.roundId;

//         if(!roundId){
//              return res.status(400).json({ status: false, message: "roundId not valid" })
//         }

//         const topWinners =  await Round.findById(roundId)
//         .select("_id roundNumber topWinners createdAt updatedAt");


//         const count = topWinners?.topWinners.length || 0;

//         if(count <= 0){
//             return res.status(200).json({ status: true, message: "Top winners empty", topWinners: [] })
//         }

//         // UserModel

//         return res.status(200).json({ status: true, message: "Top winners retrive", _id: topWinners?._id, count, topWinners: topWinners?.topWinners })
//     } catch (error) {
//         console.log("Something went wrong", error);
//         return res.status(500).json({ status: false, message: "Server error, try again later", error })
//     }
// }

export const handleGetTopWinners = async (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;

    if (!roundId || !mongoose.isValidObjectId(roundId)) {
      return res.status(400).json({ status: false, message: "roundId not valid" });
    }

    const round = await Round.findById(roundId)
      .select("_id roundNumber topWinners createdAt updatedAt")
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

    // Collect unique userIds
    const userIds = [...new Set(winners.map(w => String(w.userId)))];

    // Fetch users in one query (project safe fields)
    const users = await UserModel.find(
      { _id: { $in: userIds } },
      { username: 1, email: 1, role: 1, balance: 1, createdAt: 1 }
    )
      .lean()
      .exec();

    const userMap = new Map(users.map(u => [String(u._id), u]));

    // Merge user info with winners and sort by amountWon desc
    const merged = winners
      .map(w => ({
        userId: String(w.userId),
        amountWon: w.amountWon,
        user: userMap.get(String(w.userId)) || null,
      }))
      .sort((a, b) => (b.amountWon || 0) - (a.amountWon || 0));

    return res.status(200).json({
      status: true,
      message: "Top winners retrieved",
      _id: round._id,
      roundNumber: round.roundNumber,
      count: merged.length,
      topWinners: merged,
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
