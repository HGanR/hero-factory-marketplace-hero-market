/**
 * Composes owner/admin publish-approval compliance reports (Part 22).
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { campaignAuditEvents, campaignPosts, campaignReviewerAssignmentAuditEvents } from "@/lib/db/schema";
import { computePublishApprovalAnalytics, type PublishApprovalAnalyticsResult } from "@/lib/revenue-os/publish-approval-analytics";
import { mapReviewerAssignmentAuditRowToApiItem } from "@/lib/revenue-os/campaign-reviewer-assignment-audit";
import type { PublishApprovalChain } from "@/lib/revenue-os/publish-approval-chain";
import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import {
  PUBLISH_APPROVAL_AUDIT_ACTIONS,
  toPublishApprovalAuditRecentApiEvent,
} from "@/lib/revenue-os/publish-approval-audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_DEFAULT = 25;
export const PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MIN = 1;
export const PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MAX = 100;

/** Default cap for stalled posts embedded in the report (sorted by age desc). */
export const PUBLISH_APPROVAL_REPORT_STALLED_LIMIT_DEFAULT = 15;

export type PublishApprovalReportFormat = "json" | "csv";

export function parsePublishApprovalReportQueryParams(sp: URLSearchParams): {
  format: PublishApprovalReportFormat;
  includeCurrentState: boolean;
  includeAuditTail: boolean;
  auditLimit: number;
} {
  const rawFormat = (sp.get("format") ?? "json").trim().toLowerCase();
  const format: PublishApprovalReportFormat = rawFormat === "csv" ? "csv" : "json";

  const ics = sp.get("includeCurrentState");
  const includeCurrentState = ics === null || ics === "" ? true : ics === "true" || ics === "1";

  const iat = sp.get("includeAuditTail");
  const includeAuditTail = iat === null || iat === "" ? true : iat === "true" || iat === "1";

  const limitRaw = parseInt(sp.get("auditLimit") ?? "", 10);
  const auditLimit = Number.isFinite(limitRaw)
    ? Math.min(
        PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MAX,
        Math.max(PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_MIN, limitRaw)
      )
    : PUBLISH_APPROVAL_REPORT_AUDIT_LIMIT_DEFAULT;

  return { format, includeCurrentState, includeAuditTail, auditLimit };
}

export type PublishApprovalChainFieldsFromDetails = {
  approvalStepIndex: number | null;
  approvalStepRole: string | null;
  chainCompleted: boolean | null;
};

export function extractPublishApprovalChainFieldsFromAuditDetails(details: unknown): PublishApprovalChainFieldsFromDetails {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return { approvalStepIndex: null, approvalStepRole: null, chainCompleted: null };
  }
  const d = details as Record<string, unknown>;
  let approvalStepIndex: number | null = null;
  if (typeof d.approvalStepIndex === "number" && Number.isFinite(d.approvalStepIndex)) {
    approvalStepIndex = d.approvalStepIndex;
  } else if (typeof d.approvalStepIndex === "string" && d.approvalStepIndex.trim()) {
    const n = Number(d.approvalStepIndex);
    if (Number.isFinite(n)) approvalStepIndex = n;
  }

  let approvalStepRole: string | null = null;
  if (typeof d.approvalStepRole === "string" && d.approvalStepRole.trim()) {
    approvalStepRole = d.approvalStepRole.trim();
  }

  let chainCompleted: boolean | null = null;
  if (typeof d.chainCompleted === "boolean") {
    chainCompleted = d.chainCompleted;
  }

  return { approvalStepIndex, approvalStepRole, chainCompleted };
}

export type PublishApprovalComplianceAuditRow = {
  action: string;
  postId: string | null;
  actorUserId?: number;
  actorDisplayName?: string;
  reviewerRole?: string;
  approvalStepIndex: number | null;
  approvalStepRole: string | null;
  chainCompleted: boolean | null;
  createdAt: string;
};

