import type { Buddy } from "../types/buddy";

const DEFAULT_AVATARS = Array.from({ length: 9 }, (_, i) => `/avatars/default.${i}.webp`);

export function defaultAvatar(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return DEFAULT_AVATARS[h % DEFAULT_AVATARS.length];
}

export function buddyAvatar(buddy: Buddy): string {
  return buddy.imageObjectUrl || defaultAvatar(buddy.identity);
}
