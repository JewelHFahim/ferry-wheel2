import express from "express";
import { handleGetBettingHistory } from "./bet.controller";

const router = express.Router();

router.use("/bet-history", handleGetBettingHistory);

export default router;