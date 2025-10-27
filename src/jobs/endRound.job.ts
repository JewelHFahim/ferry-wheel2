import { Namespace } from "socket.io";
import { SettingsService } from "../modules/settings/settings.service";
import { UserService } from "../modules/user/user.service";
import Round from "../modules/round/round.model";
import { getBetsByRound } from "./../modules/bet/bet.service";
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

export const endRound = async (roundId: string, nsp: Namespace): Promise<void> => {
  try {
    // ---- 1) Load state
    const [round, settings, companyWallet] = await Promise.all([
      Round.findById(roundId),
      SettingsService.getSettings(),
      getCompanyWallet(),
    ]);

    if (!round) { console.warn("Round not found:", roundId); return; }
    if (!settings) { console.warn("Settings not found"); return; }

    const revealDuration  = settings.revealDuration ?? env.REVEAL_DURATION;
    const prepareDuration  = settings.prepareDuration ?? env.PREPARE_DURATION;

    // ---- 2) Close betting
    round.roundStatus = ROUND_STATUS.REVEALING;
    await round.save();

    // ====================================
    // @status: Public,  @desc: Betting close
    // ====================================
    nsp.emit(EMIT.ROUND_CLOSED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      roundStatus: ROUND_STATUS.REVEALING,
    });

    // ---- 3) Load bets & compute pool
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((s, b) => s + b.amount, 0);
    round.totalPool = totalPool;

    // ---- User bet per box totals


    // ---- 4) Compute group totals (Pizza/Salad)
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
    // include any direct rep bets
    pizzaTotal += perBoxTotal.get("Pizza") || 0; pizzaCount += perBoxCount.get("Pizza") || 0;
    saladTotal += perBoxTotal.get("Salad") || 0; saladCount += perBoxCount.get("Salad") || 0;

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

    // ---- 5) Company cut & funds
    const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0.1));
    round.companyCut = companyCut;

    const distributableAmount = totalPool - companyCut;
    const availableFunds = distributableAmount + companyWallet.reserveWallet;

    // ---- 6) Eligibility using UI totals
    const eligibleStats = round.boxStats.filter((s) => {
      const mult = Number(s.multiplier) || 1;
      const required = (s.totalAmount || 0) * mult;
      return required <= availableFunds;
    });

    // ---- 7) Choose winner
    let winnerBox: string | null = null;
    if (eligibleStats.length > 0) {
      winnerBox = eligibleStats[Math.floor(Math.random() * eligibleStats.length)].box;
    }
    // if move distributable to reserve and stop
    if (!winnerBox) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction("reserveDeposit", distributableAmount, "No eligible winner, moved to reserve wallet");
      return;
    }

    // ---- 8) 
    // ---- Compute payouts ONLY => NOT credit yet
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
    if (totalPayout > availableFunds) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction("reserveDeposit", distributableAmount, "Insufficient funds for payout, moved to reserve wallet");
      return;
    }

    // ---- 9)
    // ---- Persist the result & mark payouts as pending
        const winByUser = new Map<string, number>();
        for (const p of payouts) {
          const key = String(p.userId);
          winByUser.set(key, (winByUser.get(key) || 0) + p.amount);
        }
        const topWinners = [...winByUser.entries()]
          .map(([userId, amountWon]) => ({ userId: new Types.ObjectId(userId), amountWon }))
          .sort((a, b) => b.amountWon - a.amountWon)
          .slice(0, 3);
    
        round.winningBox        = winnerBox;
        round.distributedAmount = totalPayout;
        round.companyCut        = companyCut;
        round.topWinners        = topWinners;
        round.pendingPayouts    = payouts;
        round.payoutsApplied    = false;
        await round.save();
        
    // ---- 10)
    // ====================================
    // @status: Public,  @desc: Emit reveal FIRST, no balance changes yet
    // ====================================
    nsp.emit(EMIT.ROUND_UPDATED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
      roundStatus: ROUND_STATUS.REVEALING,
    });

    // Pause for result reveal
    await sleep(5000);

    // ====================================
    // @status: Public,  @desc: Winner revealed
    // ====================================
    nsp.emit(EMIT.WINNER_REVEALED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      winnerBox,
      totalPayout: round.distributedAmount,
      roundStatus: ROUND_STATUS.REVEALED,
    });

    // ---- 11) Pause for animation
    await sleep(5000);

    // ---- 12) APPLY payouts once (idempotent check)
    const fresh = await Round.findOneAndUpdate(
      { _id: round._id, payoutsApplied: { $ne: true } },
      { $set: { payoutsApplied: true } },               
      { new: true, projection: { pendingPayouts: 1 } }
    ).lean();

    //Apply credits now.
    if (fresh) {
      let reserveUsed = 0;
      if (totalPayout > distributableAmount) {
        reserveUsed = totalPayout - distributableAmount;
        companyWallet.reserveWallet -= reserveUsed;
        await companyWallet.save();
        await logTransaction("reserveWithdraw", reserveUsed, "Used reserve wallet to cover payout");
      }

      // ====================================
      // @status: PRIVATE,  @desc: Credit wiiners & Balance update
      // ====================================
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

      // treasury: company cut + leftover distributable
      const remainingDistributable = distributableAmount - (totalPayout - reserveUsed);
      await addRoundFunds(companyCut, remainingDistributable);
      round.reserveWallet = remainingDistributable;
      await round.save();
      await logTransaction("companyCut", companyCut, "Company cut from pool");
    }

    // ---- 13)
    // ====================================
    // @status: PUBLIC,  @desc: End round
    // ====================================
    nsp.emit(EMIT.ROUND_ENDED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      totalPool,
      companyCut,
      distributedAmount: totalPayout,
      reserveWallet: companyWallet.reserveWallet,
      roundStatus: ROUND_STATUS.COMPLETED,
    });

    round.totalPool = totalPool;
    round.roundStatus = ROUND_STATUS.COMPLETED;
    await round.save();


    // ====================================
    // @status: PUBLIC,  @desc: Reset round
    // ====================================
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
    nsp.emit(EMIT.USER_PERBOX_TOTAL, { roundId: "", userId: "",  userPerBoxTotal: [] });

    // await sleep(5000);

    setTimeout(() => startNewRound(nsp), 5000);
  } catch (err) {
    console.error("❌ Failed to end round:", err);
  }
};
