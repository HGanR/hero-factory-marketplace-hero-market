"use client";

const VIS_KEY = "hf_site_visitor_id";
const SESS_KEY = "hf_site_session_id";

export function getOrCreateSiteVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let v = window.localStorage.getItem(VIS_KEY)?.trim();
    if (!v || v.length < 8) {
      v = crypto.randomUUID();
      window.localStorage.setItem(VIS_KEY, v);
    }
    return v;
  } catch {
    return `anon_${Date.now()}`;
  }
}

export function getOrCreateSiteSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let s = window.sessionStorage.getItem(SESS_KEY)?.trim();
    if (!s || s.length < 8) {
      s = crypto.randomUUID();
      window.sessionStorage.setItem(SESS_KEY, s);
    }
    return s;
  } catch {
    return `sess_${Date.now()}`;
  }
}

type SiteEventType = "page_view" | "button_click" | "conversion_intent" | "outbound_paypal" | "agent_interaction";

export type TrackSiteEventInput = {
  path: string;
  eventType: SiteEventType;
  referrer?: string | null;
  userAgent?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function trackSiteEvent(input: TrackSiteEventInput): Promise<void> {
  if (typeof window === "undefined") return;
  const sessionId = getOrCreateSiteSessionId();
  const visitorId = getOrCreateSiteVisitorId();
  const sp = new URLSearchParams(window.location.search);
  const utmSource = input.utmSource ?? sp.get("utm_source");
  const utmMedium = input.utmMedium ?? sp.get("utm_medium");
  const utmCampaign = input.utmCampaign ?? sp.get("utm_campaign");
  try {
    await fetch("/api/analytics/site-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sessionId,
        visitorId,
        path: input.path,
        eventType: input.eventType,
        referrer: input.referrer ?? document.referrer ?? null,
        userAgent: input.userAgent ?? navigator.userAgent ?? null,
        utmSource,
        utmMedium,
        utmCampaign,
        metadata: input.metadata ?? null,
      }),
    });
  } catch {
    /* non-fatal */
  }
}
