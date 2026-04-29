/**
 * Server-render preview blocks for parity harness (Tailwind CDN + same React components as live preview).
 * Lives under `src/` so Playwright’s test bundler does not apply CT-style transforms to test-adjacent TSX.
 * Intentional differences vs static export: Framer Motion initial state, JIT Tailwind, no site.css bundle.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteBuilderPreviewBlock } from "@/components/site-builder/preview/SiteBuilderPreviewBlocks";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { buildPreviewHeadTagsHtml } from "@/lib/site-builder/seo/seo-intelligence";

export function buildPreviewParityHtmlString(doc: SiteSchemaDocumentType): string {
  const blocks = doc.pages[0]?.blocks ?? [];
  const markup = renderToStaticMarkup(
    <>
      {blocks.map((b, i) => (
        <SiteBuilderPreviewBlock key={i} block={b} index={i} />
      ))}
    </>,
  );
  const seoHead = buildPreviewHeadTagsHtml(doc.metadata);
  const headExtra = `${seoHead ? `${seoHead}\n` : ""}<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/><style>
    html{font-family:Inter,system-ui,-apple-system,sans-serif}
    @media (prefers-reduced-motion:reduce){*,::before,::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}}
  </style>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${headExtra}<script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-slate-100 antialiased"><main class="mx-auto grid max-w-[1100px] gap-4 px-4 py-6">${markup}</main></body></html>`;
}
