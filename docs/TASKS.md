# cutncaption â€” Tasks

Build order, top to bottom. Each task is â‰¤ ~2 hours. Do one task at a time; tick it here in the same commit as the code. A task is done only when its **Test** passes and `pnpm check` is green. If a task turns out larger than 2 hours, split it here first.

Format: **AC** = acceptance criteria, **Test** = what proves it.

---

## M0 â€” Scaffold

- [x] **M0.1 Create the Next.js app** â€” pnpm, App Router, TypeScript strict, Tailwind, `output: 'export'`, `trailingSlash`, `images.unoptimized`, `src/` layout, Node version pinned.
  - AC: `pnpm build` produces `out/` with `index.html`.
  - Test: build succeeds; `out/index.html` exists.
- [x] **M0.2 Lint, format, typecheck, `pnpm check`** â€” ESLint, Prettier, `tsc --noEmit`; `check` = lint + typecheck + unit tests + build.
  - AC: `lint`, `format`, `typecheck`, `test`, `check` exist and pass on Windows (`preview`, `e2e`, `e2e:slow` arrive with M0.6).
  - Test: `pnpm check` exits 0.
- [x] **M0.3 Folder skeleton and boundary rules** â€” create the folders from ARCHITECTURE Â§2 with `index.ts` stubs; configure `eslint-plugin-boundaries` per Â§3.
  - AC: importing `engine/` from `components/`, or React from `editor/`, fails lint.
  - Test: a fixture file with a forbidden import is rejected by an ESLint test.
- [x] **M0.4 Vitest** â€” config, path aliases, coverage, one sample test.
  - Test: `pnpm test` runs and passes.
- [x] **M0.5 `_headers` and dev headers** â€” write `public/_headers` per ARCHITECTURE Â§4; dev-only COOP/COEP in `next.config.ts`.
  - AC: `/tools/*` is cross-origin isolated; `/` is not.
  - Test: covered by M0.6.
- [x] **M0.6 Playwright against `wrangler dev`** â€” projects: Chromium, WebKit, Pixel, iPhone. First spec checks headers.
  - AC: `pnpm e2e` builds, serves `out/`, runs specs.
  - Test: spec asserts `crossOriginIsolated === true` on a `/tools/` page and `false` on `/`, and that COOP/COEP response headers match.
- [x] **M0.7 i18n catalogue** â€” `src/i18n/messages/en.ts`, typed `t()`; ESLint rule forbidding string literals in JSX text under `features/` and `components/`.
  - Test: unit test for `t()` with params; lint fixture with a literal fails.
- [x] **M0.8 Design tokens and app shell** â€” Tailwind theme, layout, header, footer. Links from shell into `/tools/*` are plain `<a>`.
  - Test: e2e: home renders, header link to a tool triggers a full document load (navigation type check).
- [x] **M0.9 SEO registry stub and `/tools/[slug]` route** â€” registry with 20 slugs from ARCHITECTURE Â§11, each mounting a placeholder; `generateStaticParams`. _Done before M0.6, whose header spec needs a tool page._
  - AC: 20 pages are exported.
  - Test: unit test: registry has 20 unique slugs; the "each URL returns 200" e2e check is part of the M0.6 spec.
- [x] **M0.10 Shared `FileDrop`** â€” picker + drag-and-drop, accept list, rejects URLs/text drops, keyboard accessible.
  - Test: component test for accept/reject; e2e sets a file and sees its name and size.
- [x] **M0.11 Device detection and limits** â€” `engine/device`: capabilities, class L/M/H, `limits.ts` table, in-app browser detection.
  - Test: unit tests with mocked `navigator` for each class and each limit kind (hard/warn/clamp).
- [x] **M0.12 Unsupported and in-app browser screens** â€” shown instead of the tool when the minimum bar fails.
  - Test: e2e with an Instagram UA shows the "Open in your browser" screen.
- [x] **M0.13 LICENSE, README, CI** â€” GPL-3.0-or-later, README with setup, GitHub Actions running `pnpm check` and Chromium e2e.
  - Test: CI green on a PR.
