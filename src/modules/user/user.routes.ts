import express from "express";
import { handleRegistration, UserController } from "./user.controller";

const router = express.Router();

// Auth
router.post("/register", handleRegistration);
router.post("/login", UserController.login);

// Protected
// router.get("/profile", authMiddleware, getProfile);

export default router;
