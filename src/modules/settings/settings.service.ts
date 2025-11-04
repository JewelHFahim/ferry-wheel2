import { IBoxStat } from "../round/round.model";
import { ISettings, SettingsModel, IBoxConfig } from "./settings.model";

export const SettingsService = {
  
  async getSettings(): Promise<ISettings> {
    let s = await SettingsModel.findOne();
    if (s) return s;
    s = await SettingsModel.create({});
    return s;
  },

  async get<T extends keyof ISettings>(key: T): Promise<ISettings[T]> {
    const s = await this.getSettings();
    return s[key];
  },

  async set<T extends keyof ISettings>(key: T, value: ISettings[T]): Promise<ISettings> {
    const updated = await SettingsModel.findOneAndUpdate(
      {},
      { [key]: value },
      { new: true, upsert: true }
    );
    return updated!;
  },

  async getInitialBoxes(): Promise<IBoxStat[]> {
    const s = await this.getSettings();
    return s.boxes.map((b: IBoxConfig): IBoxStat => ({
      box: b.title,
      title: b.title,
      icon: b.icon,
      multiplier: b.multiplier,
      group: b.group ?? null,
      totalAmount: 0,
      bettorsCount: 0,
    }));
  },
};
