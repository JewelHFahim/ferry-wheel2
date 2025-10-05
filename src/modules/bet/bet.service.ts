
import { Types } from "mongoose";
import Bet, { IBet } from "./bet.model";
import Round from "../round/round.model";
import { UserService } from "../user/user.service";
import { SettingsService } from "../settings/settings.service";
import { logError, logPlaceBet, logWarning } from "../../utils/gameEventLogger";

export class BetService {

  static async placeBet({ userId, roundId, box, amount }: { userId: string; roundId: string; box: string; amount: number }) {

    const round = await Round.findById(roundId);
    logPlaceBet(userId, roundId, box, amount);

    if (!round) throw new Error("Invalid round");
    if (round.roundStatus !== "betting") throw new Error("Betting is closed");

    const settings = await SettingsService.getSettings();
    if (amount < settings.minBet || amount > settings.maxBet) {
      throw new Error(`Bet amount must be between ${settings.minBet} and ${settings.maxBet}`);
    }

    const user = await UserService.getById(userId);

    if (!user) throw new Error("User not found");
    if (user.balance < amount) {
      logWarning(`Insufficient balance, current balacne: ${user.balance}, bet amount: ${amount}`)
      throw new Error(`Insufficient balance`);
    }

    await UserService.updateBalance(userId, -amount);

    const bet = await Bet.create({
      userId: new Types.ObjectId(userId),
      roundId: new Types.ObjectId(roundId),
      box,
      amount
    });

    await Round.updateOne(
      { _id: roundId, "boxStats.box": box },
      { $inc: { "boxStats.$.totalAmount": amount, "boxStats.$.bettorsCount": 1 } }
    );

    return bet;
  }

  static async getBetsByRound(roundId: string | Types.ObjectId) {
    // for settlement math we just need lean objects
    return Bet.find({ roundId }).lean().exec();
  }

  static async computeRoundResults(round: any, bets: Array<IBet & { _id: any }>, distributableAmount: number) {
    if (!bets.length) return { winnerBox: "", payouts: [] as Array<{ userId: string; amount: number; box: string }> };

    // simple random winner from existing boxStats entries
    const pool = round.boxStats.map((b: any) => b.box);
    const winnerBox = pool[Math.floor(Math.random() * pool.length)];

    const winningBets = bets.filter((b) => b.box === winnerBox);
    const totalWinningAmount = winningBets.reduce((s, b) => s + b.amount, 0);

    const payouts =
      totalWinningAmount > 0
        ? winningBets.map((b) => ({
            userId: String(b.userId),
            box: b.box,
            amount: Math.floor((b.amount / totalWinningAmount) * distributableAmount)
          }))
        : [];

    return { winnerBox, payouts };
  }
}