- [x] **M0.14 Cloudflare deploy and R2 assets route** â€” Worker with static assets from `out/` on `*.workers.dev` (Pages is now part of Workers); private R2 bucket `cutncaption-assets` bound to it; `worker/assets.ts` per ARCHITECTURE Â§4. _Needs the owner's Cloudflare account (`wrangler login`): stop and ask before creating resources._
  - AC: the `workers.dev` URL serves the site with correct headers; `GET /assets/<test-key>` returns the object with immutable caching; other methods return 405; a missing key returns 404.
  - Test: unit tests of the function handler with a mocked R2 binding; `curl -I` checks recorded in the PR; e2e header spec run against the preview URL.
- [x] **M0.15 Analytics beacon under COEP** â€” add the Web Analytics snippet with `crossorigin="anonymous"`; confirm it loads on an isolated page.
  - AC: beacon script loads on `/tools/*` without a COEP console error; if it cannot, record the fallback decision in ARCHITECTURE Â§4.
  - Test: e2e asserts no COEP/CORP console errors on a tool page.

## M1 â€” Media engine

- [x] **M1.1 Test fixtures** â€” `scripts/gen-fixtures.mjs` (uses system ffmpeg; outputs committed): H.264/AAC MP4 5 s 720p, portrait MP4, MOV, VP9/Opus WebM, MKV, AVI, rotated MP4, MP3, video with no audio, 60 s low-res MP4. Each â‰¤ 300 KB.
  - Test: unit test checks every fixture exists and is under its size cap.
- [x] **M1.2 Vendor copy script** â€” `scripts/vendor-copy.mjs` copies ffmpeg JS glue to `public/vendor/ffmpeg/<ver>/`, copies the wasm files to `public/assets/` for `next dev` only (kept out of deploys by `public/.assetsignore`), and writes `src/engine/media/ffmpeg/vendor.json`; runs on `postinstall`.
  - Test: files exist after install; version folder matches `package.json`.
- [x] **M1.3 Asset manifest and upload script** â€” `scripts/assets.mjs`: `manifest` writes `src/engine/assets/manifest.json` (bytes and SHA-256, on install); `seed-local` fills Wrangler's local R2 so `pnpm preview` and e2e serve `/assets/*` exactly as production does; `upload` puts the files in the real bucket.
  - Test: unit test of manifest generation on a temp dir; e2e downloads every manifest entry through `/assets/*` and checks size, SHA-256 and headers (locally, and against the live site after upload).
- [x] **M1.4 `fetchAsset` with Cache Storage** â€” progress, integrity check, abort, quota fallback, old-version cleanup.
  - Test: unit tests with mocked `fetch`/`caches`: missâ†’store, hitâ†’no fetch, bad hashâ†’error, quota errorâ†’still returns, abort rejects.
- [x] **M1.5 ffmpeg loader (single-thread)** â€” wrapper and core loaded from `/vendor` as native modules (not bundled), wasm via `fetchAsset`; load, terminate, reload. Exercised through the unlisted diagnostics page `/tools/engine-check/`.
  - Test: integration: `-version` runs in Chromium and WebKit; second load makes no network request for the wasm.
- [x] **M1.6 Capability check** â€” assert encoders, filters and muxers listed in ARCHITECTURE Â§7 exist in the shipped core.
  - AC: any missing item is resolved by updating Â§7 before continuing.
  - Test: integration test parsing `-encoders`, `-filters`, `-muxers`.
- [x] **M1.7 Virtual FS helpers** â€” WORKERFS mount of the input `File`, MEMFS output read to `Blob`, cleanup in `finally`.
  - Test: integration: after a job, the FS lists no leftover files and the mount is gone, including on error.
- [x] **M1.8 Probe** â€” `engine/media/probe/`: ffprobe JSON â†’ `MediaInfo` (duration, container, video incl. rotation and display size, audio). `durationSec` is `null` when the file does not say; the UI may fill it from the `<video>` element. No separate `HTMLVideoElement` cross-check: ffprobe proved reliable on every fixture.
  - Test: unit tests on recorded ffprobe JSON for every fixture (incl. rotation, no audio, audio-only); integration probes every fixture with the real engine and refuses a non-media file.
- [x] **M1.9 Runner: progress, cancel, errors** â€” `time=` parser, `AbortSignal` â†’ terminate, `EngineError` mapping.
  - Test: unit tests for the log parser and error mapping; integration: cancel mid-job rejects with `cancelled` and the next job succeeds.
