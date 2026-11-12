# cutncaption — Tasks

Build order, top to bottom. Each task is ≤ ~2 hours. Do one task at a time; tick it here in the same commit as the code. A task is done only when its **Test** passes and `pnpm check` is green. If a task turns out larger than 2 hours, split it here first.

Format: **AC** = acceptance criteria, **Test** = what proves it.

---

## M0 — Scaffold

- [x] **M0.1 Create the Next.js app** — pnpm, App Router, TypeScript strict, Tailwind, `output: 'export'`, `trailingSlash`, `images.unoptimized`, `src/` layout, Node version pinned.
  - AC: `pnpm build` produces `out/` with `index.html`.
  - Test: build succeeds; `out/index.html` exists.
- [x] **M0.2 Lint, format, typecheck, `pnpm check`** — ESLint, Prettier, `tsc --noEmit`; `check` = lint + typecheck + unit tests + build.
  - AC: `lint`, `format`, `typecheck`, `test`, `check` exist and pass on Windows (`preview`, `e2e`, `e2e:slow` arrive with M0.6).
  - Test: `pnpm check` exits 0.
- [x] **M0.3 Folder skeleton and boundary rules** — create the folders from ARCHITECTURE §2 with `index.ts` stubs; configure `eslint-plugin-boundaries` per §3.
  - AC: importing `engine/` from `components/`, or React from `editor/`, fails lint.
  - Test: a fixture file with a forbidden import is rejected by an ESLint test.
- [x] **M0.4 Vitest** — config, path aliases, coverage, one sample test.
  - Test: `pnpm test` runs and passes.
- [x] **M0.5 `_headers` and dev headers** — write `public/_headers` per ARCHITECTURE §4; dev-only COOP/COEP in `next.config.ts`.
  - AC: `/tools/*` is cross-origin isolated; `/` is not.
  - Test: covered by M0.6.
- [x] **M0.6 Playwright against `wrangler pages dev out`** — projects: Chromium, WebKit, Pixel, iPhone. First spec checks headers.
  - AC: `pnpm e2e` builds, serves `out/`, runs specs.
  - Test: spec asserts `crossOriginIsolated === true` on a `/tools/` page and `false` on `/`, and that COOP/COEP response headers match.
- [x] **M0.7 i18n catalogue** — `src/i18n/messages/en.ts`, typed `t()`; ESLint rule forbidding string literals in JSX text under `features/` and `components/`.
  - Test: unit test for `t()` with params; lint fixture with a literal fails.
- [ ] **M0.8 Design tokens and app shell** — Tailwind theme, layout, header, footer. Links from shell into `/tools/*` are plain `<a>`.
  - Test: e2e: home renders, header link to a tool triggers a full document load (navigation type check).
- [x] **M0.9 SEO registry stub and `/tools/[slug]` route** — registry with 20 slugs from ARCHITECTURE §11, each mounting a placeholder; `generateStaticParams`. _Done before M0.6, whose header spec needs a tool page._
  - AC: 20 pages are exported.
  - Test: unit test: registry has 20 unique slugs; the "each URL returns 200" e2e check is part of the M0.6 spec.
- [ ] **M0.10 Shared `FileDrop`** — picker + drag-and-drop, accept list, rejects URLs/text drops, keyboard accessible.
  - Test: component test for accept/reject; e2e sets a file and sees its name and size.
- [ ] **M0.11 Device detection and limits** — `engine/device`: capabilities, class L/M/H, `limits.ts` table, in-app browser detection.
  - Test: unit tests with mocked `navigator` for each class and each limit kind (hard/warn/clamp).
- [ ] **M0.12 Unsupported and in-app browser screens** — shown instead of the tool when the minimum bar fails.
  - Test: e2e with an Instagram UA shows the "Open in your browser" screen.
- [ ] **M0.13 LICENSE, README, CI** — GPL-3.0-or-later, README with setup, GitHub Actions running `pnpm check` and Chromium e2e.
  - Test: CI green on a PR.
- [ ] **M0.14 Cloudflare Pages deploy and R2 assets function** — Pages project from `out/` on `*.pages.dev`, preview deploys; private R2 bucket bound to the project; `functions/assets/[[path]].ts` per ARCHITECTURE §4. _Needs the owner's Cloudflare account (`wrangler login`): stop and ask before creating resources._
  - AC: the `pages.dev` URL serves the site with correct headers; `GET /assets/<test-key>` returns the object with immutable caching; other methods return 405; a missing key returns 404.
  - Test: unit tests of the function handler with a mocked R2 binding; `curl -I` checks recorded in the PR; e2e header spec run against the preview URL.
