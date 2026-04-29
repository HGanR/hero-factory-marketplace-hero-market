import { resolveAssetForExport } from "./asset-bundle";
import {
  fixtureGhlMultiPage,
  fixtureStaticMultiPage,
  fixtureStaticSingleCorporate,
  fixtureVercelMultiPage,
  fixtureStaticWeb3,
  fixtureWithBundledImageRef,
  fixtureWordPressMulti,
  FIXTURE_IMAGE_ASSET_ID,
} from "./__fixtures__/deployment-export-schemas";
import { getTextFile, projectExportPaths, wordpressThemePrefixFromFiles } from "./export-test-helpers";
import { buildDeploymentProjectFromSchema } from "./orchestrate";

describe("deployment export ZIP / file shape (regression)", () => {
  test("static single-page: core files + assets README + corporate styleMode in HTML", async () => {
    const files = await buildDeploymentProjectFromSchema(fixtureStaticSingleCorporate);
    const paths = projectExportPaths(files);
    expect(paths).toEqual(
      expect.arrayContaining([
        "index.html",
        "styles.css",
        "scripts.js",
        "assets/README.txt",
        "assets/images/.gitkeep",
        "assets/video/.gitkeep",
        "assets/icons/.gitkeep",
        "README.md",
        "site.tokens.json",
        "site.content-map.json",
      ]),
    );
    const tokens = JSON.parse(getTextFile(files, "site.tokens.json")!) as {
      deployment: { target: string };
      handoff: { schemaVersion: string };
    };
    expect(tokens.handoff.schemaVersion).toBe("1.0");
    expect(tokens.deployment.target).toBe("static");
    expect(tokens.site.styleMode).toBe("corporate");
    const readme = getTextFile(files, "README.md")!;
    expect(readme).toMatch(/## Where to edit what/);
    expect(readme).toMatch(/Machine-readable manifests/);
    const index = getTextFile(files, "index.html")!;
    expect(index).toContain('href="./styles.css"');
    expect(index).toContain("<script");
    expect(index).toContain("FIXTURE_STATIC_SINGLE_BODY");
    expect(index).toMatch(/data-troothertz-mode=["']corporate["']/);
  });

  test("static multi-page: extra HTML + relative ./ nav between pages", async () => {
    const files = await buildDeploymentProjectFromSchema(fixtureStaticMultiPage);
    const paths = projectExportPaths(files);
    expect(paths).toContain("index.html");
    expect(paths).toContain("about.html");

    const index = getTextFile(files, "index.html")!;
    const about = getTextFile(files, "about.html")!;
    expect(index).toContain('href="./about.html"');
    expect(index).toContain("FIXTURE_HOME_MULTI");
    expect(about).toContain('href="./index.html"');
    expect(about).toContain("FIXTURE_ABOUT_MULTI_MARKER");
    expect(index).toMatch(/<nav class="site-export-nav"/);
    expect(about).toMatch(/<nav class="site-export-nav"/);
  });

  test("vercel_nextjs multi-page: App Router + component folders + public gitkeeps + README", async () => {
    const files = await buildDeploymentProjectFromSchema(fixtureVercelMultiPage);
    const paths = projectExportPaths(files);
    expect(paths).toEqual(
      expect.arrayContaining([
        "app/layout.tsx",
        "app/page.tsx",
        "app/about/page.tsx",
        "app/globals.css",
        "components/site-builder-export/home/hero.tsx",
        "components/site-builder-export/home/body-copy.tsx",
        "components/site-builder-export/about/hero.tsx",
        "components/site-builder-export/about/body-copy.tsx",
        "public/images/.gitkeep",
        "public/video/.gitkeep",
        "package.json",
        "README.md",
        "site.tokens.json",
        "site.content-map.json",
      ]),
    );
    const layout = getTextFile(files, "app/layout.tsx")!;
    expect(layout).toContain('import type { ReactNode } from "react"');
    expect(layout).toContain("children: ReactNode");
    expect(layout).toContain("{children}");

    const readme = getTextFile(files, "README.md")!;
    expect(readme).toContain("## Deployment summary");
    expect(readme).toMatch(/`vercel_nextjs`/);
    expect(readme).toMatch(/## Run & deploy/);
    const map = JSON.parse(getTextFile(files, "site.content-map.json")!) as { pages: Array<{ next?: { sections: unknown[] } }> };
    expect(map.pages[0]?.next?.sections?.length).toBeGreaterThan(0);

    const homePage = getTextFile(files, "app/page.tsx")!;
    expect(homePage).toContain('@/components/site-builder-export/home/');
    const homeSection = getTextFile(files, "components/site-builder-export/home/body-copy.tsx")!;
    expect(homeSection).toContain("FIXTURE_NEXT_HOME");
  });

  test("static export carries web3 styleMode on body (metadata → full HTML)", async () => {
    const files = await buildDeploymentProjectFromSchema(fixtureStaticWeb3);
    const index = getTextFile(files, "index.html")!;
    expect(index).toMatch(/data-troothertz-mode=["']web3["']/);
    expect(index).toContain("FIXTURE_WEB3_STATIC_BODY");
  });

  test("wordpress_theme multi-page: core theme files + nav template + optional route template", async () => {
    const files = await buildDeploymentProjectFromSchema(fixtureWordPressMulti);
    const prefix = wordpressThemePrefixFromFiles(files);
    expect(prefix).toMatch(/^wordpress-theme\/fixture-wp-multi-theme$/);

    const paths = projectExportPaths(files);
    expect(paths).toEqual(
      expect.arrayContaining([
        `${prefix}/style.css`,
        `${prefix}/functions.php`,
        `${prefix}/header.php`,
        `${prefix}/footer.php`,
        `${prefix}/front-page.php`,
        `${prefix}/page.php`,
        `${prefix}/index.php`,
        `${prefix}/template-parts/site-export-nav.php`,
        `${prefix}/template-parts/site-export-front-main.php`,
        `${prefix}/template-about.php`,
        `${prefix}/README.md`,
        `${prefix}/site.tokens.json`,
        `${prefix}/site.content-map.json`,
      ]),
    );

    const nav = getTextFile(files, `${prefix}/template-parts/site-export-nav.php`)!;
    expect(nav).toContain("home_url(");
    expect(nav).toContain("/about");

    const functionsPhp = getTextFile(files, `${prefix}/functions.php`)!;
    expect(functionsPhp).toContain("get_stylesheet_uri()");

    const readme = getTextFile(files, `${prefix}/README.md`)!;
    expect(readme).toMatch(/## What was generated/);
    expect(readme).toMatch(/template-parts/);
    const wpTokens = JSON.parse(getTextFile(files, `${prefix}/site.tokens.json`)!) as { deployment: { wordpressThemeSlug: string } };
    expect(wpTokens.deployment.wordpressThemeSlug).toBe("fixture-wp-multi-theme");
    const wpMap = JSON.parse(getTextFile(files, `${prefix}/site.content-map.json`)!) as {
      pages: Array<{ wordpress?: { templatePartLabels?: { nav: string } } }>;
    };
    expect(wpMap.pages[0]?.wordpress?.templatePartLabels?.nav).toMatch(/navigation/i);
  });

  test("gohighlevel_embed multi-page: embed kit + MULTI_PAGE_NOTE + README", async () => {
    const files = await buildDeploymentProjectFromSchema(fixtureGhlMultiPage);
    const paths = projectExportPaths(files);
    expect(paths).toEqual(
      expect.arrayContaining([
        "embed/section.html",
        "embed/full-page.html",
        "embed/styles.css",
        "embed/script.js",
        "embed/assets/images/.gitkeep",
        "embed/assets/video/.gitkeep",
        "embed/MULTI_PAGE_NOTE.md",
        "README.md",
        "site.tokens.json",
        "site.content-map.json",
      ]),
    );

    const section = getTextFile(files, "embed/section.html")!;
    expect(section).toContain('id="site-builder-embed-root"');
    expect(section).toContain("FIXTURE_GHL_HOME");

    const full = getTextFile(files, "embed/full-page.html")!;
    expect(full).toContain("./styles.css");
    expect(full).toContain("./script.js");

    const css = getTextFile(files, "embed/styles.css")!;
    expect(css).toContain(".site-builder-embed");

    const note = getTextFile(files, "embed/MULTI_PAGE_NOTE.md")!;
    expect(note.toLowerCase()).toMatch(/additional|section-oriented|routes/);

    const readme = getTextFile(files, "README.md")!;
    expect(readme).toMatch(/## Limitations/);
    expect(readme).toMatch(/GoHighLevel/);
    const ghlMap = JSON.parse(getTextFile(files, "site.content-map.json")!) as { embed: { sectionHtml: string } };
    expect(ghlMap.embed.sectionHtml).toBe("embed/section.html");
  });

  test("gohighlevel single-page: no MULTI_PAGE_NOTE when only one HTML route", async () => {
    const { SiteSchemaDocument } = await import("@/lib/site-builder/schema");
    const single = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "X", visual: {} } }] }],
      metadata: {
        title: "GHL Single",
        builderRefinement: {
          deploymentTarget: "gohighlevel_embed",
          routingMode: "multi_page",
          assetStrategy: "local_bundle",
        },
      },
    });
    const files = await buildDeploymentProjectFromSchema(single);
    expect(projectExportPaths(files)).not.toContain("embed/MULTI_PAGE_NOTE.md");
  });

  test("resolveAssetForExport: ZIP path placement per deployment target (local_bundle)", () => {
    const asset = fixtureWithBundledImageRef.metadata!.siteBuilderAssets!.heroShot;
    const themeSlug = "fixture-wp-multi-theme";

    const next = resolveAssetForExport(FIXTURE_IMAGE_ASSET_ID, "local_bundle", "vercel_nextjs", {
      asset,
      themeSlug,
    });
    expect(next.status).toBe("local_bundle");
    if (next.status === "local_bundle") {
      expect(next.zipRelativePath).toMatch(/^public\/images\/sb-10000000/);
      expect(next.relativeRef).toMatch(/^\/images\/sb-10000000/);
    }

    const wp = resolveAssetForExport(FIXTURE_IMAGE_ASSET_ID, "local_bundle", "wordpress_theme", {
      asset,
      themeSlug,
    });
    expect(wp.status).toBe("local_bundle");
    if (wp.status === "local_bundle") {
      expect(wp.zipRelativePath).toContain(`wordpress-theme/${themeSlug}/assets/images/`);
      expect(wp.relativeRef).toContain("get_template_directory_uri()");
    }

    const ghl = resolveAssetForExport(FIXTURE_IMAGE_ASSET_ID, "local_bundle", "gohighlevel_embed", {
      asset,
      themeSlug,
    });
    expect(ghl.status).toBe("local_bundle");
    if (ghl.status === "local_bundle") {
      expect(ghl.zipRelativePath).toMatch(/^embed\/assets\/images\/sb-10000000/);
      expect(ghl.relativeRef).toMatch(/^\.\/assets\/images\/sb-10000000/);
    }

    const st = resolveAssetForExport(FIXTURE_IMAGE_ASSET_ID, "local_bundle", "static", { asset, themeSlug });
    expect(st.status).toBe("local_bundle");
    if (st.status === "local_bundle") {
      expect(st.zipRelativePath).toMatch(/^assets\/images\/sb-10000000/);
      expect(st.relativeRef).toMatch(/^\.\/assets\/images\/sb-10000000/);
    }
  });
});
