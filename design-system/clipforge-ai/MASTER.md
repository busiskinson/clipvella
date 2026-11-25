# ClipForge AI — Design System (MASTER)

Source of truth for every page. Page-specific overrides live in `pages/<page>.md`
(none yet). Derived from UI UX Pro Max (`--design-system`, `--domain style|typography|ux`,
`--stack shadcn|nextjs`) and reconciled with the brand brief.

## How the UI UX Pro Max output was applied

| Area | Pro Max recommendation | Decision |
|------|------------------------|----------|
| Style | **Glassmorphism** — blur 10–20px, translucent 10–30% surfaces, 1px light border, layered depth, vibrant backdrop, text contrast 4.5:1 | Adopted. Blur 16px, surfaces 3–7% white over a navy base (lower than the 15% default because this is a dark UI — keeps text contrast high and avoids the "excessive transparency" the brief bans). |
| Mode | Generator suggested light mode for generic SaaS ("avoid dark by default") | **Overridden by brand brief** — the supplied palette is dark (Midnight Black / Deep Navy). Dark-only, with every text pair checked against 4.5:1. |
| Palette | Generic trust-blue / orange | **Overridden by brand palette** (below). Pro Max contrast rules still enforced. |
| Typography | "Tech Startup" pairing: Space Grotesk (headings) + DM Sans (body) — "best for AI products, SaaS" | Adopted. |
| Motion | Standard tier (motion 4/10), 150–300ms hover, 300–450ms enter, stagger lists, honour `prefers-reduced-motion`, animate 1–2 key elements per view | Adopted via Framer Motion + `MotionConfig reducedMotion="user"`. |
| Density | 7/10 — standard 16–64px scale; editor panels use the dense end (8–16px) | Adopted. |
| Stack | shadcn: semantic CSS variables exposed via `@theme inline`, no raw hex in components. Next.js: Server Components by default, push `"use client"` to leaves | Adopted. |

## Color tokens (dark)

| Token | Value | Use |
|-------|-------|-----|
| `--background` | `#080B14` Midnight Black | App canvas |
| `--navy` | `#111A2B` Deep Navy | Opaque surfaces, popovers |
| `--violet` | `#8B5CF6` Electric Violet | Brand accent, glows, active states, selection |
| `--primary` | `#7C3AED` | Button fills. Electric Violet with white text is 4.2:1 (fails AA); this one-step-deeper violet gives 5.7:1 |
| `--ice` | `#38BDF8` Ice Blue | Secondary accent, audio, data series 2. Dark text on top only |
| `--lavender` | `#C4B5FD` Soft Lavender | Accent text, highlights, focus ring |
| `--foreground` | `#F8FAFC` Frost White | Primary text (19:1) |
| `--muted-foreground` | `#A3AEC2` | Secondary text (≈8:1 on canvas, ≈7.5:1 on glass) |
| `--border` | `rgb(255 255 255 / 8%)` | Hairlines; glass border 10% |
| `--destructive` | `#F87171` | Errors and destructive actions |

## Typography

- Headings: Space Grotesk 500–700, tracking -0.02em.
- Body/UI: DM Sans 400–600. Body 15–16px / 1.5; control labels 13–14px; never under 12px.
- Timecodes and numbers: `tabular-nums`.
- Caption fonts (user-selectable only): Montserrat, Poppins, Bebas Neue, Roboto, Anton, Oswald.

## Surfaces

- `.glass` — default panel: gradient white 5.5%→2.5%, blur 16px, 1px 10% border, inner top highlight.
- `.glass-strong` — editor chrome and overlays: navy at 72% + blur.
- `.glow-hover` — interactive cards: border fades to violet/40 with a faint violet shadow. One glow per element, never stacked.
- Radius scale from `--radius: 0.75rem`.

## Interaction & accessibility rules (Pro Max priorities 1–2)

- Visible 2px focus ring (`--ring` lavender), never removed.
- Icon-only buttons always get `aria-label` + tooltip.
- Hit targets ≥ 40px in the content pages; dense editor toolbars ≥ 32px with 8px spacing.
- Hover never the only path to an action.
- Loading/progress feedback for every simulated async action.
- `prefers-reduced-motion`: animations collapse to opacity-only/instant.
- No emoji icons — Lucide only.
- Responsive checkpoints: 375 / 768 / 1024 / 1440. The editor collapses its side panels below 1024px.

## Page notes

- **Video Downloader** (replaced the AI Music Studio): TikTokio-style centred hero with one large URL field
  (`type="url"`, visible sr-only label, live platform chips, inline `role="alert"` errors), skeleton while
  checking, result card, drag-and-drop with a "Browse files" button (never drag-only), history with empty
  state, and a service-status card. Same glass surfaces and tokens as every other page.

## Honesty rules (product)

- Anything that needs a backend (AI analysis, clip generation, transcription, export render)
  is simulated and marked with a `Demo` badge or "sample data" label.
- Video Downloader never shows invented media data: details come from official oEmbed or the user's own file,
  missing fields say so ("Not shared by platform"), and downloads report "needs media service" until an
  authorized service is connected. Private videos, DRM and platform restrictions are never bypassed.