- [x] **M1.10 Multi-thread core and path selection** â€” load `core-mt` when the rule in ARCHITECTURE Â§5 holds; the engine caps thread counts on it (see Â§5).
  - Test: unit test of the selection function across class/isolation/iOS/job combinations; integration: an encode on Chromium reports `ffmpeg-mt`.
- [x] **M1.11 Watchdog fallback** â€” stall detection â†’ rerun on `core-st`, session flag.
  - Test: unit test with a fake runner that stalls; asserts one retry on st and the flag set.
- [x] **M1.12 `MediaEngine` public API and planner** â€” `probe`, `run`, job union, limit checks before run, one job at a time.
  - Test: unit: planner returns `copy` for remuxable jobs; over-limit job rejects with the right code. Integration: remux fixture end to end.
- [x] **M1.13 Shared job UI** â€” `JobProgress` (percent, cancel), `ResultCard` (preview, download, share, size before/after), error panel with "Details". All states are shown on the unlisted, noindex page `/preview/job-states/`, used by e2e and for design review.
  - Test: component tests for each state; e2e: download event fires with the expected filename.
- [x] **M1.14 Engine-load UX** â€” first-run download panel with size and progress; idle pre-warm when cached. Tool pages now read the chosen file with the engine and show its length and size; stalled engine downloads resume (see ARCHITECTURE Â§6).
  - Test: e2e: first visit shows the panel, reload does not.
- [x] **M1.15 Privacy network guard** â€” reusable Playwright fixture that fails a test on any request outside the allowlist or any request body > 2 KB, or any sending request whose body the browser hides (WebKit hides Blob/File bodies).
  - Test: the guard fails a deliberately bad spec; it is enabled for all later tool specs.

## M2 â€” Core tools

- [x] **M2.1 `VideoPreview` and `Timeline`** â€” playback, scrubbing, range handles, keyboard nudging, time inputs.
  - Test: component tests for handle clamping and keyboard steps.
- [ ] **M2.2 Trim command builders** â€” fast and precise.
  - Test: unit: exact arg arrays for sample inputs; extension follows source for fast mode.
- [ ] **M2.3 Trim tool UI** â€” mode switch with explanation, runs job, shows result.
  - Test: e2e: precise trim 1.0â€“3.0 s of the fixture â†’ output duration 2.0 Â± 0.1 s; fast trim completes and plays.
- [ ] **M2.4 Scale and preset maths** â€” even dimensions, short-side caps, rotation aware, never upscale.
  - Test: unit table tests (landscape, portrait, odd sizes, rotated).
- [ ] **M2.5 Compress builder and size estimate**.
  - Test: unit: arg arrays per preset; estimate within a sane range for fixtures.
- [ ] **M2.6 Compress tool UI** â€” presets, estimate, "output larger than input" handling.
  - Test: e2e: Balanced on the 720p fixture yields H.264/AAC, smaller file, correct dimensions.
- [ ] **M2.7 Bitrate calculator for compress-to-size** â€” per ARCHITECTURE Â§7, incl. refusal and ladder.
  - Test: unit table tests incl. boundary bitrates, unreachable target, source already under target.
- [ ] **M2.8 Compress-to-size job with retry** â€” single pass + one corrective rerun.
  - Test: unit with a fake runner returning an oversize result â†’ one rerun with the scaled bitrate. Integration: 60 s fixture to a small target â†’ size â‰¤ target and â‰¥ 85%.
- [ ] **M2.9 Compress-to-size UI** â€” MB input, WhatsApp/Discord/Email presets from `sizePresets.ts` (verify values), messages for unreachable/already-small.
  - Test: e2e for the WhatsApp preset path and the already-small path.
- [ ] **M2.10 Convert to MP4** â€” UI. _The remux-or-re-encode decision and both commands were built in M1.12 (`planJob`, `isMp4Compatible`) and are unit- and e2e-tested; this task adds the tool UI and its e2e._
  - Test: unit: decision function for each fixture's `MediaInfo`. e2e: WebM â†’ H.264/AAC MP4; MP4(H.264) â†’ path `copy`; MOV and MKV convert.
