import express from 'express'
import { handleGetGameLogs } from './gameLog.controller';


const router = express.Router();

router.use("/game-logs", handleGetGameLogs);


export default router;