- [ ] **M0.15 Analytics beacon under COEP** — add the Web Analytics snippet with `crossorigin="anonymous"`; confirm it loads on an isolated page.
  - AC: beacon script loads on `/tools/*` without a COEP console error; if it cannot, record the fallback decision in ARCHITECTURE §4.
  - Test: e2e asserts no COEP/CORP console errors on a tool page.

## M1 — Media engine

- [ ] **M1.1 Test fixtures** — `scripts/gen-fixtures.mjs` (uses system ffmpeg; outputs committed): H.264/AAC MP4 5 s 720p, portrait MP4, MOV, VP9/Opus WebM, MKV, video with no audio, 60 s low-res MP4. Each ≤ 300 KB.
  - Test: unit test checks every fixture exists and is under its size cap.
- [ ] **M1.2 Vendor copy script** — `scripts/vendor-copy.mjs` copies ffmpeg JS glue to `public/vendor/ffmpeg/<ver>/`; runs on `postinstall`.
  - Test: files exist after install; version folder matches `package.json`.
- [ ] **M1.3 Asset manifest and upload script** — `scripts/upload-assets.mjs` uploads cores to R2 and writes `manifest.json` with bytes and SHA-256; a local static server serves the same paths from `node_modules` for tests.
  - Test: unit test of manifest generation on a temp dir; local server returns a core wasm with CORS headers.
- [ ] **M1.4 `fetchAsset` with Cache Storage** — progress, integrity check, abort, quota fallback, old-version cleanup.
  - Test: unit tests with mocked `fetch`/`caches`: miss→store, hit→no fetch, bad hash→error, quota error→still returns, abort rejects.
- [ ] **M1.5 ffmpeg loader (single-thread)** — `classWorkerURL`, core from `/vendor`, wasm via `fetchAsset`; load, terminate, reload.
  - Test: integration: `-version` runs in Chromium and WebKit; second load makes no network request for the wasm.
- [ ] **M1.6 Capability check** — assert encoders, filters and muxers listed in ARCHITECTURE §7 exist in the shipped core.
  - AC: any missing item is resolved by updating §7 before continuing.
  - Test: integration test parsing `-encoders`, `-filters`, `-muxers`.
- [ ] **M1.7 Virtual FS helpers** — WORKERFS mount of the input `File`, MEMFS output read to `Blob`, cleanup in `finally`.
  - Test: integration: after a job, the FS lists no leftover files and the mount is gone, including on error.
- [ ] **M1.8 Probe** — `commands/probe.ts` parser → `MediaInfo`; cross-check with `HTMLVideoElement`.
  - Test: unit tests on recorded stderr for each fixture type (incl. rotation, no audio); integration probe of the MP4 fixture.
- [ ] **M1.9 Runner: progress, cancel, errors** — `time=` parser, `AbortSignal` → terminate, `EngineError` mapping.
  - Test: unit tests for the log parser and error mapping; integration: cancel mid-job rejects with `cancelled` and the next job succeeds.
- [ ] **M1.10 Multi-thread core and path selection** — load `core-mt` when the rule in ARCHITECTURE §5 holds.
  - Test: unit test of the selection function across class/isolation/iOS/job combinations; integration: an encode on Chromium reports `ffmpeg-mt`.
- [ ] **M1.11 Watchdog fallback** — stall detection → rerun on `core-st`, session flag.
  - Test: unit test with a fake runner that stalls; asserts one retry on st and the flag set.
- [ ] **M1.12 `MediaEngine` public API and planner** — `probe`, `run`, job union, limit checks before run, one job at a time.
  - Test: unit: planner returns `copy` for remuxable jobs; over-limit job rejects with the right code. Integration: remux fixture end to end.
- [ ] **M1.13 Shared job UI** — `JobProgress` (percent, cancel), `ResultCard` (preview, download, share, size before/after), error panel with "Details".
  - Test: component tests for each state; e2e: download event fires with the expected filename.
- [ ] **M1.14 Engine-load UX** — first-run download panel with size and progress; idle pre-warm when cached.
  - Test: e2e: first visit shows the panel, reload does not.
- [ ] **M1.15 Privacy network guard** — reusable Playwright fixture that fails a test on any request outside the allowlist or any request body > 2 KB.
  - Test: the guard fails a deliberately bad spec; it is enabled for all later tool specs.

## M2 — Core tools

