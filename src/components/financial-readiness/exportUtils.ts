/** Client-side export helpers — no extra dependencies. */

import type { CollectorEntry } from "./state";
import type { FrCase, VaultDocument } from "./vaultTypes";
import { vaultDocumentLabel } from "./vaultLabels";
import { statusLabel } from "./vaultLabels";

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildCaseSummaryText(
  c: FrCase,
  docs: VaultDocument[],
  interactions: CollectorEntry[]
): string {
  const lines: string[] = [
    `Matter: ${c.label}`,
    `Module: ${c.module}`,
    `Status: ${statusLabel(c.status)}`,
    `Primary party: ${c.primaryParty}`,
    `Follow-up due: ${c.followUpDueAt ?? "—"}`,
    `Next action: ${c.nextAction}`,
    "",
    "--- Documents ---",
  ];
  for (const d of docs) {
    lines.push(
      `- ${vaultDocumentLabel(d.type)} · ${d.primaryParty} · ${statusLabel(d.status)} · due ${d.followUpDueAt ?? "—"}`
    );
  }
  lines.push("", "--- Collector log ---");
  if (interactions.length === 0) lines.push("(none)");
  for (const e of interactions) {
    lines.push(`${e.date} ${e.channel} · ${e.collector}: ${e.notes}`);
  }
  return lines.join("\n");
}

export function buildAllDocumentsCombinedText(docs: VaultDocument[]): string {
  const parts: string[] = [];
  for (const d of docs) {
    parts.push(
      `\n\n======== ${vaultDocumentLabel(d.type)} · ${d.primaryParty} · ${d.id} ========\n\n`,
      d.text
    );
  }
  return parts.join("").trim();
}

export function linkedDocumentsForCase(c: FrCase, allDocs: VaultDocument[]): VaultDocument[] {
  const m = new Map<string, VaultDocument>();
  for (const d of allDocs) {
    if (d.caseId === c.id) m.set(d.id, d);
  }
  for (const did of c.documentIds) {
    const d = allDocs.find((x) => x.id === did);
    if (d) m.set(d.id, d);
  }
  return [...m.values()];
}

export function buildBulkCasesExportText(
  cases: FrCase[],
  state: { documents: VaultDocument[]; resolution: { interactions: CollectorEntry[] } }
): string {
  const parts: string[] = [];
  for (const c of cases) {
    const docs = linkedDocumentsForCase(c, state.documents);
    const logs = state.resolution.interactions.filter((e) => e.caseId === c.id);
    parts.push(buildCaseSummaryText(c, docs, logs), "\n\n========\n\n");
  }
  return parts.join("").trim();
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function safeFilenamePart(s: string): string {
  const t = s.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
  return t.slice(0, 48) || "letter";
}

export function letterDownloadFilename(doc: VaultDocument): string {
  return `${safeFilenamePart(doc.primaryParty)}-${doc.id.slice(-6)}.txt`;
}

/** Plain text suitable for pasting into an email client (subject line + body). */
export function buildEmailReadyLetterText(doc: VaultDocument): string {
  const subj = `${vaultDocumentLabel(doc.type)} — ${doc.primaryParty}`;
  return [`Subject: ${subj}`, `To: (recipient)`, `---`, ``, doc.text.trim()].join("\n");
}
