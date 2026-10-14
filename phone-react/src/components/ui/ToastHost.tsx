import { createPortal } from "react-dom";
import clsx from "clsx";
import { useAppStore } from "../../state/store";
import styles from "./ToastHost.module.scss";

export function ToastHost() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className={styles.container}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(styles.toast, styles[t.kind])}
          onClick={() => dismiss(t.id)}
          role="status"
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
