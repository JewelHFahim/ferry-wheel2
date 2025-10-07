import mongoose from "mongoose";

const companyWalletSchema = new mongoose.Schema({
  balance: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

const CompanyWallet = mongoose.model('CompanyWallet', companyWalletSchema);
