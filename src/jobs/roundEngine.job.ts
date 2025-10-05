// import { Types } from "mongoose";
// import type { Namespace } from "socket.io";
// import Round, { IRoundBox } from "../modules/round/round.model";
// import { SettingsService } from "../modules/settings/settings.service";
// import { BetService } from "../modules/bet/bet.service";
// import { UserService } from "../modules/user/user.service";
// import { MetService } from "../modules/met/met.service";

// interface IPayout { userId: string; amount: number; box: string; }

// export class RoundEngineJob {
//   private nsp: Namespace;
//   private isRunning = false;

//   constructor(nsp: Namespace) { this.nsp = nsp; }

//   private async createRoundWithRetry(boxes: IRoundBox[], durationSec: number, maxRetries = 5) {
//     let attempt = 0;
//     while (attempt++ < maxRetries) {
//       const roundNumber = await MetService.incrementRoundCounter();
//       const startTime = new Date();
//       const endTime = new Date(startTime.getTime() + durationSec * 1000);

//       try {
//         return await Round.create({
//           roundNumber, startTime, endTime, boxes,
//           totalPool: 0, companyCut: 0, distributedAmount: 0,
//           bets: [],
//           boxStats: boxes.map((b) => ({ box: b.title, totalAmount: 0, bettorsCount: 0 })),
//           topWinners: [],
//           roundStatus: "betting",
//         });
//       } catch (e: any) {
//         if (e?.code === 11000 && e?.keyPattern?.roundNumber) {
//           console.warn(`E11000 on roundNumber=${roundNumber}, retrying (${attempt}/${maxRetries})`);
//           continue;
//         }
//         throw e;
//       }
//     }
//     throw new Error("Failed to create round due to repeated duplicate keys");
//   }

//   async startNewRound(): Promise<void> {
//     if (this.isRunning) return;
//     this.isRunning = true;

//     try {
//       const settings = await SettingsService.getSettings();
//       const durationSec = settings.roundDuration || 60;
//       const boxes = await SettingsService.getInitialBoxes();

//       const round = await this.createRoundWithRetry(boxes, durationSec);
//       await MetService.setCurrentRound(round._id.toString());

//       this.nsp.emit("roundStarted", {
//         _id: round._id, roundNumber: round.roundNumber, startTime: round.startTime, endTime: round.endTime, boxes,
//       });

//       console.log(`🟢 Round #${round.roundNumber} started`);
//       setTimeout(() => this.endRound(round._id.toString()), durationSec * 1000);
//     } catch (err) {
//       console.error("❌ Failed to start new round:", err);
//       this.isRunning = false;
//     }
//   }

//   async endRound(roundId: string): Promise<void> {
//     try {
//       const settings = await SettingsService.getSettings();
//       const round = await Round.findById(roundId);
//       if (!round) { console.warn(`⚠️ Round not found: ${roundId}`); this.isRunning = false; return; }

//       round.roundStatus = "closed";
//       await round.save();

//       this.nsp.emit("roundClosed", { _id: round._id, roundNumber: round.roundNumber });

//       const bets = await BetService.getBetsByRound(round._id);
//       const totalPool = bets.reduce((s, b) => s + b.amount, 0);
//       round.totalPool = totalPool;

//       const companyCut = Math.floor(totalPool * settings.commissionRate); // 0.1 => 10%
//       round.companyCut = companyCut;
//       const distributableAmount = totalPool - companyCut;

//       const { winnerBox, payouts } = await BetService.computeRoundResults(round, bets, distributableAmount);

//       const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
//       let totalPaid = 0;
//       for (const p of payouts as IPayout[]) {
//         try {
//           await UserService.updateBalance(p.userId, p.amount);
//           totalPaid += p.amount;
//           const fresh = await UserService.getProfile(p.userId);
//           this.nsp.to(`user:${p.userId}`).emit("balance:update", { balance: fresh?.balance });
//           topWinners.push({ userId: new Types.ObjectId(p.userId), amountWon: p.amount });
//         } catch (e) {
//           console.warn(`⚠️ Failed to credit ${p.userId}:`, (e as Error)?.message || e);
//         }
//       }

//       try { await MetService.addBets(totalPool); await MetService.addPayouts(totalPaid); }
//       catch (e) { console.warn("⚠️ MET totals update failed:", (e as Error)?.message || e); }

//       round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
//       round.winningBox = winnerBox;
//       round.distributedAmount = totalPaid;
//       round.roundStatus = "completed";

