import { Types } from "mongoose";
import Bet from "./bet.model";
import Round from "../round/round.model";
import { UserService } from "../user/user.service";
import { SettingsService } from "../settings/settings.service";
import { logPlaceBet, logWarning } from "../../utils/gameEventLogger";
import { Namespace } from "socket.io";
import { gameCodes } from "../../utils/statics/statics";
import { EMIT } from "../../utils/statics/emitEvents";
import { ROUND_STATUS } from "../round/round.types";


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

// Function for place bet
export const placeBet = async ({ userId, roundId, box, amount, nsp }: PlaceBetArgs) => {

  // Fetch required data concurrently
  const [round, settings, user] = await Promise.all([
    Round.findById(roundId),
    SettingsService.getSettings(),
    UserService.getById(userId),
  ]);

  // Bet place log
  logPlaceBet(userId, roundId, box, amount);

  // Validate data
  if (!round) {
    logWarning(`${gameCodes.INVALID_ROUND}, Round does not exist.`);
    throw new BetError(gameCodes.INVALID_ROUND, "Round does not exist.");
  }

  //Betting closed for this round
  if (round.roundStatus !== ROUND_STATUS.BETTING){
    logWarning(`${gameCodes.BETTING_CLOSED}, Betting is closed for this round.`);
    throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed for this round.");
  }
  
  //Betting amount check
  if (amount < settings.minBet || amount > settings.maxBet){
    logWarning(`Minimum bet amount: ${settings.minBet}, Max bet amount: ${settings.maxBet}`);
    throw new InvalidBetAmountError(settings.minBet, settings.maxBet);
  }

    // Check if user has enough balance
  if (!user || user.balance < amount) {
    logWarning(`Insufficient balance, current balance: ${user?.balance}, bet amount: ${amount}`);
    throw new InsufficientBalanceError(user?.balance ?? 0, amount);
  }
  
  // Find the box to place the bet
  const boxIndex = round.boxes.findIndex((b) => b.title === box);
  if (boxIndex === -1) {
    logWarning(`${gameCodes.INVALID_BOX}, Box does not exist`);
    throw new BetError(gameCodes.INVALID_BOX, "Box does not exist.");
  };

  // Update box statst
  round.boxStats[boxIndex].totalAmount += amount;
  round.boxStats[boxIndex].bettorsCount += 1;

  // Deduct user balance
  await UserService.updateBalance(userId, -amount);

  if (round.roundStatus !== ROUND_STATUS.BETTING) {
    logWarning(`${gameCodes.BETTING_CLOSED}, Betting is closed for this phase.`);
    throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed for this phase.");
  }

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
  nsp.emit(EMIT.ROUND_UPDATED, {
    _id: round._id,
    roundNumber: round.roundNumber,
    boxStats: round.boxStats,
    roundStatus: ROUND_STATUS.BETTING
  });

  return bet;
};

// export async function placeBetTransactional({
//   userId,
//   roundId,
//   box,
//   amount,
//   nsp,
// }: PlaceBetArgs) {
//   const session = await mongoose.startSession();
//   let betDoc: typeof Bet.prototype | null = null;
//   let userBalanceAfter = 0;

//   try {
//     await session.withTransaction(async () => {
//       // 1) Read settings (outside of critical path but inside txn for consistency)
//       const settings = await SettingsService.getSettings();
//       if (!settings) throw new BetError(gameCodes.INTERNAL, "Settings missing");

//       // 2) Validate amount
//       if (amount < settings.minBet || amount > settings.maxBet) {
//         throw new InvalidBetAmountError(settings.minBet, settings.maxBet);
//       }

//       // 3) Validate round is open & box exists (minimal round doc)
//       const round = await Round.findOne(
//         { _id: roundId, roundStatus: ROUND_STATUS.BETTING },
//         { boxes: 1, boxStats: 1, roundStatus: 1 }
//       ).session(session);

//       if (!round) throw new BetError(gameCodes.BETTING_CLOSED, "Betting is closed or round not found");

//       const boxIdx = round.boxStats.findIndex((b) => b.box === box);
//       if (boxIdx === -1) throw new BetError(gameCodes.INVALID_BOX, "Box does not exist");

//       // 4) Atomic balance deduction (prevents race conditions)
//       const userDec = await UserModel.findOneAndUpdate(
//         { _id: userId, balance: { $gte: amount } },
//         { $inc: { balance: -amount } },
//         { new: true, session, projection: { balance: 1 } }
//       );
//       if (!userDec) throw new InsufficientBalanceError(0, amount); // (We don't have previous balance; message still clear)
//       userBalanceAfter = userDec.balance ?? 0;

//       // 5) Create bet
//       betDoc = await Bet.create(
//         [{
//           userId: new Types.ObjectId(userId),
//           roundId: new Types.ObjectId(roundId),
//           box,
//           amount,
//         }],
//         { session }
//       ).then(([doc]) => doc);

//       // 6) Update round stats (positional inc)
//       await Round.updateOne(
//         { _id: roundId, "boxStats.box": box },
//         {
//           $inc: {
//             "boxStats.$.totalAmount": amount,
//             "boxStats.$.bettorsCount": 1,
//           },
//         },
//         { session }
//       );

//       // 7) Upsert per-user per-round stats
//       await UserRoundStats.updateOne(
//         { userId, roundId },
//         { $inc: { totalBet: amount, betCount: 1 } },
//         { session, upsert: true }
//       );

//       // 8) Append wallet ledger entry (immutable audit)
//       await WalletLedger.create([{
//         entityType: "user",
//         entityId: new Types.ObjectId(userId),
//         roundId: new Types.ObjectId(roundId),
//         betId: betDoc._id,
//         type: "bet",
//         delta: -amount,
//         balanceAfter: userBalanceAfter,
//         metadata: { box },
//       }], { session });
//     }, {
//       // optional tuning:
//       // readConcern: { level: "local" },
//       // writeConcern: { w: "majority" },
//       // readPreference: "primary",
//     });

//     // ===== after COMMIT: safe to emit to clients =====
//     if (betDoc) {
//       // emit to the bettor only
//       nsp.to(`user:${userId}`).emit("bet_accepted", { bet: betDoc });
//       // broadcast round update (lightweight: send only changed box? you already send full boxStats elsewhere)
//       // (If you want fresh stats, you can re-read round boxStats here non-transactionally)
//     }

//     return { success: true, bet: betDoc, balance: userBalanceAfter };
//   } catch (err) {
//     // No emits here (since txn failed). Return error to caller.
//     if (err instanceof BetError) {
//       return { success: false, code: err.code, message: err.message };
//     }
//     return { success: false, code: gameCodes.INTERNAL, message: (err as Error)?.message || "Failed to place bet" };
//   } finally {
//     session.endSession();
//   }
// }






// Refactored getBetsByRound as a function
export const getBetsByRound = async (roundId: string | Types.ObjectId) => {
  return await Bet.find({ roundId }).lean().exec();
};

