import express from "express";
import { handleGetBettingHistory, handleGetBettingHistoryTenData, handleGetTopWinners } from "./bet.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

//Betting routes
const router = express.Router();
router.use("/bet-history", authMiddleware, handleGetBettingHistory);
router.use("/top-winners/:roundId", authMiddleware, handleGetTopWinners);
router.use("/current-history", authMiddleware, handleGetBettingHistoryTenData);

export default router;