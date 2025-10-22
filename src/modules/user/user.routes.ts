import express from "express";
import { handleGetProfile, handleGetUserDailyWinnings, handleLogin, handleRegistration, UserController } from "./user.controller";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";

const router = express.Router();

// Auth
router.post("/register", handleRegistration);
router.post("/login", handleLogin);

// Protected
router.get("/profile/:id", authMiddleware, requireRole(["user"]), handleGetProfile);
router.get("/daily-wins", authMiddleware, handleGetUserDailyWinnings);

export default router;
