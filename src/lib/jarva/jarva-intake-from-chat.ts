import { z } from "zod";
import { invokeNpcLlm } from "@/lib/npc/llm";
import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import { JarvaPartyIntakeSchema } from "@/lib/jarva/trust-intake-schema";
import { computeJarvaIntakeCompletenessPercent } from "@/lib/jarva/jarva-readiness";

const firmShape = z.object({
  name: z.string().max(500).optional(),
  address: z.string().max(2000).optional(),
  phone: z.string().max(80).optional(),
  email: z.string().max(320).optional(),
});

/** @deprecated Import from jarva-readiness */
export const jarvaIntakeCompletenessPercent = computeJarvaIntakeCompletenessPercent;

export type JarvaChatExtractionResult = {
  intakePatch: Partial<JarvaTrustIntake>;
  confidence: Record<string, "high" | "medium" | "low">;
  notes: string[];
  followUps: string[];
  /** Dot-path keys for lineage (e.g. grantor.name, governingState) */
  fieldKeys: string[];
};

function strip(s: string) {
  return s.replace(/^\s*[*\-•]\s*/, "").trim();
}

function bumpConf(
  confidence: Record<string, "high" | "medium" | "low">,
  key: string,
  level: "high" | "medium" | "low"
) {
  const cur = confidence[key];
  const rank = { high: 3, medium: 2, low: 1 };
  if (!cur || rank[level] > rank[cur]) confidence[key] = level;
}

/** Uppercase 2-letter codes for ambiguity detection (message already uppercased in matcher). */
const US_STATE_CODES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC"
    .split(/\s+/)
);

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
/** US-centric phone; captures common formats */
const PHONE_RE = /(\+?1[-.\s])?(\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}|\d{3}[-.\s]\d{4}[-.\s]\d{4})/;

function assignEmailToParty(
  line: string,
  email: string,
  partial: Partial<JarvaTrustIntake>,
  confidence: Record<string, "high" | "medium" | "low">,
  fieldKeys: string[],
  key: "grantor" | "trustee" | "firm"
) {
  const lower = line.toLowerCase();
  if (key === "grantor" && /\bgrantor\b|\bsettlor\b/i.test(lower)) {
    partial.grantor = { ...(partial.grantor ?? {}), email };
    bumpConf(confidence, "grantor.email", "high");
    if (!fieldKeys.includes("grantor.email")) fieldKeys.push("grantor.email");
    return true;
  }
  if (key === "trustee" && /\btrustee\b/i.test(lower)) {
    partial.trustee = { ...(partial.trustee ?? {}), email };
    bumpConf(confidence, "trustee.email", "high");
    if (!fieldKeys.includes("trustee.email")) fieldKeys.push("trustee.email");
    return true;
  }
  if (key === "firm" && /\bfirm\b|\boffice\b|\bconsultant\b/i.test(lower)) {
    partial.firm = { ...(partial.firm ?? {}), email };
    bumpConf(confidence, "firm.email", "high");
    if (!fieldKeys.includes("firm.email")) fieldKeys.push("firm.email");
    return true;
  }
  return false;
}

/**
 * Deterministic extraction from the latest user message (labeled lines + heuristics).
 * Does not fabricate: only fills fields supported by the text.
 */