- [ ] **M2.1 `VideoPreview` and `Timeline`** — playback, scrubbing, range handles, keyboard nudging, time inputs.
  - Test: component tests for handle clamping and keyboard steps.
- [ ] **M2.2 Trim command builders** — fast and precise.
  - Test: unit: exact arg arrays for sample inputs; extension follows source for fast mode.
- [ ] **M2.3 Trim tool UI** — mode switch with explanation, runs job, shows result.
  - Test: e2e: precise trim 1.0–3.0 s of the fixture → output duration 2.0 ± 0.1 s; fast trim completes and plays.
- [ ] **M2.4 Scale and preset maths** — even dimensions, short-side caps, rotation aware, never upscale.
  - Test: unit table tests (landscape, portrait, odd sizes, rotated).
- [ ] **M2.5 Compress builder and size estimate**.
  - Test: unit: arg arrays per preset; estimate within a sane range for fixtures.
- [ ] **M2.6 Compress tool UI** — presets, estimate, "output larger than input" handling.
  - Test: e2e: Balanced on the 720p fixture yields H.264/AAC, smaller file, correct dimensions.
- [ ] **M2.7 Bitrate calculator for compress-to-size** — per ARCHITECTURE §7, incl. refusal and ladder.
  - Test: unit table tests incl. boundary bitrates, unreachable target, source already under target.
- [ ] **M2.8 Compress-to-size job with retry** — single pass + one corrective rerun.
  - Test: unit with a fake runner returning an oversize result → one rerun with the scaled bitrate. Integration: 60 s fixture to a small target → size ≤ target and ≥ 85%.
- [ ] **M2.9 Compress-to-size UI** — MB input, WhatsApp/Discord/Email presets from `sizePresets.ts` (verify values), messages for unreachable/already-small.
  - Test: e2e for the WhatsApp preset path and the already-small path.
- [ ] **M2.10 Convert to MP4** — remux-or-re-encode decision, builder, UI.
  - Test: unit: decision function for each fixture's `MediaInfo`. e2e: WebM → H.264/AAC MP4; MP4(H.264) → path `copy`; MOV and MKV convert.
- [ ] **M2.11 Video to MP3** — builder, UI, no-audio error.
  - Test: unit args; e2e: output is `audio/mpeg`, duration matches ±0.1 s; no-audio fixture shows the error.
- [ ] **M2.12 Mute** — builder, UI.
  - Test: e2e: output has no audio stream; path is `copy`.
- [ ] **M2.13 Wire tools into the registry** — slugs 1–9 mount the real tools with presets.
  - Test: e2e smoke: each of the 9 URLs accepts a file and reaches the ready state.
- [ ] **M2.14 Limits and errors pass** — every core tool blocks/warns per `limits.ts`; error copy reviewed.
  - Test: e2e with a mocked class L and an oversize fixture stub shows the block message; a forced engine error shows the friendly message.

## M3 — Meme Studio

- [ ] **M3.1 Fonts** — add Anton, Noto Sans, Noto Sans Devanagari to `public/fonts`; loader that registers `FontFace` and returns bytes for ffmpeg.
  - Test: unit: loader resolves once per font; e2e: `document.fonts.check` true for each.
- [ ] **M3.2 Text renderer** — `editor/render/text.ts`: wrap, auto-fit, outline, alignment, on a passed-in 2D context.
  - Test: unit tests for wrapping/fit maths with a mocked `measureText`; Playwright screenshot test for Latin and Devanagari samples.
- [ ] **M3.3 Layout geometry** — `editor/meme/layouts.ts`: output frame size, text boxes, bar height, zoom parameters for the 3 layouts.
  - Test: unit table tests across aspect ratios.
- [ ] **M3.4 Moment picker** — scrub and select 2–15 s with snapping; frame stepping.
  - Test: component tests for min/max enforcement.
- [ ] **M3.5 Studio shell and store** — layout switcher, text inputs, size control, export-format picker, live canvas preview over the video.
  - Test: component tests for store transitions; e2e: typing updates the preview canvas (pixel check in the text region).
- [ ] **M3.6 Overlay PNG export** — render the caption layer at output resolution to a PNG blob.
  - Test: integration: PNG has the expected dimensions and non-transparent pixels only inside the text boxes.
- [ ] **M3.7 Builder: top/bottom text → MP4**.
  - Test: unit arg array; integration: output duration = selection, frame at t=1 s has caption pixels in the expected region.
- [ ] **M3.8 Builder: caption bar → MP4**.
  - Test: unit; integration: output height = video height + bar, top rows are white.
