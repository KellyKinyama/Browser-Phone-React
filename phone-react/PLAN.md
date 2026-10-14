# Browser-Phone React — Architecture & Parity Plan

Authoritative plan for the ground-up **React 18 + TypeScript + Vite** rewrite in `phone-react/`,
committing to **SCSS (Sass)** for styling and **Zustand (slice-based) with middleware** for state.
Goal: **feature + UI/UX parity** with the original Browser-Phone, with a clean, typed, maintainable
architecture. This document supersedes the high-level `ROADMAP.md` with concrete architecture.

> Status of foundation (already done): Vite React+TS scaffold, typed models (`Buddy`, `Line`,
> `Settings`, generated `Lang`), services (storage, i18n, settings, `SipService` + `MockSipService`),
> a single Zustand store, and first screens (profile header, dial pad, buddy list, call area,
> settings). This plan restructures styling and state and drives the app to full parity.

---

## 1. Principles

1. **Parity first, cleanliness always** — match the original's layout, flows, and interactions, but
   implement them with declarative components, typed state, and a token-based design system.
2. **Telephony/chat behind interfaces** — UI never touches SIP.js or the XMPP client directly; it
   talks to `SipService` / the chat slice. Swapping mock → real must not touch components.
3. **State in slices, not components** — all cross-cutting state lives in Zustand slices; components
   read via memoized selectors and dispatch actions.
4. **Design tokens, not magic values** — every color/space/radius/z-index comes from SCSS tokens
   derived from the original stylesheets.
5. **Strict TypeScript** throughout (`strict: true`).

---

## 2. Tooling Additions

| Concern | Choice | Notes |
| --- | --- | --- |
| Styling | **Sass** (`sass` dev dep) + **CSS Modules** (`*.module.scss`) | Scoped styles per component; global tokens/mixins via `@use`. Vite has built-in Sass support. |
| Global style entry | `src/styles/` 7-1-style architecture | tokens, mixins, themes, base, utilities. |
| State | **Zustand** + middleware: `persist`, `devtools`, `subscribeWithSelector` | Slices composed into one store. |
| Selector ergonomics | `zustand` + optional `useShallow` | Avoid re-renders on unrelated slice changes. |
| Class composition | `clsx` | Conditional classNames in components. |
| Icons | Font Awesome (CDN) — keep original glyphs | Matches original iconography for parity. |
| Dates | `dayjs` (or keep `moment` for exact format parity) | Original used Moment format strings; `dayjs` is lighter and format-compatible. |

Vite auto-compiles `.scss`; enable a global additionalData so tokens/mixins are available in every
module without manual `@use` (configured in `vite.config.ts` `css.preprocessorOptions.scss`).

---

## 3. SCSS Design System (fresh, parity-targeted)

### 3.1 Folder layout (`src/styles/`)
```
styles/
  index.scss              # global base, imported once in main.tsx
  abstracts/
    _tokens.scss          # design tokens as SCSS vars + CSS custom properties
    _mixins.scss          # focus-ring, truncate, scrollbar, button-reset, elevation, media()
    _functions.scss       # spacing(), z(), rem()
    _breakpoints.scss     # $bp-narrow: 920px; media mixins
  themes/
    _light.scss           # :root[data-theme="light"] custom-property values
    _dark.scss            # :root[data-theme="dark"] custom-property values
  base/
    _reset.scss           # normalize-ish reset (replaces normalize.css)
    _typography.scss      # Roboto scale
    _scrollbars.scss      # .cleanScroller equivalent
  utilities/
    _helpers.scss         # visually-hidden, no-select, flex helpers
```
Component styles live beside components as `Component.module.scss` and `@use "abstracts" as *`.

### 3.2 Tokens (extracted from original `phone.css` / themes)
Colors are exposed as **CSS custom properties** so themes swap at runtime via `data-theme`.

