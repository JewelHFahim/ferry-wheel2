import express from 'express'
import { getDaily } from './gameLog.controller';
import { getRoundLogs } from './RoundEvent.controller';


const router = express.Router();

router.use("/game-logs", getRoundLogs);
router.get("/game-logs/daily", getDaily);




export default router;