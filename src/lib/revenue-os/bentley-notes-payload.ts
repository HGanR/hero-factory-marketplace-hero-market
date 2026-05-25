/**
 * Merge guided intake snapshot + pipeline artifacts into a single Paste Notes string for campaign generation.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { BentleyWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

type NotesInput = { snapshot: BentleySnapshot } & BentleyWorkflowArtifacts;

function section(title: string, body: unknown): string {
  const b = coerceTrimmedString(body);
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

  const baseNotes = coerceTrimmedString(snap.campaignNotes);
  if (baseNotes) {
    parts.push(section("Operator notes (from AI Revenue OS)", baseNotes));
  }

  const r = input.research;
  if (r) {
    const chunks: string[] = [];
    const marketOrService = coerceTrimmedString(r.marketOrService);
    if (marketOrService) chunks.push(`**Market / service:** ${marketOrService}`);
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
      const sum = coerceTrimmedString(it.summary ?? it.whyTrending);
      const one = sum.length > 220 ? `${sum.slice(0, 220)}…` : sum;
      const title = coerceTrimmedString(it.title);
      return `${i + 1}. [${it.platform ?? "?"}] ${title}${one ? ` — ${one}` : ""}`;
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
  const consultantPlan = coerceTrimmedString(syn?.consultantPlan);
  const campaignBrief = coerceTrimmedString(syn?.campaignBrief);
  if (consultantPlan || campaignBrief) {
    const block = [consultantPlan, campaignBrief].filter(Boolean).join("\n\n");
    if (block) parts.push(section("Synthesis / plan", block));
  }

  const ms = input.marketSweep;
  if (ms) {
    const chunks: string[] = [];
    chunks.push(bullets("**Trending topics**", ms.trendingTopics));
    chunks.push(bullets("**Viral hooks**", ms.viralHooks));
    chunks.push(bullets("**Pain points**", ms.painPoints));
    chunks.push(bullets("**Buying signals**", ms.buyingSignals));
    const realSignalsSummary = coerceTrimmedString(ms.realSignalsSummary);
    if (realSignalsSummary) chunks.push(realSignalsSummary);
    if (ms.nextAction?.action) {
      chunks.push(`**Next action:** ${ms.nextAction.action} — ${ms.nextAction.reason}`);
    }
    const block = chunks.filter(Boolean).join("\n\n");
    if (block) parts.push(section("Market intelligence sweep", block));
  }

  const ce = input.contentEngine;
  if (ce) {
    const cap = coerceTrimmedString(ce.fullPost?.caption);
    const hooks = (ce.hooks ?? []).slice(0, 16).map((h) => `- ${String(h).trim()}`);
    const chunks: string[] = [];
    if (cap) chunks.push(`**Draft caption:**\n${cap}`);
    if (hooks.length) chunks.push(`**Hooks:**\n${hooks.join("\n")}`);
    const block = chunks.join("\n\n");
    if (block) parts.push(section("Content engine", block));
  }

  return parts.filter(Boolean).join("\n\n").trim();
}
