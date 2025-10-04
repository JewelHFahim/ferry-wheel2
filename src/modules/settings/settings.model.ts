import mongoose, { Document, Schema } from "mongoose";

export interface IRoundBox {
  title: string;
  icon: string;
  multiplier: number; // 0 for Pizza/Salad or other auto boxes
}

export interface ISettings extends Document {
  siteName: string;
  maintenanceMode: boolean;
  minBet: number;
  maxBet: number;
  roundDuration: number; // milliseconds per round
  commissionRate: number; // decimal 0.1 = 10%
  currency: string;
  supportedLanguages: string[];
  theme: "light" | "dark";
  boxes: IRoundBox[];
  chips: number[]; // 500, 1k, 2k, 5k, 10k
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    siteName: { type: String, default: "Ferry Wheel", trim: true },
    maintenanceMode: { type: Boolean, default: false },
    minBet: { type: Number, default: 500, min: 0 },
    maxBet: { type: Number, default: 10000 },
    roundDuration: { type: Number, default: 30000, min: 10000 }, // ms
    commissionRate: { type: Number, default: 0.1, min: 0, max: 1 }, // 10%
    currency: { type: String, default: "BDT" },
    supportedLanguages: { type: [String], default: ["en", "bn"] },
    theme: { type: String, enum: ["light", "dark"], default: "dark" },
    boxes: {
      type: [
        {
          title: { type: String, required: true },
          icon: { type: String, required: true },
          multiplier: { type: Number, required: true, default: 1 },
        },
      ],
      default: [
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
    },
    chips: { type: [Number], default: [500, 1000, 2000, 5000, 10000] },
  },
  { timestamps: true }
);

SettingsSchema.index({ siteName: 1 });

export const SettingsModel = mongoose.model<ISettings>("Settings", SettingsSchema);
