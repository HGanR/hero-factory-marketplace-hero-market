# Site-builder preview vs static export parity

These Playwright tests compare the **same `SiteSchemaDocument`** rendered two ways:

1. **Static export** — `generateStaticBundle()` → `index.html` + `assets/site.css` (IPFS/deploy path).
2. **Preview harness** — `react-dom/server` + `SiteBuilderPreviewBlock` + [Tailwind CDN](https://cdn.tailwindcss.com/) (approximates the live builder preview).

## Intentional differences (not bugs)

| Area | Preview harness | Static export |
|------|-----------------|---------------|
| Motion | Framer Motion (`motion.*`): entrance `initial`/`animate`, staggered delays, optional `whileHover` | CSS-only: `@keyframes` (e.g. `fadeUp`, `thzShift`) where export emits them; no runtime animation controller |
| Parallax / depth | `TroothertzHeroDepthStack`, `BackgroundIntelligenceLayer`, and other preview-only stacks can add layered motion and parallax-style reads | Export inlines gradients, noise/grid layers, and static pseudo-depth; **no** full Framer-driven parallax replay |
| Hero dominance | Hero is a `motion.section` with Troothertz inner stacks; typography scales via Tailwind utilities | `section.hero-rich` + `site.css` clamp rules + inline hero styles; same copy, different box model details |
| Styling | Tailwind JIT from CDN | Bundled `site.css` + block-level inline `style` |
| Typography | Inter from Google Fonts in harness | Font stack from export CSS (may differ slightly from CDN subset) |
| Paint timing | Tailwind CDN must compile utilities; tests **wait** until `main` has five laid-out sections (min height) + short buffer | `networkidle` on static file server |
| Trust / stat / grid / CTA | Often `motion.section` wrappers, rounded shells from utility classes | Semantic classes: `list-block`, `stat-band`, `image-grid-block`, `cta-block` with export shell rules |
| Stat / CTA / grid “feel” | Hover/lift variants may exist on cards | Static HTML has no pointer-driven micro-interaction unless replicated in CSS |

Tests use **`prefers-reduced-motion: reduce`** (Playwright `use.reducedMotion`) and parity fixtures set **`animateBackground: false`** on heroes so time-based background motion does not flake screenshots.

### What we do **not** require to match pixel-perfect

- Subpixel text antialiasing between CDN and export fonts.
- Framer’s exact post-mount animation state vs export’s first paint (SSR + reduced motion align the intent, not every blur/opacity curve).
- Preview-only depth rails, neural/holo decorative nodes, or floating card hover states unless the static generator explicitly mirrors them in CSS.

## What fails meaningfully

- **Static golden screenshots** — regressions in `static-generator` / export CSS (desktop ×4 style modes; mobile smoke for `web3`).
- **Side-by-side golden** — `dual.html` with static + preview iframes (`web3` smoke).
- **Layout correlation** — per-`main` child heights: desktop (all modes), tablet `820×1100` (corporate), mobile `390×844` (`web3`, slightly looser ratio).
- **Soft pixel budgets** (web3 desktop, `pixelmatch` threshold 0.15): hero, stat band, feature image grid, CTA — catch gross divergence, not cosmetic parity.
- **Shell rule smoke** — `data-troothertz-mode`, section class order (`hero-rich` → `list-block` → `stat-band` → `image-grid-block` → `cta-block`).

## Commands

```bash
npx playwright install chromium
npm run test:playwright:update   # first-time / baseline refresh
npm run test:playwright
```

Snapshot files default to `*-chromium-<platform>.png`. Linux CI agents need their own baselines (run update on that OS) or a shared image pipeline; font rasterization can differ by OS.

## Implementation note

Preview HTML is produced by `scripts/site-builder-parity-preview-ssr.ts` via `npx tsx` (`tests/playwright/preview-ssr-subprocess.ts`). Playwright’s test bundler otherwise corrupts React elements during `renderToStaticMarkup` (invalid child objects with `__pw_type`).

Preview stability: tests call `stabilizePreviewHarness` / `stabilizeDualPreviewIframe` — wait until five `main` children each have meaningful `getBoundingClientRect().height` before screenshots or layout reads, instead of a single fixed sleep.
