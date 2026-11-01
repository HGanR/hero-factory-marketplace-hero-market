/**
 * SKIPPER Phase 1 — STEP 1 telemetry events.
 *
 * The telemetry event types SKIPPER's revenue loop reviews.
 * Emitted via emitPlatformEvent (which logs to platformActivity)
 * so the Gated Polling Event Feed (Task 1.3) can surface them.
 *
 * PII policy: event payloads carry only identifiers and state.
 * They must never carry a phone number, a password hash, or a
 * raw prompt string.
 */

import type { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";

/** Telemetry event types surfaced by the STEP 1 polling feed. */
export const TELEMETRY_EVENT_TYPES = [
  "new_account",
  "onboarding_completed",
  "asset_purchased",
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];

export interface NewAccountEventPayload {
  accountId: number;
  isApproved: boolean;
  registeredAt: string;
}

export interface OnboardingCompletedEventPayload {
  onboardingId: number;
  onboardingStatus: string;
}

/**
 * Build the payload for a new_account event.
 * Carries only the account id, the approval state, and the
 * registration timestamp. No phone number, no email, no
 * password hash.
 */
export function buildNewAccountEventPayload(
  accountId: number,
  isApproved: boolean,
  registeredAt: string,
): NewAccountEventPayload {
  return { accountId, isApproved, registeredAt };
}

/**
 * Build the payload for an onboarding_completed event.
 * Carries only the onboarding id and the completion state.
 * No phone number.
 */
export function buildOnboardingCompletedEventPayload(
  onboardingId: number,
  onboardingStatus: string,
): OnboardingCompletedEventPayload {
  return { onboardingId, onboardingStatus };
}

type EmitPlatformEventFn = typeof emitPlatformEvent;

/**
 * Emit a new_account event for a newly registered marketplace
 * account. `emit` is injected so tests can pass a fake; the
 * routes pass the real emitPlatformEvent.
 */
export async function emitNewAccountEvent(
  emit: EmitPlatformEventFn,
  accountId: number,
  userId: number,
  registeredAt: string,
): Promise<void> {
  const payload = buildNewAccountEventPayload(accountId, false, registeredAt);
  await emit("new_account", payload, userId);
}

/**
 * Emit an onboarding_completed event for a submitted onboarding.
 * `emit` is injected so tests can pass a fake; the routes pass
 * the real emitPlatformEvent.
 */
export async function emitOnboardingCompletedEvent(
  emit: EmitPlatformEventFn,
  onboardingId: number,
  onboardingStatus: string,
  userId: number,
): Promise<void> {
  const payload = buildOnboardingCompletedEventPayload(onboardingId, onboardingStatus);
  await emit("onboarding_completed", payload, userId);
}
