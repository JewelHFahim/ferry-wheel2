import { IRound } from "../modules/round/round.model";
import gameLogger from "./logger";

export const logRoundStart = (round: IRound) => {
  gameLogger.info(`Round #${round.roundNumber} started at ${new Date(round.startTime).toLocaleString()}`);
};

export const logRoundClose = (round: IRound) => {
  gameLogger.info(`Round #${round.roundNumber} closed at ${new Date(round.endTime).toLocaleString()}`);
};

export const logRoundResult = (round: IRound, winnerBox: string, payouts: any[]) => {
  gameLogger.info(`Round #${round.roundNumber} completed. Winner: ${winnerBox}. Total payouts: ${payouts.length}`);
};

export const logPlaceBet = (userId: string, roundId: string, box: string, amount: number) => {
  gameLogger.info(`User ${userId} placed a bet of ${amount} on ${box} for round #${roundId}`);
};

export const logBetAccepted = (betId: string, userId: string, roundId: string, box: string, amount: number) => {
  gameLogger.info(`Bet accepted: User ${userId} placed ${amount} on ${box} (Bet ID: ${betId})`);
};

export const logError = (message: string) => {
  gameLogger.error(`Error: ${message}`);
};

export const logWarning = (message: string) => {
  gameLogger.warn(`Warning: ${message}`);
};
