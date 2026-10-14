import type {
  ChatContact,
  ChatConnState,
  ChatRoom,
  FileMeta
} from "../../services/chat/ChatClient";
import { chatClient } from "../chatService";
import type { AppStateCreator } from "../types";

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  body: string;
  at: number;
  status?: "sent" | "delivered" | "read";
  file?: FileMeta;
  fromName?: string;
}

export interface ChatSlice {
  chatStatus: ChatConnState;
  chatError: string | null;
  chatMyId: string | null;
  chatMyName: string | null;
  chatToken: string | null;
  chatContacts: ChatContact[];
  chatConversations: Record<string, ChatMessage[]>;
  chatSelectedPeer: string | null;
  chatUnread: Record<string, number>;
  chatHistoryLoaded: Record<string, boolean>;
  chatTyping: Record<string, boolean>;
  chatReactions: Record<string, Record<string, string[]>>;
  chatRetracted: Record<string, boolean>;
  chatRooms: ChatRoom[];
  chatRoomOccupants: Record<string, string[]>;
  chatUploading: boolean;
  chatConnect: (email: string, password: string) => Promise<void>;
  chatDisconnect: () => void;
  chatSelectPeer: (peerId: string) => void;
  chatSend: (body: string) => void;
  chatLoadHistory: (peerId: string) => Promise<void>;
  chatSetTyping: (composing: boolean) => void;
  chatToggleReaction: (messageId: string, emoji: string) => void;
  chatRetract: (messageId: string) => void;
  chatLoadRooms: () => Promise<void>;
  chatCreateRoom: (name: string) => Promise<void>;
  chatInvite: (roomId: string, userId: string) => Promise<void>;
  chatSendFile: (file: File) => Promise<void>;
}

const isRoomId = (get: () => ChatSlice, id: string): boolean =>
  get().chatRooms.some((r) => r.id === id);

const newStanzaId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

let chatSeq = 0;
let wired = false;

