# Browser-Phone React Rewrite — Roadmap

A ground-up rewrite of `Browser-Phone/Phone` into **React 18 + TypeScript (Vite)**, in a new
`phone-react/` project. The original `Phone/` app and the earlier `phone-ts/` port are left intact
as references.

Unlike `phone-ts` (which wrapped the original monolith), this project replaces the jQuery /
HTML-string / inline-handler UI with declarative, typed React components, and extracts the
SIP / WebRTC / storage logic into services and hooks.

---

## Architecture

```
phone-react/
  index.html                 # Vite entry; loads Font Awesome for icons
  src/
    main.tsx                 # React root (DEV: exposes window.store / window.sip)
    App.tsx                  # App shell + theme + responsive layout
    styles/                  # SCSS design system (7-1): abstracts/themes/base/utilities
    types/                   # Domain models: buddy.ts line.ts settings.ts lang.ts (308 keys)
    services/
      sip.ts                 # SipService interface + MockSipService
      sipjs/SipJsService.ts  # real SIP.js implementation
      db.ts                  # IndexedDB (buddies/messages/callHistory/recordings/qos)
      dialogs.ts             # alert/confirm/prompt/toast helpers
      chat/ChatClient.ts     # hand-rolled XMPP-over-WebSocket (RFC 7395) + REST login/contacts
    state/
      store.ts  types.ts     # Zustand store: devtools(persist(subscribeWithSelector(slices)))
      phoneService.ts        # `sip` singleton    chatService.ts  # `chatClient` singleton
      slices/                # registration, lines, buddies, chat, settings, ui, overlays
    hooks/
      useLang.ts  useBreakpoint.ts  useSoundMeter.ts
    components/
      ProfileHeader  SearchBar  BuddyList  ContactForm  DialPad
      CallArea  LineSwitcher  CallMeters  VideoStage  SettingsPanel
      chat/ChatPanel         # XMPP chat UI (login, contacts, thread, reactions, typing)
      ui/{Modal,DialogHost,ToastHost,Menu}
```

**Principles**
- UI is declarative React; no direct DOM building, no inline string handlers.
- All cross-cutting state lives in the Zustand store; components subscribe via selectors.
- Telephony is behind the `SipService` interface and chat behind a hand-rolled XMPP client, so the
  UI is testable without a PBX (`MockSipService` via `localStorage sipEngine="mock"`).
- Strict TypeScript from the start (`strict: true`).

> **See [PLAN.md](./PLAN.md)** for the authoritative architecture, design-system, state, and
> feature-parity detail. This file is the phase status summary.

---

## Status

### ✅ Phase 0 — Foundation (DONE)
- Vite React+TS scaffold, strict tsconfig, builds clean.
- Typed domain models: `Buddy`, `Line`, `Settings`, `Lang` (generated from `en.json`).
- Services: storage, settings persistence, i18n loader, `SipService` + `MockSipService`.
- Zustand store wiring registration + call lifecycle.

### ✅ Phase 1 — Design system, shell & contacts (DONE)
- SCSS token/mixin/theme design system; components on CSS Modules; light/dark via `data-theme`.
- Overlay primitives (Modal/Confirm/Prompt/Menu/Toast); responsive 920px shell.
- Store split into slices + `persist`/`devtools`/`subscribeWithSelector`; IndexedDB `db` service.
- Full contacts: CRUD, avatars, presence dots, sort/filter/search, pin.

### ✅ Phase 2 — Real SIP.js (DONE, verified live)
- `SipJsService implements SipService` (UserAgent/Registerer/Inviter/Invitation).
- Verified against a real Asterisk PBX: register, two-way audio, DTMF, clean teardown.

### ✅ Phase 3 — In-call features (DONE)
- Hold/unhold, mute, DTMF, call timers & timeline, multi-line switching.
- Blind & attended transfer, conference (Web Audio mixer), audio level meters.

### ✅ Phase 4 — Video & presentation (DONE)
- Video call UI, local preview, remote stage; screen share via `getDisplayMedia` + `replaceTrack`.

### ✅ Phase 5 — Messaging / XMPP (DONE, verified live)
- Hand-rolled **XMPP-over-WebSocket** (RFC 7395) + REST login/contacts against `chatstub-server`.
- Persisted history via **MAM (XEP-0313)**; presence; **typing (XEP-0085)**.
- **Delivery (XEP-0184)** + **read markers (XEP-0333)**; **reactions (XEP-0444)**;
  **retractions/unsend (XEP-0424)**.
- Verified live with two instances (alice + bob) incl. reaction/retraction persistence across
  reconnect. Group chat / bubbles (XEP-0045), carbons (XEP-0280), stream management (XEP-0198),
  and file send/download (urn:rainbow:file:1) are implemented and verified live.

---

## Remaining Phases

### Phase 1 — Core contacts & persistence
- [x] Buddy CRUD (add/edit/remove), typed, persisted to IndexedDB.
- [x] Buddy list: sorting/filtering (type/extension/alphabetical/activity), pin, search box.
- [x] Avatars (default set + custom), presence dots, missed badges.
- [ ] Port call-history / CDR storage model.

### Phase 2 — Real SIP.js integration (replaces MockSipService)
- [x] `SipJsService implements SipService` using `sip.js` npm.
- [x] Transport connect/reconnect, registration lifecycle, event mapping to the store.
- [x] Inbound call handling + incoming-call UI (answer audio/video/reject).
- [x] Media: attach remote audio/video; hidden audio element per session.

### Phase 3 — In-call features
- [x] Hold/unhold, mute/unmute, DTMF keypad, call timers & timeline.
- [x] Multiple lines / line switching.
- [x] Blind & attended transfer; conference.
- [x] Audio level meters (Web Audio) as a hook.

### Phase 4 — Video & presentation
- [x] Video call UI, local preview, remote video stage/layout.
- [x] Screen share.
- [ ] Present camera/video/scratchpad (Fabric replacement / `<canvas>` hook).

### Phase 5 — Messaging
- [x] Chat stream UI, typed message model, delivery/read receipts, typing.
- [x] XMPP engine (hand-rolled over WebSocket) behind a chat service.
- [x] MAM persisted history, presence, reactions, retractions.
- [x] Group chat (MUC/bubbles), carbons, stream management, file send/download.
- [ ] Inline image preview, dictation.

### Phase 6 — Recording, QoS, extras
- [ ] Call recording (MediaRecorder) + playback, stored in IndexedDB.
- [ ] QoS/stats collection + charts (Chart.js via a React wrapper or a lighter lib).
- [ ] Voicemail (MWI) subscription + notifications.

### Phase 7 — PWA & polish
- [ ] Service worker / offline / manifest.
- [ ] Notifications, settings tabs parity, theming parity with original wallpapers.
- [ ] `web_hook_*` equivalent: a typed event/callback API for host-page integration.
- [ ] Accessibility, responsive layout, tests.

---

## Notes / Decisions
- **State:** Zustand (lightweight, avoids heavy context boilerplate for this many cross-cutting slices).
- **Icons:** Font Awesome via CDN (same glyph set the original used) to keep markup familiar.
- **i18n:** English pack is always the base; the selected language overlays it so missing keys fall back.
  `Lang` is a generated interface (308 keys) so `t(key)` is type-checked.
- **Telephony boundary:** everything goes through `SipService`; swapping the mock for SIP.js
  should not touch UI components.
