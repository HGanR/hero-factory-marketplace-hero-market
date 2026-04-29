import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureClientsTitleColumn } from "@/lib/db/clients-ensure";
import { clients, trustParties, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

const BodySchema = z.object({
  clientId: z.string().min(1).max(64),
});

/**
 * Fill grantor party from client record.
 * Updates trust_parties grantor with client name and address.
 * Used when user asks Jarva to "fill from client" or clicks Fill from client.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Missing trustId" }, { status: 400 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const db = await getDb();
  await ensureClientsTitleColumn();

  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0)
    return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const clientRows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, body.clientId), eq(clients.userId, userId)))
    .limit(1);
  if (clientRows.length === 0)
    return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const c = clientRows[0] as any;
  const fullName = [c.firstName, c.middleName, c.lastName, c.suffix]
    .filter((p: string) => Boolean(p && String(p).trim()))
    .map((p: string) => String(p).trim())
    .join(" ");

  const grantorRows = await db
    .select()
    .from(trustParties)
    .where(
      and(eq(trustParties.trustId, trustId), eq(trustParties.role, "grantor"))
    )
    .limit(1);

  const updatePayload = {
    displayName: fullName || null,
    addressLine1: c.addressLine1 ?? null,
    addressLine2: c.addressLine2 ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    postalCode: c.postalCode ?? null,
    country: c.country ?? "US",
  };

  if (grantorRows.length > 0) {
    await db
      .update(trustParties)
      .set(updatePayload as any)
      .where(eq(trustParties.id, String(grantorRows[0]!.id)));
  } else {
    const id = crypto.randomUUID();
    await db.insert(trustParties).values({
      id,
      trustId,
      role: "grantor",
      ...updatePayload,
    } as any);
  }

  return NextResponse.json({
    ok: true,
    applied: {
      grantorName: fullName,
      grantorAddressLine1: c.addressLine1 ?? "",
      grantorAddressLine2: c.addressLine2 ?? "",
      grantorCity: c.city ?? "",
      grantorState: c.state ?? "",
      grantorPostalCode: c.postalCode ?? "",
      grantorCountry: c.country ?? "US",
    },
    clientTitle: c.title && String(c.title).trim() ? String(c.title) : null,
  });
}
