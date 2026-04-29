import type { ChatContext } from "@/lib/npc/llm-bridge";
import type { JarvaProceduralInput } from "@/lib/jarva/jarva-procedural-engine";
import type { WorkspaceSummaryPayload } from "@/lib/trusts/build-workspace-summary";

/**
 * Maps chat context + workspace summary + intake readiness into procedural engine input.
 * Shared by /api/npc/chat and document-assembly hint fallbacks.
 */
export function buildJarvaProceduralInputFromChat(
  ctx: ChatContext,
  opts: {
    completenessPct: number;
    coreOk: boolean;
    workspaceSummary?: WorkspaceSummaryPayload | null;
    readinessFull: { hardBlockers: string[] };
    applyReadiness: { blockers: string[] };
  }
): JarvaProceduralInput {
  return {
    trustId: ctx.trustId,
    clientId: ctx.clientId,
    workspaceCounts: opts.workspaceSummary?.counts ?? ctx.workspaceCounts,
    completionPct: ctx.completionPct,
    jarvaIntakeCompletenessPct: opts.completenessPct,
    jarvaIntakeCoreComplete: opts.coreOk,
    workspaceChecklist: opts.workspaceSummary?.checklist ?? ctx.workspaceChecklist,
    jarvaHardBlockers: opts.readinessFull.hardBlockers,
    jarvaApplyBlockers: opts.applyReadiness.blockers,
    issuedAssetCertificateCount:
      opts.workspaceSummary?.workProduct?.issuedAssetCertificateCount ?? ctx.issuedAssetCertificateCount,
    securitiesCertificatesIssuedCount:
      opts.workspaceSummary?.workProduct?.securitiesCertificatesIssuedCount ?? ctx.securitiesCertificatesIssuedCount,
    securityOfferingCount: opts.workspaceSummary?.workProduct?.securityOfferingCount ?? ctx.securityOfferingCount,
    securityOfferingDraftCount:
      opts.workspaceSummary?.workProduct?.securityOfferingDraftCount ?? ctx.securityOfferingDraftCount,
    securityOfferingFinalizedCount:
      opts.workspaceSummary?.workProduct?.securityOfferingFinalizedCount ?? ctx.securityOfferingFinalizedCount,
    securitiesCertificatesIssuedActiveCount:
      opts.workspaceSummary?.workProduct?.securitiesCertificatesIssuedActiveCount ??
      ctx.securitiesCertificatesIssuedActiveCount,
    bondInstrumentCount: opts.workspaceSummary?.workProduct?.bondInstrumentCount ?? ctx.bondInstrumentCount,
    bondPreIssuanceCount: opts.workspaceSummary?.workProduct?.bondPreIssuanceCount ?? ctx.bondPreIssuanceCount,
    bondIssuedCount: opts.workspaceSummary?.workProduct?.bondIssuedCount ?? ctx.bondIssuedCount,
    securityOfferingCancelledCount:
      opts.workspaceSummary?.workProduct?.securityOfferingCancelledCount ?? ctx.securityOfferingCancelledCount,
    securityOfferingErrorCount:
      opts.workspaceSummary?.workProduct?.securityOfferingErrorCount ?? ctx.securityOfferingErrorCount,
    securitiesCertificatesVoidedOrReplacedCount:
      opts.workspaceSummary?.workProduct?.securitiesCertificatesVoidedOrReplacedCount ??
      ctx.securitiesCertificatesVoidedOrReplacedCount,
    bondClosedCount: opts.workspaceSummary?.workProduct?.bondClosedCount ?? ctx.bondClosedCount,
    bondVoidedCount: opts.workspaceSummary?.workProduct?.bondVoidedCount ?? ctx.bondVoidedCount,
    hasDraftOffering: opts.workspaceSummary?.workProduct?.hasDraftOffering ?? ctx.hasDraftOffering,
    hasFinalizedOffering: opts.workspaceSummary?.workProduct?.hasFinalizedOffering ?? ctx.hasFinalizedOffering,
    hasIssuedSecuritiesCertificate:
      opts.workspaceSummary?.workProduct?.hasIssuedSecuritiesCertificate ?? ctx.hasIssuedSecuritiesCertificate,
    hasIssuedWorkflowAssetCertificate:
      opts.workspaceSummary?.workProduct?.hasIssuedWorkflowAssetCertificate ??
      ctx.hasIssuedWorkflowAssetCertificate,
    hasActiveBondWorkflow:
      opts.workspaceSummary?.workProduct?.hasActiveBondWorkflow ?? ctx.hasActiveBondWorkflow,
    hasIssuedBond: opts.workspaceSummary?.workProduct?.hasIssuedBond ?? ctx.hasIssuedBond,
  };
}
