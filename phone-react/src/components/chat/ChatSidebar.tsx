import { useState } from "react";
import clsx from "clsx";
import { useAppStore } from "../../state/store";
import styles from "./ChatPanel.module.scss";

export function ChatSidebar() {
  const status = useAppStore((s) => s.chatStatus);
  const error = useAppStore((s) => s.chatError);
  const myName = useAppStore((s) => s.chatMyName);
  const contacts = useAppStore((s) => s.chatContacts);
  const selectedPeer = useAppStore((s) => s.chatSelectedPeer);
  const unread = useAppStore((s) => s.chatUnread);
  const rooms = useAppStore((s) => s.chatRooms);
  const connect = useAppStore((s) => s.chatConnect);
  const disconnect = useAppStore((s) => s.chatDisconnect);
  const selectPeer = useAppStore((s) => s.chatSelectPeer);
  const createRoom = useAppStore((s) => s.chatCreateRoom);

  const [email, setEmail] = useState("alice@rainbow-stub.local");
  const [password, setPassword] = useState("password");
  const [newRoom, setNewRoom] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);

  if (status !== "connected") {
    const busy = status === "connecting";
    return (
      <div className={styles.login}>
        <h3>Chat sign in</h3>
        <p className={styles.hint}>Connects to the chatstub XMPP server.</p>
        <label className={styles.field}>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className={styles.error}>{error}</div>}
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void connect(email, password)}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.chatHeader}>
        <span className={styles.me}>{myName}</span>
        <button type="button" className={styles.link} onClick={disconnect}>
          Sign out
        </button>
      </div>

      <div className={styles.peerList}>
        {contacts.map((c) => (
          <button
            key={c.id}
            type="button"
            className={clsx(styles.peerRow, c.id === selectedPeer && styles.peerRowActive)}
            onClick={() => selectPeer(c.id)}
          >
            <span className={clsx(styles.dot, styles[`p_${c.presence}`] ?? "")} />
            <span className={styles.peerRowName}>{c.name}</span>
            {(unread[c.id] ?? 0) > 0 && c.id !== selectedPeer && (
              <span className={styles.badge}>{unread[c.id]}</span>
            )}
          </button>
        ))}

        <div className={styles.listSection}>Rooms</div>
        {rooms.map((r) => (
          <button
            key={r.id}
            type="button"
            className={clsx(styles.peerRow, r.id === selectedPeer && styles.peerRowActive)}
            onClick={() => selectPeer(r.id)}
          >
            <i className={clsx("fa fa-hashtag", styles.roomIcon)} />
            <span className={styles.peerRowName}>{r.name}</span>
            {(unread[r.id] ?? 0) > 0 && r.id !== selectedPeer && (
              <span className={styles.badge}>{unread[r.id]}</span>
            )}
          </button>
        ))}

        {showNewRoom ? (
          <input
            className={styles.roomInput}
            autoFocus
            placeholder="Room name…"
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newRoom.trim()) {
                void createRoom(newRoom);
                setNewRoom("");
                setShowNewRoom(false);
              } else if (e.key === "Escape") {
                setShowNewRoom(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={clsx(styles.peerRow, styles.newRoomRow)}
            onClick={() => setShowNewRoom(true)}
          >
            <i className="fa fa-plus" /> New room
          </button>
        )}
      </div>
    </div>
  );
}
