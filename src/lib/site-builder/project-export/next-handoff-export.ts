import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { buildNextRootLayoutWidgetFragmentTsx } from "@/lib/site-builder/site-builder-widget-embed";
import type { AssetStrategy, RoutingMode } from "@/lib/site-builder/refinement-schema";
import { buildDeploymentReadme, type ReadmeContext } from "./deployment-readme";
import type { ProjectExportFile } from "./types";
import { componentFolderForPageSlug, nextRouteSegment } from "./export-route-meta";
import { nextSectionDescriptorsForRoute } from "./export-section-labels";
import { splitMainHtmlIntoExportSections } from "./export-section-split";
import { extractMainInnerHtml, rewriteHtmlForRelativeCss } from "./static-artifacts";
import { staticHtmlFilenameForPage } from "./static-multi-page-nav";

export { splitMainHtmlIntoExportSections } from "./export-section-split";

/**
 * Next.js App Router handoff: split main markup into `components/site-builder-export/<route>/…`
 * and wire `app/page.tsx` plus `app/<segment>/page.tsx` for multi-page.
 */
export function buildNextHandoffExport(params: {
  schema: SiteSchemaDocumentType;
  htmlByPath: Record<string, string>;
  bundledCss: string;
  routing: RoutingMode;
  assets: AssetStrategy;
}): ProjectExportFile[] {
  const { schema, htmlByPath, bundledCss, routing, assets } = params;

  const readmeCtx: ReadmeContext = {
    target: "vercel_nextjs",
    routingMode: routing,
    assetStrategy: assets,
  };

  const title = schema.metadata?.title || "Site";
  const description = schema.metadata?.description || "";
  const widgetFragment = buildNextRootLayoutWidgetFragmentTsx(schema);
  const meta = schema.metadata;
  const md: Record<string, unknown> = { title, description };
  if (meta?.keywords?.length) md.keywords = meta.keywords;
  if (meta?.robots) md.robots = meta.robots;
  if (meta?.canonicalUrl) md.alternates = { canonical: meta.canonicalUrl };
  if (meta?.openGraph?.title) {
    md.openGraph = {
      title: meta.openGraph.title,
      description: meta.openGraph.description,
      type: meta.openGraph.type || "website",
      url: meta.canonicalUrl,
      images: meta.openGraph.image ? [{ url: meta.openGraph.image }] : undefined,
    };
  }
  if (meta?.twitterCard?.card) {
    md.twitter = {
      card: meta.twitterCard.card,
      title: meta.twitterCard.title,
      description: meta.twitterCard.description,
    };
  }
  const metadataLiteral = JSON.stringify(md, null, 2);

  const ldScripts =
    meta?.structuredData
      ?.map((node) => {
        const inner = JSON.stringify(node).replace(/</g, "\\u003c");
        return `      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ${JSON.stringify(inner)} }} />`;
      })
      .join("\n") ?? "";

  const layoutTsx = `import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = ${metadataLiteral};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="site-builder-export-root" style={{ margin: 0 }}>
${ldScripts}
        {children}
        ${widgetFragment}
      </body>
    </html>
  );
}
`;

  const globalsCss = `/* Site builder export — global layout / Troothertz tokens */
${bundledCss}
`;

  const pkg = {
    name: "site-builder-export",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      next: "^15.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
      "@types/node": "^20.0.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
    },
  };

  const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;

  const tsconfig = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
`;

  const nextEnvDts = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`;

  const files: ProjectExportFile[] = [
    { path: "package.json", content: JSON.stringify(pkg, null, 2), contentType: "application/json" },
    { path: "next.config.ts", content: nextConfig, contentType: "text/typescript" },
    { path: "tsconfig.json", content: tsconfig, contentType: "application/json" },
    { path: "next-env.d.ts", content: nextEnvDts, contentType: "text/typescript" },
    { path: "app/layout.tsx", content: layoutTsx, contentType: "text/typescript" },
    { path: "app/globals.css", content: globalsCss, contentType: "text/css" },
    { path: "public/images/.gitkeep", content: "", contentType: "text/plain" },
    { path: "public/video/.gitkeep", content: "", contentType: "text/plain" },
    { path: "public/icons/.gitkeep", content: "", contentType: "text/plain" },
  ];

  const pagesToEmit = routing === "multi_page" ? schema.pages : schema.pages.slice(0, 1);

  for (const page of pagesToEmit) {
    const fname = staticHtmlFilenameForPage(page);
    const fullHtml = htmlByPath[fname];
    if (!fullHtml) continue;

    const inner = extractMainInnerHtml(rewriteHtmlForRelativeCss(fullHtml));
    const routeSlug = page.slug === "/" ? "index" : page.slug.replaceAll("/", "").trim() || "index";
    const appSegment = routeSlug === "index" ? null : nextRouteSegment(routeSlug);
    const compFolder = componentFolderForPageSlug(page.slug);

    const chunks = splitMainHtmlIntoExportSections(inner);
    const descriptors = nextSectionDescriptorsForRoute(chunks, compFolder);
    const compNames = descriptors.map((d) => d.componentPascal);

    chunks.forEach((chunk, i) => {
      const { componentPascal: pascal, kebabFile: fileBase } = descriptors[i]!;
      const htmlLit = JSON.stringify(chunk);
      const compPath = `components/site-builder-export/${compFolder}/${fileBase}.tsx`;
      const compSrc = `/**
 * Auto-generated site section — replace with real React components when ready.
 * \`display: contents\` keeps the CSS grid/flex from the static export intact.
 */
export function ${pascal}() {
  const html = ${htmlLit};
  return (
    <div
      className={\`sb-export-chunk sb-export-${fileBase}\`}
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
`;
      files.push({ path: compPath, content: compSrc, contentType: "text/typescript" });
    });

    const importBase = `@/components/site-builder-export/${compFolder}`;
    const imports = descriptors
      .map((d) => `import { ${d.componentPascal} } from "${importBase}/${d.kebabFile}";`)
      .join("\n");

    const body = compNames.map((n) => `      <${n} />`).join("\n");
    const routeComment = appSegment === null ? "Home (/)" : `/${appSegment}`;

    const pageSrc = `${imports}

/** Generated route: ${routeComment} */
export default function Page() {
  return (
    <main className="container site-builder-export">
${body}
    </main>
  );
}
`;

    if (appSegment === null) {
      files.push({ path: "app/page.tsx", content: pageSrc, contentType: "text/typescript" });
    } else {
      files.push({ path: `app/${appSegment}/page.tsx`, content: pageSrc, contentType: "text/typescript" });
    }
  }

  files.push({
    path: "README.md",
    content: buildDeploymentReadme(readmeCtx, schema),
    contentType: "text/markdown",
  });

  return files;
}
