import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { sip } from "../state/phoneService";
import styles from "./VideoStage.module.scss";

interface VideoStageProps {
  sessionId: string | null;
  muted: boolean;
  cameraOff: boolean;
  screenSharing: boolean;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
}

// Remote video is muted here; call audio is played by the service's hidden
// <audio> element, so we avoid double audio.
export function VideoStage({
  sessionId,
  muted,
  cameraOff,
  screenSharing,
  onToggleCamera,
  onToggleScreen
}: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [sourceMenu, setSourceMenu] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    if (remoteRef.current) remoteRef.current.srcObject = sip.getRemoteStream(sessionId);
    if (localRef.current) localRef.current.srcObject = sip.getLocalStream(sessionId);
  }, [sessionId, cameraOff, screenSharing]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  };

  return (
    <div className={styles.stage} ref={stageRef}>
      <video ref={remoteRef} className={styles.remote} autoPlay playsInline muted />

      {cameraOff && !screenSharing ? (
        <div className={clsx(styles.local, styles.localOff)}>
          <i className="fa fa-video-camera" />
        </div>
      ) : (
        <video
          ref={localRef}
          className={clsx(styles.local, screenSharing && styles.localScreen)}
          autoPlay
          playsInline
          muted
        />
      )}

      {screenSharing && (
        <div className={styles.badge}>
          <i className="fa fa-desktop" /> Sharing screen
        </div>
      )}
      {muted && (
        <div className={styles.mutedBadge} title="Microphone muted">
          <i className="fa fa-microphone-slash" />
        </div>
      )}

      <div className={styles.stageTools}>
        <div className={styles.sourceWrap}>
          <button
            type="button"
            className={styles.toolBtn}
            title="Presentation source"
            onClick={() => setSourceMenu((v) => !v)}
          >
            <i className="fa fa-th-large" />
          </button>
          {sourceMenu && (
            <div className={styles.sourceMenu}>
              <button
                type="button"
                onClick={() => {
                  onToggleCamera();
                  setSourceMenu(false);
                }}
              >
                <i className="fa fa-video-camera" /> {cameraOff ? "Turn camera on" : "Turn camera off"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleScreen();
                  setSourceMenu(false);
                }}
              >
                <i className="fa fa-desktop" /> {screenSharing ? "Stop sharing" : "Share screen"}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.toolBtn}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={toggleFullscreen}
        >
          <i className={fullscreen ? "fa fa-compress" : "fa fa-expand"} />
        </button>
      </div>
    </div>
  );
}
