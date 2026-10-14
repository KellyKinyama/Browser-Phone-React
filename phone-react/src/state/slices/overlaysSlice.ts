import type { AppStateCreator } from "../types";

export type DialogKind = "alert" | "confirm" | "prompt";

export interface DialogButton {
  label: string;
  action: string;
  variant?: "primary" | "danger" | "default";
}

export interface DialogRequest {
  kind: DialogKind;
  title?: string;
  message?: string;
  defaultValue?: string;
  buttons: DialogButton[];
}

export interface DialogResult {
  action: string;
  value?: string;
}

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface OverlaysSlice {
  dialog: DialogRequest | null;
  toasts: Toast[];
  openDialog: (req: DialogRequest) => Promise<DialogResult>;
  resolveDialog: (result: DialogResult) => void;
  pushToast: (kind: ToastKind, message: string, ttlMs?: number) => void;
  dismissToast: (id: string) => void;
}

// Only one dialog is shown at a time; its promise resolver is kept outside the
// store (non-serializable) so devtools/persist stay clean.
let pendingResolve: ((r: DialogResult) => void) | null = null;
let toastSeq = 0;

export const createOverlaysSlice: AppStateCreator<OverlaysSlice> = (set, get) => ({
  dialog: null,
  toasts: [],

  openDialog: (req) =>
    new Promise<DialogResult>((resolve) => {
      pendingResolve = resolve;
      set({ dialog: req }, false, "overlays/openDialog");
    }),

  resolveDialog: (result) => {
    set({ dialog: null }, false, "overlays/resolveDialog");
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve?.(result);
  },

  pushToast: (kind, message, ttlMs = 4000) => {
    const id = `t${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }), false, "overlays/pushToast");
    if (ttlMs > 0) window.setTimeout(() => get().dismissToast(id), ttlMs);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }), false, "overlays/dismissToast")
});
