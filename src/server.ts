// import http from "http";
// import app from "./app";
// import { initSocket } from "./config/socket";
// import { RoundEngineJob } from "./jobs/roundEngine.job";
// import { connectDB } from "./config/db";
// import { MetService } from "./modules/met/met.service";
// import { SettingsService } from "./modules/settings/settings.service";

// const PORT = Number(process.env.PORT || 5000);

// (async () => {
//   await connectDB();
//   await MetService.syncRoundCounterWithDB();
//   // await SettingsService.set("roundDuration", 30); // seconds
//   const server = http.createServer(app);
//   const { game } = initSocket(server);

//   server.listen(PORT, async () => {
//     console.log(`🚀 Server running on port ${PORT}`);


//     const engine = new RoundEngineJob(game);
//     await engine.startNewRound();
//   });
// })();

// New Server 
import "dotenv/config";
import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./config/socket";
import { RoundEngineJob } from "./jobs/roundEngine.job";

const PORT = Number(process.env.PORT || 5000);

(async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    const { io, game } = initSocket(server);

    // start the round engine on /game namespace
    const engine = new RoundEngineJob(game);
    await engine.startNewRound();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // graceful
    const shutdown = async () => {
      console.log("⚠️ Shutting down...");
      io.close();
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("❌ Failed to start:", err);
    process.exit(1);
  }
})();

