import type { Lang, LangKey } from "../types/lang";

export const AVAILABLE_LANGS = [
  "en",
  "fr",
  "ja",
  "zh-hans",
  "zh",
  "ru",
  "tr",
  "nl",
  "es",
  "de",
  "pl",
  "pt-br"
] as const;

let enBase: Lang | null = null;

async function fetchLang(code: string): Promise<Partial<Lang>> {
  const res = await fetch(`/lang/${code}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Language pack "${code}" failed: ${res.status}`);
  return (await res.json()) as Partial<Lang>;
}

/** Resolve "auto" to a supported language code based on the browser locale. */
export function resolveLanguage(preference: string): string {
  if (preference && preference !== "auto") return preference;
  const nav = navigator.language?.toLowerCase() ?? "en";
  const match = AVAILABLE_LANGS.find(
    (c) => c === nav || nav.startsWith(c + "-") || nav.split("-")[0] === c
  );
  return match ?? "en";
}

/**
 * Loads the English base pack (always) and overlays the requested language,
 * so missing keys fall back to English. Mirrors the original loader behaviour.
 */
export async function loadLang(preference: string): Promise<Lang> {
  if (!enBase) {
    enBase = (await fetchLang("en")) as Lang;
  }
  const code = resolveLanguage(preference);
  if (code === "en") return enBase;
  try {
    const overlay = await fetchLang(code);
    return { ...enBase, ...overlay };
  } catch {
    return enBase;
  }
}

/** Safe translator: returns the key itself if a string is missing. */
export function translate(lang: Lang | null, key: LangKey): string {
  if (!lang) return key;
  return lang[key] ?? key;
}
