import express from "express";
import { handleGetSettings, handleUpdateSettings } from "./setting.controller";

const router = express.Router();

router.get("/retrive", handleGetSettings);
router.patch("/update", handleUpdateSettings);

export default router;
