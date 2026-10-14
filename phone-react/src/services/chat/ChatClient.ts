// Minimal XMPP-over-WebSocket (RFC 7395) client for the chatstub-server, plus
// its REST login + contacts. Hand-rolled to match the server's exact wire
// (see chatstub-server/tool/smoke-phase3.dart): REST token -> SASL PLAIN
// (email, token) -> bind -> 1:1 <message type="chat"> addressed by user id.

export interface ChatConfig {
  baseUrl: string; // e.g. http://localhost:8080
  wsUrl: string; // e.g. ws://localhost:8080/websocket
  domain: string; // XMPP domain used in stanza addressing, e.g. "localhost"
  appAuth: string; // "Basic base64(appId:appSecret)"
}

export const defaultChatConfig: ChatConfig = {
  baseUrl: readChatOverride("chatBaseUrl", "http://localhost:8080"),
  wsUrl: readChatOverride("chatWsUrl", "ws://localhost:8080/websocket"),
  domain: readChatOverride("chatDomain", "localhost"),
  appAuth:
    "Basic NjVjNjgxYzAxYzhmMTFlOWFkZDg5MzJiMzU4ZWY4MWQ6VVlkdTN3Q1hUZGZ5akltaFVSbklrWjB0YWM1SjlYU0xzeklLQlJVVVdWQjM1YjZuVDNmV1YyQmhBR2hvamRCUQ=="
};

