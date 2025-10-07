import { Request, Response } from "express";
import { SettingsService } from "./settings.service";

export const handleGetSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to get settings" });
  }
};
