import { Types } from "mongoose";
import Bet from "../bet/bet.model";
import Round from "../round/round.model";
import { SettingsService } from "../settings/settings.service";
import { UserService } from "../user/user.service";
import { Namespace } from "socket.io";
import { EMIT } from "../../utils/statics/emitEvents";
import { logPlaceBet, logWarning } from "../../utils/gameEventLogger";
import { gameCodes, transactionType } from "../../utils/statics/statics";
import { ROUND_STATUS } from "../round/round.types";
import WalletLedger from "../walletLedger/walletLedger.model";

class BetError extends Error { constructor(public code: string, msg: string){ super(msg); } }
class InsufficientBalanceError extends BetError {
  constructor(balance: number, required: number) {
    super(gameCodes.INSUFFICIENT_FUNDS, `Balance: ${balance}, Bet: ${required}`);
  }
}
class InvalidBetAmountError extends BetError {
  constructor(min: number, max: number) {
    super(gameCodes.INVALID_BET_AMOUNT, `Bet must be between ${min} and ${max}`);
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
    logWarning(`${gameCodes.BETTING_CLOSED}, Betting is closed for this round.`);
    throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed for this round.");
  }
  if (amount < settings.minBet || amount > settings.maxBet) {
    logWarning(`Minimum bet: ${settings.minBet}, Max bet: ${settings.maxBet}`);
    throw new InvalidBetAmountError(settings.minBet, settings.maxBet);
  }
  if (!user || user.balance < amount) {
    logWarning(`Insufficient balance, current: ${user?.balance}, bet: ${amount}`);
    throw new InsufficientBalanceError(user?.balance ?? 0, amount);
  }

  // --------------> Guard: prevent direct bets on Pizza/Salad
  if (box === "Pizza" || box === "Salad") {
    throw new BetError(gameCodes.INVALID_BOX, "Direct bets on Pizza/Salad are not allowed");
  }

  // --------------> Determine choosen box Pizza/Salad group using *round.boxStats* truth
  const statRow = round.boxStats.find((s: any) => s.box === box);
  if (!statRow) {
    logWarning(`${gameCodes.INVALID_BOX}, Box does not exist`);
    throw new BetError(gameCodes.INVALID_BOX, "Box does not exist.");
  }
  const groupRep = (statRow.group === "Pizza" || statRow.group === "Salad") ? statRow.group : null;

  // --------------> Deduct bet balance
  await UserService.updateBalance(userId, -amount);


  // --------------> Create the bet
  const bet = await Bet.create({
    userId: new Types.ObjectId(userId),
    roundId: new Types.ObjectId(roundId),
    box,
    amount,
  });

  // --------------> Create WalletLedget
  await WalletLedger.create(
        {
            entityTypes: "user",
            entityId: userId,
            roundId: roundId,
            betId: bet._id,
            type: transactionType.BET,
            delta: -amount,
            balanceAfter: user.balance - amount,
            metaData: new Date()
        },
  )

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
  throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed for this round.");
}
  // Safety fallback if something odd happened
  const roundTotal = Number(updatedRound?.totalPool ?? 0);

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
// @status: PUBLIC,   @desc: Updated round data with live group totals reflected
// =======================================
nsp.emit(EMIT.ROUND_UPDATED, {
  _id: roundId,
  roundNumber: updatedRound.roundNumber,
  boxStats: updatedRound.boxStats,
  roundStatus: ROUND_STATUS.BETTING,
});

  return bet;
};

// Place bet with transactionTx
// export const placeBet1 = async ({ userId, roundId, box, amount, nsp }: PlaceBetArgs) => {
//   await runMaybeTx(async (session: any) => {
//     // ---- 1) Load required data
//     const [round, settings, user] = await Promise.all([
//       Round.findById(roundId).session(session),
//       SettingsService.getSettings(),
//       UserService.getById(userId, session),
//     ]);

