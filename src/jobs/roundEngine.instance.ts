import { Server } from "socket.io";
import { RoundEngineJob } from "./roundEngine.job";

let roundEngineInstance: RoundEngineJob | null = null;

export const initRoundEngine = (io: Server) => {
  if (!roundEngineInstance) {
    roundEngineInstance = new RoundEngineJob(io);
  }
  return roundEngineInstance;
};

export const getRoundEngine = (): RoundEngineJob => {
  if (!roundEngineInstance) {
    throw new Error("RoundEngineJob not initialized. Call initRoundEngine(io) first.");
  }
  return roundEngineInstance;
};
