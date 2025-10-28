// services/bet/userTotals.service.ts
import { Types } from "mongoose";
import Bet from "../bet/bet.model";
import { Namespace } from "socket.io";
import { EMIT } from "../../utils/statics/emitEvents";
import { MetService } from "../met/met.service";

export async function getUserPerboxTotal(userId: string | Types.ObjectId, roundId: string | Types.ObjectId) {
  const perBox  = await Bet.aggregate([
    { $match: { userId: new Types.ObjectId(userId), roundId: new Types.ObjectId(roundId) } },
    { $group: { _id: "$box", totalAmount: { $sum: "$amount" }, count: { $sum : 1 } } },
    { $project: { _id: 0, box: "$_id", totalAmount: 1, count: 1 } },
    { $sort: { box: 1 } },
  ]);
  return perBox;
}

/** Compute & emit to just this user’s socket room */
export async function emitUserPerboxTotal(nsp: Namespace, userId: string, roundId?: string) {
  let rid = roundId;
  if (!rid) {
    const meta = await MetService.getMeta();
    rid = meta.currentRoundId ? String(meta.currentRoundId) : undefined;
  }
  if (!rid) return; // nothing running right now

  const userPerBoxTotal = await getUserPerboxTotal(userId, rid);
  nsp.to(`user:${userId}`).emit(EMIT.USER_PERBOX_TOTAL, {
    roundId: rid,
    userId,
    userPerBoxTotal,
  });
}
