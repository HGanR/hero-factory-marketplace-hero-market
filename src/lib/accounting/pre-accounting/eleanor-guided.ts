import type { EleanorAccountingStage, FilerEntityType, PreAccountingProfile } from "./types";
import type { PreAccountingWorkspaceResponse } from "./api-client";
import {
  loadEleanorAccountingSession,
  loadPreAccountingProfile,
  readTransactionSnapshotFromLocalStorage,
  saveEleanorAccountingSession,
  savePreAccountingProfile,
} from "./profile-storage";
import { buildMissingDocumentsList } from "./compute-readiness";
import { computeTaxFormCandidates } from "./tax-form-candidates";

/** Optional server workspace — Eleanor stays rule-based but reflects stored state when provided. */
export type EleanorServerContext = {
  serverWorkspace: PreAccountingWorkspaceResponse | null;
};

type ReadinessRow = {
  bookkeepingScore?: number;
  handoffPercent?: number;
  missingDocumentsJson?: string | null;
  quarterReadinessJson?: string | null;
  unresolvedItemsCount?: number;
};

function parseReadinessRow(raw: unknown): ReadinessRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    bookkeepingScore: typeof o.bookkeepingScore === "number" ? o.bookkeepingScore : undefined,
    handoffPercent: typeof o.handoffPercent === "number" ? o.handoffPercent : undefined,
    missingDocumentsJson: typeof o.missingDocumentsJson === "string" ? o.missingDocumentsJson : null,
    quarterReadinessJson: typeof o.quarterReadinessJson === "string" ? o.quarterReadinessJson : null,
    unresolvedItemsCount: typeof o.unresolvedItemsCount === "number" ? o.unresolvedItemsCount : undefined,
  };
}

