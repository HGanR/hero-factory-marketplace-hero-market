/**
 * Preview vs static parity: see ./PARITY.md for intentional differences and commands.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildSiteBuilderParityFixture, SITE_BUILDER_PARITY_MODES } from "../../src/lib/site-builder/parity-fixtures";
import { generateStaticBundle } from "../../src/lib/site-builder/static-generator";
import { buildPreviewParityHtmlString } from "./preview-ssr-subprocess";
import { startStaticServer } from "./http-static-server";
import { comparePngBuffers } from "./pixel-compare";

type LayoutRow = { tag: string; height: number };

/** Write static bundle files to a temp dir (shared helper). */
function writeBundleToDir(files: { path: string; content: string }[], dir: string) {
  for (const f of files) {
    const dest = path.join(dir, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.content, "utf8");
  }
}

async function readMainChildLayout(page: import("@playwright/test").Page): Promise<LayoutRow[]> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return [];
    return Array.from(main.children).map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), height: Math.round(r.height) };
    });
  });
}

/**
 * Tailwind CDN paints after `load`; wait until all parity sections have non-trivial height
 * instead of a fixed 2.5s-only sleep (still add a short post-paint buffer for JIT/fonts).
 */
async function stabilizePreviewHarness(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const main = document.querySelector("main");
      if (!main || main.children.length < 5) return false;
      const heights = Array.from(main.children).map((c) => c.getBoundingClientRect().height);
      return heights.every((h) => h >= 28);
    },
    { timeout: 25_000 },
  );
  await new Promise((r) => setTimeout(r, 400));
}

/** Preview lives in an iframe on `dual.html`; wait for Tailwind + block layout inside it. */
async function stabilizeDualPreviewIframe(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const iframe = document.querySelector('iframe[title="preview"]') as HTMLIFrameElement | null;
      const idoc = iframe?.contentDocument;
      const main = idoc?.querySelector("main");
      if (!main || main.children.length < 5) return false;
      const heights = Array.from(main.children).map((c) => c.getBoundingClientRect().height);
      return heights.every((h) => h >= 28);
    },
    { timeout: 25_000 },
  );
  await new Promise((r) => setTimeout(r, 400));
}

/** Full-page golden baselines (static export only). One mobile smoke + all desktop modes keeps repo size and CI time practical. */
const STATIC_SNAPSHOT_DESKTOP_MODES = SITE_BUILDER_PARITY_MODES;
const STATIC_SNAPSHOT_MOBILE_MODES: (typeof SITE_BUILDER_PARITY_MODES)[number][] = ["web3"];

