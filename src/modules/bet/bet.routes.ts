import express from "express";
import {  handleGetBettingHistory, handleGetBettingHistoryTenData, handleGetMonthlyTopWinners, handleGetTodaysTopWinners, handleGetTopWinners, handleGetUserLast10Records } from "./bet.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

//Betting routes
const router = express.Router();
router.use("/bet-history", authMiddleware, handleGetBettingHistory);
router.use("/top-winners/:roundId", authMiddleware, handleGetTopWinners);
router.use("/current-history", authMiddleware, handleGetBettingHistoryTenData);
router.use("/user-bet-history", authMiddleware, handleGetUserLast10Records); 
router.use("/leaderboard/top-winners-today",authMiddleware, handleGetTodaysTopWinners);
router.use("/leaderboard", authMiddleware, handleGetMonthlyTopWinners);

export default router;