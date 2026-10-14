import type { Line, CallEventType } from "../../types/line";
import type { SipCallInfo } from "../../services/sip";
import { callHistoryRepo, type CallRecord } from "../../services/db";
import { sip } from "../phoneService";
import type { AppStateCreator } from "../types";

function buildCallRecord(line: Line): CallRecord {
  const missed = line.direction === "inbound" && line.startedAt == null;
  const durationSec = line.startedAt ? Math.max(0, Math.round((Date.now() - line.startedAt) / 1000)) : 0;
  return {
    id: `cdr-${line.lineNumber}-${Date.now()}`,
    buddy: line.buddyId || line.displayNumber,
    direction: line.direction,
    number: line.displayNumber,
    startedAt: line.startedAt ?? line.events[0]?.at ?? Date.now(),
    durationSec,
    withVideo: line.withVideo,
    missed,
    hasRecording: false
  };
}

export interface LinesSlice {
  lines: Line[];
  callHistory: CallRecord[];
  loadCallHistory: () => Promise<void>;
  selectedLineNumber: number | null;
  nextLineNumber: number;
  dial: (destination: string, withVideo: boolean, opts?: { buddyId?: string; displayName?: string }) => Promise<void>;
  selectLine: (lineNumber: number) => void;
  hangupLine: (lineNumber: number) => Promise<void>;
  setLineHold: (lineNumber: number, hold: boolean) => Promise<void>;
  setLineMute: (lineNumber: number, mute: boolean) => Promise<void>;
  sendTone: (lineNumber: number, tones: string) => Promise<void>;
  transferLine: (lineNumber: number, target: string) => Promise<void>;
  attendedTransfer: { fromLine: number; consultLine: number } | null;
  startAttendedTransfer: (lineNumber: number, target: string) => Promise<void>;
  completeAttendedTransfer: () => Promise<void>;
  cancelAttendedTransfer: () => Promise<void>;
  conferenceActive: boolean;
  startConference: () => Promise<void>;
  stopConference: () => void;
  toggleScreenShare: (lineNumber: number) => Promise<void>;
  setCamera: (lineNumber: number, off: boolean) => Promise<void>;
  addLineEvent: (lineNumber: number, type: CallEventType, detail?: string) => void;
  addLineEventBySession: (sessionId: string, type: CallEventType, detail?: string) => void;
  addIncomingLine: (call: SipCallInfo) => void;
  answerLine: (lineNumber: number, withVideo?: boolean) => Promise<void>;
  rejectLine: (lineNumber: number) => Promise<void>;
  patchLineBySession: (sessionId: string, patch: Partial<Line>) => void;
  removeLineBySession: (sessionId: string) => void;
}

