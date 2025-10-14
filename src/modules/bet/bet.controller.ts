import { Request, Response } from "express";
import Bet from "./bet.model";
import Round from "../round/round.model";


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
// @desc    Betting History Winners
// @route   GET /api/v1/bettings/current-history
// ==========================
export const handleGetBettingHistoryTenData = async (req: Request, res: Response) => {
    try {
        const bettingHistory = (await Bet.find().sort({ createdAt: -1 })).splice(0, 10);

        const count = bettingHistory.length;
        if (count === 0) {
            return res.status(200).json({ status: true, message: "No betting history available now", bettingHistory: [] });
        }

        return res.status(200).json({ status: true, message: "Betting history retrieved", count, bettingHistory});
    } catch (error) {
        console.log("Server error", error);
        return res.status(500).json({ status: false, message: "Server error, try again later",  error });
    }
};

// ==========================
// @desc    Top Winners
// @route   GET /api/v1/bettings/top-winners/:roundId
// ==========================
export const handleGetTopWinners = async (req:Request, res: Response) => {
    try {
        const roundId = req.params.id;
        if(!roundId){
             return res.status(400).json({ status: false, message: "roundId not valid" })
        }

        const topWinners =  await Round.findById(roundId);
        const count = topWinners?.topWinners.length;

        if(count === 0){
            return res.status(200).json({ status: true, message: "Top winners empty", topWinners: [] })
        }

        return res.status(200).json({ status: true, message: "Top winners retrive", count, topWinners: topWinners?.topWinners })
    } catch (error) {
        console.log("Something went wrong", error);
        return res.status(500).json({ status: false, message: "Server error, try again later", error })
    }
}