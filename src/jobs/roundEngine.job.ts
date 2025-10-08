import { Namespace } from "socket.io";
import { SettingsService } from "../modules/settings/settings.service";
import { MetService } from "../modules/met/met.service";
import { UserService } from "../modules/user/user.service";
import Round, { ROUND_STATUS } from "../modules/round/round.model";
import { Types } from "mongoose";
import { env } from "../config/env";
import { computeRoundResults, getBetsByRound } from './../modules/bet/bet.service';
import { addRoundFunds, logTransaction } from "../modules/company/company.service";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to handle errors more effectively
const handleError = (error: any, nsp: Namespace, roundId: string) => {
  console.error("❌ Error:", error);
  nsp.emit("roundError", { roundId, message: error.message });
};


export const startNewRound = async (nsp: Namespace): Promise<void> => {
  try {
    const settings = await SettingsService.getSettings();
    const raw = settings.roundDuration ?? env.ROUND_DURATION;
    const durationMs = raw > 1000 ? raw : raw * 1000;

    const roundNumber = await MetService.incrementRoundCounter();
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMs);
    const boxes = await SettingsService.getInitialBoxes();

    const round = await Round.create({
      roundNumber,
      startTime,
      endTime,
      boxes,
      totalPool: 0,
      companyCut: 0,
      distributedAmount: 0,
      reserveWallet: 0,  // New reserve wallet amount
      boxStats: boxes.map((b) => ({
        box: b.title,
        title: b.title,
        icon: b.icon,
        multiplier: b.multiplier,
        totalAmount: 0,
        bettorsCount: 0,
      })),
      roundStatus: "betting",
    });

    await MetService.setCurrentRound(round._id.toString());

    // Emit the round started event
    nsp.emit("roundStarted", {
      _id: round._id,
      roundNumber,
      startTime,
      endTime,
      boxes,
    });

    // Emit phase update event
    nsp.emit("phaseUpdate", {
      phase: "betting",
      phaseEndTime: new Date(Date.now() + durationMs),
    });

    // Wait for the betting phase to finish
    await sleep(durationMs);

    // End the round and prepare for the next phase
    await endRound(round._id.toString(), nsp);
  } catch (err) {
    console.error("❌ Failed to start new round:", err);
  }
};


// export const endRound = async (roundId: string, nsp: Namespace): Promise<void> => {
//   try {
//     const settings = await SettingsService.getSettings();
//     const round = await Round.findById(roundId);

//     if (!round) {
//       console.warn("⚠️ Round not found:", roundId);
//       return;
//     }

//     // Close the betting phase
//     round.roundStatus = ROUND_STATUS.CLOSED;
//     await round.save();

//     // Emit round close event
//     nsp.emit("roundClosed", {
//       _id: round._id,
//       roundNumber: round.roundNumber,
//     });

//     // Gather bets and calculate total pool
//     const bets = await getBetsByRound(round._id);
//     const totalPool = bets.reduce((s, b) => s + b.amount, 0);
//     round.totalPool = totalPool;
//     console.log("totalPool: ", totalPool);

//     // Calculate company cut (10%)
//     const companyCut = Math.floor(totalPool * 0.1);
//     round.companyCut = companyCut;

//     // Distribute 90% to winners, store the remaining in reserve wallet
//     const distributable = totalPool * 0.9;
//     console.log("distributable: ", distributable);
//     let remainingToDistribute = distributable;

//     // If the amount cannot be distributed fully, store it in the reserve wallet
//     if (remainingToDistribute < totalPool) {
//       round.reserveWallet = Number(round.reserveWallet) + (totalPool - remainingToDistribute);
//       remainingToDistribute = totalPool - Number(round.reserveWallet);
//     }{
//       round.reserveWallet = Number(round.reserveWallet) + remainingToDistribute;
//     }

//     // Update the round with the distributed amount
//     round.distributedAmount = remainingToDistribute;

//     // Company Wallet 
//     await addRoundFunds(companyCut, Number(round.reserveWallet));


//     // Compute winners and payouts
//     const { winnerBox, payouts } = await computeRoundResults(round, bets as any, remainingToDistribute);

//     // Credit each winner and update balance
//     const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
//     for (const p of payouts) {
//       const updated = await UserService.updateBalance(p.userId, p.amount);

//       nsp.to(`user:${p.userId}`).emit("payout", {
//         roundId: round._id,
//         winnerBox,
//         amount: p.amount,
//         newBalance: updated.balance,
//       });

