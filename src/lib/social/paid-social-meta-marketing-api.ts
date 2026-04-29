/**
 * Narrow Meta Marketing API client (Part 49). Graph v21.0 — form-encoded POSTs.
 * Errors normalized for operator logs; does not hide Meta failure details.
 */

export const META_MARKETING_GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${META_MARKETING_GRAPH_VERSION}`;

export class MetaMarketingApiError extends Error {
  readonly metaCode?: number;
  readonly errorSubcode?: number;
  readonly errorUserTitle?: string;
  readonly raw?: unknown;

  constructor(message: string, opts?: { metaCode?: number; errorSubcode?: number; errorUserTitle?: string; raw?: unknown }) {
    super(message);
    this.metaCode = opts?.metaCode;
    this.errorSubcode = opts?.errorSubcode;
    this.errorUserTitle = opts?.errorUserTitle;
    this.raw = opts?.raw;
  }
}

function normalizeActId(adAccountId: string): string {
  const d = adAccountId.replace(/^act_/i, "").trim();
  return d ? `act_${d}` : "";
}

async function graphFormPost(path: string, accessToken: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", accessToken);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === "") continue;
    body.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string; code?: number; error_subcode?: number; error_user_title?: string };
  };
  if (!res.ok || j.error) {
    const e = j.error;
    throw new MetaMarketingApiError(e?.message || `Meta API HTTP ${res.status}`, {
      metaCode: e?.code,
      errorSubcode: e?.error_subcode,
      errorUserTitle: e?.error_user_title,
      raw: j,
    });
  }
  return j as Record<string, unknown>;
}

/** GET JSON from Graph (insights, node fields). */
export async function metaGraphGet(
  path: string,
  accessToken: string,
  query: Record<string, string | undefined> = {}
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { method: "GET" });
  const j = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_subcode?: number; error_user_title?: string };
    data?: unknown;
  };
  if (!res.ok || j.error) {
    const e = j.error;
    throw new MetaMarketingApiError(e?.message || `Meta API HTTP ${res.status}`, {
      metaCode: e?.code,
      errorSubcode: e?.error_subcode,
      errorUserTitle: e?.error_user_title,
      raw: j,
    });
  }
  return j as Record<string, unknown>;
}

export function mapDraftObjectiveToMetaCampaignObjective(objective: string): "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" {
  const o = objective.trim().toLowerCase();
  if (o === "engagement") return "OUTCOME_ENGAGEMENT";
  return "OUTCOME_TRAFFIC";
}

export function mapOptimizationGoalForObjective(objective: string): "LINK_CLICKS" | "POST_ENGAGEMENT" {
  return objective.trim().toLowerCase() === "engagement" ? "POST_ENGAGEMENT" : "LINK_CLICKS";
}

export type MetaPlacementTargeting = {
  publisher_platforms: string[];
  facebook_positions: string[];
  instagram_positions: string[];
};

/** Map Part 48 placement ids to Meta targeting positions (v1 subset). */
export function buildMetaTargetingFromPlacements(placements: string[]): MetaPlacementTargeting {
  const pub = new Set<string>();
  const fbPos = new Set<string>();
  const igPos = new Set<string>();
  for (const p of placements) {
    switch (p) {
      case "facebook_feed":
        pub.add("facebook");
        fbPos.add("feed");
        break;
      case "facebook_stories":
        pub.add("facebook");
        fbPos.add("story");
        break;
      case "facebook_reels":
        pub.add("facebook");
        fbPos.add("facebook_reels");
        break;
      case "instagram_feed":
        pub.add("instagram");
        igPos.add("stream");
        break;
      case "instagram_stories":
        pub.add("instagram");
        igPos.add("story");
        break;
      case "instagram_reels":
        pub.add("instagram");
        igPos.add("reels");
        break;
      default:
        break;
    }
  }
  return {
    publisher_platforms: Array.from(pub),
    facebook_positions: Array.from(fbPos),
    instagram_positions: Array.from(igPos),
  };
}

export function buildTargetingJson(args: {
  placements: string[];
  geographyNotes?: string | null;
  ageMin?: number;
  ageMax?: number;
}): Record<string, unknown> {
  const countries = parseCountriesFromGeography(args.geographyNotes);
  const { publisher_platforms, facebook_positions, instagram_positions } = buildMetaTargetingFromPlacements(
    args.placements
  );
  const targeting: Record<string, unknown> = {
    geo_locations: { countries },
  };
  if (publisher_platforms.length) targeting.publisher_platforms = publisher_platforms;
  if (facebook_positions.length) targeting.facebook_positions = facebook_positions;
  if (instagram_positions.length) targeting.instagram_positions = instagram_positions;
  if (args.ageMin != null || args.ageMax != null) {
    targeting.age_min = args.ageMin ?? 18;
    targeting.age_max = args.ageMax ?? 65;
  }
  return targeting;
}

function parseCountriesFromGeography(geo?: string | null): string[] {
  if (!geo?.trim()) return ["US"];
  const parts = geo
    .split(/[,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));
  return parts.length ? parts : ["US"];
}

export async function metaUploadAdImageFromUrl(args: {
  accessToken: string;
  adAccountActId: string;
  imageUrl: string;
}): Promise<{ hash: string }> {
  const act = normalizeActId(args.adAccountActId);
  const j = await graphFormPost(`/${act}/adimages`, args.accessToken, {
    url: args.imageUrl,
  });
  const images = j.images as Record<string, { hash?: string }> | undefined;
  const firstKey = images ? Object.keys(images)[0] : null;
  const hash = firstKey && images?.[firstKey]?.hash ? String(images[firstKey]!.hash) : "";
  if (!hash) {
    throw new MetaMarketingApiError("Meta ad image upload did not return a hash.", { raw: j });
  }
  return { hash };
}

export async function metaCreateCampaign(args: {
  accessToken: string;
  adAccountActId: string;
  name: string;
  objective: "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT";
}): Promise<{ id: string }> {
  const act = normalizeActId(args.adAccountActId);
  const j = await graphFormPost(`/${act}/campaigns`, args.accessToken, {
    name: args.name.slice(0, 200),
    objective: args.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
  });
  const id = j.id != null ? String(j.id) : "";
  if (!id) throw new MetaMarketingApiError("Meta campaign create missing id.", { raw: j });
  return { id };
}

export async function metaCreateAdSet(args: {
  accessToken: string;
  adAccountActId: string;
  name: string;
  campaignId: string;
  dailyBudgetMinor?: number | null;
  lifetimeBudgetMinor?: number | null;
  optimizationGoal: "LINK_CLICKS" | "POST_ENGAGEMENT";
  targeting: Record<string, unknown>;
  destinationUrl: string;
}): Promise<{ id: string }> {
  const act = normalizeActId(args.adAccountActId);
  const fields: Record<string, string> = {
    name: args.name.slice(0, 200),
    campaign_id: args.campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: args.optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(args.targeting),
    status: "PAUSED",
    promoted_object: JSON.stringify({ link: args.destinationUrl }),
  };
  if (args.dailyBudgetMinor != null && args.dailyBudgetMinor > 0) {
    fields.daily_budget = String(args.dailyBudgetMinor);
  } else if (args.lifetimeBudgetMinor != null && args.lifetimeBudgetMinor > 0) {
    fields.lifetime_budget = String(args.lifetimeBudgetMinor);
  } else {
    throw new MetaMarketingApiError("Meta ad set requires daily_budget or lifetime_budget (minor units).");
  }
  const j = await graphFormPost(`/${act}/adsets`, args.accessToken, fields);
  const id = j.id != null ? String(j.id) : "";
  if (!id) throw new MetaMarketingApiError("Meta ad set create missing id.", { raw: j });
  return { id };
}

export async function metaCreateAdCreativeLink(args: {
  accessToken: string;
  adAccountActId: string;
  name: string;
  pageId: string;
  link: string;
  message: string;
  imageHash: string;
  ctaType: string;
}): Promise<{ id: string }> {
  const act = normalizeActId(args.adAccountActId);
  const linkData: Record<string, unknown> = {
    link: args.link,
    message: args.message.slice(0, 2000),
    image_hash: args.imageHash,
    call_to_action: {
      type: args.ctaType,
      value: { link: args.link },
    },
  };
  const objectStorySpec = {
    page_id: args.pageId,
    link_data: linkData,
  };
  const j = await graphFormPost(`/${act}/adcreatives`, args.accessToken, {
    name: args.name.slice(0, 200),
    object_story_spec: JSON.stringify(objectStorySpec),
  });
  const id = j.id != null ? String(j.id) : "";
  if (!id) throw new MetaMarketingApiError("Meta ad creative create missing id.", { raw: j });
  return { id };
}

export async function metaCreateAd(args: {
  accessToken: string;
  adAccountActId: string;
  name: string;
  adsetId: string;
  creativeId: string;
}): Promise<{ id: string }> {
  const act = normalizeActId(args.adAccountActId);
  const j = await graphFormPost(`/${act}/ads`, args.accessToken, {
    name: args.name.slice(0, 200),
    adset_id: args.adsetId,
    creative: JSON.stringify({ creative_id: args.creativeId }),
    status: "PAUSED",
  });
  const id = j.id != null ? String(j.id) : "";
  if (!id) throw new MetaMarketingApiError("Meta ad create missing id.", { raw: j });
  return { id };
}

export function mapCtaLabelToMetaType(label?: string | null): string {
  const t = (label ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    "SHOP NOW": "SHOP_NOW",
    "LEARN MORE": "LEARN_MORE",
    "SIGN UP": "SIGN_UP",
    "DOWNLOAD": "DOWNLOAD",
    "BOOK NOW": "BOOK_TRAVEL",
    "CONTACT": "CONTACT_US",
  };
  return map[t] || "LEARN_MORE";
}