- [ ] **M2.11 Video to MP3** â€” builder, UI, no-audio error.
  - Test: unit args; e2e: output is `audio/mpeg`, duration matches Â±0.1 s; no-audio fixture shows the error.
- [ ] **M2.12 Mute** â€” builder, UI.
  - Test: e2e: output has no audio stream; path is `copy`.
- [ ] **M2.13 Wire tools into the registry** â€” slugs 1â€“9 mount the real tools with presets.
  - Test: e2e smoke: each of the 9 URLs accepts a file and reaches the ready state.
- [ ] **M2.14 Limits and errors pass** â€” every core tool blocks/warns per `limits.ts`; error copy reviewed.
  - Test: e2e with a mocked class L and an oversize fixture stub shows the block message; a forced engine error shows the friendly message.

## M3 â€” Meme Studio

- [ ] **M3.1 Fonts** â€” add Anton, Noto Sans, Noto Sans Devanagari to `public/fonts`; loader that registers `FontFace` and returns bytes for ffmpeg.
  - Test: unit: loader resolves once per font; e2e: `document.fonts.check` true for each.
- [ ] **M3.2 Text renderer** â€” `editor/render/text.ts`: wrap, auto-fit, outline, alignment, on a passed-in 2D context.
  - Test: unit tests for wrapping/fit maths with a mocked `measureText`; Playwright screenshot test for Latin and Devanagari samples.
- [ ] **M3.3 Layout geometry** â€” `editor/meme/layouts.ts`: output frame size, text boxes, bar height, zoom parameters for the 3 layouts.
  - Test: unit table tests across aspect ratios.
- [ ] **M3.4 Moment picker** â€” scrub and select 2â€“15 s with snapping; frame stepping.
  - Test: component tests for min/max enforcement.
- [ ] **M3.5 Studio shell and store** â€” layout switcher, text inputs, size control, export-format picker, live canvas preview over the video.
  - Test: component tests for store transitions; e2e: typing updates the preview canvas (pixel check in the text region).
- [ ] **M3.6 Overlay PNG export** â€” render the caption layer at output resolution to a PNG blob.
  - Test: integration: PNG has the expected dimensions and non-transparent pixels only inside the text boxes.
- [ ] **M3.7 Builder: top/bottom text â†’ MP4**.
  - Test: unit arg array; integration: output duration = selection, frame at t=1 s has caption pixels in the expected region.
- [ ] **M3.8 Builder: caption bar â†’ MP4**.
  - Test: unit; integration: output height = video height + bar, top rows are white.
- [ ] **M3.9 Builder: freeze-frame zoom â†’ MP4** â€” incl. audio padding and focal point.
  - Test: unit; integration: duration = freeze time + hold; last frame differs from freeze frame in scale (centre-crop similarity check); audio length matches video.
- [ ] **M3.10 Freeze-zoom controls** â€” pick the freeze frame, focal point, hold length; preview animation in canvas.
  - Test: component tests; e2e happy path.
- [ ] **M3.11 GIF export** â€” palette pipeline for all layouts.
  - Test: integration: `image/gif`, width â‰¤ 480, loops, frame count â‰ˆ duration Ã— 12.
- [ ] **M3.12 WhatsApp sticker export** â€” 512Ã—512 transparent pad, quality/fps retry ladder, > 6 s guard.
  - Test: unit: ladder sequence with a fake runner; integration: output is animated WebP, 512Ã—512, â‰¤ 500 KB, has alpha.
- [ ] **M3.13 Still image export** â€” canvas path, PNG/JPEG.
  - Test: e2e: image dimensions equal the video frame (plus bar for layout 2); caption pixels present.
- [ ] **M3.14 Preview/export parity check** â€” compare a preview canvas frame with the exported frame.
  - AC: text box position and height within 2% of frame height for all 3 layouts.
  - Test: integration test doing the comparison for Latin and Devanagari.
- [ ] **M3.15 Wire into registry** â€” slugs 10â€“13 with export presets; limits applied (output capped per class).
  - Test: e2e smoke for the four URLs; privacy guard on.
- [ ] **M3.16 Sticker check on a real phone** â€” send an exported sticker in WhatsApp on Android and iOS; record what happens. _Manual; ask the owner._
  - AC: result written into PRD Â§4.2 (and copy adjusted if WhatsApp treats it as an image).

