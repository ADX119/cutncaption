# cutncaption

A free, ad-free clip, meme and caption studio for short-form creators. You bring a video or audio file; everything runs in your browser, so the file is never uploaded. No sign-up, no watermark.

Status: early development. The plan and progress are in [`docs/TASKS.md`](docs/TASKS.md).

## How it works

- Media processing uses ffmpeg compiled to WebAssembly, with WebCodecs where the browser supports it.
- Captions use Whisper running on your device.
- The site is a static Next.js export hosted on Cloudflare Pages. There is no application server.

## Develop

Requires Node 22 or newer and pnpm.

```sh
pnpm install
pnpm exec playwright install chromium webkit   # once, for the browser tests
pnpm dev                                        # http://localhost:3000
```

| Command        | What it does                                                            |
| -------------- | ----------------------------------------------------------------------- |
| `pnpm dev`     | Development server                                                      |
| `pnpm check`   | Lint, typecheck, unit tests and a production build. Run before commits  |
| `pnpm test`    | Unit and component tests (Vitest)                                       |
| `pnpm e2e`     | Builds, serves the static site with Wrangler, runs Playwright           |
| `pnpm preview` | Serves `out/` the way Cloudflare Pages does, including response headers |

## Read before contributing

- [`docs/PRD.md`](docs/PRD.md): what the product does and does not do.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): module boundaries, how the engines load, device limits.
- [`docs/DESIGN.md`](docs/DESIGN.md): colours, type and motion.
- [`CLAUDE.md`](CLAUDE.md): working rules, including the hard constraints (local files only, nothing uploaded).

## Licence

GPL-3.0-or-later. See [`LICENSE`](LICENSE). The app uses FFmpeg builds that include GPL components, which is why the whole project is GPL.
