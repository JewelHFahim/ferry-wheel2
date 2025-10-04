import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = express.Router();

// Auth
// router.post("/register", register);
// router.post("/login", login);

// Protected
// router.get("/profile", authMiddleware, getProfile);

export default router;
