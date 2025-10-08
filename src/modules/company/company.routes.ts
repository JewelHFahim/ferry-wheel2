import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { handletGetCompanyWallet, handleTransaction } from "./company.controller";

const router = express.Router();

router.use("/wallet", handletGetCompanyWallet);
router.use("/transactions", handleTransaction);


export default router;