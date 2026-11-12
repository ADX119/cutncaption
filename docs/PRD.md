# cutncaption — Product Requirements (Phase 1 MVP)

Free, ad-free, privacy-first clip, meme and voice studio for short-form creators. Users bring a local video or audio file; all Phase 1 processing happens in the browser. No sign-up, no watermark, no ads, no uploads.

Decisions already taken (do not reopen without the owner):

| Topic                                | Decision                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Large binaries (ffmpeg wasm, models) | Own private Cloudflare R2 bucket, served same-origin at `/assets/*` by a Pages Function; no third-party CDNs |
| Domain                               | Launch on `*.pages.dev`; buy a domain before the SEO push (M6)                                               |
| Licence                              | Repo is open source, GPL-3.0-or-later; stock `@ffmpeg/core` builds                                           |
| Whisper                              | `base` everywhere; `small` offered as "Higher accuracy" only on capable devices                              |
| Languages                            | English UI and pages only; all strings via message catalogue so `/hi/` can be added later                    |

## 1. Users

| Persona                               | Device                         | Needs                                                                                |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| **Reels/Shorts creator** (primary)    | Mid-range Android, some iPhone | Cut a moment, caption it, crop to 9:16, post                                         |
| **Meme maker**                        | Android, desktop               | Turn a video moment into a captioned clip, GIF or WhatsApp sticker in under a minute |
| **Hindi / Hinglish creator**          | Low to mid Android             | Accurate Hindi captions, in Devanagari or Roman script                               |
| **Casual utility user** (SEO traffic) | Anything                       | One job: shrink a video for WhatsApp, get an MP3, convert to MP4                     |

## 2. Jobs to be done

1. "Make this video small enough to send" → compress / compress-to-size.
2. "Cut out just this part" → trim.
3. "Make this file play everywhere" → convert to MP4.
4. "Give me only the audio" / "remove the audio" → video to MP3 / mute.
5. "Turn this moment into a meme I can share now" → Meme Studio.
6. "Add captions without typing them" → auto captions, edit, burn in or export SRT/VTT.
7. "Make this landscape video fit Reels" → 9:16 crop.
8. Across all: "without uploading my file, signing up, or getting a watermark."

## 3. Global requirements (apply to every tool)

- **G1 Input**: file picker and drag-and-drop only. No URL field anywhere. Accepts MP4, MOV, WebM, MKV, AVI, MP3, WAV, M4A, AAC, OGG (tool-dependent).
- **G2 Privacy**: file bytes never leave the device. Verified by an e2e test that fails on any request other than same-origin GETs and the analytics endpoints, and by a `connect-src` CSP.
- **G3 No account, no watermark, no ads** on any output or page.
- **G4 Progress and cancel**: every job shows percentage progress within 2 s of starting and can be cancelled; cancel frees memory and returns to the ready state.
- **G5 Limits**: before running, the app checks the file against the device-class limits (ARCHITECTURE §8) and either blocks with a clear reason or warns.
- **G6 Errors**: every failure shows a human message and one suggested action (e.g. "Try a shorter clip"). No raw ffmpeg logs unless the user opens "Details".
- **G7 Output**: Download button on all platforms; a Share button where `navigator.canShare({files})` is true. Output filename is `<original-stem>-<action>.<ext>`.
- **G8 Engine load**: first-time engine download shows size and progress; it is cached, and repeat visits start a job with no engine download.
- **G9 Unsupported browser**: a clear message naming what is missing; in-app browsers (Instagram, Facebook) get an "Open in your browser" prompt.
- **G10 Accessibility**: keyboard operable, visible focus, labelled controls, WCAG AA contrast.
- **G11 Performance**: tool pages LCP < 2.5 s on a mid Android over 4G; initial JS per tool route ≤ 200 KB gzip; engines load lazily after a file is chosen.

## 4. Features and acceptance criteria

### 4.1 Core tools

**Trim**

- Timeline with start/end handles, preview playback of the selection, numeric time inputs (0.1 s steps).
- Two modes: _Fast_ (stream copy, cuts on keyframes, labelled as approximate) and _Precise_ (re-encode).
- AC: Precise output duration within ±0.1 s of the selection; Fast within ±1 keyframe interval and finishing in < 5 s for a 100 MB file on desktop. Audio and video stay in sync (≤ 50 ms drift).

**Compress**

- Three presets: Light (≤1080p), Balanced (≤720p), Small (≤480p). Shows estimated output size before running.
- AC: output plays in Chrome, Safari and WhatsApp; Balanced on a typical 1080p phone clip is ≥ 50% smaller; output is never larger than the input (if it would be, the user is told and offered the original).

**Compress to size**

- Target in MB with presets: WhatsApp 16 MB, Discord 10 MB, Email 25 MB, custom.
- AC: output ≤ target, and ≥ 85% of target when the source is larger than the target. If the target is unreachable at ≥ 150 kbps video, the user is told to trim first. If the source is already under target, no processing happens and the user is told.

**Convert to MP4**

- AC: output is H.264 + AAC, `yuv420p`, faststart. H.264/AAC inputs are remuxed without re-encoding (near-instant). MOV, WebM, MKV and AVI fixtures all convert.

**Video to MP3**

- Bitrate choice: 128 / 192 / 320 kbps-equivalent. AC: output is a valid MP3 whose duration matches the source ±0.1 s; a file with no audio track gives a clear error.

**Mute**

- AC: output has zero audio streams, video stream is bit-identical (stream copy), completes in < 5 s for 100 MB on desktop.

### 4.2 Meme Studio

