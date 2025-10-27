import express from "express";
import { handleGetProfile, handleGetUserDailyWinnings, handleGetUserWalletHistory, handleLogin, handleRegistration, UserController } from "./user.controller";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";

const router = express.Router();

// Auth
router.post("/register", handleRegistration);
router.post("/login", handleLogin);

// Protected
router.get("/profile/:id", authMiddleware, requireRole(["user"]), handleGetProfile);
router.get("/daily-wins", authMiddleware, handleGetUserDailyWinnings);
router.get("/transaction-ledger", authMiddleware, handleGetUserWalletHistory);

export default router;
