import { Types } from "mongoose";
import { MetModel, IMet } from "./met.model";

export const MetService = {
  /**
   * Get the global meta document
   * Auto-creates if missing
   */
  async getMeta(): Promise<IMet> {
    const meta = await MetModel.findOne();
    if (!meta) {
      return await MetModel.create({
        roundCounter: 0,
        totalBets: 0,
        totalPayouts: 0,
        currentRoundId: null,
        lastRoundEndedAt: null,
      });
    }
    return meta;
  },

  /**
   * Increment any numeric field atomically
   */
  async incrementField(field: keyof IMet, value = 1): Promise<IMet> {
    const updated = await MetModel.findOneAndUpdate(
      {},
      { $inc: { [field]: value } },
      { new: true, upsert: true }
    );
    return updated!;
  },

  /**
   * Increment round counter and return next round number
   */
  async incrementRoundCounter(): Promise<number> {
    const updated = await MetModel.findOneAndUpdate(
      {},
      { $inc: { roundCounter: 1 } },
      { new: true, upsert: true }
    );
    return updated!.roundCounter;
  },

  /**
   * Set current active round
   */
  async setCurrentRound(roundId: Types.ObjectId | string): Promise<IMet> {
    const updated = await MetModel.findOneAndUpdate(
      {},
      { currentRoundId: roundId },
      { new: true, upsert: true }
    );
    return updated!;
  },

  /**
   * Clear current round tracking
   */
  async clearCurrentRound(): Promise<IMet> {
    const updated = await MetModel.findOneAndUpdate(
      {},
      { currentRoundId: null, lastRoundEndedAt: new Date() },
      { new: true }
    );
    return updated!;
  },

  /**
   * Add to total bets and total payouts (round summary)
   */
  async addBets(amount: number): Promise<IMet> {
    return this.incrementField("totalBets", amount);
  },

  async addPayouts(amount: number): Promise<IMet> {
    return this.incrementField("totalPayouts", amount);
  },

    // 🟠 Increment total number of users
  async incrementTotalUsers(count: number = 1): Promise<IMet> {
    const updated = await MetModel.findOneAndUpdate(
      {},
      { $inc: { totalUsers: count } },
      { new: true, upsert: true }
    );
    return updated!;
  },
};
