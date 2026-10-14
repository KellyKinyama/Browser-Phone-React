import { useState } from "react";
import { useAppStore } from "../state/store";
import { useMediaDevices } from "../hooks/useMediaDevices";
import { AVAILABLE_LANGS } from "../services/i18n";
import type {
  AccountSettings,
  CallPolicySettings,
  MediaSettings,
  NotificationSettings,
  ThemePreference
} from "../types/settings";
import styles from "./SettingsPanel.module.scss";

type Tab = "account" | "devices" | "calls" | "appearance" | "notifications";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "account", label: "Account", icon: "fa-user" },
  { id: "devices", label: "Devices", icon: "fa-microphone" },
  { id: "calls", label: "Calls", icon: "fa-phone" },
  { id: "appearance", label: "Appearance", icon: "fa-paint-brush" },
  { id: "notifications", label: "Alerts", icon: "fa-bell" }
];

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const registration = useAppStore((s) => s.registration);
  const registerAccount = useAppStore((s) => s.registerAccount);
  const unregisterAccount = useAppStore((s) => s.unregisterAccount);
  const { devices, requestPermission } = useMediaDevices();

  const [tab, setTab] = useState<Tab>("account");
  const [account, setAccount] = useState<AccountSettings>(settings.account);
  const [media, setMedia] = useState<MediaSettings>(settings.media);
  const [policies, setPolicies] = useState<CallPolicySettings>(settings.policies);
  const [notifications, setNotifications] = useState<NotificationSettings>(settings.notifications);
  const [language, setLanguage] = useState(settings.appearance.language);
  const [theme, setTheme] = useState<ThemePreference>(settings.appearance.theme);

  const field = (key: keyof AccountSettings, label: string, type = "text") => (
    <label className={styles.formField}>
      <span>{label}</span>
      <input
        type={type}
        value={(account[key] as string | null) ?? ""}
        onChange={(e) => setAccount((a) => ({ ...a, [key]: e.target.value }))}
      />
    </label>
  );

  const deviceSelect = (
    label: string,
    key: keyof MediaSettings,
    list: MediaDeviceInfo[],
    fallback: string
  ) => (
    <label className={styles.formField}>
      <span>{label}</span>
      <select
        value={(media[key] as string | null) ?? ""}
        onChange={(e) => setMedia((m) => ({ ...m, [key]: e.target.value || null }))}
      >
        <option value="">{fallback}</option>
        {list.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${fallback} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );

  const toggle = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <label className={styles.checkField}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  const save = () => {
    updateSettings((prev) => ({
      ...prev,
      account,
      media,
      policies,
      notifications,
      appearance: { ...prev.appearance, language, theme }
    }));
  };

  return (
    <div className={styles.settingsPanel}>
      <nav className={styles.tabs}>
        {TABS.map((tdef) => (
          <button
            key={tdef.id}
            type="button"
            className={tab === tdef.id ? styles.tabActive : styles.tab}
            title={tdef.label}
            onClick={() => setTab(tdef.id)}
          >
            <i className={`fa ${tdef.icon}`} />
            <span>{tdef.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.tabBody}>
        {tab === "account" && (
          <>
            {field("profileName", "Full name")}
            {field("wssServer", "WebSocket server")}
            {field("webSocketPort", "WebSocket port")}
            {toggle(
              account.webSocketSecure,
              (v) => setAccount((a) => ({ ...a, webSocketSecure: v })),
              "Secure WebSocket (wss)"
            )}
            {field("serverPath", "WebSocket path")}
            {field("sipDomain", "SIP domain")}
            {field("sipUsername", "Extension / username")}
            {field("sipPassword", "Password", "password")}
            <label className={styles.formField}>
              <span>Registration expiry (s)</span>
              <input
                type="number"
                value={account.registerExpires}
                onChange={(e) =>
                  setAccount((a) => ({ ...a, registerExpires: Number(e.target.value) || 300 }))
                }
              />
            </label>
          </>
        )}

        {tab === "devices" && (
          <>
            <button type="button" className={styles.linkButton} onClick={() => void requestPermission()}>
              <i className="fa fa-unlock" /> Allow mic/camera access
            </button>
            {deviceSelect("Microphone", "micId", devices.mics, "Default microphone")}
            {deviceSelect("Speaker", "speakerId", devices.speakers, "Default speaker")}
            {deviceSelect("Ringer", "ringerId", devices.speakers, "Default speaker")}
            {deviceSelect("Camera", "cameraId", devices.cameras, "Default camera")}
            {toggle(
              media.echoCancellation,
              (v) => setMedia((m) => ({ ...m, echoCancellation: v })),
              "Echo cancellation"
            )}
            {toggle(
              media.noiseSuppression,
              (v) => setMedia((m) => ({ ...m, noiseSuppression: v })),
              "Noise suppression"
            )}
            {toggle(
              media.autoGainControl,
              (v) => setMedia((m) => ({ ...m, autoGainControl: v })),
              "Automatic gain control"
            )}
          </>
        )}

        {tab === "calls" && (
          <>
            {toggle(
              policies.doNotDisturb,
              (v) => setPolicies((p) => ({ ...p, doNotDisturb: v })),
              "Do not disturb (reject all calls)"
            )}
            {toggle(
              policies.callWaiting,
              (v) => setPolicies((p) => ({ ...p, callWaiting: v })),
              "Call waiting"
            )}
            {toggle(
              policies.autoAnswer,
              (v) => setPolicies((p) => ({ ...p, autoAnswer: v })),
              "Auto-answer"
            )}
          </>
        )}

        {tab === "appearance" && (
          <>
            <label className={styles.formField}>
              <span>Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="auto">Automatic</option>
                {AVAILABLE_LANGS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.formField}>
              <span>Theme</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </>
        )}

        {tab === "notifications" && (
          <>
            {toggle(
              notifications.desktop,
              (v) => setNotifications({ desktop: v }),
              "Desktop notifications"
            )}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                if (typeof Notification !== "undefined") void Notification.requestPermission();
              }}
            >
              <i className="fa fa-bell" /> Enable browser notifications
            </button>
          </>
        )}
      </div>

      <div className={styles.settingsActions}>
        <button type="button" className={styles.primaryButton} onClick={save}>
          Save
        </button>
        {registration === "registered" ? (
          <button type="button" onClick={() => void unregisterAccount()}>
            Unregister
          </button>
        ) : (
          <button
            type="button"
            disabled={registration === "connecting"}
            onClick={() => void registerAccount()}
          >
            {registration === "connecting" ? "Connecting…" : "Register"}
          </button>
        )}
      </div>
    </div>
  );
}
