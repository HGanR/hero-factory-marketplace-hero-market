/**
 * Serialization + deterministic readable notes for downstream Content Bundle / Revenue OS inputs.
 */

import type { BentleyContentBundleHandoff, BentleyContentBundleReadableNotes } from "./contentBundleHandoffTypes";

export function serializeContentBundleHandoff(h: BentleyContentBundleHandoff): string {
  return JSON.stringify(h, null, 2);
}

function lines(parts: string[]): string {
  return parts.filter(Boolean).join("\n");
}

/**
 * Compact markdown for operators + a single paste block for legacy notes fields.
 */
export function buildBentleyContentBundleReadableNotes(h: BentleyContentBundleHandoff): BentleyContentBundleReadableNotes {
  const id = h.handoffId ?? "(not persisted)";
  const title = `Bentley SLI → Content seed · ${id.slice(0, 8)}… · ${h.basedOnFilteredRowCount} rows`;

  const md = lines([
    `## ${title}`,
    "",
    `_Source: ${h.source} · schema v${h.schemaVersion} · ${h.createdAt}_`,
    "",
    "### Market summary",
    h.marketSummary,
    "",
    "### Top pain themes",
    h.topPainThemes.length
      ? h.topPainThemes.map((t) => `- **${t.theme}** (${t.count})`).join("\n")
      : "—",
    "",
    "### Hooks",
    h.hooks.length ? h.hooks.map((x) => `- ${x}`).join("\n") : "—",
    "",
    "### CTA angles",
    h.ctaAngles.length ? h.ctaAngles.map((x) => `- ${x}`).join("\n") : "—",
    "",
    "### Offer angles",
    h.offerAngles.length ? h.offerAngles.map((x) => `- ${x}`).join("\n") : "—",
    "",
    "### Objections",
    h.objections.length ? h.objections.map((o) => `- ${o.text} (×${o.count})`).join("\n") : "—",
    "",
    "### Pillars",
    h.pillars.map((p) => `- ${p}`).join("\n"),
    "",
    "### What to post next",
    h.whatToPostNext.map((x, i) => `${i + 1}. ${x}`).join("\n"),
    "",
    "### Provenance",
    `- Upload: ${h.provenance.uploadId ?? "—"} (${h.provenance.uploadSourceType ?? "—"}) ${h.provenance.uploadFilename ?? ""}`,
    `- Run: ${h.provenance.runId ?? "—"}`,
    h.provenance.csvImportFileName ? `- CSV file: ${h.provenance.csvImportFileName}` : null,
    h.provenance.csvValidRowsImported != null ? `- CSV rows imported: ${h.provenance.csvValidRowsImported}` : null,
    `- Run total / filtered: ${h.provenance.totalRunRowCount} / ${h.basedOnFilteredRowCount}`,
    "",
    "_Structured JSON is the source of truth for downstream generation._",
  ]);

  const singleBlock = [
    `[Bentley SLI handoff ${id}] ${h.marketSummary}`,
    `Hooks: ${h.hooks.slice(0, 3).join(" | ")}`,
    `CTAs: ${h.ctaAngles.slice(0, 3).join(" | ")}`,
    `Next: ${h.whatToPostNext[0] ?? "—"}`,
  ].join("\n");

  return { title, compactMarkdown: md, singleBlock };
}