export const createLinesSlice: AppStateCreator<LinesSlice> = (set, get) => {
  const recorded = new Set<number>();
  const recordEnd = (line: Line) => {
    if (recorded.has(line.lineNumber)) return;
    recorded.add(line.lineNumber);
    const rec = buildCallRecord(line);
    void callHistoryRepo.add(rec);
    set((s) => ({ callHistory: [rec, ...s.callHistory].slice(0, 300) }), false, "lines/cdr");
  };

  return {
    lines: [],
    callHistory: [],
    loadCallHistory: async () => {
      const callHistory = await callHistoryRepo.listRecent(300);
      set({ callHistory }, false, "lines/loadHistory");
    },
    selectedLineNumber: null,
    nextLineNumber: 1,
    attendedTransfer: null,
    conferenceActive: false,

    dial: async (destination, withVideo, opts) => {
    const lineNumber = get().nextLineNumber;
    const line: Line = {
      lineNumber,
      buddyId: opts?.buddyId ?? null,
      displayName: opts?.displayName || destination,
      displayNumber: destination,
      direction: "outbound",
      state: "trying",
      withVideo,
      isSelected: true,
      isMuted: false,
      isOnHold: false,
      isScreenSharing: false,
      cameraOff: false,
      startedAt: null,
      sessionId: null,
      events: [{ at: Date.now(), type: "dialing" }]
    };
    set(
      (s) => ({
        lines: [...s.lines, line],
        selectedLineNumber: lineNumber,
        selectedBuddyId: null,
        activePanel: "contacts",
        nextLineNumber: lineNumber + 1
      }),
      false,
      "lines/dial"
    );

    const info = await sip.call({ destination, withVideo });
    set(
      (s) => ({
        lines: s.lines.map((l) =>
          l.lineNumber === lineNumber ? { ...l, sessionId: info.sessionId } : l
        )
      }),
      false,
      "lines/dialAttach"
    );
  },

  selectLine: (lineNumber) => {
    set({ selectedLineNumber: lineNumber, selectedBuddyId: null }, false, "lines/select");
    // Multi-line: hold the others, resume the selected (established calls only).
    get().lines.forEach((l) => {
      if (l.state !== "established") return;
      const shouldHold = l.lineNumber !== lineNumber;
      if (l.isOnHold !== shouldHold) void get().setLineHold(l.lineNumber, shouldHold);
    });
  },

  setLineHold: async (lineNumber, hold) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (!line || line.sessionId == null) return;
    set(
      (s) => ({
        lines: s.lines.map((l) => (l.lineNumber === lineNumber ? { ...l, isOnHold: hold } : l))
      }),
      false,
      "lines/hold"
    );
    get().addLineEvent(lineNumber, hold ? "hold" : "unhold");
    await sip.setHold(line.sessionId, hold);
  },

  setLineMute: async (lineNumber, mute) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (!line || line.sessionId == null) return;
    set(
      (s) => ({
        lines: s.lines.map((l) => (l.lineNumber === lineNumber ? { ...l, isMuted: mute } : l))
      }),
      false,
      "lines/mute"
    );
    get().addLineEvent(lineNumber, mute ? "mute" : "unmute");
    await sip.setMute(line.sessionId, mute);
  },

  sendTone: async (lineNumber, tones) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (line?.sessionId) await sip.sendDtmf(line.sessionId, tones);
  },

  transferLine: async (lineNumber, target) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (!line?.sessionId) return;
    get().addLineEvent(lineNumber, "transfer", target);
    await sip.transfer(line.sessionId, target);
  },

  startAttendedTransfer: async (lineNumber, target) => {
    await get().setLineHold(lineNumber, true);
    await get().dial(target, false);
    const consultLine = get().selectedLineNumber;
    if (consultLine == null) return;
    set({ attendedTransfer: { fromLine: lineNumber, consultLine } }, false, "lines/attendedStart");
  },

  completeAttendedTransfer: async () => {
    const at = get().attendedTransfer;
    if (!at) return;
    const from = get().lines.find((l) => l.lineNumber === at.fromLine);
    const consult = get().lines.find((l) => l.lineNumber === at.consultLine);
    if (from?.sessionId && consult?.sessionId) {
      get().addLineEvent(at.fromLine, "transfer", consult.displayNumber);
      await sip.attendedTransfer(from.sessionId, consult.sessionId);
    }
    set({ attendedTransfer: null }, false, "lines/attendedComplete");
  },

  cancelAttendedTransfer: async () => {
    const at = get().attendedTransfer;
    if (!at) return;
    await get().hangupLine(at.consultLine);
    await get().setLineHold(at.fromLine, false);
    get().selectLine(at.fromLine);
    set({ attendedTransfer: null }, false, "lines/attendedCancel");
  },

  startConference: async () => {
    const established = get().lines.filter((l) => l.state === "established" && l.sessionId);
    if (established.length < 2) return;
    for (const l of established) if (l.isOnHold) await get().setLineHold(l.lineNumber, false);
    await sip.startConference(established.map((l) => l.sessionId as string));
    set({ conferenceActive: true }, false, "lines/conferenceStart");
  },

  stopConference: () => {
    sip.stopConference();
    set({ conferenceActive: false }, false, "lines/conferenceStop");
  },

  toggleScreenShare: async (lineNumber) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (!line?.sessionId) return;
    if (line.isScreenSharing) {
      await sip.stopScreenShare(line.sessionId);
      set(
        (s) => ({
          lines: s.lines.map((l) => (l.lineNumber === lineNumber ? { ...l, isScreenSharing: false } : l))
        }),
        false,
        "lines/stopScreen"
      );
    } else {
      const ok = await sip.shareScreen(line.sessionId);
      if (ok) {
        set(
          (s) => ({
            lines: s.lines.map((l) => (l.lineNumber === lineNumber ? { ...l, isScreenSharing: true } : l))
          }),
          false,
          "lines/shareScreen"
        );
      }
    }
  },

  setCamera: async (lineNumber, off) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (!line?.sessionId) return;
    await sip.setCameraEnabled(line.sessionId, !off);
    set(
      (s) => ({ lines: s.lines.map((l) => (l.lineNumber === lineNumber ? { ...l, cameraOff: off } : l)) }),
      false,
      "lines/camera"
    );
  },

  addLineEvent: (lineNumber, type, detail) =>
    set(
      (s) => ({
        lines: s.lines.map((l) =>
          l.lineNumber === lineNumber
            ? { ...l, events: [...l.events, { at: Date.now(), type, detail }] }
            : l
        )
      }),
      false,
      `lines/event:${type}`
    ),

  addLineEventBySession: (sessionId, type, detail) =>
    set(
      (s) => ({
        lines: s.lines.map((l) =>
          l.sessionId === sessionId
            ? { ...l, events: [...l.events, { at: Date.now(), type, detail }] }
            : l
        )
      }),
      false,
      `lines/event:${type}`
    ),

  hangupLine: async (lineNumber) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (line?.sessionId) {
      await sip.hangup(line.sessionId);
    } else {
      if (line) recordEnd(line);
      set(
        (s) => ({ lines: s.lines.filter((l) => l.lineNumber !== lineNumber) }),
        false,
        "lines/removeLocal"
      );
    }
  },

  patchLineBySession: (sessionId, patch) =>
    set(
      (s) => ({
        lines: s.lines.map((l) => (l.sessionId === sessionId ? { ...l, ...patch } : l))
      }),
      false,
      "lines/patchBySession"
    ),

  removeLineBySession: (sessionId) => {
    const ended = get().lines.find((l) => l.sessionId === sessionId);
    if (ended) recordEnd(ended);
    set(
      (s) => ({ lines: s.lines.filter((l) => l.sessionId !== sessionId) }),
      false,
      "lines/removeBySession"
    );
    if (get().conferenceActive) {
      const established = get().lines.filter((l) => l.state === "established");
      if (established.length < 2) get().stopConference();
    }
  },

  addIncomingLine: (call) => {
    const lineNumber = get().nextLineNumber;
    const line: Line = {
      lineNumber,
      buddyId: null,
      displayName: call.remoteName,
      displayNumber: call.remoteNumber,
      direction: "inbound",
      state: "ringing",
      withVideo: call.withVideo,
      isSelected: true,
      isMuted: false,
      isOnHold: false,
      isScreenSharing: false,
      cameraOff: false,
      startedAt: null,
      sessionId: call.sessionId,
      events: [{ at: Date.now(), type: "incoming" }]
    };
    set(
      (s) => ({
        lines: [...s.lines, line],
        selectedLineNumber: lineNumber,
        selectedBuddyId: null,
        nextLineNumber: lineNumber + 1
      }),
      false,
      "lines/incoming"
    );
  },

  answerLine: async (lineNumber, withVideo) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (line?.sessionId) await sip.answer(line.sessionId, withVideo ?? line.withVideo);
  },

  rejectLine: async (lineNumber) => {
    const line = get().lines.find((l) => l.lineNumber === lineNumber);
    if (line?.sessionId) await sip.reject(line.sessionId);
    if (line) recordEnd(line);
    set(
      (s) => ({ lines: s.lines.filter((l) => l.lineNumber !== lineNumber) }),
      false,
      "lines/reject"
    );
  }
  };
};
