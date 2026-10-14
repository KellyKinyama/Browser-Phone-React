export type CallDirection = "inbound" | "outbound";

export type CallState =
  | "trying"
  | "ringing"
  | "early"
  | "established"
  | "onhold"
  | "ended"
  | "failed";

export type CallEventType =
  | "dialing"
  | "incoming"
  | "answered"
  | "hold"
  | "unhold"
  | "mute"
  | "unmute"
  | "transfer"
  | "ended";

export interface CallEvent {
  at: number;
  type: CallEventType;
  detail?: string;
}

/**
 * A single call appearance ("line"). The React rewrite keeps UI state here and
 * delegates the actual SIP session to the SipService (see services/sip.ts).
 */
export interface Line {
  lineNumber: number;
  buddyId: string | null;
  displayName: string;
  displayNumber: string;
  direction: CallDirection;
  state: CallState;
  withVideo: boolean;
  isSelected: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  isScreenSharing: boolean;
  cameraOff: boolean;
  /** Epoch ms when the call was answered/established, else null. */
  startedAt: number | null;
  /** Opaque id of the underlying SIP session (owned by SipService). */
  sessionId: string | null;
  /** Chronological in-call activity for the timeline view. */
  events: CallEvent[];
}
