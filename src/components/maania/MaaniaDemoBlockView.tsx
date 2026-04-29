import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

type Block = SiteSchemaDocumentType["pages"][0]["blocks"][number];

/**
 * Renders a single Site Builder block for MAANIA demo / shared demo previews.
 */
export function MaaniaDemoBlockView({ block, index }: { block: Block; index: number }) {
  const type = block.type;
  const c = block.content ?? {};

  if (type === "hero") {
    return (
      <div key={index} className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-8 text-center">
        <h2 className="font-serif text-3xl font-semibold text-white">{String(c.title ?? "")}</h2>
        {c.subtitle ? (
          <p className="mt-4 text-lg font-medium uppercase tracking-wide text-slate-200">{String(c.subtitle)}</p>
        ) : null}
      </div>
    );
  }

  if (type === "section") {
    return (
      <div key={index} className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 text-left">
        <h3 className="text-lg font-semibold text-white">{String(c.title ?? "Section")}</h3>
        {c.body ? (
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
            {String(c.body)}
          </pre>
        ) : null}
      </div>
    );
  }

  if (type === "heading") {
    return (
      <h3 key={index} className="text-left text-xl font-semibold text-white">
        {String(c.text ?? "")}
      </h3>
    );
  }

  if (type === "paragraph") {
    return (
      <p key={index} className="text-left text-sm leading-relaxed text-slate-300">
        {String(c.text ?? c.body ?? "")}
      </p>
    );
  }

  if (type === "list") {
    const items = Array.isArray(block.items)
      ? block.items
      : Array.isArray(c.items)
        ? (c.items as string[])
        : [];
    return (
      <ul key={index} className="list-inside list-disc space-y-2 text-left text-sm text-slate-300">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  if (type === "divider") {
    return <hr key={index} className="border-slate-700/90" />;
  }

  if (type === "call_to_action") {
    return (
      <div
        key={index}
        className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-6 text-center"
      >
        <h4 className="text-lg font-semibold text-emerald-100">{String(c.title ?? "Next step")}</h4>
        {c.body ? <p className="mt-2 text-sm text-slate-300">{String(c.body)}</p> : null}
        <span className="mt-4 inline-block rounded-full border border-emerald-500/40 bg-emerald-600/20 px-5 py-2 text-sm font-semibold text-emerald-100">
          {String(c.label ?? "Continue")}
        </span>
      </div>
    );
  }

  return null;
}
