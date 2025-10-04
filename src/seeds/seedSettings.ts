import mongoose from "mongoose";
import { SettingsModel, ISettings } from "../modules/settings/settings.model";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ferrywheel";

async function seedSettings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected for seeding settings");

    const existing = await SettingsModel.findOne();
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
      boxes: [
        { title: "Meat", icon: "🥩", multiplier: 5 },
        { title: "Tomato", icon: "🍅", multiplier: 3 },
        { title: "Corn", icon: "🌽", multiplier: 4 },
        { title: "Sausage", icon: "🌭", multiplier: 6 },
        { title: "Lettuce", icon: "🥬", multiplier: 2 },
        { title: "Carrot", icon: "🥕", multiplier: 4 },
        { title: "Cucumber", icon: "🥒", multiplier: 3 },
        { title: "Pepper", icon: "🫑", multiplier: 5 },
        { title: "Pizza", icon: "🍕", multiplier: 0 },
        { title: "Salad", icon: "🥗", multiplier: 0 },
      ],
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
