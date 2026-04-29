/**
 * Meeting node analytics — fire-and-forget tracking.
 * Events: node_created, node_edited, node_deleted, node_clicked,
 * enter_meeting_clicked, room_entry_success, room_entry_failure, copy_invite_clicked
 */
export type MeetingNodeEvent =
  | "node_created"
  | "node_edited"
  | "node_deleted"
  | "node_clicked"
  | "enter_meeting_clicked"
  | "room_entry_success"
  | "room_entry_failure"
  | "copy_invite_clicked";

export function trackMeetingNodeEvent(
  event: MeetingNodeEvent,
  opts?: { nodeId?: string; roomId?: string; worldId?: string; payload?: Record<string, unknown> }
) {
  if (typeof window === "undefined") return;
  fetch("/api/troo-world/meeting-nodes/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      event,
      nodeId: opts?.nodeId,
      roomId: opts?.roomId,
      worldId: opts?.worldId,
      payload: opts?.payload,
    }),
  }).catch(() => {});
}
