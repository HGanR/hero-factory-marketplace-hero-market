import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { AssetGenRequestSchema, AssetSpecSchema, type AssetSpec } from "@/lib/validators/oasis-asset-gen";
import { getDb } from "@/lib/db";
import { oasisWorldElements, oasisElementCategories } from "@/lib/db/schema";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";
import { generateProceduralGlb } from "@/lib/oasis/procedural-glb";
import { uploadGlbToPinata } from "@/lib/oasis/upload-glb-to-pinata";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  return !!decoded?.isAdmin;
}

/** MVP: deterministic mapping prompt → AssetSpec. Upgrade to LLM later. */
function promptToAssetSpec(prompt: string, category: string, seed: number): AssetSpec {
  const p = prompt.toLowerCase();
  let kind: AssetSpec["kind"] = "crate";
  if (category === "vegetation" || /\btree|pine|oak|birch|maple|willow|bush\b/.test(p)) kind = "tree";
  else if (/\brock|boulder|stone\b/.test(p) || category === "rock") kind = "rock";
  else if (/\bhut|house|cottage|shed|building\b/.test(p) || category === "building") kind = "hut";

  const baseParams: Record<string, number> =
    kind === "tree"
      ? { trunkHeight: 2.2, trunkRadius: 0.18, leafRadius: 0.9, leafDensity: 1 }
      : kind === "rock"
        ? { radius: 0.7, noise: 0.35 }
        : kind === "hut"
          ? { width: 2.4, depth: 2.2, height: 2.0, roofHeight: 1.0 }
          : { width: 0.8, height: 0.6, depth: 0.8 };

  return AssetSpecSchema.parse({
    kind,
    seed,
    scale: 1,
    materials: { primary: "#6B4E2E", secondary: "#2E6B3A" },
    params: baseParams,
  });
}

async function getOrCreateCategory(db: Awaited<ReturnType<typeof getDb>>, slug: string, name: string) {
  const [existing] = await db
    .select()
    .from(oasisElementCategories)
    .where(eq(oasisElementCategories.slug, slug))
    .limit(1);
  if (existing) return existing.id;
  await db.insert(oasisElementCategories).values({ name, slug });
  const [created] = await db
    .select({ id: oasisElementCategories.id })
    .from(oasisElementCategories)
    .where(eq(oasisElementCategories.slug, slug))
    .limit(1);
  return created?.id ?? 1;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => ({})) as Record<string, unknown>;
    const body = AssetGenRequestSchema.parse(raw);
    const mode = body.mode ?? "register";

    if (mode === "register" && !isAdmin(req)) {
      const walletAddress = typeof raw.walletAddress === "string" ? raw.walletAddress : null;
      const signature = typeof raw.signature === "string" ? raw.signature : null;
      const nonce = typeof raw.nonce === "string" ? raw.nonce : null;
      const issuedAt = typeof raw.issuedAt === "string" ? raw.issuedAt : null;

      if (!walletAddress || !signature || !nonce || !issuedAt) {
        return NextResponse.json(
          { error: "Tier 7 or admin required. Connect wallet and sign the access message." },
          { status: 403 }
        );
      }

      const { verifySignature, verifyTier7 } = await import("@/lib/oasis/tier7-verify");
      const sigOk = await verifySignature({
        walletAddress,
        signature,
        nonce,
        action: "GENERATE",
        worldId: "asset-gen",
        issuedAt,
      });
      if (!sigOk) {
        return NextResponse.json({ error: "Invalid signature. Please sign again." }, { status: 403 });
      }

      const { consumeNonce } = await import("@/lib/auth/nonce-consume");
      if (!(await consumeNonce(walletAddress, nonce))) {
        return NextResponse.json({ error: "Nonce expired or already used." }, { status: 403 });
      }

      const hasTier7 = await verifyTier7(walletAddress);
      if (!hasTier7) {
        return NextResponse.json(
          { error: "Tier 7 required. Connect a wallet with Hero token ID 7 on Polygon." },
          { status: 403 }
        );
      }
    }

    const seed =
      body.seed ??
      parseInt(crypto.createHash("sha256").update(body.prompt).digest("hex").slice(0, 8), 16);

    const spec = promptToAssetSpec(body.prompt, body.category, seed);

    const externalUrl = (process.env.OASIS_ASSET_GEN_URL || "").trim();
    let glbUrl: string | null = null;
    let glbBase64: string | null = null;
    let boundsJson: string;
    let colliderType = "box";
    let glbBuffer: Buffer | null = null;

    if (externalUrl && mode === "register") {
      const r = await fetch(externalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec,
          maxTriangles: body.maxTriangles,
          sizeMeters: body.sizeMeters,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j?.message as string) ?? "Generator service failed");
      glbUrl = (j.glbUrl as string) ?? null;
      boundsJson = (j.boundsJson as string) ?? JSON.stringify({ x: body.sizeMeters, y: body.sizeMeters, z: body.sizeMeters });
      colliderType = (j.colliderType as string) ?? "box";
    } else {
      glbBuffer = generateProceduralGlb(spec);
      const size = body.sizeMeters ?? 2;
      boundsJson = JSON.stringify({ x: size, y: size, z: size });

      if (mode === "preview") {
        glbBase64 = glbBuffer.toString("base64");
      } else {
        try {
          const filename = `ai-${spec.kind}-${seed}.glb`;
          const { assetUri } = await uploadGlbToPinata(glbBuffer, filename, {
            source: "oasis-asset-gen",
            kind: spec.kind,
            prompt: body.prompt,
          });
          glbUrl = assetUri;
        } catch (uploadErr) {
          console.error("[oasis/assets/generate] Pinata upload failed, falling back to base64:", uploadErr);
          glbBase64 = glbBuffer.toString("base64");
        }
      }
    }

    const db = await getDb();
    await ensureOasisAssetColumns(db);

    let assetId: number | null = null;

    if (glbUrl && mode === "register") {
      const catSlug =
        body.category === "building" ? "buildings" : "scenery";
      const categoryId = await getOrCreateCategory(
        db,
        catSlug,
        catSlug === "buildings" ? "Buildings" : "Scenery"
      );

      await db.insert(oasisWorldElements).values({
        categoryId,
        name: `${spec.kind}-${seed}`,
        slug: slugify(`${spec.kind}-${seed}`),
        description: `AI-generated ${spec.kind} from: ${body.prompt.slice(0, 100)}`,
        assetUri: glbUrl,
        assetBounds: boundsJson,
        defaultScale: String(spec.scale ?? 1),
        colliderType,
        tags: JSON.stringify([body.category, spec.kind, body.style ?? "default", "ai-generated"]),
      });

      const [row] = await db
        .select({ id: oasisWorldElements.id })
        .from(oasisWorldElements)
        .where(eq(oasisWorldElements.assetUri, glbUrl))
        .limit(1);
      assetId = row?.id ?? null;
    }

    return NextResponse.json({
      ok: true,
      assetId,
      glbUrl,
      glbBase64: glbBase64 ?? undefined,
      spec,
      message: glbUrl
        ? "Asset generated and registered."
        : "Asset generated. Use glbBase64 to load (no persistent URL in this environment).",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "INVALID_REQUEST", message },
      { status: 400 }
    );
  }
}
