import express from "express";
import userRoutes from "../modules/user/user.routes";
import settingRoutes from "../modules/settings/setting.routes";

const router = express.Router();

router.use("/users", userRoutes);
router.use("/settings", settingRoutes);


export default router;