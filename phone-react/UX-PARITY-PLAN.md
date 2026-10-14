# Browser-Phone React — UI/UX Parity Plan

Goal: bring the React rewrite (`phone-react/`) to UI/UX parity with the original
`Browser-Phone/Phone` app. Parity target is **"spirit" parity** — match the original's
layout, flows, interactions, and palette, implemented with our clean SCSS design system
(tokens seeded from the original), not a pixel-for-pixel CSS copy.

Reference inventory of the original is in this session's notes; key source files:
`Phone/index.html`, `Phone/phone.css` / `phone.light.css` / `phone.dark.css`, `Phone/phone.js`.

---

## Parity status snapshot

| Area | React today |
| --- | --- |
| Two-pane shell, light/dark, narrow collapse (920px) | ✅ close (`App.tsx`) |
| Contacts list, avatars, presence dots, pin, sort/filter/search, add/edit | ✅ good |
| Dial pad | ✅ good |
| In-call audio (hold/mute/DTMF/transfer/conference/timeline/meters/multi-line) | ✅ good |
| Video + screen share | ✅ basic |
| Dialog/menu/toast primitives | ✅ present |
| Chat (MAM/typing/receipts/reactions/retract/MUC/carbons/files) | ✅ functional, but UI cramped in 320px sidebar |

**Core gap:** the original's right pane is a per-contact *stream* (chat + call history),
and the call UI takes over that same pane. In React, chat is a separate sidebar panel and
the content pane is call-only.

---

## Phases

### P-UX1 — Contact-centric stream layout (highest impact)
- Select a contact → their stream opens in the **content pane** (not the sidebar).
- Sidebar keeps the contact/room list; content shows stream, or the active call when live.
- Split chat UI: `ChatSidebar` (login + contacts/rooms list) stays in the sidebar;
  `ChatStream` (thread + composer) renders in the content pane.
- Content priority: active SIP call → `CallArea`; else selected chat peer → `ChatStream`;
  else empty state.
- Later: interleave call-history/CDR rows into the stream; unify SIP buddies with XMPP
  contacts into one list.

### P-UX2 — Buddy row richness & hover affordances ✅ done
- Hover quick-actions (audio / video) fade in on row hover; kebab moved into the hover action row.
- Right-aligned last-activity timestamp; missed/unread badge with pulse-in animation.
- Full presence set: online / inUse / ringing / onHold / offline (already via `common` dot classes).
- Active-call row styling: green left border (active), amber left border (held) — buddy rows
  link to lines via `dial(..., { buddyId })`.

### P-UX3 — Incoming-call & ringing UX ✅ done
- Incoming-call UI: caller avatar pulse (`ringPulse`), name/number, "Incoming Call", Answer/Reject.
- `Ringer` component loops `Ringtone_1.mp3` while ringing; switches to `Tone_CallWaiting.mp3`
  when already on a call; stops on answer/reject. Verified live.
- Desktop `Notification` on incoming call (permission-guarded, click focuses the app).

### P-UX4 — Settings parity (tabbed) ✅ done
- Tabbed settings: Account / Devices / Calls / Appearance / Alerts.
- Device enumeration + selection (mic / speaker / ringer / camera) via `useMediaDevices`;
  media processing toggles (echo / noise / gain) wired into getUserMedia constraints
  (`SipJsService.setMedia` + `constraints()`), speaker/ringer via `setSinkId`.
- Call policies (DND / call-waiting / auto-answer) enforced on incoming calls; desktop
  notification toggle. Persisted settings deep-merged so new groups backfill defaults.

### P-UX5 — Chat stream visual polish ✅ done
- Day date separators (Today / Yesterday / date); image thumbnail previews with a click-to-expand
  lightbox; upload spinner on the attach button (`chatUploading`); emoji compose picker (24 glyphs).

### P-UX6 — Video/presentation polish ✅ done
- Mirrored local PiP (existing); camera-off placeholder; screen-share shown un-mirrored.
- On-stage tools: fullscreen toggle (Fullscreen API) + present-source menu (camera / screen).
- Status overlays: "Sharing screen" badge, muted-mic badge.
- (Remote gallery + pin deferred — backend sessions are 1:1; relevant only for multi-party.)

### P-UX7 — Visual-system fidelity pass ✅ done
- Token audit vs original confirmed: accent `#3478f3`, active green `#40bd3f`/answer `#059609`, hangup
  `#dc0000`, hold `#cc9009` — all present in themes.
- Custom thin scrollbars (`clean-scroller`) across scroll areas; wallpaper backgrounds wired
  (`--wallpaper` on content, webp assets in `public/`).
- **Roboto self-hosted** (`public/fonts/roboto/`, from the original) and loading verified.
- Button/row micro-transitions (0.12s) + `prefers-reduced-motion` guard; icon-button tooltips.

---

## Sequencing
1. P-UX1 (stream restructure) — biggest perceived-parity jump.
2. P-UX2 (buddy rows) + P-UX7 (tokens/scrollbars/tooltips) — quick visual payoff.
3. P-UX3 (incoming/ringing + notifications).
4. P-UX4 (settings tabs + device selection).
5. P-UX5 (chat polish) → P-UX6 (video polish).

## Verification
- Side-by-side: original on :5173, React on :5174; compare each screen/flow.
- Playwright screenshot baselines per component (light + dark + narrow).
- Per-phase interaction checklist (select → stream, hover actions, incoming call, settings tabs, device pick).
