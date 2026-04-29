import type { MinuteParticipantRow } from "@/lib/db/schema";

export function computeQuorum(recordType: "meeting" | "written_consent", participants: MinuteParticipantRow[]) {
  if (recordType === "written_consent") {
    return { quorumRequired: false, quorumMet: true };
  }

  if (participants.length === 0) {
    return { quorumRequired: true, quorumMet: false };
  }

  const present = participants.filter((p) => p.present);
  // Default quorum rule: at least 50% present
  // Can be enhanced with entity-specific logic later
  const quorumMet = present.length / participants.length >= 0.5;

  return { quorumRequired: true, quorumMet };
}
