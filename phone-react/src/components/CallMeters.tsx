import { useLang } from "../hooks/useLang";
import { useSoundMeter } from "../hooks/useSoundMeter";
import { sip } from "../state/phoneService";
import styles from "./CallMeters.module.scss";

export function CallMeters({ sessionId }: { sessionId: string | null }) {
  const t = useLang();
  const local = sessionId ? sip.getLocalStream(sessionId) : null;
  const remote = sessionId ? sip.getRemoteStream(sessionId) : null;
  const mic = useSoundMeter(local);
  const speaker = useSoundMeter(remote);

  return (
    <div className={styles.meters}>
      <div className={styles.meter} title={t("microphone")}>
        <i className="fa fa-microphone" />
        <span className={styles.bar}>
          <span className={styles.fill} style={{ width: `${Math.round(mic * 100)}%` }} />
        </span>
      </div>
      <div className={styles.meter} title={t("speaker")}>
        <i className="fa fa-volume-up" />
        <span className={styles.bar}>
          <span className={styles.fill} style={{ width: `${Math.round(speaker * 100)}%` }} />
        </span>
      </div>
    </div>
  );
}