function serverMissingDocLines(ctx: EleanorServerContext | null | undefined): string[] {
  const snap = parseReadinessRow(ctx?.serverWorkspace?.readinessSnapshot ?? null);
  if (!snap?.missingDocumentsJson) return [];
  try {
    const j = JSON.parse(snap.missingDocumentsJson) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function serverQuarterGaps(ctx: EleanorServerContext | null | undefined): string[] {
  const snap = parseReadinessRow(ctx?.serverWorkspace?.readinessSnapshot ?? null);
  if (!snap?.quarterReadinessJson) return [];
  try {
    const q = JSON.parse(snap.quarterReadinessJson) as Record<string, string>;
    const gaps: string[] = [];
    for (const label of ["Q1", "Q2", "Q3", "Q4"]) {
      const v = q[label];
      if (v && v !== "ready") gaps.push(`${label}: ${v.replace(/_/g, " ")}`);
    }
    return gaps;
  } catch {
    return [];
  }
}

function serverDocumentGaps(ctx: EleanorServerContext | null | undefined): string[] {
  const docs = ctx?.serverWorkspace?.documents;
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((d: { status?: string }) => d.status === "missing")
    .map((d: { documentName?: string }) => (typeof d.documentName === "string" ? d.documentName : "Unnamed"))
    .slice(0, 12);
}

function latestHandoffSummary(ctx: EleanorServerContext | null | undefined): string | null {
  const handoffs = ctx?.serverWorkspace?.handoffs;
  if (!Array.isArray(handoffs) || handoffs.length === 0) return null;
  const h = handoffs[0] as Record<string, unknown>;
  const name = typeof h.packetName === "string" ? h.packetName : "Handoff packet";
  const status = typeof h.packetStatus === "string" ? h.packetStatus : "unknown";
  const exported =
    typeof h.exportedFileUrl === "string" && h.exportedFileUrl
      ? "A ZIP bundle was generated — download from **Handoff Packet**."
      : "No exported bundle yet — generate a server packet from **Handoff Packet**.";
  return `**Latest server packet:** ${name} · status **${status.replace(/_/g, " ")}**. ${exported}`;
}

function serverFormSummary(ctx: EleanorServerContext | null | undefined): { lines: string[]; count: number } {
  const rows = ctx?.serverWorkspace?.formCandidates;
  if (!Array.isArray(rows) || rows.length === 0) return { lines: [], count: 0 };
  const lines = rows.slice(0, 6).map((r: Record<string, unknown>) => {
    const name = typeof r.displayName === "string" ? r.displayName : String(r.formCode ?? "Form");
    const why = typeof r.rationale === "string" ? r.rationale.split("\n")[0]?.slice(0, 160) : "";
    const st = typeof r.status === "string" ? r.status : "";
    return `**${name}**${st ? ` (${st})` : ""}${why ? ` — ${why}` : ""}`;
  });
  return { lines, count: rows.length };
}

function serverUploadedDocNames(ctx: EleanorServerContext | null | undefined): string[] {
  const docs = ctx?.serverWorkspace?.documents;
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((d: { status?: string }) => d.status !== "missing")
    .map((d: { documentName?: string }) => (typeof d.documentName === "string" ? d.documentName : "Document"))
    .slice(0, 12);
}

function serverOpenBlockerTitles(ctx: EleanorServerContext | null | undefined): string[] {
  const items = ctx?.serverWorkspace?.reviewItems;
  if (!Array.isArray(items)) return [];
  return items
    .filter((r: Record<string, unknown>) => {
      const sev = r.severity;
      const st = r.status;
      return sev === "blocker" && (st === "open" || st === "in_progress");
    })
    .map((r: Record<string, unknown>) => String(r.title ?? "Review item"));
}

function serverWaitingOnClientTitles(ctx: EleanorServerContext | null | undefined): string[] {
  const items = ctx?.serverWorkspace?.reviewItems;
  if (!Array.isArray(items)) return [];
  return items
    .filter((r: Record<string, unknown>) => r.status === "waiting_on_client")
    .map((r: Record<string, unknown>) => String(r.title ?? "Item"));
}

function serverReviewerResolvableTitles(ctx: EleanorServerContext | null | undefined): string[] {
  const items = ctx?.serverWorkspace?.reviewItems;
  if (!Array.isArray(items)) return [];
  return items
    .filter((r: Record<string, unknown>) => {
      const role = r.assignedRole;
      const st = r.status;
      return (role === "reviewer" || role === "preparer" || role === "admin") && (st === "open" || st === "in_progress");
    })
    .map((r: Record<string, unknown>) => String(r.title ?? "Item"));
}

function handoffNotReadyWhy(ctx: EleanorServerContext | null | undefined): string | null {
  const gate = ctx?.serverWorkspace?.readinessGate as { passed?: boolean; blockers?: string[] } | undefined;
  if (!gate || gate.passed) return null;
  const b = gate.blockers ?? [];
  if (!b.length) return "Readiness checks have not passed yet — see Review queue and Overview.";
  return b.join(" ");
}

function formMissingSupportLines(ctx: EleanorServerContext | null | undefined): string[] {
  const forms = ctx?.serverWorkspace?.formCandidates;
  if (!Array.isArray(forms)) return [];
  const out: string[] = [];
  for (const row of forms.slice(0, 8) as Record<string, unknown>[]) {
    const name = typeof row.displayName === "string" ? row.displayName : String(row.formCode ?? "Form");
    const raw = row.missingSupportJson;
    let missing: string[] = [];
    if (typeof raw === "string") {
      try {
        const j = JSON.parse(raw) as unknown;
        if (Array.isArray(j)) missing = j.filter((x): x is string => typeof x === "string");
      } catch {
        /* ignore */
      }
    }
    if (missing.length) out.push(`${name}: need ${missing.slice(0, 3).join("; ")}`);
  }
  return out;
}

function nextBestActions(
  ctx: EleanorServerContext | null | undefined,
  snap: { uncategorizedCount: number }
): string[] {
  const actions: string[] = [];
  const blockers = serverOpenBlockerTitles(ctx);
  if (blockers.length) {
    actions.push(`Resolve or waive **${blockers.length}** open blocker(s): ${blockers[0]}`);
  }
  const waitClient = serverWaitingOnClientTitles(ctx);
  if (waitClient.length) {
    actions.push(`Waiting on client for: ${waitClient[0]}`);
  }
  const internal = serverReviewerResolvableTitles(ctx);
  if (internal.length && !blockers.length) {
    actions.push(`Internal follow-up: ${internal[0]}`);
  }
  if (snap.uncategorizedCount > 0) {
    actions.push(`Triage **${snap.uncategorizedCount}** uncategorized ledger item(s) (Ledger tab).`);
  }
  const qgaps = serverQuarterGaps(ctx);
  if (qgaps.length) actions.push(`Quarter workflow: ${qgaps[0]}`);
  const missing = serverMissingDocLines(ctx);
  if (missing.length) actions.push(`Checklist gap: ${missing[0]}`);
  const fm = formMissingSupportLines(ctx);
  if (fm.length) actions.push(`Form support: ${fm[0]}`);
  if (actions.length === 0) actions.push("Review **Review queue**, then generate a **handoff packet** for your preparer.");
  return actions.slice(0, 5);
}

const DISCLAIMER =
  "**This workspace prepares records for review.** Filing positions and submissions must be confirmed by a **licensed tax professional**. I am not your CPA, EA, or attorney unless separately engaged.";

function nextStage(s: EleanorAccountingStage): EleanorAccountingStage {
  const order: EleanorAccountingStage[] = [
    "identify_filer",
    "bookkeeping_basis",
    "business_facts",
    "request_records",
    "ledger_review",
    "forms_checklist",
    "packet_handoff",
  ];
  const i = order.indexOf(s);
  return i >= 0 && i < order.length - 1 ? order[i + 1]! : "packet_handoff";
}

function formatList(lines: string[]): string {
  return lines.map((l) => `• ${l}`).join("\n");
}

function parseEntityType(text: string): FilerEntityType | null {
  const t = text.toLowerCase();
  if (/\bindividual\b|\b1040 only\b/.test(t)) return "individual";
  if (/schedule\s*c|sole\s*prop|sole proprietor/.test(t)) return "sole_prop_schedule_c";
  if (/single[\s-]?member|\bsmllc\b/.test(t)) return "single_member_llc";
  if (/partner/.test(t)) return "partnership";
  if (/\bs[\s-]?corp\b|1120s/.test(t)) return "s_corp";
  if (/\bc[\s-]?corp\b|1120\b/.test(t)) return "c_corp";
  if (/trust|estate/.test(t)) return "trust_estate";
  if (/non[\s-]?profit|501/.test(t)) return "nonprofit";
  return null;
}

function parseYear(text: string): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  if (y < 2000 || y > 2100) return null;
  return y;
}

function parseYesNo(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (/^(y|yes|true|1|have|do)\b/.test(t)) return true;
  if (/^(n|no|false|0|none|don't|do not)\b/.test(t)) return false;
  return null;
}

export function buildEleanorAccountingPostGreeting(ctx?: EleanorServerContext | null): string | undefined {
  const profile = loadPreAccountingProfile();
  const snap = readTransactionSnapshotFromLocalStorage();
  const missingLocal = buildMissingDocumentsList(profile);
  const missingServer = serverMissingDocLines(ctx);
  const missing = missingServer.length ? missingServer : missingLocal;
  const rs = parseReadinessRow(ctx?.serverWorkspace?.readinessSnapshot ?? null);
  const lines: string[] = [
    `**Context:** Tax year **${profile.taxYear}**, entity profile **${profile.filerEntityType.replace(/_/g, " ")}**.`,
    `**Ledger snapshot (local):** ${snap.totalTransactions} transactions (${snap.uncategorizedCount} may need categorization).`,
  ];
  if (rs?.bookkeepingScore != null && rs?.handoffPercent != null) {
    lines.push(
      `**Server readiness (last sync):** bookkeeping **${rs.bookkeepingScore}%** · handoff **${rs.handoffPercent}%**${rs.unresolvedItemsCount != null ? ` · unresolved items **${rs.unresolvedItemsCount}**` : ""}.`
    );
  }
  if (missing.length) {
    lines.push(
      `**${missingServer.length ? "Stored" : "Heuristic"} gaps — documents / tags:**\n${formatList(missing.slice(0, 6))}`
    );
  }
  const qgaps = serverQuarterGaps(ctx);
  if (qgaps.length) {
    lines.push(`**Quarter status (server):**\n${formatList(qgaps)}`);
  }
  const handoffLine = latestHandoffSummary(ctx);
  if (handoffLine) lines.push(handoffLine);
  const uploaded = serverUploadedDocNames(ctx);
  if (uploaded.length) {
    lines.push(`**Uploaded documents on server (sample):** ${uploaded.slice(0, 6).join(", ")}`);
  }
  const nba = nextBestActions(ctx, snap);
  lines.push(`**Suggested next steps:**\n${formatList(nba)}`);
  lines.push(DISCLAIMER);
  return lines.join("\n\n");
}

export async function handleEleanorAccountingMessage(
  message: string,
  ctx?: EleanorServerContext | null
): Promise<{ reply: string }> {
  const profile = loadPreAccountingProfile();
  const session = loadEleanorAccountingSession();
  const snap = readTransactionSnapshotFromLocalStorage();
  const lower = message.toLowerCase().trim();

  if (/\bnext step|what next|best action|recommended|priority\b/.test(lower)) {
    const names = serverUploadedDocNames(ctx);
    const missingForm = formMissingSupportLines(ctx);
    const actions = nextBestActions(ctx, snap);
    const why = handoffNotReadyWhy(ctx);
    return {
      reply: [
        "**Suggested next steps** (rule-based, not tax advice):",
        "",
        formatList(actions),
        why ? `\n**Handoff gate:** ${why}` : "",
        names.length ? `\n**Server uploads (sample):** ${names.join(", ")}` : "",
        missingForm.length ? `\n**Form support gaps:**\n${formatList(missingForm.slice(0, 5))}` : "",
        "",
        DISCLAIMER,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (/\bnot ready|why not handoff|handoff ready|blockers?\b/.test(lower)) {
    const why = handoffNotReadyWhy(ctx);
    const blockers = serverOpenBlockerTitles(ctx);
    const wait = serverWaitingOnClientTitles(ctx);
    return {
      reply: [
        "**Handoff readiness (operational — not a filing determination)**",
        "",
        why
          ? `**Why not ready:** ${why}`
          : "**Gate:** No blocking items flagged from current server snapshot — still confirm with your preparer.",
        blockers.length ? `\n**Open blockers:**\n${formatList(blockers.slice(0, 8))}` : "",
        wait.length ? `\n**Waiting on client:**\n${formatList(wait.slice(0, 8))}` : "",
        "",
        "Resolve items in **Review queue**, complete **quarter closeout**, and clear **form support** gaps where applicable.",
        "",
        DISCLAIMER,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (/\bhelp\b|what can you do|intake|checklist|stage\b/.test(lower)) {
    return {
      reply: [
        "I help you **organize records** and **prepare a file** for a licensed tax preparer or CPA — not final tax determinations.",
        "",
        "**Try:** “Set entity to S-corp”, “Tax year 2025”, “Cash basis”, “Missing documents”, “Quarterly Q2”, “Handoff summary”, “Probable forms”, “What next”.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  if (/\bhandoff|export|packet|summary for preparer\b/.test(lower)) {
    saveEleanorAccountingSession({ stage: "packet_handoff", lastReplyAt: new Date().toISOString() });
    const missingLocal = buildMissingDocumentsList(profile);
    const missingSrv = serverMissingDocLines(ctx);
    const docGaps = serverDocumentGaps(ctx);
    const missing = [...new Set([...missingSrv, ...missingLocal, ...docGaps])];
    const forms = computeTaxFormCandidates(profile, snap);
    const srvForms = serverFormSummary(ctx);
    const handoffExtra = latestHandoffSummary(ctx);
    return {
      reply: [
        "**Professional handoff — draft checklist (not a completed return package)**",
        "",
        `• Filer / entity: **${profile.filerEntityType.replace(/_/g, " ")}** · Year **${profile.taxYear}** · Basis: **${profile.accountingBasis}**`,
        `• Transactions in workspace: **${snap.totalTransactions}** · Items to review: **${snap.uncategorizedCount}**`,
        srvForms.count > 0
          ? `• **Server-stored** probable forms: **${srvForms.count}** — top items:\n${formatList(srvForms.lines)}`
          : `• Probable forms (local heuristic): **${forms.length}** — see **Potential IRS Forms**`,
        missing.length
          ? `• Missing / gaps (server + checklist):\n${formatList(missing.slice(0, 10))}`
          : "• Core document tags look covered — **your preparer may still request more**.",
        handoffExtra ? `• ${handoffExtra}` : "",
        "",
        "Use **Handoff Packet** to **generate a server ZIP** (JSON + summary + uploaded files) or download local JSON/text. **Confirm with your licensed tax professional.**",
        "",
        DISCLAIMER,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (/\bmissing doc|documents?\b/.test(lower)) {
    const missingLocal = buildMissingDocumentsList(profile);
    const missingSrv = serverMissingDocLines(ctx);
    const docGaps = serverDocumentGaps(ctx);
    const combined = [...new Set([...missingSrv, ...missingLocal, ...docGaps])];
    return {
      reply: [
        "**Documents a preparer commonly wants** (you may need additional items):",
        "",
        combined.length ? formatList(combined) : "You’ve tagged several core categories — still confirm completeness with your preparer.",
        "",
        "Upload files under **Documents** (server-backed when signed in). Pull quarterly statements when possible.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  if (/\bquarter|q1|q2|q3|q4|estimated\b/.test(lower)) {
    saveEleanorAccountingSession({ stage: "request_records", lastReplyAt: new Date().toISOString() });
    const qgaps = serverQuarterGaps(ctx);
    return {
      reply: [
        "**Quarterly workflow** — for each period, your preparer may want bank/card statements, processor summaries, payroll reports, and major receipts.",
        "",
        qgaps.length
          ? `**From your saved workspace:**\n${formatList(qgaps)}`
          : "Example: *“Your Q2 records are almost ready. Please upload statements for April through June so your preparer receives a complete quarter packet.”*",
        "",
        "Mark progress under **Quarterly Packets** — data syncs to the server when you’re signed in.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  const entity = parseEntityType(message);
  if (entity) {
    const next = { ...profile, filerEntityType: entity };
    savePreAccountingProfile(next);
    saveEleanorAccountingSession({ stage: nextStage(session.stage), lastReplyAt: new Date().toISOString() });
    return {
      reply: [
        `I’ve set your **entity / filer type** toward **${entity.replace(/_/g, " ")}**. A tax preparer will **confirm** classification and forms.`,
        "",
        "If this is correct, tell me your **tax year** (e.g. “2025”) and whether books are **cash** or **accrual**.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  const year = parseYear(message);
  if (year) {
    savePreAccountingProfile({ ...profile, taxYear: year });
    saveEleanorAccountingSession({ stage: nextStage(session.stage), lastReplyAt: new Date().toISOString() });
    return {
      reply: [
        `Tax year noted as **${year}**. **You may need** prior-year returns and quarterly statements for comparison — upload what you have.`,
        "",
        "Next: say **cash** or **accrual** (or “unknown”) for bookkeeping basis.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  if (/cash basis|accrual|accrual basis/.test(lower) || /^cash$|^accrual$|^unknown$/.test(lower.trim())) {
    const basis =
      /^cash$|cash basis/.test(lower.trim()) || lower.includes("cash")
        ? "cash"
        : /^accrual$|accrual basis/.test(lower.trim()) || lower.includes("accrual")
          ? "accrual"
          : "unknown";
    savePreAccountingProfile({ ...profile, accountingBasis: basis });
    saveEleanorAccountingSession({ stage: "business_facts", lastReplyAt: new Date().toISOString() });
    return {
      reply: [
        `Bookkeeping basis recorded as **${basis}**. **Your preparer** will confirm whether books match return presentation.`,
        "",
        "Quick facts — reply **yes/no** to each: **employees?** **contractors?** **payroll service?** **loans?** **mileage?** **home office?**",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  const yn = parseYesNo(message);
  if (yn !== null && /employee|contractor|payroll|loan|mileage|home office|inventory|processor|bank|card|quarterly estimate|prior year|1099|w-2/i.test(message)) {
    const p = { ...profile };
    if (/employee/i.test(message)) p.hasEmployees = yn;
    if (/contractor/i.test(message)) p.hasContractors = yn;
    if (/payroll service|payroll\b/i.test(message)) p.hasPayrollService = yn;
    if (/loan/i.test(message)) p.hasLoans = yn;
    if (/mileage|vehicle/i.test(message)) p.tracksMileage = yn;
    if (/home office/i.test(message)) p.hasHomeOffice = yn;
    if (/inventory/i.test(message)) p.hasInventory = yn;
    if (/bank/i.test(message)) p.hasBankAccounts = yn;
    if (/credit card|card statement/i.test(message)) p.hasCreditCards = yn;
    if (/processor|stripe|square|paypal/i.test(message)) p.hasPaymentProcessors = yn;
    if (/quarterly estimate|estimated tax/i.test(message)) p.filedQuarterlyEstimates = yn;
    if (/payroll return|941|940/i.test(message)) p.filedPayrollReturns = yn;
    if (/prior year|last year return/i.test(message)) p.priorYearReturnAvailable = yn;
    savePreAccountingProfile(p);
    saveEleanorAccountingSession({ stage: "request_records", lastReplyAt: new Date().toISOString() });
    return {
      reply: [
        "Thanks — I’ve updated your **intake facts** (local workspace only). **A licensed preparer** validates what belongs on the return.",
        "",
        "**You may need:** monthly or quarterly statements, W-2/1099/K-1, payroll reports, loan statements, asset purchase docs, and depreciation records where applicable.",
        "",
        "Open **Documents** and **Quarterly Packets** to attach and label files.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  if (/\bforms?\b|schedule|1040|1120|1099|k-1|941\b/.test(lower)) {
    saveEleanorAccountingSession({ stage: "forms_checklist", lastReplyAt: new Date().toISOString() });
    const srv = serverFormSummary(ctx);
    if (srv.count > 0) {
      return {
        reply: [
          "**Potential forms / schedules** (server snapshot — **not** a filing determination):",
          "",
          formatList(srv.lines),
          srv.count > 6 ? `\n… and **${srv.count - 6}** more in **Potential IRS Forms**.` : "",
          "",
          DISCLAIMER,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    const forms = computeTaxFormCandidates(profile, snap);
    const top = forms.slice(0, 6);
    return {
      reply: [
        "**Potential forms / schedules** (local heuristic — **not** a determination):",
        "",
        top.length
          ? formatList(top.map((f) => `**${f.name}** — ${f.whyMayApply}`))
          : "Add entity type and ledger activity, then revisit this list with your preparer.",
        "",
        "See the **Potential IRS Forms** tab after your workspace syncs to the server.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  if (/\bledger|categor|uncategor|transaction\b/.test(lower)) {
    saveEleanorAccountingSession({ stage: "ledger_review", lastReplyAt: new Date().toISOString() });
    return {
      reply: [
        "**Ledger review** — before handoff, a preparer commonly wants:",
        `• Uncategorized or “needs review” items minimized (you have **${snap.uncategorizedCount}** flagged heuristically).`,
        "• Business vs personal separation, splits, and receipt/statement links where material.",
        "",
        "Use the **Ledger** tab for categorization, imports, and attachments.",
        "",
        DISCLAIMER,
      ].join("\n"),
    };
  }

  return {
    reply: [
      "I’ve reviewed what you shared in general terms. **This platform organizes records**; it does not decide final tax outcomes.",
      "",
      `**Tip:** Tell me your **entity type**, **tax year**, and **cash vs accrual**, or ask for **missing documents**, **quarterly**, **probable forms**, or **handoff**.`,
      "",
      DISCLAIMER,
    ].join("\n"),
  };
}
