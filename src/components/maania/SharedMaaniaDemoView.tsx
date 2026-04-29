"use client";

import { MaaniaDemoBlockView } from "@/components/maania/MaaniaDemoBlockView";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";

type Props = {
  kind: "buyer" | "ret";
  title: string;
  schema: unknown;
};

/**
 * Public shared demo: renders stored Site Builder blocks (full page, including hero).
 */
export function SharedMaaniaDemoView({ kind, title, schema }: Props) {
  const parsed = SiteSchemaDocument.safeParse(schema);
  const doc = parsed.success ? parsed.data : null;
  const blocks = doc?.pages?.[0]?.blocks ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 rounded-xl border border-blue-500/30 bg-blue-950/30 px-4 py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-300/90">Shared MAANIA demo</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          {kind === "buyer" ? "Buyer intake" : "RET / seller intake"} · read-only preview
        </p>
      </div>
      {blocks.length ? (
        <div className="space-y-8">
          {blocks.map((block, i) => (
            <MaaniaDemoBlockView key={i} block={block} index={i} />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">Could not render this demo (invalid schema).</p>
      )}
    </div>
  );
}
