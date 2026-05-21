import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { clientNotes, clientServiceOrderEvents, fulfillmentDeliverables } from "@/lib/db/schema";
import { scoreDraftQuality } from "@/lib/fulfillment/fulfillment-quality-score";
import type { FulfillmentDraftQualityDto } from "@/lib/fulfillment/fulfillment-quality-score";
import { loadWebsiteIntakeFromOrder } from "@/lib/fulfillment/website-intake-summary";

type Db = MySql2Database<typeof schema>;

const SITE_BUILDER_NOTE_MARKER = "[Site Builder — approved task]";

export async function loadSiteBuilderDraftNotesHistory(
  db: Db,
  clientId: string,
  limit = 5
): Promise<Array<{ id: string; note: string; createdAt: Date }>> {
  const rows = await db
    .select({
      id: clientNotes.id,
      note: clientNotes.note,
      createdAt: clientNotes.createdAt,
    })
    .from(clientNotes)
    .where(and(eq(clientNotes.clientId, clientId), eq(clientNotes.visibility, "internal")))
    .orderBy(desc(clientNotes.createdAt))
    .limit(30);

  return rows.filter((r) => r.note.includes(SITE_BUILDER_NOTE_MARKER)).slice(0, limit);
}

export async function loadFulfillmentDraftQualityForOrder(
  db: Db,
  input: {
    orderId: string;
    clientId: string;
    executiveHandoffJson: string | null;
    salesSummaryText: string | null;
    requestedDeliverableJson: string | null;
    artifactRef: string | null;
    draftVersion?: number;
  }
): Promise<FulfillmentDraftQualityDto> {
  const intake = loadWebsiteIntakeFromOrder({
    executiveHandoffJson: input.executiveHandoffJson,
    salesSummaryText: input.salesSummaryText,
    requestedDeliverableJson: input.requestedDeliverableJson,
  });

  const events = await db
    .select({ payloadJson: clientServiceOrderEvents.payloadJson })
    .from(clientServiceOrderEvents)
    .where(eq(clientServiceOrderEvents.orderId, input.orderId))
    .orderBy(desc(clientServiceOrderEvents.createdAt))
    .limit(50);

  let draftNoteText: string | null = null;
  if (input.artifactRef) {
    const [note] = await db
      .select({ note: clientNotes.note })
      .from(clientNotes)
      .where(eq(clientNotes.id, input.artifactRef))
      .limit(1);
    draftNoteText = note?.note ?? null;
  }

  const history = await loadSiteBuilderDraftNotesHistory(db, input.clientId, 5);
  const priorNote =
    history.find((n) => n.id !== input.artifactRef)?.note ??
    (history.length > 1 ? history[1]?.note : null) ??
    null;

  let draftVersion = input.draftVersion ?? 1;
  if (input.draftVersion == null) {
    const [del] = await db
      .select({ draftVersion: fulfillmentDeliverables.draftVersion })
      .from(fulfillmentDeliverables)
      .where(eq(fulfillmentDeliverables.orderId, input.orderId))
      .limit(1);
    draftVersion = del?.draftVersion ?? 1;
  }

  return scoreDraftQuality({
    normalized: intake.normalized,
    readiness: intake.readiness,
    draftNoteText,
    draftVersion,
    priorDraftNoteText: priorNote,
    orderEvents: events,
  });
}
