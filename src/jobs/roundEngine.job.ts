// import { Types } from "mongoose";
// import type { Namespace } from "socket.io";
// import Round, { ROUND_STATUS } from "../modules/round/round.model";
// import { SettingsService } from "../modules/settings/settings.service";
// import { BetService } from "../modules/bet/bet.service";
// import { UserService } from "../modules/user/user.service";
// import { MetService } from "../modules/met/met.service";
// import { env } from "../config/env";

// Version-001
// export class RoundEngineJob {
//   private nsp: Namespace;
//   private isRunning = false;

//   constructor(nsp: Namespace) {
//     this.nsp = nsp;
//   }

//   async startNewRound(): Promise<void> {
//     if (this.isRunning) return;
//     this.isRunning = true;

//     try {
//       const settings = await SettingsService.getSettings();

//       // Accept either seconds or milliseconds from settings
//       const raw = settings.roundDuration ?? env.ROUND_DURATION;
//       const durationMs = raw > 1000 ? raw : raw * 1000;

//       const roundNumber = await MetService.incrementRoundCounter();

//       const startTime = new Date();
//       const endTime = new Date(startTime.getTime() + durationMs);
//       const boxes = await SettingsService.getInitialBoxes();

//       const round = await Round.create({
//         roundNumber,
//         startTime,
//         endTime,
//         boxes,
//         totalPool: 0,
//         companyCut: 0,
//         distributedAmount: 0,
//         bets: [],
//         boxStats: boxes.map((b) => ({
//           box: b.title,
//           title: b.title,
//           icon: b.icon,
//           multiplier: b.multiplier,
//           totalAmount: 0,
//           bettorsCount: 0,
//         })),
//         topWinners: [],
//         roundStatus: "betting",
//       });

//       await MetService.setCurrentRound(round._id.toString());

//       this.nsp.emit("roundStarted", {
//         _id: round._id,
//         roundNumber,
//         startTime,
//         endTime,
//         boxes,
//       });



//       setTimeout(() => this.endRound(round._id.toString()), durationMs);
//     } catch (err) {
//       console.error("❌ Failed to start new round:", err);
//       this.isRunning = false;
//     }
//   }

//   async endRound(roundId: string): Promise<void> {
//     try {
     
    
//       const [settings, round] = await Promise.all([SettingsService.getSettings(), Round.findById(roundId)]);

//       const raw = settings.roundDuration ?? env.ROUND_DURATION;
//       const durationMs = raw > 1000 ? raw : raw * 1000;
//       const startTime = new Date();
//       const endTime = new Date(startTime.getTime() + durationMs);


//       if (!round) {
//         console.warn("⚠️ Round not found:", roundId);
//         this.isRunning = false;
//         return;
//       }

//       // Close betting phase
//       round.roundStatus = ROUND_STATUS.CLOSED;
//       round.endTime = new Date(endTime.getTime() + 5000);
//       await round.save();

//       this.nsp.emit("roundClosed", {
//         _id: round._id,
//         roundNumber: round.roundNumber,
//       });


//       // Gather bets and pools
//       const bets = await BetService.getBetsByRound(round._id);

//       const totalPool = bets.reduce((s, b) => s + b.amount, 0);
//       round.totalPool = totalPool;

//       // commissionRate is 0..1 in your schema
//       const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0));
//       const distributable = totalPool - companyCut;
//       round.companyCut = companyCut;

//       // Compute winners and payouts
//       const { winnerBox, payouts } = await BetService.computeRoundResults(
//         round,
//         bets as any,
//         distributable
//       );

//       // Credit each winner, then PUSH updated balances in real time
//       const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
//       for (const p of payouts) {
//         const updated = await UserService.updateBalance(p.userId, p.amount);

//         this.nsp.to(`user:${p.userId}`).emit("payout", {
//           roundId: round._id,
//           winnerBox,
//           amount: p.amount,
//           newBalance: updated.balance,
//         });

//         topWinners.push({
//           userId: new Types.ObjectId(p.userId),
//           amountWon: p.amount,
//         });

