/**
 * Broadcast event DTOs + validation (planning layer; does not start sessions).
 */

export type BroadcastEventStatus = "draft" | "scheduled" | "live" | "completed" | "cancelled";

export type BroadcastEvent = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  scheduledStartIso: string;
  scheduledEndIso: string | null;
  timezone: string | null;
  roomId: string | null;
  status: BroadcastEventStatus;
  scenePresetId: number | null;
  defaultTimelineTemplateId: number | null;
  showPackageId: number | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type BroadcastEventInput = Partial<{
  title: string;
  description: string | null;
  scheduledStartIso: string;
  scheduledEndIso: string | null;
  timezone: string | null;
  roomId: string | null;
  status: BroadcastEventStatus;
  scenePresetId: number | null;
  defaultTimelineTemplateId: number | null;
  showPackageId: number | null;
}>;

export function validateBroadcastEvent(
  input: BroadcastEventInput,
  mode: "create" | "patch"
): { ok: true; data: BroadcastEventInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const out: BroadcastEventInput = {};

  if (mode === "create" || input.title !== undefined) {
    const t = typeof input.title === "string" ? input.title.trim() : "";
    if (mode === "create" && !t) errors.push("title required");
    else if (input.title !== undefined) out.title = t.slice(0, 500);
  }

  if (input.description !== undefined) {
    out.description =
      input.description === null ? null : typeof input.description === "string" ? input.description.slice(0, 8000) : null;
    if (input.description != null && typeof input.description !== "string") errors.push("description must be string or null");
  }

  if (mode === "create" || input.scheduledStartIso !== undefined) {
    const s = typeof input.scheduledStartIso === "string" ? input.scheduledStartIso.trim() : "";
    if (mode === "create" && !s) errors.push("scheduledStartIso required");
    else if (input.scheduledStartIso !== undefined) {
      const d = Date.parse(s);
      if (!Number.isFinite(d)) errors.push("scheduledStartIso must be a valid ISO date");
      else out.scheduledStartIso = s;
    }
  }

  if (input.scheduledEndIso !== undefined) {
    if (input.scheduledEndIso === null) out.scheduledEndIso = null;
    else if (typeof input.scheduledEndIso === "string") {
      const d = Date.parse(input.scheduledEndIso);
      if (!Number.isFinite(d)) errors.push("scheduledEndIso invalid");
      else out.scheduledEndIso = input.scheduledEndIso;
    } else errors.push("scheduledEndIso must be string or null");
  }

  if (input.timezone !== undefined) {
    out.timezone = input.timezone === null ? null : String(input.timezone).slice(0, 64);
  }

  if (input.roomId !== undefined) {
    out.roomId = input.roomId === null ? null : String(input.roomId).trim().slice(0, 256) || null;
  }

  if (input.status !== undefined) {
    const allowed: BroadcastEventStatus[] = ["draft", "scheduled", "live", "completed", "cancelled"];
    if (!allowed.includes(input.status)) errors.push("invalid status");
    else out.status = input.status;
  }

  for (const key of ["scenePresetId", "defaultTimelineTemplateId", "showPackageId"] as const) {
    if (input[key] !== undefined) {
      const v = input[key];
      if (v === null) out[key] = null;
      else if (typeof v === "number" && Number.isFinite(v) && v > 0) out[key] = Math.floor(v);
      else errors.push(`${key} invalid`);
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: out };
}

export function canLaunchBroadcastEvent(
  event: Pick<BroadcastEvent, "status" | "roomId" | "scheduledStartIso" | "userId">,
  _nowIso: string
): { ok: true } | { ok: false; reason: string } {
  if (!event.roomId?.trim()) return { ok: false, reason: "event_room_required" };
  if (!event.scheduledStartIso?.trim()) return { ok: false, reason: "event_schedule_required" };
  void _nowIso;
  void event.userId;
  return { ok: true };
}
