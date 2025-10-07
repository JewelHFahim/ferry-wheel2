import { Types } from "mongoose";
import Bet, { IBet } from "./bet.model";
import Round, { ROUND_STATUS } from "../round/round.model";
import { UserService } from "../user/user.service";
import { SettingsService } from "../settings/settings.service";
import { logPlaceBet, logWarning } from "../../utils/gameEventLogger";
import { Namespace } from "socket.io";

interface PlaceBetArgs {
  userId: string;
  roundId: string;
  box: string;
  amount: number;
  nsp: Namespace;
}

export class BetService {
  static async placeBet({ userId, roundId, box, amount, nsp }: PlaceBetArgs) {
    // Fetch required data in parallel
    const [round, settings, user] = await Promise.all([
      Round.findById(roundId),
      SettingsService.getSettings(),
      UserService.getById(userId),
    ]);

    logPlaceBet(userId, roundId, box, amount);

    if (!round) throw new Error("Invalid round");
    if (round.roundStatus !== ROUND_STATUS.BETTING)
      throw new Error("Betting is closed");

    if (amount < settings.minBet || amount > settings.maxBet) {
      throw new Error(
        `Bet amount must be between ${settings.minBet} and ${settings.maxBet}`
      );
    }

    // Find the box and update stats
    const boxIndex = round.boxes.findIndex((b) => b.title === box);
    if (boxIndex === -1) throw new Error("Invalid box");

    round.boxStats[boxIndex].totalAmount += amount;
    round.boxStats[boxIndex].bettorsCount += 1;

    if (!user || user.balance < amount) {
      logWarning(
        `Insufficient balance, current balance: ${user?.balance}, bet amount: ${amount}`
      );
      throw new Error("Insufficient balance");
    }

    // Deduct user balance
    await UserService.updateBalance(userId, -amount);

    // Create the bet
    const bet = await Bet.create({
      userId: new Types.ObjectId(userId),
      roundId: new Types.ObjectId(roundId),
      box,
      amount,
    });

    // Update the round stats (atomic update)
    const res = await Round.updateOne(
      { _id: roundId, "boxStats.box": box },
      {
        $inc: {
          "boxStats.$.totalAmount": amount,
          "boxStats.$.bettorsCount": 1,
        },
      }
    );

    // Emit updated round data to all clients
    nsp.emit("roundUpdated", {
      _id: round._id,
      roundNumber: round.roundNumber,
      boxStats: round.boxStats,
      phase: ROUND_STATUS.BETTING,
      phaseEndTime: round.endTime,
    });
    

    return bet;
  }

  static async getBetsByRound(roundId: string | Types.ObjectId) {
    return Bet.find({ roundId }).lean().exec();
  }

  static async computeRoundResults(
    round: any,
    bets: Array<IBet & { _id: any }>,
    distributableAmount: number
  ) {
    const pool = round.boxStats.map((b: any) => b.box);
    const winnerBox = pool[Math.floor(Math.random() * pool.length)];

    const { winningBets, totalWinningAmount } = bets.reduce(
      (acc: { winningBets: IBet[]; totalWinningAmount: number }, b) => {
        if (b.box === winnerBox) {
          acc.winningBets.push(b);
          acc.totalWinningAmount += b.amount;
        }
        return acc;
      },
      { winningBets: [], totalWinningAmount: 0 }
    );

    const payouts =
      totalWinningAmount > 0
        ? winningBets.map((b) => ({
            userId: String(b.userId),
            box: b.box,
            amount: Math.floor(
              (b.amount / totalWinningAmount) * distributableAmount
            ),
          }))
        : [];

    return { winnerBox, payouts };
  }
}
