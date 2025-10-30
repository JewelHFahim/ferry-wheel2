import express from "express";
import userRoutes from "../modules/user/user.routes";
import settingRoutes from "../modules/settings/setting.routes";
import compnayRoutes from "../modules/company/company.routes";
import metRoutes from "../modules/met/met.routes";
import betRoutes from "../modules/bet/bet.routes";
import gameLogsRoutes from "../dashboard/game-log/gameLog.routes";

const router = express.Router();


//App All Primary Routes
router.use("/users", userRoutes);
router.use("/company", compnayRoutes);
router.use("/settings", settingRoutes);
router.use("/bet", betRoutes);
router.use("/met-services", metRoutes);
router.use("/game", gameLogsRoutes);


export default router;