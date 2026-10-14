import {
  UserAgent,
  Registerer,
  RegistererState,
  Inviter,
  Invitation,
  Session,
  SessionState,
  Web,
  type UserAgentOptions
} from "sip.js";
import type { AccountSettings, MediaSettings } from "../../types/settings";
import type {
  OutgoingCallRequest,
  RegistrationState,
  SipCallInfo,
  SipService,
  SipServiceEvents
} from "../sip";

/**
 * SIP.js-backed phone service. Satisfies the same `SipService` contract as the
 * mock, so UI/state code is unchanged. Manages the UserAgent/transport,
 * registration, inbound/outbound sessions, media attachment, hold/mute/DTMF.
 */
export class SipJsService implements SipService {
  private account: AccountSettings | null = null;
  private media: MediaSettings | null = null;
  private ua: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private events: SipServiceEvents = {};
  private state: RegistrationState = "unregistered";
  private sessions = new Map<string, Session>();
  private audioEls = new Map<string, HTMLAudioElement>();
  private seq = 0;
  private confCtx: AudioContext | null = null;
  private confOriginalTracks = new Map<string, MediaStreamTrack | null>();
  private screenOriginalTrack = new Map<string, MediaStreamTrack | null>();

  configure(account: AccountSettings): void {
    this.account = account;
  }

  setMedia(media: MediaSettings): void {
    this.media = media;
    for (const audio of this.audioEls.values()) this.applySink(audio);
  }

  // Build getUserMedia constraints from the selected devices + processing flags.
  private constraints(withVideo: boolean): { audio: MediaTrackConstraints; video: boolean | MediaTrackConstraints } {
    const m = this.media;
    const audio: MediaTrackConstraints = {
      echoCancellation: m?.echoCancellation ?? true,
      noiseSuppression: m?.noiseSuppression ?? true,
      autoGainControl: m?.autoGainControl ?? true
    };
    if (m?.micId) audio.deviceId = { exact: m.micId };
    const video: boolean | MediaTrackConstraints = withVideo
      ? m?.cameraId
        ? { deviceId: { exact: m.cameraId } }
        : true
      : false;
    return { audio, video };
  }

  private applySink(audio: HTMLAudioElement): void {
    const id = this.media?.speakerId;
    const el = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (id && typeof el.setSinkId === "function") {
      void el.setSinkId(id).catch(() => undefined);
    }
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

  private buildUserAgent(account: AccountSettings): UserAgent {
    const scheme = account.webSocketSecure === false ? "ws" : "wss";
    const port = account.webSocketPort ? `:${account.webSocketPort}` : "";
    const path = account.serverPath ?? "";
    const server = `${scheme}://${account.wssServer}${port}${path}`;
    const uri = UserAgent.makeURI(`sip:${account.sipUsername}@${account.sipDomain}`);
    if (!uri) throw new Error("Invalid SIP URI (check username/domain)");

    const options: UserAgentOptions = {
      uri,
      transportOptions: { server },
      authorizationUsername: account.sipUsername ?? undefined,
      authorizationPassword: account.sipPassword ?? undefined,
      displayName: account.profileName ?? undefined,
      userAgentString: account.userAgentString,
      logLevel: "warn",
      delegate: {
        onInvite: (invitation) => this.onInvite(invitation)
      }
    };
    return new UserAgent(options);
  }

  async register(): Promise<void> {
    if (!this.account?.wssServer || !this.account?.sipUsername) {
      this.setState("failed", "Missing account configuration");
      return;
    }
    try {
      this.setState("connecting");
      this.ua = this.buildUserAgent(this.account);
      this.registerer = new Registerer(this.ua);
      this.registerer.stateChange.addListener((s) => {
        if (s === RegistererState.Registered) this.setState("registered");
        else if (s === RegistererState.Unregistered || s === RegistererState.Terminated) {
          this.setState("unregistered");
        }
      });
      await this.ua.start();
      await this.registerer.register();
    } catch (e) {
      this.setState("failed", e instanceof Error ? e.message : String(e));
    }
  }

  async unregister(): Promise<void> {
    try {
      await this.registerer?.unregister();
    } catch {
      /* ignore */
    }
    try {
      await this.ua?.stop();
    } catch {
      /* ignore */
    }
    this.ua = null;
    this.registerer = null;
    this.setState("unregistered");
  }

  async call(request: OutgoingCallRequest): Promise<SipCallInfo> {
    if (!this.ua || !this.account) throw new Error("Not registered");
    const target = UserAgent.makeURI(`sip:${request.destination}@${this.account.sipDomain}`);
    if (!target) throw new Error("Invalid call target");

    const sessionId = this.nextId();
    const inviter = new Inviter(this.ua, target, {
      sessionDescriptionHandlerOptions: {
        constraints: this.constraints(request.withVideo)
      }
    });
    this.sessions.set(sessionId, inviter);
    this.wireSession(sessionId, inviter);
    await inviter.invite();

    return {
      sessionId,
      direction: "outbound",
      remoteNumber: request.destination,
      remoteName: request.destination,
      withVideo: request.withVideo
    };
  }

  async answer(sessionId: string, withVideo: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session instanceof Invitation) {
      await session.accept({
        sessionDescriptionHandlerOptions: {
          constraints: this.constraints(withVideo)
        }
      });
    }
  }

