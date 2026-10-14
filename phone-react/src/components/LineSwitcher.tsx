import clsx from "clsx";
import { useAppStore } from "../state/store";
import { useLang } from "../hooks/useLang";
import styles from "./LineSwitcher.module.scss";

export function LineSwitcher() {
  const t = useLang();
  const lines = useAppStore((s) => s.lines);
  const selectedLineNumber = useAppStore((s) => s.selectedLineNumber);
  const selectLine = useAppStore((s) => s.selectLine);

  if (lines.length < 2) return null;

  return (
    <div className={styles.switcher}>
      {lines.map((l) => (
        <button
          key={l.lineNumber}
          type="button"
          className={clsx(styles.chip, l.lineNumber === selectedLineNumber && styles.active)}
          onClick={() => selectLine(l.lineNumber)}
          title={`${t("line")} ${l.lineNumber}`}
        >
          <span className={styles.lineNo}>{l.lineNumber}</span>
          <span className={styles.name}>{l.displayName}</span>
          {l.isOnHold && <i className="fa fa-pause" />}
        </button>
      ))}
    </div>
  );
}