```scss
// abstracts/_tokens.scss  (values below are the parity source-of-truth)
$accent:        #3478F3;   // primary action blue (most-used brand color)
$danger:        #DC0000;   // hangup / destructive  (also #D80000)
$ok:            #37B24D;   // answer / online
$warn:          #FF9900;   // ringing / caution

// Neutral ramp (from original usage frequency)
$white:#FFFFFF; $n-100:#F3F3F3; $n-200:#E6E6E6; $n-300:#E1E1E1; $n-400:#CCCCCC;
$n-500:#999999; $n-600:#666666; $n-700:#404040; $n-750:#3E3E3E; $n-800:#333333;
$n-900:#292929; $n-950:#222222; $black:#000000;
$dark-header:#092139; $dark-accent:#416493;   // dark theme surfaces

// Spacing scale (px): 2 4 6 8 10 12 16 20 24 32
// Radii: sm 3px, md 4px, lg 8px, pill 999px
// Elevation: original uses inset button bevels + drop shadows -> mixin elevation(level)

// Z-index scale (parity with original): 1,10,50,80,99,998,999,overlay
$z: (base:1, raised:10, sticky:50, header:80, loading:99, menu:998, dialog:999, toast:1000);

// Layout metrics (parity)
$sidebar-width: 320px;
$profile-row-height: 50px;
$search-row-height: 35px;
```

Theme files map tokens → semantic custom properties:
```scss
:root[data-theme="light"]{
  --bg: #{$n-100}; --surface:#{$white}; --surface-2:#{$n-100};
  --text:#{$n-800}; --text-dim:#{$n-600}; --border:#{$n-300};
  --accent:#{$accent}; --danger:#{$danger}; --ok:#{$ok}; --warn:#{$warn};
}
:root[data-theme="dark"]{
  --bg:#{$n-950}; --surface:#{$n-900}; --surface-2:#{$n-950};
  --text:#{$n-100}; --text-dim:#{$n-500}; --border:#{$n-750};
  --accent:#{$accent}; --danger:#{$danger}; --ok:#{$ok}; --warn:#{$warn};
}
```
Wallpapers (`wallpaper.light.webp` / `wallpaper.dark.webp`) are applied to the content/stage area to
match the original's backdrop.

### 3.3 Responsive strategy (parity)
Original is JS-driven: a single **~920px** threshold toggles wide (sidebar + content side-by-side)
vs narrow (single column, swap between list and stream). Reproduce with:
- A `useBreakpoint()` hook (ResizeObserver on the app root) feeding a `ui` slice.
- CSS `media()` mixin for purely visual tweaks.
- Fixed `320px` sidebar in wide mode; full-width swap in narrow mode.

---

## 4. State Management (Zustand slices + middleware)

### 4.1 Store composition
One store, composed from typed slices. Each slice is `(set, get) => ({...})` with its own state +
actions. Middleware order: `devtools(persist(subscribeWithSelector(...)))`.

```
src/state/
  store.ts                # create<AppStore>()(devtools(persist(subscribeWithSelector(combine))))
  types.ts                # AppStore = RegistrationSlice & LinesSlice & BuddiesSlice & ...
  phoneService.ts         # `sip` singleton (real SIP.js by default, mock via localStorage)
  chatService.ts          # `chatClient` singleton (XMPP-over-WebSocket)
  slices/
    registrationSlice.ts  # transport + register lifecycle, DND/auto-answer policy
    linesSlice.ts         # active call appearances, selected line, per-line call state,
                          #   hold/mute/DTMF/transfer/attended-transfer/conference/screen-share
    buddiesSlice.ts       # contacts, selection, sort/filter, search term (IndexedDB-backed)
    chatSlice.ts          # XMPP chat: contacts, conversations, MAM history, presence,
                          #   typing, delivery/read receipts, reactions, retractions
    settingsSlice.ts      # account/appearance/permissions (persisted)
    uiSlice.ts            # ready, lang, activePanel (contacts|dialpad|chat|settings), breakpoint
    overlaysSlice.ts      # modals, dialogs, toasts
```

### 4.2 Persistence
`persist` middleware with `partialize` to store only durable slices:
- Persisted: `settings`, buddies metadata, sort/filter prefs, selected buddy.
- **Not** persisted: lines, registration, media stats, UI transient state.
- Bulk data (messages, call recordings, CDRs, QoS history) goes to **IndexedDB** via a dedicated
  `db` service (not localStorage) — mirrors original's IndexedDB usage. The slice holds indexes/refs;
  heavy blobs stay in IndexedDB.

### 4.3 Service ↔ store wiring
Services emit events; a thin `bindSipService(store)` subscribes and dispatches slice actions.
Components never import services directly except via actions. Selectors are colocated
(`selectors.ts` per slice) and memoized with `useShallow` where returning objects/arrays.

