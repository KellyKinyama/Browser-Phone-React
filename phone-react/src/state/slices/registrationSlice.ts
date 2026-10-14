import type { RegistrationState } from "../../services/sip";
import { sip } from "../phoneService";
import type { AppStateCreator } from "../types";

export interface RegistrationSlice {
  registration: RegistrationState;
  registerAccount: () => Promise<void>;
  unregisterAccount: () => Promise<void>;
}

export const createRegistrationSlice: AppStateCreator<RegistrationSlice> = (set, get) => ({
  registration: "unregistered",

  registerAccount: async () => {
    sip.configure(get().settings.account);
    await sip.register();
  },

  unregisterAccount: async () => {
    await sip.unregister();
  }
});
