import { Request, Response } from "express";
import { SettingsService } from "./settings.service";
import { SettingsModel } from "./settings.model";

export const handleGetSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getSettings();

    res.json({ status: true, message: "Setting's updated",  settings });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to get settings" });
  }
};

// Helper function for validate and normalize chips
const toCommissionFraction = (raw: unknown) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error("commissionRate must be a number");
  if (n < 0) throw new Error("commissionRate cannot be negative");
  // accept 0–1 (fraction) or 0–100 (percent)
  if (n <= 1) return n;
  if (n <= 100) return n / 100;
  throw new Error("commissionRate must be in 0-1 or 0-100%");
};

const validateChips = (raw: unknown) => {
  if (!Array.isArray(raw)) throw new Error("chips must be an array");
  const nums = raw.map(Number);
  if (nums.length === 0) throw new Error("chips cannot be empty");
  if (nums.some((n) => !Number.isFinite(n) || !Number.isInteger(n) || n <= 0))
    throw new Error("chips must be positive integers");
  const STEP = 100;
  if (STEP && nums.some((n) => n % STEP !== 0))
    throw new Error(`chips must be multiples of ${STEP}`);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
};


export async function handleUpdateSettings(req: Request, res: Response) {
  try {
    const { commissionRate, chips } = req.body as {
      commissionRate?: unknown;
      chips?: unknown;
    };

    const $set: Record<string, any> = {};

    if (commissionRate !== undefined) {
      $set.commissionRate = toCommissionFraction(commissionRate);
    }

    if (chips !== undefined) {
      $set.chips = validateChips(chips);
    }

    if (Object.keys($set).length === 0) {
      return res.status(400).json({
        status: false,
        message: "Provide at least one of: commissionRate, chips",
      });
    }

    const updated = await SettingsModel.findOneAndUpdate(
      {},
      {
        $set,
        $setOnInsert: { createdAt: new Date() },
        $currentDate: { updatedAt: true },
      },
      { new: true, upsert: true, projection: { _id: 0, commissionRate: 1, chips: 1 } }
    ).lean();

    return res.json({ status: true, settings: updated });
  } catch (e: any) {
    return res.status(400).json({ status: false, message: e?.message || "Invalid payload" });
  }
}
