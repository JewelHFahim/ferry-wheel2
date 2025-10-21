import express from "express";
import {  handleGetBettingHistory, handleGetBettingHistoryTenData, handleGetTopWinners, handleGetUserLast10Data } from "./bet.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

//Betting routes
const router = express.Router();
router.use("/bet-history", handleGetBettingHistory);
router.use("/top-winners/:roundId", handleGetTopWinners);
router.use("/current-history", handleGetBettingHistoryTenData); // top 10 da
router.use("/user-bet-history/:userId", handleGetUserLast10Data); 
// router.use("/user-bet-history/:userId", handleGetUserLAst10Datas); 

export default router;