import type { Lang } from "../../types/lang";
import type { Line } from "../../types/line";
import type { Buddy } from "../../types/buddy";
import { loadLang } from "../../services/i18n";
import { sip } from "../phoneService";
import type { AppStateCreator } from "../types";

export type Panel = "contacts" | "dialpad" | "settings" | "chat";
export type Breakpoint = "wide" | "narrow";

// null = closed; "new" = add form; Buddy = edit form.
export type ContactFormState = Buddy | "new" | null;

// Best-effort desktop notification for an inbound call (click focuses the app).
function notifyIncomingCall(name: string, number: string): void {
  if (typeof Notification === "undefined") return;
  const show = () => {
    try {
      const n = new Notification("Incoming call", {
        body: [name, number].filter(Boolean).join(" · "),
        tag: "incoming-call",
        requireInteraction: true
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* ignore */
    }
  };
  if (Notification.permission === "granted") show();
  else if (Notification.permission !== "denied") {
    void Notification.requestPermission().then((p) => {
      if (p === "granted") show();
    });
  }
}

export interface UiSlice {
  ready: boolean;
  lang: Lang | null;
  activePanel: Panel;
  breakpoint: Breakpoint;
  editingContact: ContactFormState;
  setActivePanel: (panel: Panel) => void;
  setBreakpoint: (breakpoint: Breakpoint) => void;
  showList: () => void;
  openContactForm: (buddy?: Buddy) => void;
  closeContactForm: () => void;
  initialize: () => Promise<void>;
}

export const createUiSlice: AppStateCreator<UiSlice> = (set, get) => ({
  ready: false,
  lang: null,
  activePanel: "contacts",
  breakpoint: "wide",
  editingContact: null,

  setActivePanel: (activePanel) => set({ activePanel }, false, "ui/setActivePanel"),

  setBreakpoint: (breakpoint) => set({ breakpoint }, false, "ui/setBreakpoint"),

  // Narrow-mode "back": return from the stream/content pane to the contact list.
  showList: () => set({ selectedLineNumber: null, selectedBuddyId: null }, false, "ui/showList"),

  openContactForm: (buddy) =>
    set({ editingContact: buddy ?? "new" }, false, "ui/openContactForm"),

  closeContactForm: () => set({ editingContact: null }, false, "ui/closeContactForm"),

  initialize: async () => {
    const lang = await loadLang(get().settings.appearance.language);

    sip.setEvents({
      onRegistrationStateChange: (state) =>
        set({ registration: state }, false, "sip/registrationState"),
      onIncomingCall: (call) => {
        const { policies, notifications } = get().settings;
        const onCall = get().lines.some((l) => l.state === "established");
        if (policies.doNotDisturb || (!policies.callWaiting && onCall)) {
          void sip.reject(call.sessionId);
          return;
        }
        get().addIncomingLine(call);
        if (notifications.desktop) notifyIncomingCall(call.remoteName, call.remoteNumber);
        if (policies.autoAnswer && !onCall) void sip.answer(call.sessionId, call.withVideo);
      },
      onCallProgress: (sessionId, state) =>
        get().patchLineBySession(sessionId, { state: state as Line["state"] }),
      onCallEstablished: (sessionId) => {
        get().patchLineBySession(sessionId, { state: "established", startedAt: Date.now() });
        get().addLineEventBySession(sessionId, "answered");
      },
      onCallEnded: (sessionId) => get().removeLineBySession(sessionId)
    });

    sip.configure(get().settings.account);
    sip.setMedia(get().settings.media);
    await get().loadBuddies();
    await get().loadCallHistory();
    set({ lang, ready: true }, false, "ui/ready");
  }
});
