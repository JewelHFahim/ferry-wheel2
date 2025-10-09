
// Version-003 Function Based
import { Types } from "mongoose";
import Bet, { IBet } from "./bet.model";
import Round, { ROUND_STATUS } from "../round/round.model";
import { UserService } from "../user/user.service";
import { SettingsService } from "../settings/settings.service";
import { logPlaceBet, logWarning } from "../../utils/gameEventLogger";
import { Namespace } from "socket.io";
import { gameCodes } from "../../utils/statics/statics";

interface PlaceBetArgs {
  userId: string;
  roundId: string;
  box: string;
  amount: number;
  nsp: Namespace;
}

// Custom error classes for better error context
class BetError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "BetError";
  }
}

class InsufficientBalanceError extends BetError {
  constructor(balance: number, required: number) {
    super("INSUFFICIENT_BALANCE", `Balance: ${balance}, Bet: ${required}`);
  }
}

class InvalidBetAmountError extends BetError {
  constructor(min: number, max: number) {
    super("INVALID_BET_AMOUNT", `Bet must be between ${min} and ${max}`);
  }
}

interface PlaceBetArgs {
  userId: string;
  roundId: string;
  box: string;
  amount: number;
  nsp: Namespace;
}

// Function for place bet
export const placeBet = async ({ userId, roundId, box, amount, nsp }: PlaceBetArgs) => {

  // Fetch required data concurrently
  const [round, settings, user] = await Promise.all([
    Round.findById(roundId),
    SettingsService.getSettings(),
    UserService.getById(userId),
  ]);

  // Current Log
  logPlaceBet(userId, roundId, box, amount);

  // Validate data
  if (!round) throw new BetError(gameCodes.INVALID_ROUND, "Round does not exist.");

  if (round.roundStatus !== ROUND_STATUS.BETTING)
    throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed for this round.");
  
  if (amount < settings.minBet || amount > settings.maxBet)
    throw new InvalidBetAmountError(settings.minBet, settings.maxBet);
  
  // Find the box to place the bet
  const boxIndex = round.boxes.findIndex((b) => b.title === box);
  if (boxIndex === -1) throw new BetError(gameCodes.INVALID_BOX, "Box does not exist.");

  // Update box stats
  round.boxStats[boxIndex].totalAmount += amount;
  round.boxStats[boxIndex].bettorsCount += 1;

  // Check if user has enough balance
  if (!user || user.balance < amount) {
    logWarning(`Insufficient balance, current balance: ${user?.balance}, bet amount: ${amount}`);
    throw new InsufficientBalanceError(user?.balance ?? 0, amount);
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

  // Atomic update of the round stats
  await Round.updateOne(
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
};

// Refactored getBetsByRound as a function
export const getBetsByRound = async (roundId: string | Types.ObjectId) => {
  return await Bet.find({ roundId }).lean().exec();
};

// Refactored computeRoundResults as a function
export const computeRoundResults = async ( round: any, bets: Array<IBet & { _id: any }>, distributableAmount: number ) => {
  const pool = round.boxStats.map((b: any) => b.box);
  const winnerBox = pool[Math.floor(Math.random() * pool.length)];

  // Filter winning bets
  const winningBets = bets.filter((b) => b.box === winnerBox);
  const totalWinningAmount = winningBets.reduce((acc, b) => acc + b.amount, 0);

  // Calculate payouts
  const payouts = totalWinningAmount > 0 ? winningBets.map((b) => ({
        userId: String(b.userId),
        box: b.box,
        amount: Math.floor((b.amount / totalWinningAmount) * distributableAmount),
      }))
    : [];

  return { winnerBox, payouts };
};

