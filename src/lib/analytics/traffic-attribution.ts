/**
 * First-touch style attribution fields for `site_analytics_events`.
 * UTM parameters win; otherwise referrer host / path hints; otherwise "direct".
 */

export type TrafficAttribution = {
  source: string;
  medium: string;
  campaign: string;
  referrer: string;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function hostFromUrl(raw: string | null | undefined): string {
  const t = norm(raw);
  if (!t) return "";
  try {
    if (!t.includes("://")) return new URL(`https://${t}`).hostname.toLowerCase();
    return new URL(t).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function platformHintFromHost(host: string): string | null {
  const h = host.toLowerCase();
  if (!h) return null;
  if (h.includes("facebook.") || h === "fb.com" || h.includes("l.facebook.com")) return "facebook";
  if (h.includes("instagram.")) return "instagram";
  if (h.includes("linkedin.")) return "linkedin";
  if (h.includes("tiktok.")) return "tiktok";
  if (h.includes("youtube.") || h === "youtu.be") return "youtube";
  if (h.includes("nextdoor.")) return "nextdoor";
  if (h === "t.co" || h.includes("twitter.") || h.includes("x.com")) return "twitter";
  if (h.includes("google.") || h === "g.co") return "google";
  return null;
}

export type AttributionInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrerUrl?: string | null;
  userAgent?: string | null;
};

export function resolveTrafficAttribution(input: AttributionInput): TrafficAttribution {
  const utmSource = norm(input.utmSource);
  const utmMedium = norm(input.utmMedium);
  const utmCampaign = norm(input.utmCampaign);
  if (utmSource) {
    return {
      source: utmSource.toLowerCase().slice(0, 64),
      medium: (utmMedium || "utm").toLowerCase().slice(0, 64),
      campaign: utmCampaign.slice(0, 128),
      referrer: norm(input.referrerUrl).slice(0, 2000),
    };
  }

  const ref = norm(input.referrerUrl);
  const host = hostFromUrl(ref);
  const hint = platformHintFromHost(host);
  if (hint) {
    return {
      source: hint,
      medium: "referral",
      campaign: "",
      referrer: ref.slice(0, 2000),
    };
  }
  if (host) {
    return {
      source: host.replace(/^www\./, "").slice(0, 64),
      medium: "referral",
      campaign: "",
      referrer: ref.slice(0, 2000),
    };
  }

  const ua = norm(input.userAgent).toLowerCase();
  if (ua.includes("instagram")) return { source: "instagram", medium: "app", campaign: "", referrer: ref.slice(0, 2000) };
  if (ua.includes("fbav") || ua.includes("fban")) return { source: "facebook", medium: "app", campaign: "", referrer: ref.slice(0, 2000) };

  return {
    source: "direct",
    medium: "none",
    campaign: "",
    referrer: ref.slice(0, 2000),
  };
}

export function parseUtmFromUrl(href: string): Pick<AttributionInput, "utmSource" | "utmMedium" | "utmCampaign"> {
  try {
    const u = new URL(href, "https://placeholder.local");
    return {
      utmSource: u.searchParams.get("utm_source"),
      utmMedium: u.searchParams.get("utm_medium"),
      utmCampaign: u.searchParams.get("utm_campaign"),
    };
  } catch {
    return { utmSource: null, utmMedium: null, utmCampaign: null };
  }
}