- Scrub a video frame-accurately and mark a moment of 2–15 s (enforced; handles snap to limits).
- Three caption layouts, with live WYSIWYG preview:
  1. **Top/bottom text** — bold outlined text over the video, top and/or bottom.
  2. **Caption bar** — white bar with black text above the video.
  3. **Freeze-frame zoom** — clip plays, freezes on a chosen frame, slowly zooms toward a chosen point while a caption appears (hold 1–3 s).
- Text supports Latin and Devanagari, auto-fits to width, user can change size.
- Exports:
  - **MP4** (H.264/AAC, with audio).
  - **GIF** (≤ 480 px wide, 12 fps, looping).
  - **WhatsApp sticker** — animated WebP, exactly 512×512, transparent padding, ≤ 500 KB, ≤ 6 s (longer selections are told to shorten).
  - **Still image** — PNG or JPEG of the current frame with caption.
- AC: exported text position and size match the preview within 2% of frame height; Devanagari conjuncts render correctly in every export format; sticker meets all four numeric constraints; a 10 s 720p meme exports in < 60 s on a mid Android.

### 4.3 Auto captions

- Language picker: English, Hindi (default guessed from browser language, always changeable).
- On-device Whisper with word-level timestamps. Voice-activity detection skips silence so silent stretches produce no cues.
- Model tiers: Base by default; "Higher accuracy" (Small) offered only on capable devices, with download size shown.
- **Line splitting**: cues broken at punctuation and pauses; max 2 lines; max characters per line depends on aspect (42 landscape, 22 vertical); cue length 0.7–5 s.
- **Edit screen**: cue list synced to video; edit text; nudge start/end; split, merge, delete, add; undo/redo.
- **Script toggle** (Hindi): Devanagari ⇄ Roman (Hinglish-style transliteration). Manual edits in either script are kept when toggling back and forth.
- **Export**: SRT and VTT (UTF-8), and burned-in MP4 in three styles: _Classic_ (white, black outline), _Box_ (text on dark box), _Highlight_ (current word highlighted).
- AC:
  - Word timestamps on the English fixture are within ±0.3 s of ground truth; fixture WER ≤ 15% (English, Base) and ≤ 35% (Hindi, Base), ≤ 25% (Hindi, Small).
  - A fixture with 10 s of silence in the middle yields no cue inside the silence.
  - SRT and VTT pass a format validator and re-import to the same cue list.
  - Burned-in captions match the preview's line breaks and timing (±1 frame); Devanagari renders correctly.
  - Transcription of 1 min of speech completes in < 60 s on desktop WebGPU and < 4 min on a mid Android (WASM).
  - Audio length limits per device class are enforced with a clear message.

### 4.4 Shorts tools

- Manual 9:16 crop: draggable crop window over the preview, constant aspect.
- Presets: Instagram Reels, YouTube Shorts, TikTok — each shows that platform's safe-zone guide overlay and a duration warning; all export 1080×1920.
- AC: output is exactly 1080×1920, crop position matches the preview within 2 px at source scale, audio preserved.

### 4.5 SEO tool pages

- 20 pages at `/tools/<slug>/` generated from one template and one registry (list in ARCHITECTURE §11). Each embeds the working tool with a page-specific preset.
- Each page has: unique title (≤ 60 chars) and meta description (≤ 155), H1, the tool above the fold, a how-to (3–5 steps), an FAQ (4–6 Q&As), related-tool links, canonical URL, Open Graph tags, and JSON-LD (`SoftwareApplication`, `HowTo`, `FAQPage`, `BreadcrumbList`).
- `sitemap.xml` lists every indexable URL; `robots.txt` allows all and points to the sitemap.
- AC: all 20 pages build statically; a unit test asserts uniqueness of titles/descriptions/H1s and that no two pages share more than 40% of their body copy; JSON-LD validates against schema.org types; Lighthouse SEO score ≥ 95.

### 4.6 Analytics

- Cloudflare Web Analytics for page views and Web Vitals (no cookies).
- A first-party, cookieless event endpoint counts tool runs (needed because Web Analytics has no custom events). Payload contains only: event name, tool id, outcome, engine path, device class, bucketed duration and a `returning` boolean computed locally. No identifiers, filenames or exact sizes.
- AC: a successful run records exactly one `tool_run` event; the privacy page lists every field collected; with the endpoint blocked the tool still works.

## 5. Non-goals (Phase 1)

- Downloading or importing from any URL or platform (permanent non-goal).
- Accounts, credits, payments, AI voice/TTS, cloud processing (Phase 2).
- Auto-reframe / subject tracking, multi-clip timeline, transitions, music library, templates gallery.
- Languages beyond English and Hindi for captions; a non-English UI.
- Translation of captions, speaker labels, SRT import.
- Offline/PWA install and Web Share Target (planned next, not MVP).
- Native apps.

## 6. Success metrics

Measured from 30 days after launch; targets are for day 90 and are initial guesses to revisit.

| Metric                              | Definition                                                                                             | Target  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| **Tool runs per week** (north star) | `tool_run` events with outcome `ok`                                                                    | 5,000   |
| **Returning users**                 | share of weekly active browsers whose `returning` flag is true (had a run in an earlier calendar week) | ≥ 20%   |
| Completion rate                     | `ok` runs ÷ started runs                                                                               | ≥ 85%   |
| Error rate                          | `error` runs ÷ started runs, per tool and device class                                                 | ≤ 5%    |
| Organic entry share                 | page views landing on `/tools/*` from search                                                           | ≥ 50%   |
| Web Vitals                          | LCP p75 on tool pages                                                                                  | < 2.5 s |
