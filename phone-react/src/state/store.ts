import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import type { AppStore } from "./types";
import { createRegistrationSlice } from "./slices/registrationSlice";
import { createLinesSlice } from "./slices/linesSlice";
import { createBuddiesSlice } from "./slices/buddiesSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
import { createUiSlice } from "./slices/uiSlice";
import { createOverlaysSlice } from "./slices/overlaysSlice";
import { createChatSlice } from "./slices/chatSlice";

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      subscribeWithSelector((...a) => ({
        ...createRegistrationSlice(...a),
        ...createLinesSlice(...a),
        ...createBuddiesSlice(...a),
        ...createSettingsSlice(...a),
        ...createUiSlice(...a),
        ...createOverlaysSlice(...a),
        ...createChatSlice(...a)
      })),
      {
        name: "browser-phone-store",
        version: 1,
        // Only durable slices are persisted; calls/registration/ui stay transient.
        partialize: (s) => ({
          settings: s.settings,
          selectedBuddyId: s.selectedBuddyId,
          sortBy: s.sortBy
        }),
        // Deep-merge persisted settings so newly added groups fall back to defaults.
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<AppStore>;
          const ps = (p.settings ?? {}) as Partial<AppStore["settings"]>;
          const cs = current.settings;
          return {
            ...current,
            ...p,
            settings: {
              ...cs,
              ...ps,
              account: { ...cs.account, ...(ps.account ?? {}) },
              appearance: { ...cs.appearance, ...(ps.appearance ?? {}) },
              media: { ...cs.media, ...(ps.media ?? {}) },
              notifications: { ...cs.notifications, ...(ps.notifications ?? {}) },
              policies: { ...cs.policies, ...(ps.policies ?? {}) }
            }
          };
        }
      }
    ),
    { name: "BrowserPhone", enabled: import.meta.env.DEV }
  )
);

export type { Panel } from "./slices/uiSlice";
