// import { MetModel, IMet } from "./met.model";

// export const MetService = {
//   async getMeta(): Promise<IMet> {
//     const meta = await MetModel.findOne();
//     if (meta) return meta;
//     return await MetModel.create({});
//   },

//   async incrementRoundCounter(): Promise<number> {
//     const updated = await MetModel.findOneAndUpdate({}, { $inc: { roundCounter: 1 } }, { new: true, upsert: true });
//     return updated!.roundCounter;
//   },

//   async setCurrentRound(roundId: string) {
//     await MetModel.findOneAndUpdate({}, { currentRoundId: roundId }, { upsert: true });
//   },

//   async clearCurrentRound() {
//     await MetModel.findOneAndUpdate({}, { currentRoundId: null, lastRoundEndedAt: new Date() });
//   },

//   async incrementTotalUsers(count = 1) {
//     await MetModel.findOneAndUpdate({}, { $inc: { totalUsers: count } }, { upsert: true });
//   },

//   async addBets(amount: number) {
//     await MetModel.findOneAndUpdate({}, { $inc: { totalBets: amount } }, { upsert: true });
//   },

//   async addPayouts(amount: number) {
//     await MetModel.findOneAndUpdate({}, { $inc: { totalPayouts: amount } }, { upsert: true });
//   }
// };


const version = "001";

// src/modules/met/met.service.ts
import mongoose, { Types } from "mongoose";
import Round from "../round/round.model";
import { ROUND_STATUS } from "../round/round.types";
import { MetModel, IMet } from "./met.model";

export const MetService = {
  async getMeta(): Promise<IMet> {
    const meta = await MetModel.findOne();
    if (meta) return meta;
    return await MetModel.create({});
  },

  async incrementRoundCounter(): Promise<number> {
    const updated = await MetModel.findOneAndUpdate(
      {},
      { $inc: { roundCounter: 1 } },
      { new: true, upsert: true }
    );
    return updated!.roundCounter;
  },

  // 🔧 store as ObjectId to match schema type
  async setCurrentRound(roundId: string | Types.ObjectId) {
    const _id = new mongoose.Types.ObjectId(String(roundId));
    await MetModel.findOneAndUpdate({}, { currentRoundId: _id }, { upsert: true });
  },

  async clearCurrentRound() {
    await MetModel.findOneAndUpdate(
      {},
      { currentRoundId: null, lastRoundEndedAt: new Date() }
    );
  },

  async incrementTotalUsers(count = 1) {
    await MetModel.findOneAndUpdate({}, { $inc: { totalUsers: count } }, { upsert: true });
  },

  async addBets(amount: number) {
    await MetModel.findOneAndUpdate({}, { $inc: { totalBets: amount } }, { upsert: true });
  },

  async addPayouts(amount: number) {
    await MetModel.findOneAndUpdate({}, { $inc: { totalPayouts: amount } }, { upsert: true });
  },

  /**
   * 👉 Main method you asked for:
   * Returns a render-ready snapshot of the *current* round.
   * Falls back to the most recent active round, then the last round.
   * Adds `phaseEndTime` derived from roundStatus for client countdowns.
   */
  async getCurrentRoundSnapshot(): Promise<any | null> {
    // 1) Try meta.currentRoundId
    const meta = await MetModel.findOne().lean();
    if (meta?.currentRoundId) {
      const r = await Round.findById(meta.currentRoundId)
        .select(selectFields)
        .lean();
      if (r) return attachPhaseEnd(r);
    }

    // 2) Fallback: latest active round by status
    const ACTIVE = [
      ROUND_STATUS.BETTING,
      ROUND_STATUS.REVEALING,
      ROUND_STATUS.REVEALED,
      ROUND_STATUS.PREPARE, // if you use this enum value
    ];
    const active = await Round.findOne({ roundStatus: { $in: ACTIVE } })
      .sort({ updatedAt: -1 })
      .select(selectFields)
      .lean();
    if (active) return attachPhaseEnd(active);

    // 3) Last resort: last round (completed)
    const last = await Round.findOne({})
      .sort({ createdAt: -1 })
      .select(selectFields)
      .lean();
    if (last) return attachPhaseEnd(last);

    return null;
  },
};

// Keep the projection tidy in one place
const selectFields =
  "_id roundNumber roundStatus startTime endTime revealTime prepareTime " +
  "boxes boxStats winningBox totalPool companyCut distributedAmount reserveWallet " +
  "topWinners createdAt updatedAt";

/** Add `phaseEndTime` for client countdowns */
function attachPhaseEnd(r: any) {
  const status = String(r.roundStatus || "").toLowerCase();
  let phaseEndTime: string | null = null;

  if (status === "betting") phaseEndTime = r.endTime ?? null;
  else if (status === "revealing") phaseEndTime = r.revealTime ?? null;
  else if (status === "revealed" || status === "prepare" || status === "preparing")
    phaseEndTime = r.prepareTime ?? null;

  return { ...r, phaseEndTime };
}
