import express from 'express'
import { getRoundLogs } from './RoundEvent.controller';
import { getUserEvents } from '../user-log/UserEvent.controller';

const router = express.Router();

router.use("/game-logs", getRoundLogs);
router.get("/user-logs", getUserEvents);





export default router;