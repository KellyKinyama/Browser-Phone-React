import type { Buddy, BuddyType, DeviceState } from "../types/buddy";

export type BuddySortBy = "activity" | "alphabetical" | "extension" | "type";

/** Maps XMPP presence show values to the buddy status-dot states. */
export function presenceToDevState(presence: string): DeviceState {
  switch (presence) {
    case "online":
      return "dotOnline";
    case "away":
    case "dnd":
    case "xa":
      return "dotBusy";
    default:
      return "dotOffline";
  }
}

/** A read-only buddy projection of an XMPP chat contact (not persisted). */
export function chatContactToBuddy(id: string, name: string, presence: string): Buddy {
  return {
    type: "xmpp",
    identity: `chat:${id}`,
    chatId: id,
    callerIdName: name,
    email: "",
    desc: "",
    extNo: "",
    mobileNumber: "",
    contactNumber1: "",
    contactNumber2: "",
    lastActivity: null,
    devState: presenceToDevState(presence),
    presence,
    presenceText: presence === "online" ? "Online" : presence === "offline" ? "Offline" : presence,
    missed: 0,
    imageObjectUrl: "",
    enableDuringDnd: false,
    enableSubscribe: false,
    subscribeUser: "",
    allowAutoDelete: false,
    pinned: false
  };
}

export interface NewBuddyInput {
  type?: BuddyType;
  callerIdName?: string;
  extNo?: string;
  mobileNumber?: string;
  contactNumber1?: string;
  contactNumber2?: string;
  email?: string;
  desc?: string;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBuddy(input: NewBuddyInput): Buddy {
  const type = input.type ?? "contact";
  return {
    type,
    identity: uid(),
    jid: undefined,
    callerIdName: input.callerIdName ?? "",
    email: input.email ?? "",
    desc: input.desc ?? "",
    extNo: input.extNo ?? "",
    mobileNumber: input.mobileNumber ?? "",
    contactNumber1: input.contactNumber1 ?? "",
    contactNumber2: input.contactNumber2 ?? "",
    lastActivity: null,
    devState: "dotOffline",
    presence: "Unknown",
    presenceText: "",
    missed: 0,
    imageObjectUrl: "",
    enableDuringDnd: false,
    enableSubscribe: type === "extension",
    subscribeUser: input.extNo ?? "",
    allowAutoDelete: false,
    pinned: false
  };
}

function displayName(b: Buddy): string {
  return b.callerIdName || b.extNo || b.mobileNumber || "";
}

function activityTime(b: Buddy): number {
  if (!b.lastActivity) return 0;
  const t = Date.parse(b.lastActivity.replace(" UTC", "Z"));
  return Number.isNaN(t) ? 0 : t;
}

export function sortBuddies(buddies: Buddy[], sortBy: BuddySortBy): Buddy[] {
  const arr = [...buddies];
  const byName = (a: Buddy, b: Buddy) => displayName(a).localeCompare(displayName(b));
  switch (sortBy) {
    case "alphabetical":
      arr.sort(byName);
      break;
    case "extension":
      arr.sort((a, b) => a.extNo.localeCompare(b.extNo, undefined, { numeric: true }) || byName(a, b));
      break;
    case "type":
      arr.sort((a, b) => a.type.localeCompare(b.type) || byName(a, b));
      break;
    case "activity":
    default:
      arr.sort((a, b) => activityTime(b) - activityTime(a) || byName(a, b));
      break;
  }
  return arr;
}

/** Sorted list with pinned contacts floated to the top. */
export function arrangeBuddies(buddies: Buddy[], sortBy: BuddySortBy): Buddy[] {
  const sorted = sortBuddies(buddies, sortBy);
  return [...sorted.filter((b) => b.pinned), ...sorted.filter((b) => !b.pinned)];
}

export function filterBuddies(buddies: Buddy[], term: string): Buddy[] {
  const q = term.trim().toLowerCase();
  if (!q) return buddies;
  return buddies.filter((b) =>
    [b.callerIdName, b.extNo, b.mobileNumber, b.contactNumber1, b.contactNumber2, b.email]
      .some((v) => v.toLowerCase().includes(q))
  );
}
