import type { EngagementRuleActionsV1, EngagementRuleConditionsV1 } from "./engagement-rule-types";

const INTENTS: EngagementRuleConditionsV1["intentEquals"][] = [
  "lead",
  "question",
  "complaint",
  "booking",
  "spam",
  "praise",
  "unclear",
];
const SENT: EngagementRuleConditionsV1["sentimentEquals"][] = ["positive", "neutral", "negative"];
const SRC: EngagementRuleConditionsV1["sourceTypeEquals"][] = [
  "comment",
  "dm",
  "mention",
  "reply",
  "ad_comment",
  "unknown",
];

export function parseCreateRuleBody(input: {
  conditionsJson: unknown;
  actionsJson: unknown;
}): { conditions: EngagementRuleConditionsV1; actions: EngagementRuleActionsV1 } | { error: string } {
  return validateRulePayload(input.conditionsJson, input.actionsJson);
}

export function parseEngagementRuleJson(o: unknown): { conditions: EngagementRuleConditionsV1; actions: EngagementRuleActionsV1 } | { error: string } {
  if (!o || typeof o !== "object") {
    return { error: "Body must be an object" };
  }
  const b = o as Record<string, unknown>;
  if (!b.conditionsJson || !b.actionsJson) {
    return { error: "conditionsJson and actionsJson are required" };
  }
  return validateRulePayload(
    b.conditionsJson,
    b.actionsJson
  );
}

export function validateRulePayload(conditions: unknown, actions: unknown): { conditions: EngagementRuleConditionsV1; actions: EngagementRuleActionsV1 } | { error: string } {
  if (!conditions || typeof conditions !== "object" || !actions || typeof actions !== "object") {
    return { error: "conditions and actions must be objects" };
  }
  const c = conditions as Record<string, unknown>;
  const a = actions as Record<string, unknown>;
  const outC: EngagementRuleConditionsV1 = {};
  if (c.keywordsAny != null) {
    if (!Array.isArray(c.keywordsAny) || !c.keywordsAny.every((x) => typeof x === "string" && x.trim().length)) {
      return { error: "keywordsAny must be a non-empty string array" };
    }
    outC.keywordsAny = c.keywordsAny.map((x) => String(x).trim());
  }
  if (c.intentEquals != null) {
    if (!INTENTS.includes(c.intentEquals as never)) {
      return { error: "invalid intentEquals" };
    }
    outC.intentEquals = c.intentEquals as typeof outC.intentEquals;
  }
  if (c.sentimentEquals != null) {
    if (!SENT.includes(c.sentimentEquals as never)) {
      return { error: "invalid sentimentEquals" };
    }
    outC.sentimentEquals = c.sentimentEquals as typeof outC.sentimentEquals;
  }
  if (c.sourceTypeEquals != null) {
    if (!SRC.includes(c.sourceTypeEquals as never)) {
      return { error: "invalid sourceTypeEquals" };
    }
    outC.sourceTypeEquals = c.sourceTypeEquals as typeof outC.sourceTypeEquals;
  }
  const hasCond = Object.keys(outC).length > 0;
  if (!hasCond) {
    return { error: "Add at least one condition (e.g. keywordsAny)" };
  }
  const outA: EngagementRuleActionsV1 = {};
  if (a.addLabelSlug != null) {
    if (typeof a.addLabelSlug !== "string" || !a.addLabelSlug.trim()) {
      return { error: "addLabelSlug must be a string" };
    }
    outA.addLabelSlug = a.addLabelSlug.trim().slice(0, 64);
  }
  if (a.addLabelDisplayName != null) {
    if (typeof a.addLabelDisplayName !== "string") {
      return { error: "addLabelDisplayName must be a string" };
    }
    outA.addLabelDisplayName = a.addLabelDisplayName.trim().slice(0, 160);
  }
  if (a.assignRole != null) {
    if (typeof a.assignRole !== "string" || !a.assignRole.trim()) {
      return { error: "assignRole must be a non-empty string" };
    }
    outA.assignRole = a.assignRole.trim().slice(0, 64);
  }
  if (a.attachBentleySuggestion != null) {
    if (typeof a.attachBentleySuggestion !== "boolean") {
      return { error: "attachBentleySuggestion must be boolean" };
    }
    outA.attachBentleySuggestion = a.attachBentleySuggestion;
  }
  if (Object.keys(outA).length === 0) {
    return { error: "Add at least one action" };
  }
  return { conditions: outC, actions: outA };
}

export function rulePreviewSummary(conditions: EngagementRuleConditionsV1, actions: EngagementRuleActionsV1): { conditionsLine: string; actionsLine: string } {
  const parts: string[] = [];
  if (conditions.keywordsAny?.length) {
    parts.push(`keywords: ${conditions.keywordsAny.join(", ")}`);
  }
  if (conditions.intentEquals) {
    parts.push(`intent=${conditions.intentEquals}`);
  }
  if (conditions.sentimentEquals) {
    parts.push(`sentiment=${conditions.sentimentEquals}`);
  }
  if (conditions.sourceTypeEquals) {
    parts.push(`source=${conditions.sourceTypeEquals}`);
  }
  const ap: string[] = [];
  if (actions.addLabelSlug) {
    ap.push(`label “${actions.addLabelSlug}”`);
  }
  if (actions.assignRole) {
    ap.push(`assign role ${actions.assignRole}`);
  }
  if (actions.attachBentleySuggestion) {
    ap.push("attach Bentley suggestion (no auto-send)");
  }
  return { conditionsLine: parts.join(" · ") || "—", actionsLine: ap.join(" · ") || "—" };
}
