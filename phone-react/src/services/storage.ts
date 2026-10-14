/**
 * Thin typed wrapper over localStorage, replacing the original `getDbItem`.
 */
const db = window.localStorage;

export const storage = {
  getString(key: string, fallback: string): string {
    const v = db.getItem(key);
    return v === null ? fallback : v;
  },
  getStringOrNull(key: string): string | null {
    return db.getItem(key);
  },
  getNumber(key: string, fallback: number): number {
    const v = db.getItem(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  },
  getBool(key: string, fallback: boolean): boolean {
    const v = db.getItem(key);
    if (v === null) return fallback;
    return v === "1" || v === "true";
  },
  getJson<T>(key: string, fallback: T): T {
    const v = db.getItem(key);
    if (v === null) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string): void {
    db.setItem(key, value);
  },
  setJson(key: string, value: unknown): void {
    db.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    db.removeItem(key);
  }
};
