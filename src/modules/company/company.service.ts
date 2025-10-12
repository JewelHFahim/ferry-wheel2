import CompanyWallet from "./company.model";

export const getCompanyWallet = async () => {
  let wallet = await CompanyWallet.findOne();
  if (!wallet) {
    wallet = await CompanyWallet.create({ balance: 0, reserveWallet: 0 });
  }
  return wallet;
};

export const addRoundFunds = async ( companyCut: number, reserveAmount: number) => {
  const wallet = await getCompanyWallet();

  wallet.balance += companyCut;
  wallet.reserveWallet += reserveAmount;

  wallet.lastUpdated = new Date();
  await wallet.save();
  
  return wallet;
};

export const getReserveWallet = async () => {
  const wallet = await getCompanyWallet();

  const reserveWallet = wallet.reserveWallet;

  return reserveWallet;
};


// transaction log
export const logTransaction = async (type: string, amount: number, description: string) => {
  const wallet = await CompanyWallet.findOne();
  if (!wallet) {
    console.error("Company wallet not found!");
    return;
  }

  wallet.transactionHistory.push({
    type,
    amount,
    description,
    date: new Date(),
  });

  await wallet.save();
};
