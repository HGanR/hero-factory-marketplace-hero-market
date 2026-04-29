/**
 * REALITY Conversion Layer
 * Every response drives toward: move forward, qualify, or signup.
 */

import type { Intent } from "./reality-intent";

export type UserContext = {
  isRegistered?: boolean;
  hasJoinedCommunity?: boolean;
  username?: string;
  stage?: "curious" | "interested" | "ready";
};

export type ResponseResult = {
  answer: string;
  followUp?: string;
  cta?: string;
};

/**
 * Get CTA based on intent and user stage.
 */
export function getCtaForIntent(
  intent: Intent,
  userContext?: UserContext
): string | undefined {
  const isRegistered = userContext?.isRegistered ?? false;
  const stage = userContext?.stage ?? "curious";

  switch (intent) {
    case "start":
      return isRegistered
        ? "Book a Strategy Call"
        : "Get Your System Installed";

    case "pricing":
      return "Book a Strategy Call";

    case "what_is_this":
    case "how_it_works":
      return "Get Your System Installed";

    case "objection":
      return "What kind of business are you thinking about starting?";

    case "features":
      return "Ready to try it? Create your account and explore the tools.";

    case "trust_question":
      return "Would you like to schedule a consultation with one of our specialists?";

    case "appointment":
      return undefined; // Handled by booking flow

    case "greeting":
    case "thanks":
      return undefined;

    default:
      return !isRegistered
        ? "Create your account to get started."
        : "What would you like to know next?";
  }
}

/**
 * Format response with optional CTA appended.
 */
export function formatResponseWithCta(
  answer: string,
  cta?: string,
  _userContext?: UserContext
): ResponseResult {
  if (!cta) {
    return { answer };
  }
  return {
    answer,
    cta,
  };
}

/**
 * Flatten ResponseResult to string for chat display.
 */
export function responseToString(result: ResponseResult): string {
  if (result.cta) {
    return `${result.answer}\n\n**${result.cta}**`;
  }
  return result.answer;
}