- [ ] **M3.9 Builder: freeze-frame zoom → MP4** — incl. audio padding and focal point.
  - Test: unit; integration: duration = freeze time + hold; last frame differs from freeze frame in scale (centre-crop similarity check); audio length matches video.
- [ ] **M3.10 Freeze-zoom controls** — pick the freeze frame, focal point, hold length; preview animation in canvas.
  - Test: component tests; e2e happy path.
- [ ] **M3.11 GIF export** — palette pipeline for all layouts.
  - Test: integration: `image/gif`, width ≤ 480, loops, frame count ≈ duration × 12.
- [ ] **M3.12 WhatsApp sticker export** — 512×512 transparent pad, quality/fps retry ladder, > 6 s guard.
  - Test: unit: ladder sequence with a fake runner; integration: output is animated WebP, 512×512, ≤ 500 KB, has alpha.
- [ ] **M3.13 Still image export** — canvas path, PNG/JPEG.
  - Test: e2e: image dimensions equal the video frame (plus bar for layout 2); caption pixels present.
- [ ] **M3.14 Preview/export parity check** — compare a preview canvas frame with the exported frame.
  - AC: text box position and height within 2% of frame height for all 3 layouts.
  - Test: integration test doing the comparison for Latin and Devanagari.
- [ ] **M3.15 Wire into registry** — slugs 10–13 with export presets; limits applied (output capped per class).
  - Test: e2e smoke for the four URLs; privacy guard on.
- [ ] **M3.16 Sticker check on a real phone** — send an exported sticker in WhatsApp on Android and iOS; record what happens. _Manual; ask the owner._
  - AC: result written into PRD §4.2 (and copy adjusted if WhatsApp treats it as an image).

## M4 — Auto captions

- [ ] **M4.1 Caption model and store** — `Word`, `Cue`, `CaptionDoc`; Zustand store with undo/redo.
  - Test: unit: every mutation and undo/redo round trips.
- [ ] **M4.2 Line splitter** — per ARCHITECTURE §10 step 5.
  - Test: unit table tests: punctuation, long gaps, char limits for both aspects, min/max duration, Devanagari input.
- [ ] **M4.3 SRT and VTT** — serialise and parse.
  - Test: unit: golden files; round trip equals input; timestamps formatted correctly past 1 hour.
- [ ] **M4.4 Devanagari → Roman transliteration** — rules, schwa deletion, exception list.
  - Test: unit table of ≥ 150 common words and 20 sentences with expected output.
- [ ] **M4.5 Script toggle logic** — derived Roman text, manual overrides preserved both ways.
  - Test: unit: edit in Roman → toggle → toggle back keeps both edits.
- [ ] **M4.6 PCM extraction job** — `extractPcm` in 10-minute windows, joined to `Float32Array`; duration limit check.
  - Test: integration: fixture → sample count = duration × 16000 ± 1%; over-limit rejects.
- [ ] **M4.7 Speech fixtures and ground truth** — CC0 English and Hindi clips (~8 s each) plus one with a 10 s silent gap; word-level reference JSON.
  - Test: unit: fixtures and references load and validate.
- [ ] **M4.8 Mirror models to R2** — Silero VAD, Whisper tiny (tests), base, small; add to manifest; confirm repo names and dtypes. _Uploads to the owner's R2: ask first._
  - Test: manifest test lists all files; a HEAD request succeeds for each.
- [ ] **M4.9 AI worker skeleton** — module worker, Comlink API, progress and abort plumbing, terminate.
  - Test: integration: ping/abort round trip; worker terminates cleanly.
- [ ] **M4.10 VAD** — Silero via `onnxruntime-web`; segment post-processing as pure functions.
  - Test: unit: merge/pad/drop rules on synthetic probabilities. `@slow` integration: silent-gap fixture yields no segment in the gap.
- [ ] **M4.11 Chunk packer** — speech segments → windows ≤ 28 s; offset mapping.
  - Test: unit: never splits inside a segment unless it exceeds 28 s; offsets map back exactly.
- [ ] **M4.12 Whisper transcription** — transformers.js config for R2, backend/dtype selection, word timestamps, per-window progress.
  - Test: unit: backend selection for capability combinations. `@slow` integration with tiny: English fixture WER ≤ 30%, word times within ±0.5 s.
- [ ] **M4.13 Tier selection and download UX** — Base default, Small offered per the rule in ARCHITECTURE §8, sizes shown.
  - Test: unit: offer rule; e2e with mocked capabilities shows/hides the option.
