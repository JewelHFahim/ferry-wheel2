// import "dotenv/config";
// import http from "http";
// import app from "./app";
// import { connectDB } from "./config/db";
// import { initSocket } from "./config/socket";
// import { RoundEngineJob } from "./jobs/roundEngine.job";

// const PORT = Number(process.env.PORT || 5000);

// (async () => {
//   try {
//     await connectDB();

//     const server = http.createServer(app);
//     const { io, game } = initSocket(server);

//     // start the round engine on /game namespace
//     const engine = new RoundEngineJob(game);
//     await engine.startNewRound();

//     server.listen(PORT, () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//     });

//     // graceful
//     const shutdown = async () => {
//       console.log("⚠️ Shutting down...");
//       io.close();
//       server.close(() => process.exit(0));
//     };
//     process.on("SIGINT", shutdown);
//     process.on("SIGTERM", shutdown);
//   } catch (err) {
//     console.error("❌ Failed to start:", err);
//     process.exit(1);
//   }
// })();
import "dotenv/config";
import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./config/socket";
import { startNewRound } from "./jobs/roundEngine.job";
import { env } from "./config/env";

const PORT = Number(process.env.PORT || 5000);

// Ensure the DB URI is available
if (!env.MONGO_URI) {
  console.error("❌ Missing required DB_URI environment variable");
  process.exit(1);
}

// Retry mechanism for connecting to the database
const retryConnectDB = async (retries = 5, delay = 5000) => {
  try {
    await connectDB();
    console.log("✅ Connected to the database");
  } catch (err) {
    if (retries === 0) {
      console.error("❌ Failed to connect to the database:", err);
      process.exit(1);
    }
    console.log(`Retrying to connect to the database... ${retries} retries left`);
    setTimeout(() => retryConnectDB(retries - 1, delay), delay);
  }
};

// Start the server and initialize the game
(async () => {
  try {
    // Ensure DB connection
    await retryConnectDB();

    // Create HTTP server
    const server = http.createServer(app);
    const { io, game } = initSocket(server); // Initialize socket

    // Start the server and listen on the provided port
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      
      // Automatically start the first round once the server is up
      startNewRound(game);  // This triggers the first round immediately
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("⚠️ Shutting down...");
      try {
        await new Promise<void>((resolve, reject) => {
          io.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        console.log("✅ Server shut down successfully");
        process.exit(0);
      } catch (err) {
        console.error("❌ Error during shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("❌ Failed to start:", err);
    console.error(err);
    process.exit(1);
  }
})();
