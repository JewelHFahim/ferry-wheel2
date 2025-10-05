// import mongoose, { Document, Schema } from "mongoose";

// export interface IRoundBox { title: string; icon: string; multiplier: number; }

// export interface ISettings extends Document {
//   siteName: string;
//   maintenanceMode: boolean;
//   minBet: number;
//   maxBet: number;
//   roundDuration: number;   // seconds
//   commissionRate: number;  // fraction e.g. 0.1 = 10%
//   currency: string;
//   supportedLanguages: string[];
//   theme: "light" | "dark";
//   boxes: IRoundBox[];
//   chips: number[];
//   createdAt: Date;
//   updatedAt: Date;
// }

// const SettingsSchema = new Schema<ISettings>(
//   {
//     siteName: { type: String, default: "Ferry Wheel", trim: true },
//     maintenanceMode: { type: Boolean, default: false },
//     minBet: { type: Number, default: 500, min: 0 },
//     maxBet: { type: Number, default: 10000 },
//     roundDuration: { type: Number, default: 120, min: 5 }, // seconds
//     commissionRate: { type: Number, default: 0.1, min: 0, max: 1 },
//     currency: { type: String, default: "BDT" },
//     supportedLanguages: { type: [String], default: ["en", "bn"] },
//     theme: { type: String, enum: ["light", "dark"], default: "dark" },
//     boxes: {
//       type: [{
//         title: { type: String, required: true },
//         icon: { type: String, required: true },
//         multiplier: { type: Number, required: true, default: 1 },
//       }],
//       default: [
//         { title: "Meat", icon: "🥩", multiplier: 5 },
//         { title: "Tomato", icon: "🍅", multiplier: 3 },
//         { title: "Corn", icon: "🌽", multiplier: 4 },
//         { title: "Sausage", icon: "🌭", multiplier: 6 },
//         { title: "Lettuce", icon: "🥬", multiplier: 2 },
//         { title: "Carrot", icon: "🥕", multiplier: 4 },
//         { title: "Cucumber", icon: "🥒", multiplier: 3 },
//         { title: "Pepper", icon: "🫑", multiplier: 5 },
//         { title: "Pizza", icon: "🍕", multiplier: 0 },
//         { title: "Salad", icon: "🥗", multiplier: 0 },
//       ],
//     },
//     chips: { type: [Number], default: [500, 1000, 2000, 5000, 10000] },
//   },
//   { timestamps: true }
// );

// export const SettingsModel = mongoose.model<ISettings>("Settings", SettingsSchema);


// New Settings Modal


import mongoose, { Document, Schema } from "mongoose";

export interface IRoundBox {
  title: string;
  icon: string;
  multiplier: number; // 0 for non-betting result boxes like Pizza/Salad
}

export interface ISettings extends Document {
  siteName: string;
  minBet: number;
  maxBet: number;
  roundDuration: number;     // seconds per round
  commissionRate: number;    // 0.1 => 10%
  boxes: IRoundBox[];
  chips: number[];
  maintenanceMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    siteName: { type: String, default: "Ferry Wheel" },
    minBet: { type: Number, default: 500, min: 1 },
    maxBet: { type: Number, default: 10000 },
    roundDuration: { type: Number, default: 60, min: 5 },
    commissionRate: { type: Number, default: 0.1, min: 0, max: 1 },
    boxes: {
      type: [
        {
          title: { type: String, required: true },
          icon: { type: String, required: true },
          multiplier: { type: Number, required: true }
        }
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
        { title: "Salad", icon: "🥗", multiplier: 0 }
      ]
    },
    chips: { type: [Number], default: [500, 1000, 2000, 5000, 10000] },
    maintenanceMode: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const SettingsModel = mongoose.model<ISettings>("Settings", SettingsSchema);
