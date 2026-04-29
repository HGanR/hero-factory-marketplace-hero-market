import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisWorldElements } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { invokeNpcLlm } from "@/lib/npc/llm";
import { checkRateLimit } from "@/lib/npc/rate-limit";
import { parsePrompt, validatePlan } from "@/lib/modeling/prompt-parser";
import { z } from "zod";

type ModelEntry = { name: string; assetUri: string };

const FALLBACK_CATALOG: ModelEntry[] = [
  { name: "Birch Tree", assetUri: "/models/scenery/tree_birch.glb" },
  { name: "Maple Tree", assetUri: "/models/scenery/tree_maple.glb" },
  { name: "Oak Tree", assetUri: "/models/scenery/tree_oak.glb" },
  { name: "Pine Tree", assetUri: "/models/scenery/tree_pine.glb" },
  { name: "Willow Tree", assetUri: "/models/scenery/tree_willow.glb" },
  { name: "Building", assetUri: "/models/generated/building.glb" },
  { name: "Building Model", assetUri: "/models/3dw/building_model.glb" },
];

async function getModelCatalog(): Promise<ModelEntry[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ name: oasisWorldElements.name, assetUri: oasisWorldElements.assetUri })
      .from(oasisWorldElements)
      .orderBy(desc(oasisWorldElements.createdAt));

    const filtered = rows
      .filter((r) => r.assetUri && (r.assetUri.endsWith(".glb") || r.assetUri.endsWith(".gltf") || r.assetUri.startsWith("ipfs://")))
      .map((r) => ({ name: r.name ?? "Unknown", assetUri: r.assetUri ?? "" }));
    if (filtered.length > 0) return filtered;
  } catch {
    // fall through to fallback
  }
  return FALLBACK_CATALOG;
}

function matchByKeywords(message: string, catalog: ModelEntry[]): ModelEntry | null {
  const lower = message.toLowerCase().trim();
  const pine = /pine|evergreen|conifer/i.test(lower);
  const oak = /oak/i.test(lower);
  const birch = /birch/i.test(lower);
  const maple = /maple/i.test(lower);
  const willow = /willow/i.test(lower);
  const tree = /tree|trees/i.test(lower);
  const building = /building|house|structure/i.test(lower);

  if (pine && tree) return catalog.find((e) => /pine/i.test(e.name)) ?? catalog.find((e) => /tree/i.test(e.name)) ?? null;
  if (oak && tree) return catalog.find((e) => /oak/i.test(e.name)) ?? catalog.find((e) => /tree/i.test(e.name)) ?? null;
  if (birch && tree) return catalog.find((e) => /birch/i.test(e.name)) ?? catalog.find((e) => /tree/i.test(e.name)) ?? null;
  if (maple && tree) return catalog.find((e) => /maple/i.test(e.name)) ?? catalog.find((e) => /tree/i.test(e.name)) ?? null;
  if (willow && tree) return catalog.find((e) => /willow/i.test(e.name)) ?? catalog.find((e) => /tree/i.test(e.name)) ?? null;
  if (tree && !pine && !oak && !birch && !maple && !willow) return catalog.find((e) => /tree/i.test(e.name)) ?? null;
  if (building) return catalog.find((e) => /building|house/i.test(e.name)) ?? null;

  return null;
}

const PHRASE_SUGGEST =
  "Try: 'conference room 12x10', 'vault room', 'family office HQ', 'podium for certificate'.";

/** Default: parametric-only. Set MODELING_ALLOW_CATALOG_FALLBACK=true or ?allowCatalogFallback=1 to enable asset catalog. */
function allowCatalogFallback(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get("allowCatalogFallback") === "1") return true;
  return process.env.MODELING_ALLOW_CATALOG_FALLBACK === "true";
}

function toSuggestedAsset(raw: { name: string; assetUri: string }): {
  label: string;
  query: string;
  modelUrl: string;
  placement?: "center" | "near_wall" | "on_table";
  scaleHint?: number;
} {
  const modelUrl =
    raw.assetUri.startsWith("ipfs://")
      ? raw.assetUri.replace("ipfs://", "https://nftstorage.link/ipfs/")
      : raw.assetUri;
  return {
    label: `Add ${raw.name}`,
    query: raw.name.toLowerCase(),
    modelUrl,
    placement: "center",
    scaleHint: 1,
  };
}