export function runDeterministicJarvaExtraction(message: string): JarvaChatExtractionResult {
  const confidence: Record<string, "high" | "medium" | "low"> = {};
  const notes: string[] = [];
  const followUps: string[] = [];
  const fieldKeys: string[] = [];
  const partial: Partial<JarvaTrustIntake> = {};
  const lines = message
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tryLine = (re: RegExp, fn: (v: string) => void, confKey: string, level: "high" | "medium" = "high") => {
    for (const line of lines) {
      const m = line.match(re);
      if (m?.[1]) {
        fn(strip(m[1]));
        bumpConf(confidence, confKey, level);
        if (!fieldKeys.includes(confKey)) fieldKeys.push(confKey);
        return true;
      }
    }
    return false;
  };

  tryLine(/^(?:matter|engagement|matter\s*label)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.matterLabel = v;
  }, "matterLabel");

  tryLine(/^(?:trust\s*name|name\s*of\s*trust)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.trustName = v;
  }, "trustName");

  tryLine(/^(?:governing\s*state|situs|state\s*code|jurisdiction)\s*[:#\-]\s*([A-Za-z]{2,4})\b/i, (v) => {
    partial.governingState = v.toUpperCase().slice(0, 4);
  }, "governingState");

  tryLine(/^(?:grantor|settlor)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.grantor = { ...(partial.grantor ?? {}), name: v };
  }, "grantor.name");

  tryLine(/^trustee\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.trustee = { ...(partial.trustee ?? {}), name: v };
  }, "trustee.name");

  tryLine(/^(?:trust\s*type|type)\s*[:#\-]\s*(.+)$/i, (v) => {
    const t = v.trim();
    partial.objectives = partial.objectives
      ? `${partial.objectives}\n\nTrust type (from chat): ${t}`
      : `Trust type (from chat): ${t}`;
  }, "objectives");

  tryLine(/^(?:objectives?|goals|purpose)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.objectives = v;
  }, "objectives");

  tryLine(/^(?:beneficiar(?:y|ies))\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.beneficiariesSummary = v;
  }, "beneficiariesSummary");

  tryLine(/^(?:successor\s*trustee|backup\s*trustee)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.successorTrusteeNote = v;
  }, "successorTrusteeNote");

  tryLine(/^(?:spiritual|ecclesiastical)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.spiritualOrEcclesiasticalNotes = v.slice(0, 20000);
  }, "spiritualOrEcclesiasticalNotes");

  tryLine(/^(?:securities|capital|ppm)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.securitiesIntentNotes = v.slice(0, 10000);
  }, "securitiesIntentNotes");

  tryLine(/^(?:firm|consultant\s*firm)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.firm = { ...(partial.firm ?? {}), name: v };
  }, "firm.name");

  tryLine(/^grantor\s+state\s*[:#\-]\s*([A-Za-z]{2,4})\b/i, (v) => {
    partial.grantor = { ...(partial.grantor ?? {}), state: v.toUpperCase().slice(0, 40) };
  }, "grantor.state");

  tryLine(/^(?:street|address|address\s*line\s*1)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.grantor = { ...(partial.grantor ?? {}), addressLine1: v };
  }, "grantor.addressLine1");

  tryLine(/^city\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.grantor = { ...(partial.grantor ?? {}), city: v };
  }, "grantor.city");

  tryLine(/^(?:zip|postal(?:\s*code)?)\s*[:#\-]\s*(.+)$/i, (v) => {
    partial.grantor = { ...(partial.grantor ?? {}), postalCode: v.trim() };
  }, "grantor.postalCode");

  if (/\bpour[-\s]?over\b/i.test(message) && /\bwill\b/i.test(message)) {
    partial.pourOverWillNeeded = true;
    bumpConf(confidence, "pourOverWillNeeded", "medium");
    if (!fieldKeys.includes("pourOverWillNeeded")) fieldKeys.push("pourOverWillNeeded");
  }

  // Labeled email / phone
  for (const line of lines) {
    const em = line.match(EMAIL_RE);
    if (em?.[0]) {
      const email = em[0];
      if (!assignEmailToParty(line, email, partial, confidence, fieldKeys, "grantor")) {
        if (/\btrustee\b/i.test(line)) assignEmailToParty(line, email, partial, confidence, fieldKeys, "trustee");
        else if (/\bfirm\b|\boffice\b/i.test(line)) assignEmailToParty(line, email, partial, confidence, fieldKeys, "firm");
        else if (!partial.grantor?.email && !partial.trustee?.email) {
          partial.grantor = { ...(partial.grantor ?? {}), email };
          bumpConf(confidence, "grantor.email", "medium");
          if (!fieldKeys.includes("grantor.email")) fieldKeys.push("grantor.email");
          notes.push("Email assigned to grantor by position (confirm if different).");
        }
      }
    }
    const ph = line.match(PHONE_RE);
    if (ph?.[0]) {
      const phone = ph[0].replace(/\s+/g, " ").trim();
      if (/\bgrantor\b|\bsettlor\b/i.test(line)) {
        partial.grantor = { ...(partial.grantor ?? {}), phone };
        bumpConf(confidence, "grantor.phone", "high");
        if (!fieldKeys.includes("grantor.phone")) fieldKeys.push("grantor.phone");
      } else if (/\btrustee\b/i.test(line)) {
        partial.trustee = { ...(partial.trustee ?? {}), phone };
        bumpConf(confidence, "trustee.phone", "high");
        if (!fieldKeys.includes("trustee.phone")) fieldKeys.push("trustee.phone");
      } else if (/\bfirm\b/i.test(line)) {
        partial.firm = { ...(partial.firm ?? {}), phone };
        bumpConf(confidence, "firm.phone", "high");
        if (!fieldKeys.includes("firm.phone")) fieldKeys.push("firm.phone");
      }
    }
  }

  // Inline “X is Y” / “named X”
  if (!partial.grantor?.name) {
    const gm = message.match(/\bgrantor\s+(?:is|named|:)\s+([^.\n]+)/i);
    if (gm?.[1]) {
      partial.grantor = { ...(partial.grantor ?? {}), name: strip(gm[1]) };
      bumpConf(confidence, "grantor.name", "medium");
      if (!fieldKeys.includes("grantor.name")) fieldKeys.push("grantor.name");
    }
  }
  if (!partial.trustee?.name) {
    const tm = message.match(/\btrustee\s+(?:is|named|:)\s+([^.\n]+)/i);
    if (tm?.[1]) {
      partial.trustee = { ...(partial.trustee ?? {}), name: strip(tm[1]) };
      bumpConf(confidence, "trustee.name", "medium");
      if (!fieldKeys.includes("trustee.name")) fieldKeys.push("trustee.name");
    }
  }

  // Trust type keywords → append to objectives (informational)
  const typeHints =
    /\b(revocable|irrevocable|dynasty|grantor\s*retained|grat|crat|crut|slat|qsst|esbt)\b/i.exec(message);
  if (typeHints && !partial.objectives?.includes("Trust type")) {
    const hint = `Intent keywords (from chat): ${typeHints[0]}`;
    partial.objectives = partial.objectives ? `${partial.objectives}\n\n${hint}` : hint;
    bumpConf(confidence, "objectives", "low");
    if (!fieldKeys.includes("objectives")) fieldKeys.push("objectives");
    notes.push("Trust-type keywords captured in objectives; verify with counsel.");
  }

  const assetSchedule =
    /\b(schedule\s*a|asset\s*schedule|personal\s*property|tangible\s*assets)\b/i.test(message);
  if (assetSchedule) {
    notes.push("Asset / schedule language detected — review Assets tab and funding in Smart Trust.");
  }

  if (/\b(506|ppm|private\s*placement)\b/i.test(message) && !partial.securitiesIntentNotes) {
    partial.securitiesIntentNotes = message.slice(0, 10000);
    bumpConf(confidence, "securitiesIntentNotes", "low");
    if (!fieldKeys.includes("securitiesIntentNotes")) fieldKeys.push("securitiesIntentNotes");
    notes.push("Securities-related terms detected; issuance remains subject to counsel and trustee gates.");
  }

  // Multiple beneficiaries with percentages / conditions (draft text block — not legal allocation)
  const pctLines = lines.filter((l) => /\d{1,3}\s*%/.test(l) && /beneficiar|benefit|to\s+\w|class|per\s+stirpes/i.test(l));
  if (pctLines.length >= 1) {
    const block = pctLines.join("\n").slice(0, 20000);
    partial.beneficiariesSummary = partial.beneficiariesSummary
      ? `${partial.beneficiariesSummary}\n\n${block}`
      : block;
    bumpConf(confidence, "beneficiariesSummary", pctLines.length >= 2 ? "medium" : "low");
    if (!fieldKeys.includes("beneficiariesSummary")) fieldKeys.push("beneficiariesSummary");
    notes.push("Percentage / class language captured in beneficiary summary — verify allocations with counsel.");
  }

  // Successor trustees — ordered list (1. / 2. or first/second)
  const succOrdered = lines.filter(
    (l) =>
      /^(?:\d+[\).\]]\s*|(?:first|second|third|fourth|fifth)\s+)/i.test(l.trim()) &&
      /successor|backup|trustee/i.test(l)
  );
  if (succOrdered.length >= 1) {
    const note = succOrdered.join("\n").slice(0, 5000);
    partial.successorTrusteeNote = partial.successorTrusteeNote ? `${partial.successorTrusteeNote}\n\n${note}` : note;
    bumpConf(confidence, "successorTrusteeNote", "medium");
    if (!fieldKeys.includes("successorTrusteeNote")) fieldKeys.push("successorTrusteeNote");
  }

  // Governing state vs other states — ambiguity note only (no fabricated situs)
  const stateCodes = (message.toUpperCase().match(/\b([A-Z]{2})\b/g) || []).filter((s) => US_STATE_CODES.has(s));
  const uniqueStates = [...new Set(stateCodes)];
  if (uniqueStates.length >= 2 && !partial.governingState?.trim()) {
    partial.jurisdictionAmbiguityNote = `Multiple state codes appear (${uniqueStates.join(", ")}). Confirm governing situs vs domicile / tax home with counsel.`.slice(
      0,
      2000
    );
    bumpConf(confidence, "jurisdictionAmbiguityNote", "low");
    if (!fieldKeys.includes("jurisdictionAmbiguityNote")) fieldKeys.push("jurisdictionAmbiguityNote");
    notes.push("Several states referenced — governing state not auto-selected.");
  }

  // Asset / schedule references → draft notes only (not titling)
  if (
    /\b(schedule\s*[ab]|funding\s*schedule|tangible|brokerage|account\s*#|real\s*property|parcel)\b/i.test(message)
  ) {
    const excerpt = message.slice(0, 8000);
    partial.assetScheduleNotesDraft = partial.assetScheduleNotesDraft
      ? `${partial.assetScheduleNotesDraft}\n\n---\n${excerpt}`
      : excerpt.slice(0, 20000);
    bumpConf(confidence, "assetScheduleNotesDraft", "low");
    if (!fieldKeys.includes("assetScheduleNotesDraft")) fieldKeys.push("assetScheduleNotesDraft");
    notes.push("Asset / schedule language stored as draft notes — confirm in Trust Records / Smart Trust asset registry.");
  }

  // Follow-ups
  if (!partial.grantor?.name) followUps.push("Who is the grantor / settlor (full name)?");
  if (!partial.trustee?.name) followUps.push("Who is the initial trustee?");
  if (!partial.governingState?.trim()) followUps.push("What is the governing / situs state (2-letter)?");
  if (partial.grantor?.name && partial.trustee?.name && partial.trustee.name === partial.grantor.name) {
    notes.push("Grantor and trustee names match — confirm if intentional.");
  }

  return { intakePatch: partial, confidence, notes, followUps, fieldKeys };
}

