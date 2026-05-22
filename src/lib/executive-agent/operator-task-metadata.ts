import type { TaskCoordinationMetadata } from "@/lib/executive-agent/executive-operator-types";

export function parseTaskCoordinationMetadata(
  raw: string | null | undefined
): TaskCoordinationMetadata {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as TaskCoordinationMetadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeTaskCoordinationMetadata(meta: TaskCoordinationMetadata): string | null {
  const hasDelegation = Boolean(meta.delegation);
  const hasEscalation = Boolean(meta.escalation);
  if (!hasDelegation && !hasEscalation && !meta.lastCoordinationAction) return null;
  return JSON.stringify(meta).slice(0, 12_000);
}
