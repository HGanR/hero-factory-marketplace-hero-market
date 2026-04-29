import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assembleDeliverablesFromSchema } from "@/lib/site-builder/assemble-deliverables";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body as { schemaJson?: unknown })?.schemaJson;
  const parsed = SiteSchemaDocument.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schemaJson", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const deliverables = assembleDeliverablesFromSchema(parsed.data);
    return NextResponse.json({ deliverables }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deliverables assembly failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
