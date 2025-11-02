import { Namespace } from "socket.io";
import { Types } from "mongoose";

import { SettingsService } from "../modules/settings/settings.service";
import { UserService } from "../modules/user/user.service";
import Round from "../modules/round/round.model";
import { getBetsByRound } from "../modules/bet/bet.service";

import {
  addRoundFunds,
  getCompanyWallet,
  logTransaction,
} from "../modules/company/company.service";

import WalletLedger from "../modules/walletLedger/walletLedger.model";

import { EMIT } from "../utils/statics/emitEvents";
import { ROUND_STATUS } from "../modules/round/round.types";
import { startNewRound } from "./startNewRound.job";
import { env } from "../config/env";
import { groupName, transactionType } from "../utils/statics/statics";
import { requiredDatas } from "../dashboard/game-log/gameLog.controller";
import { logRoundEvent } from "../dashboard/game-log/logRoundEvent";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Local payout row type — box is REQUIRED to satisfy Round.pendingPayouts typing
type PayoutRow = { userId: Types.ObjectId; box: string; amount: number };

// small helper to write a company ledger row
async function writeCompanyLedger(opts: {
  type: string;
  roundId: string;
  delta: number;
  balanceAfter: number;
  meta?: any;
}) {
  await WalletLedger.create({
    entityTypes: "company",
    entityId: "company",
    roundId: opts.roundId,
    type: opts.type,
    delta: opts.delta,
    balanceAfter: opts.balanceAfter,
    metaData: opts.meta ?? new Date(),
  });
}

