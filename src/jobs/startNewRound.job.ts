import { Namespace } from "socket.io";
import { SettingsService } from "../modules/settings/settings.service";
import { MetService } from "../modules/met/met.service";
import Round from "../modules/round/round.model";
import { env } from "../config/env";
import { EMIT } from "../utils/statics/emitEvents";
import { ROUND_STATUS } from "../modules/round/round.types";
import { endRound } from "./endRound.job";
import { endRoundTester } from "./endRound.tester";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const startNewRound = async (nsp: Namespace): Promise<void> => {
  try {

    const [settings, roundNumber, boxes] = await Promise.all([
      SettingsService.getSettings(),
      MetService.incrementRoundCounter(),
      SettingsService.getInitialBoxes(),
    ]);

    // const raw = settings.bettingDuration ?? env.BETTING_DURATION;
    // const bettingDuration = raw > 1000 ? raw : raw * 1000;
    // const rawRevealDuration = settings.revealDuration ?? env.REVEAL_DURATION;
    // const revealDuration = rawRevealDuration > 1000 ? rawRevealDuration : rawRevealDuration * 1000;
    // const rawPrepareDuration = settings.prepareDuration ?? env.PREPARE_DURATION;
    // const prepareDuration = rawPrepareDuration > 1000 ? rawPrepareDuration : rawPrepareDuration * 1000;


    const bettingDuration = typeof settings.revealDuration === "number"
    ? settings.bettingDuration < 1000 ? settings.bettingDuration * 1000 : settings.bettingDuration
    : env.BETTING_DURATION_MS;

    const revealDuration = typeof settings.revealDuration === "number" 
    ? (settings.revealDuration < 1000 ? settings.revealDuration * 1000 : settings.revealDuration) 
    : env.REVEAL_DURATION_MS;
    
    const prepareDuration = typeof settings.prepareDuration === "number" 
    ? (settings.prepareDuration < 1000 ? settings.prepareDuration * 1000 : settings.prepareDuration) 
    : env.PREPARE_DURATION_MS;



    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + bettingDuration);

    //Event times
    const endBettingTime = new Date(startTime.getTime() + bettingDuration);
    const endRevealTime = new Date(endBettingTime.getTime() + revealDuration);
    const endPrepareTime = new Date(endRevealTime.getTime() + prepareDuration);

    // Create the initial round
    const round = await Round.create({
      roundNumber,
      startTime,
      endTime: endBettingTime,
      revealTime: endRevealTime,
      prepareTime: endPrepareTime,
      boxes,
      totalPool: 0,
      companyCut: 0,
      distributedAmount: 0,
      reserveWallet: 0,
      boxStats: boxes.map((b) => ({
        box: b.title,
        title: b.title,
        icon: b.icon,
        multiplier: b.multiplier,
        group: b.group,
        totalAmount: 0,
        bettorsCount: 0,
      })),
      bets: [],
      roundStatus: ROUND_STATUS.BETTING,
    });

    await MetService.setCurrentRound(round._id.toString());

    // ==========================
    // @status: Public, @Desc: Emit the round started event
    // ==========================
    nsp.emit(EMIT.ROUND_STARTED, {
      _id: round._id,
      roundNumber,
      startTime,
      endTime,
      boxes,
      winningBox: null,
      bets: [],
      topWinners: [],
      revealTime: round.revealTime,
      prepareTime: round.prepareTime,
      roundStatus: ROUND_STATUS.BETTING,
    });

    await sleep(bettingDuration);

    // End the round and prepare for the next phase
    // await endRound(round._id.toString(), nsp);
    await endRoundTester(round._id.toString(), nsp);

  } catch (err) {
    console.error("❌ Failed to start new round:", err);
  }
};