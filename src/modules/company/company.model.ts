import mongoose from "mongoose";

const companyWalletSchema = new mongoose.Schema({
  balance: { type: Number, default: 0 },
  reserveWallet: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  transactionHistory: [{
    type: { type: String }, // 'companyCut', 'reserveDeposit', 'reserveWithdraw', etc.
    amount: { type: Number }, // Amount added or deducted
    date: { type: Date, default: Date.now },
    description: { type: String } // Description of the transaction
  }]
});

const CompanyWallet = mongoose.model('CompanyWallet', companyWalletSchema);

export default CompanyWallet;