function readChatOverride(key: string, fallback: string): string {
  try {
    return (typeof localStorage !== "undefined" && localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

export interface ChatLoginResult {
  token: string;
  userId: string;
  displayName: string;
}

export interface ChatContact {
  id: string;
  name: string;
  presence: string;
}

export interface IncomingChat {
  fromId: string;
  body: string;
  id?: string;
  file?: FileMeta;
}

export interface FileMeta {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
}

export interface ChatRoom {
  id: string;
  name: string;
  topic: string;
  members: string[];
}

export interface ArchivedMessage {
  peerId: string;
  fromMe: boolean;
  body: string;
  id: string;
  stamp: string;
  file?: FileMeta;
  fromId?: string;
}

export type ChatConnState = "disconnected" | "connecting" | "connected" | "failed";

export type ReceiptKind = "delivered" | "read";

interface Waiter {
  pred: (el: Element) => boolean;
  resolve: (el: Element) => void;
  reject: (e: unknown) => void;
  timer: number;
}

function parseStanza(xml: string): Element | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  return doc.documentElement;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MAM2 = "urn:xmpp:mam:2";
const RECEIPTS = "urn:xmpp:receipts";
const MARKERS = "urn:xmpp:chat-markers:0";
const CHATSTATES = "http://jabber.org/protocol/chatstates";
const REACTIONS = "urn:xmpp:reactions:0";
const RETRACT = "urn:xmpp:message-retract:1";
const SM3 = "urn:xmpp:sm:3";
const CARBONS = "urn:xmpp:carbons:2";
const MUCUSER = "http://jabber.org/protocol/muc#user";
const FILENS = "urn:rainbow:file:1";

function parseFile(el: Element): FileMeta | undefined {
  const f = el.getElementsByTagNameNS(FILENS, "file")[0];
  if (!f) return undefined;
  return {
    id: f.getAttribute("id") ?? "",
    url: f.getAttribute("url") ?? "",
    name: f.getAttribute("name") ?? "",
    mime: f.getAttribute("mime") ?? "",
    size: Number(f.getAttribute("size") ?? 0)
  };
}

function fileXml(file: FileMeta): string {
  return (
    `<file xmlns="${FILENS}" id="${escapeXml(file.id)}" url="${escapeXml(file.url)}" ` +
    `name="${escapeXml(file.name)}" mime="${escapeXml(file.mime)}" size="${file.size}"/>`
  );
}

export class ChatClient {
  private ws: WebSocket | null = null;
  private waiters: Waiter[] = [];
  private mamCollectors = new Map<string, ArchivedMessage[]>();
  private mamSeq = 0;
  private myLocal = "";
  private hIn = 0;
  private smid = "";
  private smResumable = false;
  jid = "";

  onMessage?: (m: IncomingChat) => void;
  onStateChange?: (s: ChatConnState) => void;
  onPresence?: (fromId: string, show: string) => void;
  onChatState?: (fromId: string, state: string) => void;
  onReceipt?: (fromId: string, stanzaId: string, kind: ReceiptKind) => void;
  onReaction?: (fromId: string, targetId: string, emojis: string[]) => void;
  onRetract?: (fromId: string, targetId: string) => void;
  onCarbonSent?: (toId: string, body: string, id?: string, file?: FileMeta) => void;
  onGroupMessage?: (roomId: string, fromId: string, body: string, id?: string, file?: FileMeta) => void;
  onOccupant?: (roomId: string, userId: string, present: boolean, selfJoin: boolean) => void;
  onRoomSubject?: (roomId: string, subject: string) => void;

  constructor(private config: ChatConfig = defaultChatConfig) {}

  private get mucDomain(): string {
    return `muc.${this.config.domain}`;
  }

  jidFor(id: string, room = false): string {
    return room ? `${id}@${this.mucDomain}` : `${id}@${this.config.domain}`;
  }

  async login(email: string, password: string): Promise<ChatLoginResult> {
    const basic = "Basic " + btoa(`${email}:${password}`);
    const res = await fetch(`${this.config.baseUrl}/api/rainbow/authentication/v1.0/login`, {
      headers: { authorization: basic, "x-rainbow-app-auth": this.config.appAuth }
    });
    if (!res.ok) throw new Error(`Login failed (${res.status})`);
    const j = await res.json();
    return {
      token: j.token as string,
      userId: j.loggedInUser.id as string,
      displayName: (j.loggedInUser.displayName as string) || email
    };
  }

  async fetchContacts(token: string): Promise<ChatContact[]> {
    const res = await fetch(`${this.config.baseUrl}/api/rainbow/enduser/v1.0/users/networks`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const j = await res.json();
    const data = (j.data ?? []) as Array<Record<string, unknown>>;
    return data.map((e) => {
      const peer = (e.peerUser ?? {}) as Record<string, unknown>;
      const presence = (peer.presence ?? {}) as Record<string, unknown>;
      return {
        id: String(e.peerId),
        name: (peer.displayName as string) || String(e.peerId),
        presence: (presence.presence as string) || "offline"
      };
    });
  }

  private send(s: string): void {
    this.ws?.send(s);
  }

  // ---- Rooms / bubbles (REST) ----------------------------------------

  private roomFromJson(e: Record<string, unknown>): ChatRoom {
    const users = (e.users ?? []) as Array<Record<string, unknown>>;
    return {
      id: String(e.id),
      name: (e.name as string) || String(e.id),
      topic: (e.topic as string) ?? "",
      members: users.filter((u) => u.status === "accepted").map((u) => String(u.userId))
    };
  }

  async listRooms(token: string): Promise<ChatRoom[]> {
    const res = await fetch(`${this.config.baseUrl}/api/rainbow/enduser/v1.0/rooms`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const j = await res.json();
    return ((j.data ?? []) as Array<Record<string, unknown>>).map((e) => this.roomFromJson(e));
  }

  async listRoomInvitations(token: string): Promise<ChatRoom[]> {
    const res = await fetch(
      `${this.config.baseUrl}/api/rainbow/enduser/v1.0/rooms/invitations`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const j = await res.json();
    return ((j.data ?? []) as Array<Record<string, unknown>>).map((e) => this.roomFromJson(e));
  }

  async createRoom(token: string, name: string, topic = ""): Promise<ChatRoom> {
    const res = await fetch(`${this.config.baseUrl}/api/rainbow/enduser/v1.0/rooms`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name, topic, visibility: "private" })
    });
    if (!res.ok) throw new Error(`Create room failed (${res.status})`);
    const j = await res.json();
    return this.roomFromJson(j.data);
  }

  async inviteToRoom(token: string, roomId: string, userId: string): Promise<void> {
    await fetch(
      `${this.config.baseUrl}/api/rainbow/enduser/v1.0/rooms/${roomId}/users`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ userId })
      }
    );
  }

  async setRoomStatus(
    token: string,
    roomId: string,
    userId: string,
    status: "accepted" | "declined" | "left"
  ): Promise<void> {
    await fetch(
      `${this.config.baseUrl}/api/rainbow/enduser/v1.0/rooms/${roomId}/users/${userId}`,
      {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ status })
      }
    );
  }

  // ---- Files (REST) --------------------------------------------------

  async uploadFile(token: string, peerJid: string, file: File): Promise<FileMeta> {
    const mime = file.type || "application/octet-stream";
    const createRes = await fetch(
      `${this.config.baseUrl}/api/rainbow/fileServer/v1.0/files`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          peer: peerJid,
          peerType: "user",
          fileName: file.name,
          mime,
          size: file.size
        })
      }
    );
    if (!createRes.ok) throw new Error(`File create failed (${createRes.status})`);
    const cj = await createRes.json();
    const id = String(cj.data.id);
    const putRes = await fetch(
      `${this.config.baseUrl}/api/rainbow/fileServer/v1.0/files/${id}/data`,
      {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": mime },
        body: file
      }
    );
    if (!putRes.ok) throw new Error(`File upload failed (${putRes.status})`);
    const d = (await putRes.json()).data as Record<string, unknown>;
    return {
      id: String(d.id),
      url: String(d.downloadUrl),
      name: String(d.fileName),
      mime: String(d.mime),
      size: Number(d.size)
    };
  }

  // GET /files/<id>/data is bearer-protected, so fetch + blob URL for display.
  async downloadFile(url: string, token: string): Promise<string> {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    return URL.createObjectURL(await res.blob());
  }

  // ---- Rooms (XMPP) --------------------------------------------------

  joinRoom(roomId: string, nick: string): void {
    this.send(`<presence to="${escapeXml(roomId)}@${this.mucDomain}/${escapeXml(nick)}"/>`);
  }

  sendGroupMessage(roomId: string, body: string, id: string, file?: FileMeta): void {
    this.send(
      `<message id="${id}" to="${escapeXml(roomId)}@${this.mucDomain}" type="groupchat">` +
        `<body>${escapeXml(body)}</body>${file ? fileXml(file) : ""}</message>`
    );
  }

  private waitFor(pred: (el: Element) => boolean, ms = 6000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.timer !== timer);
        reject(new Error("XMPP handshake timeout"));
      }, ms);
      this.waiters.push({ pred, resolve, reject, timer });
    });
  }

  private handleStanza(el: Element): void {
    for (let i = 0; i < this.waiters.length; i++) {
      if (this.waiters[i].pred(el)) {
        const w = this.waiters.splice(i, 1)[0];
        window.clearTimeout(w.timer);
        w.resolve(el);
        i--;
      }
    }

    // XEP-0198 stream management control elements.
    const ln = el.localName;
    if (ln === "enabled") {
      this.smid = el.getAttribute("id") ?? "";
      this.smResumable = el.getAttribute("resume") === "true";
      return;
    }
    if (ln === "r") {
      this.send(`<a xmlns="${SM3}" h="${this.hIn}"/>`);
      return;
    }
    if (ln === "a" || ln === "resumed" || ln === "failed") return;
    // Count handled stanzas for SM acks.
    if (ln === "message" || ln === "presence" || ln === "iq") this.hIn++;

    if (el.localName === "message") {
      const result = el.getElementsByTagNameNS(MAM2, "result")[0];
      if (result) {
        this.collectMamResult(result);
        return;
      }

      // XEP-0280 sent carbon — my own message echoed from another session.
      const sent = el.getElementsByTagNameNS(CARBONS, "sent")[0];
      if (sent) {
        const inner = sent.getElementsByTagName("message")[0];
        if (inner) {
          const toId = (inner.getAttribute("to") ?? "").split("/")[0].split("@")[0];
          const cb = inner.getElementsByTagName("body")[0]?.textContent ?? "";
          if (cb && toId) {
            this.onCarbonSent?.(toId, cb, inner.getAttribute("id") ?? undefined, parseFile(inner));
          }
        }
        return;
      }

      // XEP-0045 group chat. Live broadcasts carry to=<room> + from=<senderJid>;
      // standard/MAM form carries from=<room>/<nick>.
      if (el.getAttribute("type") === "groupchat") {
        const gto = el.getAttribute("to") ?? "";
        const gfrom = el.getAttribute("from") ?? "";
        let roomId: string;
        let nick: string;
        if (gto.includes(`@${this.mucDomain}`)) {
          roomId = gto.split("/")[0].split("@")[0];
          nick = gfrom.split("/")[0].split("@")[0];
        } else {
          roomId = gfrom.split("/")[0].split("@")[0];
          nick = gfrom.split("/")[1] ?? "";
        }
        const subject = el.getElementsByTagName("subject")[0]?.textContent;
        const gbody = el.getElementsByTagName("body")[0]?.textContent ?? "";
        if (subject != null && !gbody) {
          this.onRoomSubject?.(roomId, subject);
          return;
        }
        if (gbody || parseFile(el)) {
          this.onGroupMessage?.(
            roomId,
            nick,
            gbody,
            el.getAttribute("id") ?? undefined,
            parseFile(el)
          );
        }
        return;
      }

      const from = el.getAttribute("from") ?? "";
      const fromId = from.split("/")[0].split("@")[0];
      if (!fromId) return;

      const received = el.getElementsByTagNameNS(RECEIPTS, "received")[0];
      if (received) {
        this.onReceipt?.(fromId, received.getAttribute("id") ?? "", "delivered");
        return;
      }
      const displayed = el.getElementsByTagNameNS(MARKERS, "displayed")[0];
      if (displayed) {
        this.onReceipt?.(fromId, displayed.getAttribute("id") ?? "", "read");
        return;
      }

      const reactions = el.getElementsByTagNameNS(REACTIONS, "reactions")[0];
      if (reactions) {
        const emojis = Array.from(reactions.getElementsByTagName("reaction"))
          .map((r) => r.textContent ?? "")
          .filter(Boolean);
        this.onReaction?.(fromId, reactions.getAttribute("id") ?? "", emojis);
        return;
      }
      const retract = el.getElementsByTagNameNS(RETRACT, "retract")[0];
      if (retract) {
        this.onRetract?.(fromId, retract.getAttribute("id") ?? "");
        return;
      }

      const file = parseFile(el);
      const body = el.getElementsByTagName("body")[0]?.textContent ?? "";
      if (!body && !file) {
        const state = Array.from(el.children).find((c) => c.namespaceURI === CHATSTATES);
        if (state) this.onChatState?.(fromId, state.localName);
        return;
      }
      const id = el.getAttribute("id") ?? undefined;
      this.onMessage?.({ fromId, body, id, file });
      if (id) this.sendDeliveryReceipt(fromId, id);
    } else if (el.localName === "presence") {
      const from = el.getAttribute("from") ?? "";
      const bare = from.split("/")[0];
      const nick = from.split("/")[1] ?? "";
      if (bare.endsWith(`@${this.mucDomain}`)) {
        const roomId = bare.split("@")[0];
        const type = el.getAttribute("type");
        const mucUser = el.getElementsByTagNameNS(MUCUSER, "x")[0];
        const selfJoin =
          !!mucUser &&
          Array.from(mucUser.getElementsByTagName("status")).some(
            (s) => s.getAttribute("code") === "110"
          );
        if (nick) this.onOccupant?.(roomId, nick, type !== "unavailable", selfJoin);
        return;
      }
      const fromId = bare.split("@")[0];
      const type = el.getAttribute("type");
      const show =
        type === "unavailable"
          ? "offline"
          : el.getElementsByTagName("show")[0]?.textContent || "online";
      if (fromId) this.onPresence?.(fromId, show);
    }
  }

  async connect(email: string, token: string, resource = "phone"): Promise<void> {
    this.onStateChange?.("connecting");
    const ws = new WebSocket(this.config.wsUrl, "xmpp");
    this.ws = ws;
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket error"));
    });
    ws.onmessage = (e) => {
      const el = typeof e.data === "string" ? parseStanza(e.data) : null;
      if (el) this.handleStanza(el);
    };
    ws.onclose = () => this.onStateChange?.("disconnected");

    const open = () =>
      this.send(
        `<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" to="${this.config.domain}" version="1.0"/>`
      );

    // 1) stream open -> features
    let feats = this.waitFor((el) => el.localName === "features");
    open();
    await feats;

    // 2) SASL PLAIN using the REST token as the password
    const authRes = this.waitFor((el) => el.localName === "success" || el.localName === "failure");
    const payload = btoa(`\u0000${email}\u0000${token}`);
    this.send(`<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">${payload}</auth>`);
    const ar = await authRes;
    if (ar.localName !== "success") throw new Error("SASL authentication failed");

    // 3) re-open the stream -> features
    feats = this.waitFor((el) => el.localName === "features");
    open();
    await feats;

    // 4) resource bind
    const bindRes = this.waitFor((el) => el.localName === "iq" && el.getAttribute("type") === "result");
    this.send(
      `<iq type="set" id="bind1"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>${resource}</resource></bind></iq>`
    );
    const br = await bindRes;
    this.jid = br.getElementsByTagName("jid")[0]?.textContent ?? "";
    this.myLocal = this.jid.split("/")[0].split("@")[0];

    // 5) go online, then opt into carbons (XEP-0280) + stream mgmt (XEP-0198).
    this.send("<presence/>");
    this.send(`<iq type="set" id="carbons1"><enable xmlns="${CARBONS}"/></iq>`);
    this.hIn = 0;
    this.send(`<enable xmlns="${SM3}" resume="true"/>`);
    this.onStateChange?.("connected");
  }

  sendMessage(peerId: string, body: string, id: string, file?: FileMeta): void {
    this.send(
      `<message id="${id}" to="${peerId}@${this.config.domain}" type="chat">` +
        `<body>${escapeXml(body)}</body>` +
        `${file ? fileXml(file) : ""}` +
        `<request xmlns="${RECEIPTS}"/>` +
        `<markable xmlns="${MARKERS}"/>` +
        `</message>`
    );
  }

  sendChatState(peerId: string, state: "composing" | "paused" | "active"): void {
    this.send(
      `<message to="${peerId}@${this.config.domain}" type="chat">` +
        `<${state} xmlns="${CHATSTATES}"/></message>`
    );
  }

  sendDeliveryReceipt(peerId: string, stanzaId: string): void {
    this.send(
      `<message to="${peerId}@${this.config.domain}">` +
        `<received xmlns="${RECEIPTS}" id="${escapeXml(stanzaId)}"/></message>`
    );
  }

  sendReadMarker(peerId: string, stanzaId: string): void {
    this.send(
      `<message to="${peerId}@${this.config.domain}" type="chat">` +
        `<displayed xmlns="${MARKERS}" id="${escapeXml(stanzaId)}"/></message>`
    );
  }

  // XEP-0444: send the full snapshot of my reactions on a target message.
  sendReaction(peerId: string, targetId: string, emojis: string[]): void {
    const body = emojis.map((e) => `<reaction>${escapeXml(e)}</reaction>`).join("");
    this.send(
      `<message to="${peerId}@${this.config.domain}" type="chat">` +
        `<reactions xmlns="${REACTIONS}" id="${escapeXml(targetId)}">${body}</reactions>` +
        `</message>`
    );
  }

  // XEP-0424: retract one of my own messages.
  retractMessage(peerId: string, targetId: string): void {
    this.send(
      `<message to="${peerId}@${this.config.domain}" type="chat">` +
        `<retract xmlns="${RETRACT}" id="${escapeXml(targetId)}"/></message>`
    );
  }

  private collectMamResult(result: Element): void {
    const queryid = result.getAttribute("queryid") ?? "";
    const coll = this.mamCollectors.get(queryid);
    if (!coll) return;
    const inner = result.getElementsByTagName("message")[0];
    if (!inner) return;
    const body = inner.getElementsByTagName("body")[0]?.textContent ?? "";
    const file = parseFile(inner);
    if (!body && !file) return;
    const stamp = result.getElementsByTagName("delay")[0]?.getAttribute("stamp") ?? "";
    const fromFull = inner.getAttribute("from") ?? "";

    // Group-chat archive: from = <room>@muc.<domain>/<nick>.
    if (inner.getAttribute("type") === "groupchat" || fromFull.includes(`@${this.mucDomain}`)) {
      const roomId = fromFull.split("/")[0].split("@")[0];
      const nick = fromFull.split("/")[1] ?? "";
      coll.push({
        peerId: roomId,
        fromMe: nick === this.myLocal,
        body,
        id: inner.getAttribute("id") ?? result.getAttribute("id") ?? "",
        stamp,
        file,
        fromId: nick
      });
      return;
    }

    const fromLocal = fromFull.split("/")[0].split("@")[0];
    const toLocal = (inner.getAttribute("to") ?? "").split("/")[0].split("@")[0];
    const fromMe = fromLocal === this.myLocal;
    coll.push({
      peerId: fromMe ? toLocal : fromLocal,
      fromMe,
      body,
      id: inner.getAttribute("id") ?? result.getAttribute("id") ?? "",
      stamp,
      file
    });
  }

  // XEP-0313 MAM: fetch the persisted archive for a 1:1 peer or a room (oldest-first).
  async loadHistory(targetId: string, opts: { room?: boolean; max?: number } = {}): Promise<ArchivedMessage[]> {
    if (!this.ws) return [];
    const max = opts.max ?? 50;
    const withJid = opts.room
      ? `${targetId}@${this.mucDomain}`
      : `${targetId}@${this.config.domain}`;
    const queryId = `mam-${++this.mamSeq}`;
    this.mamCollectors.set(queryId, []);
    const fin = this.waitFor(
      (el) => el.localName === "iq" && el.getAttribute("id") === queryId,
      8000
    );
    this.send(
      `<iq type="set" id="${queryId}">` +
        `<query xmlns="${MAM2}" queryid="${queryId}">` +
        `<x xmlns="jabber:x:data" type="submit">` +
        `<field var="FORM_TYPE" type="hidden"><value>${MAM2}</value></field>` +
        `<field var="with"><value>${escapeXml(withJid)}</value></field>` +
        `</x>` +
        `<set xmlns="http://jabber.org/protocol/rsm"><max>${max}</max></set>` +
        `</query></iq>`
    );
    try {
      await fin;
    } catch {
      /* timeout: return whatever arrived */
    }
    const out = this.mamCollectors.get(queryId) ?? [];
    this.mamCollectors.delete(queryId);
    return out;
  }

  disconnect(): void {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}
