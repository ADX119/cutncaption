# cutncaption — project rules

Free, ad-free, privacy-first clip, meme and voice studio. Everything in Phase 1 runs in the user's browser. Open source, GPL-3.0-or-later.

## Before you code

1. Read `docs/PRD.md`, `docs/ARCHITECTURE.md` and `docs/TASKS.md`, and `docs/DESIGN.md` before any UI work. They are the source of truth; code follows them.
2. Take the **first unticked task** in `docs/TASKS.md`. One task per session unless told otherwise.
3. If the task conflicts with the docs or is unclear, or would take more than ~2 hours, stop: split it in TASKS.md or ask. Do not improvise scope.
4. If a decision changes the design, update the relevant doc in the same commit.

## Finishing a task

1. Its **Test** in TASKS.md passes and `pnpm check` is green. Paste real output; never claim a pass you did not run.
2. Tick the task in `docs/TASKS.md`.
3. One commit per task: `M2.3: trim tool UI` plus a short body saying what and why.
4. Do not start the next task in the same commit.

## Hard constraints (never violate)

- **No URL input.** No downloading from YouTube, Instagram, TikTok or any URL. Input is a local file only (picker, drag-and-drop; Web Share Target later).
- **No uploads.** File bytes never leave the device. No new network destination without the owner's approval; `connect-src` in `public/_headers` and the Playwright privacy guard enforce this.
- **No accounts, payments, ads or watermarks** in Phase 1.
- **Client-side processing**: ffmpeg.wasm in a worker, WebCodecs fast paths, transformers.js / ONNX Runtime Web for AI (WebGPU when available).
- **Hosting**: Next.js static export on Cloudflare Pages. Server code = Cloudflare Workers / Pages Functions only. **Never Vercel**, never Next.js server features (route handlers, server actions, middleware, ISR, `next/image` optimisation).
- **Large binaries** (ffmpeg wasm, ONNX wasm, models) come only from our R2 bucket, same-origin at `/assets/*`, via `engine/assets`. No third-party CDNs, no Hugging Face fetches at runtime.
- **COOP/COEP only on `/tools/*`.** Links between isolated and non-isolated pages are plain `<a>`, not `next/link`.
- **Licence**: every dependency must be GPL-3.0-compatible.
- Phase 2 (Supabase, Dodo Payments, TTS) is out of scope until the owner says so.

## Stack

Next.js App Router (`output: 'export'`) · TypeScript strict · Tailwind · Zustand · Radix primitives · `@ffmpeg/ffmpeg` 0.12 · Mediabunny · `@huggingface/transformers` · `onnxruntime-web` · Comlink · Vitest · Playwright · pnpm.

Pinned on purpose: TypeScript 6 and ESLint 9 (the lint plugins do not support TS 7 or ESLint 10 yet). This is Next.js 16; its docs ship in `node_modules/next/dist/docs/` — read the relevant guide before using a Next API (see `AGENTS.md`, which `next dev` regenerates).

## Commands

| Command                        | Does                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `pnpm dev`                     | dev server (COOP/COEP on `/tools/*`)                            |
| `pnpm build`                   | static export to `out/`                                         |
| `pnpm preview`                 | `wrangler pages dev out` (honours `_headers`)                   |
| `pnpm lint` / `pnpm typecheck` | ESLint incl. boundary rules / `tsc --noEmit`                    |
| `pnpm test`                    | Vitest unit tests                                               |
| `pnpm e2e`                     | build + Playwright against `pnpm preview`                       |
| `pnpm e2e:slow`                | `@slow` specs (real Whisper)                                    |
| `pnpm check`                   | lint + typecheck + test + build — must pass before every commit |

Use pnpm only. Scripts are Node `.mjs` and must work on Windows; no bash-only scripts.

## Folder conventions

See ARCHITECTURE §2–3. In short:

- `src/app/` — routes only, no logic.
- `src/features/<area>/` — React UI and one Zustand store per area.
- `src/components/` — shared, feature-agnostic UI.
- `src/engine/` — media, AI, assets, device. No React. The **only** place that imports `@ffmpeg/*`, `@huggingface/transformers`, `onnxruntime-web`, `mediabunny`. Features use `engine/*/index.ts` only.
- `src/editor/` — pure domain logic (captions, meme layouts, crop maths, canvas renderer). No React, no engine imports.
- `src/seo/` — tool registry, page template, content.
- `src/i18n/` — all user-visible strings.
- Tests: unit tests next to the source as `*.test.ts(x)`; e2e in `tests/e2e/`; media in `tests/fixtures/` (each ≤ 300 KB).

ESLint enforces these boundaries. Fix the import, not the rule.

## Coding standards

- TypeScript strict; no `any`, no `@ts-ignore`, no non-null `!` without a comment saying why it is safe.
- **ffmpeg arguments are built only by pure functions in `engine/media/commands/`** returning `string[]`. All numbers (dimensions, bitrates, times) are computed in TypeScript and unit-tested. Never concatenate user text into a filter string; text is rendered via canvas or an ASS file.
- New or changed ffmpeg commands are added to the table in ARCHITECTURE §7.
- Capabilities are feature-detected. UA sniffing only for iOS and in-app browser detection, inside `engine/device`.
- Device limits live in `engine/device/limits.ts` and nowhere else.
- One media job at a time. Never hold ffmpeg and the AI worker in memory together. Always clean the virtual FS and revoke object URLs in `finally`.
- Every long job takes an `AbortSignal` and reports progress.
- Errors cross the engine boundary as `EngineError` with a message key; UI never shows raw logs by default.
- No string literals in JSX; use `t('key')` from `src/i18n`.
- Client components only where needed (`'use client'` at the leaf). Engines and editors load lazily after a file is chosen.
- Accessibility: keyboard operable, labelled controls, visible focus.
- UI follows `docs/DESIGN.md`: colour tokens only (no hex values in components), one muted accent, no neon or gradients, motion only in response to an action.
- No new dependency without a reason in the commit body; check its licence and bundle size.
- Comments explain why, not what. No dead code, no TODOs without a task ID.

## Testing rules

- Write the test first for pure logic (`editor/`, `engine/media/commands/`, `engine/device/`).
- Every command builder has a unit test asserting the exact argument array.
- Every tool has a Playwright happy-path spec that re-probes the output (codec, duration, dimensions, size) and runs with the privacy network guard.
- UI tests of captions use the fake AI engine; real Whisper runs only in `@slow` specs with the tiny model.
- Tests never depend on R2 or the network; assets come from the local test server.
- Do not weaken, skip or delete a failing test to get green. Fix the code or raise it.
- Fixtures are generated by `scripts/gen-fixtures.mjs` and committed; do not add large media to the repo.

## Ask before doing

- Creating or changing anything in Cloudflare (Pages, R2, Analytics Engine, DNS) or uploading assets.
- Adding a network destination, analytics field or third-party script.
- Changing limits, PRD thresholds, the licence, or any hard constraint.
- Deploying to production.
