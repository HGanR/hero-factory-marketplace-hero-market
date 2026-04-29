import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { oasisWorldElements, oasisElementCategories } from "@/lib/db/schema";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";
import { uploadGlbToPinata } from "@/lib/oasis/upload-glb-to-pinata";
import { verifyToken } from "@/lib/auth";

const RegisterRequestSchema = z.object({
  glbBase64: z.string().min(10),
  name: z.string().min(1).max(150).optional(),
  kind: z.enum(["tree", "rock", "hut", "crate", "barrel", "lamp", "sign"]).optional(),
  category: z.enum(["vegetation", "rock", "building", "prop"]).default("prop"),
  prompt: z.string().max(500).optional(),
});

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  return !!decoded?.isAdmin;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
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

/** Register a previewed GLB (base64) to IPFS + oasis_world_elements. Requires Tier 7 or admin. */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      const raw = await req.json().catch(() => ({})) as Record<string, unknown>;
      const walletAddress = typeof raw.walletAddress === "string" ? raw.walletAddress : null;
      const signature = typeof raw.signature === "string" ? raw.signature : null;
      const nonce = typeof raw.nonce === "string" ? raw.nonce : null;
      const issuedAt = typeof raw.issuedAt === "string" ? raw.issuedAt : null;

      if (!walletAddress || !signature || !nonce || !issuedAt) {
        return NextResponse.json(
          { error: "Tier 7 or admin required to save assets to library." },
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

    const raw = await req.json().catch(() => ({})) as Record<string, unknown>;
    const body = RegisterRequestSchema.parse(raw);

    const buffer = Buffer.from(body.glbBase64, "base64");
    if (buffer.length < 100) {
      return NextResponse.json({ error: "Invalid or truncated GLB data" }, { status: 400 });
    }

    const kind = body.kind ?? "crate";
    const name = body.name ?? `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const filename = `${slugify(name)}.glb`;

    const { assetUri, ipfsHash } = await uploadGlbToPinata(buffer, filename, {
      source: "oasis-asset-register",
      kind,
      prompt: body.prompt,
    });

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    const db = await getDb();
    await ensureOasisAssetColumns(db);

    const catSlug = body.category === "building" ? "buildings" : "scenery";
    const categoryId = await getOrCreateCategory(db, catSlug, catSlug === "buildings" ? "Buildings" : "Scenery");

    const size = 2;
    const boundsJson = JSON.stringify({ x: size, y: size, z: size });

    await db.insert(oasisWorldElements).values({
      categoryId,
      name,
      slug: slugify(name),
      description: body.prompt ? `Saved from preview: ${body.prompt.slice(0, 100)}` : `Procedural ${kind} from modeling studio`,
      assetUri,
      assetBounds: boundsJson,
      defaultScale: "1",
      colliderType: "box",
      tags: JSON.stringify([body.category, kind, "ai-generated", "saved-from-preview"]),
    });

    const [row] = await db
      .select({ id: oasisWorldElements.id })
      .from(oasisWorldElements)
      .where(eq(oasisWorldElements.assetUri, assetUri))
      .limit(1);

    return NextResponse.json({
      ok: true,
      assetId: row?.id ?? null,
      assetUri,
      ipfsHash,
      sha256,
      name,
      message: "Asset saved to library. You can use it in blueprints and worlds.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "INVALID_REQUEST", message }, { status: 400 });
  }
}