### 4.4 Example slice contract
```ts
export interface LinesSlice {
  lines: Line[];
  selectedLineNumber: number | null;
  addLine(line: Line): void;
  updateLine(n: number, patch: Partial<Line>): void;
  removeLine(n: number): void;
  selectLine(n: number): void;
  holdLine(n: number, hold: boolean): Promise<void>;
  muteLine(n: number, mute: boolean): Promise<void>;
  sendDtmf(n: number, tones: string): Promise<void>;
}
```

---

## 5. Component Architecture & Parity Mapping

Grounded in the original `InitUi()` layout (left 320px column + right content), reproduced as:

```
<AppShell>
  <Sidebar>                         // original #leftContent
    <ProfileBar/>                   // #UserProfile: avatar, name, reg dot, VM badge,
                                    //   dial/add/settings round buttons
    <SearchBar/>                    // #txtFindBuddy + filter button
    <PanelSwitch>                   // #myContacts / #actionArea swap
      <BuddyList/> | <DialPad/> | <SortFilterPanel/> | <AddContactPanel/>
    </PanelSwitch>
  </Sidebar>
  <Content>                         // original #rightContent (stream area)
    <WelcomeStream/> |              // default
    <CallStream lineNumber=…/>      // active call UI (audio/video)
    <MessageStream buddy=…/>        // chat with selected buddy
  </Content>
  <Overlays> Modal, Confirm, Prompt, Menu, Toasts </Overlays>
</AppShell>
```

### Parity mapping table (original → React)
| Original region / function | React component |
| --- | --- |
| `#leftContent` table | `Sidebar` |
| `#UserProfile`, reg dots, VM badge | `ProfileBar` + `RegistrationDot` |
| `ShowMyProfileMenu` | `ProfileMenu` (dropdown) |
| `#txtFindBuddy`, `BtnFilter` | `SearchBar` |
| `PopulateBuddyList`/`UpdateBuddyList` | `BuddyList` + `BuddyRow` |
| `ShowSortAnfFilter` | `SortFilterPanel` |
| `ShowDial`/`KeyPress` | `DialPad` |
| `AddSomeoneWindow`/`EditBuddyWindow` | `ContactForm` modal |
| `AddLineHtml` / line stream | `CallStream` + sub-parts |
| Answer/Progress/Active call UI | `IncomingCall`, `OutgoingCall`, `ActiveCall` |
| In-call controls row | `CallControls` |
| `RefreshStream` chat | `MessageStream` + `MessageBubble` |
| `OpenWindow`/`Alert`/`Confirm`/`Prompt` | `Modal`/`Alert`/`Confirm`/`Prompt` (portal) |
| `PopupMenu` | `Menu` (portal + positioning) |
| Call stats charts | `CallStatsPanel` (chart wrapper) |
| Call timeline | `CallTimeline` |

---

## 6. Feature Parity Matrix

| Area | Feature | Phase |
| --- | --- | --- |
| **Shell/UX** | Sidebar+content layout, themes (light/dark/system), wallpapers | P1 |
| | Responsive 920px wide/narrow swap | P1 |
| | Modal/Alert/Confirm/Prompt/Menu/Toast primitives | P1 |
| **Contacts** | Buddy list, rows, presence dots, missed badges | P1 |
| | Add/Edit/Delete contact, avatars (default+custom, Croppie→react-cropper) | P1 |
| | Sort (type/ext/alpha/activity), filter, pin, search | P1 |
| | IndexedDB persistence for buddies/messages/CDRs | P1 |
| **Registration** | Account settings, register/unregister, reg status | P2 |
| | Real **SIP.js** transport + reconnect | P2 |
| | DND, auto-answer, call-waiting policies | P2 |
| **Calling** | Outbound audio/video, line management, switch lines | P2 |
| | Inbound call UI (answer audio/video/reject), ringtone | P2 |
| | Hold/unhold, mute/unmute, DTMF, hangup, timers | P3 |
| | Blind transfer, attended transfer, conference | P3 |
| | Call timeline, audio level meters | P3 |
| **Video** | Local preview, remote stage/layout, pin/unpin | P4 |
| | Screen share, present camera/video/scratchpad (Fabric→canvas) | P4 |
| **Messaging** | Chat stream, bubbles, send/receive | P5 ✅ |
| | **XMPP-over-WebSocket** engine (hand-rolled, RFC 7395) via `ChatService` | P5 ✅ |
| | MAM (XEP-0313) persisted history, presence, typing (XEP-0085) | P5 ✅ |
| | Delivery (XEP-0184) + read markers (XEP-0333), reactions (XEP-0444), retractions (XEP-0424) | P5 ✅ |
| | Group chat / bubbles (XEP-0045 MUC), carbons (XEP-0280), stream mgmt (XEP-0198), file send (urn:rainbow:file:1) | P5 ✅ |
| | Image preview, emoji compose, dictation | P7 |
| **Recording/QoS** | Call recording (MediaRecorder) + playback (IndexedDB) | P6 |
| | QoS stats + charts, voicemail (MWI) + notifications | P6 |
| **Platform** | PWA (service worker, manifest, offline) | P7 |
| | `web_hook_*` → typed host-integration event API | P7 |
| | i18n full coverage (12 packs), a11y, tests | P7 |