async function invokeHiber3D(message: string): Promise<{ modelUrl: string; raw?: unknown }> {
  const endpoint = (process.env.HIBER3D_API_URL || "").trim();
  const apiKey = (process.env.HIBER3D_API_KEY || "").trim();
  if (!endpoint) {
    throw new Error("HIBER3D_API_URL is not configured");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt: message }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Hiber3D request failed (${res.status})`
    );
  }

  const rawUrl =
    payload?.modelUrl ??
    payload?.url ??
    payload?.assetUrl ??
    payload?.glbUrl ??
    payload?.data?.modelUrl ??
    payload?.output?.modelUrl;
  const modelUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!modelUrl) {
    throw new Error("Hiber3D response missing model URL");
  }
  return { modelUrl, raw: payload };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();
  const provider = body?.provider === "hiber3d" ? "hiber3d" : "auto";
  const allowCatalog = body?.allowCatalogFallback === true || allowCatalogFallback(req);
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rateLimit.retryAfterSec },
      { status: 429, headers: rateLimit.retryAfterSec ? { "Retry-After": String(rateLimit.retryAfterSec) } : undefined }
    );
  }

  if (provider === "hiber3d") {
    try {
      const generated = await invokeHiber3D(message);
      return NextResponse.json({
        modelUrl: generated.modelUrl,
        message: "Hiber3D model generated and ready to load.",
        _path: "hiber3d",
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Hiber3D generation failed",
          message:
            "Hiber3D generation failed. Check HIBER3D_API_URL/KEY or switch provider to Auto.",
          _path: "hiber3d_error",
        },
        { status: 502 }
      );
    }
  }

  // Parametric path: prompt → BuildPlan when prompt matches structural keywords
  const parametricResult = parsePrompt(message);
  const isParametricMatch = !parametricResult.assumptions.some((a) =>
    a.includes("Unrecognized prompt")
  );

  if (isParametricMatch) {
    try {
      const plan = validatePlan(parametricResult.plan);
      const kind = plan.kind;
      const label =
        kind === "office_hq"
          ? "Family Office HQ"
          : kind === "conference_room"
            ? "Conference room"
            : kind === "vault_room"
              ? "Vault room"
              : kind === "podium"
                ? "Podium"
                : "Room";

      const payload: Record<string, unknown> = {
        plan,
        assumptions: parametricResult.assumptions,
        message:
          parametricResult.assumptions.length > 0
            ? `${label} created. ${parametricResult.assumptions.join(" ")}`
            : `${label} created.`,
        _path: "parametric",
      };
      if (parametricResult.suggestedAsset) {
        payload.suggestedAsset = toSuggestedAsset(parametricResult.suggestedAsset);
      }
      if (parametricResult.suggestedObject) {
        payload.suggestedObject = {
          ...parametricResult.suggestedObject,
          label: `Add ${parametricResult.suggestedObject.kind.replace("_", " ")} (auto-place)`,
        };
      }

      return NextResponse.json(payload);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return NextResponse.json(
          {
            error: "Invalid plan",
            validationErrors: issues,
            message: `Plan validation failed: ${issues}. ${PHRASE_SUGGEST}`,
            _path: "parametric_validation_failed",
          },
          { status: 400 }
        );
      }
      throw err;
    }
  }

  // Parametric-only mode: reject non-structural prompts unless catalog explicitly enabled
  if (!allowCatalog) {
    return NextResponse.json({
      plan: null,
      modelUrl: null,
      message: `This prompt is outside parametric scope. ${PHRASE_SUGGEST}`,
      _path: "parametric_only_reject",
    });
  }

  // Catalog / LLM path (when allowCatalogFallback)
  const catalog = await getModelCatalog();
  const catalogText =
    catalog.length > 0
      ? catalog.map((e) => `- "${e.name}" → ${e.assetUri.startsWith("ipfs://") ? e.assetUri : e.assetUri}`).join("\n")
      : "No models in catalog.";

  if (process.env.NPC_LLM_ENABLED === "true") {
    try {
      const systemPrompt = `You are a 3D modeling assistant. The user describes a model they want to add to a scene.
Available models (name → assetUri):
${catalogText}

Respond with valid JSON only, no other text:
{ "modelUrl": "/models/scenery/tree_pine.glb" | null, "message": "..." }

Rules:
- modelUrl: Use the exact assetUri from the list if you find a match. For ipfs://... convert to https://nftstorage.link/ipfs/... or keep as-is if the client supports it. For local paths use the exact path like /models/scenery/...
- If no good match, set modelUrl to null and message should explain what we have (e.g. "We have Pine, Oak, Birch, Maple, Willow trees. Which would you like?")
- message: Short friendly reply.
- Output only the JSON object.`;

      const raw = await invokeNpcLlm([
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ]);

      if (raw) {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { modelUrl?: string | null; message?: string };
          let modelUrl = parsed.modelUrl ?? null;
          if (modelUrl && modelUrl.startsWith("ipfs://")) {
            modelUrl = modelUrl.replace("ipfs://", "https://nftstorage.link/ipfs/");
          }
          return NextResponse.json({
            modelUrl: modelUrl && modelUrl.length > 0 ? modelUrl : null,
            message: parsed.message ?? (modelUrl ? `Adding ${modelUrl}` : "No matching model found."),
            _path: "llm",
          });
        }
      }
    } catch {
      // Fall through to keyword match
    }
  }

  const match = matchByKeywords(message, catalog);
  if (match) {
    const sa = toSuggestedAsset(match);
    return NextResponse.json({
      modelUrl: sa.modelUrl,
      suggestedAsset: sa,
      message: `${sa.label} to the scene.`,
      _path: "catalog",
    });
  }

  // AI Asset Gen: procedural tree/rock/hut when no catalog match (MVP: JSON spec → GLB)
  const allowAiAssetGen = process.env.MODELING_ALLOW_AI_ASSET_GEN !== "false";
  if (allowCatalog && allowAiAssetGen) {
    const lower = message.toLowerCase();
    const wantsTree = /\b(tree|pine|oak|birch|maple|willow|bush|vegetation)\b/.test(lower);
    const wantsRock = /\b(rock|boulder|stone)\b/.test(lower);
    const wantsHut = /\b(hut|house|cottage|shed|small building)\b/.test(lower);
    const wantsProp = /\b(crate|barrel|box)\b/.test(lower);

    if (wantsTree || wantsRock || wantsHut || wantsProp) {
      try {
        const { AssetSpecSchema } = await import("@/lib/validators/oasis-asset-gen");
        const { generateProceduralGlb } = await import("@/lib/oasis/procedural-glb");
        const crypto = await import("crypto");
        const seed = parseInt(crypto.createHash("sha256").update(message).digest("hex").slice(0, 8), 16);

        let kind: "tree" | "rock" | "hut" | "crate" = "crate";
        let category = "prop";
        if (wantsTree) {
          kind = "tree";
          category = "vegetation";
        } else if (wantsRock) {
          kind = "rock";
          category = "rock";
        } else if (wantsHut) {
          kind = "hut";
          category = "building";
        }

        const spec = AssetSpecSchema.parse({
          kind,
          seed,
          scale: 1,
          materials: { primary: "#6B4E2E", secondary: "#2E6B3A" },
          params:
            kind === "tree"
              ? { trunkHeight: 2.2, trunkRadius: 0.18, leafRadius: 0.9, leafDensity: 1 }
              : kind === "rock"
                ? { radius: 0.7, noise: 0.35 }
                : kind === "hut"
                  ? { width: 2.4, depth: 2.2, height: 2.0, roofHeight: 1.0 }
                  : { width: 0.8, height: 0.6, depth: 0.8 },
        });

        const glbBuffer = generateProceduralGlb(spec);
        const glbBase64 = glbBuffer.toString("base64");

        return NextResponse.json({
          glbBase64,
          spec: { kind, category },
          modelUrl: null,
          suggestedAsset: {
            label: `Add generated ${kind}`,
            query: message,
            modelUrl: `data:model/gltf-binary;base64,${glbBase64}`,
            placement: "center",
            scaleHint: 1,
          },
          message: `Procedural ${kind} generated. Adding to scene.`,
          _path: "ai_asset_gen",
        });
      } catch (err) {
        console.error("[modeling/agent] AI asset gen failed:", err);
        // Fall through to suggestion
      }
    }
  }

  const suggestion =
    catalog.length > 0
      ? `Available: ${catalog.slice(0, 6).map((e) => e.name).join(", ")}${catalog.length > 6 ? "..." : ""}. ${PHRASE_SUGGEST}`
      : `No models in the library yet. Add elements in Oasis Elements first. ${PHRASE_SUGGEST}`;
  return NextResponse.json({
    modelUrl: null,
    message: suggestion,
    _path: "fallback",
  });
}
