# Browser-Phone → TypeScript Porting Plan

A plan to port `Browser-Phone/Phone` to TypeScript using a **"dynamic, then close in on typed"** strategy: get the app compiling and running under TypeScript with permissive settings first, then incrementally tighten types module-by-module until the codebase is strictly typed.

> **Target location:** This TypeScript project lives in `Browser-Phone/phone-ts/` (the parent directory of the original `Phone/` folder). The original `Phone/` folder is left untouched as the reference and runtime fallback until the port is verified.

---

## 1. Source Analysis Summary

| Item | Finding |
| --- | --- |
| Main file | `Phone/phone.js` — **13,854 lines** |
| Functions | ~259 top-level `function` declarations in global scope |
| "Classes" | Constructor functions `Line` and `Buddy` (prototype-free, field-assignment style) |
| Global state | ~40 module-level `let`/`var` (e.g. `userAgent`, `Buddies`, `Lines`, `lang`, `selectedBuddy`, device arrays) |
| UI model | HTML built as string concatenation injected via jQuery `.html()/.append()` |
| Event binding | Inline `onclick="FunctionName(...)"` in generated HTML → **functions must be global** |
| Web hooks | ~60 `web_hook_on_*` callbacks declared as `var` in `index.html`, called from `phone.js` |
| Styles | `phone.css`, `phone.dark.css`, `phone.light.css` (+ `.min` variants) |
| i18n | `lang/*.json` (11 languages + `en.json`), loaded at runtime |
| Service worker | `sw.js` (separate scope) |

### External dependencies (and TypeScript type availability)

| Library | Version | Types |
| --- | --- | --- |
| jQuery | 3.6.1 | `@types/jquery` |
| jQuery UI | 1.13.2 | `@types/jqueryui` |
| SIP.js | 0.20.0 | Ships own `.d.ts` (npm `sip.js`) |
| Moment.js | 2.24.0 | Ships own types (npm `moment`) |
| Chart.js | 2.7.2 | `@types/chart.js` (v2 line) |
| Fabric.js | 2.4.6 | `@types/fabric` |
| Croppie | 2.6.4 | `@types/croppie` |
| Strophe.js | 1.4.1 | `@types/strophe.js` (or hand stub) |
| jquery.md5 | — | hand stub (`global.d.ts`) |
| jquery.base64 | — | hand stub (`global.d.ts`) |

### Key porting constraints

1. **Global-scope requirement.** Inline `onclick=` handlers reference functions by bare name. During the port these functions must remain reachable on `window`. Converting to ES modules (which are scoped) breaks this unless we either (a) explicitly attach handlers to `window`, or (b) migrate event binding away from inline HTML. The plan keeps them global initially and migrates later.
2. **No build step today.** The app loads `phone.js` directly via `<script>`. We introduce a bundler so TS output can still be delivered as a single global script that `index.html` consumes with minimal change.
3. **Mutable shared state.** Heavy reliance on module-level mutable globals; typing these is straightforward but refactoring them is out of scope for the port.

---

## 2. Strategy: "Dynamic → Typed"

The migration deliberately starts loose and tightens over time, so the app keeps working at every step.

**Phase gates (tsconfig strictness ratchet):**

1. **Dynamic start** — `allowJs: true`, `checkJs: false`, `strict: false`, `noImplicitAny: false`. Rename `phone.js` → `phone.ts` and get it to **emit** a working bundle. Implicit `any` everywhere is acceptable.
2. **Compiles clean** — resolve syntax/emit errors only. App must run identically to the original.
3. **Type the data model** — add interfaces/classes for `Line`, `Buddy`, call `data`, lang pack, settings. Turn on `noImplicitAny` for new code.
4. **Type the boundaries** — type the dependency surfaces (SIP.js sessions, jQuery usage, WebRTC) and the `web_hook_*` contract.
5. **Strict** — flip `strict: true` (and `strictNullChecks`) file-by-file using `// @ts-strict`-style isolation (split into modules), fixing fallout incrementally.
6. **Modularize (optional, final)** — break the monolith into ES modules, moving inline handlers to delegated event binding.

Each phase is independently shippable: the app runs after every phase.

---

