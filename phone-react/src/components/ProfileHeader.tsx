import clsx from "clsx";
import { useAppStore, type Panel } from "../state/store";
import type { RegistrationState } from "../services/sip";
import styles from "./ProfileHeader.module.scss";
import common from "./common.module.scss";

const REG_LABEL: Record<string, string> = {
  unregistered: "Not registered",
  connecting: "Connecting…",
  registered: "Registered",
  failed: "Registration failed"
};

const REG_DOT: Record<RegistrationState, string> = {
  unregistered: "dotOffline",
  connecting: "dotRinging",
  registered: "dotOnline",
  failed: "dotBusy"
};

export function ProfileHeader() {
  const settings = useAppStore((s) => s.settings);
  const registration = useAppStore((s) => s.registration);
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const name = settings.account.profileName || settings.account.sipUsername || "Not configured";

  const navButton = (panel: Panel, icon: string, title: string) => (
    <button
      type="button"
      className={clsx(common.iconButton, activePanel === panel && common.active)}
      title={title}
      aria-label={title}
      onClick={() => setActivePanel(panel)}
    >
      <i className={"fa " + icon} />
    </button>
  );

  return (
    <header className={styles.profileHeader}>
      <div className={styles.profileAvatar} aria-hidden>
        <i className="fa fa-user" />
      </div>
      <div className={styles.profileInfo}>
        <div className={styles.profileName}>{name}</div>
        <div className={styles.profileStatus}>
          <span className={clsx(common.statusDot, common[REG_DOT[registration]])} />
          {REG_LABEL[registration] ?? registration}
        </div>
      </div>
      <nav className={styles.profileNav}>
        {navButton("contacts", "fa-users", "Contacts")}
        {navButton("dialpad", "fa-th", "Dial pad")}
        {navButton("chat", "fa-comments", "Chat")}
        {navButton("settings", "fa-cog", "Settings")}
      </nav>
    </header>
  );
}
