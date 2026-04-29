import { EgressStatus } from "livekit-server-sdk";
import {
  BROADCAST_EGRESS_RECONCILE_MIN_SESSION_AGE_MS,
} from "./broadcast-constants";

export function egressLiveKitStatusIsTerminal(status: number): boolean {
  return (
    status === EgressStatus.EGRESS_COMPLETE ||
    status === EgressStatus.EGRESS_FAILED ||
    status === EgressStatus.EGRESS_ABORTED ||
    status === EgressStatus.EGRESS_LIMIT_REACHED
  );
}

/**
 * Pure predicate: should we end the DB session to match LiveKit?
 * - Terminal status in LiveKit → always reconcile (explicit evidence).
 * - Missing from list → only after min session age (avoid false lockout from list lag).
 */
export function reconcileBroadcastSessionDecision(args: {
  livekitEgressId: string;
  liveKitStatus: number | undefined;
  sessionAgeMs: number;
}): null | { reason: string } {
  const eid = args.livekitEgressId.trim();
  if (!eid) return null;

  if (args.liveKitStatus !== undefined && egressLiveKitStatusIsTerminal(args.liveKitStatus)) {
    return { reason: `livekit_egress_terminal:${args.liveKitStatus}` };
  }

  if (
    args.liveKitStatus === undefined &&
    args.sessionAgeMs >= BROADCAST_EGRESS_RECONCILE_MIN_SESSION_AGE_MS
  ) {
    return { reason: "livekit_egress_absent_reconcile" };
  }

  return null;
}
