import { useEffect } from "react";
import clsx from "clsx";
import { useAppStore } from "./state/store";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { ProfileHeader } from "./components/ProfileHeader";
import { SearchBar } from "./components/SearchBar";
import { BuddyList } from "./components/BuddyList";
import { DialPad } from "./components/DialPad";
import { SettingsPanel } from "./components/SettingsPanel";
import { ChatSidebar } from "./components/chat/ChatSidebar";
import { ChatStream } from "./components/chat/ChatStream";
import { CallArea } from "./components/CallArea";
import { LineSwitcher } from "./components/LineSwitcher";
import { ContactForm } from "./components/ContactForm";
import { DialogHost } from "./components/ui/DialogHost";
import { ToastHost } from "./components/ui/ToastHost";
import { Ringer } from "./components/Ringer";
import styles from "./App.module.scss";

function useTheme() {
  const theme = useAppStore((s) => s.settings.appearance.theme);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);
}

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const initialize = useAppStore((s) => s.initialize);
  const activePanel = useAppStore((s) => s.activePanel);
  const breakpoint = useAppStore((s) => s.breakpoint);
  const showList = useAppStore((s) => s.showList);
  const inStream = useAppStore((s) => s.selectedLineNumber !== null);
  const chatConnected = useAppStore((s) => s.chatStatus === "connected");
  const chatPeer = useAppStore((s) => s.chatSelectedPeer);
  useTheme();
  useBreakpoint();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!ready) {
    return (
      <div className={styles.appLoading}>
        <i className="fa fa-circle-o-notch fa-spin" />
      </div>
    );
  }

  const narrow = breakpoint === "narrow";
  const inChatStream =
    chatConnected && !!chatPeer && (activePanel === "chat" || activePanel === "contacts");
  const contentActive = inStream || inChatStream;
  const showSidebar = !narrow || !contentActive;
  const showContent = !narrow || contentActive;

  return (
    <div className={clsx(styles.appRoot, narrow && styles.narrow)}>
      {showSidebar && (
        <aside className={styles.sidebar}>
          <ProfileHeader />
          {activePanel === "contacts" && <SearchBar />}
          <div className={styles.panelBody}>
            {activePanel === "contacts" && <BuddyList />}
            {activePanel === "dialpad" && <DialPad />}
            {activePanel === "chat" && <ChatSidebar />}
            {activePanel === "settings" && <SettingsPanel />}
          </div>
        </aside>
      )}
      {showContent && (
        <main className={styles.content}>
          {narrow && (
            <button type="button" className={styles.backBar} onClick={showList}>
              <i className="fa fa-chevron-left" /> {useAppStore.getState().lang?.["back"] ?? "Back"}
            </button>
          )}
          <LineSwitcher />
          {!inStream && inChatStream ? <ChatStream /> : <CallArea />}
        </main>
      )}
      <DialogHost />
      <ToastHost />
      <ContactForm />
      <Ringer />
    </div>
  );
}
