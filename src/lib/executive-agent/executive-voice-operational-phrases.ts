/**
 * Voice-only phrase detection for Skipper operational queries (no LLM, no server-only).
 */

export type VoiceOperationalQueryKind =
  | "jarva_activity"
  | "smart_trust_activity"
  | "reality_activity"
  | "executive_inbox"
  | "new_registrations"
  | "registration_phone_request"
  | "site_analytics"
  | "revenue_overview";

export type PhoneQueueVoiceCommand = "next" | "repeat" | "skip" | "stop";

export type VoiceOperationalPendingIntent =
  | { intent: "inbox_audio_confirm"; createdAt: string; messageId: string; attachmentId: string }
  | { intent: "registration_phone_offer"; createdAt: string; registrationCount: number }
  | {
      intent: "registration_phone_queue";
      createdAt: string;
      userIds: number[];
      index: number;
    };

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isAffirmativeVoice(input: string): boolean {
  const t = norm(input);
  return /^(yes|yeah|yep|sure|ok|okay|please|go ahead|do it|play it|read it|give me the number|yes boss|yes chief)[!.?]*$/i.test(
    t,
  );
}

export function isNegativeVoice(input: string): boolean {
  const t = norm(input);
  return /^(no|nope|not now|skip|cancel|stop|never mind|no boss|no chief)[!.?]*$/i.test(t);
}

export function resolvePhoneQueueVoiceCommand(input: string): PhoneQueueVoiceCommand | null {
  const t = norm(input);
  if (/^(next|next number|continue|go on)/.test(t)) return "next";
  if (/^(repeat|repeat number|say again|again)/.test(t)) return "repeat";
  if (/^(skip|skip this|skip number)/.test(t)) return "skip";
  if (/^(stop|done|that's all|thats all|end queue)/.test(t)) return "stop";
  return null;
}

export function isRegistrationPhoneRequest(input: string): boolean {
  const t = norm(input);
  if (/phone number.*(new account|registration|pending|onboard)/.test(t)) return true;
  if (/(new account|registration|pending).*(phone number|phone numbers)/.test(t)) return true;
  if (/what is the phone number/.test(t)) return true;
  if (/read (me )?(the )?phone/.test(t)) return true;
  if (/manual onboarding.*phone/.test(t)) return true;
  return false;
}

export function resolveVoiceOperationalQuery(input: string): VoiceOperationalQueryKind | null {
  const t = norm(input);
  if (!t) return null;

  if (isRegistrationPhoneRequest(t)) return "registration_phone_request";

  if (
    /\brevenue overview\b/.test(t) ||
    /\bwhat is (the )?revenue overview\b/.test(t) ||
    /\b(show|open|what is) (the )?revenue\b/.test(t) ||
    /\b(potential earnings|approved account value|monthly recurring revenue|monthly recurring)\b/.test(t) ||
    /\baccount value\b/.test(t)
  ) {
    return "revenue_overview";
  }

  if (
    /\bwhat are (today'?s )?site analytics\b/.test(t) ||
    /\bhow is (the )?site traffic\b/.test(t) ||
    /\bhow many visitors\b/.test(t) ||
    /\bsite traffic today\b/.test(t) ||
    /\btoday'?s site analytics\b/.test(t)
  ) {
    return "site_analytics";
  }
  if (/\bsite analytics\b/.test(t) || /\bpage views?\b/.test(t) && /\btoday\b/.test(t)) {
    return "site_analytics";
  }

  if (
    /\b(jarva|trust records|smart trust)\b/.test(t) &&
    /\b(activity|conversation|spoke|spoken|chat|talked|discussed|any.*today)\b/.test(t)
  ) {
    return /\bsmart trust\b/.test(t) && !/\bjarva\b/.test(t) ? "smart_trust_activity" : "jarva_activity";
  }
  if (/\bsmart trust\b.*\b(activity|conversation|today)\b/.test(t)) return "smart_trust_activity";
  if (/\bjarva\b.*\b(conversation|activity|today)\b/.test(t)) return "jarva_activity";
  if (/\bhas jarva\b/.test(t)) return "jarva_activity";
  if (/\bjarva activity\b/.test(t)) return "jarva_activity";

  if (/\breality\b/.test(t) && /\b(activity|conversation|spoke|chat|today)\b/.test(t)) return "reality_activity";

  if (/\b(check|anything in|what's in|whats in)\b.*\b(inbox|my inbox)\b/.test(t)) return "executive_inbox";
  if (/\b(inbox|my inbox)\b.*\b(today|new|unread|messages?)\b/.test(t)) return "executive_inbox";
  if (
    /\b(executive inbox|inbox)\b/.test(t) &&
    /\b(new message|new messages|any message|unread|signals)\b/.test(t)
  ) {
    return "executive_inbox";
  }
  if (/\bany new messages in the executive inbox\b/.test(t)) return "executive_inbox";

  if (/\bnew registrations?\b/.test(t)) return "new_registrations";

  return null;
}

export function voiceOperationalToolForQuery(kind: VoiceOperationalQueryKind): string {
  switch (kind) {
    case "jarva_activity":
    case "smart_trust_activity":
      return "getJarvaActivityToday";
    case "reality_activity":
      return "getRealityActivityToday";
    case "executive_inbox":
      return "getExecutiveInboxNewMessages";
    case "new_registrations":
    case "registration_phone_request":
      return kind === "registration_phone_request" ? "getNewRegistrationPhoneQueue" : "getNewRegistrationsToday";
    case "site_analytics":
      return "getPlatformAnalyticsSummary";
    case "revenue_overview":
      return "getPendingAccounts";
    default:
      return "getJarvaActivityToday";
  }
}

export function readPendingVoiceOperationalIntent(
  plannerMetaJson: string | null | undefined,
): VoiceOperationalPendingIntent | null {
  if (!plannerMetaJson?.trim()) return null;
  try {
    const o = JSON.parse(plannerMetaJson) as { pendingVoiceIntent?: VoiceOperationalPendingIntent };
    const pi = o.pendingVoiceIntent;
    if (!pi?.intent || typeof pi.createdAt !== "string") return null;
    if (
      pi.intent === "inbox_audio_confirm" &&
      typeof pi.messageId === "string" &&
      typeof pi.attachmentId === "string"
    ) {
      return pi;
    }
    if (pi.intent === "registration_phone_offer" && typeof pi.registrationCount === "number") {
      return pi;
    }
    if (
      pi.intent === "registration_phone_queue" &&
      Array.isArray(pi.userIds) &&
      typeof pi.index === "number"
    ) {
      return pi;
    }
  } catch {
    /* ignore */
  }
  return null;
}
