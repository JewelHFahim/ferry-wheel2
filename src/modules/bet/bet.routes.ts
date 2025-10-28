import express from "express";
import {  handleGetBettingHistory, handleGetRecentBetHistories, handleGetMonthlyLeaderboard, handleGetDailyLeaderboard, handleGetRoundTopWinners, handleGetUserBetHistory } from "./bet.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

//Betting routes
const router = express.Router();
router.use("/bet-history", authMiddleware, handleGetBettingHistory);
router.use("/top-winners/:roundId", authMiddleware, handleGetRoundTopWinners);
router.use("/current-history", authMiddleware, handleGetRecentBetHistories);
router.use("/user-bet-history", authMiddleware, handleGetUserBetHistory); 
router.use("/leaderboard-today", authMiddleware, handleGetDailyLeaderboard);
router.use("/leaderboard-monthly", authMiddleware, handleGetMonthlyLeaderboard);

export default router;