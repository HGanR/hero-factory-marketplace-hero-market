/**
 * Internal cron: deliver scheduled publish-approval compliance report notifications (Part 23).
 */

import { eq, isNotNull } from "drizzle-orm";
import { campaignReviewerAssignments, campaigns } from "@/lib/db/schema";
import { createPublishApprovalComplianceReportDeliveryNotifications } from "@/lib/revenue-os/publish-approval-report-delivery-notification";
import {
  isPublishApprovalReportDeliveryDue,
  parsePublishApprovalReportScheduleJson,
  publishApprovalReportDeliveryWindowKey,
  type PublishApprovalReportSchedulePersisted,
} from "@/lib/revenue-os/publish-approval-report-schedule";
import {
  type InternalJobBoundedError,
  pushBoundedInternalJobError,
} from "@/lib/revenue-os/internal-batch-job-run";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const DEFAULT_SCAN_LIMIT = 120;

export type PublishApprovalReportDeliveryRunSummary = {
  campaignsScanned: number;
  reportsGenerated: number;
  deliveriesCreated: number;
  errors: number;
};

export type PublishApprovalReportDeliveryRunResult = PublishApprovalReportDeliveryRunSummary & {
  boundedErrors: InternalJobBoundedError[];
};

function collectReportDeliveryRecipientUserIds(args: {
  ownerUserId: string;
  recipientMode: PublishApprovalReportSchedulePersisted["recipientMode"];
  assignmentUserIds: string[];
}): number[] {
  const out = new Set<number>();
  const o = Number(String(args.ownerUserId).trim());
  if (Number.isFinite(o) && o > 0) out.add(o);
  if (args.recipientMode === "owner_and_admins") {
    for (const s of args.assignmentUserIds) {
      const n = Number(String(s).trim());
      if (Number.isFinite(n) && n > 0) out.add(n);
    }
  }
  return [...out];
}

/**
 * Scan campaigns with a non-null schedule JSON; notify when due (one delivery per UTC window).
 */
export async function runPublishApprovalReportDeliveryRun(
  db: Db,
  options?: { now?: Date; scanLimit?: number }
): Promise<PublishApprovalReportDeliveryRunResult> {
  const now = options?.now ?? new Date();
  const scanLimit = Math.min(500, Math.max(1, options?.scanLimit ?? DEFAULT_SCAN_LIMIT));

  const rows = await db
    .select({
      id: campaigns.id,
      userId: campaigns.userId,
      clientId: campaigns.clientId,
      name: campaigns.name,
      publishApprovalReportScheduleJson: campaigns.publishApprovalReportScheduleJson,
    })
    .from(campaigns)
    .where(isNotNull(campaigns.publishApprovalReportScheduleJson))
    .limit(scanLimit);

  let reportsGenerated = 0;
  let deliveriesCreated = 0;
  let errors = 0;
  const boundedErrors: InternalJobBoundedError[] = [];

  for (const row of rows) {
    try {
      const schedule = parsePublishApprovalReportScheduleJson(row.publishApprovalReportScheduleJson);
      if (!schedule || !isPublishApprovalReportDeliveryDue({ schedule, now })) {
        continue;
      }

      const assignRows = await db
        .select({ userId: campaignReviewerAssignments.userId })
        .from(campaignReviewerAssignments)
        .where(eq(campaignReviewerAssignments.campaignId, row.id));

      const recipients = collectReportDeliveryRecipientUserIds({
        ownerUserId: row.userId,
        recipientMode: schedule.recipientMode,
        assignmentUserIds: assignRows.map((r: { userId: string }) => r.userId),
      });

      if (recipients.length === 0) {
        errors += 1;
        pushBoundedInternalJobError(boundedErrors, {
          campaignId: row.id,
          message: "no_delivery_recipients",
        });
        continue;
      }

      const windowKey = publishApprovalReportDeliveryWindowKey(schedule.frequency, now);
      const reportApiPath = `/api/campaigns/${row.id}/publish-approval-report?format=${schedule.format}`;

      const n = await createPublishApprovalComplianceReportDeliveryNotifications(db, {
        recipientUserIds: recipients,
        clientId: row.clientId ?? "",
        campaignId: row.id,
        campaignName: row.name ?? "",
        format: schedule.format,
        deliveryWindowKey: windowKey,
        reportApiPath,
      });

      const nextSchedule: PublishApprovalReportSchedulePersisted = {
        ...schedule,
        lastDeliveryWindowKey: windowKey,
        lastDeliveredAt: now.toISOString(),
      };

      await db
        .update(campaigns)
        .set({
          publishApprovalReportScheduleJson: nextSchedule,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, row.id));

      reportsGenerated += 1;
      deliveriesCreated += n;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[publish-approval-report-delivery-run] campaign failed", row.id, e);
      errors += 1;
      pushBoundedInternalJobError(boundedErrors, { campaignId: row.id, message: msg });
    }
  }

  return {
    campaignsScanned: rows.length,
    reportsGenerated,
    deliveriesCreated,
    errors,
    boundedErrors,
  };
}
