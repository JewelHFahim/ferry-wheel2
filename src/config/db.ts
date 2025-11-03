import mongoose from "mongoose";
import { env } from "./env";

let isConnecting = false;

export const connectDB = async (): Promise<void> => {
  const mongoUri = env.MONGO_URI || "";
  if (!mongoUri) {
    console.error("❌ Mongodb url not set");
    process.exit(1);
  }

  if (mongoose.connection.readyState === 1) {
    return; // already connected
  }
  if (isConnecting) return;
  isConnecting = true;

  try {
    await mongoose.connect(mongoUri);
    console.log("=============>X<============");
    console.log("MongoDB connect successfull");
    console.log("=============>X<============");
  } catch (error: any) {
    console.log("Mongodb Connection Failed", error?.message || error);
    isConnecting = false;
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
      console.log("🛑 MongoDB connection closed");
    }
  } catch (err: any) {
    console.error("⚠️ Error while closing MongoDB connection:", err?.message || err);
  }
};
