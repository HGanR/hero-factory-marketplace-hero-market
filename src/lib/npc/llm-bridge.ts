import type { KnowledgeEntry, NPCProfile, NPCResponse } from "./types";
import { invokeNpcLlm } from "./llm";
import { buildExecutiveAdminNpcLlmPersonaSection, isSkipperExecutiveNpcProfile } from "@/lib/agents/executive-admin-system-prompt";
import {
  getTrustPlaybookPrompt,
  getFamilyOfficeArchitecturePrompt,
  matchTrustObjectives,
  formatDecisionTreeOutput,
  sanitizeResponse,
} from "./trust";
import type { JarvaEntryIntent } from "@/lib/jarva/jarva-entry-router";
import {
  jarvaDocumentAssemblyHintsHaveSignals,
  type JarvaDocumentAssemblyHints,
} from "@/lib/jarva/jarva-document-assembly-hints";
import type { JarvaProceduralStep } from "@/lib/jarva/jarva-procedural-engine";
import type { JarvaWorkflowPath, JarvaWorkflowPathSource } from "@/lib/jarva/jarva-workflow-path";

type ChatContext = {
  source?: "trust-records" | "smart-trust" | "ecclesiastical" | "oasis-world" | "unknown";
  trustId?: string;
  workspaceId?: string;
  clientId?: string;
  clientName?: string;
  clientTitle?: string;
  trustName?: string;
  entityId?: string;
  currentStep?: string;
  stepFocus?: string;
  moduleType?: string;
  completionPct?: number;
  blockers?: string[];
  advisories?: string[];
  workspaceStatus?: string;
  workspaceCounts?: {
    parties?: number;
    beneficiaries?: number;
    assets?: number;
  };
  /** Optional Trust Records checklist flags (from workspace summary) — server may also derive procedural step. */
  workspaceChecklist?: {
    partiesAndRoles?: boolean;
    beneficiaries?: boolean;
    assetsAndFundingPlan?: boolean;
  };
  /** Mirrors workspace summary workProduct.issuedAssetCertificateCount when available. */
  issuedAssetCertificateCount?: number;
  /** Workspace summary workProduct — securities module executed certificates (Issue Security). */
  securitiesCertificatesIssuedCount?: number;
  securitiesCertificatesIssuedActiveCount?: number;
  securityOfferingCount?: number;
  securityOfferingDraftCount?: number;
  securityOfferingFinalizedCount?: number;
  bondInstrumentCount?: number;
  bondPreIssuanceCount?: number;
  bondIssuedCount?: number;
  securityOfferingCancelledCount?: number;
  securityOfferingErrorCount?: number;
  securitiesCertificatesVoidedOrReplacedCount?: number;
  bondClosedCount?: number;
  bondVoidedCount?: number;
  hasDraftOffering?: boolean;
  hasFinalizedOffering?: boolean;
  hasIssuedSecuritiesCertificate?: boolean;
  hasIssuedWorkflowAssetCertificate?: boolean;
  hasActiveBondWorkflow?: boolean;
  hasIssuedBond?: boolean;
  playbookId?: string;
  fieldFocus?: { key: string; label: string };
  /** Server-computed procedural intake step (trust-advisor); do not trust from client JSON alone. */
  jarvaProceduralStep?: JarvaProceduralStep;
  jarvaProceduralTitle?: string;
  jarvaProceduralIndex?: number;
  jarvaProceduralTotalSteps?: number;
  jarvaProceduralBlockers?: string[];
  /** Deterministic entry-router classification (trust-advisor); server-set. */
  jarvaEntryIntent?: JarvaEntryIntent;
  jarvaTrustStyleHint?: "revocable" | "irrevocable" | "ecclesiastical";
  /** Resolved specialist lane after classification (server-set); not `trust_general` / `unknown`. */
  jarvaWorkflowPath?: JarvaWorkflowPath;
  /** How the workflow path was chosen this turn (explicit message vs sticky session vs transcript). */
  jarvaWorkflowPathSource?: JarvaWorkflowPathSource | null;
  /** Server-derived advisory flags for draft assembly readiness (trust-advisor); never implies auto-generation or counsel approval. */
  jarvaDocumentAssemblyHints?: JarvaDocumentAssemblyHints;
  clientRecord?: {
    fullName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    suffix?: string;
    title?: string;
    email?: string;
    phone?: string;
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

const GLOBAL_NPC_RULES = `
Global rules (all NPCs):
1. Stay in character.
2. Be honest; do not fabricate facts or platform capabilities.
3. If unsure, say so and offer next steps.`;

function buildJarvaPersona(profile: NPCProfile): string {
  return `You are Jarva, a trust structuring aid for consultants inside this platform.
The user is the consultant. Your job is to aid them: explain what they see, guide next steps, and help them structure trust records using THIS platform's actual flows and screens. You assist the consultant—you do not replace them.
You are not a law firm. Provide general info and platform guidance. Encourage legal counsel for final decisions.
Prefer structured outputs: bullets, checklists, short next actions. Reference specific platform sections: Settings, Assets, Issue, Certificates, Smart Trust, Trust Records.
Never claim platform actions occurred unless confirmed by system context.
When context includes blockers, prioritize resolving blockers before anything else.

FIVE REQUIRED TRUST ELEMENTS → WHERE IN THE PLATFORM:
1. Intent to create a trust → Smart Trust Wizard (entity type, trust type) or Trust Records → Settings (Entity Type, Trust Category, Formation Mode).
2. Identifiable trust property (res) → Trust Records → Assets tab, or Smart Trust → Assets/Funding.
3. Identifiable beneficiaries → Smart Trust → Parties, or workspace beneficiaries.
4. A trustee with duties → Trust Records → Settings (trustee name/address), Smart Trust → Parties (trustee roles). Use "Fill from client" to auto-populate.
5. Lawful purpose → Trust Records → Settings (Trust Category, Governance Mode), Smart Trust (trust type selection).

TRUST WORKSPACE FLOW (guide users through this sequence after workspace creation):
1. Settings – Configure trust name, grantor and trustee names/addresses, seal, certificate prefix, Entity Type, jurisdiction.
2. Assets – Add and describe trust assets in the Asset Registry before issuance.
3. Issue – Issue trust certificates backed by assets (denomination, owner name, backing assets).
4. Certificates – View and manage issued certificates in the registry.
When the user is at a specific step (context.currentStep / stepFocus), give step-specific instructions. When context.currentStep is provided, tailor your answer to that tab (e.g., if they are on "assets", explain asset fields and next actions in Assets).
When the user asks "what are my next steps" or "how do I construct a trust", map your answer to the five elements above and point to specific platform locations (Settings, Assets, Issue, Certificates, Smart Trust).
When clientRecord is provided, you can reference it. If the user asks to "fill from client" or "use client data", respond with the exact values from clientRecord (name, email, address) so they can copy or apply. Say: "From your client record: [values]. Click 'Fill from client' in Settings to apply, or I can list the values here."
When clientRecord.title or context.clientTitle is provided (e.g., Trustee, CEO, Managing Member), use it to tailor prompts: suggest questions the consultant should ask that titled individual, and phrase advice as "Ask the [Title] about…" or "The [Title] may need to provide…". This helps the consultant gather the right information for structuring.

TRUST WORKFLOW STEP GATE (when context.jarvaProceduralStep is set — trust-advisor only):
You are in a **single** procedural step at a time. Do not jump ahead to later trust topics until that step is satisfied.
- front_door: welcome and classify what the consultant is doing; point to Trust Records / Smart Trust / Ecclesiastical — no parallel system.
- trust_type_choice: ask Revocable vs Irrevocable vs Ecclesiastical before deep intake; align with Smart Trust/Trust Records vs the /ecclesiastical route.
- specialty_guidance: certificates, PPM/securities, bonds, or estate — use existing Trust Records tabs (Issue, Certificates, Bonds, Estate); still DRAFT for counsel.
- workspace: only help create/open a trust workspace and explain why an id is required; do not drill into parties/assets yet.
- client: only client record creation, identity, and binding Client ID; no deep drafting.
- parties: only grantor/settlor, trustee, successor, beneficiary roles and names; no asset schedules yet.
- assets: only trust property, funding, titling notes, and asset registry behavior.
- provisions: governing state, objectives, trust name, pour-over, jurisdiction notes, firm header — not certificate issuance mechanics unless asked.
- certificate: direct the consultant to Trust Records Settings / Issue / Certificates; do not fabricate issuance.
- review: summarize readiness for review packet / export and list remaining blockers from context; avoid introducing new major topics.
If context.jarvaProceduralBlockers is non-empty, address those first. Match your tone to context.jarvaProceduralTitle.

WORKFLOW PATH (when context.jarvaWorkflowPath is set — trust-advisor):
- You are aligned to one specialist lane: revocable, irrevocable, ecclesiastical, certificate, PPM, bond, or estate.
- Match questions and next steps to that lane — do not answer PPM/bond/certificate prompts the same way as generic revocable intake, and vice versa.
- All outputs remain **DRAFT** for counsel review.

DOCUMENT ASSEMBLY HINTS (when context.jarvaDocumentAssemblyHints is set — trust-advisor):
- These are **advisory readiness signals** only. The platform does **not** auto-generate documents from chat.
- Use the hints for **draft assembly** and **review assembly** wording (PPM/subscription, certificate package, bond documentation, trust review packet) — **DRAFT — not legal advice**.
- Consultants can **preview / download advisory Markdown bundles** (typed packets aligned to readiness) via the Jarva chat UI or **POST /api/jarva/advisory-packets** — still **DRAFT** workpapers; the full merge-preview review packet remains **POST /api/jarva/trust-intake/review-packet** / Trust Records → Build with Jarva.
- Never imply **legal review is complete**, **counsel approval**, or that files were already generated unless the user confirms outside Jarva.

COMPLIANCE RULES (never violate):
- Trusts are tools for legal structuring, not legal immunity.
- Never assert: "trust eliminates all taxes"; "private trust is outside IRS jurisdiction"; "ecclesiastical trust makes you sovereign"; "irrevocable trust guarantees creditor protection"; "you don't need to file taxes."
- Always clarify jurisdiction and objectives; distinguish legal planning from illegal evasion.
${getTrustPlaybookPrompt()}
${getFamilyOfficeArchitecturePrompt()}`;
}

function buildSystemPrompt(
  profile: NPCProfile,
  knowledge: KnowledgeEntry[],
  context?: ChatContext,
  userMessage?: string,
  /** Unified SKIPPER cognitive stack from {@link resolveUnifiedSkipperRuntimeContext} (NPC surface). */
  unifiedPersonaBase?: string | null,
): string {
  // npcId-based persona switch (Jarva) before role fallback
  let personaSection: string;
  if (profile.id === "trust-advisor") {
    personaSection = buildJarvaPersona(profile);
  } else if (unifiedPersonaBase?.trim() && isSkipperExecutiveNpcProfile(profile)) {
    personaSection = unifiedPersonaBase.trim();
  } else if (isSkipperExecutiveNpcProfile(profile)) {
    personaSection = buildExecutiveAdminNpcLlmPersonaSection(profile.name);
  } else {
    const roleDescriptions: Record<string, string> = {
      secretary: `You are ${profile.name}, an executive secretary in the Oasis World. You help visitors schedule, find information, and navigate services.`,
      avatar: `You are ${profile.name}, the creator of this Oasis World. You explain your vision, ownership, and offerings.`,
      guide: `You are ${profile.name}, a tour guide in the Oasis World. You help visitors explore and learn about the environment.`,
      voice_agent: `You are ${profile.name}, a professional phone receptionist and AI voice agent. You answer calls for the consultant, schedule appointments, take messages, and provide helpful information. Be concise and friendly over the phone.`,
    };
    personaSection = roleDescriptions[profile.role] ?? roleDescriptions.secretary;
  }

  const personality = profile.personality;
  const lang = profile.language && String(profile.language).trim();
  const languageInstruction = lang
    ? (() => {
        const langNames: Record<string, string> = {
          en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese",
          "pt-BR": "Portuguese (Brazil)", zh: "Chinese (Simplified)", "zh-TW": "Chinese (Traditional)",
          ja: "Japanese", ko: "Korean", ar: "Arabic", hi: "Hindi", ru: "Russian", nl: "Dutch",
          pl: "Polish", tr: "Turkish", vi: "Vietnamese", th: "Thai", id: "Indonesian",
        };
        const langName = langNames[lang] ?? lang;
        return `\n\nLanguage: Always respond in ${langName}. Speak and write exclusively in ${langName} unless the user explicitly asks you to switch languages.`;
      })()
    : "";

  const personalityDescription = `
Personality traits:
- Friendliness: ${personality.friendliness}/100
- Formality: ${personality.formality}/100
- Verbosity: ${personality.verbosity}/100
- Humor: ${personality.humor}/100
- Patience: ${personality.patience}/100
- Expertise: ${personality.expertise}/100`;

  const knowledgeSection =
    knowledge.length > 0
      ? `\nKnowledge base:\n${knowledge.map((k) => `- [${k.topic}] ${k.content}`).join("\n")}`
      : "";

  const contextSection =
    context &&
    (context.source ||
      context.trustId ||
      context.workspaceId ||
      context.clientId ||
      context.clientName ||
      context.trustName ||
      context.currentStep ||
      context.stepFocus ||
      context.clientRecord ||
      context.blockers?.length ||
      context.workspaceStatus ||
      context.workspaceCounts ||
      context.jarvaProceduralStep ||
      context.jarvaWorkflowPath ||
      context.jarvaWorkflowPathSource != null ||
      jarvaDocumentAssemblyHintsHaveSignals(context.jarvaDocumentAssemblyHints))
      ? `
Current context (summarized, do not fabricate):
${context.source ? `- Source: ${context.source}` : ""}
${context.trustId ? `- Trust ID present` : ""}
${context.workspaceId ? `- Workspace ID present` : ""}
${context.clientId ? `- Client ID present` : ""}
${context.clientName ? `- Client name: ${context.clientName}` : ""}
${context.clientTitle ? `- Client authority title: ${context.clientTitle}` : ""}
${context.trustName ? `- Trust name: ${context.trustName}` : ""}
${context.entityId ? `- Entity ID present` : ""}
${context.currentStep ? `- Current step: ${context.currentStep}` : ""}
${context.stepFocus ? `- Step focus: ${context.stepFocus}` : ""}
${context.moduleType ? `- Module: ${context.moduleType}` : ""}
${context.clientRecord
  ? `- Client record (use when user asks to fill from client): fullName=${context.clientRecord.fullName ?? ""}, title=${context.clientRecord.title ?? ""}, email=${context.clientRecord.email ?? ""}, phone=${context.clientRecord.phone ?? ""}, address: ${[context.clientRecord.addressLine1, context.clientRecord.city, context.clientRecord.state, context.clientRecord.postalCode].filter(Boolean).join(", ") || "—"}`
  : ""}
${context.completionPct != null ? `- Completion: ${context.completionPct}%` : ""}
${context.workspaceStatus ? `- Workspace status: ${context.workspaceStatus}` : ""}
${context.workspaceCounts
        ? `- Workspace counts: parties ${context.workspaceCounts.parties ?? 0}, beneficiaries ${context.workspaceCounts.beneficiaries ?? 0}, assets ${context.workspaceCounts.assets ?? 0}`
        : ""}
${context.blockers?.length ? `- Blockers: ${context.blockers.join(", ")}` : ""}
${context.advisories?.length ? `- Advisories: ${context.advisories.join(", ")}` : ""}
${context.fieldFocus ? `- User focus: ${context.fieldFocus.label}` : ""}
${context.jarvaProceduralStep ? `- Trust workflow step: ${context.jarvaProceduralStep} (${context.jarvaProceduralTitle ?? "—"})` : ""}
${context.jarvaProceduralIndex != null && context.jarvaProceduralTotalSteps != null ? `- Step index: ${context.jarvaProceduralIndex} / ${context.jarvaProceduralTotalSteps}` : ""}
${context.jarvaProceduralBlockers?.length ? `- Procedural gates: ${context.jarvaProceduralBlockers.join("; ")}` : ""}
${context.jarvaWorkflowPath ? `- Workflow path (specialist lane): ${context.jarvaWorkflowPath}` : ""}
${context.jarvaWorkflowPathSource ? `- Workflow path source: ${context.jarvaWorkflowPathSource}` : ""}
${context.jarvaDocumentAssemblyHints != null
        ? `- Draft assembly / review assembly readiness (advisory — DRAFT — not legal advice): ppmDraft=${String(context.jarvaDocumentAssemblyHints.ppmDraftReadyForGeneration)}, certificatePackage=${String(context.jarvaDocumentAssemblyHints.certificatePackageReady)}, bondDocumentation=${String(context.jarvaDocumentAssemblyHints.bondDocumentationReady)}, trustReviewPacket=${String(context.jarvaDocumentAssemblyHints.trustReviewPacketReady)}${
            context.jarvaDocumentAssemblyHints.lines?.length
              ? `\n  Details: ${context.jarvaDocumentAssemblyHints.lines.join(" ")}`
              : ""
          }`
        : ""}`
      : "";

  const decisionTreeSection =
    profile.id === "trust-advisor" &&
    userMessage &&
    (() => {
      const nodes = matchTrustObjectives(userMessage);
      if (nodes.length === 0) return "";
      const formatted = formatDecisionTreeOutput(nodes);
      return formatted ? `\nTrust Decision Tree (use to inform recommendations):\n${formatted}\n` : "";
    })();

  return `${personaSection}${languageInstruction}
${personalityDescription}
${knowledgeSection}
${contextSection}
${decisionTreeSection ?? ""}
${GLOBAL_NPC_RULES}
Keep responses concise (2-4 sentences unless explaining a multi-step process).`;
}

function cleanResponse(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "").trim();
}

export type { ChatContext };

/**
 * Optional LLM enhancement. The platform never requires this—all responses
 * come from local knowledge + rules when NPC_LLM_ENABLED is false or unset.
 */
export async function generateLlmResponse(params: {
  message: string;
  profile: NPCProfile;
  knowledge: KnowledgeEntry[];
  context?: ChatContext;
  /** When provided for Executive NPC profiles, replaces the default persona block (unified cognitive runtime). */
  unifiedPersonaBase?: string | null;
}): Promise<NPCResponse | null> {
  if (process.env.NPC_LLM_ENABLED !== "true") {
    return null; // Platform operates in knowledge-only mode; no external APIs.
  }

  const { message, profile, knowledge, context, unifiedPersonaBase } = params;
  const systemPrompt = buildSystemPrompt(profile, knowledge, context, message, unifiedPersonaBase);

  const responseText = await invokeNpcLlm([
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ]);

  if (!responseText) return null;

  const cleaned = cleanResponse(responseText);
  const sanitized =
    profile.id === "trust-advisor" ? sanitizeResponse(cleaned) : cleaned;

  return {
    text: sanitized,
    mood: profile.mood,
    source: "llm",
    intent: "unknown",
    suggestions: [],
  };
}
