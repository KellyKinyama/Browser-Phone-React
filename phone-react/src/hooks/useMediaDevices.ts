import { useCallback, useEffect, useState } from "react";

export interface DeviceList {
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
}

const EMPTY: DeviceList = { mics: [], speakers: [], cameras: [] };

/** Enumerates media devices; labels populate after permission is granted. */
export function useMediaDevices() {
  const [devices, setDevices] = useState<DeviceList>(EMPTY);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices({
      mics: list.filter((d) => d.kind === "audioinput"),
      speakers: list.filter((d) => d.kind === "audiooutput"),
      cameras: list.filter((d) => d.kind === "videoinput")
    });
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* user may deny or lack a camera; still refresh for audio labels */
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const md = navigator.mediaDevices;
    md?.addEventListener?.("devicechange", refresh);
    return () => md?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  return { devices, refresh, requestPermission };
}
