import { createHash } from "crypto";
import { logEngagementIngestDebug } from "@/lib/social/engagement/engagement-ingest-debug";
import type { SocialEngagementSourceType } from "@/lib/social/engagement/social-engagement-capabilities";

/**
 * Ingestion input after validation — provider fetch / webhook / dev seed.
 */
export type NormalizedEngagementIngest = {
  userId: string;
  clientId: string;
  campaignId: string | null;
  socialAccountId: string;
  provider: string;
  externalThreadId: string;
  sourceType: SocialEngagementSourceType;
  lastMessageAt: Date | null;
  previewText: string;
  message: {
    externalMessageId: string;
    direction: "inbound" | "outbound" | "note" | "ai_suggestion";
    authorDisplay: string | null;
    messageText: string;
    createdAt: Date;
    rawPayload: unknown;
  };
  /** Optional: campaign post / Social Studio lineage */
  metadataJson: Record<string, unknown> | null;
};

const SOURCE: readonly SocialEngagementSourceType[] = [
  "comment",
  "dm",
  "mention",
  "reply",
  "ad_comment",
  "unknown",
];

function isSourceType(s: string): s is SocialEngagementSourceType {
  return (SOURCE as readonly string[]).includes(s);
}

/** Stable idempotency / logging key: provider + thread + message (not a DB unique key). */
export function engagementIngestEventFingerprint(args: { provider: string; externalThreadId: string; externalMessageId: string }): string {
  return createHash("sha256")
    .update([args.provider, args.externalThreadId, args.externalMessageId].join("\u0001"))
    .digest("hex")
    .slice(0, 32);
}

function normalizeProvider(p: string): string {
  const s = String(p ?? "").trim().toLowerCase();
  if (!s) {
    throw new Error("VALIDATION: provider required in ingest context");
  }
  if (s.length > 32) {
    throw new Error("VALIDATION: provider too long");
  }
  return s;
}

export function coalesceEventTimestamp(d: unknown, label: "lastMessageAt" | "message.createdAt"): Date {
  if (d == null) {
    return new Date();
  }
  const t = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(t.getTime())) {
    logEngagementIngestDebug("invalid_timestamp", { field: label, value: d });
    return new Date();
  }
  return t;
}

/**
 * Coerce a loose provider event into a normalized shape (fails with Error if invalid).
 */
export function normalizeEngagementEvent(
  input: unknown,
  ctx: { userId: string; clientId: string; socialAccountId: string; provider: string }
): NormalizedEngagementIngest {
  const provider = normalizeProvider(ctx.provider);
  if (!input || typeof input !== "object") {
    throw new Error("VALIDATION: event not an object");
  }
  const o = input as Record<string, unknown>;
  const externalThreadId = String(o.externalThreadId ?? o.threadId ?? "").trim();
  if (!externalThreadId) throw new Error("VALIDATION: missing externalThreadId");
  const st = String(o.sourceType ?? "unknown");
  if (!isSourceType(st)) throw new Error("VALIDATION: invalid sourceType");
  const em = o.message;
  if (!em || typeof em !== "object") throw new Error("VALIDATION: missing message");
  const m = em as Record<string, unknown>;
  const externalMessageId = String(m.externalMessageId ?? m.id ?? "").trim();
  if (!externalMessageId) throw new Error("VALIDATION: missing message id");
  const direction = String(m.direction ?? "inbound");
  if (direction !== "inbound" && direction !== "outbound" && direction !== "note" && direction !== "ai_suggestion") {
    throw new Error("VALIDATION: invalid direction");
  }
  return {
    userId: ctx.userId,
    clientId: ctx.clientId,
    campaignId: o.campaignId != null && String(o.campaignId).trim() ? String(o.campaignId).trim() : null,
    socialAccountId: ctx.socialAccountId,
    provider,
    externalThreadId,
    sourceType: st,
    lastMessageAt: coalesceEventTimestamp(o.lastMessageAt, "lastMessageAt"),
    previewText: String(m.messageText ?? m.text ?? "").slice(0, 500),
    message: {
      externalMessageId,
      direction: direction as NormalizedEngagementIngest["message"]["direction"],
      authorDisplay: m.authorDisplay != null ? String(m.authorDisplay) : null,
      messageText: String(m.messageText ?? m.text ?? ""),
      createdAt: coalesceEventTimestamp(m.createdAt, "message.createdAt"),
      rawPayload: o.raw ?? m,
    },
    metadataJson:
      o.metadata && typeof o.metadata === "object" && !Array.isArray(o.metadata)
        ? (o.metadata as Record<string, unknown>)
        : null,
  };
}