//       round.boxStats = round.boxStats.map((stat) => {
//         const boxBets = bets.filter((b) => b.box === stat.box);
//         return { box: stat.box, totalAmount: boxBets.reduce((s, b) => s + b.amount, 0), bettorsCount: boxBets.length };
//       });

//       await round.save();

//       this.nsp.emit("winnerRevealed", {
//         _id: round._id, roundNumber: round.roundNumber, winnerBox,
//         payouts: payouts.map((p) => ({ userId: p.userId, amount: p.amount })),
//         topWinners: round.topWinners,
//       });

//       this.nsp.emit("roundEnded", {
//         _id: round._id, roundNumber: round.roundNumber,
//         totalPool, companyCut, distributedAmount: round.distributedAmount,
//       });

//       await MetService.clearCurrentRound();

//       console.log(`🏁 Round #${round.roundNumber} completed — Winner: ${winnerBox}`);
//       this.isRunning = false;
//       setTimeout(() => this.startNewRound(), 5000);
//     } catch (err) {
//       console.error("❌ Failed to end round:", err);
//       this.isRunning = false;
//     }
//   }
// }


// New Round Engine
// import { Types } from "mongoose";
// import type { Namespace } from "socket.io";
// import Round from "../modules/round/round.model";
// import { SettingsService } from "../modules/settings/settings.service";
// import { BetService } from "../modules/bet/bet.service";
// import { UserService } from "../modules/user/user.service";
// import { MetService } from "../modules/met/met.service";

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
//       const durationSec = settings.roundDuration || 60; // increase here
//       const roundNumber = await MetService.incrementRoundCounter();

//       const startTime = new Date();
//       const endTime = new Date(startTime.getTime() + durationSec * 1000);
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
//         boxStats: boxes.map((b) => ({ box: b.title, totalAmount: 0, bettorsCount: 0 })),
//         topWinners: [],
//         roundStatus: "betting"
//       });

//       await MetService.setCurrentRound(round._id.toString());

//       this.nsp.emit("roundStarted", {
//         _id: round._id,
//         roundNumber,
//         startTime,
//         endTime,
//         boxes
//       });

//       setTimeout(() => this.endRound(round._id.toString()), durationSec * 1000);
//     } catch (err) {
//       console.error("❌ Failed to start new round:", err);
//       this.isRunning = false;
//     }
//   }

//   async endRound(roundId: string): Promise<void> {
//     try {
//       const settings = await SettingsService.getSettings();
//       const round = await Round.findById(roundId);
//       if (!round) {
//         console.warn("⚠️ Round not found:", roundId);
//         this.isRunning = false;
//         return;
//       }

//       round.roundStatus = "closed";
//       await round.save();
//       this.nsp.emit("roundClosed", { _id: round._id, roundNumber: round.roundNumber });

//       const bets = await BetService.getBetsByRound(round._id);
//       const totalPool = bets.reduce((s, b) => s + b.amount, 0);
//       round.totalPool = totalPool;

//       const companyCut = Math.floor(totalPool * settings.commissionRate); // commissionRate is 0..1
//       const distributable = totalPool - companyCut;
//       round.companyCut = companyCut;

//       const { winnerBox, payouts } = await BetService.computeRoundResults(round, bets as any, distributable);

//       const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
//       for (const p of payouts) {
//         await UserService.updateBalance(p.userId, p.amount);
//         this.nsp.to(`user:${p.userId}`).emit("balance:update", {}); // client can also call get_balance
//         topWinners.push({ userId: new Types.ObjectId(p.userId), amountWon: p.amount });
//       }

//       round.topWinners = topWinners.sort((a, b) => b.amountWon - a.amountWon).slice(0, 3);
//       round.winningBox = winnerBox;
//       round.distributedAmount = payouts.reduce((s, p) => s + p.amount, 0);
//       round.roundStatus = "completed";

//       round.boxStats = round.boxStats.map((stat) => {
//         const boxBets = bets.filter((b) => b.box === stat.box);
//         return {
//           box: stat.box,
//           totalAmount: boxBets.reduce((s, b) => s + b.amount, 0),
//           bettorsCount: boxBets.length
//         };
//       });

//       await round.save();

//       this.nsp.emit("winnerRevealed", {
//         _id: round._id,
//         roundNumber: round.roundNumber,
//         winnerBox,
//         payouts: payouts.map((p) => ({ userId: p.userId, amount: p.amount })),
//         topWinners: round.topWinners
//       });

//       this.nsp.emit("roundEnded", {
//         _id: round._id,
//         roundNumber: round.roundNumber,
//         totalPool,
//         companyCut,
//         distributedAmount: round.distributedAmount
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



