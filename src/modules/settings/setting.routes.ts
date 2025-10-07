import express from "express";
import { handleGetSettings } from "./setting.controller";

const router = express.Router();

router.get("/retrive", handleGetSettings);

export default router;