## M4 â€” Auto captions

- [ ] **M4.1 Caption model and store** â€” `Word`, `Cue`, `CaptionDoc`; Zustand store with undo/redo.
  - Test: unit: every mutation and undo/redo round trips.
- [ ] **M4.2 Line splitter** â€” per ARCHITECTURE Â§10 step 5.
  - Test: unit table tests: punctuation, long gaps, char limits for both aspects, min/max duration, Devanagari input.
- [ ] **M4.3 SRT and VTT** â€” serialise and parse.
  - Test: unit: golden files; round trip equals input; timestamps formatted correctly past 1 hour.
- [ ] **M4.4 Devanagari â†’ Roman transliteration** â€” rules, schwa deletion, exception list.
  - Test: unit table of â‰¥ 150 common words and 20 sentences with expected output.
- [ ] **M4.5 Script toggle logic** â€” derived Roman text, manual overrides preserved both ways.
  - Test: unit: edit in Roman â†’ toggle â†’ toggle back keeps both edits.
- [ ] **M4.6 PCM extraction job** â€” `extractPcm` in 10-minute windows, joined to `Float32Array`; duration limit check.
  - Test: integration: fixture â†’ sample count = duration Ã— 16000 Â± 1%; over-limit rejects.
- [ ] **M4.7 Speech fixtures and ground truth** â€” CC0 English and Hindi clips (~8 s each) plus one with a 10 s silent gap; word-level reference JSON.
  - Test: unit: fixtures and references load and validate.
- [ ] **M4.8 Mirror models to R2** â€” Silero VAD, Whisper tiny (tests), base, small; add to manifest; confirm repo names and dtypes. _Uploads to the owner's R2: ask first._
  - Test: manifest test lists all files; a HEAD request succeeds for each.
- [ ] **M4.9 AI worker skeleton** â€” module worker, Comlink API, progress and abort plumbing, terminate.
  - Test: integration: ping/abort round trip; worker terminates cleanly.
- [ ] **M4.10 VAD** â€” Silero via `onnxruntime-web`; segment post-processing as pure functions.
  - Test: unit: merge/pad/drop rules on synthetic probabilities. `@slow` integration: silent-gap fixture yields no segment in the gap.
- [ ] **M4.11 Chunk packer** â€” speech segments â†’ windows â‰¤ 28 s; offset mapping.
  - Test: unit: never splits inside a segment unless it exceeds 28 s; offsets map back exactly.
- [ ] **M4.12 Whisper transcription** â€” transformers.js config for R2, backend/dtype selection, word timestamps, per-window progress.
  - Test: unit: backend selection for capability combinations. `@slow` integration with tiny: English fixture WER â‰¤ 30%, word times within Â±0.5 s.
- [ ] **M4.13 Tier selection and download UX** â€” Base default, Small offered per the rule in ARCHITECTURE Â§8, sizes shown.
  - Test: unit: offer rule; e2e with mocked capabilities shows/hides the option.
- [ ] **M4.14 Fake AI engine** â€” returns recorded words with simulated progress, selectable in tests.
  - Test: used by all following UI specs.
- [ ] **M4.15 Captions flow** â€” file â†’ language â†’ extract â†’ transcribe â†’ split, with engine hand-off (never both loaded).
  - Test: e2e (fake AI): reaches the edit screen with expected cues; unit: orchestrator terminates ffmpeg before starting AI.
- [ ] **M4.16 Edit screen: list and sync** â€” cue list, active cue follows playback, click to seek, text editing.
  - Test: component tests; e2e: editing text updates the preview overlay.
- [ ] **M4.17 Edit screen: timing and structure** â€” nudge start/end, split, merge, add, delete, undo/redo shortcuts.
  - Test: component tests per operation, incl. overlap prevention.
- [ ] **M4.18 Caption renderer and styles** â€” `CaptionStyle` data for Classic, Box, Highlight; canvas renderer used by the preview.
  - Test: unit: active-word lookup; screenshot tests per style, Latin and Devanagari.
