import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useAppStore } from "../../state/store";
import { chatClient } from "../../state/chatService";
import type { FileMeta } from "../../services/chat/ChatClient";
import styles from "./ChatPanel.module.scss";

const REACT_EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];

const COMPOSE_EMOJIS = [
  "\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F609}", "\u{1F60A}", "\u{1F60D}",
  "\u{1F618}", "\u{1F61C}", "\u{1F914}", "\u{1F644}", "\u{1F62E}", "\u{1F62D}",
  "\u{1F44D}", "\u{1F44E}", "\u{1F64F}", "\u{1F44F}", "\u{1F4AA}", "\u{1F525}",
  "\u2764\uFE0F", "\u{1F389}", "\u2705", "\u274C", "\u2757", "\u{1F440}"
];

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ImageAttachment({
  file,
  token,
  onOpen
}: {
  file: FileMeta;
  token: string | null;
  onOpen: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (token) {
      void chatClient
        .downloadFile(file.url, token)
        .then((u) => {
          objectUrl = u;
          if (active) setUrl(u);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl as string), 15000);
    };
  }, [file.url, token]);

  if (!url) {
    return (
      <div className={styles.imageLoading}>
        <i className="fa fa-circle-o-notch fa-spin" />
      </div>
    );
  }
  return (
    <button type="button" className={styles.imageThumb} onClick={() => onOpen(url)}>
      <img src={url} alt={file.name} />
    </button>
  );
}

function FileAttachment({
  file,
  token,
  onOpenImage
}: {
  file: FileMeta;
  token: string | null;
  onOpenImage: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (file.mime.startsWith("image/")) {
    return <ImageAttachment file={file} token={token} onOpen={onOpenImage} />;
  }
  const download = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const url = await chatClient.downloadFile(file.url, token);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={styles.file} onClick={download} disabled={busy}>
      <i className="fa fa-file-o" />
      <span className={styles.fileName}>{file.name}</span>
      <span className={styles.fileSize}>{formatSize(file.size)}</span>
    </button>
  );
}

function aggregate(
  byUser?: Record<string, string[]>
): { emoji: string; count: number; users: string[] }[] {
  const map = new Map<string, string[]>();
  for (const [uid, emojis] of Object.entries(byUser ?? {})) {
    for (const e of emojis) map.set(e, [...(map.get(e) ?? []), uid]);
  }
  return [...map.entries()].map(([emoji, users]) => ({ emoji, count: users.length, users }));
}

