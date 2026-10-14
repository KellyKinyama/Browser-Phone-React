import type { Settings } from "../types/settings";
import { defaultSettings } from "../types/settings";
import { storage } from "./storage";

const SETTINGS_KEY = "settings.v1";

export function loadSettings(): Settings {
  const defaults = defaultSettings();
  const stored = storage.getJson<Partial<Settings>>(SETTINGS_KEY, {});
  // Shallow-merge each section so new fields get defaults.
  return {
    account: { ...defaults.account, ...(stored.account ?? {}) },
    appearance: { ...defaults.appearance, ...(stored.appearance ?? {}) },
    media: { ...defaults.media, ...(stored.media ?? {}) },
    notifications: { ...defaults.notifications, ...(stored.notifications ?? {}) },
    policies: { ...defaults.policies, ...(stored.policies ?? {}) }
  };
}

export function saveSettings(settings: Settings): void {
  storage.setJson(SETTINGS_KEY, settings);
}
