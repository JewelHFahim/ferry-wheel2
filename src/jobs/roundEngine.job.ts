import { Namespace } from "socket.io";
import { SettingsService } from "../modules/settings/settings.service";
import { MetService } from "../modules/met/met.service";
import { UserService } from "../modules/user/user.service";
import Round, { ROUND_STATUS } from "../modules/round/round.model";
import { Types } from "mongoose";
import { env } from "../config/env";
import {
  computeRoundResults,
  getBetsByRound,
} from "./../modules/bet/bet.service";
import {
  addRoundFunds,
  getReserveWallet,
  logTransaction,
} from "../modules/company/company.service";
import CompanyWallet from "../modules/company/company.model";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to handle errors more effectively
const handleError = (error: any, nsp: Namespace, roundId: string) => {
  console.error("❌ Error:", error);
  nsp.emit("roundError", { roundId, message: error.message });
};

// Start the round and betting
export const startNewRound = async (nsp: Namespace): Promise<void> => {
  try {
    // const settings = await SettingsService.getSettings();
    const [settings, roundNumber, boxes] = await Promise.all([
      SettingsService.getSettings(),
      MetService.incrementRoundCounter(),
      SettingsService.getInitialBoxes(),
    ]);

    const raw = settings.roundDuration ?? env.ROUND_DURATION;
    const durationMs = raw > 1000 ? raw : raw * 1000;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMs);

    // Create the initial round
    const round = await Round.create({
      roundNumber,
      startTime,
      endTime,
      boxes,
      totalPool: 0,
      companyCut: 0,
      distributedAmount: 0,
      reserveWallet: 0,
      boxStats: boxes.map((b) => ({
        box: b.title,
        title: b.title,
        icon: b.icon,
        multiplier: b.multiplier,
        totalAmount: 0,
        bettorsCount: 0,
      })),
      roundStatus: ROUND_STATUS.BETTING,
    });

    await MetService.setCurrentRound(round._id.toString());

    // Emit the round started event
    nsp.emit("roundStarted", {
      _id: round._id,
      roundNumber,
      startTime,
      endTime,
      boxes,
      roundStatus: ROUND_STATUS.BETTING,
    });

    // Wait for the betting phase to finish
    await sleep(durationMs);

    // End the round and prepare for the next phase
    await endRound(round._id.toString(), nsp);
  } catch (err) {
    console.error("❌ Failed to start new round:", err);
  }
};

