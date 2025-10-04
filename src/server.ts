import mongoose from "mongoose";
import http from "http";
import app from "./app";
import { initSocket } from "./config/socket";
import { RoundEngineJob } from "./jobs/roundEngine.job";
import { connectDB } from "./config/db";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1️⃣ Connect to MongoDB
    await connectDB();
    // 2️⃣ Start HTTP server + Socket.IO
    const server = http.createServer(app);
    const io = initSocket(server);

    // 3️⃣ Start Round Engine
    const roundEngine = new RoundEngineJob(io);
    await roundEngine.startNewRound(); // make sure connection ready before starting round

    // 4️⃣ Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
};

startServer();
