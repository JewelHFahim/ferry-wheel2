import { Types } from "mongoose";
import Round, { IRound, IRoundBox } from "../modules/round/round.model";
import { SettingsService } from "../modules/settings/settings.service";
import { BetService } from "../modules/bet/bet.service";
import { UserService } from "../modules/user/user.service";
import { MetService } from "../modules/met/met.service";
import { Server } from "socket.io";

interface IPayout {
  userId: string;
  amount: number;
  box: string;
}

export class RoundEngineJob {
  private io: Server;
  private isRunning = false;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * ✅ Start a new round
   */
  async startNewRound(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const settings = await SettingsService.getSettings();
      const duration = settings.roundDuration || 60;
      const roundNumber = await MetService.incrementRoundCounter();
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + duration * 1000);
      const boxes: IRoundBox[] = await SettingsService.getInitialBoxes();

      // Create new round
      const round = await Round.create({
        roundNumber,
        startTime,
        endTime,
        boxes,
        totalPool: 0,
        companyCut: 0,
        distributedAmount: 0,
        bets: [],
        boxStats: boxes.map((box) => ({
          box: box.title,
          totalAmount: 0,
          bettorsCount: 0,
        })),
        topWinners: [],
        roundStatus: "betting",
      });

      // Update metadata
      await MetService.setCurrentRound(round._id.toString());
      await MetService.incrementTotalUsers(); // ✅ Added totalUsers increment

      // Notify clients
      this.io.emit("roundStarted", {
        roundNumber,
        startTime,
        endTime,
        boxes,
      });

      console.log(`🟢 Round #${roundNumber} started.`);

      // Schedule round end
      setTimeout(
        () => this.endRound(round._id.toString()),
        duration * 1000
      );
    } catch (err) {
      console.error("❌ Failed to start new round:", err);
      this.isRunning = false;
    }
  }

  /**
   * ✅ End the current round
   */
  async endRound(roundId: string): Promise<void> {
    try {
      const settings = await SettingsService.getSettings();
      const round = await Round.findById(roundId).populate("bets");
      if (!round) {
        console.warn(`⚠️ Round not found: ${roundId}`);
        this.isRunning = false;
        return;
      }

      // Close betting phase
      round.roundStatus = "closed";
      await round.save();
      this.io.emit("roundClosed", { roundNumber: round.roundNumber });

      // Fetch all bets
      const bets = await BetService.getBetsByRound(round._id);
      const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
      round.totalPool = totalPool;

      // Calculate commission
      const companyCut = Math.floor(
        (totalPool * settings.commissionRate) / 100
      );
      round.companyCut = companyCut;
      const distributableAmount = totalPool - companyCut;

      // Compute results
      const { winnerBox, payouts } = await BetService.computeRoundResults(
        round,
        bets,
        distributableAmount
      );

      // Handle payouts
      const topWinners: { userId: Types.ObjectId; amountWon: number }[] = [];
      for (const payout of payouts) {
        await UserService.updateBalance(payout.userId, payout.amount);
        topWinners.push({
          userId: new Types.ObjectId(payout.userId),
          amountWon: payout.amount,
        });
      }

      // Sort top 3 winners
      round.topWinners = topWinners
        .sort((a, b) => b.amountWon - a.amountWon)
        .slice(0, 3);

      round.winningBox = winnerBox;
      round.distributedAmount = payouts.reduce((s, p) => s + p.amount, 0);
      round.roundStatus = "completed";

      // Update box stats
      round.boxStats = round.boxStats.map((stat) => {
        const boxBets = bets.filter((b) => b.box === stat.box);
        return {
          box: stat.box,
          totalAmount: boxBets.reduce((sum, b) => sum + b.amount, 0),
          bettorsCount: boxBets.length,
        };
      });

      await round.save();

      // Notify clients
      this.io.emit("winnerRevealed", {
        roundNumber: round.roundNumber,
        winnerBox,
        payouts: payouts.map((p) => ({
          userId: p.userId,
          amount: p.amount,
        })),
        topWinners: round.topWinners,
      });

      this.io.emit("roundEnded", {
        roundNumber: round.roundNumber,
        totalPool,
        companyCut,
        distributedAmount: round.distributedAmount,
      });

      console.log(
        `🏁 Round #${round.roundNumber} completed — Winner: ${winnerBox}`
      );

      // Start next round
      this.isRunning = false;
      setTimeout(() => this.startNewRound(), 5000);
    } catch (err) {
      console.error("❌ Failed to end round:", err);
      this.isRunning = false;
    }
  }
}