  async reject(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session instanceof Invitation && session.state === SessionState.Initial) {
      await session.reject();
    }
    this.cleanup(sessionId);
  }

  async transfer(sessionId: string, target: string): Promise<void> {
    if (!this.account) throw new Error("Not registered");
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== SessionState.Established) return;
    const referTo = UserAgent.makeURI(`sip:${target}@${this.account.sipDomain}`);
    if (!referTo) throw new Error("Invalid transfer target");
    await session.refer(referTo);
  }

  // Attended transfer: REFER the original (held) call to the consultation call
  // using Replaces, connecting the two remote parties.
  async attendedTransfer(sessionId: string, replaceSessionId: string): Promise<void> {
    const original = this.sessions.get(sessionId);
    const consultation = this.sessions.get(replaceSessionId);
    if (!original || !consultation) return;
    await original.refer(consultation);
  }

  async startConference(sessionIds: string[]): Promise<void> {
    const parts = sessionIds
      .map((id) => ({ id, sdh: this.sdh(id) }))
      .filter((p): p is { id: string; sdh: Web.SessionDescriptionHandler } => !!p.sdh);
    if (parts.length < 2) return;

    const ctx = new AudioContext();
    this.confCtx = ctx;

    // For each leg, send a mix of our mic + every other leg's remote audio.
    for (const { id, sdh } of parts) {
      const dest = ctx.createMediaStreamDestination();
      try {
        if (sdh.localMediaStream.getAudioTracks().length) {
          ctx.createMediaStreamSource(sdh.localMediaStream).connect(dest);
        }
      } catch {
        /* ignore */
      }
      for (const other of parts) {
        if (other.id === id) continue;
        try {
          if (other.sdh.remoteMediaStream.getAudioTracks().length) {
            ctx.createMediaStreamSource(other.sdh.remoteMediaStream).connect(dest);
          }
        } catch {
          /* ignore */
        }
      }
      const mixedTrack = dest.stream.getAudioTracks()[0];
      const sender = sdh.peerConnection
        ?.getSenders()
        .find((s) => s.track && s.track.kind === "audio");
      if (sender && mixedTrack) {
        this.confOriginalTracks.set(id, sender.track ?? null);
        await sender.replaceTrack(mixedTrack);
      }
    }
  }

  stopConference(): void {
    for (const [id, track] of this.confOriginalTracks) {
      const sender = this.sdh(id)
        ?.peerConnection?.getSenders()
        .find((s) => s.track && s.track.kind === "audio");
      if (sender) void sender.replaceTrack(track);
    }
    this.confOriginalTracks.clear();
    try {
      void this.confCtx?.close();
    } catch {
      /* ignore */
    }
    this.confCtx = null;
  }

  getLocalStream(sessionId: string): MediaStream | null {
    return this.sdh(sessionId)?.localMediaStream ?? null;
  }

  getRemoteStream(sessionId: string): MediaStream | null {
    return this.sdh(sessionId)?.remoteMediaStream ?? null;
  }

  async shareScreen(sessionId: string): Promise<boolean> {
    const sdh = this.sdh(sessionId);
    if (!sdh) return false;
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      return false;
    }
    const screenTrack = display.getVideoTracks()[0];
    const sender = sdh.peerConnection?.getSenders().find((s) => s.track && s.track.kind === "video");
    if (!sender || !screenTrack) {
      screenTrack?.stop();
      return false;
    }
    this.screenOriginalTrack.set(sessionId, sender.track ?? null);
    await sender.replaceTrack(screenTrack);
    screenTrack.addEventListener("ended", () => void this.stopScreenShare(sessionId));
    return true;
  }

  async stopScreenShare(sessionId: string): Promise<void> {
    const sdh = this.sdh(sessionId);
    if (!sdh) return;
    const sender = sdh.peerConnection?.getSenders().find((s) => s.track && s.track.kind === "video");
    if (sender) {
      sender.track?.stop();
      await sender.replaceTrack(this.screenOriginalTrack.get(sessionId) ?? null);
    }
    this.screenOriginalTrack.delete(sessionId);
  }

  async setCameraEnabled(sessionId: string, enabled: boolean): Promise<void> {
    const sender = this.sdh(sessionId)
      ?.peerConnection?.getSenders()
      .find((s) => s.track && s.track.kind === "video");
    if (sender?.track) sender.track.enabled = enabled;
  }

  async hangup(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    switch (session.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        if (session instanceof Inviter) await session.cancel();
        else if (session instanceof Invitation) await session.reject();
        break;
      case SessionState.Established:
        await session.bye();
        break;
      default:
        break;
    }
    this.cleanup(sessionId);
  }

  async setHold(sessionId: string, hold: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== SessionState.Established) return;
    await session.invite({
      sessionDescriptionHandlerModifiers: hold ? [Web.holdModifier] : []
    });
  }

  async setMute(sessionId: string, mute: boolean): Promise<void> {
    const pc = this.peerConnection(sessionId);
    pc?.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio") sender.track.enabled = !mute;
    });
  }

  async sendDtmf(sessionId: string, tones: string): Promise<void> {
    const sdh = this.sdh(sessionId);
    sdh?.sendDtmf(tones);
  }

  // --- internals -------------------------------------------------------------

  private nextId(): string {
    return `s${++this.seq}`;
  }

  private sdh(sessionId: string): Web.SessionDescriptionHandler | undefined {
    const session = this.sessions.get(sessionId);
    const handler = session?.sessionDescriptionHandler;
    return handler instanceof Web.SessionDescriptionHandler ? handler : undefined;
  }

  private peerConnection(sessionId: string): RTCPeerConnection | undefined {
    return this.sdh(sessionId)?.peerConnection;
  }

  private onInvite(invitation: Invitation): void {
    const sessionId = this.nextId();
    this.sessions.set(sessionId, invitation);
    this.wireSession(sessionId, invitation);

    const from = invitation.remoteIdentity;
    // Detect whether the caller offered video (best-effort SDP sniff).
    let withVideo = false;
    try {
      const body = (invitation.request as unknown as { body?: unknown }).body;
      const sdp = typeof body === "string" ? body : String((body as { body?: string })?.body ?? "");
      withVideo = sdp.includes("m=video");
    } catch {
      withVideo = false;
    }
    this.events.onIncomingCall?.({
      sessionId,
      direction: "inbound",
      remoteNumber: from.uri.user ?? "",
      remoteName: from.displayName || (from.uri.user ?? ""),
      withVideo
    });
  }

  private wireSession(sessionId: string, session: Session): void {
    session.stateChange.addListener((state: SessionState) => {
      switch (state) {
        case SessionState.Establishing:
          this.events.onCallProgress?.(sessionId, "ringing");
          break;
        case SessionState.Established:
          this.setupRemoteMedia(sessionId, session);
          this.events.onCallEstablished?.(sessionId);
          break;
        case SessionState.Terminated:
          this.cleanup(sessionId);
          this.events.onCallEnded?.(sessionId);
          break;
        default:
          break;
      }
    });
  }

  private setupRemoteMedia(sessionId: string, session: Session): void {
    const handler = session.sessionDescriptionHandler;
    if (!(handler instanceof Web.SessionDescriptionHandler)) return;

    let audio = this.audioEls.get(sessionId);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.hidden = true;
      document.body.appendChild(audio);
      this.audioEls.set(sessionId, audio);
    }
    audio.srcObject = handler.remoteMediaStream;
    this.applySink(audio);
    void audio.play().catch(() => undefined);
  }

  private cleanup(sessionId: string): void {
    const audio = this.audioEls.get(sessionId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      this.audioEls.delete(sessionId);
    }
    this.sessions.delete(sessionId);
  }
}