- [ ] **M4.19 ASS emitter** â€” `CaptionDoc` + style â†’ ASS, incl. per-word events for Highlight.
  - Test: unit: golden ASS files for each style; escaping of braces and newlines.
- [ ] **M4.20 Burn-in job (ffmpeg path)** â€” fonts into MEMFS, `subtitles` filter, builder.
  - Test: unit args; integration: frame inside a cue has text pixels in the caption region, frame outside does not; Devanagari screenshot check.
- [ ] **M4.21 Export panel** â€” SRT, VTT, burned-in MP4 with style picker; script toggle applies to all exports.
  - Test: e2e (fake AI): download SRT and VTT and validate; burned MP4 has the source duration.
- [ ] **M4.22 Wire into registry** â€” slugs 14â€“17 with language/script/export presets.
  - Test: e2e smoke for the four URLs.
- [ ] **M4.23 Accuracy run** â€” run Base (and Small on desktop WebGPU) on the fixtures; record WER and speed against PRD Â§4.3.
  - AC: results table added to the PR; PRD thresholds adjusted only with the owner's agreement.
  - Test: `@slow` spec asserts PRD WER thresholds for Base.

## M5 â€” Shorts crop, WebCodecs fast path, hardening

- [ ] **M5.1 Crop maths and platform presets** â€” crop rect from pan position, even values, rotation aware; `presets.ts` with safe zones and duration warnings (verify against platform docs).
  - Test: unit table tests for landscape, square and portrait sources.
- [ ] **M5.2 Crop UI** â€” draggable 9:16 window, safe-zone overlay, preset switcher.
  - Test: component tests for drag clamping; e2e drag updates the rect.
- [ ] **M5.3 Crop job and registry** â€” builder, slugs 18â€“20.
  - Test: unit args; e2e: output is exactly 1080Ã—1920 with audio.
- [ ] **M5.4 WebCodecs capability probe** â€” `isConfigSupported` for H.264 encode at target sizes, audio encode presence, Mediabunny input support.
  - Test: unit with mocked WebCodecs for supported/unsupported/partial cases.
- [ ] **M5.5 WebCodecs transcode pipeline** â€” Mediabunny decode â†’ optional scale/crop â†’ encode â†’ MP4 mux; progress and abort.
  - Test: integration (Chromium): fixture transcodes; output H.264, right dimensions and duration.
- [ ] **M5.6 Audio handling without `AudioEncoder`** â€” copy AAC when possible, else encode audio with ffmpeg and mux.
  - Test: unit: decision function; integration with `AudioEncoder` stubbed out.
- [ ] **M5.7 Planner integration** â€” compress, compress-to-size, convert (re-encode) and crop prefer `webcodecs`; automatic fallback to ffmpeg on any pipeline error.
  - Test: unit: planner choices; integration: forced pipeline error falls back and still succeeds; existing tool e2e specs pass on both paths.
- [ ] **M5.8 Canvas compositing stage** â€” per-frame draw hook on `OffscreenCanvas`.
  - Test: integration: a hook drawing a red box appears in an output frame.
- [ ] **M5.9 Burn captions via WebCodecs** â€” use `editor/render` in the hook; fallback to the ASS path.
  - Test: integration: preview frame vs exported frame match within tolerance for all 3 styles.
- [ ] **M5.10 Memory hygiene** â€” terminate ffmpeg after re-encodes on class L and iOS; revoke object URLs; release previous results.
  - Test: unit: lifecycle policy per class; e2e: five jobs in a row on the iPhone project succeed.
- [ ] **M5.11 Share and save UX** â€” Share button via `navigator.share({ files })`, iOS "Save to Photos" hint.
  - Test: component test with mocked `canShare`.
- [ ] **M5.12 Accessibility pass** â€” axe on every tool page, keyboard walk-through of each tool.
  - Test: `@axe-core/playwright` spec with zero serious violations.
- [ ] **M5.13 Performance budget** â€” bundle analysis, lazy-load engines and editors, enforce â‰¤ 200 KB gzip initial JS per tool route.
  - Test: script that fails the build when a route exceeds the budget.
