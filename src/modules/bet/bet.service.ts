// // src/modules/bet/bet.service.ts
// import { Types } from "mongoose";
// import Bet, { IBet } from "./bet.model";
// import Round from "../round/round.model";
// import { UserService } from "../user/user.service";
// import { SettingsService } from "../settings/settings.service";

// interface IPlaceBetInput {
//   userId: string;
//   roundId: string;
//   box: string;
//   amount: number;
// }

// interface IComputedResult {
//   winnerBox: string;
//   payouts: { userId: string; amount: number; box: string }[];
// }

// // A lean shape: plain object, not a Mongoose document
// type BetLean = Omit<IBet, keyof Document> & {
//   _id: Types.ObjectId;
//   userId: Types.ObjectId;
//   roundId: Types.ObjectId;
//   createdAt: Date;
//   updatedAt: Date;
// };

// export class BetService {
//   static async placeBet({ userId, roundId, box, amount }: IPlaceBetInput) {
//     try {
//       const round = await Round.findById(roundId);
//       if (!round) throw new Error("Invalid round");
//       if (round.roundStatus !== "betting") throw new Error("Betting is closed");

//       const settings = await SettingsService.getSettings();
//       if (amount < settings.minBet || amount > settings.maxBet) {
//         throw new Error(
//           `Bet amount must be between ${settings.minBet} and ${settings.maxBet}`
//         );
//       }

//       const user = await UserService.getById(userId);
//       if (!user) throw new Error("User not found");
//       if (user.balance < amount) throw new Error("Insufficient balance");

//       await UserService.updateBalance(userId, -amount);

//       const bet = await Bet.create({
//         userId: new Types.ObjectId(userId),
//         roundId: new Types.ObjectId(roundId),
//         box,
//         amount,
//       });

//       await Round.updateOne(
//         { _id: roundId, "boxStats.box": box },
//         {
//           $inc: {
//             "boxStats.$.totalAmount": amount,
//             "boxStats.$.bettorsCount": 1,
//           },
//         }
//       );

//       return { success: true, message: "Bet placed successfully", bet };
//     } catch (error: any) {
//       console.error("❌ BetService.placeBet error:", error.message);
//       return {
//         success: false,
//         message: error.message || "Failed to place bet",
//       };
//     }
//   }

//   static async getBetsByRound(
//     roundId: string | Types.ObjectId
//   ): Promise<BetLean[]> {
//     return Bet.find({ roundId }).lean<BetLean[]>();
//   }

//   // static async computeRoundResults(
//   //   round: any,
//   //   bets: IBet[],
//   //   distributableAmount: number
//   // ): Promise<IComputedResult> {
//   //   if (!bets.length) return { winnerBox: "", payouts: [] };

//   //   const boxTitles = round.boxStats.map((b: any) => b.box);
//   //   const winnerBox = boxTitles[Math.floor(Math.random() * boxTitles.length)];

//   //   const winningBets = bets.filter((b) => b.box === winnerBox);
//   //   const totalWinningAmount = winningBets.reduce((s, b) => s + b.amount, 0);

//   //   const payouts =
//   //     totalWinningAmount > 0
//   //       ? winningBets.map((b) => ({
//   //           userId: b.userId.toString(),
//   //           box: b.box,
//   //           amount: Math.floor(
//   //             (b.amount / totalWinningAmount) * distributableAmount
//   //           ),
//   //         }))
//   //       : [];

//   //   return { winnerBox, payouts };
//   // }

//   // bet.service.ts
  
//   static async computeRoundResults(
//     round: any,
//     bets: IBet[],
//     distributableAmount: number
//   ) {
//     // always choose a winner from the round definition
//     const pickWinner = () => {
//       const titles = (round?.boxStats?.map((b: any) => b.box) ?? []) // from your schema
//         .filter(Boolean);
//       if (titles.length > 0) {
//         return titles[Math.floor(Math.random() * titles.length)];
//       }
//       // fallback: try round.boxes if present
//       const boxes = (round?.boxes ?? [])
//         .map((b: any) => b.title || b)
//         .filter(Boolean);
//       return boxes.length
//         ? boxes[Math.floor(Math.random() * boxes.length)]
//         : "UNKNOWN";
//     };

//     const winnerBox = pickWinner();

//     // filter bets
//     const winningBets = bets.filter((b) => b.box === winnerBox);
//     const totalWinningAmount = winningBets.reduce((s, b) => s + b.amount, 0);

//     // proportional payout if there are winners; else zero payouts but still a declared winner
//     const payouts =
//       totalWinningAmount > 0
//         ? winningBets.map((b) => ({
//             userId: b.userId.toString(),
//             box: b.box,
//             amount: Math.floor(
//               (b.amount / totalWinningAmount) * distributableAmount
//             ),
//           }))
//         : [];

//     return { winnerBox, payouts };
//   }
// }


// New Bet Service
import { Types } from "mongoose";
import Bet, { IBet } from "./bet.model";
import Round from "../round/round.model";
import { UserService } from "../user/user.service";
import { SettingsService } from "../settings/settings.service";

export class BetService {
  static async placeBet({ userId, roundId, box, amount }: { userId: string; roundId: string; box: string; amount: number }) {
    const round = await Round.findById(roundId);
    if (!round) throw new Error("Invalid round");
    if (round.roundStatus !== "betting") throw new Error("Betting is closed");

    const settings = await SettingsService.getSettings();
    if (amount < settings.minBet || amount > settings.maxBet) {
      throw new Error(`Bet amount must be between ${settings.minBet} and ${settings.maxBet}`);
    }

    const user = await UserService.getById(userId);

    console.log("user", user);

    if (!user) throw new Error("User not found");
    if (user.balance < amount) throw new Error("Insufficient balance");

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