//     if (!round) {
//       logWarning(`${gameCodes.INVALID_ROUND}, Round does not exist.`);
//       throw new BetError(gameCodes.INVALID_ROUND, "Round does not exist.");
//     }
//     if (round.roundStatus !== ROUND_STATUS.BETTING) {
//       logWarning(`${gameCodes.BETTING_CLOSED}, Betting is closed for this round.`);
//       throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed for this round.");
//     }
//     if (amount < settings.minBet || amount > settings.maxBet) {
//       logWarning(`Minimum bet: ${settings.minBet}, Max bet: ${settings.maxBet}`);
//       throw new InvalidBetAmountError(settings.minBet, settings.maxBet);
//     }
//     if (!user || user.balance < amount) {
//       logWarning(`Insufficient balance, current: ${user?.balance}, bet: ${amount}`);
//       throw new InsufficientBalanceError(user?.balance ?? 0, amount);
//     }

//     // ---- 2) Guard: Prevent direct bets on Pizza/Salad
//     if (box === "Pizza" || box === "Salad") {
//       throw new BetError(gameCodes.INVALID_BOX, "Direct bets on Pizza/Salad are not allowed");
//     }

//     // ---- 3) Find the selected box and its stats
//     const statRow = round.boxStats.find((s) => s.box === box);
//     if (!statRow) {
//       logWarning(`${gameCodes.INVALID_BOX}, Box does not exist`);
//       throw new BetError(gameCodes.INVALID_BOX, "Box does not exist.");
//     }
//     const groupRep = (statRow.group === "Pizza" || statRow.group === "Salad") ? statRow.group : null;

//     // ---- 4) Deduct balance for the bet
//     await UserService.updateBalance(userId, -amount, session);

//     // ---- 5) Create the bet
//     const bet = await Bet.create(
//       [{
//         userId: new Types.ObjectId(userId),
//         roundId: new Types.ObjectId(roundId),
//         box,
//         amount,
//       }],
//       { session }
//     );

//     // ---- 6) Create WalletLedger entry for the bet transaction
//     await WalletLedger.create(
//       [{
//         entityTypes: "user",
//         entityId: userId,
//         roundId: roundId,
//         betId: bet[0]._id,
//         type: "bet",
//         delta: -amount,
//         balanceAfter: user.balance - amount,
//         metaData: { box },
//         createdAt: new Date(),
//       }],
//       { session }
//     );

//     // ---- 7) Atomic update for round stats (box total, bettors count, and total pool)
//     const incSpec: Record<string, number> = {
//       "boxStats.$[byBox].totalAmount": amount,
//       "boxStats.$[byBox].bettorsCount": 1,
//       totalPool: amount,
//     };
    
//     const arrayFilters: any = [{ "byBox.box": box }];
//     if (groupRep && groupRep !== box) {
//       incSpec["boxStats.$[groupRep].totalAmount"] = amount;
//       incSpec["boxStats.$[groupRep].bettorsCount"] = 1;
//       arrayFilters.push({ "groupRep.box": groupRep });
//     }

//     // ---- 8) Update the round document with new stats
//     const updatedRound = await Round.findOneAndUpdate(
//       { _id: roundId, roundStatus: ROUND_STATUS.BETTING },
//       { $inc: incSpec },
//       {
//         new: true,
//         arrayFilters,
//         projection: { boxStats: 1, roundNumber: 1, totalPool: 1, roundStatus: 1 },
//         session,
//       }
//     ).lean();

//     if (!updatedRound) {
//       throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed for this round.");
//     }

//     // ---- 9) Emit updated round data to front-end (real-time UI update)
//     const roundTotal = Number(updatedRound?.totalPool ?? 0);

//     nsp.emit(EMIT.ROUND_TOTAL_BET, {
//       message: "Round total amount",
//       roundId,
//       roundNumber: updatedRound.roundNumber,
//       roundTotal,
//     });

//     nsp.emit(EMIT.ROUND_UPDATED, {
//       _id: roundId,
//       roundNumber: updatedRound.roundNumber,
//       boxStats: updatedRound.boxStats,
//       roundStatus: updatedRound.roundStatus,
//     });

//     return bet;
//   });
// };


export const getBetsByRound = async (roundId: string | Types.ObjectId) => {
  return await Bet.find({ roundId }).lean().exec();
};
