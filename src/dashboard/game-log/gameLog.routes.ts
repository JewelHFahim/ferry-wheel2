import express from 'express'
import { getRoundLogs, getUserLogs } from './RoundEvent.controller';

const router = express.Router();

router.use("/game-logs", getRoundLogs);
router.use("/user-logs", getUserLogs);




export default router;