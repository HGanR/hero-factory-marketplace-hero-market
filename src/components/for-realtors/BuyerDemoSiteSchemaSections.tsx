"use client";

import { useEffect, useState } from "react";
import {
  MAANIA_BUYER_SITE_SCHEMA_STORAGE_KEY,
  MAANIA_RET_SITE_SCHEMA_STORAGE_KEY,
} from "@/lib/maania/maania-demo-storage";
import { MaaniaDemoBlockView } from "@/components/maania/MaaniaDemoBlockView";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

type Block = SiteSchemaDocumentType["pages"][0]["blocks"][number];

/**
 * Renders Site Builder blocks from session storage (skips the first `hero` — hero is shown in the hero shell).
 */
export function BuyerDemoSiteSchemaSections() {
  const [blocks, setBlocks] = useState<Block[] | null>(null);

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(MAANIA_BUYER_SITE_SCHEMA_STORAGE_KEY) ??
        sessionStorage.getItem(MAANIA_RET_SITE_SCHEMA_STORAGE_KEY);
      if (!raw) return;
      const doc = JSON.parse(raw) as SiteSchemaDocumentType;
      const page = doc.pages?.[0];
      if (!page?.blocks?.length) return;
      const rest = page.blocks.filter((b, i) => !(i === 0 && b.type === "hero"));
      if (rest.length) setBlocks(rest);
    } catch {
      /* ignore */
    }
  }, []);

  if (!blocks?.length) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
        Generated site structure (Site Builder blocks)
      </p>
      {blocks.map((block, i) => (
        <MaaniaDemoBlockView key={i} block={block} index={i} />
      ))}
    </div>
  );
}