export function mapRowToPublishApprovalComplianceAuditRow(row: {
  id: string;
  postId: string | null;
  action: string;
  platform: string | null;
  details: unknown;
  createdAt: Date | string;
}): PublishApprovalComplianceAuditRow {
  const base = toPublishApprovalAuditRecentApiEvent(row);
  const chain = extractPublishApprovalChainFieldsFromAuditDetails(row.details);
  return {
    action: base.action,
    postId: base.postId,
    actorUserId: base.actorUserId,
    actorDisplayName: base.actorDisplayName,
    reviewerRole: base.reviewerRole,
    approvalStepIndex: chain.approvalStepIndex,
    approvalStepRole: chain.approvalStepRole,
    chainCompleted: chain.chainCompleted,
    createdAt: base.createdAt,
  };
}

export type ReviewerAssignmentComplianceAuditRow = {
  action: string;
  targetUserId: number;
  actorUserId: number;
  previousRole: string | null;
  nextRole: string | null;
  createdAt: string;
};

export function mapReviewerAssignmentAuditRowToComplianceItem(
  row: typeof campaignReviewerAssignmentAuditEvents.$inferSelect
): ReviewerAssignmentComplianceAuditRow {
  const full = mapReviewerAssignmentAuditRowToApiItem(row);
  return {
    action: full.action,
    targetUserId: full.targetUserId,
    actorUserId: full.actorUserId,
    previousRole: full.previousRole,
    nextRole: full.nextRole,
    createdAt: full.createdAt,
  };
}

export type PublishApprovalComplianceReport = {
  generatedAt: string;
  campaign: {
    campaignId: string;
    campaignName: string;
    publishApprovalChain: PublishApprovalChain | null;
  };
  currentState?: {
    summary: PublishApprovalAnalyticsResult["summary"];
    stalledPosts: PublishApprovalAnalyticsResult["stalledPosts"];
  };
  publishApprovalAuditTail?: PublishApprovalComplianceAuditRow[];
  reviewerAssignmentAuditTail?: ReviewerAssignmentComplianceAuditRow[];
};

export function composePublishApprovalComplianceReport(args: {
  generatedAt: Date;
  campaignId: string;
  campaignName: string;
  publishApprovalChainJson: unknown;
  workerRequiresApproval: boolean;
  postRows: { id: string; utmParams: unknown }[];
  includeCurrentState: boolean;
  includeAuditTail: boolean;
  publishApprovalAuditTail?: PublishApprovalComplianceAuditRow[];
  reviewerAssignmentAuditTail?: ReviewerAssignmentComplianceAuditRow[];
  stalledPostsLimit?: number;
}): PublishApprovalComplianceReport {
  const publishApprovalChain = parseCampaignPublishApprovalChainJson(args.publishApprovalChainJson ?? null);
  const out: PublishApprovalComplianceReport = {
    generatedAt: args.generatedAt.toISOString(),
    campaign: {
      campaignId: args.campaignId,
      campaignName: args.campaignName,
      publishApprovalChain,
    },
  };

  if (args.includeCurrentState) {
    const analytics = computePublishApprovalAnalytics({
      posts: args.postRows,
      publishApprovalChain,
      workerRequiresApproval: args.workerRequiresApproval,
      stalledPostsLimit: args.stalledPostsLimit ?? PUBLISH_APPROVAL_REPORT_STALLED_LIMIT_DEFAULT,
    });
    out.currentState = {
      summary: analytics.summary,
      stalledPosts: analytics.stalledPosts,
    };
  }

  if (args.includeAuditTail) {
    out.publishApprovalAuditTail = args.publishApprovalAuditTail ?? [];
    out.reviewerAssignmentAuditTail = args.reviewerAssignmentAuditTail ?? [];
  }

  return out;
}

export async function fetchPublishApprovalAuditTailForCampaign(
  db: Db,
  args: { campaignId: string; limit: number }
): Promise<PublishApprovalComplianceAuditRow[]> {
  const rows = await db
    .select({
      id: campaignAuditEvents.id,
      postId: campaignAuditEvents.postId,
      action: campaignAuditEvents.action,
      platform: campaignAuditEvents.platform,
      details: campaignAuditEvents.details,
      createdAt: campaignAuditEvents.createdAt,
    })
    .from(campaignAuditEvents)
    .innerJoin(campaignPosts, eq(campaignAuditEvents.postId, campaignPosts.id))
    .where(
      and(
        eq(campaignPosts.campaignId, args.campaignId),
        inArray(campaignAuditEvents.action, PUBLISH_APPROVAL_AUDIT_ACTIONS)
      )
    )
    .orderBy(desc(campaignAuditEvents.createdAt))
    .limit(args.limit);

  return rows.map((r: (typeof rows)[number]) =>
    mapRowToPublishApprovalComplianceAuditRow({
      id: r.id,
      postId: r.postId ?? null,
      action: r.action,
      platform: r.platform ?? null,
      details: r.details,
      createdAt: r.createdAt,
    })
  );
}

