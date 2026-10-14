import type { AccountSettings, MediaSettings } from "../types/settings";
import type { CallDirection } from "../types/line";

export type RegistrationState =
  | "unregistered"
  | "connecting"
  | "registered"
  | "failed";

export interface OutgoingCallRequest {
  destination: string;
  withVideo: boolean;
}

export interface SipCallInfo {
  sessionId: string;
  direction: CallDirection;
  remoteNumber: string;
  remoteName: string;
  withVideo: boolean;
}

export interface SipServiceEvents {
  onRegistrationStateChange?: (state: RegistrationState, cause?: string) => void;
  onIncomingCall?: (call: SipCallInfo) => void;
  onCallProgress?: (sessionId: string, state: string) => void;
  onCallEstablished?: (sessionId: string) => void;
  onCallEnded?: (sessionId: string, cause?: string) => void;
}

/**
 * Transport-agnostic phone contract. The UI talks only to this interface;
 * a real SIP.js-backed implementation and this mock both satisfy it.
 */
export interface SipService {
  configure(account: AccountSettings): void;
  setMedia(media: MediaSettings): void;
  register(): Promise<void>;
  unregister(): Promise<void>;
  getRegistrationState(): RegistrationState;
  call(request: OutgoingCallRequest): Promise<SipCallInfo>;
  hangup(sessionId: string): Promise<void>;
  answer(sessionId: string, withVideo: boolean): Promise<void>;
  reject(sessionId: string): Promise<void>;
  transfer(sessionId: string, target: string): Promise<void>;
  setHold(sessionId: string, hold: boolean): Promise<void>;
  setMute(sessionId: string, mute: boolean): Promise<void>;
  sendDtmf(sessionId: string, tones: string): Promise<void>;
  attendedTransfer(sessionId: string, replaceSessionId: string): Promise<void>;
  startConference(sessionIds: string[]): Promise<void>;
  stopConference(): void;
  shareScreen(sessionId: string): Promise<boolean>;
  stopScreenShare(sessionId: string): Promise<void>;
  setCameraEnabled(sessionId: string, enabled: boolean): Promise<void>;
  getLocalStream(sessionId: string): MediaStream | null;
  getRemoteStream(sessionId: string): MediaStream | null;
  setEvents(events: SipServiceEvents): void;
}

/**
 * MockSipService: simulates registration and call lifecycle in-memory so the UI
 * can be built and tested without an Asterisk PBX. Replaced by a SIP.js-backed
 * implementation in a later phase.
 */
export class MockSipService implements SipService {
  private account: AccountSettings | null = null;
  private state: RegistrationState = "unregistered";
  private events: SipServiceEvents = {};
  private seq = 0;

  configure(account: AccountSettings): void {
    this.account = account;
  }

  setMedia(): void {
    /* no-op for the mock */
  }

  setEvents(events: SipServiceEvents): void {
    this.events = events;
  }

  getRegistrationState(): RegistrationState {
    return this.state;
  }

  private setState(next: RegistrationState, cause?: string): void {
    this.state = next;
    this.events.onRegistrationStateChange?.(next, cause);
  }

  async register(): Promise<void> {
    if (!this.account?.wssServer || !this.account?.sipUsername) {
      this.setState("failed", "Missing account configuration");
      return;
    }
    this.setState("connecting");
    await delay(600);
    this.setState("registered");
  }

  async unregister(): Promise<void> {
    await delay(200);
    this.setState("unregistered");
  }

  async call(request: OutgoingCallRequest): Promise<SipCallInfo> {
    const sessionId = `mock-${++this.seq}`;
    const info: SipCallInfo = {
      sessionId,
      direction: "outbound",
      remoteNumber: request.destination,
      remoteName: request.destination,
      withVideo: request.withVideo
    };
    // Simulate trying -> ringing -> established.
    void (async () => {
      this.events.onCallProgress?.(sessionId, "trying");
      await delay(500);
      this.events.onCallProgress?.(sessionId, "ringing");
      await delay(1200);
      this.events.onCallEstablished?.(sessionId);
    })();
    return info;
  }

  async hangup(sessionId: string): Promise<void> {
    await delay(100);
    this.events.onCallEnded?.(sessionId, "Local hangup");
  }

  async answer(): Promise<void> {
    await delay(50);
  }

  async reject(sessionId: string): Promise<void> {
    await delay(50);
    this.events.onCallEnded?.(sessionId, "Rejected");
  }

  async transfer(sessionId: string): Promise<void> {
    await delay(300);
    this.events.onCallEnded?.(sessionId, "Transferred");
  }

  async attendedTransfer(sessionId: string, replaceSessionId: string): Promise<void> {
    await delay(300);
    this.events.onCallEnded?.(sessionId, "Transferred");
    this.events.onCallEnded?.(replaceSessionId, "Transferred");
  }

  async startConference(): Promise<void> {
    await delay(100);
  }

  stopConference(): void {
    /* no-op in mock */
  }

  async shareScreen(): Promise<boolean> {
    return false;
  }

  async stopScreenShare(): Promise<void> {
    /* no-op in mock */
  }

  async setCameraEnabled(): Promise<void> {
    /* no-op in mock */
  }

  getLocalStream(): MediaStream | null {
    return null;
  }

  getRemoteStream(): MediaStream | null {
    return null;
  }

  async setHold(): Promise<void> {
    await delay(50);
  }

  async setMute(): Promise<void> {
    await delay(50);
  }

  async sendDtmf(): Promise<void> {
    await delay(10);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
