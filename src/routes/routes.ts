import express from "express";
import userRoutes from "../modules/user/user.routes";
import settingRoutes from "../modules/settings/setting.routes";
import compnayRoutes from "../modules/company/company.routes";

const router = express.Router();

router.use("/users", userRoutes);
router.use("/settings", settingRoutes);
router.use("/company", compnayRoutes);


export default router;