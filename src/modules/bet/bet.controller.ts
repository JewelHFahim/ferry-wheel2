import { Request, Response } from "express";
import Bet from "./bet.model";



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