export function ChatStream() {
  const contacts = useAppStore((s) => s.chatContacts);
  const conversations = useAppStore((s) => s.chatConversations);
  const selectedPeer = useAppStore((s) => s.chatSelectedPeer);
  const typing = useAppStore((s) => s.chatTyping);
  const myId = useAppStore((s) => s.chatMyId);
  const token = useAppStore((s) => s.chatToken);
  const reactions = useAppStore((s) => s.chatReactions);
  const retracted = useAppStore((s) => s.chatRetracted);
  const rooms = useAppStore((s) => s.chatRooms);
  const roomOccupants = useAppStore((s) => s.chatRoomOccupants);
  const send = useAppStore((s) => s.chatSend);
  const setTyping = useAppStore((s) => s.chatSetTyping);
  const toggleReaction = useAppStore((s) => s.chatToggleReaction);
  const retract = useAppStore((s) => s.chatRetract);
  const invite = useAppStore((s) => s.chatInvite);
  const sendFile = useAppStore((s) => s.chatSendFile);
  const uploading = useAppStore((s) => s.chatUploading);

  const [draft, setDraft] = useState("");
  const [reactOpen, setReactOpen] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const idleTimer = useRef<number | undefined>(undefined);

  const isRoom = !!selectedPeer && rooms.some((r) => r.id === selectedPeer);
  const seenIds = new Set<string>();
  const messages = (selectedPeer ? conversations[selectedPeer] ?? [] : []).filter((m) => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return true;
  });

  const stopTyping = () => {
    window.clearTimeout(idleTimer.current);
    if (composingRef.current) {
      composingRef.current = false;
      setTyping(false);
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (value.trim() === "") {
      stopTyping();
      return;
    }
    if (!composingRef.current) {
      composingRef.current = true;
      setTyping(true);
    }
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(stopTyping, 3000);
  };

  const submit = () => {
    if (!draft.trim()) return;
    stopTyping();
    send(draft);
    setDraft("");
  };

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, selectedPeer]);

  if (!selectedPeer) {
    return (
      <div className={styles.streamEmpty}>
        <i className="fa fa-comments" />
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

  const selectedRoom = rooms.find((r) => r.id === selectedPeer);
  const peerName =
    selectedRoom?.name ?? contacts.find((c) => c.id === selectedPeer)?.name ?? selectedPeer;
  const occupants = roomOccupants[selectedPeer] ?? [];
  const invitable = contacts.filter(
    (c) => !(selectedRoom?.members ?? []).includes(c.id) && !occupants.includes(c.id)
  );

  return (
    <div className={styles.stream}>
      <div className={styles.streamHeader}>
        <span className={styles.streamTitle}>
          {isRoom && <i className="fa fa-hashtag" />} {peerName}
        </span>
        {isRoom && (
          <div className={styles.roomBar}>
            <span className={styles.roomMeta}>
              <i className="fa fa-users" /> {occupants.length || (selectedRoom?.members.length ?? 0)}
            </span>
            {invitable.length > 0 && (
              <select
                className={styles.invite}
                value=""
                onChange={(e) => {
                  if (e.target.value) void invite(selectedPeer, e.target.value);
                }}
              >
                <option value="">Invite…</option>
                {invitable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <div className={styles.messages} ref={listRef}>
        {messages.length === 0 && (
          <div className={styles.empty}>No messages with {peerName} yet</div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const sep =
            !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString() ? (
              <div key={`sep-${m.id}`} className={styles.daySep}>
                <span>{dayLabel(m.at)}</span>
              </div>
            ) : null;
          if (retracted[m.id]) {
            return (
              <div key={m.id}>
                {sep}
                <div className={clsx(styles.bubble, styles.retracted)}>Message deleted</div>
              </div>
            );
          }
          const agg = aggregate(reactions[m.id]);
          return (
            <div key={m.id}>
              {sep}
              <div className={clsx(styles.row, m.fromMe ? styles.rowMine : styles.rowTheirs)}>
              {m.fromName && <span className={styles.sender}>{m.fromName}</span>}
              <div className={clsx(styles.bubble, m.fromMe ? styles.mine : styles.theirs)}>
                {m.body && <span>{m.body}</span>}
                {m.file && <FileAttachment file={m.file} token={token} onOpenImage={setLightbox} />}
                {m.fromMe && !isRoom && (
                  <span
                    className={clsx(styles.tick, m.status === "read" && styles.tickRead)}
                    aria-label={m.status ?? "sent"}
                  >
                    {m.status === "sent" || !m.status ? "\u2713" : "\u2713\u2713"}
                  </span>
                )}
              </div>
              {!isRoom && (
                <div className={styles.msgActions}>
                  <button
                    type="button"
                    className={styles.reactBtn}
                    aria-label="Add reaction"
                    onClick={() => setReactOpen(reactOpen === m.id ? null : m.id)}
                  >
                    <i className="fa fa-smile-o" />
                  </button>
                  {m.fromMe && (
                    <button
                      type="button"
                      className={styles.reactBtn}
                      aria-label="Unsend"
                      onClick={() => retract(m.id)}
                    >
                      <i className="fa fa-trash-o" />
                    </button>
                  )}
                </div>
              )}
              {reactOpen === m.id && (
                <div className={styles.picker}>
                  {REACT_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        toggleReaction(m.id, e);
                        setReactOpen(null);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {agg.length > 0 && (
                <div className={styles.reactions}>
                  {agg.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      className={clsx(styles.chip, myId && r.users.includes(myId) && styles.chipMine)}
                      onClick={() => toggleReaction(m.id, r.emoji)}
                    >
                      {r.emoji} {r.count}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>
          );
        })}
        {typing[selectedPeer] && (
          <div className={styles.typing}>{`${peerName} is typing…`}</div>
        )}
      </div>

      <div className={styles.composer}>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void sendFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={styles.attach}
          aria-label="Attach file"
          title="Attach file"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <i className={uploading ? "fa fa-circle-o-notch fa-spin" : "fa fa-paperclip"} />
        </button>
        <button
          type="button"
          className={styles.attach}
          aria-label="Emoji"
          title="Emoji"
          onClick={() => setEmojiOpen((v) => !v)}
        >
          <i className="fa fa-smile-o" />
        </button>
        <input
          value={draft}
          placeholder={`Message ${peerName}`}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={stopTyping}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button type="button" className={styles.send} disabled={!draft.trim()} onClick={submit}>
          <i className="fa fa-paper-plane" />
        </button>
        {emojiOpen && (
          <div className={styles.composePicker}>
            {COMPOSE_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setDraft((d) => d + e);
                  setEmojiOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
