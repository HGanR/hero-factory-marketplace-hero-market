import { getDb } from "@/lib/db";
import { deeds, resolutions, minutes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function assertDeedHasApprovedAuthority(deedId: string) {
  const db = await getDb();

  const deedRows = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
  if (deedRows.length === 0) {
    return { ok: false as const, code: "NOT_FOUND", message: "Deed not found." };
  }

  const deed = deedRows[0];

  if (!deed.approvingResolutionId) {
    return {
      ok: false as const,
      code: "MISSING_APPROVAL",
      message: "A deed must be linked to an approving resolution before it can be submitted.",
    };
  }

  const resolutionRows = await db
    .select()
    .from(resolutions)
    .where(eq(resolutions.id, deed.approvingResolutionId))
    .limit(1);

  if (resolutionRows.length === 0) {
    return {
      ok: false as const,
      code: "RESOLUTION_NOT_FOUND",
      message: "Approving resolution not found.",
    };
  }

  const resolution = resolutionRows[0];

  if (resolution.status !== "approved") {
    return {
      ok: false as const,
      code: "RESOLUTION_NOT_APPROVED",
      message: "Approving resolution is not approved.",
    };
  }

  if (!deed.approvingMinutesId) {
    return {
      ok: false as const,
      code: "MINUTES_NOT_LINKED",
      message: "Minutes not linked to deed.",
    };
  }

  const minutesRows = await db.select().from(minutes).where(eq(minutes.id, deed.approvingMinutesId)).limit(1);

  if (minutesRows.length === 0) {
    return {
      ok: false as const,
      code: "MINUTES_NOT_FOUND",
      message: "Minutes not found.",
    };
  }

  const minutesRecord = minutesRows[0];
  const minutesStatus = minutesRecord.status;

  if (!minutesStatus || !["approved", "locked"].includes(minutesStatus)) {
    return {
      ok: false as const,
      code: "MINUTES_NOT_APPROVED",
      message: "Minutes containing the approving resolution are not approved/locked.",
    };
  }

  return { ok: true as const, deed };
}
