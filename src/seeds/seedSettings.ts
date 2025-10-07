import mongoose from "mongoose";
import { SettingsModel, ISettings } from "../modules/settings/settings.model";
import { boxDatas } from "../utils/statics/statics";
import { config } from "dotenv";
import { env } from "../config/env";
config();

const MONGO_URI = env.MONGO_URI || "mongodb://127.0.0.1:27017/ferrywheel";

async function seedSettings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected for seeding settings");

    const existing = await SettingsModel.findOne();
    console.log(existing);
    if (existing) {
      console.log("⚠️ Settings already exist. Skipping seeding.");
      process.exit(0);
    }

    const defaultSettings: Partial<ISettings> = {
      siteName: "Ferry Wheel",
      maintenanceMode: false,
      minBet: 500,
      maxBet: 10000,
      roundDuration: 30000,
      commissionRate: 0.1, // 10%
      currency: "BDT",
      supportedLanguages: ["en", "bn"],
      theme: "dark",
      boxes: boxDatas,
      chips: [500, 1000, 2000, 5000, 10000],
    };

    const created = await SettingsModel.create(defaultSettings);
    console.log("✅ Settings seeded:", created);

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to seed settings:", err);
    process.exit(1);
  }
}

seedSettings();

// ts-node src/seeds/seedSettings.ts
