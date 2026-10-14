import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAppStore } from "../state/store";
import { useLang } from "../hooks/useLang";
import { promptDialog } from "../services/dialogs";
import type { CallEventType } from "../types/line";
import { Menu } from "./ui/Menu";
import { CallMeters } from "./CallMeters";
import { VideoStage } from "./VideoStage";
import styles from "./CallArea.module.scss";
import common from "./common.module.scss";

const EVENT_LABEL: Record<CallEventType, string> = {
  dialing: "Dialing",
  incoming: "Incoming call",
  answered: "Answered",
  hold: "On hold",
  unhold: "Resumed",
  mute: "Muted",
  unmute: "Unmuted",
  transfer: "Transferred",
  ended: "Ended"
};

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (h > 0 ? pad(h) + ":" : "") + pad(m) + ":" + pad(s);
}

export function CallArea() {
  const t = useLang();
  const lines = useAppStore((s) => s.lines);
  const selectedLineNumber = useAppStore((s) => s.selectedLineNumber);
  const hangupLine = useAppStore((s) => s.hangupLine);
  const answerLine = useAppStore((s) => s.answerLine);
  const rejectLine = useAppStore((s) => s.rejectLine);
  const setLineMute = useAppStore((s) => s.setLineMute);
  const setLineHold = useAppStore((s) => s.setLineHold);
  const sendTone = useAppStore((s) => s.sendTone);
  const transferLine = useAppStore((s) => s.transferLine);
  const startAttendedTransfer = useAppStore((s) => s.startAttendedTransfer);
  const completeAttendedTransfer = useAppStore((s) => s.completeAttendedTransfer);
  const cancelAttendedTransfer = useAppStore((s) => s.cancelAttendedTransfer);
  const attendedTransfer = useAppStore((s) => s.attendedTransfer);
  const startConference = useAppStore((s) => s.startConference);
  const stopConference = useAppStore((s) => s.stopConference);
  const conferenceActive = useAppStore((s) => s.conferenceActive);
  const toggleScreenShare = useAppStore((s) => s.toggleScreenShare);
  const setCamera = useAppStore((s) => s.setCamera);

  const line = lines.find((l) => l.lineNumber === selectedLineNumber) ?? null;
  const [now, setNow] = useState(Date.now());
  const [showDtmf, setShowDtmf] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [transferMenu, setTransferMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!line || line.state !== "established") return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [line?.lineNumber, line?.state]);

  if (!line) {
    return (
      <div className={clsx(styles.callArea, styles.welcome)}>
        <i className={clsx("fa fa-phone", styles.welcomeIcon)} />
        <h2>Browser Phone</h2>
        <p>Select a contact or use the dial pad to start a call.</p>
      </div>
    );
  }

  const seconds = line.startedAt ? Math.max(0, Math.floor((now - line.startedAt) / 1000)) : 0;
  const stateLabel =
    line.state === "established"
      ? formatDuration(seconds)
      : line.state === "trying"
        ? "Calling…"
        : line.state === "ringing"
          ? "Ringing…"
          : line.state;

  // Inbound call that hasn't been answered yet -> show answer/reject.
  if (line.direction === "inbound" && line.state === "ringing") {
    return (
      <div className={clsx(styles.callArea, styles.active)}>
        <div className={clsx(styles.callAvatar, styles.ringing)} aria-hidden>
          <i className="fa fa-user" />
        </div>
        <div className={styles.callName}>{line.displayName}</div>
        <div className={styles.callNumber}>{line.displayNumber}</div>
        <div className={styles.callState}>{t("incoming_call")}</div>

        <div className={styles.callControls}>
          <button
            type="button"
            className={clsx(common.callButton, common.audio)}
            title={t("answer_call")}
            onClick={() => void answerLine(line.lineNumber, false)}
          >
            <i className="fa fa-phone" />
          </button>
          {line.withVideo && (
            <button
              type="button"
              className={clsx(common.callButton, common.audio)}
              title={t("answer_call_with_video")}
              onClick={() => void answerLine(line.lineNumber, true)}
            >
              <i className="fa fa-video-camera" />
            </button>
          )}
          <button
            type="button"
            className={clsx(common.callButton, common.hangup)}
            title={t("reject_call")}
            onClick={() => void rejectLine(line.lineNumber)}
          >
            <i className="fa fa-phone" style={{ transform: "rotate(135deg)" }} />
          </button>
        </div>
      </div>
    );
  }

  const isEstablished = line.state === "established";
  const establishedCount = lines.filter((l) => l.state === "established").length;
  const showVideo = isEstablished && line.withVideo;

  return (
    <div className={clsx(styles.callArea, styles.active, showVideo && styles.videoActive)}>
      {!showVideo && (
        <div className={styles.callAvatar} aria-hidden>
          <i className="fa fa-user" />
        </div>
      )}
      <div className={styles.callName}>{line.displayName}</div>
      <div className={styles.callNumber}>{line.displayNumber}</div>
      <div className={styles.callState}>{line.isOnHold ? t("hold_call") : stateLabel}</div>

      {showVideo ? (
        <VideoStage
          sessionId={line.sessionId}
          muted={line.isMuted}
          cameraOff={line.cameraOff}
          screenSharing={line.isScreenSharing}
          onToggleCamera={() => void setCamera(line.lineNumber, !line.cameraOff)}
          onToggleScreen={() => void toggleScreenShare(line.lineNumber)}
        />
      ) : (
        isEstablished && !conferenceActive && <CallMeters sessionId={line.sessionId} />
      )}

      {showDtmf && isEstablished && (
        <div className={styles.dtmfPad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
            <button
              key={k}
              type="button"
              className={styles.dtmfKey}
              onClick={() => void sendTone(line.lineNumber, k)}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {showTimeline && (
        <div className={styles.timeline}>
          {line.events.length === 0 && <div className={styles.timelineEmpty}>No activity yet</div>}
          {line.events.map((e, i) => (
            <div key={i} className={styles.timelineRow}>
              <span className={styles.timelineTime}>
                {new Date(e.at).toLocaleTimeString()}
              </span>
              <span>
                {EVENT_LABEL[e.type]}
                {e.detail ? ` → ${e.detail}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {attendedTransfer && (
        <div className={styles.attendedBanner}>
          <span>Consulting — complete the transfer?</span>
          <div className={styles.bannerActions}>
            <button
              type="button"
              className={styles.bannerPrimary}
              onClick={() => void completeAttendedTransfer()}
            >
              {t("complete_transfer")}
            </button>
            <button
              type="button"
              className={styles.bannerBtn}
              onClick={() => void cancelAttendedTransfer()}
            >
              {t("cancel_transfer")}
            </button>
          </div>
        </div>
      )}

      <div className={styles.callControls}>
        {isEstablished && (
          <>
            <button
              type="button"
              className={clsx(common.roundButton, styles.ctrl, line.isMuted && styles.ctrlActive)}
              title={line.isMuted ? t("unmute") : t("mute")}
              onClick={() => void setLineMute(line.lineNumber, !line.isMuted)}
            >
              <i className={line.isMuted ? "fa fa-microphone-slash" : "fa fa-microphone"} />
            </button>
            <button
              type="button"
              className={clsx(common.roundButton, styles.ctrl, line.isOnHold && styles.ctrlActive)}
              title={line.isOnHold ? t("resume_call") : t("hold_call")}
              onClick={() => void setLineHold(line.lineNumber, !line.isOnHold)}
            >
              <i className={line.isOnHold ? "fa fa-play" : "fa fa-pause"} />
            </button>
            <button
              type="button"
              className={clsx(common.roundButton, styles.ctrl, showDtmf && styles.ctrlActive)}
              title={t("send_dtmf")}
              onClick={() => setShowDtmf((v) => !v)}
            >
              <i className="fa fa-th" />
            </button>
            {line.withVideo && (
              <>
                <button
                  type="button"
                  className={clsx(common.roundButton, styles.ctrl, line.cameraOff && styles.ctrlActive)}
                  title={t("camera")}
                  onClick={() => void setCamera(line.lineNumber, !line.cameraOff)}
                >
                  <i className="fa fa-video-camera" />
                </button>
                <button
                  type="button"
                  className={clsx(common.roundButton, styles.ctrl, line.isScreenSharing && styles.ctrlActive)}
                  title={t("screen")}
                  onClick={() => void toggleScreenShare(line.lineNumber)}
                >
                  <i className="fa fa-desktop" />
                </button>
              </>
            )}
            <button
              type="button"
              className={clsx(common.roundButton, styles.ctrl)}
              title={t("transfer_call")}
              onClick={(e) => setTransferMenu({ x: e.clientX, y: e.clientY })}
            >
              <i className="fa fa-share" />
            </button>
            {establishedCount >= 2 && (
              <button
                type="button"
                className={clsx(common.roundButton, styles.ctrl, conferenceActive && styles.ctrlActive)}
                title={t("conference_call")}
                onClick={() => (conferenceActive ? stopConference() : void startConference())}
              >
                <i className="fa fa-users" />
              </button>
            )}
            <button
              type="button"
              className={clsx(common.roundButton, styles.ctrl, showTimeline && styles.ctrlActive)}
              title={t("activity_timeline")}
              onClick={() => setShowTimeline((v) => !v)}
            >
              <i className="fa fa-list-ul" />
            </button>
          </>
        )}
        <button
          type="button"
          className={clsx(common.callButton, common.hangup)}
          title={t("end_call")}
          onClick={() => void hangupLine(line.lineNumber)}
        >
          <i className="fa fa-phone" style={{ transform: "rotate(135deg)" }} />
        </button>
      </div>

      {transferMenu && (
        <Menu
          anchor={transferMenu}
          onClose={() => setTransferMenu(null)}
          items={[
            {
              label: t("blind_transfer"),
              icon: "fa-share",
              onClick: () => {
                void (async () => {
                  const target = await promptDialog(t("blind_transfer"), "", t("blind_transfer"), "Transfer");
                  if (target && target.trim()) await transferLine(line.lineNumber, target.trim());
                })();
              }
            },
            {
              label: t("attended_transfer"),
              icon: "fa-user-plus",
              onClick: () => {
                void (async () => {
                  const target = await promptDialog(t("attended_transfer"), "", t("attended_transfer"), "Call");
                  if (target && target.trim()) await startAttendedTransfer(line.lineNumber, target.trim());
                })();
              }
            }
          ]}
        />
      )}
    </div>
  );
}