export const endRoundTest = async (roundId: string, nsp: Namespace): Promise<void> => {
  try {
    // ---- Load state ------//
    const [round, settings, companyWallet] = await Promise.all([
      Round.findById(roundId),
      SettingsService.getSettings(),
      getCompanyWallet(),
    ]);

    if (!round) { console.warn("Round not found:", roundId); return; }
    if (!settings) { console.warn("Settings not found"); return; }

    const revealDuration = typeof settings.revealDuration === "number"
      ? (settings.revealDuration < 1000 ? settings.revealDuration * 1000 : settings.revealDuration)
      : env.REVEAL_DURATION_MS;

    const prepareDuration = typeof settings.prepareDuration === "number"
      ? (settings.prepareDuration < 1000 ? settings.prepareDuration * 1000 : settings.prepareDuration)
      : env.PREPARE_DURATION_MS;

    // ---- Close betting ------//
    round.roundStatus = ROUND_STATUS.REVEALING;
    await round.save();

    nsp.emit(EMIT.ROUND_CLOSED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      roundStatus: ROUND_STATUS.REVEALING,
    });

    // ---- Load bets & compute pool ------//
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((s, b) => s + b.amount, 0);
    round.totalPool = totalPool;
    await round.save();

    console.log("=== ROUND DEBUG START ===");
    console.log(`Round #${round.roundNumber} (${round._id})`);
    console.log(`Total bets in pool: ${totalPool}`);

    // ---- Compute group totals (Pizza/Salad) ------- //
    const statByBox = new Map(round.boxStats.map((s) => [s.box, s]));
    const pizzaMembers = new Set(
      round.boxStats.filter(s => s.group === groupName.PIZZA && s.box !== groupName.PIZZA).map(s => s.box)
    );
    const saladMembers = new Set(
      round.boxStats.filter(s => s.group === groupName.SALAD && s.box !== groupName.SALAD).map(s => s.box)
    );

    // per-box aggregates
    const perBoxTotal = new Map<string, number>();
    const perBoxCount = new Map<string, number>();
    for (const b of bets) {
      perBoxTotal.set(b.box, (perBoxTotal.get(b.box) || 0) + b.amount);
      perBoxCount.set(b.box, (perBoxCount.get(b.box) || 0) + 1);
    }

    // DEBUG: per-box totals/cnts/mults
    const perBoxRows = Array.from(statByBox.keys()).map((box) => ({
      box,
      multiplier: Number(statByBox.get(box)?.multiplier) || 1,
      totalAmount: perBoxTotal.get(box) || 0,
      bettorsCount: perBoxCount.get(box) || 0,
      group: statByBox.get(box)?.group || "-",
    }));
    console.log("Per-Box Totals / Counts / Multipliers");
    console.table(perBoxRows);

    // per-group aggregates (only member boxes)
    let pizzaTotal = 0, pizzaCount = 0;
    let saladTotal = 0, saladCount = 0;
    for (const b of bets) {
      if (pizzaMembers.has(b.box)) { pizzaTotal += b.amount; pizzaCount += 1; }
      if (saladMembers.has(b.box)) { saladTotal += b.amount; saladCount += 1; }
    }

    // include any direct representative bets
    pizzaTotal += perBoxTotal.get(groupName.PIZZA) || 0;
    pizzaCount += perBoxCount.get(groupName.PIZZA) || 0;
    saladTotal += perBoxTotal.get(groupName.SALAD) || 0;
    saladCount += perBoxCount.get(groupName.SALAD) || 0;

    // DEBUG: group totals
    const pizzaMult = Number(statByBox.get(groupName.PIZZA)?.multiplier) || 1;
    const saladMult = Number(statByBox.get(groupName.SALAD)?.multiplier) || 1;
    console.log("Group Totals / Multipliers");
    console.table([
      { group: groupName.PIZZA, totalAmount: pizzaTotal, bettorsCount: pizzaCount, multiplier: pizzaMult },
      { group: groupName.SALAD, totalAmount: saladTotal, bettorsCount: saladCount, multiplier: saladMult },
    ]);

    for (const s of round.boxStats) {
      if (s.box === groupName.PIZZA) {
        s.totalAmount  = pizzaTotal;
        s.bettorsCount = pizzaCount;
      } else if (s.box === groupName.SALAD) {
        s.totalAmount  = saladTotal;
        s.bettorsCount = saladCount;
      } else {
        s.totalAmount  = perBoxTotal.get(s.box) || 0;
        s.bettorsCount = perBoxCount.get(s.box) || 0;
      }
    }
    await round.save();

    // ---- Company cut & funds ----- //
    const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0.1));
    round.companyCut = companyCut;
    const distributableAmount = totalPool - companyCut;
    const availableFunds = distributableAmount + companyWallet.reserveWallet;

    console.log("Funds Snapshot");
    console.table([{ totalPool, companyCut, distributableAmount, reserveWallet: companyWallet.reserveWallet, availableFunds }]);

    // ---- Eligibility (GROUP-AWARE) ------ //
    const groupRequiredPayout = (members: Set<string>, groupMult: number) => {
      let groupSum = 0;
      let subBoxComponent = 0;
      for (const b of bets) {
        if (members.has(b.box)) {
          groupSum += b.amount;
          const subMult = Number(statByBox.get(b.box)?.multiplier) || 1;
          subBoxComponent += b.amount * subMult;
        }
      }
      return { required: groupSum * groupMult + subBoxComponent, groupSum, subBoxComponent };
    };

    // per-box required payouts (normal boxes)
    const normalRequiredRows: Array<{ box: string; boxTotal: number; multiplier: number; required: number }> = [];
    for (const s of round.boxStats) {
      if (s.box === groupName.PIZZA || s.box === groupName.SALAD) continue;
      const mult = Number(s.multiplier) || 1;
      const boxTotal = perBoxTotal.get(s.box) || 0;
      normalRequiredRows.push({ box: s.box, boxTotal, multiplier: mult, required: boxTotal * mult });
    }
    console.log("Required Payout (Normal Boxes)");
    console.table(normalRequiredRows);

    // group required payout breakdowns
    const pizzaReq = groupRequiredPayout(pizzaMembers, pizzaMult);
    const saladReq = groupRequiredPayout(saladMembers, saladMult);

    console.log("Required Payout (Groups)");
    console.table([
      { group: groupName.PIZZA, groupSum: pizzaReq.groupSum, subBoxComponent: pizzaReq.subBoxComponent, groupMult: pizzaMult, required: pizzaReq.required },
      { group: groupName.SALAD, groupSum: saladReq.groupSum, subBoxComponent: saladReq.subBoxComponent, groupMult: saladMult, required: saladReq.required },
    ]);

    // Collect candidates with exact required payout
    const candidates: { box: string; required: number }[] = [];
    for (const s of round.boxStats) {
      const box = s.box;
      if (box === groupName.PIZZA) {
        if (pizzaReq.required <= availableFunds) candidates.push({ box, required: pizzaReq.required });
      } else if (box === groupName.SALAD) {
        if (saladReq.required <= availableFunds) candidates.push({ box, required: saladReq.required });
      } else {
        const mult = Number(s.multiplier) || 1;
        const boxTotal = perBoxTotal.get(box) || 0;
        const required = boxTotal * mult;
        if (required <= availableFunds) candidates.push({ box, required });
      }
    }

    console.log("Eligible Candidates vs Available Funds");
    console.table(candidates);
    console.log(`Available funds: ${availableFunds}`);

    // ---- Choose winner from eligible candidates ----- //
    let winnerBox: string | null = null;
    if (candidates.length > 0) {
      winnerBox = candidates[Math.floor(Math.random() * candidates.length)].box;
    }
    console.log("Chosen Winner:", winnerBox ?? "(none)");

    // No eligible winner -> move distributable to reserve and finish
    if (!winnerBox) {
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction(
        transactionType.RESERVE_DEPOSIT,
        distributableAmount,
        "No eligible winner, moved to reserve wallet"
      );

      await writeCompanyLedger({
        type: transactionType.RESERVE_DEPOSIT,
        roundId: String(round._id),
        delta: +distributableAmount,
        balanceAfter: companyWallet.reserveWallet,
        meta: { reason: "No eligible winner (move distributable to reserve)" }
      });

      round.winningBox = null;
      round.distributedAmount = 0;
      round.topWinners = [];
      round.roundStatus = ROUND_STATUS.COMPLETED;
      await round.save();

      nsp.emit(EMIT.ROUND_ENDED, {
        _id: round._id,
        roundNumber: round.roundNumber,
        totalPool,
        companyCut,
        distributedAmount: 0,
        reserveWallet: companyWallet.reserveWallet,
        roundStatus: ROUND_STATUS.COMPLETED,
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
      console.log("=== ROUND DEBUG END (no eligible winner) ===");
      setTimeout(() => startNewRound(nsp), prepareDuration);
      return;
    }

    // ---- Compute payouts (GROUP-AWARE) ----- //
    let payouts: PayoutRow[] = [];
    let totalPayout = 0;

    const payNormalBox = (box: string) => {
      const mult = Number(statByBox.get(box)?.multiplier) || 1;
      for (const b of bets) {
        if (b.box === box) {
          const amt = b.amount * mult;
          payouts.push({ userId: new Types.ObjectId(b.userId), box: b.box, amount: amt });
          totalPayout += amt;
        }
      }
    };

    // For Pizza/Salad: sub-box payout (amount×subBoxMult) + group bonus (userGroupSum×groupMult)
    const payGroupBox = (members: Set<string>, groupMult: number, groupLabel: string) => {
      const perUserGroupSum = new Map<string, number>();
      const perUserSubPayout = new Map<string, number>();

      for (const b of bets) {
        if (!members.has(b.box)) continue;
        const uid = String(b.userId);
        const subMult = Number(statByBox.get(b.box)?.multiplier) || 1;
        perUserGroupSum.set(uid, (perUserGroupSum.get(uid) || 0) + b.amount);
        perUserSubPayout.set(uid, (perUserSubPayout.get(uid) || 0) + (b.amount * subMult));
      }

      // DEBUG per-user group components
      const dbgRows: any[] = [];
      for (const [uid, groupSum] of perUserGroupSum.entries()) {
        const subPart = perUserSubPayout.get(uid) || 0;
        const groupBonus = groupSum * groupMult;
        const totalForUser = subPart + groupBonus;
        dbgRows.push({ userId: uid, groupSum, subBoxPayout: subPart, groupBonus, totalForUser });
        payouts.push({ userId: new Types.ObjectId(uid), box: groupLabel, amount: totalForUser });
        totalPayout += totalForUser;
      }
      console.log(`Per-User Payout Breakdown for ${groupLabel}`);
      console.table(dbgRows);
    };

    if (winnerBox === groupName.PIZZA) {
      payGroupBox(pizzaMembers, pizzaMult, groupName.PIZZA);
    } else if (winnerBox === groupName.SALAD) {
      payGroupBox(saladMembers, saladMult, groupName.SALAD);
    } else {
      payNormalBox(winnerBox);
    }

    // Double-check funds (should match eligibility)
    if (totalPayout > availableFunds) {
      console.warn("Post-calc payout exceeded available funds. Moving distributable to reserve.");
      companyWallet.reserveWallet += distributableAmount;
      await companyWallet.save();
      await logTransaction(
        transactionType.RESERVE_DEPOSIT,
        distributableAmount,
        "Insufficient funds post-calc; moved to reserve"
      );

      await writeCompanyLedger({
        type: transactionType.RESERVE_DEPOSIT,
        roundId: String(round._id),
        delta: +distributableAmount,
        balanceAfter: companyWallet.reserveWallet,
        meta: { reason: "Insufficient funds after calc" }
      });

      round.winningBox = null;
      round.distributedAmount = 0;
      round.topWinners = [];
      round.roundStatus = ROUND_STATUS.COMPLETED;
      await round.save();

      nsp.emit(EMIT.ROUND_ENDED, {
        _id: round._id,
        roundNumber: round.roundNumber,
        totalPool,
        companyCut,
        distributedAmount: 0,
        reserveWallet: companyWallet.reserveWallet,
        roundStatus: ROUND_STATUS.COMPLETED,
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

      console.log("=== ROUND DEBUG END (insufficient after calc) ===");
      setTimeout(() => startNewRound(nsp), prepareDuration);
      return;
    }

    // ---- Top winners + snapshot ----- //
    const winByUser = new Map<string, number>();
    for (const p of payouts) {
      const k = String(p.userId);
      winByUser.set(k, (winByUser.get(k) || 0) + p.amount);
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

    console.log("Snapshot Saved");
    console.table([{ winnerBox, distributedAmount: totalPayout, companyCut }]);
    console.log("Top Winners");
    console.table(topWinners.map(t => ({ userId: String(t.userId), amountWon: t.amountWon })));

    try {

    const gameId = "66f3b5c2e5f8f2d456789012";
      await logRoundEvent({
      gameId: gameId,         
      roundId: String(round._id),
      gameName: "Ferry Wheel",
      identification: `Round #${round.roundNumber}`,
      consumption: totalPool,
      rewardAmount: totalPayout,
      platformRevenue: companyCut,
      gameVictoryResult: winnerBox ?? "",
      date: new Date(),
    });
    } catch (error) {
      console.log("Smothing wrong..")
    }

    // ---- Reveal ---- //
    nsp.emit(EMIT.ROUND_UPDATED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
      roundStatus: ROUND_STATUS.REVEALING,
    });

    await sleep(prepareDuration);

    nsp.emit(EMIT.WINNER_REVEALED, {
      _id: round._id,
      roundNumber: round.roundNumber,
      winnerBox,
      totalPayout: round.distributedAmount,
      roundStatus: ROUND_STATUS.REVEALED,
    });

    await sleep(revealDuration);

    // ---- Apply payouts once (idempotent) ---- //
    const fresh = await Round.findOneAndUpdate(
      { _id: round._id, payoutsApplied: { $ne: true } },
      { $set: { payoutsApplied: true } },
      { new: true, projection: { pendingPayouts: 1 } }
    ).lean();

    if (fresh) {
      let reserveUsed = 0;
      if (totalPayout > distributableAmount) {
        reserveUsed = totalPayout - distributableAmount;
        companyWallet.reserveWallet -= reserveUsed;
        await companyWallet.save();
        await logTransaction("reserveWithdraw", reserveUsed, "Used reserve wallet to cover payout");

        // company ledger: reserve withdraw
        await writeCompanyLedger({
          type: transactionType.RESERVE_WITHDRAW,
          roundId: String(round._id),
          delta: -reserveUsed,
          balanceAfter: companyWallet.reserveWallet,
          meta: { reason: "Cover payout from reserve" }
        });
      }

      // Credit winners (private emits) + user ledger
      for (const p of payouts) {
        const updated = await UserService.updateBalance(String(p.userId), p.amount);

        // user ledger: payout
        await WalletLedger.create({
          entityTypes: "user",
          entityId: String(p.userId),
          roundId: String(round._id),
          betId: undefined,
          type: transactionType.PAYOUT,
          delta: +p.amount,
          balanceAfter: updated.balance,
          metaData: { box: p.box, reason: "round payout" },
        });

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

      // Treasury: company cut + leftover distributable
      const remainingDistributable = distributableAmount - (totalPayout - reserveUsed);
      await addRoundFunds(companyCut, remainingDistributable);
      round.reserveWallet = remainingDistributable;
      await round.save();
      await logTransaction("companyCut", companyCut, "Company cut from pool");

      // refresh wallet snapshot if addRoundFunds changes balances
      const freshCompany = await getCompanyWallet();

      // company ledger: company cut
      await writeCompanyLedger({
        type: transactionType.COMPANY_CUT,
        roundId: String(round._id),
        delta: +companyCut,
        balanceAfter: freshCompany.balance ?? 0, // if you don't track balance, keep 0 and rely on meta
        meta: { reason: "Company cut from pool" }
      });

      // company ledger: leftover distributable -> reserve deposit
      await writeCompanyLedger({
        type: transactionType.RESERVE_DEPOSIT,
        roundId: String(round._id),
        delta: +remainingDistributable,
        balanceAfter: freshCompany.reserveWallet,
        meta: { reason: "Leftover distributable moved to reserve" }
      });

      console.log("Treasury Settlement");
      console.table([{ reserveUsed, remainingDistributable, newReserveWallet: freshCompany.reserveWallet }]);
    }

    // ---- End round (public) ---- //
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

    // Reset & next
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
    nsp.emit(EMIT.USER_PERBOX_TOTAL, { roundId: "", userId: "", userPerBoxTotal: [] });

    console.log("=== ROUND DEBUG END (success) ===");
    setTimeout(() => startNewRound(nsp), prepareDuration);
  } catch (err) {
    console.error("❌ Failed to end round:", err);
  }
};
