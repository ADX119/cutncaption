# cutncaption — Architecture

Static Next.js site on Cloudflare Workers static assets (what Cloudflare Pages has become; new projects deploy this way). All media and AI work runs in the browser. The only server code in Phase 1 is one small Worker in `worker/` that handles two paths: `/assets/*` streams large binaries from R2, and `/api/e` (M6.12) counts events.

The site URL comes from `NEXT_PUBLIC_SITE_URL` (a `*.workers.dev` address until a domain is bought; switching is one env var plus redirects). Large binaries are served same-origin at `NEXT_PUBLIC_ASSET_BASE_URL` (`/assets`). Numbers marked _(calibrate)_ are starting values to be confirmed on real devices in M5.

## 1. Stack

| Layer            | Choice                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js App Router, `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`                                           |
| Language / style | TypeScript `strict`, Tailwind, Radix primitives for sliders/dialogs/tabs                                                            |
| State            | Zustand (one store per feature; undo history in the captions store)                                                                 |
| Media            | `@ffmpeg/ffmpeg` 0.12.x with `@ffmpeg/core` (single-thread) and `@ffmpeg/core-mt` (multi-thread); Mediabunny for the WebCodecs path |
| AI               | `@huggingface/transformers` v3 (Whisper), `onnxruntime-web` (Silero VAD)                                                            |
| Worker RPC       | Comlink                                                                                                                             |
| Tests            | Vitest (unit), Playwright (e2e against `wrangler dev`)                                                                              |
| Hosting          | Cloudflare Workers static assets (site), R2 behind the Worker (large binaries), Worker + Analytics Engine (events)                  |
| Package manager  | pnpm; scripts are Node `.mjs` (must run on Windows, macOS and Linux)                                                                |

All dependencies must be GPL-3.0-compatible.

## 2. Folder structure

```
src/
  app/                      routes only; thin composition
    layout.tsx  page.tsx    home
    tools/[slug]/page.tsx   20 tool pages (generateStaticParams from seo registry)
    privacy/  about/
    sitemap.ts  robots.ts   force-static metadata routes
  features/                 React UI + Zustand store per product area
    core-tools/             trim, compress, compress-to-size, convert, mp3, mute
    meme-studio/
    captions/
    shorts-crop/
    shell/                  cross-tool UI that needs the engine: BrowserGate and its notices
  components/               shared UI: FileDrop, VideoPreview, Timeline, JobProgress, ResultCard
  engine/                   no React. The only code that touches wasm, workers, models
    media/
      commands/             pure arg builders, one file per job kind
      ffmpeg/               loader, runner, virtual FS, log/progress parser
      webcodecs/            Mediabunny transcode pipeline
      planner.ts            picks the path for a job
      index.ts              public MediaEngine API
    ai/
      ai.worker.ts          VAD + Whisper, exposed via Comlink
      models.ts             model registry (ids, dtypes, sizes)
      index.ts              public AiEngine API
    assets/                 fetch-with-cache, manifest, integrity
    device/                 capability detection, device class, limits
  editor/                   pure domain logic. No React, no engine imports
    captions/               model, line splitter, SRT/VTT, transliteration, ASS emitter
    meme/                   layout geometry for the 3 layouts
    crop/                   crop-rect maths, platform presets
    render/                 canvas text/caption renderer (takes a 2D context)
  seo/                      tool registry, page template, JSON-LD builders, content/en/*
  i18n/                     messages/en.ts, t()
  lib/                      small shared utilities
worker/index.ts             Worker entry: routes /assets/* (and /api/* from M6.12)
worker/assets.ts            streams R2 objects (GET/HEAD, Range)
wrangler.jsonc              deploy config: static assets dir, run_worker_first, R2 binding
public/
  _headers                  COOP/COEP, CSP, cache rules
  fonts/                    Anton, Noto Sans, Noto Sans Devanagari (OFL)
  vendor/ffmpeg/<ver>/      small ffmpeg JS glue files (copied by script)
scripts/                    vendor-copy.mjs, upload-assets.mjs, gen-fixtures.mjs
tests/  e2e/  fixtures/
docs/
```

## 3. Module boundaries

Enforced by ESLint (`eslint-plugin-boundaries`); a violation fails lint.