- [ ] **M4.14 Fake AI engine** — returns recorded words with simulated progress, selectable in tests.
  - Test: used by all following UI specs.
- [ ] **M4.15 Captions flow** — file → language → extract → transcribe → split, with engine hand-off (never both loaded).
  - Test: e2e (fake AI): reaches the edit screen with expected cues; unit: orchestrator terminates ffmpeg before starting AI.
- [ ] **M4.16 Edit screen: list and sync** — cue list, active cue follows playback, click to seek, text editing.
  - Test: component tests; e2e: editing text updates the preview overlay.
- [ ] **M4.17 Edit screen: timing and structure** — nudge start/end, split, merge, add, delete, undo/redo shortcuts.
  - Test: component tests per operation, incl. overlap prevention.
- [ ] **M4.18 Caption renderer and styles** — `CaptionStyle` data for Classic, Box, Highlight; canvas renderer used by the preview.
  - Test: unit: active-word lookup; screenshot tests per style, Latin and Devanagari.
- [ ] **M4.19 ASS emitter** — `CaptionDoc` + style → ASS, incl. per-word events for Highlight.
  - Test: unit: golden ASS files for each style; escaping of braces and newlines.
- [ ] **M4.20 Burn-in job (ffmpeg path)** — fonts into MEMFS, `subtitles` filter, builder.
  - Test: unit args; integration: frame inside a cue has text pixels in the caption region, frame outside does not; Devanagari screenshot check.
- [ ] **M4.21 Export panel** — SRT, VTT, burned-in MP4 with style picker; script toggle applies to all exports.
  - Test: e2e (fake AI): download SRT and VTT and validate; burned MP4 has the source duration.
- [ ] **M4.22 Wire into registry** — slugs 14–17 with language/script/export presets.
  - Test: e2e smoke for the four URLs.
- [ ] **M4.23 Accuracy run** — run Base (and Small on desktop WebGPU) on the fixtures; record WER and speed against PRD §4.3.
  - AC: results table added to the PR; PRD thresholds adjusted only with the owner's agreement.
  - Test: `@slow` spec asserts PRD WER thresholds for Base.

## M5 — Shorts crop, WebCodecs fast path, hardening

- [ ] **M5.1 Crop maths and platform presets** — crop rect from pan position, even values, rotation aware; `presets.ts` with safe zones and duration warnings (verify against platform docs).
  - Test: unit table tests for landscape, square and portrait sources.
- [ ] **M5.2 Crop UI** — draggable 9:16 window, safe-zone overlay, preset switcher.
  - Test: component tests for drag clamping; e2e drag updates the rect.
- [ ] **M5.3 Crop job and registry** — builder, slugs 18–20.
  - Test: unit args; e2e: output is exactly 1080×1920 with audio.
- [ ] **M5.4 WebCodecs capability probe** — `isConfigSupported` for H.264 encode at target sizes, audio encode presence, Mediabunny input support.
  - Test: unit with mocked WebCodecs for supported/unsupported/partial cases.
- [ ] **M5.5 WebCodecs transcode pipeline** — Mediabunny decode → optional scale/crop → encode → MP4 mux; progress and abort.
  - Test: integration (Chromium): fixture transcodes; output H.264, right dimensions and duration.
- [ ] **M5.6 Audio handling without `AudioEncoder`** — copy AAC when possible, else encode audio with ffmpeg and mux.
  - Test: unit: decision function; integration with `AudioEncoder` stubbed out.
- [ ] **M5.7 Planner integration** — compress, compress-to-size, convert (re-encode) and crop prefer `webcodecs`; automatic fallback to ffmpeg on any pipeline error.
  - Test: unit: planner choices; integration: forced pipeline error falls back and still succeeds; existing tool e2e specs pass on both paths.
- [ ] **M5.8 Canvas compositing stage** — per-frame draw hook on `OffscreenCanvas`.
  - Test: integration: a hook drawing a red box appears in an output frame.
- [ ] **M5.9 Burn captions via WebCodecs** — use `editor/render` in the hook; fallback to the ASS path.
  - Test: integration: preview frame vs exported frame match within tolerance for all 3 styles.
- [ ] **M5.10 Memory hygiene** — terminate ffmpeg after re-encodes on class L and iOS; revoke object URLs; release previous results.
  - Test: unit: lifecycle policy per class; e2e: five jobs in a row on the iPhone project succeed.
