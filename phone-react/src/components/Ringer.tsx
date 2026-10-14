import { useEffect, useRef } from "react";
import { useAppStore } from "../state/store";

// Plays a looping ringtone while an inbound call is ringing; switches to the
// call-waiting tone when a call is already established.
export function Ringer() {
  const lines = useAppStore((s) => s.lines);
  const ringerId = useAppStore((s) => s.settings.media.ringerId);
  const ringEl = useRef<HTMLAudioElement>(null);
  const waitEl = useRef<HTMLAudioElement>(null);

  const ringing = lines.some((l) => l.direction === "inbound" && l.state === "ringing");
  const onCall = lines.some((l) => l.state === "established");

  useEffect(() => {
    for (const el of [ringEl.current, waitEl.current]) {
      const a = el as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
      if (ringerId && a && typeof a.setSinkId === "function") {
        void a.setSinkId(ringerId).catch(() => undefined);
      }
    }
  }, [ringerId]);

  useEffect(() => {
    const ring = ringEl.current;
    const wait = waitEl.current;
    if (!ring || !wait) return;
    if (!ringing) {
      for (const el of [ring, wait]) {
        el.pause();
        el.currentTime = 0;
      }
      return;
    }
    const active = onCall ? wait : ring;
    const idle = onCall ? ring : wait;
    idle.pause();
    idle.currentTime = 0;
    active.currentTime = 0;
    void active.play().catch(() => {
      /* autoplay may be blocked until a user gesture */
    });
  }, [ringing, onCall]);

  return (
    <>
      <audio ref={ringEl} src="/media/Ringtone_1.mp3" loop preload="auto" />
      <audio ref={waitEl} src="/media/Tone_CallWaiting.mp3" loop preload="auto" />
    </>
  );
}
