import type { ReferenceItem } from "./schema";

export type ReferenceFilter = {
  q?: string;
  topic?: ReferenceItem["topic"];
  scope?: ReferenceItem["scope"];
  jurisdiction?: string;
  tags?: string[];
};

export function filterReferences(items: ReferenceItem[], f: ReferenceFilter): ReferenceItem[] {
  const q = (f.q ?? "").trim().toLowerCase();

  return items.filter((it) => {
    if (f.topic && it.topic !== f.topic) return false;
    if (f.scope && it.scope !== f.scope) return false;

    if (f.jurisdiction) {
      if (it.scope === "STATE" || it.scope === "MULTI") {
        const js = it.jurisdictions ?? [];
        if (!js.includes(f.jurisdiction)) return false;
      }
    }

    if (f.tags?.length) {
      const set = new Set(it.tags);
      if (!f.tags.every((t) => set.has(t))) return false;
    }

    if (q) {
      const blob = `${it.title} ${it.summary} ${it.tags.join(" ")} ${it.citations.map((c) => c.label).join(" ")}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }

    return true;
  });
}
