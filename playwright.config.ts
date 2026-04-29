import { defineConfig, devices } from "@playwright/test";

/**
 * Site-builder preview vs static export parity (opt-in CI).
 * Install browsers: `npx playwright install chromium`
 * Run: `npm run test:playwright`
 * First-time golden PNGs: `npm run test:playwright:update` then commit `*-snapshots/`.
 *
 * Intentional differences (not failures): Framer Motion vs static CSS-only motion;
 * Tailwind CDN JIT vs bundled `site.css`; preview waits until `main` sections are laid out (see PARITY.md).
 */
export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    /** Aligns with preview harness CSS + limits Framer Motion flake in screenshots. */
    reducedMotion: "reduce",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium" }],
});
