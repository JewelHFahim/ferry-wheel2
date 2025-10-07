import { ISettings, IRoundBox, SettingsModel } from "./settings.model";
import { IRoundBox as IRoundBoxRound } from "../round/round.model";

export const SettingsService = {
  
  async getSettings(): Promise<ISettings> {
    const s = await SettingsModel.findOne();
    if (s) return s;
    return await SettingsModel.create({}); // uses defaults
  },

  async get<T extends keyof ISettings>(key: T): Promise<ISettings[T]> {
    const s = await this.getSettings();
    return s[key];
  },

  async set<T extends keyof ISettings>(key: T, value: ISettings[T]): Promise<ISettings> {
    const updated = await SettingsModel.findOneAndUpdate({}, { [key]: value }, { new: true, upsert: true });
    return updated!;
  },

  async getInitialBoxes(): Promise<IRoundBoxRound[]> {
    const s = await this.getSettings();
    return s.boxes.map((b: IRoundBox) => ({
      title: b.title,
      icon: b.icon,
      multiplier: b.multiplier,
      totalBet: 0,
      userCount: 0
    }));
  }
};