- [ ] **M5.11 Share and save UX** — Share button via `navigator.share({ files })`, iOS "Save to Photos" hint.
  - Test: component test with mocked `canShare`.
- [ ] **M5.12 Accessibility pass** — axe on every tool page, keyboard walk-through of each tool.
  - Test: `@axe-core/playwright` spec with zero serious violations.
- [ ] **M5.13 Performance budget** — bundle analysis, lazy-load engines and editors, enforce ≤ 200 KB gzip initial JS per tool route.
  - Test: script that fails the build when a route exceeds the budget.
- [ ] **M5.14 Real-device calibration** — run the checklist below on one low-end Android (≤ 3 GB), one mid Android, one iPhone, one desktop; update `limits.ts` and ARCHITECTURE §8. _Manual; needs the owner's devices._
  - Checklist: each core tool on a 100 MB file · compress a 3-minute 1080p clip · meme MP4/GIF/sticker · 2-minute Hindi captions + burn-in · crop · cancel mid-job · five jobs in a row without reload.
  - AC: results table committed; every _(calibrate)_ marker removed.

## M6 — SEO and launch

- [ ] **M6.1 `ToolPage` template** — H1, intro, tool slot, how-to, FAQ, related tools, breadcrumbs.
  - Test: component test renders all sections from a content object.
- [ ] **M6.2 Metadata** — `generateMetadata`: title, description, canonical, Open Graph, Twitter card; default OG image.
  - Test: unit: every registry entry yields title ≤ 60 and description ≤ 155 chars and a canonical URL.
- [ ] **M6.3 JSON-LD builders** — `SoftwareApplication`, `HowTo`, `FAQPage`, `BreadcrumbList`.
  - Test: unit: output validated against JSON schemas for each type.
- [ ] **M6.4 Content: core tool pages (slugs 1–9)**.
  - Test: content lint (M6.8) passes.
- [ ] **M6.5 Content: meme pages (10–13)**.
  - Test: content lint passes.
- [ ] **M6.6 Content: caption pages (14–17)**.
  - Test: content lint passes.
- [ ] **M6.7 Content: shorts pages (18–20)**.
  - Test: content lint passes.
- [ ] **M6.8 Content lint** — unit test over all content: required fields, 3–5 how-to steps, 4–6 FAQs, unique titles/descriptions/H1s, pairwise body similarity ≤ 40%, no mention of downloading from platforms.
  - Test: the test itself, plus a failing fixture.
- [ ] **M6.9 Home page** — value proposition, tool grid grouped by job, privacy statement.
  - Test: e2e: all 20 tools linked with plain anchors.
- [ ] **M6.10 `sitemap.xml` and `robots.txt`**.
  - Test: e2e: sitemap lists home, 20 tool URLs, privacy, about with absolute URLs; robots references the sitemap.
- [ ] **M6.11 Privacy and About pages** — what stays on device, every analytics field, open-source licence, ffmpeg and model credits with source links.
  - Test: unit: the analytics field list on the page is generated from the event schema.
- [ ] **M6.12 Event endpoint** — `functions/api/e.ts` with Analytics Engine binding, schema validation, no cookies. _Creates a Cloudflare dataset: ask first._
  - Test: unit tests of the handler: valid event accepted, unknown fields dropped, oversize body rejected.
- [ ] **M6.13 Client events** — `tool_run`, `engine_load`, `weekly_active`; local `returning` flag; `sendBeacon`.
  - Test: unit: returning logic across ISO weeks; e2e: one successful run sends exactly one `tool_run`; blocked endpoint does not break the tool.
- [ ] **M6.14 Favicon, manifest basics, 404 page**.
  - Test: e2e: unknown URL shows the 404 page with a link home.
- [ ] **M6.15 Lighthouse gate** — CI run on home and three tool pages.
  - AC: SEO ≥ 95, Accessibility ≥ 95, Performance ≥ 85 (mobile).
  - Test: Lighthouse CI assertion.
- [ ] **M6.16 Production launch** — custom domain (buy and attach to the Pages project; redirect `*.pages.dev` to it; update `NEXT_PUBLIC_SITE_URL`), production env vars, R2 assets uploaded for the release versions, Search Console sitemap submission. _Outward-facing: owner confirms each step._
  - AC: production passes the header spec, privacy guard and one e2e per tool group.
  - Test: `pnpm e2e --grep @smoke` against the production URL.
- [ ] **M6.17 Post-launch check (day 7)** — review error rate by tool and device class, top failing paths, Web Vitals; file follow-up tasks here.
  - AC: a short findings list appended below.
