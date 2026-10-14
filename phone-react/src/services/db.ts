import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Buddy } from "../types/buddy";

// ============================================================================
// IndexedDB layer for bulk/durable data (contacts, chat, call history,
// recordings, QoS). The Zustand store keeps lightweight working copies; heavy
// records and blobs live here. Mirrors the original app's IndexedDB usage.
// ============================================================================

export interface StoredMessage {
  id: string;
  buddy: string;
  direction: "in" | "out";
  text: string;
  timestamp: number;
  delivered?: boolean;
  read?: boolean;
}

export interface CallRecord {
  id: string;
  buddy: string;
  direction: "inbound" | "outbound";
  number: string;
  startedAt: number;
  durationSec: number;
  withVideo: boolean;
  missed: boolean;
  hasRecording: boolean;
}

export interface CallRecording {
  id: string;
  cdrId: string;
  buddy: string;
  kind: "audio" | "video";
  createdAt: number;
  blob: Blob;
}

export interface QosSample {
  id: string;
  sessionId: string;
  buddy: string;
  createdAt: number;
  data: unknown;
}

interface PhoneDB extends DBSchema {
  buddies: {
    key: string;
    value: Buddy;
  };
  messages: {
    key: string;
    value: StoredMessage;
    indexes: { "by-buddy": string; "by-buddy-time": [string, number] };
  };
  callHistory: {
    key: string;
    value: CallRecord;
    indexes: { "by-buddy": string; "by-time": number };
  };
  recordings: {
    key: string;
    value: CallRecording;
    indexes: { "by-buddy": string; "by-cdr": string };
  };
  qos: {
    key: string;
    value: QosSample;
    indexes: { "by-session": string; "by-buddy": string };
  };
}

const DB_NAME = "browser-phone";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PhoneDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PhoneDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PhoneDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("buddies")) {
          db.createObjectStore("buddies", { keyPath: "identity" });
        }
        if (!db.objectStoreNames.contains("messages")) {
          const s = db.createObjectStore("messages", { keyPath: "id" });
          s.createIndex("by-buddy", "buddy");
          s.createIndex("by-buddy-time", ["buddy", "timestamp"]);
        }
        if (!db.objectStoreNames.contains("callHistory")) {
          const s = db.createObjectStore("callHistory", { keyPath: "id" });
          s.createIndex("by-buddy", "buddy");
          s.createIndex("by-time", "startedAt");
        }
        if (!db.objectStoreNames.contains("recordings")) {
          const s = db.createObjectStore("recordings", { keyPath: "id" });
          s.createIndex("by-buddy", "buddy");
          s.createIndex("by-cdr", "cdrId");
        }
        if (!db.objectStoreNames.contains("qos")) {
          const s = db.createObjectStore("qos", { keyPath: "id" });
          s.createIndex("by-session", "sessionId");
          s.createIndex("by-buddy", "buddy");
        }
      }
    });
  }
  return dbPromise;
}

// --- Repositories -----------------------------------------------------------

export const buddiesRepo = {
  async getAll(): Promise<Buddy[]> {
    return (await getDb()).getAll("buddies");
  },
  async get(identity: string): Promise<Buddy | undefined> {
    return (await getDb()).get("buddies", identity);
  },
  async put(buddy: Buddy): Promise<void> {
    await (await getDb()).put("buddies", buddy);
  },
  async bulkPut(buddies: Buddy[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("buddies", "readwrite");
    await Promise.all([...buddies.map((b) => tx.store.put(b)), tx.done]);
  },
  async remove(identity: string): Promise<void> {
    await (await getDb()).delete("buddies", identity);
  }
};

export const messagesRepo = {
  async add(message: StoredMessage): Promise<void> {
    await (await getDb()).put("messages", message);
  },
  async listByBuddy(buddy: string): Promise<StoredMessage[]> {
    const db = await getDb();
    const range = IDBKeyRange.bound([buddy, -Infinity], [buddy, Infinity]);
    return db.getAllFromIndex("messages", "by-buddy-time", range);
  },
  async clearBuddy(buddy: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("messages", "readwrite");
    const keys = await tx.store.index("by-buddy").getAllKeys(buddy);
    await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
  }
};

export const callHistoryRepo = {
  async add(record: CallRecord): Promise<void> {
    await (await getDb()).put("callHistory", record);
  },
  async listByBuddy(buddy: string): Promise<CallRecord[]> {
    return (await getDb()).getAllFromIndex("callHistory", "by-buddy", buddy);
  },
  async listRecent(limit = 100): Promise<CallRecord[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex("callHistory", "by-time");
    return all.reverse().slice(0, limit);
  },
  async remove(id: string): Promise<void> {
    await (await getDb()).delete("callHistory", id);
  }
};

export const recordingsRepo = {
  async put(recording: CallRecording): Promise<void> {
    await (await getDb()).put("recordings", recording);
  },
  async get(id: string): Promise<CallRecording | undefined> {
    return (await getDb()).get("recordings", id);
  },
  async listByBuddy(buddy: string): Promise<CallRecording[]> {
    return (await getDb()).getAllFromIndex("recordings", "by-buddy", buddy);
  },
  async remove(id: string): Promise<void> {
    await (await getDb()).delete("recordings", id);
  }
};

export const qosRepo = {
  async put(sample: QosSample): Promise<void> {
    await (await getDb()).put("qos", sample);
  },
  async listBySession(sessionId: string): Promise<QosSample[]> {
    return (await getDb()).getAllFromIndex("qos", "by-session", sessionId);
  }
};