## 3. Target Project Structure

```
Browser-Phone/
  Phone/                      # original — unchanged reference
  phone-ts/
    PORTING-PLAN.md           # this file
    package.json
    tsconfig.json
    .eslintrc.cjs             # optional
    vite.config.ts            # or esbuild/webpack — bundler config
    public/                   # static assets copied from Phone/
      index.html              # adapted to load the bundle
      phone.css / *.dark.css / *.light.css
      lang/*.json
      avatars/ icons/ media/
      sw.js manifest.json favicon.ico
      wallpaper.*.webp
    src/
      global.d.ts             # ambient types for md5/base64/window globals/web hooks
      vendor.d.ts             # re-export/adjust types for pinned dep versions
      phone.ts                # the ported monolith (phase 1-5)
      # later (phase 6) split-outs:
      types/                  # Line.ts, Buddy.ts, Settings.ts, Lang.ts, CallData.ts ...
      core/                   # userAgent, register, transport
      calls/                  # invite, answer, hold, transfer, conference, recording
      ui/                     # buddy list, lines, dialpad, settings, profile
      media/                  # audio meters, video, screenshare, QoS/stats
      messaging/              # chat, SIMPLE/XMPP, streams
      util/                   # formatters, db helpers
```

---

## 4. Tooling Decisions

- **Bundler:** Vite (fast dev server + library/IIFE build). Alternative: esbuild or webpack. Output a single IIFE/global bundle so `index.html` keeps a simple `<script>` include and inline `onclick=` handlers keep working (functions attached to `window`).
- **Package manager:** npm (matches Windows/VS Code defaults).
- **Dependency delivery:** Move the CDN-loaded libraries (jQuery, SIP.js, Moment, Fabric, Croppie, Chart, Strophe) into `package.json` dependencies and import them, OR keep them as external `<script>` CDN includes and declare them `ambient` (`declare const SIP: ...`). Recommended: **npm imports** for the libraries the TS code calls directly (SIP.js, Moment, Fabric, Croppie, Chart, Strophe), keep jQuery global.
- **Lint:** ESLint + `@typescript-eslint` (optional but recommended for the ratchet).

### Initial `tsconfig.json` (Phase 1 — permissive)

```jsonc
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false,
    "skipLibCheck": true,
    "sourceMap": true,
    "outDir": "dist",
    "types": ["jquery", "jqueryui"]
  },
  "include": ["src/**/*"]
}
```

### Final `tsconfig.json` (Phase 5 — strict)

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": false,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

---

## 5. Phased Work Plan

### Phase 0 — Scaffold (no behavior change)
- [ ] Create `phone-ts/` with `package.json`, permissive `tsconfig.json`, bundler config.
- [ ] Add dependencies + `@types/*` listed in §1.
- [ ] Copy static assets into `public/` (css, lang, icons, avatars, media, manifest, sw.js).
- [ ] Create `index.html` that loads the bundled output instead of raw `phone.js`.
- [ ] Verify: `npm run build` produces a bundle; app loads blank/registers as before.

### Phase 1 — Dynamic port (get it compiling)
- [ ] Copy `Phone/phone.js` → `src/phone.ts`.
- [ ] Add `src/global.d.ts`: ambient declarations for `$.md5`, `$.base64`, the `web_hook_*` globals, and any `window.*` properties used (`window.SettingsOutputAudio`, etc.).
- [ ] Import or ambient-declare vendor globals (`SIP`, `moment`, `fabric`, `Croppie`, `Chart`, `Strophe`).
- [ ] Expose every inline-handler function on `window` (bulk `Object.assign(window, {...})` or `(window as any).Fn = Fn`) so `onclick=` keeps working.
- [ ] Fix only emit-blocking errors. Leave implicit `any`.
- [ ] Verify: app runs identically (register, dial, answer, hangup, chat, settings).

