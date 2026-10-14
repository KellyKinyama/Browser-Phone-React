import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.scss";

interface ModalProps {
  title?: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ title, onClose, children, footer, width = 420 }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.scrim} onMouseDown={onClose}>
      <div
        className={styles.modal}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && <div className={styles.header}>{title}</div>}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
