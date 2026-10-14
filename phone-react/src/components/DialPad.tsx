import { useState } from "react";
import clsx from "clsx";
import { useAppStore } from "../state/store";
import { useLang } from "../hooks/useLang";
import styles from "./DialPad.module.scss";
import common from "./common.module.scss";

const KEYS: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"]
];

const LETTERS: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ"
};

const MAX_DID_LENGTH = 16;

export function DialPad() {
  const t = useLang();
  const [value, setValue] = useState("");
  const registration = useAppStore((s) => s.registration);
  const dial = useAppStore((s) => s.dial);

  const canDial = value.length > 0 && registration === "registered";

  const press = (key: string) =>
    setValue((v) => (v + key).slice(0, MAX_DID_LENGTH));
  const backspace = () => setValue((v) => v.slice(0, -1));

  const placeCall = (withVideo: boolean) => {
    if (!canDial) return;
    void dial(value, withVideo);
    setValue("");
  };

  return (
    <div className={styles.dialPad}>
      <div className={styles.dialInputRow}>
        <input
          className={styles.dialInput}
          value={value}
          placeholder={t("find_someone")}
          onChange={(e) =>
            setValue(e.target.value.replace(/[^\d*#+]/g, "").slice(0, MAX_DID_LENGTH))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") placeCall(false);
          }}
        />
        <button
          type="button"
          className={common.iconButton}
          onClick={backspace}
          disabled={value.length === 0}
          aria-label="Backspace"
        >
          <i className="fa fa-long-arrow-left" />
        </button>
      </div>

      <div className={styles.dialKeys}>
        {KEYS.flat().map((key) => (
          <button key={key} type="button" className={styles.dialKey} onClick={() => press(key)}>
            <span className={styles.dialDigit}>{key}</span>
            <span className={styles.dialLetters}>{LETTERS[key] ?? "\u00A0"}</span>
          </button>
        ))}
      </div>

      <div className={styles.dialActions}>
        <button
          type="button"
          className={clsx(common.callButton, common.audio)}
          disabled={!canDial}
          title={t("audio_call")}
          onClick={() => placeCall(false)}
        >
          <i className="fa fa-phone" />
        </button>
        <button
          type="button"
          className={clsx(common.callButton, common.video)}
          disabled={!canDial}
          title={t("video_call")}
          onClick={() => placeCall(true)}
        >
          <i className="fa fa-video-camera" />
        </button>
      </div>

      {registration !== "registered" && (
        <p className={styles.dialHint}>Register your account to place calls.</p>
      )}
    </div>
  );
}
