import type { Settings } from "../../types/settings";
import { defaultSettings } from "../../types/settings";
import { sip } from "../phoneService";
import type { AppStateCreator } from "../types";

export interface SettingsSlice {
  settings: Settings;
  updateSettings: (updater: (prev: Settings) => Settings) => void;
}

export const createSettingsSlice: AppStateCreator<SettingsSlice> = (set, get) => ({
  settings: defaultSettings(),

  updateSettings: (updater) => {
    const next = updater(get().settings);
    sip.configure(next.account);
    sip.setMedia(next.media);
    set({ settings: next }, false, "settings/update");
  }
});
