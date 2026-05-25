import { NextResponse } from "next/server";
import { getOwnedClientRow, assertValidClientId } from "@/lib/revenue-os/client-hub-ownership";

export type OwnedClientOk = { ok: true; clientId: string };
export type OwnedClientErr = { ok: false; response: NextResponse };

export async function requireOwnedClientId(userId: number, raw: string | null | undefined): Promise<OwnedClientOk | OwnedClientErr> {
  const t = raw?.trim() ?? "";
  if (!t) {
    return { ok: false, response: NextResponse.json({ error: "Missing clientId" }, { status: 400 }) };
  }
  try {
    assertValidClientId(t);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid clientId" }, { status: 400 }) };
  }
  const row = await getOwnedClientRow(userId, t);
  if (!row) {
    return { ok: false, response: NextResponse.json({ error: "Client not found or access denied" }, { status: 403 }) };
  }
  return { ok: true, clientId: t };
}
