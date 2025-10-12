import mongoose from "mongoose";

const companyWalletSchema = new mongoose.Schema({
  balance: { type: Number, default: 0 },
  reserveWallet: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  transactionHistory: [{
    type: { type: String },
    amount: { type: Number },
    date: { type: Date, default: Date.now },
    description: { type: String }
  }]
});

const CompanyWallet = mongoose.model('CompanyWallet', companyWalletSchema);

export default CompanyWallet;
