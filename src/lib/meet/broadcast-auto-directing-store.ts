import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastAutoDirectingStates } from "@/lib/db/schema";
import type { BroadcastAutoDirectingDecision, BroadcastAutoDirectingDebounceState, BroadcastAutoDirectingPolicy } from "./broadcast-auto-directing";
import { getDefaultBroadcastAutoDirectingPolicy, validateBroadcastAutoDirectingPolicy } from "./broadcast-auto-directing";
import type { BroadcastLayoutMode } from "./broadcast-scene";
import { isManualAutoDirectingOverrideActive } from "./broadcast-auto-directing";

export type BroadcastAutoDirectingPersistedState = {
  policy: BroadcastAutoDirectingPolicy;
  lastDecision: BroadcastAutoDirectingDecision | null;
  lastAppliedAt: string | null;
  lastAppliedLayoutMode: BroadcastLayoutMode | null;
  manualOverrideUntilIso: string | null;
  updatedByUserId: number;
  debounce: BroadcastAutoDirectingDebounceState;
};

function defaultState(userId: number): BroadcastAutoDirectingPersistedState {
  return {
    policy: getDefaultBroadcastAutoDirectingPolicy(),
    lastDecision: null,
    lastAppliedAt: null,
    lastAppliedLayoutMode: null,
    manualOverrideUntilIso: null,
    updatedByUserId: userId,
    debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
  };
}

function parseState(
  broadcastSessionId: number,
  userId: number,
  json: Record<string, unknown>
): BroadcastAutoDirectingPersistedState {
  const base = defaultState(userId);
  const pol = validateBroadcastAutoDirectingPolicy(json.policy);
  const policy = pol.ok ? pol.policy : base.policy;
  const lastDecision = json.lastDecision as BroadcastAutoDirectingDecision | null;
  const deb = json.debounce as Record<string, unknown> | null;
  const debounce: BroadcastAutoDirectingDebounceState = {
    lastDominantSpeakerId:
      typeof deb?.lastDominantSpeakerId === "string" ? deb.lastDominantSpeakerId : base.debounce.lastDominantSpeakerId,
    lastFlipAtIso: typeof deb?.lastFlipAtIso === "string" ? deb.lastFlipAtIso : base.debounce.lastFlipAtIso,
  };
  void broadcastSessionId;
  return {
    policy,
    lastDecision: lastDecision && typeof lastDecision === "object" ? lastDecision : null,
    lastAppliedAt: typeof json.lastAppliedAt === "string" ? json.lastAppliedAt : null,
    lastAppliedLayoutMode:
      typeof json.lastAppliedLayoutMode === "string" ? (json.lastAppliedLayoutMode as BroadcastLayoutMode) : null,
    manualOverrideUntilIso: typeof json.manualOverrideUntilIso === "string" ? json.manualOverrideUntilIso : null,
    updatedByUserId: typeof json.updatedByUserId === "number" ? json.updatedByUserId : userId,
    debounce,
  };
}

export async function getBroadcastAutoDirectingState(
  broadcastSessionId: number
): Promise<BroadcastAutoDirectingPersistedState | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastAutoDirectingStates)
    .where(eq(meetBroadcastAutoDirectingStates.broadcastSessionId, broadcastSessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return parseState(broadcastSessionId, row.userId, row.directingStateJson as Record<string, unknown>);
}

export async function upsertBroadcastAutoDirectingState(params: {
  broadcastSessionId: number;
  userId: number;
  state: BroadcastAutoDirectingPersistedState;
}): Promise<void> {
  const db = await getDb();
  const payload = { ...params.state } as unknown as Record<string, unknown>;
  await db
    .insert(meetBroadcastAutoDirectingStates)
    .values({
      broadcastSessionId: params.broadcastSessionId,
      userId: params.userId,
      directingStateJson: payload,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: params.userId,
        directingStateJson: payload,
        updatedAt: new Date(),
      },
    });
}

export async function resetBroadcastAutoDirectingState(broadcastSessionId: number, userId: number): Promise<void> {
  const db = await getDb();
  await db
    .delete(meetBroadcastAutoDirectingStates)
    .where(eq(meetBroadcastAutoDirectingStates.broadcastSessionId, broadcastSessionId));
  void userId;
}

export async function ensureBroadcastAutoDirectingStateForSession(
  broadcastSessionId: number,
  userId: number
): Promise<BroadcastAutoDirectingPersistedState> {
  const row = await getBroadcastAutoDirectingState(broadcastSessionId);
  if (row) return row;
  return defaultState(userId);
}

export type BroadcastAutoDirectingPublicSummary = {
  mode: BroadcastAutoDirectingPolicy["mode"];
  latestRecommendedLayout: BroadcastLayoutMode | null;
  latestReason: string | null;
  latestConfidence: BroadcastAutoDirectingDecision["confidence"] | null;
  manualOverrideActive: boolean;
  lastAppliedAt: string | null;
};

export function buildAutoDirectingPublicSummary(
  state: BroadcastAutoDirectingPersistedState | null,
  nowIso: string
): BroadcastAutoDirectingPublicSummary | null {
  if (!state) return null;
  return {
    mode: state.policy.mode,
    latestRecommendedLayout: state.lastDecision?.recommendedLayoutMode ?? null,
    latestReason: state.lastDecision?.reason ?? null,
    latestConfidence: state.lastDecision?.confidence ?? null,
    manualOverrideActive: isManualAutoDirectingOverrideActive(state.manualOverrideUntilIso, nowIso),
    lastAppliedAt: state.lastAppliedAt,
  };
}
