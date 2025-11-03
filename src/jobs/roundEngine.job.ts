// roundEngine.ts
import Round from "../modules/round/round.model";
import { SettingsService } from "../modules/settings/settings.service";
import { startNewRound } from "./startNewRound.job";
import { endRound } from "./endRound.job";
import { ROUND_STATUS } from "../modules/round/round.types";

let loopRunning = false;

export async function startRoundLoop(nsp: import("socket.io").Namespace) {
  if (loopRunning) return;
  loopRunning = true;

  // On boot, try to resume if a round is active; otherwise start a new one.
  const now = Date.now();
  let current = await Round.findOne({
    roundStatus: { $in: [ROUND_STATUS.BETTING, ROUND_STATUS.REVEALING, ROUND_STATUS.PREPARE] },
  }).sort({ createdAt: -1 }).lean();

  if (!current) {
    await startNewRound(nsp);
    current = await Round.findOne().sort({ createdAt: -1 }).lean();
  }

  scheduleNextTick(current!, nsp);
}

function scheduleNextTick(round: any, nsp: import("socket.io").Namespace) {
  const now = Date.now();
  const betEnd = new Date(round.endTime).getTime();
  const revEnd = new Date(round.revealTime).getTime();
  const prepEnd = new Date(round.prepareTime).getTime();

  if (now < betEnd) {
    // Still betting → schedule endRound when betting closes
    setTimeout(async () => {
      await endRound(String(round._id), nsp);
      const next = await Round.findOne().sort({ createdAt: -1 }).lean();
      scheduleNextTick(next!, nsp);
    }, betEnd - now);
  } else if (now < prepEnd) {
    // We’re already in reveal/prepare; just wait out the prepare end and start next round
    setTimeout(async () => {
      await startNewRound(nsp);
      const next = await Round.findOne().sort({ createdAt: -1 }).lean();
      scheduleNextTick(next!, nsp);
    }, prepEnd - now);
  } else {
    // Round fully finished → start a new one right away
    (async () => {
      await startNewRound(nsp);
      const next = await Round.findOne().sort({ createdAt: -1 }).lean();
      scheduleNextTick(next!, nsp);
    })();
  }
}