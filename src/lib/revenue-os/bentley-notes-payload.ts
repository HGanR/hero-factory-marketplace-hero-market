/**
 * Merge guided intake snapshot + pipeline artifacts into a single Paste Notes string for campaign generation.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { BentleyWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow";

type NotesInput = { snapshot: BentleySnapshot } & BentleyWorkflowArtifacts;

function section(title: string, body: string): string {
  const b = body.trim();
  if (!b) return "";
  return `## ${title}\n\n${b}`;
}

function bullets(label: string, items: string[] | undefined, cap = 24): string {
  if (!items?.length) return "";
  const lines = items.slice(0, cap).map((x) => `- ${String(x).trim()}`).filter(Boolean);
  if (!lines.length) return "";
  return `${label}\n${lines.join("\n")}`;
}

export function buildBentleyNotesPayload(input: NotesInput): string {
  const snap = input.snapshot;
  const parts: string[] = [];

  const baseNotes = (snap.campaignNotes ?? "").trim();
  if (baseNotes) {
    parts.push(section("Operator notes (from AI Revenue OS)", baseNotes));
  }

  const r = input.research;
  if (r) {
    const chunks: string[] = [];
    if (r.marketOrService?.trim()) chunks.push(`**Market / service:** ${r.marketOrService.trim()}`);
    chunks.push(bullets("**What people want**", r.whatPeopleWant));
    chunks.push(bullets("**Marketing tips**", r.marketingTips));
    if (r.commentsBySource?.length) {
      for (const c of r.commentsBySource.slice(0, 8)) {
        const themes = (c.themes ?? []).slice(0, 6).join("; ");
        chunks.push(`**${c.source}** — themes: ${themes || "—"}`);
      }
    }
    const block = chunks.filter(Boolean).join("\n\n");
    if (block) parts.push(section("Research", block));
  }

  const t = input.trends;
  if (t?.items?.length) {
    const lines = t.items.slice(0, 20).map((it, i) => {
      const sum = (it.summary ?? it.whyTrending ?? "").trim();
      const one = sum.length > 220 ? `${sum.slice(0, 220)}…` : sum;
      return `${i + 1}. [${it.platform ?? "?"}] ${(it.title ?? "").trim()}${one ? ` — ${one}` : ""}`;
    });
    let block = lines.join("\n");
    if (t.campaignAngles?.length) {
      block += `\n\n**Campaign angles:**\n${t.campaignAngles
        .slice(0, 16)
        .map((a) => `- ${String(a).trim()}`)
        .join("\n")}`;
    }
    parts.push(section("Trending content", block));
  }

  const syn = input.synthesis;
  if (syn?.consultantPlan?.trim() || syn?.campaignBrief?.trim()) {
    const block = [syn.consultantPlan?.trim(), syn.campaignBrief?.trim()].filter(Boolean).join("\n\n");
    if (block) parts.push(section("Synthesis / plan", block));
  }

  const ms = input.marketSweep;
  if (ms) {
    const chunks: string[] = [];
    chunks.push(bullets("**Trending topics**", ms.trendingTopics));
    chunks.push(bullets("**Viral hooks**", ms.viralHooks));
    chunks.push(bullets("**Pain points**", ms.painPoints));
    chunks.push(bullets("**Buying signals**", ms.buyingSignals));
    if (ms.realSignalsSummary?.trim()) chunks.push(ms.realSignalsSummary.trim());
    if (ms.nextAction?.action) {
      chunks.push(`**Next action:** ${ms.nextAction.action} — ${ms.nextAction.reason}`);
    }
    const block = chunks.filter(Boolean).join("\n\n");
    if (block) parts.push(section("Market intelligence sweep", block));
  }

  const ce = input.contentEngine;
  if (ce) {
    const cap = ce.fullPost?.caption?.trim();
    const hooks = (ce.hooks ?? []).slice(0, 16).map((h) => `- ${String(h).trim()}`);
    const chunks: string[] = [];
    if (cap) chunks.push(`**Draft caption:**\n${cap}`);
    if (hooks.length) chunks.push(`**Hooks:**\n${hooks.join("\n")}`);
    const block = chunks.join("\n\n");
    if (block) parts.push(section("Content engine", block));
  }

  return parts.filter(Boolean).join("\n\n").trim();
}