import { Types } from "mongoose";
import type { Namespace } from "socket.io";
import Round from "../modules/round/round.model";
import { SettingsService } from "../modules/settings/settings.service";
import { BetService } from "../modules/bet/bet.service";
import { UserService } from "../modules/user/user.service";
import { MetService } from "../modules/met/met.service";

export class RoundEngineJob {
  private nsp: Namespace;
  private isRunning = false;

  constructor(nsp: Namespace) {
    this.nsp = nsp;
  }

  async startNewRound(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const settings = await SettingsService.getSettings();

      // Accept either seconds or milliseconds from settings
      const raw = settings.roundDuration ?? 60; // your schema comment says ms; older code used seconds
      const durationMs = raw > 1000 ? raw : raw * 1000; // if small assume seconds, else already ms

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
        bets: [],
        boxStats: boxes.map((b) => ({
          box: b.title,
          totalAmount: 0,
          bettorsCount: 0,
        })),
        topWinners: [],
        roundStatus: "betting",
      });

      await MetService.setCurrentRound(round._id.toString());

      this.nsp.emit("roundStarted", {
        _id: round._id,
        roundNumber,
        startTime,
        endTime,
        boxes,
      });

      setTimeout(() => this.endRound(round._id.toString()), durationMs);
    } catch (err) {
      console.error("❌ Failed to start new round:", err);
      this.isRunning = false;
    }
  }

  async endRound(roundId: string): Promise<void> {
    try {
      const settings = await SettingsService.getSettings();
      const round = await Round.findById(roundId);
      if (!round) {
        console.warn("⚠️ Round not found:", roundId);
        this.isRunning = false;
        return;
      }

      // Close betting phase
      round.roundStatus = "closed";
      await round.save();
      this.nsp.emit("roundClosed", {
        _id: round._id,
        roundNumber: round.roundNumber,
      });

      // Gather bets and pools
      const bets = await BetService.getBetsByRound(round._id);
      const totalPool = bets.reduce((s, b) => s + b.amount, 0);
      round.totalPool = totalPool;

      // commissionRate is 0..1 in your schema
      const companyCut = Math.floor(totalPool * (settings.commissionRate ?? 0));
      const distributable = totalPool - companyCut;
      round.companyCut = companyCut;

      // Compute winners and payouts
      const { winnerBox, payouts } = await BetService.computeRoundResults(
        round,
        bets as any,
        distributable
      );

      // Credit each winner, then PUSH updated balances in real time
      const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
      for (const p of payouts) {
        // Credit and get the updated balance atomically
        const updated = await UserService.updateBalance(p.userId, p.amount);

        // Nice UX: send a dedicated payout event
        this.nsp.to(`user:${p.userId}`).emit("payout", {
          roundId: round._id,
          winnerBox,
          amount: p.amount,
          newBalance: updated.balance,
        });

        // Also send the generic balance snapshot used across the app
        this.nsp.to(`user:${p.userId}`).emit("balance:update", {
          balance: updated.balance,
          delta: p.amount,
          reason: "payout",
          roundId: round._id,
        });

        topWinners.push({
          userId: new Types.ObjectId(p.userId),
          amountWon: p.amount,
        });
      }

      round.topWinners = topWinners
        .sort((a, b) => b.amountWon - a.amountWon)
        .slice(0, 3);

      round.winningBox = winnerBox;
      round.distributedAmount = payouts.reduce((s, p) => s + p.amount, 0);
      round.roundStatus = "completed";

      // Refresh box stats
      round.boxStats = round.boxStats.map((stat) => {
        const boxBets = bets.filter((b) => b.box === stat.box);
        return {
          box: stat.box,
          totalAmount: boxBets.reduce((s, b) => s + b.amount, 0),
          bettorsCount: boxBets.length,
        };
      });

      await round.save();

      // Announce results
      this.nsp.emit("winnerRevealed", {
        _id: round._id,
        roundNumber: round.roundNumber,
        winnerBox,
        payouts: payouts.map((p) => ({ userId: p.userId, amount: p.amount })),
        topWinners: round.topWinners,
      });

      this.nsp.emit("roundEnded", {
        _id: round._id,
        roundNumber: round.roundNumber,
        totalPool,
        companyCut,
        distributedAmount: round.distributedAmount,
      });

      await MetService.clearCurrentRound();

      // Schedule next round
      this.isRunning = false;
      setTimeout(() => this.startNewRound(), 5000);
    } catch (err) {
      console.error("❌ Failed to end round:", err);
      this.isRunning = false;
    }
  }
}