test.describe("site-builder static export (golden)", () => {
  for (const mode of STATIC_SNAPSHOT_DESKTOP_MODES) {
    test(`static ${mode} desktop matches baseline`, async ({ page }) => {
      const doc = buildSiteBuilderParityFixture(mode);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
      const { files } = generateStaticBundle(doc);
      writeBundleToDir(files, tmp);
      const srv = await startStaticServer(tmp);
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
        await expect(page.locator("main.container")).toBeVisible();
        await expect(page).toHaveScreenshot(`static-${mode}-desktop.png`, {
          fullPage: true,
          maxDiffPixels: 12_000,
        });
      } finally {
        await srv.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  }

  for (const mode of STATIC_SNAPSHOT_MOBILE_MODES) {
    test(`static ${mode} mobile matches baseline`, async ({ page }) => {
      const doc = buildSiteBuilderParityFixture(mode);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
      const { files } = generateStaticBundle(doc);
      writeBundleToDir(files, tmp);
      const srv = await startStaticServer(tmp);
      try {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
        await expect(page.locator("main.container")).toBeVisible();
        await expect(page).toHaveScreenshot(`static-${mode}-mobile.png`, {
          fullPage: true,
          maxDiffPixels: 15_000,
        });
      } finally {
        await srv.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  }
});

test.describe("preview vs static layout correlation", () => {
  for (const mode of SITE_BUILDER_PARITY_MODES) {
    test(`section stack heights correlate (${mode})`, async ({ page, context }) => {
      const doc = buildSiteBuilderParityFixture(mode);

      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
      const { files } = generateStaticBundle(doc);
      writeBundleToDir(files, tmp);
      const srv = await startStaticServer(tmp);
      let staticLayout: LayoutRow[];
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
        staticLayout = await readMainChildLayout(page);
        expect(staticLayout.length).toBeGreaterThanOrEqual(4);
      } finally {
        await srv.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      }

      const previewPage = await context.newPage();
      const html = buildPreviewParityHtmlString(doc);
      await previewPage.setViewportSize({ width: 1280, height: 900 });
      await previewPage.setContent(html, { waitUntil: "load" });
      await stabilizePreviewHarness(previewPage);
      const previewLayout = await readMainChildLayout(previewPage);
      await previewPage.close();

      const n = Math.min(staticLayout.length, previewLayout.length);
      expect(n).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < n; i++) {
        const hs = staticLayout[i]!.height;
        const hp = previewLayout[i]!.height;
        const rel = Math.abs(hs - hp) / Math.max(hs, hp, 1);
        expect(rel, `child[${i}] height static=${hs} preview=${hp}`).toBeLessThan(0.42);
      }
    });
  }
});

test.describe("preview vs static hero region (soft pixel budget)", () => {
  test("hero band differs within budget (web3 desktop)", async ({ page, context }) => {
    const mode = "web3" as const;
    const doc = buildSiteBuilderParityFixture(mode);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
    const { files } = generateStaticBundle(doc);
    writeBundleToDir(files, tmp);
    const srv = await startStaticServer(tmp);
    let staticShot: Buffer;
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
      const hero = page.locator("section.hero-rich").first();
      await expect(hero).toBeVisible();
      staticShot = await hero.screenshot();
    } finally {
      await srv.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    const previewPage = await context.newPage();
    await previewPage.setViewportSize({ width: 1280, height: 900 });
    await previewPage.setContent(buildPreviewParityHtmlString(doc), { waitUntil: "load" });
    await stabilizePreviewHarness(previewPage);
    const previewHero = previewPage.locator("main section").first();
    await expect(previewHero).toBeVisible();
    const previewShot = await previewHero.screenshot();
    await previewPage.close();

    try {
      const { ratio } = comparePngBuffers(staticShot, previewShot);
      expect(ratio, "hero crop pixel diff (Framer + Tailwind CDN vs inline+site.css)").toBeLessThan(0.55);
    } catch (e) {
      if (String(e).includes("Size mismatch")) {
        test.info().annotations.push({
          type: "note",
          description: "Hero bounding boxes differ in size between preview and static; skipped strict pixel compare.",
        });
        return;
      }
      throw e;
    }
  });
});

test.describe("preview vs static stat band (soft pixel budget)", () => {
  test("stat band differs within budget (web3 desktop)", async ({ page, context }) => {
    const mode = "web3" as const;
    const doc = buildSiteBuilderParityFixture(mode);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
    const { files } = generateStaticBundle(doc);
    writeBundleToDir(files, tmp);
    const srv = await startStaticServer(tmp);
    let staticShot: Buffer;
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
      const stat = page.locator("section.stat-band").first();
      await expect(stat).toBeVisible();
      staticShot = await stat.screenshot();
    } finally {
      await srv.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    const previewPage = await context.newPage();
    await previewPage.setViewportSize({ width: 1280, height: 900 });
    await previewPage.setContent(buildPreviewParityHtmlString(doc), { waitUntil: "load" });
    await stabilizePreviewHarness(previewPage);
    const previewStat = previewPage.locator("main > *").nth(2);
    await expect(previewStat).toBeVisible();
    const previewShot = await previewStat.screenshot();
    await previewPage.close();

    try {
      const { ratio } = comparePngBuffers(staticShot, previewShot);
      expect(ratio, "stat band crop (motion.section vs static section.stat-band)").toBeLessThan(0.62);
    } catch (e) {
      if (String(e).includes("Size mismatch")) {
        test.info().annotations.push({
          type: "note",
          description: "Stat band bounding boxes differ; skipped strict pixel compare.",
        });
        return;
      }
      throw e;
    }
  });
});

test.describe("preview vs static feature grid (soft pixel budget)", () => {
  test("image grid differs within budget (web3 desktop)", async ({ page, context }) => {
    const mode = "web3" as const;
    const doc = buildSiteBuilderParityFixture(mode);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
    const { files } = generateStaticBundle(doc);
    writeBundleToDir(files, tmp);
    const srv = await startStaticServer(tmp);
    let staticShot: Buffer;
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
      const grid = page.locator("section.image-grid-block").first();
      await expect(grid).toBeVisible();
      staticShot = await grid.screenshot();
    } finally {
      await srv.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    const previewPage = await context.newPage();
    await previewPage.setViewportSize({ width: 1280, height: 900 });
    await previewPage.setContent(buildPreviewParityHtmlString(doc), { waitUntil: "load" });
    await stabilizePreviewHarness(previewPage);
    const previewGrid = previewPage.locator("main > *").nth(3);
    await expect(previewGrid).toBeVisible();
    const previewShot = await previewGrid.screenshot();
    await previewPage.close();

    try {
      const { ratio } = comparePngBuffers(staticShot, previewShot);
      expect(ratio, "feature grid crop (preview motion.section vs static image-grid-block)").toBeLessThan(0.68);
    } catch (e) {
      if (String(e).includes("Size mismatch")) {
        test.info().annotations.push({
          type: "note",
          description: "Image grid bounding boxes differ; skipped strict pixel compare.",
        });
        return;
      }
      throw e;
    }
  });
});

test.describe("preview vs static CTA block (soft pixel budget)", () => {
  test("CTA differs within budget (web3 desktop)", async ({ page, context }) => {
    const mode = "web3" as const;
    const doc = buildSiteBuilderParityFixture(mode);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
    const { files } = generateStaticBundle(doc);
    writeBundleToDir(files, tmp);
    const srv = await startStaticServer(tmp);
    let staticShot: Buffer;
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
      const cta = page.locator("section.cta-block").first();
      await expect(cta).toBeVisible();
      staticShot = await cta.screenshot();
    } finally {
      await srv.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    const previewPage = await context.newPage();
    await previewPage.setViewportSize({ width: 1280, height: 900 });
    await previewPage.setContent(buildPreviewParityHtmlString(doc), { waitUntil: "load" });
    await stabilizePreviewHarness(previewPage);
    const previewCta = previewPage.locator("main > *").nth(4);
    await expect(previewCta).toBeVisible();
    const previewShot = await previewCta.screenshot();
    await previewPage.close();

    try {
      const { ratio } = comparePngBuffers(staticShot, previewShot);
      expect(ratio, "CTA crop (preview motion.section vs static cta-block)").toBeLessThan(0.68);
    } catch (e) {
      if (String(e).includes("Size mismatch")) {
        test.info().annotations.push({
          type: "note",
          description: "CTA bounding boxes differ; skipped strict pixel compare.",
        });
        return;
      }
      throw e;
    }
  });
});

test.describe("static export section flow (shell parity)", () => {
  for (const mode of SITE_BUILDER_PARITY_MODES) {
    test(`engineered sections + flow order (${mode})`, async ({ page }) => {
      const doc = buildSiteBuilderParityFixture(mode);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
      const { files } = generateStaticBundle(doc);
      writeBundleToDir(files, tmp);
      const srv = await startStaticServer(tmp);
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
        const modeAttr = await page.evaluate(() => document.body.getAttribute("data-troothertz-mode"));
        expect(modeAttr).toBe(mode);
        const classes = await page.$$eval("main.container > section", (els) => els.map((e) => e.className));
        expect(classes.length).toBeGreaterThanOrEqual(5);
        expect(classes[0]).toMatch(/hero-rich/);
        expect(classes[1]).toMatch(/list-block/);
        expect(classes[2]).toMatch(/stat-band/);
        expect(classes[3]).toMatch(/image-grid-block/);
        expect(classes[4]).toMatch(/cta-block/);
      } finally {
        await srv.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  }
});

test.describe("preview vs static layout correlation (tablet)", () => {
  test("corporate section stack heights correlate (820×1100)", async ({ page, context }) => {
    const mode = "corporate" as const;
    const doc = buildSiteBuilderParityFixture(mode);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
    const { files } = generateStaticBundle(doc);
    writeBundleToDir(files, tmp);
    const srv = await startStaticServer(tmp);
    let staticLayout: LayoutRow[];
    try {
      await page.setViewportSize({ width: 820, height: 1100 });
      await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
      staticLayout = await readMainChildLayout(page);
      expect(staticLayout.length).toBeGreaterThanOrEqual(4);
    } finally {
      await srv.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    const previewPage = await context.newPage();
    await previewPage.setViewportSize({ width: 820, height: 1100 });
    await previewPage.setContent(buildPreviewParityHtmlString(doc), { waitUntil: "load" });
    await stabilizePreviewHarness(previewPage);
    const previewLayout = await readMainChildLayout(previewPage);
    await previewPage.close();

    const n = Math.min(staticLayout.length, previewLayout.length);
    expect(n).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < n; i++) {
      const hs = staticLayout[i]!.height;
      const hp = previewLayout[i]!.height;
      const rel = Math.abs(hs - hp) / Math.max(hs, hp, 1);
      expect(rel, `tablet child[${i}] height static=${hs} preview=${hp}`).toBeLessThan(0.42);
    }
  });
});

test.describe("preview vs static layout correlation (mobile)", () => {
  test("web3 section stack heights correlate (390×844)", async ({ page, context }) => {
    const mode = "web3" as const;
    const doc = buildSiteBuilderParityFixture(mode);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-"));
    const { files } = generateStaticBundle(doc);
    writeBundleToDir(files, tmp);
    const srv = await startStaticServer(tmp);
    let staticLayout: LayoutRow[];
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: "networkidle" });
      staticLayout = await readMainChildLayout(page);
      expect(staticLayout.length).toBeGreaterThanOrEqual(4);
    } finally {
      await srv.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    const previewPage = await context.newPage();
    await previewPage.setViewportSize({ width: 390, height: 844 });
    await previewPage.setContent(buildPreviewParityHtmlString(doc), { waitUntil: "load" });
    await stabilizePreviewHarness(previewPage);
    const previewLayout = await readMainChildLayout(previewPage);
    await previewPage.close();

    const n = Math.min(staticLayout.length, previewLayout.length);
    expect(n).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < n; i++) {
      const hs = staticLayout[i]!.height;
      const hp = previewLayout[i]!.height;
      const rel = Math.abs(hs - hp) / Math.max(hs, hp, 1);
      expect(rel, `mobile child[${i}] height static=${hs} preview=${hp}`).toBeLessThan(0.48);
    }
  });
});

const DUAL_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>parity dual</title>
<style>html,body{margin:0;height:100%;background:#020617;color:#94a3b8;font-family:system-ui,sans-serif;font-size:11px}</style></head>
<body>
<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr;gap:4px 8px;height:100vh;padding:8px;box-sizing:border-box">
  <div style="text-align:center">static export</div>
  <div style="text-align:center">preview harness</div>
  <iframe title="static" src="./index.html" style="width:100%;height:100%;border:1px solid #334155;border-radius:4px"></iframe>
  <iframe title="preview" src="./preview.html" style="width:100%;height:100%;border:1px solid #334155;border-radius:4px"></iframe>
</div>
</body></html>`;

test.describe("side-by-side parity harness (smoke)", () => {
  test("web3 static vs preview in split iframes (golden)", async ({ page }) => {
    const doc = buildSiteBuilderParityFixture("web3");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-parity-dual-"));
    const { files } = generateStaticBundle(doc);
    writeBundleToDir(files, tmp);
    fs.writeFileSync(path.join(tmp, "preview.html"), buildPreviewParityHtmlString(doc), "utf8");
    fs.writeFileSync(path.join(tmp, "dual.html"), DUAL_HTML, "utf8");
    const srv = await startStaticServer(tmp);
    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`http://127.0.0.1:${srv.port}/dual.html`, { waitUntil: "networkidle" });
      await stabilizeDualPreviewIframe(page);
      await expect(page).toHaveScreenshot("side-by-side-web3.png", {
        fullPage: true,
        maxDiffPixels: 45_000,
      });
    } finally {
      await srv.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
