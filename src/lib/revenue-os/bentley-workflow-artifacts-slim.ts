/**
 * Reduces workflow artifact size before sessionStorage persistence (quota safety).
 * In-memory pipeline steps still use full API responses; only persisted snapshots are slimmed.
 */

import type { ResearchResult } from "@/components/ai-revenue-os/ResearchAssistantSection";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { SynthesizePlanResult } from "@/lib/revenue-os/revenue-os-pipeline-actions";
import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import type {
  MarketSweepResult,
  ScoredInsight,
  GrowthGuidance,
  MarketIntelligenceDiff,
  MarketSweepExperimentPlan,
  BentleyDistributionPlan,
  DistributionPlanItem,
} from "@/lib/revenue-os/market-sweep-schema";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import type { BentleyWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow";

const MAX_STR = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n)}…`);

function slimResearch(r: ResearchResult): ResearchResult {
  return {
    ...r,
    whatPeopleWant: (r.whatPeopleWant ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 400)),
    marketingTips: (r.marketingTips ?? []).slice(0, 16).map((x) => MAX_STR(String(x), 500)),
    commentsBySource: (r.commentsBySource ?? []).slice(0, 12).map((c) => ({
      ...c,
      themes: (c.themes ?? []).slice(0, 8).map((t) => MAX_STR(String(t), 200)),
      sampleComments: (c.sampleComments ?? []).slice(0, 4).map((s) => MAX_STR(String(s), 300)),
    })),
    sourcesSearched: (r.sourcesSearched ?? []).slice(0, 12),
    connectedIntegrations: (r.connectedIntegrations ?? []).slice(0, 12),
  };
}

function slimTrends(t: TrendsResponse): TrendsResponse {
  const items = (t.items ?? []).slice(0, 24).map((it) => ({
    ...it,
    title: MAX_STR(it.title ?? "", 400),
    url: MAX_STR(it.url ?? "", 2000),
    summary: it.summary != null ? MAX_STR(String(it.summary), 800) : it.summary,
    whyTrending: it.whyTrending != null ? MAX_STR(String(it.whyTrending), 800) : it.whyTrending,
    tags: (it.tags ?? []).slice(0, 16).map((x) => MAX_STR(String(x), 120)),
    commentInsights: (it.commentInsights ?? []).slice(0, 12).map((x) => MAX_STR(String(x), 500)),
  }));
  return {
    ...t,
    items,
    campaignAngles: (t.campaignAngles ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 400)),
  };
}

function slimScoredRow(r: ScoredInsight): ScoredInsight {
  return {
    ...r,
    text: MAX_STR(r.text, 600),
  };
}

function slimMarketSweep(m: MarketSweepResult): MarketSweepResult {
  const cap = (arr: string[], n: number) =>
    arr.slice(0, n).map((x) => MAX_STR(String(x), 600));
  const capScored = (rows?: ScoredInsight[]) =>
    rows?.slice(0, 16).map(slimScoredRow);
  const si = m.scoredInsights;
  return {
    trendingTopics: cap(m.trendingTopics ?? [], 24),
    viralHooks: cap(m.viralHooks ?? [], 24),
    painPoints: cap(m.painPoints ?? [], 24),
    buyingSignals: cap(m.buyingSignals ?? [], 24),
    commentInsights: cap(m.commentInsights ?? [], 32),
    competitorAngles: cap(m.competitorAngles ?? [], 24),
    contentGaps: cap(m.contentGaps ?? [], 24),
    disclaimers: m.disclaimers ? cap(m.disclaimers, 12) : undefined,
    realSignalsSummary: m.realSignalsSummary
      ? MAX_STR(m.realSignalsSummary, 4000)
      : undefined,
    hybridMeta: m.hybridMeta
      ? {
          ...m.hybridMeta,
          connectorErrors: m.hybridMeta.connectorErrors?.slice(0, 8).map((x) => MAX_STR(String(x), 400)),
        }
      : undefined,
    scoredInsights: si
      ? {
          trendingTopics: capScored(si.trendingTopics),
          viralHooks: capScored(si.viralHooks),
          painPoints: capScored(si.painPoints),
          buyingSignals: capScored(si.buyingSignals),
          commentInsights: capScored(si.commentInsights),
          competitorAngles: capScored(si.competitorAngles),
          contentGaps: capScored(si.contentGaps),
        }
      : undefined,
    nextAction: m.nextAction
      ? {
          action: MAX_STR(m.nextAction.action, 64),
          reason: MAX_STR(m.nextAction.reason, 1200),
          priority: m.nextAction.priority,
        }
      : undefined,
    contentGenerationMode: m.contentGenerationMode
      ? MAX_STR(m.contentGenerationMode, 64)
      : undefined,
    growthGuidance: m.growthGuidance ? slimGrowthGuidance(m.growthGuidance) : undefined,
    intelligenceDiff: m.intelligenceDiff ? slimIntelligenceDiff(m.intelligenceDiff) : undefined,
    experimentPlan: m.experimentPlan ? slimExperimentPlan(m.experimentPlan) : undefined,
    experimentPlanSkippedReason: m.experimentPlanSkippedReason
      ? MAX_STR(m.experimentPlanSkippedReason, 500)
      : undefined,
    distributionPlan: m.distributionPlan ? slimDistributionPlan(m.distributionPlan) : undefined,
    leadSignalSummary: m.leadSignalSummary ? slimLeadSignalSummary(m.leadSignalSummary) : undefined,
  };
}

function slimDistributionItem(i: DistributionPlanItem): DistributionPlanItem {
  return {
    ...i,
    angle: MAX_STR(i.angle, 500),
    rationale: MAX_STR(i.rationale, 600),
    platform: MAX_STR(i.platform, 64),
    contentType: MAX_STR(i.contentType, 64),
  };
}

function slimDistributionPlan(d: BentleyDistributionPlan): BentleyDistributionPlan {
  return {
    summary: MAX_STR(d.summary, 1500),
    launchNow: d.launchNow.slice(0, 6).map(slimDistributionItem),
    testNext: d.testNext.slice(0, 6).map(slimDistributionItem),
    holdBack: d.holdBack.slice(0, 4).map(slimDistributionItem),
    platformFormatHints: d.platformFormatHints.slice(0, 6),
  };
}

function slimLeadSignalSummary(s: LeadSignalSummary): LeadSignalSummary {
  return {
    ...s,
    objectionClusters: s.objectionClusters.slice(0, 6).map((x) => MAX_STR(x, 200)),
    topTopics: s.topTopics.slice(0, 8).map((x) => MAX_STR(x, 120)),
    bestPerformingAnglesByIntent: s.bestPerformingAnglesByIntent.slice(0, 6).map((x) => ({
      ...x,
      angle: MAX_STR(x.angle, 400),
    })),
    dominantObjectionTopic: s.dominantObjectionTopic ? MAX_STR(s.dominantObjectionTopic, 200) : null,
  };
}

function slimExperimentPlan(ep: MarketSweepExperimentPlan): MarketSweepExperimentPlan {
  return {
    ...ep,
    hypothesis: MAX_STR(ep.hypothesis, 1500),
    experimentTheme: MAX_STR(ep.experimentTheme, 300),
    primaryMetric: MAX_STR(ep.primaryMetric, 120),
    recommendedPlatforms: (ep.recommendedPlatforms ?? []).slice(0, 6),
    variants: (ep.variants ?? []).slice(0, 5).map((v) => ({
      ...v,
      angle: MAX_STR(v.angle, 500),
      hookType: MAX_STR(v.hookType, 64),
      ctaType: MAX_STR(v.ctaType, 64),
      framingStyle: MAX_STR(v.framingStyle, 120),
      platform: MAX_STR(v.platform, 64),
      contentType: MAX_STR(v.contentType, 64),
      variantKey: MAX_STR(v.variantKey, 8),
    })),
  };
}

function slimGrowthGuidance(g: GrowthGuidance): GrowthGuidance {
  return {
    recommendedNextMove: MAX_STR(g.recommendedNextMove, 1200),
    why: MAX_STR(g.why, 2000),
    risingTopics: (g.risingTopics ?? []).slice(0, 10).map((x) => MAX_STR(x, 400)),
    weakAngles: (g.weakAngles ?? []).slice(0, 10).map((x) => MAX_STR(x, 400)),
    bestHookDirection: MAX_STR(g.bestHookDirection, 1200),
    ...(g.distributionPlanSummary ? { distributionPlanSummary: MAX_STR(g.distributionPlanSummary, 1200) } : {}),
    ...(g.leadSignalSummaryLine ? { leadSignalSummaryLine: MAX_STR(g.leadSignalSummaryLine, 800) } : {}),
    ...(g.dominantObjectionCluster != null
      ? { dominantObjectionCluster: MAX_STR(g.dominantObjectionCluster, 400) }
      : {}),
    ...(g.bentleyNextResponseMode ? { bentleyNextResponseMode: MAX_STR(g.bentleyNextResponseMode, 120) } : {}),
    ...(g.workflowSummary ? { workflowSummary: MAX_STR(g.workflowSummary, 1200) } : {}),
    ...(g.approvalBottleneckLine ? { approvalBottleneckLine: MAX_STR(g.approvalBottleneckLine, 600) } : {}),
    ...(g.publishFailureLine ? { publishFailureLine: MAX_STR(g.publishFailureLine, 600) } : {}),
    ...(g.unsyncedMetricLine ? { unsyncedMetricLine: MAX_STR(g.unsyncedMetricLine, 600) } : {}),
    ...(g.handoffBacklogLine ? { handoffBacklogLine: MAX_STR(g.handoffBacklogLine, 600) } : {}),
    ...(g.bentleyOperationalNextStep ? { bentleyOperationalNextStep: MAX_STR(g.bentleyOperationalNextStep, 500) } : {}),
    ...(g.connectorCoverageSummary ? { connectorCoverageSummary: MAX_STR(g.connectorCoverageSummary, 1200) } : {}),
    ...(g.autoPublishReadyCount != null ? { autoPublishReadyCount: g.autoPublishReadyCount } : {}),
    ...(g.manualFallbackCount != null ? { manualFallbackCount: g.manualFallbackCount } : {}),
    ...(g.blockedTargetsCount != null ? { blockedTargetsCount: g.blockedTargetsCount } : {}),
    ...(g.recommendedConnectorAction
      ? { recommendedConnectorAction: MAX_STR(g.recommendedConnectorAction, 800) }
      : {}),
    ...(g.cadenceSummary ? { cadenceSummary: MAX_STR(g.cadenceSummary, 1200) } : {}),
    ...(g.cadencePromotionCount != null ? { cadencePromotionCount: g.cadencePromotionCount } : {}),
    ...(g.cadenceSuppressionCount != null ? { cadenceSuppressionCount: g.cadenceSuppressionCount } : {}),
    ...(g.cadenceRetryCount != null ? { cadenceRetryCount: g.cadenceRetryCount } : {}),
    ...(g.cadenceStaleCount != null ? { cadenceStaleCount: g.cadenceStaleCount } : {}),
    ...(g.cadenceRetestRecommendationCount != null
      ? { cadenceRetestRecommendationCount: g.cadenceRetestRecommendationCount }
      : {}),
    ...(g.cadenceNextSchedulerAction
      ? { cadenceNextSchedulerAction: MAX_STR(g.cadenceNextSchedulerAction, 800) }
      : {}),
    ...(g.systemHealthScore != null ? { systemHealthScore: g.systemHealthScore } : {}),
    ...(g.topUrgentWorkspace ? { topUrgentWorkspace: MAX_STR(g.topUrgentWorkspace, 200) } : {}),
    ...(g.topOpportunityWorkspace
      ? { topOpportunityWorkspace: MAX_STR(g.topOpportunityWorkspace, 200) }
      : {}),
    ...(g.operatorActionSummary
      ? { operatorActionSummary: MAX_STR(g.operatorActionSummary, 1200) }
      : {}),
    ...(g.leadHandoffBacklogSummary
      ? { leadHandoffBacklogSummary: MAX_STR(g.leadHandoffBacklogSummary, 600) }
      : {}),
    ...(g.connectorGapSummary ? { connectorGapSummary: MAX_STR(g.connectorGapSummary, 600) } : {}),
    ...(g.publishFailureSummary
      ? { publishFailureSummary: MAX_STR(g.publishFailureSummary, 600) }
      : {}),
    ...(g.bentleyCriticalExceptionCount != null
      ? { bentleyCriticalExceptionCount: g.bentleyCriticalExceptionCount }
      : {}),
    ...(g.bentleyTopEscalationLine
      ? { bentleyTopEscalationLine: MAX_STR(g.bentleyTopEscalationLine, 400) }
      : {}),
    ...(g.bentleyOverdueAutomationSummary
      ? { bentleyOverdueAutomationSummary: MAX_STR(g.bentleyOverdueAutomationSummary, 400) }
      : {}),
    ...(g.bentleyNextScheduledAutomationLine
      ? { bentleyNextScheduledAutomationLine: MAX_STR(g.bentleyNextScheduledAutomationLine, 400) }
      : {}),
    ...(g.bentleyReportStatusLine
      ? { bentleyReportStatusLine: MAX_STR(g.bentleyReportStatusLine, 500) }
      : {}),
    ...(g.bentleyNotificationSummaryLine
      ? { bentleyNotificationSummaryLine: MAX_STR(g.bentleyNotificationSummaryLine, 600) }
      : {}),
    ...(g.bentleyCriticalEscalationCount != null
      ? { bentleyCriticalEscalationCount: g.bentleyCriticalEscalationCount }
      : {}),
    ...(g.bentleyUnreadInAppCount != null ? { bentleyUnreadInAppCount: g.bentleyUnreadInAppCount } : {}),
    ...(g.bentleyLastNotificationRunLine
      ? { bentleyLastNotificationRunLine: MAX_STR(g.bentleyLastNotificationRunLine, 400) }
      : {}),
    ...(g.bentleyTopEscalationTargetLine
      ? { bentleyTopEscalationTargetLine: MAX_STR(g.bentleyTopEscalationTargetLine, 400) }
      : {}),
    ...(g.bentleyAutonomousActionSummaryLine
      ? { bentleyAutonomousActionSummaryLine: MAX_STR(g.bentleyAutonomousActionSummaryLine, 600) }
      : {}),
    ...(g.bentleyAutoExecutedCount != null ? { bentleyAutoExecutedCount: g.bentleyAutoExecutedCount } : {}),
    ...(g.bentleyApprovalRequiredCount != null
      ? { bentleyApprovalRequiredCount: g.bentleyApprovalRequiredCount }
      : {}),
    ...(g.bentleyAutonomousFailureCount != null
      ? { bentleyAutonomousFailureCount: g.bentleyAutonomousFailureCount }
      : {}),
    ...(g.bentleyTopApprovalRequestLine
      ? { bentleyTopApprovalRequestLine: MAX_STR(g.bentleyTopApprovalRequestLine, 400) }
      : {}),
    ...(g.bentleyPendingApprovalCount != null ? { bentleyPendingApprovalCount: g.bentleyPendingApprovalCount } : {}),
    ...(g.bentleyExpiringApprovalCount != null ? { bentleyExpiringApprovalCount: g.bentleyExpiringApprovalCount } : {}),
    ...(g.bentleyRecentAutonomousExecutionLine
      ? { bentleyRecentAutonomousExecutionLine: MAX_STR(g.bentleyRecentAutonomousExecutionLine, 400) }
      : {}),
    ...(g.bentleyRecentAutonomousFailureLine
      ? { bentleyRecentAutonomousFailureLine: MAX_STR(g.bentleyRecentAutonomousFailureLine, 400) }
      : {}),
    ...(g.bentleyApprovalQueueSummaryLine
      ? { bentleyApprovalQueueSummaryLine: MAX_STR(g.bentleyApprovalQueueSummaryLine, 600) }
      : {}),
    ...(g.bentleyAuditTrailSummaryLine
      ? { bentleyAuditTrailSummaryLine: MAX_STR(g.bentleyAuditTrailSummaryLine, 600) }
      : {}),
    ...(g.bentleyExplainabilitySummaryLine
      ? { bentleyExplainabilitySummaryLine: MAX_STR(g.bentleyExplainabilitySummaryLine, 600) }
      : {}),
    ...(g.bentleyTopDecisionRationaleLine
      ? { bentleyTopDecisionRationaleLine: MAX_STR(g.bentleyTopDecisionRationaleLine, 600) }
      : {}),
    ...(g.bentleySimulationSummaryLine
      ? { bentleySimulationSummaryLine: MAX_STR(g.bentleySimulationSummaryLine, 600) }
      : {}),
    ...(g.bentleyPolicyDeltaRiskLine
      ? { bentleyPolicyDeltaRiskLine: MAX_STR(g.bentleyPolicyDeltaRiskLine, 600) }
      : {}),
    ...(g.bentleyDeploymentHistorySummaryLine
      ? { bentleyDeploymentHistorySummaryLine: MAX_STR(g.bentleyDeploymentHistorySummaryLine, 600) }
      : {}),
    ...(g.bentleyLatestDeploymentOutcomeLine
      ? { bentleyLatestDeploymentOutcomeLine: MAX_STR(g.bentleyLatestDeploymentOutcomeLine, 600) }
      : {}),
    ...(g.bentleyLinkedRollbackAvailabilityLine
      ? { bentleyLinkedRollbackAvailabilityLine: MAX_STR(g.bentleyLinkedRollbackAvailabilityLine, 600) }
      : {}),
  };
}

function slimIntelligenceDiff(d: MarketIntelligenceDiff): MarketIntelligenceDiff {
  return {
    ...d,
    summary: MAX_STR(d.summary, 1200),
    newTopics: (d.newTopics ?? []).slice(0, 10).map((x) => MAX_STR(x, 400)),
    droppedTopics: (d.droppedTopics ?? []).slice(0, 10).map((x) => MAX_STR(x, 400)),
    strengthenedHooks: (d.strengthenedHooks ?? []).slice(0, 8).map((x) => MAX_STR(x, 400)),
    weakenedHooks: (d.weakenedHooks ?? []).slice(0, 8).map((x) => MAX_STR(x, 400)),
  };
}

function slimSynthesis(s: SynthesizePlanResult): SynthesizePlanResult {
  return {
    ...s,
    consultantPlan: MAX_STR(s.consultantPlan ?? "", 8000),
    campaignBrief: MAX_STR(s.campaignBrief ?? "", 8000),
    campaignAngles: (s.campaignAngles ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 400)),
  };
}

function slimContent(c: ContentEngineOutput): ContentEngineOutput {
  const caps = {
    hook: MAX_STR(c.captions?.hook ?? "", 2000),
    authority: MAX_STR(c.captions?.authority ?? "", 2000),
    curiosity: MAX_STR(c.captions?.curiosity ?? "", 2000),
    controversial: MAX_STR(c.captions?.controversial ?? "", 2000),
    shortViral: MAX_STR(c.captions?.shortViral ?? "", 2000),
  };
  return {
    ...c,
    captions: caps,
    imagePrompts: (c.imagePrompts ?? []).slice(0, 12).map((x) => MAX_STR(String(x), 2000)),
    viralIdeas: (c.viralIdeas ?? []).slice(0, 12).map((v) => ({
      title: MAX_STR(v.title ?? "", 400),
      description: MAX_STR(v.description ?? "", 2000),
    })),
    hooks: (c.hooks ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 500)),
    fullPost: {
      caption: MAX_STR(c.fullPost?.caption ?? "", 12000),
      content: MAX_STR(c.fullPost?.content ?? "", 12000),
      visualPrompt: MAX_STR(c.fullPost?.visualPrompt ?? "", 4000),
      hashtags: (c.fullPost?.hashtags ?? []).slice(0, 40).map((x) => MAX_STR(String(x), 120)),
    },
  };
}

function slimCampaign(c: CampaignResponse): CampaignResponse {
  return {
    ...c,
    offerStatement: MAX_STR(c.offerStatement ?? "", 4000),
    messagePillars: (c.messagePillars ?? []).slice(0, 12).map((x) => MAX_STR(String(x), 2000)),
    shortFormHooks: (c.shortFormHooks ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 800)),
    objectionReplies: (c.objectionReplies ?? []).slice(0, 12).map((x) => MAX_STR(String(x), 2000)),
    disclaimers: (c.disclaimers ?? []).slice(0, 20).map((x) => MAX_STR(String(x), 2000)),
    longFormOutlines: (c.longFormOutlines ?? []).slice(0, 6).map((o) => ({
      ...o,
      title: MAX_STR(o.title ?? "", 400),
      sections: (o.sections ?? []).slice(0, 20).map((x) => MAX_STR(String(x), 2000)),
      cta: MAX_STR(o.cta ?? "", 2000),
    })),
  };
}

function slimBentleySliHandoff(h: BentleyContentBundleHandoff): BentleyContentBundleHandoff {
  return {
    ...h,
    marketSummary: MAX_STR(h.marketSummary, 4000),
    hooks: (h.hooks ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 1200)),
    ctaAngles: (h.ctaAngles ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 1200)),
    offerAngles: (h.offerAngles ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 1200)),
    pillars: (h.pillars ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 1200)),
    whatToPostNext: (h.whatToPostNext ?? []).slice(0, 24).map((x) => MAX_STR(String(x), 1200)),
    topPainThemes: (h.topPainThemes ?? []).slice(0, 24).map((t) => ({
      theme: MAX_STR(t.theme, 200),
      count: t.count,
    })),
    objections: (h.objections ?? []).slice(0, 24).map((o) => ({
      text: MAX_STR(o.text, 800),
      count: o.count,
    })),
    provenance: {
      ...h.provenance,
      filteredLeadRecordIds: (h.provenance.filteredLeadRecordIds ?? []).slice(0, 200),
      filteredAnalysisIds: (h.provenance.filteredAnalysisIds ?? []).slice(0, 200),
    },
  };
}

/** Persisted artifact snapshot — keeps enough for resume + notes assembly, bounded in size. */
export function slimWorkflowArtifacts(a: BentleyWorkflowArtifacts): BentleyWorkflowArtifacts {
  const out: BentleyWorkflowArtifacts = {};
  if (a.research) out.research = slimResearch(a.research);
  if (a.trends) out.trends = slimTrends(a.trends);
  if (a.synthesis) out.synthesis = slimSynthesis(a.synthesis);
  if (a.marketSweep) out.marketSweep = slimMarketSweep(a.marketSweep);
  if (a.contentEngine) out.contentEngine = slimContent(a.contentEngine);
  if (a.campaign) out.campaign = slimCampaign(a.campaign);
  if (a.mediaBriefText != null) {
    out.mediaBriefText = MAX_STR(a.mediaBriefText, 48_000);
  }
  if (a.analysisComplete != null) out.analysisComplete = a.analysisComplete;
  if (a.bentleySliContentHandoff) {
    out.bentleySliContentHandoff = slimBentleySliHandoff(a.bentleySliContentHandoff);
  }
  if (a.bentleyDbCampaignId != null && a.bentleyDbCampaignId !== "") {
    out.bentleyDbCampaignId = a.bentleyDbCampaignId;
  }
  if (a.bentleyLaunchSyncedAt != null && a.bentleyLaunchSyncedAt !== "") {
    out.bentleyLaunchSyncedAt = a.bentleyLaunchSyncedAt;
  }
  if (a.campaignPersistenceError != null && a.campaignPersistenceError !== "") {
    out.campaignPersistenceError = MAX_STR(a.campaignPersistenceError, 800);
  }
  return out;
}