### Phase 2 — Type the data model
- [ ] Convert `Line` and `Buddy` constructor functions to `class` with typed fields.
- [ ] Define `interface` for the SIP session `data` bag (`session.data.*`: `line`, `calldirection`, `callstart`, `buddyId`, `hold[]`, `mute[]`, `transfer[]`, `recordings[]`, `confcalls[]`, `withvideo`, `earlyReject`, `IsCurrentCall`, etc.).
- [ ] Type `lang` (generate `Lang` interface from `lang/en.json` keys).
- [ ] Type the settings/config globals block (§ near top of `phone.js`).
- [ ] Enable `noImplicitAny` and fix new model-related errors.

### Phase 3 — Type the dependency boundaries
- [ ] Type SIP.js usage: `UserAgent`, `Registerer`, `Inviter`, `Invitation`, `Session`, `SessionState`, transport. Wrap the loosely-typed `session.data` via module augmentation or a typed accessor.
- [ ] Type jQuery usage patterns (mostly covered by `@types/jquery`).
- [ ] Type WebRTC/media: `MediaStream`, `RTCPeerConnection`, `MediaRecorder`, `AudioContext` nodes, device enumeration.
- [ ] Type the `web_hook_*` contract as a single `WebHooks` interface.

### Phase 4 — Tighten nullability & unused
- [ ] Turn on `strictNullChecks`; add guards / non-null assertions where the DOM lookups are known-safe.
- [ ] Replace `var`→`let/const`, `==`→`===` where safe, as incidental cleanups (only in touched code).

### Phase 5 — Strict mode
- [ ] Flip `strict: true`. Resolve remaining fallout.
- [ ] CI check: `tsc --noEmit` passes clean.

### Phase 6 — Modularize (optional, recommended)
- [ ] Split `phone.ts` into the `src/*` module folders (§3).
- [ ] Replace inline `onclick=` handlers with delegated `addEventListener` binding (or keep a thin `window` facade for backward compatibility).
- [ ] Remove the `Object.assign(window, …)` shim once no inline handlers remain.

---

## 6. Risk Register & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Inline `onclick=` handlers break under module scope | App buttons stop working | Keep functions on `window` via shim until Phase 6; migrate to delegated events last |
| Pinned old lib versions (Chart 2.x, Moment, SIP 0.20) vs newer `@types` | Type mismatch noise | Pin `@types/*` to matching major; `skipLibCheck: true`; hand-stub where needed |
| Huge single file slows `tsc` / editor | Dev friction | `skipLibCheck`, incremental build (`"incremental": true`), eventual module split (Phase 6) |
| `session.data` is an untyped bag mutated everywhere | Hard to type | Define one `SessionData` interface + module augmentation of SIP `Session` |
| Service worker (`sw.js`) separate scope | Out of main bundle | Keep `sw.js` as a separate TS entry or leave as JS; don't bundle into main |
| Behavior regressions during port | Silent breakage | Manual smoke-test checklist (below) after each phase; keep original `Phone/` to diff against |

---

## 7. Verification / Smoke-Test Checklist (run after each phase)

- [ ] App loads, service worker registers, language pack loads.
- [ ] SIP registers against the configured WSS server.
- [ ] Outbound audio call → answer → hangup.
- [ ] Inbound call → answer / reject.
- [ ] Hold / unhold, mute / unmute, DTMF.
- [ ] Video call + screen share + present camera.
- [ ] Blind transfer, attended transfer, conference.
- [ ] Call recording start/stop + playback.
- [ ] Chat (SIMPLE + XMPP), image/file send.
- [ ] Buddy add/edit/delete, sort/filter.
- [ ] Settings: device selection, QoS/stats charts.
- [ ] `web_hook_*` callbacks still fire.

---

## 8. Suggested Order of Execution

1. Phase 0 + Phase 1 together (scaffold + compiling dynamic port) — delivers a running TS build.
2. Phase 2 (data model) — biggest typing value for least risk.
3. Phase 3 (dependency boundaries).
4. Phases 4–5 (nullability → strict).
5. Phase 6 (modularize) — only if long-term maintenance warrants it.

---

## 9. Definition of Done

- `npm run build` emits a working bundle consumed by `index.html`.
- `tsc --noEmit` passes under strict `tsconfig`.
- Smoke-test checklist passes identically to the original `Phone/` app.
- No remaining `any` except explicitly annotated, justified cases.
- (If Phase 6 done) no inline `onclick=` depends on undocumented globals.
```
