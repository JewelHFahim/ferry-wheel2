import express from "express";
import { handleGetBettingHistory, handleGetBettingHistoryTenData, handleGetTopWinners } from "./bet.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

//Betting routes
const router = express.Router();
router.use("/bet-history", handleGetBettingHistory);
router.use("/top-winners/:roundId", handleGetTopWinners);
router.use("/current-history", handleGetBettingHistoryTenData);

export default router;