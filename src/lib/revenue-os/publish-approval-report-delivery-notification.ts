/**
 * In-app notifications: scheduled publish-approval compliance report is ready (Part 23).
 */

import crypto from "crypto";
import { bentleyNotificationEvents } from "@/lib/db/schema";
import type { PublishApprovalReportFormat } from "@/lib/revenue-os/publish-approval-report-schedule";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const CAMPAIGN_PUBLISH_APPROVAL_REPORT_SOURCE_TYPE = "campaign_publish_approval_report" as const;
export const PUBLISH_APPROVAL_REPORT_DELIVERY_EVENT_TYPE = "publish_approval_compliance_report_ready" as const;

export async function createPublishApprovalComplianceReportDeliveryNotifications(
  db: Db,
  args: {
    recipientUserIds: number[];
    clientId: string;
    campaignId: string;
    campaignName: string;
    format: PublishApprovalReportFormat;
    deliveryWindowKey: string;
    /** Relative API path for clients that can build absolute URLs. */
    reportApiPath: string;
  }
): Promise<number> {
  const name = args.campaignName.slice(0, 200);
  const fmt = args.format === "csv" ? "CSV" : "JSON";
  const title = "Publish approval report ready";
  const body = `A fresh ${fmt} compliance report is available for campaign "${name}". Open the workflow review panel to export, or call the report API.`;
  let n = 0;
  for (const uid of args.recipientUserIds) {
    if (!Number.isFinite(uid) || uid <= 0) continue;
    const dedupeKey = `compliance_report:${args.campaignId}:${args.deliveryWindowKey}:${uid}`.slice(0, 191);
    await db.insert(bentleyNotificationEvents).values({
      id: crypto.randomUUID(),
      userId: String(uid),
      clientId: args.clientId,
      trustId: "",
      sourceType: CAMPAIGN_PUBLISH_APPROVAL_REPORT_SOURCE_TYPE,
      eventType: PUBLISH_APPROVAL_REPORT_DELIVERY_EVENT_TYPE,
      severity: "info",
      title,
      body,
      dedupeKey,
      eventPayloadJson: {
        campaignId: args.campaignId,
        format: args.format,
        reportApiPath: args.reportApiPath,
        deliveryWindowKey: args.deliveryWindowKey,
      },
    });
    n += 1;
  }
  return n;
}
