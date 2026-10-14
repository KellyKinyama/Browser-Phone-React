import { useAppStore } from "../state/store";

// Promise-based imperative dialogs/toasts, replacing the original
// Alert/Confirm/Prompt/toast helpers. Usable from anywhere (not just React).

export function alertDialog(message: string, title = "", okLabel = "OK"): Promise<void> {
  return useAppStore
    .getState()
    .openDialog({
      kind: "alert",
      title,
      message,
      buttons: [{ label: okLabel, action: "ok", variant: "primary" }]
    })
    .then(() => undefined);
}

export async function confirmDialog(
  message: string,
  title = "",
  okLabel = "OK",
  cancelLabel = "Cancel"
): Promise<boolean> {
  const result = await useAppStore.getState().openDialog({
    kind: "confirm",
    title,
    message,
    buttons: [
      { label: cancelLabel, action: "cancel" },
      { label: okLabel, action: "ok", variant: "primary" }
    ]
  });
  return result.action === "ok";
}

export async function promptDialog(
  message: string,
  defaultValue = "",
  title = "",
  okLabel = "OK",
  cancelLabel = "Cancel"
): Promise<string | null> {
  const result = await useAppStore.getState().openDialog({
    kind: "prompt",
    title,
    message,
    defaultValue,
    buttons: [
      { label: cancelLabel, action: "cancel" },
      { label: okLabel, action: "ok", variant: "primary" }
    ]
  });
  return result.action === "ok" ? (result.value ?? "") : null;
}

export function toast(
  kind: "info" | "success" | "error",
  message: string,
  ttlMs?: number
): void {
  useAppStore.getState().pushToast(kind, message, ttlMs);
}
