import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { maaniaSharedDemos } from "@/lib/db/schema.maania-shared-demos";

function makeSlug(): string {
  return randomBytes(5).toString("hex").slice(0, 10);
}

export async function POST(req: Request) {
  let body: {
    kind?: string;
    title?: string;
    payload?: unknown;
    schema?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind === "buyer" || body.kind === "ret" ? body.kind : null;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 255) : null;
  if (!kind || !title) {
    return NextResponse.json({ error: "kind (buyer|ret) and title are required" }, { status: 400 });
  }

  const id = randomBytes(18).toString("hex").slice(0, 36);
  let slug = makeSlug();
  const payloadJson = JSON.stringify(body.payload ?? {});
  const schemaJson = JSON.stringify(body.schema ?? {});

  try {
    const db = await getDb();
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await db.insert(maaniaSharedDemos).values({
          id,
          slug,
          kind,
          title,
          payloadJson,
          schemaJson,
        });
        const path = `/demo/${slug}`;
        return NextResponse.json({ ok: true, slug, path });
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === "ER_DUP_ENTRY" || String((e as Error)?.message || "").includes("Duplicate")) {
          slug = makeSlug();
          continue;
        }
        throw e;
      }
    }
    return NextResponse.json({ error: "Could not allocate a unique slug" }, { status: 503 });
  } catch (e) {
    console.error("[api/demo/share]", e);
    return NextResponse.json(
      { error: "Share storage unavailable. Ensure migrations are applied (drizzle/0028_maania_shared_demos.sql)." },
      { status: 503 }
    );
  }
}