//         // Also emit the balance update to other tabs/devices of the same user
//         this.nsp.to(`user:${p.userId}`).emit("balance:update", {
//           balance: updated.balance,
//           delta: p.amount,
//           reason: "payout",
//           roundId: round._id,
//         });
//       }
//       round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);

//       round.winningBox = winnerBox;
//       round.distributedAmount = payouts.reduce((s, p) => s + p.amount, 0);
//       round.roundStatus = "completed";

//       // Refresh box stats
//       round.boxStats = round.boxStats.map((stat) => {
//         const boxBets = bets.filter((b) => b.box === stat.box);
//         return {
//           box: stat.box,
//           title: stat.title,
//           icon: stat.icon,
//           multiplier: stat.multiplier,
//           totalAmount: boxBets.reduce((s, b) => s + b.amount, 0),
//           bettorsCount: boxBets.length,
//         };
//       });

//       await round.save();

//       // Emit final round data to all clients
//       this.nsp.emit("roundUpdated", {
//         _id: round._id,
//         roundNumber: round.roundNumber,
//         boxStats: round.boxStats,
//       });

//       // Announce results
//       this.nsp.emit("winnerRevealed", {
//         _id: round._id,
//         roundNumber: round.roundNumber,
//         winnerBox,
//         payouts: payouts.map((p) => ({ userId: p.userId, amount: p.amount })),
//         topWinners: round.topWinners,
//       });

//       this.nsp.emit("roundEnded", {
//         _id: round._id,
//         roundNumber: round.roundNumber,
//         totalPool,
//         companyCut,
//         distributedAmount: round.distributedAmount,
//       });

//       await MetService.clearCurrentRound();

//       this.isRunning = false;
//       setTimeout(() => this.startNewRound(), 5000);
//     } catch (err) {
//       console.error("❌ Failed to end round:", err);
//       this.isRunning = false;
//     }
//   }
// }

// Verion-002
// export const ROUND_PHASE = {
//   BETTING: "betting",
//   REVEAL: "reveal",
//   PREPARE: "prepare",
// } as const;

// export type RoundPhase = (typeof ROUND_PHASE)[keyof typeof ROUND_PHASE];

// export class RoundEngineJob {
//   private nsp: Namespace;
//   private isRunning = false;

//   constructor(nsp: Namespace) {
//     this.nsp = nsp;
//   }

//   private sleep(ms: number) {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }

//   /** Entry point to start the round loop */
//   async startNewRound(): Promise<void> {
//     if (this.isRunning) return;
//     this.isRunning = true;

//     try {
//       // const settings = await SettingsService.getSettings();
//       // const boxes = await SettingsService.getInitialBoxes();
//       // const roundNumber = await MetService.incrementRoundCounter();
//       const [settings, boxes, roundNumber] = await Promise.all([SettingsService.getSettings(), SettingsService.getInitialBoxes(), MetService.incrementRoundCounter()])

//       const round = await this.createRound(roundNumber, boxes, settings);
//       await MetService.setCurrentRound(round._id.toString());

//       // Run phases sequentially
//       await this.runPhase(round, ROUND_PHASE.BETTING, settings.bettingDuration ?? 30_000);
//       await this.runPhase(round, ROUND_PHASE.REVEAL, settings.revealDuration ?? 5_000);
//       await this.runPhase(round, ROUND_PHASE.PREPARE, settings.prepareDuration ?? 5_000);

//       this.isRunning = false;
//       this.startNewRound(); // loop next round
//     } catch (err) {
//       console.error("❌ Failed to start new round:", err);
//       this.isRunning = false;
//     }
//   }

//   /** Creates a new round document and emits it */
//   private async createRound(roundNumber: number, boxes: any[], settings: any) {
//     const round = await Round.create({
//       roundNumber,
//       startTime: new Date(),
//       endTime: new Date(Date.now() + (settings.bettingDuration ?? 30_000)),
//       boxes,
//       totalPool: 0,
//       companyCut: 0,
//       distributedAmount: 0,
//       bets: [],
//       boxStats: boxes.map((b) => ({
//         box: b.title,
//         title: b.title,
//         icon: b.icon,
//         multiplier: b.multiplier,
//         totalAmount: 0,
//         bettorsCount: 0,
//       })),
//       topWinners: [],
//       roundStatus: ROUND_STATUS.BETTING,
//     });

