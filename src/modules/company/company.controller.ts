import express, { Request, Response } from "express";
import CompanyWallet from "./company.model";

const router = express.Router();

// GET /api/v1/admin/company-wallet
export const handletGetCompanyWallet = async (req: Request, res: Response) => {
  try {
    const wallet = await CompanyWallet.findOne();

    res.status(200).json({ status: true, wallet });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
};



// GET /api/v1/admin/company-wallet/transactions
 export const handleTransaction =  async (req:Request, res: Response) => {
  try {
    const wallet = await CompanyWallet.findOne();
    if (!wallet) {
      return res.status(404).json({ success: false, error: "Company wallet not found." });
    }
    res.json({ success: true, transactionHistory: wallet.transactionHistory });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
}

export default router;
