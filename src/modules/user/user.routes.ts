import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { UserController } from "./user.controller";

const router = express.Router();

// Auth
router.post("/register", UserController.register);
router.post("/login", UserController.login);

// Protected
// router.get("/profile", authMiddleware, getProfile);

export default router;
