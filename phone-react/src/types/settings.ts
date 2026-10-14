export type ThemePreference = "light" | "dark" | "system";

export interface AccountSettings {
  profileUserId: string | null;
  profileName: string | null;
  /** WebSocket server host, e.g. "pbx.example.com". */
  wssServer: string | null;
  webSocketPort: string | null;
  /** Use secure WebSocket (wss). False = plain ws. */
  webSocketSecure: boolean;
  /** WebSocket path, e.g. "/ws". */
  serverPath: string | null;
  sipDomain: string | null;
  sipUsername: string | null;
  sipPassword: string | null;
  registerExpires: number;
  transportReconnectionAttempts: number;
  userAgentString: string;
}

export interface AppearanceSettings {
  /** Language code or "auto". */
  language: string;
  theme: ThemePreference;
}

export interface MediaSettings {
  micId: string | null;
  speakerId: string | null;
  ringerId: string | null;
  cameraId: string | null;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface NotificationSettings {
  desktop: boolean;
}

export interface CallPolicySettings {
  doNotDisturb: boolean;
  callWaiting: boolean;
  autoAnswer: boolean;
}

export interface Settings {
  account: AccountSettings;
  appearance: AppearanceSettings;
  media: MediaSettings;
  notifications: NotificationSettings;
  policies: CallPolicySettings;
}

export const APP_VERSION = "0.1.0";

export const defaultSettings = (): Settings => ({
  account: {
    profileUserId: null,
    profileName: null,
    wssServer: null,
    webSocketPort: null,
    webSocketSecure: true,
    serverPath: null,
    sipDomain: null,
    sipUsername: null,
    sipPassword: null,
    registerExpires: 300,
    transportReconnectionAttempts: 999,
    userAgentString: `Browser Phone React ${APP_VERSION}`
  },
  appearance: {
    language: "auto",
    theme: "system"
  },
  media: {
    micId: null,
    speakerId: null,
    ringerId: null,
    cameraId: null,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  notifications: {
    desktop: true
  },
  policies: {
    doNotDisturb: false,
    callWaiting: true,
    autoAnswer: false
  }
});
