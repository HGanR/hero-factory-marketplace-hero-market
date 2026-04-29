import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { insertAuditLog } from "@/lib/audit";

const CreateClientSchema = z.object({
  first_name: z.string().min(1),
  middle_name: z.string().min(1).optional().nullable(),
  last_name: z.string().min(1),
  suffix: z.string().min(1).optional().nullable(),
  date_of_birth: z.string().min(4).optional().nullable(), // ISO date string; stored as DATE when possible
  email: z.string().email(),
  phone: z.string().min(3).optional().nullable(),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().min(1).optional().nullable(),
    city: z.string().min(1),
    state: z.string().min(1),
    postal_code: z.string().min(1),
    country: z.string().min(2).max(2).optional().nullable(),
  }),
});

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof CreateClientSchema>;
  try {
    body = CreateClientSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const clientId = crypto.randomUUID();
  const db = await getDb();

  await db.transaction(async (tx) => {
    await tx.insert(clients).values({
      id: clientId,
      userId,
      firstName: body.first_name,
      middleName: body.middle_name ?? null,
      lastName: body.last_name,
      suffix: body.suffix ?? null,
      dateOfBirth: body.date_of_birth ? (body.date_of_birth as any) : null,
      email: body.email,
      phone: body.phone ?? null,
      addressLine1: body.address.line1,
      addressLine2: body.address.line2 ?? null,
      city: body.address.city,
      state: body.address.state,
      postalCode: body.address.postal_code,
      country: (body.address.country || "US").toUpperCase(),
      clientType: "individual",
      status: "active",
    } as any);

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: "client_created",
      entityType: "client",
      entityId: clientId,
      metadata: null,
    });
  });

  return NextResponse.json({ clientId, status: "created" });
}



