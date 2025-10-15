

import { Namespace } from "socket.io";
import { Types } from "mongoose";
import Round from "../modules/round/round.model";
import { SettingsService } from "../modules/settings/settings.service";
import { MetService } from "../modules/met/met.service";
import { UserService } from "../modules/user/user.service";
import { getBetsByRound } from "../modules/bet/bet.service";
import { getCompanyWallet, addRoundFunds, logTransaction } from "../modules/company/company.service";
import { IBet } from "../modules/bet/bet.model";
import { EMIT } from "../utils/statics/emitEvents";
import { ROUND_STATUS } from "../modules/round/round.types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const startNewRound = async (nsp: Namespace) => {
  try {
    const [settings, roundNumber, boxes] = await Promise.all([
      SettingsService.getSettings(),
      MetService.incrementRoundCounter(),
      SettingsService.getInitialBoxes(),
    ]);

    const bettingDuration = (settings.roundDuration ?? 30) * 1000;
    const revealDuration = (settings.revealDuration ?? 5) * 1000;
    const prepareDuration = (settings.prepareDuration ?? 5) * 1000;

    const startTime = new Date();
    const revealTime = new Date(startTime.getTime() + bettingDuration);
    const prepareTime = new Date(revealTime.getTime() + revealDuration);
    const endTime = new Date(prepareTime.getTime() + prepareDuration);

    // Create round
    const round = await Round.create({
      roundNumber,
      startTime,
      endTime,
      revealTime,
      prepareTime,
      boxes,
      boxStats: boxes.map(b => ({
        box: b.title,
        title: b.title,
        icon: b.icon,
        multiplier: b.multiplier,
        totalAmount: 0,
        bettorsCount: 0,
      })),
      totalPool: 0,
      companyCut: 0,
      distributedAmount: 0,
      reserveWallet: 0,
      roundStatus: ROUND_STATUS.BETTING,
    });

    await MetService.setCurrentRound(round._id.toString());

    // Emit round started
    nsp.emit(EMIT.ROUND_STARTED, {
      _id: round._id,
      roundNumber,
      startTime,
      revealTime,
      prepareTime,
      endTime,
      boxes,
      roundStatus: ROUND_STATUS.BETTING,
    });

    // Wait for betting duration
    await sleep(bettingDuration);

    // End round and handle payouts
    await endRound(round._id.toString(), nsp);
  } catch (err) {
    console.error("❌ Failed to start new round:", err);
  }
};

export const endRound = async (roundId: string, nsp: Namespace) => {
  try {
    const [round, settings, companyWallet] = await Promise.all([
      Round.findById(roundId),
      SettingsService.getSettings(),
      getCompanyWallet(),
    ]);

    if (!round || !settings) return;

    const revealDuration = (settings.revealDuration ?? 5) * 1000;
    const prepareDuration = (settings.prepareDuration ?? 5) * 1000;

    // Close betting
    round.roundStatus = ROUND_STATUS.REVEALING;
    await round.save();
    nsp.emit(EMIT.ROUND_CLOSED, { _id: round._id, roundNumber: round.roundNumber, roundStatus: ROUND_STATUS.REVEALING });

    // Fetch all bets
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
    round.totalPool = totalPool;

    const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0.1));
    round.companyCut = companyCut;

    const distributableAmount = totalPool - companyCut;
    const availableFunds = distributableAmount + companyWallet.reserveWallet;

    // Determine winner
    const eligibleBoxes: any[] = [];
    round.boxStats.forEach(box => {
      const totalBoxBet = bets.filter(bet => bet.box === box.box).reduce((sum, b) => sum + b.amount, 0);
      let requiredPayout = totalBoxBet * (Number(box.multiplier) || 1);

      if (box.group === "Pizza" || box.group === "Salad") {
        const groupBets = bets
          .filter(b => round.boxStats.find(bs => bs.box === b.box)?.group === box.group)
          .reduce((sum, b) => sum + b.amount, 0);
        requiredPayout = groupBets * (Number(box.multiplier) || 1);
      }

      if (requiredPayout <= availableFunds) eligibleBoxes.push(box);
    });

    let winnerBox: string | null = null;
    if (eligibleBoxes.length > 0) winnerBox = eligibleBoxes[Math.floor(Math.random() * eligibleBoxes.length)].box;

    // No eligible winner
    if (!winnerBox) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction("reserveDeposit", distributableAmount, "No eligible winner, moved to reserve wallet");
      return;
    }

    // Calculate payouts
    let winningBets: IBet[] = [];
    const winnerGroup = round.boxStats.find(b => b.box === winnerBox)?.group;
    if (["Pizza", "Salad"].includes(winnerGroup || "")) {
      winningBets = bets.filter(b => round.boxStats.find(bs => bs.box === b.box)?.group === winnerGroup);
    } else {
      winningBets = bets.filter(b => b.box === winnerBox);
    }

    const payouts = winningBets.map(b => {
      const multiplier = round.boxStats.find(box => box.box === b.box)?.multiplier || 1;
      return { userId: String(b.userId), box: b.box, amount: b.amount * Number(multiplier) };
    });

    // Deduct reserve if needed
    const totalPayout = payouts.reduce((sum, p) => sum + p.amount, 0);
    if (totalPayout > distributableAmount) {
      const reserveUsed = totalPayout - distributableAmount;
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

      nsp.to(`user:${p.userId}`).emit(EMIT.BALANCE_UPDATE, {
        balance: updated.balance,
        delta: p.amount,
        reason: "payout",
        roundId: round._id,
      });

      topWinners.push({ userId: new Types.ObjectId(p.userId), amountWon: p.amount });
    }

    // Update round stats
    round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
    round.winningBox = winnerBox;
    round.distributedAmount = totalPayout;
    await round.save();

    // Company cut and leftovers
    const remainingDistributable = distributableAmount - totalPayout;
    await addRoundFunds(companyCut, remainingDistributable);
    await logTransaction("companyCut", companyCut, "Company cut from pool");

    // Emit results
    nsp.emit(EMIT.ROUND_UPDATED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
      roundStatus: ROUND_STATUS.REVEALED,
    });

    nsp.emit(EMIT.WINNER_REVEALED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      winnerBox,
      payouts,
      topWinners: round.topWinners,
      roundStatus: ROUND_STATUS.REVEALED,
    });

    // Wait reveal duration
    await sleep(revealDuration);

    nsp.emit(EMIT.ROUND_ENDED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      totalPool,
      companyCut,
      distributedAmount: round.distributedAmount,
      reserveWallet: companyWallet.reserveWallet,
      roundStatus: ROUND_STATUS.COMPLETED,
    });

    // Wait prepare duration
    await sleep(prepareDuration);

  } catch (err) {
    console.error("❌ Failed to end round:", err);
  }
};