//       topWinners.push({
//         userId: new Types.ObjectId(p.userId),
//         amountWon: p.amount,
//       });

//       nsp.to(`user:${p.userId}`).emit("balance:update", {
//         balance: updated.balance,
//         delta: p.amount,
//         reason: "payout",
//         roundId: round._id,
//       });
//     }

//     // Update round with winners and final stats
//     round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
//     round.winningBox = winnerBox;

//     // Save the round state
//     await round.save();

//     console.log(round)

//     // Emit final round data
//     nsp.emit("roundUpdated", {
//       _id: round._id,
//       roundNumber: round.roundNumber,
//       boxStats: round.boxStats,
//     });

//     // Announce results
//     nsp.emit("winnerRevealed", {
//       _id: round._id,
//       roundNumber: round.roundNumber,
//       winnerBox,
//       payouts: payouts.map((p) => ({ userId: p.userId, amount: p.amount })),
//       topWinners: round.topWinners,
//     });

//     nsp.emit("roundEnded", {
//       _id: round._id,
//       roundNumber: round.roundNumber,
//       totalPool,
//       companyCut,
//       distributedAmount: round.distributedAmount,
//     });

//     // Prepare for the next round (with a delay)
//     setTimeout(() => startNewRound(nsp), 5000);

//   } catch (err) {
//     console.error("❌ Failed to end round:", err);
//   }
// };




export const endRound = async (roundId: string, nsp: Namespace): Promise<void> => {
  try {
    const settings = await SettingsService.getSettings();
    const round = await Round.findById(roundId);

    if (!round) return console.warn("Round not found:", roundId);

    // Close betting
    round.roundStatus = ROUND_STATUS.CLOSED;
    await round.save();

    nsp.emit("roundClosed", { _id: round._id, roundNumber: round.roundNumber });

    // Gather bets
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((s, b) => s + b.amount, 0);
    round.totalPool = totalPool;

    // Company cut (10%)
    const companyCut = Math.floor(totalPool * 0.1);
    round.companyCut = companyCut;

    // Distributable amount (90% of the pool)
    let distributableAmount = totalPool - companyCut;

    // Compute winners and payouts
    const { winnerBox, payouts } = await computeRoundResults(round, bets, distributableAmount);

    // If no winner, move all to reserve wallet
    if (payouts.length === 0) {
      round.reserveWallet = Number(round.reserveWallet) + distributableAmount;
      distributableAmount = 0;
      await logTransaction('reserveDeposit', distributableAmount, 'No winner, moved to reserve wallet');
    } else {
      // Handle payouts and update reserve wallet if needed
      const totalPayout = payouts.reduce((s, p) => s + p.amount, 0);
      if (totalPayout > distributableAmount + Number(round.reserveWallet)) {
        const deficit = totalPayout - distributableAmount;
        if (deficit <= Number(round.reserveWallet)) {
          round.reserveWallet = Number(round.reserveWallet) - deficit;
          distributableAmount += deficit;
          await logTransaction('reserveWithdraw', deficit, 'Covered payout from reserve wallet');
        } else {
          const scale = (distributableAmount + Number(round.reserveWallet)) / totalPayout;
          payouts.forEach((p) => (p.amount = Math.floor(p.amount * scale)));
          round.reserveWallet = 0;
          await logTransaction('reserveWithdraw', Number(round.reserveWallet), 'Scaled payouts due to insufficient funds');
        }
      } else {
        // No scaling required, payout fully from distributableAmount
        round.reserveWallet = 0;
      }
    }

    // Add company cut to company wallet and log the transaction
    await addRoundFunds(companyCut, Number(round.reserveWallet));
    await logTransaction('companyCut', companyCut, 'Company cut from pool');

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

      topWinners.push({ userId: new Types.ObjectId(p.userId), amountWon: p.amount });
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

    // Emit round results
    nsp.emit("roundUpdated", { _id: round._id, roundNumber: round.roundNumber, boxStats: round.boxStats });
    nsp.emit("winnerRevealed", { _id: round._id, roundNumber: round.roundNumber, winnerBox, payouts, topWinners: round.topWinners });
    nsp.emit("roundEnded", { _id: round._id, roundNumber: round.roundNumber, totalPool, companyCut, distributedAmount: round.distributedAmount });

    // Start next round
    setTimeout(() => startNewRound(nsp), 5000);
  } catch (err) {
    console.error("Failed to end round:", err);
  }
};