//     this.nsp.emit("roundStarted", round);
//     return round;
//   }

//   /** Executes a phase: betting, reveal, or prepare */
//   private async runPhase(round: any, phase: RoundPhase, durationMs: number) {
//     const phaseEndTime = new Date(Date.now() + durationMs);

//     this.nsp.emit("phaseUpdate", { phase, phaseEndTime });

//     switch (phase) {
//       case ROUND_PHASE.BETTING:
//         await this.sleep(durationMs);
//         await this.closeBetting(round);
//         break;

//       case ROUND_PHASE.REVEAL:
//         await this.revealResults(round);
//         await this.sleep(durationMs);
//         break;

//       case ROUND_PHASE.PREPARE:
//         await this.sleep(durationMs);
//         break;
//     }
//   }

//   /** Close betting phase */
//   private async closeBetting(round: any) {
//     round.roundStatus = ROUND_STATUS.CLOSED;
//     await round.save();

//     this.nsp.emit("roundClosed", { _id: round._id, roundNumber: round.roundNumber });
//   }

//   /** Reveal results, calculate payouts, and update balances */
//   private async revealResults(round: any) {
//     const settings = await SettingsService.getSettings();
//     const bets = await BetService.getBetsByRound(round._id);

//     const totalPool = bets.reduce((s, b) => s + b.amount, 0);
//     const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0));
//     const distributable = totalPool - companyCut;

//     const { winnerBox, payouts } = await BetService.computeRoundResults(round, bets as any, distributable);

//     const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];

//     for (const p of payouts) {
//       const updated = await UserService.updateBalance(p.userId, p.amount);

//       this.nsp.to(`user:${p.userId}`).emit("payout", {
//         roundId: round._id,
//         winnerBox,
//         amount: p.amount,
//         newBalance: updated.balance,
//       });

//       this.nsp.to(`user:${p.userId}`).emit("balance:update", {
//         balance: updated.balance,
//         delta: p.amount,
//         reason: "payout",
//         roundId: round._id,
//       });

//       topWinners.push({ userId: new Types.ObjectId(p.userId), amountWon: p.amount });
//     }

//     round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
//     round.winningBox = winnerBox;
//     round.distributedAmount = payouts.reduce((s, p) => s + p.amount, 0);
//     round.roundStatus = ROUND_STATUS.COMPLETED;

//     // Refresh box stats
//     round.boxStats = round.boxStats.map((stat) => {
//       const boxBets = bets.filter((b) => b.box === stat.box);
//       return {
//         ...stat,
//         totalAmount: boxBets.reduce((s, b) => s + b.amount, 0),
//         bettorsCount: boxBets.length,
//       };
//     });

//     await round.save();

//     // Emit final round data
//     this.nsp.emit("roundUpdated", { _id: round._id, roundNumber: round.roundNumber, boxStats: round.boxStats });
//     this.nsp.emit("winnerRevealed", { _id: round._id, roundNumber: round.roundNumber, winnerBox, payouts });
//     this.nsp.emit("roundEnded", {
//       _id: round._id,
//       roundNumber: round.roundNumber,
//       totalPool,
//       companyCut,
//       distributedAmount: round.distributedAmount,
//     });

//     await MetService.clearCurrentRound();
//   }
// }


// Helper function for delay


import { Namespace } from "socket.io";
import { SettingsService } from "../modules/settings/settings.service";
import { MetService } from "../modules/met/met.service";
import { UserService } from "../modules/user/user.service";
import Round, { ROUND_STATUS } from "../modules/round/round.model";
import { Types } from "mongoose";
import { env } from "../config/env";
import { computeRoundResults, getBetsByRound } from './../modules/bet/bet.service';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to handle errors more effectively
const handleError = (error: any, nsp: Namespace, roundId: string) => {
  console.error("❌ Error:", error);
  nsp.emit("roundError", { roundId, message: error.message });
};


