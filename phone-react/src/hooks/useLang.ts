import { useCallback } from "react";
import { useAppStore } from "../state/store";
import { translate } from "../services/i18n";
import type { LangKey } from "../types/lang";

/** Returns a `t(key)` translator bound to the currently loaded language pack. */
export function useLang(): (key: LangKey) => string {
  const lang = useAppStore((s) => s.lang);
  return useCallback((key: LangKey) => translate(lang, key), [lang]);
}
