import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "./Menu.module.scss";

export interface MenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  onClick: () => void;
}

interface MenuProps {
  anchor: { x: number; y: number };
  items: MenuItem[];
  onClose: () => void;
}

export function Menu({ anchor, items, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      style={{ left: anchor.x, top: anchor.y }}
      role="menu"
    >
      {items.map((it, i) => (
        <button
          key={i}
          className={clsx(styles.item, it.danger && styles.danger)}
          role="menuitem"
          onClick={() => {
            it.onClick();
            onClose();
          }}
        >
          {it.icon && <i className={"fa " + it.icon} />}
          <span>{it.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}