| Module        | May import                                                     | Must not                                                             |
| ------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `app/`        | features, seo, components, i18n, lib                           | contain logic, import engine                                         |
| `features/`   | engine (public `index.ts` only), editor, components, i18n, lib | build ffmpeg args, touch wasm/model libraries                        |
| `components/` | i18n, lib                                                      | import features or engine                                            |
| `engine/`     | editor (types and pure functions), lib                         | import React, features, seo                                          |
| `editor/`     | lib                                                            | import React, engine, DOM APIs other than a passed-in canvas context |
| `seo/`        | features (to mount a tool), components, i18n, lib              | import engine                                                        |

Only `engine/` may import `@ffmpeg/*`, `@huggingface/transformers`, `onnxruntime-web`, `mediabunny`.

### Public APIs

```ts
// engine/media
// createMediaEngine() in engine/media/engine.ts. One job at a time: a second call while
// one runs rejects with EngineError 'busy'. Holds at most one ffmpeg instance.
interface MediaEngine {
  probe(file: File, o?: { signal }): Promise<MediaInfo>;   // duration, streams, codecs, display size, rotation
  assess(job: MediaJob): { path: EnginePath; blocks: LimitIssue[]; warnings: LimitIssue[] };  // before running
  run(job: MediaJob, o?: { signal; onProgress(fraction: number) }): Promise<JobResult>;     // rejects over hard limits
  release(): void;                                          // frees the ffmpeg instance
}
// Each job is planned by planJob() (engine/media/plan.ts): copy vs re-encode, output
// name, limit footprint, and the ffmpeg arguments.
type MediaJob =                             // discriminated union, one per commands/*.ts
  | { kind: 'trim'; file: File; start: number; end: number; mode: 'fast' | 'precise' }
  | { kind: 'compress'; ... } | { kind: 'compressToSize'; ... } | { kind: 'toMp4'; ... }
  | { kind: 'toMp3'; ... } | { kind: 'mute'; ... } | { kind: 'crop'; ... }
  | { kind: 'meme'; ... } | { kind: 'burnCaptions'; ... } | { kind: 'extractPcm'; ... };
type JobResult = { blob: Blob; filename: string; mime: string; path: EnginePath; ms: number };
type EnginePath = 'copy' | 'webcodecs' | 'ffmpeg-mt' | 'ffmpeg-st' | 'canvas';

// engine/ai
interface AiEngine {
  transcribe(pcm16k: Float32Array, o: { lang: 'en' | 'hi'; tier: 'base' | 'small';
    signal: AbortSignal; onProgress(p: Progress): void }): Promise<Word[]>;
}

// editor/captions
type Word = { text: string; start: number; end: number };
type Cue  = { id: string; start: number; end: number; words: Word[]; text: string; roman?: string };
type CaptionDoc = { lang: 'en' | 'hi'; script: 'native' | 'roman'; style: 'classic' | 'box' | 'highlight'; cues: Cue[] };
```

Errors cross the engine boundary as `EngineError { code, userMessageKey, detail }`; features never parse ffmpeg logs.

## 4. Routing and headers

All interactive tools live under `/tools/*`, so one header rule isolates them. Home, privacy, about and future account/checkout pages are **not** isolated (COEP would break Phase 2 payment and auth embeds).

`public/_headers`:

```
/tools/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

/_next/static/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
  Cache-Control: public, max-age=31536000, immutable

/vendor/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
  Cache-Control: public, max-age=31536000, immutable

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; worker-src 'self' blob:; connect-src 'self' blob: https://cloudflareinsights.com; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Rules that follow from this:

- **Worker scripts need COEP too.** A dedicated worker started from an isolated page is blocked unless its script response carries COEP; hence the `/_next/static/*` and `/vendor/*` rules.
- **Hard navigation across the boundary.** Client-side navigation does not re-fetch the document, so the headers would not apply. Any link from a non-isolated page to `/tools/*` (and back) is a plain `<a>`, never `next/link`. Links between tool pages may use `next/link`.
- **Runtime check, not assumption.** The engine reads `self.crossOriginIsolated`; if false it uses the single-thread core.
- **Large binaries are same-origin.** `worker/assets.ts` has an R2 binding and streams the object for `GET /assets/<key>` with `Cache-Control: public, max-age=31536000, immutable`, `Cross-Origin-Resource-Policy: same-origin`, `ETag` and `Content-Length`, and answers `Range` requests with 206. `_headers` rules do not apply to responses a Worker generates, so it sets its own isolation and caching headers. The bucket is private. No CORS setup and no custom domain are needed.
- **Analytics beacon** is Cloudflare's own snippet, a `type="module"` script with `crossorigin="anonymous"`. It loads and reports correctly on the isolated tool routes (`tests/e2e/analytics-live.spec.ts`, which runs only against a deployed site). It is rendered only when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set, and only `scripts/deploy.mjs` sets it, so dev, test and CI builds contain no analytics. After a deploy, `out/` holds that production build; `pnpm e2e` rebuilds before testing, so always use it rather than calling Playwright directly.
- **Dev**: `next.config.ts` sets the same COOP/COEP headers only when `NODE_ENV === 'development'`. E2E runs against `wrangler dev`, which honours `_headers`.
- **Deploy**: `pnpm deploy:cf` runs `scripts/deploy.mjs` (production build with the analytics token, then `wrangler deploy`). Cloudflare serves `out/` directly; the Worker runs only for paths listed in `assets.run_worker_first` in `wrangler.jsonc`. A brand-new deployment can return 404s for its first minute.

## 5. Multi-thread vs single-thread ffmpeg

Decision: ship both cores; choose at runtime per job.

```
use core-mt  if  crossOriginIsolated
             and SharedArrayBuffer exists
             and device class is H, or M on Android/desktop
             and not iOS/iPadOS
             and job re-encodes video
else core-st
```

- Stream-copy jobs (fast trim, mute, remux) always use `core-st`: threads do not help and it starts faster.
- iOS always uses `core-st`: shared-memory wasm is the main cause of tab kills there. iOS gets its speed from the WebCodecs path.
- Thread count: `min(hardwareConcurrency, 4)`, **always stated explicitly**. `runFfmpeg` adds `-threads N` before every input and the output, plus `-filter_threads`/`-filter_complex_threads` (`limitThreads` in `engine/media/ffmpeg/variant.ts`). Without it x264 asks for about 1.5 threads per CPU core, more than the core's fixed worker pool on many-core PCs, and the run deadlocks silently (found in M1.10 on a 20-core PC). Command builders never set threads.
- Measured in M1.10 (60 s 320×180 x264 encode, 20-core PC): single-thread 11.7 s, multi-thread 4.1 s in Chromium; 12.5 s vs 4.9 s in WebKit.
- **Watchdog**: `core-mt` is known to stall on some filter graphs. If no log or progress arrives for 20 s, the runner terminates it, reruns the job on `core-st`, and sets a session flag so later jobs skip `core-mt`. The fallback is recorded in the `tool_run` event.
- `onnxruntime-web` also uses threads when isolated (`numThreads = min(cores, 4)`); otherwise 1.

## 6. Loading and caching workers, wasm and models

| Asset                                                           | Size (approx.) | Served from                             | Cached by      |
| --------------------------------------------------------------- | -------------- | --------------------------------------- | -------------- |
| App JS/CSS, our workers                                         | —              | Static `/_next/static`                  | HTTP immutable |
| ffmpeg JS glue (`ffmpeg-core.js`, pthread worker, class worker) | < 300 KB       | Static `/vendor/ffmpeg/<ver>/`          | HTTP immutable |
| `ffmpeg-core.wasm` (st), `ffmpeg-core.wasm` (mt)                | ~32 MB each    | R2 `/ffmpeg/<ver>/{st,mt}/`             | Cache Storage  |
| ONNX Runtime wasm                                               | ~10–25 MB      | R2 `/ort/<ver>/`                        | Cache Storage  |
| Silero VAD                                                      | ~2 MB          | R2 `/models/silero-vad/<ver>/`          | Cache Storage  |
| Whisper base (timestamped)                                      | ~80 MB         | R2 `/models/whisper-base_timestamped/`  | Cache Storage  |
| Whisper small (timestamped)                                     | ~250 MB        | R2 `/models/whisper-small_timestamped/` | Cache Storage  |
| Fonts                                                           | < 1 MB each    | Static `/fonts/`                        | HTTP immutable |

Why the split: Cloudflare static assets reject files over 25 MiB, and `new Worker()` needs a same-origin script. So small scripts stay in the static export and only large binaries go to R2, reached through `/assets/*` on the same origin. "R2 `/x/`" in the table means the R2 key, fetched as `/assets/x/`.

**Asset loader** (`engine/assets`):

- `scripts/upload-assets.mjs` uploads versioned files to R2 and writes `src/engine/assets/manifest.json` (`path → { bytes, sha256 }`). Paths contain the version; objects are immutable (`Cache-Control: immutable`).
- `fetchAsset(path, { onProgress, signal })`: look up Cache Storage `cnc-assets-v1`; on miss, stream from R2 with byte progress, verify length and SHA-256, store, return a `Blob`.
- **Stalled downloads resume.** If no bytes arrive for 20 s, the attempt is dropped and the rest is requested with `Range: bytes=N-` (the `/assets` Worker answers 206); a server that answers 200 instead restarts from zero. Three attempts, then `asset-download-failed` with Try again. Found in M1.14: a download stalled at 28 of 31 MB under load and the page waited forever.
- **Getting ready.** `engine.needsDownload()` says whether the engine is cached; `engine.prepare()` loads the core this device re-encodes with (multi-thread where allowed, so the first job needs no second download; a loaded multi-thread core also does single-thread work). Tool pages (`features/shell/FileIntake.tsx`) pre-warm on idle only when cached; otherwise nothing is downloaded until a file is chosen, and then `EngineDownload` shows the size and progress.
- On `QuotaExceededError`, continue without caching and warn once. Call `navigator.storage.persist()` after the first successful job. Old-version entries are deleted on load.
- Safari may evict script-written storage after 7 days without a visit; the UI must always handle a re-download.
- No service worker in Phase 1 (added with PWA/Share Target later).

**ffmpeg** (`engine/media/ffmpeg/loader.ts`): the `@ffmpeg/ffmpeg` wrapper is **not bundled**. It is copied to `/vendor/ffmpeg/<ver>/class/` and loaded at runtime with a native `import()` (Turbopack cannot process how it starts its worker; the npm package is a dev dependency used for types). The wrapper always starts a module worker, so the ESM cores are used: `load({ coreURL, workerURL })` from `/vendor`, `wasmURL` = blob URL from `fetchAsset`, which is why the CSP allows `blob:` in `connect-src`. `/tools/engine-check/` is an unlisted, noindex diagnostics page that loads the engine and runs `-version`; e2e uses it locally and against the live site. `@ffmpeg/ffmpeg` runs ffmpeg in its own worker, so the main thread never blocks. One instance, one job at a time. Loading starts when a file is chosen (and is pre-warmed on idle if already cached).

**Input files** are mounted read-only with `WORKERFS`, never copied into wasm memory. `withWorkspace` (`engine/media/ffmpeg/workspace.ts`) gives each job `/job<N>/in/` for inputs (renamed to `input0.<ext>` so file names can never be read as options or protocols) and `/job<N>/` for outputs and helper files, and removes all of it in `finally`.

**Engine tests in the browser.** The Engine check page attaches `window.__cncEngine` (`engine/media/harness.ts`): methods that run the real engine on files the test passes in. Playwright drives them through `tests/e2e/support/engine.ts`, locally and against the live site. The hooks only process data the caller supplies and send nothing anywhere. Outputs are written to `MEMFS`, read out as a `Blob`, then deleted and the mount removed. After any re-encode on class L or iOS the instance is terminated to return memory (wasm memory never shrinks).

**AI worker** (`engine/ai/ai.worker.ts`): module worker created with `new Worker(new URL(...), { type: 'module' })`, wrapped by Comlink. transformers.js is configured with `env.allowLocalModels = false`, `env.remoteHost = ASSET_BASE`, a matching `remotePathTemplate`, and `env.backends.onnx.wasm.wasmPaths` on R2. The worker is terminated after transcription.

**Never hold both engines.** Captions flow: ffmpeg extracts PCM → ffmpeg terminated → AI worker transcribes → AI worker terminated → ffmpeg/WebCodecs burns in.

## 7. Job paths and ffmpeg commands

The planner picks, in order: `copy` (no re-encode needed) → `webcodecs` (if supported for this input and job, M5) → `ffmpeg-mt` → `ffmpeg-st`.

All arguments are built by pure functions in `engine/media/commands/` that return `string[]`. Every `{value}` is computed in TypeScript from `MediaInfo` (even dimensions, clamped ranges); ffmpeg expressions are not used for sizing. `IN` = WORKERFS path, common output flags:

```
X264 = -c:v libx264 -preset {veryfast|superfast} -pix_fmt yuv420p -fpsmax 30
AAC  = -c:a aac -b:a {k}k -ac 2
MP4  = -movflags +faststart
```

`superfast` on class L, `veryfast` otherwise.

| Tool               | Command                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Probe              | ffprobe `-v error -print_format json -show_format -show_streams IN`; the report is read from stdout (this build ignores `-o` and returns -1 even on success, so success means a valid report came back). Parsed by `engine/media/probe/parse.ts` |
| Trim, fast         | `-ss {start} -i IN -t {dur} -c copy -avoid_negative_ts make_zero MP4 out.{srcExt}`                                                                                                                                                               |
| Trim, precise      | `-ss {start} -i IN -t {dur} X264 -crf 20 AAC(128) MP4 out.mp4`                                                                                                                                                                                   |
| Compress           | `-i IN -vf scale={w}:{h} X264 -crf {23/28/32} AAC({128/96/64}) MP4 out.mp4` — caps 1080/720/480 on the short side                                                                                                                                |
| Compress to size   | `-i IN -vf scale={w}:{h} X264 -b:v {v}k -maxrate {v}k -bufsize {2v}k AAC({a}) MP4 out.mp4`                                                                                                                                                       |
| Convert, remux     | `-i IN -c copy MP4 out.mp4` (when video is H.264 and audio is AAC or absent)                                                                                                                                                                     |
| Convert, re-encode | `-i IN X264 -crf 22 AAC(128) MP4 out.mp4`                                                                                                                                                                                                        |
| Video to MP3       | `-i IN -vn -c:a libmp3lame -b:a {128/192/320}k out.mp3`                                                                                                                                                                                          |
| Mute               | `-i IN -c:v copy -an MP4 out.{srcExt}`                                                                                                                                                                                                           |
| 9:16 crop          | `-i IN -vf crop={cw}:{ch}:{x}:{y},scale=1080:1920 X264 -crf 21 AAC(128) MP4 out.mp4`                                                                                                                                                             |
| PCM for Whisper    | `-ss {s} -t {≤600} -i IN -vn -ac 1 -ar 16000 -f f32le out.pcm` (in 10-minute windows)                                                                                                                                                            |

**Compress-to-size maths** (`commands/bitrate.ts`): `total = targetBytes × 8 × 0.96 / duration`; audio 96k (64k if total < 400k); `v = total − audio`; refuse if `v < 150k`. Height ladder by `v`: ≥2500k→1080, ≥1200k→720, ≥600k→480, ≥300k→360, else 240. Single pass; if the output exceeds the target, rerun once with `v × (target/actual) × 0.93`.

**Meme Studio.** Text is never drawn by ffmpeg. `editor/render` draws the caption onto a canvas (the browser shapes Devanagari and applies fonts), exported as a transparent PNG the size of the output frame and written to MEMFS as `ov.png`. The same renderer draws the preview, which is what makes it WYSIWYG. All start with `-ss {start} -t {dur} -i IN -i ov.png`.

| Layout / export    | filter_complex and output                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top/bottom text    | `[0:v]scale={w}:{h}[v];[v][1:v]overlay=0:0[out]`                                                                                                                                                                                                                                                                                                                                                        |
| Caption bar        | `[0:v]scale={w}:{h},pad={w}:{h+bar}:0:{bar}:white[v];[v][1:v]overlay=0:0[out]`                                                                                                                                                                                                                                                                                                                          |
| Freeze-frame zoom  | `[0:v]scale={w}:{h},split[a0][b0];[a0]trim=0:{f},setpts=PTS-STARTPTS[a];[b0]trim=start={f}:end={f+1/fps},setpts=PTS-STARTPTS,zoompan=z='min(1+{rate}*on,{zmax})':x='{fx}*(iw-iw/zoom)':y='{fy}*(ih-ih/zoom)':d={hold*fps}:s={w}x{h}:fps={fps}[b];[a][b]concat=n=2:v=1:a=0[v];[v][1:v]overlay=0:0:enable='gte(t,{f})'[out]` with audio `[0:a]atrim=0:{f},asetpts=PTS-STARTPTS,apad=pad_dur={hold}[aout]` |
| → MP4              | `-map [out] -map {0:a or [aout]}? X264 -crf 20 AAC(128) MP4 out.mp4`                                                                                                                                                                                                                                                                                                                                    |
| → GIF              | append `,fps=12,scale=480:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4` → `-loop 0 out.gif`                                                                                                                                                                                                                                             |
| → WhatsApp sticker | append `,fps={12},scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000` → `-an -c:v libwebp -q:v {q} -loop 0 out.webp`; retry ladder q 60→45→30, then fps 12→10→8, until ≤ 500 KB                                                                                                                                                            |
| → Still image      | no ffmpeg: draw the `<video>` frame and caption to a canvas, `toBlob` PNG/JPEG (`canvas` path)                                                                                                                                                                                                                                                                                                          |

**Burned-in captions.** Two renderers behind one `burnCaptions` job, both driven by the same `CaptionStyle` data:

- `webcodecs` (preferred, M5): decode → draw frame + `editor/render` caption on an `OffscreenCanvas` → encode → mux. Identical to the preview.
- ffmpeg fallback: `editor/captions/ass.ts` emits an ASS file; fonts are written to `/fonts` in MEMFS.
  `-i IN -vf subtitles=subs.ass:fontsdir=/fonts X264 -crf 21 -c:a copy MP4 out.mp4`
  Classic = outline style; Box = `BorderStyle=3`; Highlight = one event per word with a colour override on the active word. libass shapes Devanagari via HarfBuzz. Colour emoji are not supported on this path.

**Capability check.** `src/engine/media/ffmpeg/capabilities.ts` lists every encoder, decoder, filter, muxer and demuxer the commands above use (plus the input decoders people will bring, including HEVC from iPhones). The Engine check page runs `-encoders`, `-decoders`, `-filters`, `-muxers` and `-demuxers` on the shipped core and reports anything missing; e2e asserts the list is complete. In a `{a/b/c}` placeholder the slashes separate alternatives. **When a command here gains a codec, filter or format, add it to that list in the same change.**

**Progress** is computed from `time=` in ffmpeg logs against the expected output duration (the built-in progress event is unreliable with filter graphs). **Cancel** terminates the instance; the next job reloads it from cache.

## 8. Device classes and limits

`engine/device` classifies once per session using feature detection (`navigator.deviceMemory`, `hardwareConcurrency`, pointer/screen, platform). UA is used only to identify iOS and in-app browsers.

| Class      | Rule                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| **L** low  | Android/mobile with `deviceMemory ≤ 3` or ≤ 4 cores                                        |
| **M** mid  | other phones and tablets, including all iPhone/iPad; desktops reporting `deviceMemory ≤ 3` |
| **H** high | desktop/laptop, or `deviceMemory ≥ 8`                                                      |

Limits _(calibrate)_, defined in one file, `engine/device/limits.ts`:

| Limit                                 | L       | M                               | H                               | Kind  |
| ------------------------------------- | ------- | ------------------------------- | ------------------------------- | ----- |
| Max input file                        | 500 MB  | 1 GB                            | 2 GB                            | hard  |
| Max estimated output (held in memory) | 150 MB  | 300 MB                          | 1 GB                            | hard  |
| Max re-encode duration                | 3 min   | 10 min                          | 30 min                          | warn  |
| Max encode resolution (short side)    | 720     | 1080                            | 1080                            | clamp |
| ffmpeg core                           | st      | mt (Android) / st (iOS)         | mt                              | —     |
| Whisper tiers offered                 | base    | base                            | base, small (needs WebGPU)      | —     |
| Whisper backend                       | WASM q8 | WebGPU if present, else WASM q8 | WebGPU if present, else WASM q8 | —     |
| Max caption audio                     | 10 min  | 30 min                          | 60 min                          | hard  |

Notes:

- Stream-copy jobs are bounded by the output limit, not the input: trimming 30 s out of a 2 GB file is fine.
- Whisper Small is offered only when a WebGPU adapter is obtained, the class is H, and the platform is not iOS.
- `hard` blocks with a reason and a suggestion; `warn` lets the user continue; `clamp` is applied silently and shown in the summary.

## 9. Browser support

Capabilities are always feature-detected; this matrix is the expectation tests are written against.

| Browser                                             | Supported            | ffmpeg                                        | WebCodecs path                                         | Whisper                                   | Notes                                                                                                        |
| --------------------------------------------------- | -------------------- | --------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Chrome / Edge desktop 113+                          | Full                 | mt                                            | yes                                                    | WebGPU                                    | Reference platform                                                                                           |
| Chrome Android 121+, mid/high                       | Full                 | mt                                            | yes                                                    | WebGPU where an adapter exists, else WASM |                                                                                                              |
| Chrome Android, low-end (≤ 3 GB)                    | Full, reduced limits | st                                            | yes, if hardware encoder present                       | WASM base                                 | Class L limits                                                                                               |
| Samsung Internet (current)                          | Full                 | as Chrome Android                             | yes                                                    | as Chrome Android                         |                                                                                                              |
| Safari macOS 16.4+                                  | Full                 | mt (thread-capped); watchdog falls back to st | video yes; audio encode only on 26+ → audio via ffmpeg | WASM; WebGPU on 26+                       |                                                                                                              |
| iOS / iPadOS Safari 16.4+                           | Full, reduced limits | st only                                       | as Safari macOS                                        | WASM base; WebGPU base on 26+             | All iOS browsers are WebKit. Tab is killed near ~1 GB; class M limits. Share sheet used for "Save to Photos" |
| Firefox desktop 130+                                | Full                 | mt                                            | yes                                                    | WASM; WebGPU where shipped                |                                                                                                              |
| Firefox Android                                     | Best effort          | st                                            | if detected                                            | WASM base                                 | Not in CI                                                                                                    |
| In-app browsers (Instagram, Facebook, TikTok)       | Blocked              | —                                             | —                                                      | —                                         | Blob downloads are unreliable → "Open in your browser" screen                                                |
| Anything without WebAssembly SIMD or module workers | Blocked              | —                                             | —                                                      | —                                         | Unsupported-browser screen                                                                                   |

Minimum bar to run anything: WebAssembly + SIMD, module workers, Cache Storage, `File`/`Blob` streaming.

## 10. AI pipeline (auto captions)

1. **Extract**: `extractPcm` job → mono 16 kHz `Float32Array`, in 10-minute windows.
2. **VAD**: Silero VAD (ONNX) over 32 ms frames → speech segments; pad 200 ms, merge gaps < 300 ms, drop segments < 250 ms.
3. **Chunk**: pack speech segments into windows ≤ 28 s (split only at silences).
4. **Transcribe**: Whisper per window, `language` fixed by the user's choice, `task: 'transcribe'`, `return_timestamps: 'word'`. Word times are offset by the window's position. Progress = speech seconds done ÷ total.
5. **Split lines** (`editor/captions/split.ts`, pure): break at sentence punctuation, at gaps > 0.6 s, and at the per-aspect character limit; max 2 lines; cue 0.7–5 s.
6. **Script toggle** (`editor/captions/translit.ts`, pure): rule-based Devanagari → casual Roman (schwa deletion plus an exception list of common words). Devanagari stays the source of truth; a manual Roman edit is stored in `cue.roman` and wins over the generated text.

Models (`engine/ai/models.ts`; confirm repo names when mirroring to R2):

| Tier  | Source repo                                | WASM dtype | WebGPU dtype             |
| ----- | ------------------------------------------ | ---------- | ------------------------ |
| base  | `onnx-community/whisper-base_timestamped`  | q8         | encoder fp32, decoder q4 |
| small | `onnx-community/whisper-small_timestamped` | —          | encoder fp32, decoder q4 |

Tests use `whisper-tiny` through an asset-base override so CI stays fast.

## 11. SEO pages

One registry, `src/seo/registry.ts`: `slug → { tool component, preset, contentKey }`. `app/tools/[slug]/page.tsx` renders `<ToolPage>` (H1, tool, how-to, FAQ, related links, JSON-LD) and `generateMetadata`. Content lives in `src/seo/content/en/<slug>.ts`. Variant pages must differ in preset _and_ copy.

| #   | Slug                            | Tool             | Preset            |
| --- | ------------------------------- | ---------------- | ----------------- |
| 1   | `trim-video`                    | Trim             | —                 |
| 2   | `compress-video`                | Compress         | Balanced          |
| 3   | `compress-video-to-size`        | Compress to size | custom            |
| 4   | `compress-video-for-whatsapp`   | Compress to size | 16 MB             |
| 5   | `compress-video-for-discord`    | Compress to size | 10 MB             |
| 6   | `convert-to-mp4`                | Convert          | —                 |
| 7   | `mov-to-mp4`                    | Convert          | accept `.mov`     |
| 8   | `video-to-mp3`                  | Video to MP3     | 192k              |
| 9   | `mute-video`                    | Mute             | —                 |
| 10  | `video-meme-maker`              | Meme Studio      | MP4               |
| 11  | `video-to-gif`                  | Meme Studio      | GIF               |
| 12  | `video-to-whatsapp-sticker`     | Meme Studio      | Sticker           |
| 13  | `video-to-image`                | Meme Studio      | Still             |
| 14  | `auto-captions`                 | Captions         | English           |
| 15  | `hindi-captions`                | Captions         | Hindi, Devanagari |
| 16  | `hinglish-captions`             | Captions         | Hindi, Roman      |
| 17  | `video-to-srt`                  | Captions         | export SRT        |
| 18  | `crop-video-for-reels`          | 9:16 crop        | Reels             |
| 19  | `crop-video-for-youtube-shorts` | 9:16 crop        | Shorts            |
| 20  | `crop-video-for-tiktok`         | 9:16 crop        | TikTok            |

Platform values (size targets, safe zones, duration warnings) live in `src/editor/crop/presets.ts` and `src/features/core-tools/sizePresets.ts`; check them against current platform documentation when implementing.

i18n: every UI string goes through `t('key')` from `src/i18n/messages/en.ts`. English is served at the root; a future locale is added as `/hi/...` with its own message and content files, with no component changes.

## 12. Analytics

- **Cloudflare Web Analytics** beacon for page views and Web Vitals.
- **Event counter**: `POST /api/e` → `worker/events.ts` → Workers Analytics Engine dataset. Validates against a fixed schema, drops anything else, stores no IP and sets no cookie.
  `{ e: 'tool_run' | 'engine_load' | 'weekly_active', tool, outcome: 'ok'|'error'|'cancel', path: EnginePath, cls: 'L'|'M'|'H', durBucket, returning: boolean, fallback?: boolean }`
- `returning` is computed locally: `localStorage` holds only the ISO week of the first and the last run. No ID is generated.
- Sent with `navigator.sendBeacon`; failures are ignored.

## 13. Cost and exposure guardrails

The owner's rule: nothing may be able to produce a bill until there is an audience. The setup is built so that the worst case is an error, never a charge.

| Service                                     | Free allowance                          | What happens at the limit                                                                                   |
| ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Static pages and files                      | Unlimited, free                         | —                                                                                                           |
| Worker (only `/assets/*`, later `/api/e`)   | 100,000 requests a day on the Free plan | Those paths return 429 until the next day; pages keep working. No charge on the Free plan                   |
| R2 storage                                  | 10 GB                                   | We store well under 1 GB. Do not upload beyond a few GB                                                     |
| R2 reads                                    | 10 million a month                      | Reads only happen through the Worker, which is capped at about 3 million a month, so this cannot be reached |
| R2 writes                                   | 1 million a month                       | Only our own uploads; a handful per release                                                                 |
| Web Analytics, GitHub Actions (public repo) | Free                                    | —                                                                                                           |

Rules that keep it that way:

- Stay on the **Workers Free plan**. The paid plan is what turns overage into charges. Never upgrade without the owner.
- The R2 bucket stays **private**: no `r2.dev` public URL and no custom domain. A public bucket could be read without the Worker's daily cap.
- No paid Cloudflare products (Images, Stream, Workers AI, D1, KV, Queues, Durable Objects, Logpush) and no other paid services.
- `preview_urls` is off, so only the main address serves the site.
- Known limits of a `workers.dev` address: plain HTTP is not redirected to HTTPS (HSTS covers returning visitors), and there is no rate limiting. Both are fixed by a custom domain (Always Use HTTPS, one free rate-limit rule).
- The CSP still needs `'unsafe-inline'` for scripts because a static Next.js export inlines its bootstrap data and cannot use nonces.

## 14. Testing strategy

| Level              | Tool                                                     | Covers                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit               | Vitest                                                   | command builders (exact arg arrays), bitrate maths, probe log parser, limits, device class, line splitter, SRT/VTT, transliteration, ASS emitter, layout geometry, crop maths, SEO registry and JSON-LD |
| Engine integration | Playwright (Chromium)                                    | real ffmpeg.wasm on fixtures ≤ 300 KB; output re-probed for codec, duration, dimensions, size                                                                                                           |
| E2E                | Playwright: Chromium, WebKit, Pixel and iPhone emulation | one happy path per tool, cancel, limit block, privacy network assertion, header checks                                                                                                                  |
| Slow               | Playwright `@slow`                                       | Whisper tiny on speech fixtures; run on demand and nightly                                                                                                                                              |
| Manual             | checklist in TASKS M5                                    | real low-end Android and real iPhone                                                                                                                                                                    |

In tests the asset base points at a local static server serving the cores from `node_modules`, so CI never depends on R2. The AI engine has a fake implementation fed by recorded word-timestamp JSON for UI tests.

## 15. Phase 2 hooks (do not build now)

- Server code goes in Cloudflare Workers. Supabase for accounts and credits, Dodo Payments for one-time passes, a TTS API for AI voice.
- Account and checkout routes live outside `/tools/*` so they are not cross-origin isolated.
- Web Share Target and offline need a service worker and manifest; `engine/assets` already owns caching, so the service worker should delegate to it.
