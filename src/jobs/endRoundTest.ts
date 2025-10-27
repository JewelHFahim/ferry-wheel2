import { Namespace } from "socket.io";
import { SettingsService } from "../modules/settings/settings.service";
import { UserService } from "../modules/user/user.service";
import Round from "../modules/round/round.model";
import { getBetsByRound } from "../modules/bet/bet.service";
import { Types } from "mongoose";
import {
  addRoundFunds,
  getCompanyWallet,
  logTransaction,
} from "../modules/company/company.service";
import { EMIT } from "../utils/statics/emitEvents";
import { ROUND_STATUS } from "../modules/round/round.types";
import { startNewRound } from "./startNewRound.job";
import { env } from "../config/env";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const endRound1 = async (roundId: string, nsp: Namespace): Promise<void> => {
  try {
    // 1) Load state
    const [round, settings, companyWallet] = await Promise.all([
      Round.findById(roundId),
      SettingsService.getSettings(),
      getCompanyWallet(),
    ]);

    if (!round) { console.warn("Round not found:", roundId); return; }
    if (!settings) { console.warn("Settings not found"); return; }

    // const rawRevealDuration  = settings.revealDuration  ?? env.REVEAL_DURATION;
    // const rawPrepareDuration = settings.prepareDuration ?? env.PREPARE_DURATION;
    // const revealDuration     = rawRevealDuration  > 1000 ? rawRevealDuration  : rawRevealDuration  * 1000;
    // const prepareDuration    = rawPrepareDuration > 1000 ? rawPrepareDuration : rawPrepareDuration * 1000;

    // 2) Close betting → REVEALING
    round.roundStatus = ROUND_STATUS.REVEALING;
    await round.save();

    nsp.emit(EMIT.ROUND_CLOSED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      endTime: round.endTime,
      revealTime: round.revealTime,
      prepareTime: round.prepareTime,
      roundStatus: ROUND_STATUS.REVEALING,
    });

    // 3) Load bets & compute pool
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((s, b) => s + b.amount, 0);
    round.totalPool = totalPool;

    // 4) Compute group totals (Pizza/Salad)
    const statByBox = new Map(round.boxStats.map((s) => [s.box, s]));
    const pizzaMembers = new Set(
      round.boxStats.filter(s => s.group === "Pizza" && s.box !== "Pizza").map(s => s.box)
    );
    const saladMembers = new Set(
      round.boxStats.filter(s => s.group === "Salad" && s.box !== "Salad").map(s => s.box)
    );

    const perBoxTotal = new Map<string, number>();
    const perBoxCount = new Map<string, number>();
    for (const b of bets) {
      perBoxTotal.set(b.box, (perBoxTotal.get(b.box) || 0) + b.amount);
      perBoxCount.set(b.box, (perBoxCount.get(b.box) || 0) + 1);
    }

    let pizzaTotal = 0, pizzaCount = 0;
    let saladTotal = 0, saladCount = 0;
    for (const b of bets) {
      if (pizzaMembers.has(b.box)) { pizzaTotal += b.amount; pizzaCount += 1; }
      if (saladMembers.has(b.box)) { saladTotal += b.amount; saladCount += 1; }
    }
    // include any direct rep bets (future-proofing)
    pizzaTotal += perBoxTotal.get("Pizza") || 0;
    pizzaCount += perBoxCount.get("Pizza") || 0;
    saladTotal += perBoxTotal.get("Salad") || 0;
    saladCount += perBoxCount.get("Salad") || 0;

    for (const s of round.boxStats) {
      if (s.box === "Pizza") {
        s.totalAmount  = pizzaTotal;
        s.bettorsCount = pizzaCount;
      } else if (s.box === "Salad") {
        s.totalAmount  = saladTotal;
        s.bettorsCount = saladCount;
      } else {
        s.totalAmount  = perBoxTotal.get(s.box) || 0;
        s.bettorsCount = perBoxCount.get(s.box) || 0;
      }
    }
    await round.save();

    // 5) Company cut & funds
    const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0.1));
    round.companyCut = companyCut;

    const distributableAmount = totalPool - companyCut;
    const availableFunds = distributableAmount + companyWallet.reserveWallet;

    // 6) Eligibility (use same totals UI sees)
    const eligibleStats = round.boxStats.filter((s) => {
      const mult = Number(s.multiplier) || 1;
      const required = (s.totalAmount || 0) * mult;
      return required <= availableFunds;
    });

    // 7) Choose winner
    let winnerBox: string | null = null;
    if (eligibleStats.length > 0) {
      winnerBox = eligibleStats[Math.floor(Math.random() * eligibleStats.length)].box;
    }

    // helper: finalize & reset + emit
    const finalizeAndReset = async (distributedAmount: number) => {
      round.distributedAmount = distributedAmount;
      round.roundStatus = ROUND_STATUS.COMPLETED;
      await round.save();

      nsp.emit(EMIT.ROUND_ENDED, {
        _id: round._id,
        roundNumber: round.roundNumber,
        totalPool,
        companyCut,
        distributedAmount,
        reserveWallet: companyWallet.reserveWallet,
        winnerBox: round.winningBox,    
        topWinners: round.topWinners,
        endTime: round.endTime,
        revealTime: round.revealTime,
        prepareTime: round.prepareTime,
        roundStatus: ROUND_STATUS.COMPLETED,
      });

      // move UI into PREPARE
      nsp.emit(EMIT.ROUND_UPDATED, {
        _id: round._id,
        roundNumber: round.roundNumber,
        boxStats: round.boxStats,
        endTime: round.endTime,
        revealTime: round.revealTime,
        prepareTime: round.prepareTime,
        roundStatus: ROUND_STATUS.PREPARE,
      });

      nsp.emit(EMIT.ROUND_RESET, {
        _id: "",
        roundNumber: round.roundNumber,
        totalPool: 0,
        companyCut: 0,
        distributedAmount: 0,
        reserveWallet: 0,
        roundStatus: ROUND_STATUS.PREPARE,
      });

      // only schedule the next round (no extra sleep)
      setTimeout(() => startNewRound(nsp), 5000);
    };

    // No eligible winner → move distributable to reserve and complete cleanly
    if (!winnerBox) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction("reserveDeposit", distributableAmount, "No eligible winner, moved to reserve wallet");

      round.winningBox        = null;
      round.topWinners        = [];
      round.companyCut        = companyCut;
      round.distributedAmount = 0;
      round.reserveWallet     = distributableAmount;
      await round.save();

      await finalizeAndReset(0);
      return;
    }

    // 8) Compute payouts ONLY (no credits yet)
    const isPizza = winnerBox === "Pizza";
    const isSalad = winnerBox === "Salad";
    const payMultiplier = statByBox.get(winnerBox)?.multiplier ?? 1;

    const winningBets = isPizza
      ? bets.filter(b => pizzaMembers.has(b.box) || b.box === "Pizza")
      : isSalad
      ? bets.filter(b => saladMembers.has(b.box) || b.box === "Salad")
      : bets.filter(b => b.box === winnerBox);

    const payouts = winningBets.map(b => ({
      userId: new Types.ObjectId(b.userId),
      box: b.box,
      amount: b.amount * payMultiplier,
    }));

    const totalPayout = payouts.reduce((s, p) => s + p.amount, 0);

    // If insufficient funds, roll to reserve & end
    if (totalPayout > availableFunds) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction("reserveDeposit", distributableAmount, "Insufficient funds for payout, moved to reserve wallet");

      round.winningBox        = null;
      round.topWinners        = [];
      round.companyCut        = companyCut;
      round.distributedAmount = 0;
      round.reserveWallet     = distributableAmount; // snapshot
      await round.save();

      await finalizeAndReset(0);
      return;
    }

    // Compute podium
    const winByUser = new Map<string, number>();
    for (const p of payouts) {
      const key = String(p.userId);
      winByUser.set(key, (winByUser.get(key) || 0) + p.amount);
    }
    const topWinners = [...winByUser.entries()]
      .map(([userId, amountWon]) => ({ userId: new Types.ObjectId(userId), amountWon }))
      .sort((a, b) => b.amountWon - a.amountWon)
      .slice(0, 3);

    // 9) Snapshot result (still no balance changes)
    round.winningBox        = winnerBox;
    round.distributedAmount = totalPayout;
    round.companyCut        = companyCut;
    round.topWinners        = topWinners;
    round.pendingPayouts    = payouts;
    round.payoutsApplied    = false;
    await round.save();

    // → REVEALED (state change first, then emit)
    round.roundStatus = ROUND_STATUS.REVEALING;
    await round.save();

    // 10) Public: state is REVEALED (shows final boxStats and times)
    nsp.emit(EMIT.ROUND_UPDATED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
      endTime: round.endTime,
      revealTime: round.revealTime,
      prepareTime: round.prepareTime,
      roundStatus: ROUND_STATUS.REVEALING,
    });

    // Give the UI time for reveal animation
    await sleep(5000);

    round.roundStatus = ROUND_STATUS.REVEALING;
    await round.save();

    // Winner revealed payload (no balance changes here)
    nsp.emit(EMIT.WINNER_REVEALED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      winnerBox,
      topWinners: round.topWinners,
      totalPayout: round.distributedAmount,
      endTime: round.endTime,
      revealTime: round.revealTime,
      prepareTime: round.prepareTime,
      roundStatus: ROUND_STATUS.REVEALED,
    });

    // Small pause for winner animation
    await sleep(5000);

    // 11) APPLY payouts once (idempotent)
    const fresh = await Round.findOneAndUpdate(
      { _id: round._id, payoutsApplied: { $ne: true } },
      { $set: { payoutsApplied: true } },
      { new: true, projection: { pendingPayouts: 1 } }
    ).lean();

    if (fresh) {
      // Use reserve if needed (we already validated availableFunds)
      let reserveUsed = 0;
      if (totalPayout > distributableAmount) {
        reserveUsed = totalPayout - distributableAmount;
        companyWallet.reserveWallet -= reserveUsed;
        await companyWallet.save();
        await logTransaction("reserveWithdraw", reserveUsed, "Used reserve wallet to cover payout");
      }

      // Private: credit winners & send private emits
      for (const p of payouts) {
        const updated = await UserService.updateBalance(String(p.userId), p.amount);

        nsp.to(`user:${String(p.userId)}`).emit(EMIT.PAYOUT, {
          roundId: round._id,
          winnerBox,
          amount: p.amount,
          newBalance: updated.balance,
        });

        nsp.to(`user:${String(p.userId)}`).emit(EMIT.BALANCE_UPDATE, {
          balance: updated.balance,
          delta: p.amount,
          reason: "payout",
          roundId: round._id,
        });
      }

      // Treasury: company cut + leftover distributable (snapshot to round.reserveWallet)
      const remainingDistributable = distributableAmount - (totalPayout - reserveUsed);
      await addRoundFunds(companyCut, remainingDistributable);
      round.reserveWallet = remainingDistributable;
      await round.save();
      await logTransaction("companyCut", companyCut, "Company cut from pool");
    }

    // 12) Public: end round (include winner & podium for analytics/UI)
    nsp.emit(EMIT.ROUND_ENDED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      totalPool,
      companyCut,
      distributedAmount: totalPayout,
      reserveWallet: companyWallet.reserveWallet,
      winnerBox: round.winningBox,
      topWinners: round.topWinners,
      endTime: round.endTime,
      revealTime: round.revealTime,
      prepareTime: round.prepareTime,
      roundStatus: ROUND_STATUS.COMPLETED,
    });

    // Persist final status
    round.totalPool = totalPool;
    round.roundStatus = ROUND_STATUS.COMPLETED;
    await round.save();

    // Move UI into PREPARE and schedule next round (no extra sleep here)
    nsp.emit(EMIT.ROUND_UPDATED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
      endTime: round.endTime,
      revealTime: round.revealTime,
      prepareTime: round.prepareTime,
      roundStatus: ROUND_STATUS.PREPARE,
    });

    nsp.emit(EMIT.ROUND_RESET, {
      _id: "",
      roundNumber: round.roundNumber,
      totalPool: 0,
      companyCut: 0,
      distributedAmount: 0,
      reserveWallet: 0,
      roundStatus: ROUND_STATUS.PREPARE,
    });

    nsp.emit(EMIT.USER_BET_TOTAL, { roundId: "", totalUserBet: 0 });

    setTimeout(() => startNewRound(nsp), 5000);

  } catch (err) {
    console.error("❌ Failed to end round:", err);
  }
};
