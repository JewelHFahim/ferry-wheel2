import { Namespace } from "socket.io";
import { SettingsService } from "../modules/settings/settings.service";
import { MetService } from "../modules/met/met.service";
import { UserService } from "../modules/user/user.service";
import Round from "../modules/round/round.model";
import { getBetsByRound } from "./../modules/bet/bet.service";
import { Types } from "mongoose";
import { env } from "../config/env";
import {
  addRoundFunds,
  getCompanyWallet,
  logTransaction,
} from "../modules/company/company.service";
import { IBet } from "../modules/bet/bet.model";
import { phaseStatus } from "../utils/statics/statics";
import { EMIT } from "../utils/statics/emitEvents";
import { ROUND_STATUS } from "../modules/round/round.types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Start the round and betting
export const startNewRound = async (nsp: Namespace): Promise<void> => {
  try {
    // const settings = await SettingsService.getSettings();
    const [settings, roundNumber, boxes] = await Promise.all([
      SettingsService.getSettings(),
      MetService.incrementRoundCounter(),
      SettingsService.getInitialBoxes(),
    ]);

    const raw = settings.roundDuration ?? env.BETTING_DURATION;
    const durationMs = raw > 1000 ? raw : raw * 1000;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMs);
    const bettingDuration = durationMs;
    const revealDuration =  3000;
    const prepareDuration = 3000;
    const now = Date.now();


    const endBettingTime = new Date(startTime.getTime() + bettingDuration);
    const endRevealTime = new Date(endBettingTime.getTime() + revealDuration);
    const endPrepareTime = new Date(endRevealTime.getTime() + prepareDuration);

    // Create the initial round
    const round = await Round.create({
      roundNumber,
      startTime,
      endTime:endPrepareTime,
      phaseEndTimes: {
        betting: endBettingTime,
        reveal: endRevealTime,
        prepare: endPrepareTime,
      },
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

    // ==========================
    // Emit Round Start
    // ==========================
    nsp.emit(EMIT.ROUND_STARTED, {
      _id: round._id,
      roundNumber,
      startTime,
      endTime,
      boxes,
      roundStatus: ROUND_STATUS.BETTING,
    });

    // TODO: Have to delete
    // ==========================
    // Emit Betting Phase
    // ==========================
    nsp.emit(EMIT.PHASE_UPDATED, { 
      phase: ROUND_STATUS.BETTING, 
      phaseStartTime: now, 
      phaseEndTime: now + bettingDuration
     });
    await sleep(bettingDuration);

    // End the round and prepare for the next phase
    await endRound(round._id.toString(), nsp);
  } catch (err) {
    console.error("❌ Failed to start new round:", err);
  }
};

// End the rund, gather pool, calculate, choose winner, distribute apyouts
export const endRound = async (roundId: string, nsp: Namespace): Promise<void> => {
  try {
    const revealDuration = 5000; // 5 seconds
    const prepareDuration = 5000; // 5 seconds
    const now = Date.now();

    // Fetch round, settings, and company wallet
    const [round, settings, companyWallet] = await Promise.all([
      Round.findById(roundId),
      SettingsService.getSettings(),
      getCompanyWallet(),
    ]);

    if (!round) return console.warn("Round not found:", roundId);
    if (!settings) return console.warn("Settings not found");

    // Close round for betting
    round.roundStatus = ROUND_STATUS.CLOSED;
    round.phase = "reveal";
    round.phaseEndTime = new Date(Date.now() + revealDuration);
    await round.save();
    nsp.emit("roundClosed", { _id: round._id, roundNumber: round.roundNumber, roundStatus: ROUND_STATUS.CLOSED });

    // Fetch all bets
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
    round.totalPool = totalPool;
    console.log("totalPool: ", totalPool)

    // Company cut (10% of total pool)
    const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0.1));
    round.companyCut = companyCut;
    console.log("companyCut: ", companyCut)

    // Distributable funds for winners
    let distributableAmount = totalPool - companyCut;
    const availableFunds = distributableAmount + companyWallet.reserveWallet;
    console.log("companyWallet: ", companyWallet.reserveWallet);
    console.log("availableFunds: ", availableFunds)

    // Determine eligible and ineligible boxes
    const eligibleBoxes: any[] = [];
    const ineligibleBoxes: any[] = [];

    round.boxStats.forEach(box => {
      const totalBoxBet = bets.filter(bet => bet.box === box.box).reduce((sum, b) => sum + b.amount, 0);
      console.log("totalBoxBet", totalBoxBet);

      // Special box group handling (Pizza/Salad)
      let requiredPayout = totalBoxBet * (Number(box.multiplier) || 1);
      if (box.group === "Pizza" || box.group === "Salad") {
        const groupBets = bets
          .filter(b => round.boxStats.find(bs => bs.box === b.box)?.group === box.group)
          .reduce((sum, b) => sum + b.amount, 0);
        requiredPayout = groupBets * (Number(box.multiplier) || 1);
        console.log("groupBets: ", groupBets)
      }

      if (requiredPayout <= availableFunds) eligibleBoxes.push(box);
      else ineligibleBoxes.push(box);
    });

    console.log("Eligible Boxes:", eligibleBoxes.map(b => b.box));
    console.log("Ineligible Boxes:", ineligibleBoxes.map(b => b.box));

    // Select winner randomly from eligible boxes
    let winnerBox: string | null = null;
    if (eligibleBoxes.length > 0) {
      winnerBox = eligibleBoxes[Math.floor(Math.random() * eligibleBoxes.length)].box;
    }
    console.log("winnerBox: ", winnerBox);

    // If no eligible winner, move distributable to reserve wallet
    if (!winnerBox) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction("reserveDeposit", distributableAmount, "No eligible winner, moved to reserve wallet");
      return;
    }

    // Calculate payouts
    let winningBets: IBet[] = [];
    if (["Pizza", "Salad"].includes(round.boxStats.find(b => b.box === winnerBox)?.group || "")) {
      const group = round.boxStats.find(b => b.box === winnerBox)?.group;
      winningBets = bets.filter(b => round.boxStats.find(bs => bs.box === b.box)?.group === group);
    } else {
      winningBets = bets.filter(b => b.box === winnerBox);
    }

    const payouts = winningBets.map(b => {
      const multiplier = round.boxStats.find(box => box.box === b.box)?.multiplier || 1;
      return {
        userId: String(b.userId),
        box: b.box,
        amount: b.amount * Number(multiplier),
      };
    });

    const totalPayout = payouts.reduce((sum, p) => sum + p.amount, 0);

    // Check if available funds cover total payout
    if (totalPayout > availableFunds) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction("reserveDeposit", distributableAmount, "Insufficient funds for payout, moved to reserve wallet");
      return;
    }

    // Deduct reserve wallet if needed
    let reserveUsed = 0;
    if (totalPayout > distributableAmount) {
      reserveUsed = totalPayout - distributableAmount;
      companyWallet.reserveWallet -= reserveUsed;
      await logTransaction("reserveWithdraw", reserveUsed, "Used reserve wallet to cover payout");
    }

    // Pay winners
    const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
    for (const p of payouts) {
      const updated = await UserService.updateBalance(p.userId, p.amount);
      nsp.to(`user:${p.userId}`).emit(EMIT.PAYOUT, {
        roundId: round._id,
        winnerBox,
        amount: p.amount,
        newBalance: updated.balance,
      });

      topWinners.push({ 
        userId: new Types.ObjectId(p.userId), 
        amountWon: p.amount
       });

      nsp.to(`user:${p.userId}`).emit("balanceUpdate", {
        balance: updated.balance,
        delta: p.amount,
        reason: "payout",
        roundId: round._id,
      });
    }

    // Update round stats
    round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
    round.winningBox = winnerBox;
    round.distributedAmount = totalPayout;

    await round.save();
    console.log("round.topWinners: ", round.topWinners)

    // Add company cut and any leftover distributable
    const remainingDistributable = distributableAmount - (totalPayout - reserveUsed);
    await addRoundFunds(companyCut, remainingDistributable);
    await logTransaction("companyCut", companyCut, "Company cut from pool");

    // Emit final round results
    nsp.emit("roundUpdated", {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
      roundStatus: round.roundStatus
    });

    nsp.emit("winnerRevealed", {
      _id: round._id,
      roundNumber: round.roundNumber,
      winnerBox,
      payouts,
      topWinners: round.topWinners,
      roundStatus: round.roundStatus
    });

    // Reveal Phase
    nsp.emit("phaseUpdate", {
      phase: phaseStatus.REVEAL,
      phaseStartTime: now,
      phaseEndTime: round.phaseEndTime.getTime(),
    });

    await sleep(revealDuration);

    nsp.emit("roundEnded", {
      _id: round._id,
      roundNumber: round.roundNumber,
      totalPool,
      companyCut,
      distributedAmount: round.distributedAmount,
      reserveWallet: companyWallet.reserveWallet,
      roundStatus: round.roundStatus
    });

    // Prepare Next
    nsp.emit("phaseUpdate", {
      phase: phaseStatus.PREPARE,
      phaseStartTime: Date.now(),
      phaseEndTime: Date.now() + prepareDuration,
    });

    await sleep(prepareDuration);

    // Start next round
    setTimeout(() => startNewRound(nsp), 5000);
  } catch (err) {
    console.error("❌ Failed to end round:", err);
  }
};