- [ ] **M5.14 Real-device calibration** â€” run the checklist below on one low-end Android (â‰¤ 3 GB), one mid Android, one iPhone, one desktop; update `limits.ts` and ARCHITECTURE Â§8. _Manual; needs the owner's devices._
  - Checklist: each core tool on a 100 MB file Â· compress a 3-minute 1080p clip Â· meme MP4/GIF/sticker Â· 2-minute Hindi captions + burn-in Â· crop Â· cancel mid-job Â· five jobs in a row without reload Â· open `/tools/engine-check/` twice on the iPhone and confirm the second run says "Loaded from this device: Yes" (the WebKit test browser cannot check this) Â· if a Mac is available, run the Engine check in Safari and one real encode, to confirm the multi-thread core does not stall there.
  - AC: results table committed; every _(calibrate)_ marker removed.

## M6 â€” SEO and launch

- [ ] **M6.1 `ToolPage` template** â€” H1, intro, tool slot, how-to, FAQ, related tools, breadcrumbs.
  - Test: component test renders all sections from a content object.
- [ ] **M6.2 Metadata** â€” `generateMetadata`: title, description, canonical, Open Graph, Twitter card; default OG image.
  - Test: unit: every registry entry yields title â‰¤ 60 and description â‰¤ 155 chars and a canonical URL.
- [ ] **M6.3 JSON-LD builders** â€” `SoftwareApplication`, `HowTo`, `FAQPage`, `BreadcrumbList`.
  - Test: unit: output validated against JSON schemas for each type.
- [ ] **M6.4 Content: core tool pages (slugs 1â€“9)**.
  - Test: content lint (M6.8) passes.
- [ ] **M6.5 Content: meme pages (10â€“13)**.
  - Test: content lint passes.
- [ ] **M6.6 Content: caption pages (14â€“17)**.
  - Test: content lint passes.
- [ ] **M6.7 Content: shorts pages (18â€“20)**.
  - Test: content lint passes.
- [ ] **M6.8 Content lint** â€” unit test over all content: required fields, 3â€“5 how-to steps, 4â€“6 FAQs, unique titles/descriptions/H1s, pairwise body similarity â‰¤ 40%, no mention of downloading from platforms.
  - Test: the test itself, plus a failing fixture.
- [ ] **M6.9 Home page** â€” value proposition, tool grid grouped by job, privacy statement.
  - Test: e2e: all 20 tools linked with plain anchors.
- [ ] **M6.10 `sitemap.xml` and `robots.txt`**.
  - Test: e2e: sitemap lists home, 20 tool URLs, privacy, about with absolute URLs; robots references the sitemap.
- [ ] **M6.11 Privacy and About pages** â€” what stays on device, every analytics field, open-source licence, ffmpeg and model credits with source links.
  - Test: unit: the analytics field list on the page is generated from the event schema.
- [ ] **M6.12 Event endpoint** â€” `worker/events.ts` with Analytics Engine binding, schema validation, no cookies. _Creates a Cloudflare dataset: ask first._
  - Test: unit tests of the handler: valid event accepted, unknown fields dropped, oversize body rejected.
- [ ] **M6.13 Client events** â€” `tool_run`, `engine_load`, `weekly_active`; local `returning` flag; `sendBeacon`.
  - Test: unit: returning logic across ISO weeks; e2e: one successful run sends exactly one `tool_run`; blocked endpoint does not break the tool.
- [ ] **M6.14 Favicon, manifest basics, 404 page**.
  - Test: e2e: unknown URL shows the 404 page with a link home.
- [ ] **M6.15 Lighthouse gate** â€” CI run on home and three tool pages.
  - AC: SEO â‰¥ 95, Accessibility â‰¥ 95, Performance â‰¥ 85 (mobile).
  - Test: Lighthouse CI assertion.
- [ ] **M6.16 Production launch** â€” custom domain (buy and attach to the Worker; redirect `*.workers.dev` to it; update `NEXT_PUBLIC_SITE_URL`), production env vars, R2 assets uploaded for the release versions, Search Console sitemap submission. _Outward-facing: owner confirms each step._
  - AC: production passes the header spec, privacy guard and one e2e per tool group.
  - Test: `pnpm e2e --grep @smoke` against the production URL.
- [ ] **M6.17 Post-launch check (day 7)** â€” review error rate by tool and device class, top failing paths, Web Vitals; file follow-up tasks here.
  - AC: a short findings list appended below.
