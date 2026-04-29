/**
 * Builds ClosePackageModel from DeliverablesDocument + SiteSchemaDocument (safe fields only).
 */

import type { DeliverablesDocument } from "@/lib/site-builder/deliverables-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { buildClientHandoffContext } from "@/lib/site-builder/deliverables/client-handoff-render";
import {
  ClosePackageModelSchema,
  ProposalSelectionSchema,
  type ClosePackageModel,
} from "@/lib/site-builder/deliverables/close-package-schema";

const DEFAULT_TIER = "standard" as const;
const DEFAULT_POSTURE = "core" as const;

function tierFromMeta(raw: unknown): ClosePackageModel["proposalSelection"] {
  const parsed = raw === undefined || raw === null ? null : ProposalSelectionSchema.safeParse(raw);
  const m = parsed?.success ? parsed.data : undefined;
  return {
    selectedTier: m?.selectedTier ?? DEFAULT_TIER,
    scopePosture: m?.scopePosture ?? DEFAULT_POSTURE,
    notes: m?.notes?.trim() ? m.notes.trim().slice(0, 2000) : undefined,
    paymentHandoffPreference: m?.paymentHandoffPreference,
  };
}

function tierDisplay(t: NonNullable<ClosePackageModel["proposalSelection"]["selectedTier"]>): string {
  switch (t) {
    case "essential":
      return "Essential";
    case "standard":
      return "Standard";
    case "partner":
      return "Partner";
    default:
      return "Standard";
  }
}

function postureDisplay(p: NonNullable<ClosePackageModel["proposalSelection"]["scopePosture"]>): string {
  switch (p) {
    case "starter":
      return "Starter";
    case "core":
      return "Core";
    case "expanded":
      return "Expanded";
    default:
      return "Core";
  }
}

/** Human label for posture + tier (consultant-facing). */
export function describeProposalPosture(selection: ClosePackageModel["proposalSelection"]): string {
  const t = tierDisplay(selection.selectedTier ?? DEFAULT_TIER);
  const s = postureDisplay(selection.scopePosture ?? DEFAULT_POSTURE);
  return `${t} tier · ${s} scope posture`;
}

export function buildClosePackageModel(
  d: DeliverablesDocument,
  schema?: SiteSchemaDocumentType,
): ClosePackageModel {
  const ctx = buildClientHandoffContext(schema);
  const proposalSelection = tierFromMeta(schema?.metadata?.consultantProposalPosture);

  const includedOutcomes = d.summary.topImprovements.map((x) => x.slice(0, 800));

  const approvalSummary = {
    projectName: ctx.siteTitle.slice(0, 300),
    summary: d.summary.executiveSummary.slice(0, 6000),
    includedOutcomes,
    deploymentTarget: ctx.deploymentLabel,
    widgetIncluded: ctx.widgetAttached,
  };

  const onboardingChecklist: ClosePackageModel["onboardingChecklist"] = [];

  onboardingChecklist.push({
    label: "Commercial alignment",
    items: [
      "Confirm stakeholder sign-off on messaging and scope described in this summary.",
      "Share {approval_link} when your firm is ready for formal written approval.",
      "If billing is separate, attach {invoice_link} or your standard payment instructions.",
    ],
  });

  if (schema?.metadata?.paymentIntegration?.provider === "paypal") {
    const pi = schema.metadata.paymentIntegration;
    onboardingChecklist.push({
      label: "PayPal payment surface",
      items: [
        `Configured in the builder as ${pi.mode.replace(/_/g, " ")} · ${pi.intent.replace(/_/g, " ")} · ${pi.placement.replace(/_/g, " ")}.`,
        "On the live site, confirm the PayPal link or hosted button resolves over HTTPS on the intended domain.",
        "Share payment links only through approved client channels—not in unsecured analytics or logs.",
      ],
    });
  }

  onboardingChecklist.push({
    label: "Access and hosting",
    items: [
      ctx.importedSite
        ? "Confirm who holds DNS, hosting, and domain access for cutover or parallel launch."
        : "Confirm hosting target and who will upload or connect the export bundle.",
      `Deployment posture in this project: ${ctx.deploymentLabel}.`,
      "Schedule an implementation window that avoids unannounced DNS changes.",
    ],
  });

  if (ctx.routeCount > 1) {
    onboardingChecklist.push({
      label: "Multi-route validation",
      items: [
        "Walk primary journeys (home → offer → contact) in one sitting before go-live.",
        "Confirm each route reflects final copy and brand assets.",
      ],
    });
  }

  if (ctx.widgetAttached) {
    onboardingChecklist.push({
      label: "AI assistant embed",
      items: [
        "Confirm the embed key and loader placement match the production domain.",
        "Run one live conversation in a private browser session after deployment.",
      ],
    });
  } else {
    onboardingChecklist.push({
      label: "Optional assistant",
      items: [
        "Decide whether an AI assistant embed is in scope; if added later, re-validate hosting and keys.",
      ],
    });
  }

  for (const sec of d.launchChecklist) {
    if (onboardingChecklist.length >= 16) break;
    onboardingChecklist.push({
      label: sec.label,
      items: sec.items.slice(0, 12).map((it) => it.slice(0, 500)),
    });
  }

  const kickoffPacket: ClosePackageModel["kickoffPacket"] = {
    consultantActions: [
      "Finalize the export bundle against the agreed deployment target and run a quick smoke check on key routes.",
      "Align on launch sequencing with your team—especially DNS or platform cutover timing.",
      ...(ctx.widgetAttached
        ? [
            "Validate the assistant embed in a staging or password-protected environment before public launch.",
          ]
        : []),
    ],
    clientInputsNeeded: [
      "Final copy approvals for headlines, body text, and calls to action.",
      "Brand assets (logos, imagery) in agreed formats.",
      "Confirmation of who approves go-live and who receives operational handoff.",
      ...(ctx.importedSite ? ["Any legal or compliance review required for public-facing claims."] : []),
    ],
    nextSteps: [
      "Kickoff call or async confirmation using {kickoff_link} to lock dates and owners.",
      "Complete onboarding checklist items above before wide announcement.",
      "After deployment, monitor inquiries and conversion signals for one full business week.",
    ],
  };

  const paymentReadiness = {
    approvalLinkPlaceholder: "{approval_link}" as const,
    invoiceLinkPlaceholder: "{invoice_link}" as const,
    kickoffLinkPlaceholder: "{kickoff_link}" as const,
    stripeLinkPlaceholder: "{stripe_payment_link}" as const,
    cryptoLinkPlaceholder: "{crypto_payment_link}" as const,
    depositOrFullNote:
      "Payment structure (deposit vs. balance vs. single payment) is between your firm and the client—use {invoice_link}, {stripe_payment_link}, or {crypto_payment_link} when your process is ready.",
  };

  return ClosePackageModelSchema.parse({
    proposalSelection,
    approvalSummary,
    onboardingChecklist: onboardingChecklist.slice(0, 16),
    kickoffPacket,
    paymentReadiness,
  });
}

export { tierDisplay, postureDisplay };