// Calculate total pool, decide winner, payouts
export const endRound = async (roundId: string, nsp: Namespace): Promise<void> => {
  try {
    const [round, settings, reserveWallet] = await Promise.all([
      Round.findById(roundId), 
      SettingsService.getSettings(),
      getReserveWallet()
    ]);
    
    if (!round) return console.warn("Round not found:", roundId);
    if (!settings) return console.warn("Settings not found");

    // Close round for betting- (no more bets accepted)
    round.roundStatus = ROUND_STATUS.CLOSED;
    await round.save();
    nsp.emit("roundClosed", { _id: round._id, roundNumber: round.roundNumber });

    // Gather all the bets placed in this round
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((s, b) => s + b.amount, 0);
    round.totalPool = totalPool;

    console.log("totalPool: ", totalPool)

    // Calculate Company Cut (10% of the total pool)
    const companyCut = Math.floor(totalPool * (settings.commissionRate ?? env.COMPANY_PROFIT_PERCENT));
    round.companyCut = companyCut;

    // Distributable Amount (90% of the total pool)
    let distributableAmount = totalPool - companyCut;

    console.log("round.companyCut: ", round.companyCut)
    console.log("distributableAmount: ", distributableAmount);
    console.log("company reserveWallet: ", reserveWallet);


    // Eligible vs Ineligible Boxes
    const eligibleBoxes: any = [];
    const ineligibleBoxes: any = [];

    round.boxStats.forEach((box) => {
      const totalBoxBet = bets.filter((bet) => bet.box === box.box).reduce((sum, bet) => sum + bet.amount, 0);
      const requiredPayout = totalBoxBet * Number(box.multiplier);

      console.log("requiredPayout: ", requiredPayout);

      // Check if the box is eligible (either active bets or sufficient funds for payout)
      if (requiredPayout <= distributableAmount + reserveWallet) {
        eligibleBoxes.push(box);
        console.log("yes");
      } else {
        ineligibleBoxes.push(box);
        console.log("no");
      }
    });

    console.log(" distributableAmount+  company reserveWallet: ", distributableAmount + reserveWallet);
    console.log("Eligible Boxes:", eligibleBoxes);
    console.log("Ineligible Boxes:", ineligibleBoxes);

    // If there are eligible boxes, randomly select a winner
    let winnerBox = null;
    if (eligibleBoxes.length > 0) {
      winnerBox = eligibleBoxes[Math.floor(Math.random() * eligibleBoxes.length)].box;
    }

    // If no eligible box, move funds to reserve wallet and exit
    if (!winnerBox) {
      round.reserveWallet = Number(round.reserveWallet) + distributableAmount;
      distributableAmount = 0;
      await logTransaction("reserveDeposit", distributableAmount, "No winner, moved to reserve wallet");
      return;
    }

    console.log("winnerBox: ", winnerBox)

    const winningBets = bets.filter((b) => b.box === winnerBox);
    console.log("winningBets: ", winningBets);
    const totalWinningAmount = winningBets.reduce((acc, b) => acc + b.amount, 0);
    console.log("totalWinningAmount: ", totalWinningAmount);

    // Calculate payouts
    const payouts = totalWinningAmount > 0 ? winningBets.map((b) => {
    const multiplier = round.boxStats.find(box => box.box === winnerBox)?.multiplier ?? 1;

    // Calculate the payout for each user
    const payoutAmount = b.amount * Number(multiplier);
          return {
            userId: String(b.userId),
            box: b.box,
            amount: payoutAmount,
          };
        })
      : [];

    console.log("payouts: ", payouts)

    // If payouts exceed available funds (distributable + reserve), scale payouts
if (payouts.length > 0) {
  const totalPayout = payouts.reduce((s, p) => s + p.amount, 0);

  if (totalPayout > distributableAmount + reserveWallet) {
    const deficit = totalPayout - distributableAmount;  // Check if the payout exceeds available funds
    if (deficit <= Number(round.reserveWallet)) {
      // If the reserve wallet can cover the deficit, withdraw from reserve wallet
      round.reserveWallet = Number(round.reserveWallet) - deficit;
      distributableAmount += deficit;
      await logTransaction("reserveWithdraw", deficit, "Covered payout from reserve wallet");
    } else {
      // Scale payouts if there’s not enough in reserve
      const scale = (distributableAmount + Number(round.reserveWallet)) / totalPayout;
      payouts.forEach((p) => p.amount = Math.floor(p.amount * scale));  // Scale the payout for each winner
      round.reserveWallet = 0;
      await logTransaction("reserveWithdraw", Number(round.reserveWallet), "Scaled payouts due to insufficient funds");
    }
  } else {
    // No scaling needed, use full payout amounts from distributable funds
    round.reserveWallet = 0;
  }
}

    // Add company cut to the company wallet and log the transaction
    await addRoundFunds(companyCut, Number(round.reserveWallet));
    await logTransaction("companyCut", companyCut, "Company cut from pool");

    // Pay winners
    const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
    for (const p of payouts) {
      const updated = await UserService.updateBalance(p.userId, p.amount);
      nsp.to(`user:${p.userId}`).emit("payout", {
        roundId: round._id,
        winnerBox,
        amount: p.amount,
        newBalance: updated.balance,
      });

      topWinners.push({
        userId: new Types.ObjectId(p.userId),
        amountWon: p.amount,
      });

      nsp.to(`user:${p.userId}`).emit("balance:update", {
        balance: updated.balance,
        delta: p.amount,
        reason: "payout",
        roundId: round._id,
      });
    }

    // Update round stats
    round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
    round.winningBox = winnerBox;
    round.distributedAmount = payouts.reduce((s, p) => s + p.amount, 0);
    await round.save();

    // Emit updated round data
    nsp.emit("roundUpdated", {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
    });

    // Announce results to users
    nsp.emit("winnerRevealed", {
      _id: round._id,
      roundNumber: round.roundNumber,
      winnerBox,
      payouts,
      topWinners: round.topWinners,
    });

    nsp.emit("roundEnded", {
      _id: round._id,
      roundNumber: round.roundNumber,
      totalPool,
      companyCut,
      distributedAmount: round.distributedAmount,
    });

    // Start the next round
    setTimeout(() => startNewRound(nsp), 5000);
  } catch (err) {
    console.error("❌ Failed to end round:", err);
  }
};
