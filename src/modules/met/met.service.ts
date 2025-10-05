// import { Types } from "mongoose";
// import { MetModel, IMet } from "./met.model";
// import Round from "../round/round.model";

// const FILTER = { key: "met" } as const;

// export const MetService = {
//   async getMeta(): Promise<IMet> {
//     const meta = await MetModel.findOne(FILTER);
//     if (meta) return meta;
//     return MetModel.create({ ...FILTER });
//   },

//   async incrementField(field: keyof IMet, value = 1): Promise<IMet> {
//     return (await MetModel.findOneAndUpdate(
//       FILTER,
//       { $inc: { [field]: value } },
//       { new: true, upsert: true }
//     ))!;
//   },

//   async incrementRoundCounter(): Promise<number> {
//     const updated = await MetModel.findOneAndUpdate(
//       FILTER, { $inc: { roundCounter: 1 } }, { new: true, upsert: true }
//     );
//     return updated!.roundCounter;
//   },

//   async setRoundCounter(value: number): Promise<IMet> {
//     return (await MetModel.findOneAndUpdate(
//       FILTER, { $set: { roundCounter: value } }, { new: true, upsert: true }
//     ))!;
//   },

//   async syncRoundCounterWithDB(): Promise<void> {
//     const max = await Round.findOne({}, { roundNumber: 1 })
//       .sort({ roundNumber: -1 })
//       .lean<{ roundNumber?: number } | null>();
//     const maxRound = max?.roundNumber ?? 0;
//     const meta = await MetModel.findOne(FILTER);
//     if (!meta || meta.roundCounter < maxRound) {
//       await MetModel.findOneAndUpdate(
//         FILTER, { $set: { roundCounter: maxRound } }, { new: true, upsert: true }
//       );
//     }
//   },

//   async setCurrentRound(roundId: Types.ObjectId | string): Promise<IMet> {
//     const rid = typeof roundId === "string" ? new Types.ObjectId(roundId) : roundId;
//     return (await MetModel.findOneAndUpdate(
//       FILTER, { $set: { currentRoundId: rid } }, { new: true, upsert: true }
//     ))!;
//   },

//   async clearCurrentRound(): Promise<IMet> {
//     return (await MetModel.findOneAndUpdate(
//       FILTER, { $set: { currentRoundId: null, lastRoundEndedAt: new Date() } }, { new: true, upsert: true }
//     ))!;
//   },

//   async addBets(amount: number)     { return this.incrementField("totalBets", amount); },
//   async addPayouts(amount: number)  { return this.incrementField("totalPayouts", amount); },
//   async incrementTotalUsers(count=1){ return this.incrementField("totalUsers", count); },
// };


// New Met Service
import { MetModel, IMet } from "./met.model";

export const MetService = {
  async getMeta(): Promise<IMet> {
    const meta = await MetModel.findOne();
    if (meta) return meta;
    return await MetModel.create({});
  },

  async incrementRoundCounter(): Promise<number> {
    const updated = await MetModel.findOneAndUpdate({}, { $inc: { roundCounter: 1 } }, { new: true, upsert: true });
    return updated!.roundCounter;
  },

  async setCurrentRound(roundId: string) {
    await MetModel.findOneAndUpdate({}, { currentRoundId: roundId }, { upsert: true });
  },

  async clearCurrentRound() {
    await MetModel.findOneAndUpdate({}, { currentRoundId: null, lastRoundEndedAt: new Date() });
  },

  async incrementTotalUsers(count = 1) {
    await MetModel.findOneAndUpdate({}, { $inc: { totalUsers: count } }, { upsert: true });
  },

  async addBets(amount: number) {
    await MetModel.findOneAndUpdate({}, { $inc: { totalBets: amount } }, { upsert: true });
  },

  async addPayouts(amount: number) {
    await MetModel.findOneAndUpdate({}, { $inc: { totalPayouts: amount } }, { upsert: true });
  }
};