export const createChatSlice: AppStateCreator<ChatSlice> = (set, get) => ({
  chatStatus: "disconnected",
  chatError: null,
  chatMyId: null,
  chatMyName: null,
  chatToken: null,
  chatContacts: [],
  chatConversations: {},
  chatSelectedPeer: null,
  chatUnread: {},
  chatHistoryLoaded: {},
  chatTyping: {},
  chatReactions: {},
  chatRetracted: {},
  chatRooms: [],
  chatRoomOccupants: {},
  chatUploading: false,

  chatConnect: async (email, password) => {
    set(
      {
        chatStatus: "connecting",
        chatError: null,
        chatConversations: {},
        chatUnread: {},
        chatHistoryLoaded: {},
        chatTyping: {},
        chatReactions: {},
        chatRetracted: {},
        chatRooms: [],
        chatRoomOccupants: {}
      },
      false,
      "chat/connecting"
    );
    try {
      if (!wired) {
        chatClient.onStateChange = (s) => set({ chatStatus: s }, false, "chat/state");
        chatClient.onMessage = (m) => {
          const msg: ChatMessage = {
            id: m.id ?? `in-${++chatSeq}`,
            fromMe: false,
            body: m.body,
            at: Date.now(),
            file: m.file
          };
          const open = get().chatSelectedPeer === m.fromId;
          if (open && m.id) chatClient.sendReadMarker(m.fromId, m.id);
          set(
            (st) => {
              const conv = st.chatConversations[m.fromId] ?? [];
              return {
                chatConversations: { ...st.chatConversations, [m.fromId]: [...conv, msg] },
                chatTyping: { ...st.chatTyping, [m.fromId]: false },
                chatUnread: open
                  ? st.chatUnread
                  : { ...st.chatUnread, [m.fromId]: (st.chatUnread[m.fromId] ?? 0) + 1 }
              };
            },
            false,
            "chat/recv"
          );
        };
        chatClient.onChatState = (fromId, state) => {
          set(
            (st) => ({ chatTyping: { ...st.chatTyping, [fromId]: state === "composing" } }),
            false,
            "chat/typing"
          );
        };
        chatClient.onReceipt = (fromId, stanzaId, kind) => {
          const rank = { sent: 0, delivered: 1, read: 2 } as const;
          set(
            (st) => {
              const conv = st.chatConversations[fromId];
              if (!conv) return {};
              let changed = false;
              const next = conv.map((m) => {
                if (m.id === stanzaId && m.fromMe) {
                  const cur = rank[m.status ?? "sent"];
                  if (rank[kind] > cur) {
                    changed = true;
                    return { ...m, status: kind };
                  }
                }
                return m;
              });
              return changed
                ? { chatConversations: { ...st.chatConversations, [fromId]: next } }
                : {};
            },
            false,
            "chat/receipt"
          );
        };
        chatClient.onReaction = (fromId, targetId, emojis) => {
          set(
            (st) => {
              const forMsg = { ...(st.chatReactions[targetId] ?? {}) };
              if (emojis.length === 0) delete forMsg[fromId];
              else forMsg[fromId] = emojis;
              return { chatReactions: { ...st.chatReactions, [targetId]: forMsg } };
            },
            false,
            "chat/reaction"
          );
        };
        chatClient.onRetract = (_fromId, targetId) => {
          set(
            (st) => ({ chatRetracted: { ...st.chatRetracted, [targetId]: true } }),
            false,
            "chat/retract"
          );
        };
        chatClient.onCarbonSent = (toId, body, id, file) => {
          set(
            (st) => {
              const conv = st.chatConversations[toId] ?? [];
              if (id && conv.some((m) => m.id === id)) return {};
              const msg: ChatMessage = {
                id: id ?? `cb-${++chatSeq}`,
                fromMe: true,
                body,
                at: Date.now(),
                status: "sent",
                file
              };
              return { chatConversations: { ...st.chatConversations, [toId]: [...conv, msg] } };
            },
            false,
            "chat/carbon"
          );
        };
        chatClient.onGroupMessage = (roomId, nick, body, id, file) => {
          const me = get().chatMyId;
          const fromMe = nick === me;
          const name = get().chatContacts.find((c) => c.id === nick)?.name ?? nick;
          set(
            (st) => {
              const conv = st.chatConversations[roomId] ?? [];
              if (id && conv.some((m) => m.id === id)) return {};
              const msg: ChatMessage = {
                id: id ?? `g-${++chatSeq}`,
                fromMe,
                body,
                at: Date.now(),
                file,
                fromName: fromMe ? undefined : name
              };
              const open = st.chatSelectedPeer === roomId;
              return {
                chatConversations: { ...st.chatConversations, [roomId]: [...conv, msg] },
                chatUnread:
                  open || fromMe
                    ? st.chatUnread
                    : { ...st.chatUnread, [roomId]: (st.chatUnread[roomId] ?? 0) + 1 }
              };
            },
            false,
            "chat/group/recv"
          );
        };
        chatClient.onOccupant = (roomId, userId, present) => {
          set(
            (st) => {
              const cur = st.chatRoomOccupants[roomId] ?? [];
              const next = present
                ? cur.includes(userId)
                  ? cur
                  : [...cur, userId]
                : cur.filter((u) => u !== userId);
              return { chatRoomOccupants: { ...st.chatRoomOccupants, [roomId]: next } };
            },
            false,
            "chat/occupant"
          );
        };
        chatClient.onRoomSubject = (roomId, subject) => {
          set(
            (st) => ({
              chatRooms: st.chatRooms.map((r) =>
                r.id === roomId ? { ...r, topic: subject } : r
              )
            }),
            false,
            "chat/room/subject"
          );
        };
        chatClient.onPresence = (fromId, show) => {
          set(
            (st) => ({
              chatContacts: st.chatContacts.map((c) =>
                c.id === fromId ? { ...c, presence: show } : c
              )
            }),
            false,
            "chat/presence"
          );
        };
        wired = true;
      }

      const auth = await chatClient.login(email, password);
      const contacts = await chatClient.fetchContacts(auth.token);
      await chatClient.connect(email, auth.token, "phone");

      const selected = contacts[0]?.id ?? null;
      set(
        {
          chatMyId: auth.userId,
          chatMyName: auth.displayName,
          chatToken: auth.token,
          chatContacts: contacts,
          chatSelectedPeer: selected
        },
        false,
        "chat/connected"
      );
      if (selected) void get().chatLoadHistory(selected);
      void get().chatLoadRooms();
    } catch (e) {
      set(
        { chatStatus: "failed", chatError: e instanceof Error ? e.message : String(e) },
        false,
        "chat/failed"
      );
    }
  },

  chatDisconnect: () => {
    chatClient.disconnect();
    set({ chatStatus: "disconnected" }, false, "chat/disconnect");
  },

  chatSelectPeer: (peerId) => {
    set(
      (st) => ({
        chatSelectedPeer: peerId,
        chatUnread: { ...st.chatUnread, [peerId]: 0 }
      }),
      false,
      "chat/selectPeer"
    );
    if (!isRoomId(get, peerId)) {
      const conv = get().chatConversations[peerId] ?? [];
      const lastIn = [...conv].reverse().find((m) => !m.fromMe);
      if (lastIn) chatClient.sendReadMarker(peerId, lastIn.id);
    }
    void get().chatLoadHistory(peerId);
  },

  chatSetTyping: (composing) => {
    const peer = get().chatSelectedPeer;
    if (!peer || get().chatStatus !== "connected") return;
    chatClient.sendChatState(peer, composing ? "composing" : "paused");
  },

  chatToggleReaction: (messageId, emoji) => {
    const peer = get().chatSelectedPeer;
    const myId = get().chatMyId;
    if (!peer || !myId) return;
    const mine = get().chatReactions[messageId]?.[myId] ?? [];
    const next = mine.includes(emoji) ? mine.filter((e) => e !== emoji) : [...mine, emoji];
    chatClient.sendReaction(peer, messageId, next);
    set(
      (st) => {
        const forMsg = { ...(st.chatReactions[messageId] ?? {}) };
        if (next.length === 0) delete forMsg[myId];
        else forMsg[myId] = next;
        return { chatReactions: { ...st.chatReactions, [messageId]: forMsg } };
      },
      false,
      "chat/reaction/toggle"
    );
  },

  chatRetract: (messageId) => {
    const peer = get().chatSelectedPeer;
    if (!peer) return;
    chatClient.retractMessage(peer, messageId);
    set(
      (st) => ({ chatRetracted: { ...st.chatRetracted, [messageId]: true } }),
      false,
      "chat/retract/self"
    );
  },

  chatLoadRooms: async () => {
    const token = get().chatToken;
    const myId = get().chatMyId;
    if (!token || !myId) return;
    try {
      const invites = await chatClient.listRoomInvitations(token);
      for (const inv of invites) {
        await chatClient.setRoomStatus(token, inv.id, myId, "accepted");
      }
      const rooms = await chatClient.listRooms(token);
      set({ chatRooms: rooms }, false, "chat/rooms");
      for (const r of rooms) chatClient.joinRoom(r.id, myId);
    } catch {
      /* ignore */
    }
  },

  chatCreateRoom: async (name) => {
    const token = get().chatToken;
    const myId = get().chatMyId;
    if (!token || !myId || name.trim() === "") return;
    try {
      const room = await chatClient.createRoom(token, name.trim());
      chatClient.joinRoom(room.id, myId);
      set(
        (st) => ({
          chatRooms: [...st.chatRooms.filter((r) => r.id !== room.id), room],
          chatSelectedPeer: room.id
        }),
        false,
        "chat/room/create"
      );
      void get().chatLoadHistory(room.id);
    } catch (e) {
      set(
        { chatError: e instanceof Error ? e.message : String(e) },
        false,
        "chat/room/error"
      );
    }
  },

  chatInvite: async (roomId, userId) => {
    const token = get().chatToken;
    if (!token) return;
    try {
      await chatClient.inviteToRoom(token, roomId, userId);
    } catch {
      /* ignore */
    }
  },

  chatSendFile: async (file) => {
    const peer = get().chatSelectedPeer;
    const token = get().chatToken;
    if (!peer || !token) return;
    const room = isRoomId(get, peer);
    set({ chatUploading: true }, false, "chat/file/start");
    try {
      const meta = await chatClient.uploadFile(token, chatClient.jidFor(peer, room), file);
      const id = newStanzaId();
      if (room) {
        chatClient.sendGroupMessage(peer, file.name, id, meta);
        return;
      }
      chatClient.sendMessage(peer, file.name, id, meta);
      const msg: ChatMessage = {
        id,
        fromMe: true,
        body: file.name,
        at: Date.now(),
        status: "sent",
        file: meta
      };
      set(
        (st) => ({
          chatConversations: {
            ...st.chatConversations,
            [peer]: [...(st.chatConversations[peer] ?? []), msg]
          }
        }),
        false,
        "chat/file/send"
      );
    } catch (e) {
      set(
        { chatError: e instanceof Error ? e.message : String(e) },
        false,
        "chat/file/error"
      );
    } finally {
      set({ chatUploading: false }, false, "chat/file/done");
    }
  },

  chatLoadHistory: async (peerId) => {
    if (get().chatHistoryLoaded[peerId]) return;
    set(
      (st) => ({ chatHistoryLoaded: { ...st.chatHistoryLoaded, [peerId]: true } }),
      false,
      "chat/history/load"
    );
    try {
      const room = isRoomId(get, peerId);
      const arch = await chatClient.loadHistory(peerId, { room });
      if (arch.length === 0) return;
      const hist: ChatMessage[] = arch.map((a) => ({
        id: a.id || `mam-${++chatSeq}`,
        fromMe: a.fromMe,
        body: a.body,
        at: Date.parse(a.stamp) || Date.now(),
        file: a.file,
        fromName:
          room && !a.fromMe && a.fromId
            ? get().chatContacts.find((c) => c.id === a.fromId)?.name ?? a.fromId
            : undefined
      }));
      set(
        (st) => {
          const existing = st.chatConversations[peerId] ?? [];
          const seen = new Set(existing.map((m) => m.id));
          const merged = [...hist.filter((m) => !seen.has(m.id)), ...existing].sort(
            (a, b) => a.at - b.at
          );
          return { chatConversations: { ...st.chatConversations, [peerId]: merged } };
        },
        false,
        "chat/history/merge"
      );
    } catch {
      /* ignore */
    }
  },

  chatSend: (body) => {
    const peer = get().chatSelectedPeer;
    const text = body.trim();
    if (!peer || text === "") return;
    const id = newStanzaId();
    if (isRoomId(get, peer)) {
      chatClient.sendGroupMessage(peer, text, id);
      return;
    }
    chatClient.sendMessage(peer, text, id);
    const msg: ChatMessage = { id, fromMe: true, body: text, at: Date.now(), status: "sent" };
    set(
      (st) => ({
        chatConversations: {
          ...st.chatConversations,
          [peer]: [...(st.chatConversations[peer] ?? []), msg]
        }
      }),
      false,
      "chat/send"
    );
  }
});