function mergeConfidence(
  a: Record<string, "high" | "medium" | "low">,
  b: Record<string, "high" | "medium" | "low">
) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    bumpConf(out, k, v);
  }
  return out;
}

function mergePatches(a: Partial<JarvaTrustIntake>, b: Partial<JarvaTrustIntake>): Partial<JarvaTrustIntake> {
  const out: Partial<JarvaTrustIntake> = { ...a, ...b };
  if (a.grantor || b.grantor) {
    out.grantor = { ...(a.grantor ?? {}), ...(b.grantor ?? {}) };
  }
  if (a.trustee || b.trustee) {
    out.trustee = { ...(a.trustee ?? {}), ...(b.trustee ?? {}) };
  }
  if (a.firm || b.firm) {
    out.firm = { ...(a.firm ?? {}), ...(b.firm ?? {}) };
  }
  return out;
}

function extractJsonObject(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return null;
}

/** Whitelist LLM output — nested parties use partial party schema (Zod 4–safe). */
function sanitizeLlmIntakePatch(patch: unknown): Partial<JarvaTrustIntake> | null {
  if (!patch || typeof patch !== "object") return null;
  const p = patch as Record<string, unknown>;
  const out: Partial<JarvaTrustIntake> = {};

  const optStr = (k: keyof JarvaTrustIntake, max: number) => {
    const v = p[k as string];
    if (typeof v === "string" && v.trim()) (out as Record<string, unknown>)[k as string] = v.slice(0, max);
  };

  optStr("matterLabel", 500);
  optStr("objectives", 20000);
  optStr("governingState", 10);
  optStr("trustName", 500);
  optStr("successorTrusteeNote", 5000);
  optStr("beneficiariesSummary", 20000);
  optStr("jurisdictionAmbiguityNote", 2000);
  optStr("assetScheduleNotesDraft", 20000);
  optStr("spiritualOrEcclesiasticalNotes", 20000);
  optStr("securitiesIntentNotes", 10000);

  if (typeof p.pourOverWillNeeded === "boolean") out.pourOverWillNeeded = p.pourOverWillNeeded;

  const g = JarvaPartyIntakeSchema.partial().safeParse(p.grantor);
  if (g.success && g.data && Object.keys(g.data).length > 0) {
    out.grantor = g.data as JarvaTrustIntake["grantor"];
  }
  const t = JarvaPartyIntakeSchema.partial().safeParse(p.trustee);
  if (t.success && t.data && Object.keys(t.data).length > 0) {
    out.trustee = t.data as JarvaTrustIntake["trustee"];
  }
  const f = firmShape.partial().safeParse(p.firm);
  if (f.success && f.data && Object.keys(f.data).length > 0) {
    out.firm = f.data as JarvaTrustIntake["firm"];
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * LLM fills gaps only; caller merges with confidence-weighted overlay so high-confidence deterministic wins.
 */
async function tryLlmIntakePatch(message: string, missingHints: string[]): Promise<Partial<JarvaTrustIntake> | null> {
  if (!process.env.NPC_LLM_ENDPOINT?.trim()) return null;
  if (message.length < 25) return null;

  const hintBlock =
    missingHints.length > 0
      ? `\nPrefer extracting ONLY these missing or unclear fields if supported by the text: ${missingHints.join(", ")}.`
      : "";

  const system = `You extract ONLY facts explicitly stated in the consultant's message about a trust engagement.
Return a single JSON object with this shape:
{ "intakePatch": { ... }, "notes": string[] }
Rules:
- intakePatch may only use keys from: matterLabel, objectives, governingState, trustName, grantor, trustee, successorTrusteeNote, beneficiariesSummary, pourOverWillNeeded, jurisdictionAmbiguityNote, assetScheduleNotesDraft, spiritualOrEcclesiasticalNotes, securitiesIntentNotes, firm.
- grantor, trustee, firm are objects with optional: name, email, phone, addressLine1, addressLine2, city, state, postalCode, country.
- Prefer filling gaps / missing fields; do not restate fields already clearly fixed in labeled lines if the text does not add new facts.
- Omit any field not clearly supported by the text.
- Never invent names, jurisdictions, or parties.
- If nothing extractable, use intakePatch: {}.${hintBlock}`;

  const text = await invokeNpcLlm([
    { role: "system", content: system },
    { role: "user", content: `Message:\n${message.slice(0, 12000)}` },
  ]);
  if (!text) return null;

  let parsed: unknown;
  try {
    const jsonStr = extractJsonObject(text);
    if (!jsonStr) return null;
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const patch = (parsed as { intakePatch?: unknown }).intakePatch;
  return sanitizeLlmIntakePatch(patch);
}

/** Use LLM when deterministic is empty, partial, or flagged ambiguous — not only when empty. */
function shouldUseLlmAssistance(det: JarvaChatExtractionResult, message: string): boolean {
  if (!process.env.NPC_LLM_ENDPOINT?.trim()) return false;
  if (message.length < 25) return false;
  if (det.fieldKeys.length === 0) return true;
  if (det.fieldKeys.length < 4 && message.length > 60) return true;
  if (det.notes.some((n) => /\b(confirm|ambiguous|unclear|verify)\b/i.test(n))) return true;
  return false;
}

function missingFieldHints(det: JarvaChatExtractionResult): string[] {
  const have = new Set(det.fieldKeys);
  const want = [
    "grantor.name",
    "trustee.name",
    "governingState",
    "objectives",
    "matterLabel",
    "trustName",
    "beneficiariesSummary",
  ];
  return want.filter((k) => !have.has(k));
}

/** Keep deterministic high-confidence fields; LLM patch fills gaps without overwriting them. */
function applyConfidenceWeightedMerge(det: JarvaChatExtractionResult, llmPatch: Partial<JarvaTrustIntake>): Partial<JarvaTrustIntake> {
  const merged = mergePatches(det.intakePatch, llmPatch);
  const restore = (key: string, fn: () => void) => {
    if (det.confidence[key] === "high") fn();
  };
  restore("matterLabel", () => {
    if (det.intakePatch.matterLabel) merged.matterLabel = det.intakePatch.matterLabel;
  });
  restore("trustName", () => {
    if (det.intakePatch.trustName) merged.trustName = det.intakePatch.trustName;
  });
  restore("objectives", () => {
    if (det.intakePatch.objectives) merged.objectives = det.intakePatch.objectives;
  });
  restore("governingState", () => {
    if (det.intakePatch.governingState) merged.governingState = det.intakePatch.governingState;
  });
  restore("beneficiariesSummary", () => {
    if (det.intakePatch.beneficiariesSummary) merged.beneficiariesSummary = det.intakePatch.beneficiariesSummary;
  });
  restore("grantor.name", () => {
    if (det.intakePatch.grantor?.name) merged.grantor = { ...merged.grantor, name: det.intakePatch.grantor.name };
  });
  restore("trustee.name", () => {
    if (det.intakePatch.trustee?.name) merged.trustee = { ...merged.trustee, name: det.intakePatch.trustee.name };
  });
  for (const sub of ["email", "phone", "state", "addressLine1", "city", "postalCode"] as const) {
    const gk = `grantor.${sub}`;
    restore(gk, () => {
      const v = det.intakePatch.grantor?.[sub];
      if (v) merged.grantor = { ...merged.grantor, [sub]: v };
    });
    const tk = `trustee.${sub}`;
    restore(tk, () => {
      const v = det.intakePatch.trustee?.[sub];
      if (v) merged.trustee = { ...merged.trustee, [sub]: v };
    });
  }
  return merged;
}

export type ExtractJarvaIntakeFromChatParams = {
  message: string;
  /** Recent turns (oldest first) — used for LLM context only */
  recentHistory?: Array<{ role: "user" | "npc"; content: string }>;
  trustId?: string;
  clientId?: string;
  currentIntake?: Partial<JarvaTrustIntake> | null;
  smartTrustDraftSnapshot?: Record<string, unknown> | null;
  /** Default: true when NPC_LLM_ENDPOINT is set */
  enableLlmFallback?: boolean;
};

/**
 * Full extraction: deterministic first, optional LLM JSON patch when configured and coverage is low.
 */
export async function extractJarvaIntakeFromChat(params: ExtractJarvaIntakeFromChatParams): Promise<JarvaChatExtractionResult> {
  const { message, recentHistory, smartTrustDraftSnapshot } = params;
  const det = runDeterministicJarvaExtraction(message);

  if (smartTrustDraftSnapshot) {
    const tn = smartTrustDraftSnapshot.trustName as string | undefined;
    if (tn?.trim() && !det.intakePatch.trustName) {
      det.notes.push("Smart Trust draft already has a working trust name — chat intake will not overwrite unless stated.");
    }
  }

  const llmDefault = Boolean(process.env.NPC_LLM_ENDPOINT?.trim());
  const enableLlm = params.enableLlmFallback !== false && llmDefault;

  let merged = { ...det };
  if (enableLlm && shouldUseLlmAssistance(det, message)) {
    const contextBlock = recentHistory
      ?.slice(-6)
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join("\n");
    const augmented = contextBlock ? `${contextBlock}\n\nuser: ${message}` : message;
    const hints = missingFieldHints(det);
    const llmPatch = await tryLlmIntakePatch(augmented, hints);
    if (llmPatch && Object.keys(llmPatch).length > 0) {
      merged.intakePatch = applyConfidenceWeightedMerge(det, llmPatch);
      const lowConf: Record<string, "low"> = {};
      for (const k of Object.keys(llmPatch)) {
        if (k === "grantor" || k === "trustee" || k === "firm") continue;
        lowConf[k] = "low";
      }
      merged.confidence = mergeConfidence(det.confidence, lowConf);
      if (llmPatch.grantor) {
        for (const sub of Object.keys(llmPatch.grantor)) {
          const fk = `grantor.${sub}`;
          if (!merged.fieldKeys.includes(fk)) merged.fieldKeys.push(fk);
          bumpConf(merged.confidence, fk, "low");
        }
      }
      if (llmPatch.trustee) {
        for (const sub of Object.keys(llmPatch.trustee)) {
          const fk = `trustee.${sub}`;
          if (!merged.fieldKeys.includes(fk)) merged.fieldKeys.push(fk);
          bumpConf(merged.confidence, fk, "low");
        }
      }
      if (llmPatch.firm) {
        for (const sub of Object.keys(llmPatch.firm)) {
          const fk = `firm.${sub}`;
          if (!merged.fieldKeys.includes(fk)) merged.fieldKeys.push(fk);
          bumpConf(merged.confidence, fk, "low");
        }
      }
      merged.notes.push("Some fields were inferred via LLM-assisted extraction — verify against client instructions.");
    }
  }

  return merged;
}

/** Deep-merge partial intake slices (grantor/trustee/firm) */
export function mergeJarvaIntakeBases(
  base: JarvaTrustIntake | Record<string, unknown> | null | undefined,
  delta: Partial<JarvaTrustIntake>
): Record<string, unknown> {
  const a = (base ?? {}) as Record<string, unknown>;
  const b = delta as Record<string, unknown>;
  const out: Record<string, unknown> = { ...a, ...b };
  if (b.grantor || a.grantor) {
    out.grantor = { ...((a.grantor as object) ?? {}), ...((b.grantor as object) ?? {}) };
  }
  if (b.trustee || a.trustee) {
    out.trustee = { ...((a.trustee as object) ?? {}), ...((b.trustee as object) ?? {}) };
  }
  if (b.firm || a.firm) {
    out.firm = { ...((a.firm as object) ?? {}), ...((b.firm as object) ?? {}) };
  }
  return out;
}

/**
 * @deprecated Use extractJarvaIntakeFromChat for full pipeline.
 * Synchronous deterministic-only extraction (for tests or legacy callers).
 */
export function extractIntakeFromChatMessage(
  message: string,
  _prior?: Partial<JarvaTrustIntake>
): { partial: Partial<JarvaTrustIntake>; fieldKeys: string[] } {
  const r = runDeterministicJarvaExtraction(message);
  return { partial: r.intakePatch, fieldKeys: r.fieldKeys };
}
