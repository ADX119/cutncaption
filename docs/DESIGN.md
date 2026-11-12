# cutncaption — Design

The look is set by the owner's brief: minimalist, light and dark, simple and pleasant to use, small animations when you do something, and no neon highlights anywhere. Every screen follows this document. Tokens live in `src/app/globals.css`; change them there, never in components.

## Concept: the cutting mat

A cutting mat, paper and a graphite pencil. Quiet neutral surfaces, one muted mat-green for the things you select and act on. The recurring shape is the **trim selection**: two handles with a span between them. It is the logo mark, the home page strip and the real timeline control.

## Colour

Use the Tailwind names (`bg-paper`, `text-ink`, `border-rule`, `bg-accent` …). Never write a hex value in a component.

| Token           | Light     | Dark      | Use                                              |
| --------------- | --------- | --------- | ------------------------------------------------ |
| `paper`         | `#f5f6f3` | `#101412` | Page background                                  |
| `sheet`         | `#ffffff` | `#171c19` | Raised surfaces: panels, inputs, the video frame |
| `ink`           | `#18201c` | `#e6eae7` | Text                                             |
| `graphite`      | `#5c6661` | `#98a39d` | Secondary text, idle icons                       |
| `rule`          | `#d9ddd8` | `#29302c` | Borders and dividers                             |
| `accent`        | `#2e6b57` | `#86bfa6` | Selection, primary action, focus ring            |
| `accent-strong` | `#245545` | `#a3d1bc` | Primary action on hover                          |
| `on-accent`     | `#ffffff` | `#101412` | Text on `accent`                                 |
| `accent-wash`   | `#e4ece7` | `#1c2823` | Hover and selected backgrounds                   |
| `danger`        | `#a3443a` | `#e09a90` | Errors and destructive actions only              |

Rules:

- One accent. No second brand colour, no gradients, no glows, no coloured shadows, no saturated or neon colours.
- Depth comes from `paper` vs `sheet` and a `rule` border, not from drop shadows.
- The user's video is the most colourful thing on the screen; the interface stays out of its way.
- Text contrast is at least WCAG AA in both themes. Check any new pairing.

## Theme

Follows the system setting by default. The header toggle stores an explicit choice (`localStorage` key `cnc-theme`) and sets `data-theme` on `<html>`; a tiny inline script applies it before first paint. Components never branch on the theme: they use tokens, which flip.

## Type

One family: **Anek Latin** (Ek Type), self-hosted through `next/font`. It has a matching **Anek Devanagari** for the Hindi interface later.

- Headings use the `display` class: width axis 86, weight 650, tight tracking and leading.
- Body is the default width, weight 400, with relaxed leading for paragraphs.
- Numbers are tabular everywhere (timecodes, sizes, percentages). No monospace face.
- Sentence case for everything. No all-caps labels, no small label sitting above a heading.
- Keep paragraphs under about 60 characters wide.

## Layout

- Left-aligned, single column, `max-w-5xl` with 16 px side gutters on phones and 24 px from `sm`.
- Phones first: every control is at least 44 px tall, and nothing scrolls sideways.
- Separate things with space and `rule` lines. Do not put everything in cards; a bordered `sheet` is for something that is genuinely a surface (the video frame, a panel of controls).
- Corner radius: 8 px on surfaces, fully round on pill buttons and icon buttons.

## Motion

Motion answers something the person did. Nothing moves on its own, with one exception: the home page strip closes its handles once on load.

| Token              | Value                      | Use                                          |
| ------------------ | -------------------------- | -------------------------------------------- |
| `--duration-press` | 120 ms                     | Press feedback, hover colour                 |
| `--duration-move`  | 200 ms                     | Toggles, theme change, things changing place |
| `--ease-settle`    | `cubic-bezier(.2,.8,.2,1)` | Everything                                   |

- `pressable`: anything you can press settles to 97% while held.
- Toggles and switches slide or turn into their new state in 200 ms; they never jump and never bounce.
- `link`: text links draw their underline in from the left.
- Progress moves smoothly; do not animate numbers counting up for effect.
- No entrance animations on scroll, no hover lift on lists or cards, no looping decoration.
- `prefers-reduced-motion` is honoured globally in `globals.css`; do not add motion that bypasses it.

## Writing

Plain words, sentence case, active voice. Say what a control does ("Trim video", "Save as GIF"). Errors say what happened and what to do next. All strings go through `t()`.
