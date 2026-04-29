import { BROADCAST_CODES } from "./broadcast-codes";

export type BroadcastEventAttachmentUi = {
  infoMessage: string | null;
  errorMessage: string | null;
  errorCode: string | null;
};

/**
 * Operator copy for event-linked start when the server returns an idempotent session
 * plus `broadcastEventAttachment` / `broadcastEventConflict`.
 */
export function operatorMessagesForBroadcastStartEventAttachment(params: {
  broadcastEventAttachment: string | null | undefined;
  responseCode: string;
}): BroadcastEventAttachmentUi {
  if (
    params.broadcastEventAttachment === "conflict" ||
    params.responseCode === BROADCAST_CODES.broadcastEventIdempotentConflict
  ) {
    return {
      infoMessage: null,
      errorMessage:
        "Live session already belongs to a different broadcast event. Stop the broadcast or use the event that is already linked.",
      errorCode: BROADCAST_CODES.broadcastEventIdempotentConflict,
    };
  }

  if (params.broadcastEventAttachment === "attached") {
    return {
      infoMessage: "Joined existing live session and linked this event.",
      errorMessage: null,
      errorCode: null,
    };
  }

  if (params.broadcastEventAttachment === "already_attached") {
    return {
      infoMessage: "This event is already linked to the live session.",
      errorMessage: null,
      errorCode: null,
    };
  }

  return { infoMessage: null, errorMessage: null, errorCode: null };
}
