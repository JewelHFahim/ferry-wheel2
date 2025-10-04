import { ISettings, SettingsModel, IRoundBox as IRoundBoxSettings } from "./settings.model";
import { IRoundBox as IRoundBoxRound } from "../round/round.model";


export const SettingsService = {
  /**
   * Get the global settings document.
   * Auto-creates default settings if missing.
   */
  async getSettings(): Promise<ISettings> {
    const settings = await SettingsModel.findOne();
    if (!settings) {
      return await SettingsModel.create({
        roundDuration: 30000, // 30 sec default
        minBet: 500,
        maxBet: 10000,
        commissionRate: 0.1, // 10%
        boxes: [
          { title: "Meat", icon: "🥩", multiplier: 5 },
          { title: "Tomato", icon: "🍅", multiplier: 3 },
          { title: "Corn", icon: "🌽", multiplier: 4 },
          { title: "Sausage", icon: "🌭", multiplier: 6 },
          { title: "Lettuce", icon: "🥬", multiplier: 2 },
          { title: "Carrot", icon: "🥕", multiplier: 4 },
          { title: "Cucumber", icon: "🥒", multiplier: 3 },
          { title: "Pepper", icon: "🫑", multiplier: 5 },
          // Pizza/Salad auto boxes (no betting)
          { title: "Pizza", icon: "🍕", multiplier: 0 },
          { title: "Salad", icon: "🥗", multiplier: 0 },
        ],
      });
    }
    return settings;
  },

  /**
   * Typed getter for any key in ISettings
   */
  async get<T extends keyof ISettings>(key: T): Promise<ISettings[T]> {
    const settings = await this.getSettings();
    return settings[key];
  },

  /**
   * Typed setter / updater
   */
  async set<T extends keyof ISettings>(key: T, value: ISettings[T]): Promise<ISettings> {
    const updated = await SettingsModel.findOneAndUpdate({}, { [key]: value }, { new: true, upsert: true });
    return updated!;
  },

  /**
   * Map settings boxes to round boxes, adding runtime fields
   */
  async getInitialBoxes(): Promise<IRoundBoxRound[]> {
    const settings = await this.getSettings();
    const boxes: IRoundBoxRound[] = settings.boxes.map((b: IRoundBoxSettings) => ({
      title: b.title,
      icon: b.icon,
      multiplier: b.multiplier,
      totalBet: 0,
      userCount: 0,
    }));
    return boxes;
  },

  /**
   * Update multiple settings at once (admin)
   */
  async updateSettings(updates: Partial<ISettings>): Promise<ISettings> {
    const updated = await SettingsModel.findOneAndUpdate({}, updates, { new: true, upsert: true, runValidators: true });
    return updated!;
  },

  /**
   * Toggle maintenance mode
   */
  async toggleMaintenance(status: boolean): Promise<ISettings> {
    const updated = await SettingsModel.findOneAndUpdate({}, { maintenanceMode: status }, { new: true });
    return updated!;
  },
};
