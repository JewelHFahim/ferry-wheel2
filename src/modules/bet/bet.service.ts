import { Types } from "mongoose";
import Bet from "../bet/bet.model";
import Round from "../round/round.model";
import { SettingsService } from "../settings/settings.service";
import { UserService } from "../user/user.service";
import { Namespace } from "socket.io";
import { EMIT } from "../../utils/statics/emitEvents";
import { logPlaceBet, logWarning } from "../../utils/gameEventLogger";
import { gameCodes, groupName, transactionType } from "../../utils/statics/statics";
import { ROUND_STATUS } from "../round/round.types";
import WalletLedger from "../walletLedger/walletLedger.model";
import { getUserPerboxTotal } from "./userTotals.service";

class BetError extends Error {
  constructor(public code: string, msg: string) {
    super(msg);
  }
}
class InsufficientBalanceError extends BetError {
  constructor(balance: number, required: number) {
    super(
      gameCodes.INSUFFICIENT_FUNDS,
      `Balance: ${balance}, Bet: ${required}`
    );
  }
}
class InvalidBetAmountError extends BetError {
  constructor(min: number, max: number) {
    super(
      gameCodes.INVALID_BET_AMOUNT,
      `Bet must be between ${min} and ${max}`
    );
  }
}

interface PlaceBetArgs {
  userId: string;
  roundId: string;
  box: string;
  amount: number;
  nsp: Namespace;
}

export const placeBet = async ({ userId, roundId, box, amount, nsp }: PlaceBetArgs) => {

  // --------------> Load states
  const [round, settings, user] = await Promise.all([
    Round.findById(roundId).lean(),
    SettingsService.getSettings(),
    UserService.getById(userId),
  ]);

  // --------------> Bet logs
  logPlaceBet(userId, roundId, box, amount);

  // --------------> Validation
  if (!round) {
    logWarning(`${gameCodes.INVALID_ROUND}, Round does not exist.`);
    throw new BetError(gameCodes.INVALID_ROUND, "Round does not exist.");
  }
  if (round.roundStatus !== ROUND_STATUS.BETTING) {
    logWarning(
      `${gameCodes.BETTING_CLOSED}, Betting is closed for this round.`
    );
    throw new BetError(
      gameCodes.BETTING_CLOSED,
      "Betting is closed for this round."
    );
  }
  if (amount < settings.minBet || amount > settings.maxBet) {
    logWarning(`Minimum bet: ${settings.minBet}, Max bet: ${settings.maxBet}`);
    throw new InvalidBetAmountError(settings.minBet, settings.maxBet);
  }
  if (!user || user.balance < amount) {
    logWarning(
      `Insufficient balance, current: ${user?.balance}, bet: ${amount}`
    );
    throw new InsufficientBalanceError(user?.balance ?? 0, amount);
  }

  // --------------> Guard: prevent direct bets on Pizza/Salad
  if (box === groupName.PIZZA || box === groupName.SALAD) {
    throw new BetError(
      gameCodes.INVALID_BOX,
      "Direct bets on Pizza/Salad are not allowed"
    );
  }

  // --------------> Determine choosen box Pizza/Salad group using *round.boxStats* truth
  const statRow = round.boxStats.find((s: any) => s.box === box);
  if (!statRow) {
    logWarning(`${gameCodes.INVALID_BOX}, Box does not exist`);
    throw new BetError(gameCodes.INVALID_BOX, "Box does not exist.");
  }
  const groupRep =
    statRow.group === groupName.PIZZA || statRow.group === groupName.SALAD
      ? statRow.group
      : null;

  // --------------> Deduct bet balance
  await UserService.updateBalance(userId, -amount);

  // --------------> Create the bet
  const bet = await Bet.create({
    userId: new Types.ObjectId(userId),
    roundId: new Types.ObjectId(roundId),
    box,
    amount,
  });

  // --------------> Perbox total emit
  const  userPerBoxTotal = await getUserPerboxTotal(userId, roundId);
  nsp.to(`user:${String(userId)}`).emit(EMIT.USER_PERBOX_TOTAL, {
    roundId,
    userId,
    userPerBoxTotal,
  });


  // --------------> Create WalletLedget
  await WalletLedger.create({
    entityTypes: "user",
    entityId: userId,
    roundId: roundId,
    betId: bet._id,
    type: transactionType.BET,
    delta: -amount,
    balanceAfter: user.balance - amount,
    metaData: new Date(),
  });

  // --------------> Atomically update
  const incSpec: Record<string, number> = {
    "boxStats.$[byBox].totalAmount": amount,
    "boxStats.$[byBox].bettorsCount": 1,
    totalPool: amount,
  };
  const arrayFilters: any[] = [{ "byBox.box": box }];

  if (groupRep && groupRep !== box) {
    incSpec["boxStats.$[groupRep].totalAmount"] = amount;
    incSpec["boxStats.$[groupRep].bettorsCount"] = 1;
    arrayFilters.push({ "groupRep.box": groupRep });
  }

  // --------------> Get the updated document
  const updatedRound = await Round.findOneAndUpdate(
    { _id: roundId, roundStatus: ROUND_STATUS.BETTING },
    { $inc: incSpec },
    {
      new: true,
      arrayFilters,
      projection: { boxStats: 1, roundNumber: 1, totalPool: 1, roundStatus: 1 },
    }
  ).lean();

  if (!updatedRound) {
    throw new BetError(
      gameCodes.BETTING_CLOSED,
      "Betting is closed for this round."
    );
  }

  // =======================================
  // @status: PUBLIC,   @desc: Live round total
  // =======================================
  nsp.emit(EMIT.ROUND_TOTAL_BET, {
    message: "Round total amount",
    roundId,
    roundNumber: updatedRound.roundNumber,
    roundTotal: updatedRound.totalPool,
  });

  // =======================================
  // @status: PUBLIC,   @desc: Updated round data with live group totals
  // =======================================
  nsp.emit(EMIT.ROUND_UPDATED, {
    _id: roundId,
    roundNumber: updatedRound.roundNumber,
    boxStats: updatedRound.boxStats,
    roundStatus: ROUND_STATUS.BETTING,
  });

  return bet;
};

export const getBetsByRound = async (roundId: string | Types.ObjectId) => {
  return await Bet.find({ roundId }).lean().exec();
};