// export const startNewRound = async (nsp: Namespace): Promise<void> => {
//   try {
//     const settings = await SettingsService.getSettings();
//     const raw = settings.roundDuration ?? env.ROUND_DURATION;
//     const durationMs = raw > 1000 ? raw : raw * 1000;

//     const roundNumber = await MetService.incrementRoundCounter();
//     const startTime = new Date();
//     const endTime = new Date(startTime.getTime() + durationMs);
//     const boxes = await SettingsService.getInitialBoxes();

//     const round = await Round.create({
//       roundNumber,
//       startTime,
//       endTime,
//       boxes,
//       totalPool: 0,
//       companyCut: 0,
//       distributedAmount: 0,
//       bets: [],
//       boxStats: boxes.map((b) => ({
//         box: b.title,
//         title: b.title,
//         icon: b.icon,
//         multiplier: b.multiplier,
//         totalAmount: 0,
//         bettorsCount: 0,
//       })),
//       topWinners: [],
//       roundStatus: "betting",  // "betting" phase status
//     });

//     await MetService.setCurrentRound(round._id.toString());

//     // Emit round started
//     nsp.emit("roundStarted", {
//       _id: round._id,
//       roundNumber,
//       startTime,
//       endTime,
//       boxes,
//     });

//     // Emit phase update (betting phase)
//     nsp.emit("phaseUpdate", {
//       phase: "betting",
//       phaseEndTime: new Date(Date.now() + durationMs),
//     });

//     // Wait for betting phase to finish
//     await sleep(durationMs); // Simulate waiting for betting phase to finish

//     // End the round and prepare for the next phase
//     await endRound(round._id.toString(), nsp);
//   } catch (err) {
//     console.error("❌ Failed to start new round:", err);
//   }
// };



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


export const endRound = async (roundId: string, nsp: Namespace): Promise<void> => {
  try {
    const settings = await SettingsService.getSettings();
    const round = await Round.findById(roundId);

    if (!round) {
      console.warn("⚠️ Round not found:", roundId);
      return;
    }

    // Close the betting phase
    round.roundStatus = ROUND_STATUS.CLOSED;
    await round.save();

    // Emit round close event
    nsp.emit("roundClosed", {
      _id: round._id,
      roundNumber: round.roundNumber,
    });

    // Gather bets and calculate total pool
    const bets = await getBetsByRound(round._id);
    const totalPool = bets.reduce((s, b) => s + b.amount, 0);
    round.totalPool = totalPool;

    // Calculate company cut (10%)
    const companyCut = Math.floor(totalPool * 0.1);
    round.companyCut = companyCut;

    // Distribute 90% to winners, store the remaining in reserve wallet
    const distributable = totalPool * 0.9;
    let remainingToDistribute = distributable;

// If the amount cannot be distributed fully, store it in the reserve wallet
if (remainingToDistribute < totalPool) {
  // Ensure that reserveWallet is treated as a primitive number
  round.reserveWallet = Number(round.reserveWallet) + (totalPool - remainingToDistribute);
  remainingToDistribute = totalPool - Number(round.reserveWallet);  // Ensure it's a primitive number
}

    // Update the round with the distributed amount
    round.distributedAmount = remainingToDistribute;

    // Compute winners and payouts
    const { winnerBox, payouts } = await computeRoundResults(round, bets as any, remainingToDistribute);

    // Credit each winner and update balance
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

    // Update round with winners and final stats
    round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
    round.winningBox = winnerBox;

    // Save the round state
    await round.save();

    // Emit final round data
    nsp.emit("roundUpdated", {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
    });

    // Announce results
    nsp.emit("winnerRevealed", {
      _id: round._id,
      roundNumber: round.roundNumber,
      winnerBox,
      payouts: payouts.map((p) => ({ userId: p.userId, amount: p.amount })),
      topWinners: round.topWinners,
    });

    nsp.emit("roundEnded", {
      _id: round._id,
      roundNumber: round.roundNumber,
      totalPool,
      companyCut,
      distributedAmount: round.distributedAmount,
    });

    console.log(round)

    // Prepare for the next round (with a delay)
    setTimeout(() => startNewRound(nsp), 5000);

  } catch (err) {
    console.error("❌ Failed to end round:", err);
  }
};
