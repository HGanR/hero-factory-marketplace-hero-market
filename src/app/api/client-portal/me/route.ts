import { NextRequest, NextResponse } from "next/server";
import { getClientPortalSession } from "@/lib/client-portal/portal-session";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientServiceStatus } from "@/lib/db/schema";

export async function GET(_req: NextRequest) {
  const s = await getClientPortalSession();
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const [svc] = await db
    .select()
    .from(clientServiceStatus)
    .where(eq(clientServiceStatus.clientId, s.client.id))
    .limit(1);
  const status = (svc?.status ?? "active") as string;
  return NextResponse.json({
    user: {
      id: s.portalUser.id,
      email: s.portalUser.email,
      name: s.portalUser.name,
      role: s.portalUser.role,
    },
    client: { name: s.client.name, id: s.client.id },
    service: {
      status,
      showServiceBanner: status === "paused" || status === "delinquent",
    },
  });
}
