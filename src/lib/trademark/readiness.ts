import type { TrademarkProjectPayload } from "@/lib/trademark/schema";

export type ReadinessBlocker = { code: string; message: string };
export type ReadinessWarning = { code: string; message: string };
export type TrademarkReadiness = {
  score: number;
  filingReady: boolean;
  blockers: ReadinessBlocker[];
  warnings: ReadinessWarning[];
};

function hasAsset(payload: TrademarkProjectPayload, kind: "drawing" | "audio" | "specimen") {
  return payload.assets.some((a) => a.kind === kind);
}

export function evaluateTrademarkReadiness(
  markType: "standard" | "special" | "sound",
  payload: TrademarkProjectPayload
): TrademarkReadiness {
  const blockers: ReadinessBlocker[] = [];
  const warnings: ReadinessWarning[] = [];

  if (!payload.ownerName.trim()) blockers.push({ code: "OWNER_NAME", message: "Owner legal name is required." });
  if (!payload.clientId.trim()) warnings.push({ code: "CLIENT_ID", message: "Client ID is recommended for workspace traceability." });
  if (!payload.workspaceId.trim()) warnings.push({ code: "WORKSPACE_ID", message: "Workspace ID is recommended for project routing." });
  if (!payload.ownerEntityType.trim()) blockers.push({ code: "OWNER_ENTITY", message: "Owner entity type is required." });
  if (!payload.ownerAddress.trim()) blockers.push({ code: "OWNER_ADDRESS", message: "Owner address is required." });
  if (!payload.correspondenceEmail.trim()) blockers.push({ code: "CORRESPONDENCE_EMAIL", message: "Correspondence email is required." });

  if (markType === "standard" && !payload.markText.trim()) {
    blockers.push({ code: "MARK_TEXT", message: "Standard character mark text is required." });
  }
  if (markType === "special" && !hasAsset(payload, "drawing")) {
    blockers.push({ code: "DRAWING_FILE", message: "Special form marks require a drawing/logo upload." });
  }
  if (markType === "sound") {
    if (!hasAsset(payload, "audio")) blockers.push({ code: "AUDIO_FILE", message: "Sound marks require an audio file." });
    if (!payload.soundDescription.trim()) blockers.push({ code: "SOUND_DESCRIPTION", message: "Sound mark description is required." });
  }

  if (!payload.goodsServices.length) {
    blockers.push({ code: "GOODS_SERVICES", message: "Add at least one goods/services entry with class." });
  } else {
    for (const gs of payload.goodsServices) {
      if (!gs.classNo.trim()) blockers.push({ code: "CLASS_MISSING", message: `Goods/service "${gs.description || gs.id}" is missing class.` });
      if (!gs.description.trim()) blockers.push({ code: "DESCRIPTION_MISSING", message: `Goods/service in class ${gs.classNo || "?"} needs description.` });
    }
  }

  if (payload.basis === "use") {
    if (!payload.firstUseDate.trim() || !payload.firstCommerceDate.trim()) {
      blockers.push({ code: "USE_DATES", message: "Use-based filing requires first use dates." });
    }
    if (!hasAsset(payload, "specimen")) {
      blockers.push({ code: "SPECIMEN_REQUIRED", message: "Use-based filing requires at least one specimen." });
    }
  } else if (payload.basis === "intent") {
    if (!hasAsset(payload, "specimen")) {
      warnings.push({ code: "SPECIMEN_LATER", message: "Intent-to-use can file now, but specimen is required later with Statement of Use." });
    }
  }

  if (markType === "special" && payload.colorClaim.trim() && !hasAsset(payload, "drawing")) {
    warnings.push({ code: "COLOR_WITHOUT_DRAWING", message: "Color claim provided but no drawing asset uploaded." });
  }
  if (!payload.disclaimerText.trim()) {
    warnings.push({ code: "DISCLAIMER_REVIEW", message: "Review whether descriptive wording needs disclaimer text." });
  }

  const penalty = blockers.length * 20 + warnings.length * 4;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return {
    score,
    filingReady: blockers.length === 0,
    blockers,
    warnings,
  };
}
