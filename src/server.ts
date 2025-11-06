// import "dotenv/config";
// import http from "http";
// import app from "./app";
// import { connectDB } from "./config/db";
// import { initSocket } from "./sockets/socket";
// import { startNewRound } from "./jobs/startNewRound.job";

// const PORT = Number(process.env.PORT || 5000);

// // Retry connecting to the db
// const retryConnectDB = async (retries = 5, delay = 5000) => {
//   try {
//     await connectDB();
//   } catch (err) {
//     if (retries === 0) {
//       console.error("❌ Failed to connect to the database:", err);
//       process.exit(1);
//     }
//     console.log(
//       `Retrying to connect to the database... ${retries} retries left`
//     );
//     setTimeout(() => retryConnectDB(retries - 1, delay), delay);
//   }
// };

// (async () => {
//   try {
//     // DB connection
//     await retryConnectDB();

//     // server
//     const server = http.createServer(app);
    
//     const { io, game } = initSocket(server);

//     server.listen(PORT, () => {
//       console.log(`====> Server running on port ${PORT} <====`);

//       startNewRound(game);
//     });

//     // Graceful shutdown
//     const shutdown = async () => {
//       console.log("⚠️ Shutting down...");
//       try {
//         await new Promise<void>((resolve, reject) => {
//           io.close((err) => {
//             if (err) reject(err);
//             else resolve();
//           });
//         });

//         await new Promise<void>((resolve, reject) => {
//           server.close((err) => {
//             if (err) reject(err);
//             else resolve();
//           });
//         });

//         console.log("✅ Server shut down successfully");
//         process.exit(0);
//       } catch (err) {
//         console.error("❌ Error during shutdown:", err);
//         process.exit(1);
//       }
//     };

//     process.on("SIGINT", shutdown);
//     process.on("SIGTERM", shutdown);
//   } catch (err) {
//     console.error("❌ Failed to start:", err);
//     console.error(err);
//     process.exit(1);
//   }
// })();


const version ="001";

import "dotenv/config";
import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./sockets/socket";
import { startNewRound } from "./jobs/startNewRound.job";

const PORT = Number(process.env.PORT || 5000);

// Retry connecting to the db
const retryConnectDB = async (retries = 5, delay = 5000) => {
  try {
    await connectDB();
  } catch (err) {
    if (retries === 0) {
      console.error("Failed to connect to the database:", err);
      process.exit(1);
    }
    console.log(`Retrying to connect to the database... ${retries} retries left`);
    setTimeout(() => retryConnectDB(retries - 1, delay), delay);
  }
};

(async () => {
  try {
    // DB connection
    await retryConnectDB();

    // server
    const server = http.createServer(app);
    const { io } = initSocket(server);

    server.listen(PORT, () => {
      console.log(`====> Server running on port ${PORT} <====`);
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
