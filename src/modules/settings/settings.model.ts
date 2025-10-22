import mongoose, { Document, Schema } from "mongoose";
import { boxDatas } from "../../utils/statics/statics";
import { IRoundBox } from "../round/round.model";

// export interface IRoundBox {
//   title: string;
//   icon: string;
//   group: string,
//   multiplier: number;
// }

export interface IBoxConfig {
  title: string;
  icon: string;
  multiplier: number;
  group?: string | null; // e.g. "Pizza" | "Salad" | undefined
}

export interface ISettings extends Document {
  siteName: string;
  currency: string;
  minBet: number;
  maxBet: number;
  roundDuration: number;
  bettingDuration: number;
  prepareDuration: number;
  revealDuration: number;
  commissionRate: number;
  boxes: IBoxConfig[]; 
  chips: number[];
  maintenanceMode: boolean;
  supportedLanguages: ["en", "bn"];
  theme: string;
  createdAt: Date;
  updatedAt: Date;
}

const BoxConfigSchema = new Schema<IBoxConfig>(
  {
    title: { type: String, required: true },
    icon: { type: String, required: true },
    multiplier: { type: Number, required: true },
    group: { type: String, default: null }, // optional
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    siteName: { type: String, default: "Ferry Wheel" },
    currency: { type: String, default: "BD" },
    minBet: { type: Number, default: 50, min: 1 },
    maxBet: { type: Number, default: 10000 },
    roundDuration: { type: Number, default: 30, min: 5 },
    bettingDuration: { type: Number, default: 30, min: 15},
    prepareDuration: { type: Number, default: 5, min: 3},
    revealDuration: { type: Number, default: 5, min: 3},
    commissionRate: { type: Number, default: 0.1, min: 0, max: 1 },
    boxes: { type: [BoxConfigSchema], default: boxDatas, },
    chips: { type: [Number], default: [500, 1000, 2000, 5000, 10000] },
    maintenanceMode: { type: Boolean, default: false },
    supportedLanguages: { type: [String] },
    theme: { type: String, default: "Dark" },
  },
  { timestamps: true }
);

export const SettingsModel = mongoose.model<ISettings>(
  "Settings",
  SettingsSchema
);
