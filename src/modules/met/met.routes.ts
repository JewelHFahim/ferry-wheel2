import express from "express";
import { handleGetMetService } from "./met.controller";

const router = express.Router();

router.use("/retrive", handleGetMetService);


export default router;