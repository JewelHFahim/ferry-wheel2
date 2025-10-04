import { Types } from "mongoose";
import Bet, { IBet } from "./bet.model";
import Round from "../round/round.model";
import { UserService } from "../user/user.service";
import { SettingsService } from "../settings/settings.service";

interface IPlaceBetInput {
  userId: string;
  roundId: string;
  box: string;
  amount: number;
}

interface IComputedResult {
  winnerBox: string;
  payouts: { userId: string; amount: number; box: string }[];
}

export class BetService {
  /**
   * 🔹 Place a new bet for the current round
   */
  static async placeBet({ userId, roundId, box, amount }: IPlaceBetInput) {
    try {
      // 1️⃣ Fetch round
      const round = await Round.findById(roundId);
      if (!round) throw new Error("Invalid round");
      if (round.roundStatus !== "betting") throw new Error("Betting is closed");

      // 2️⃣ Fetch settings for min/max bet
      const settings = await SettingsService.getSettings();
      if (amount < settings.minBet || amount > settings.maxBet) {
        throw new Error(
          `Bet amount must be between ${settings.minBet} and ${settings.maxBet}`
        );
      }

      // 3️⃣ Verify user and balance
      const user = await UserService.getById(userId);
      if (!user) throw new Error("User not found");
      if (user.balance < amount) throw new Error("Insufficient balance");

      // 4️⃣ Deduct user balance immediately
      await UserService.updateBalance(userId, -amount);

      // 5️⃣ Create bet document
      const bet = await Bet.create({
        userId: new Types.ObjectId(userId),
        roundId: new Types.ObjectId(roundId),
        box,
        amount,
      });

      // 6️⃣ Update round stats (optional optimization)
      await Round.updateOne(
        { _id: roundId, "boxStats.box": box },
        {
          $inc: {
            "boxStats.$.totalAmount": amount,
            "boxStats.$.bettorsCount": 1,
          },
        }
      );

      return {
        success: true,
        message: "Bet placed successfully",
        bet,
      };
    } catch (error: any) {
      console.error("❌ BetService.placeBet error:", error.message);
      return {
        success: false,
        message: error.message || "Failed to place bet",
      };
    }
  }

  /**
   * 🔹 Get all bets by round
   */
  static async getBetsByRound(roundId: string | Types.ObjectId): Promise<IBet[]> {
    return Bet.find({ roundId }).lean();
  }

  /**
   * 🔹 Compute winners and payouts for a round
   */
  static async computeRoundResults(
    round: any,
    bets: IBet[],
    distributableAmount: number
  ): Promise<IComputedResult> {
    if (!bets.length) {
      return { winnerBox: "", payouts: [] };
    }

    // 1️⃣ Randomly choose a winner box (for now)
    const boxTitles = round.boxStats.map((b: any) => b.box);
    const winnerBox = boxTitles[Math.floor(Math.random() * boxTitles.length)];

    // 2️⃣ Filter bets in that box
    const winningBets = bets.filter((b) => b.box === winnerBox);
    const totalWinningAmount = winningBets.reduce((s, b) => s + b.amount, 0);

    // 3️⃣ Calculate payouts proportionally
    const payouts =
      totalWinningAmount > 0
        ? winningBets.map((b) => ({
            userId: b.userId.toString(),
            box: b.box,
            amount: Math.floor((b.amount / totalWinningAmount) * distributableAmount),
          }))
        : [];

    return { winnerBox, payouts };
  }
}
