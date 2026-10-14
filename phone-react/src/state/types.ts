import type { StateCreator } from "zustand";
import type { RegistrationSlice } from "./slices/registrationSlice";
import type { LinesSlice } from "./slices/linesSlice";
import type { BuddiesSlice } from "./slices/buddiesSlice";
import type { SettingsSlice } from "./slices/settingsSlice";
import type { UiSlice } from "./slices/uiSlice";
import type { OverlaysSlice } from "./slices/overlaysSlice";
import type { ChatSlice } from "./slices/chatSlice";

export type AppStore = RegistrationSlice &
  LinesSlice &
  BuddiesSlice &
  SettingsSlice &
  UiSlice &
  OverlaysSlice &
  ChatSlice;

// Mutator tuple must match the middleware composition order in store.ts
// (outer -> inner): devtools( persist( subscribeWithSelector(...) ) ).
export type AppStateCreator<TSlice> = StateCreator<
  AppStore,
  [
    ["zustand/devtools", never],
    ["zustand/persist", unknown],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  TSlice
>;
