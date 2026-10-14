import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAppStore } from "../../state/store";
import { Modal } from "./Modal";
import styles from "./DialogHost.module.scss";

export function DialogHost() {
  const dialog = useAppStore((s) => s.dialog);
  const resolveDialog = useAppStore((s) => s.resolveDialog);
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(dialog?.defaultValue ?? "");
  }, [dialog]);

  if (!dialog) return null;

  const footer = dialog.buttons.map((b) => (
    <button
      key={b.action}
      className={clsx(
        styles.btn,
        b.variant === "primary" && styles.primary,
        b.variant === "danger" && styles.danger
      )}
      onClick={() => resolveDialog({ action: b.action, value })}
    >
      {b.label}
    </button>
  ));

  return (
    <Modal
      title={dialog.title}
      footer={footer}
      onClose={() => resolveDialog({ action: "cancel" })}
    >
      {dialog.message && <p className={styles.message}>{dialog.message}</p>}
      {dialog.kind === "prompt" && (
        <input
          autoFocus
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") resolveDialog({ action: "ok", value });
          }}
        />
      )}
    </Modal>
  );
}