export async function fetchReviewerAssignmentAuditTailForCampaign(
  db: Db,
  args: { campaignId: string; limit: number }
): Promise<ReviewerAssignmentComplianceAuditRow[]> {
  const rows = await db
    .select()
    .from(campaignReviewerAssignmentAuditEvents)
    .where(eq(campaignReviewerAssignmentAuditEvents.campaignId, args.campaignId))
    .orderBy(desc(campaignReviewerAssignmentAuditEvents.createdAt))
    .limit(args.limit);

  return rows.map(mapReviewerAssignmentAuditRowToComplianceItem);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function rowToCsv(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

/**
 * Simple multi-section CSV: stalled posts, then publish-approval audit, then reviewer assignment audit.
 */
export function buildPublishApprovalComplianceReportCsv(report: PublishApprovalComplianceReport): string {
  const lines: string[] = [];

  lines.push(
    rowToCsv([
      "row_kind",
      "postId",
      "approvalStatus",
      "stepIndex",
      "totalSteps",
      "requiredRole",
      "ageMs",
      "ageLabel",
      "overdue",
    ])
  );
  for (const p of report.currentState?.stalledPosts ?? []) {
    lines.push(
      rowToCsv([
        "stalled",
        p.postId,
        p.approvalStatus,
        String(p.currentApprovalStepIndex),
        p.totalApprovalSteps != null ? String(p.totalApprovalSteps) : "",
        p.currentApprovalRequiredRole ?? "",
        p.approvalStepAgeMs != null ? String(p.approvalStepAgeMs) : "",
        p.approvalStepAgeShortLabel ?? "",
        p.approvalStepOverdue ? "true" : "false",
      ])
    );
  }

  lines.push("");
  lines.push(
    rowToCsv([
      "row_kind",
      "action",
      "postId",
      "actorUserId",
      "actorDisplayName",
      "reviewerRole",
      "approvalStepIndex",
      "approvalStepRole",
      "chainCompleted",
      "createdAt",
    ])
  );
  for (const e of report.publishApprovalAuditTail ?? []) {
    lines.push(
      rowToCsv([
        "publish_approval_audit",
        e.action,
        e.postId ?? "",
        e.actorUserId != null ? String(e.actorUserId) : "",
        e.actorDisplayName ?? "",
        e.reviewerRole ?? "",
        e.approvalStepIndex != null ? String(e.approvalStepIndex) : "",
        e.approvalStepRole ?? "",
        e.chainCompleted != null ? String(e.chainCompleted) : "",
        e.createdAt,
      ])
    );
  }

  lines.push("");
  lines.push(rowToCsv(["row_kind", "action", "targetUserId", "actorUserId", "previousRole", "nextRole", "createdAt"]));
  for (const e of report.reviewerAssignmentAuditTail ?? []) {
    lines.push(
      rowToCsv([
        "reviewer_assignment_audit",
        e.action,
        String(e.targetUserId),
        String(e.actorUserId),
        e.previousRole ?? "",
        e.nextRole ?? "",
        e.createdAt,
      ])
    );
  }

  lines.push("");
  lines.push(
    rowToCsv([
      "row_kind",
      "pendingApprovalCount",
      "overdueApprovalCount",
      "oldestPendingStepAgeMs",
      "campaignId",
      "campaignName",
    ])
  );
  const s = report.currentState?.summary;
  lines.push(
    rowToCsv([
      "summary",
      s != null ? String(s.pendingApprovalCount) : "",
      s != null ? String(s.overdueApprovalCount) : "",
      s != null && s.oldestPendingStepAgeMs != null ? String(s.oldestPendingStepAgeMs) : "",
      report.campaign.campaignId,
      report.campaign.campaignName,
    ])
  );

  return lines.join("\n");
}
