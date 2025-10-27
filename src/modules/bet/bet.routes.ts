import express from "express";
import {  handleGetBettingHistory, handleGetBettingHistoryTenData, handleGetMonthlyLeaderboard, handleGetDailyLeaderboard, handleGetRoundTopWinners, handleGetUserLast10Records } from "./bet.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

//Betting routes
const router = express.Router();
router.use("/bet-history", authMiddleware, handleGetBettingHistory);
router.use("/top-winners/:roundId", authMiddleware, handleGetRoundTopWinners);
router.use("/current-history", authMiddleware, handleGetBettingHistoryTenData);
router.use("/user-bet-history", authMiddleware, handleGetUserLast10Records); 
router.use("/leaderboard/top-winners-today",authMiddleware, handleGetDailyLeaderboard);
router.use("/leaderboard", authMiddleware, handleGetMonthlyLeaderboard);

export default router;