import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

/**
 * Repo-grounded Trust Records / Smart Trust / Ecclesiastical targets.
 * Mirrors links in `jarva-chat-ui-actions.ts` (`buildJarvaSpecialtyActions`, `trustRecordsHref`).
 */

export type JarvaWorkflowDestination = {
  href: string;
  label: string;
  /** When true, FloatingNPCChat may `router.push` on explicit lane / trust-type actions. */
  autoOpenEligible: boolean;
  reason?: string;
};

export type JarvaDestinationContext = {
  trustId?: string | null;
};

function trustRecordsQuery(trustId: string | null | undefined, tab?: string): string {
  const tid = trustId?.trim();
  const sp = new URLSearchParams();
  if (tid) sp.set("trustId", tid);
  if (tab) sp.set("tab", tab);
  const q = sp.toString();
  return q ? `/trust-records?${q}` : "/trust-records";
}

/**
 * Resolve a concrete in-app URL for the specialist lane. Does not invent routes.
 */
export function resolveJarvaWorkflowDestination(
  path: JarvaWorkflowPath,
  ctx: JarvaDestinationContext
): JarvaWorkflowDestination {
  const tid = ctx.trustId?.trim() || undefined;

  switch (path) {
    case "trust_revocable":
    case "trust_irrevocable":
      if (tid) {
        return {
          href: `/trust-records/jarva?trustId=${encodeURIComponent(tid)}`,
          label: "Build with Jarva",
          autoOpenEligible: true,
          reason: "Trust-scoped intake (DRAFT — counsel review)",
        };
      }
      return {
        href: "/trust-records",
        label: "Trust Records",
        autoOpenEligible: false,
        reason: "Open a trust workspace to use Jarva intake",
      };

    case "trust_ecclesiastical":
      return {
        href: "/ecclesiastical",
        label: "Ecclesiastical Trust Workspace",
        autoOpenEligible: true,
      };

    case "trust_certificate":
      if (tid) {
        return {
          href: `/trusts/${encodeURIComponent(tid)}/issue-security`,
          label: "Issue / securities",
          autoOpenEligible: true,
        };
      }
      return {
        href: "/trust-records?tab=issue",
        label: "Trust Records — Issue",
        autoOpenEligible: false,
      };

    case "trust_ppm":
      if (tid) {
        return {
          href: `/trusts/${encodeURIComponent(tid)}/issue-security`,
          label: "Issue / securities (PPM)",
          autoOpenEligible: true,
        };
      }
      return {
        href: "/trust-records?tab=issue",
        label: "Trust Records — Issue",
        autoOpenEligible: false,
      };

    case "trust_bond":
      return {
        href: trustRecordsQuery(tid, "bonds"),
        label: "Trust Records — Bonds",
        autoOpenEligible: true,
      };

    case "trust_estate":
      if (tid) {
        return {
          href: trustRecordsQuery(tid, "estate"),
          label: "Trust Records — Estate",
          autoOpenEligible: true,
        };
      }
      return {
        href: "/trust-records/estate/will",
        label: "Estate / Will workspace",
        autoOpenEligible: true,
      };

    default:
      return {
        href: "/trust-records",
        label: "Trust Records",
        autoOpenEligible: false,
      };
  }
}
