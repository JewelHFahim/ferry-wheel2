import express from "express";
import { handleGetProfile, handleLogin, handleRegistration, UserController } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = express.Router();

// Auth
router.post("/register", handleRegistration);
router.post("/login", handleLogin);

// Protected
router.get("/profile/:id", authMiddleware, handleGetProfile);

export default router;
