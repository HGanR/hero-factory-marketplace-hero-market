import { z } from "zod";
import { resolveTrafficAttribution } from "@/lib/analytics/traffic-attribution";

export const SITE_EVENT_TYPES = [
  "page_view",
  "button_click",
  "conversion_intent",
  "outbound_paypal",
  "agent_interaction",
] as const;

export const SiteEventBodySchema = z.object({
  sessionId: z.string().min(4).max(64),
  visitorId: z.string().min(4).max(64),
  path: z.string().min(1).max(512),
  eventType: z.enum(SITE_EVENT_TYPES),
  referrer: z.string().max(4000).optional().nullable(),
  userAgent: z.string().max(4000).optional().nullable(),
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(200).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type SiteEventBody = z.infer<typeof SiteEventBodySchema>;

export type SiteAnalyticsInsertPayload = {
  id: string;
  sessionId: string;
  visitorId: string;
  path: string;
  eventType: SiteEventBody["eventType"];
  source: string;
  medium: string;
  campaign: string;
  referrer: string | null;
  userAgent: string | null;
  metadataJson: string | null;
};

export function parseSiteEventBody(json: unknown): { ok: true; body: SiteEventBody } | { ok: false; error: z.ZodError } {
  const r = SiteEventBodySchema.safeParse(json);
  if (!r.success) return { ok: false, error: r.error };
  return { ok: true, body: r.data };
}

export function buildSiteAnalyticsInsertPayload(body: SiteEventBody, id: string): SiteAnalyticsInsertPayload {
  const attr = resolveTrafficAttribution({
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    referrerUrl: body.referrer,
    userAgent: body.userAgent,
  });
  return {
    id,
    sessionId: body.sessionId,
    visitorId: body.visitorId,
    path: body.path,
    eventType: body.eventType,
    source: attr.source,
    medium: attr.medium,
    campaign: attr.campaign,
    referrer: attr.referrer || body.referrer || null,
    userAgent: body.userAgent ?? null,
    metadataJson: body.metadata ? JSON.stringify(body.metadata).slice(0, 12_000) : null,
  };
}