---

## 7. Delivery Phases (revised)

- **P0 — Foundation** ✅ done (scaffold, models, services, mock, first screens).
- **P1 — Design system + shell + contacts** ✅ done
  - Sass `styles/` tokens/mixins/themes; components on `*.module.scss`.
  - Overlay primitives (Modal/Confirm/Prompt/Menu/Toast) and responsive shell.
  - Store refactored into slices + middleware; IndexedDB `db` service.
  - Full contacts experience (CRUD, avatars, sort/filter/search, pin).
- **P2 — Real SIP.js + calling core** ✅ done (`SipJsService implements SipService`; verified live
  against a real Asterisk PBX — registered, two-way audio, DTMF, clean teardown).
- **P3 — In-call features** ✅ done (hold/mute/DTMF/multi-line/timeline/blind+attended transfer/
  conference/audio meters).
- **P4 — Video & presentation** ✅ done (video call UI, local preview, remote stage, screen share).
- **P5 — Messaging (XMPP)** ✅ done — see the Messaging matrix rows above. Engine is a hand-rolled
  XMPP-over-WebSocket client against the `chatstub-server`; verified live with multiple instances
  (messaging, MAM history, presence, typing, receipts, reactions, retractions, **group chat /
  bubbles, carbons, stream management, file send/download**).
- **P6 — Recording, QoS, voicemail.** (next)
- **P7 — PWA, host hooks, i18n, a11y, tests.**

Each phase ends with the parity checklist (below) green for its scope.

---

## 8. Parity Verification

- **Side-by-side**: run original (`phone-ts` on :5173) and React (`phone-react` on :5174); compare
  each screen/flow.
- **Visual regression** (P1+): Playwright screenshots per component/state (light+dark), stored as
  baselines; diff on change.
- **Interaction parity checklist** per phase (dial, answer, hold, transfer, chat, settings…).
- **Token audit**: no hard-coded colors in component SCSS — only `var(--*)` / token functions
  (lint via stylelint `color-no-hex` on component modules).

---

## 9. Risks & Decisions

| Risk / Decision | Resolution |
| --- | --- |
| Pixel parity vs clean system | Fresh SCSS tokens seeded from original palette; parity validated via screenshots, not by copying CSS. |
| jQuery UI dialog/menu behaviors | Re-implemented as React portals (`Modal`/`Menu`) with matching sizing/animation. |
| Croppie / Fabric / Chart deps | Replace with React-friendly equivalents behind thin wrappers (react-cropper, canvas hook, chart wrapper). Chat uses a hand-rolled XMPP-over-WebSocket client (no Strophe). |
| Large transient state (meters, stats) causing re-renders | Keep in dedicated transient slice + selector isolation; render via refs where hot. |
| IndexedDB schema migration | Versioned `db` service with upgrade handlers (mirror original). |
| Moment format-string parity | Use `dayjs` with same format tokens, or keep `moment` if any gap. |

---

## 10. Immediate Next Steps (P6 + chat follow-ups)

1. **P6 — Recording/QoS/voicemail:** call recording (MediaRecorder) + IndexedDB playback; live
   `getStats()` QoS graphs (bitrate/jitter/packet-loss); voicemail (MWI) subscription.
2. **Chat group rooms (XEP-0045 MUC/bubbles):** join/create rooms, occupant list, group MAM.
3. **Chat resilience (XEP-0198 stream management):** `<enable resume="true"/>` + resumption on WS drop.
4. **Chat extras:** file/image send (`urn:rainbow:file:1` + REST upload), carbons (XEP-0280) for
   multi-device sync, surface chat unread counts on the contact list.

