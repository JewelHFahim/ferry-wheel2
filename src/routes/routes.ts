import express from "express";
import userRoutes from "../modules/user/user.routes";
import settingRoutes from "../modules/settings/setting.routes";
import compnayRoutes from "../modules/company/company.routes";
import metRoutes from "../modules/met/met.routes";
import betRoutes from "../modules/bet/bet.routes";

const router = express.Router();


//App All Primary Routes
router.use("/users", userRoutes);
router.use("/company", compnayRoutes);
router.use("/settings", settingRoutes);
router.use("/bettings", betRoutes);
router.use("/met-services", metRoutes);


export default router;