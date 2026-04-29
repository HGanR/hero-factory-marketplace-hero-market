import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
// import type { BuildingManifestV1 } from "@/lib/modeling/manifest";

function requireAdmin(request: Request) {
  // TODO: Implement proper token verification from cookies
  return { isAdmin: true }; // Placeholder
}

// Server-side manifest validation - treats uploads as untrusted
function validateManifest(manifest: any): { valid: boolean; error?: string } {
  try {
    // Must be valid JSON
    if (typeof manifest !== 'object' || manifest === null) {
      return { valid: false, error: "Manifest must be a JSON object" };
    }

    // Must have supported schema version
    if (manifest.schemaVersion !== 1) {
      return { valid: false, error: `Unsupported schema version: ${manifest.schemaVersion}` };
    }

    // Must be marked enterable
    if (!manifest.contract || manifest.contract.enterable !== true) {
      return { valid: false, error: "Building must be marked as enterable" };
    }

    // Must have spawn points
    if (!manifest.spawns || !manifest.spawns.exterior || !manifest.spawns.interior) {
      return { valid: false, error: "Missing spawn points" };
    }

    // Spawn positions must be finite numbers
    const checkVec3 = (vec: any, name: string) => {
      if (typeof vec !== 'object' || vec === null) {
        return { valid: false, error: `${name} must be a vector object` };
      }
      if (typeof vec.x !== 'number' || !isFinite(vec.x) ||
          typeof vec.y !== 'number' || !isFinite(vec.y) ||
          typeof vec.z !== 'number' || !isFinite(vec.z)) {
        return { valid: false, error: `${name} must have finite x,y,z coordinates` };
      }
      return { valid: true };
    };

    const extCheck = checkVec3(manifest.spawns.exterior, "exterior spawn");
    if (!extCheck.valid) return extCheck;

    const intCheck = checkVec3(manifest.spawns.interior, "interior spawn");
    if (!intCheck.valid) return intCheck;

    // Must have colliders array
    if (!Array.isArray(manifest.colliders)) {
      return { valid: false, error: "Colliders must be an array" };
    }

    // Must have at least one entry collider
    const entryColliders = manifest.colliders.filter((c: any) => c.tag === "entry");
    if (entryColliders.length === 0) {
      return { valid: false, error: "Must have at least one entry collider" };
    }

    // Validate collider references
    const colliderIds = new Set(manifest.colliders.map((c: any) => c.id));

    // Interactables must reference valid colliders
    if (Array.isArray(manifest.interactables)) {
      for (const interactable of manifest.interactables) {
        if (!colliderIds.has(interactable.colliderId)) {
          return { valid: false, error: `Interactable ${interactable.id} references non-existent collider ${interactable.colliderId}` };
        }
      }
    }

    // Prefabs should reference valid elementIds (we'll check existence later)
    if (Array.isArray(manifest.prefabs)) {
      for (const prefab of manifest.prefabs) {
        if (!prefab.elementId || typeof prefab.elementId !== 'string') {
          return { valid: false, error: `Prefab ${prefab.id} has invalid elementId` };
        }
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Manifest validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const glb = form.get("glb") as File | null;
    const manifestFile = form.get("manifest") as File | null;

    if (!glb) {
      return NextResponse.json({ ok: false, error: "Missing glb" }, { status: 400 });
    }

    // Parse and validate manifest BEFORE storing files (optional)
    // const manifestText = manifestFile ? await manifestFile.text() : "";
    // let manifest: BuildingManifestV1;

    // try {
    //   manifest = JSON.parse(manifestText);
    // } catch (error) {
    //   return NextResponse.json({
    //     ok: false,
    //     error: "Invalid JSON in manifest file"
    //   }, { status: 400 });
    // }

    // Server-side validation - treat uploads as untrusted
    // const validation = validateManifest(manifest);
    // if (!validation.valid) {
    //   return NextResponse.json({
    //     ok: false,
    //     error: `Manifest validation failed: ${validation.error}`
    //   }, { status: 400 });
    // }

    // Generate ID and prepare storage
    const id = randomUUID();
    const outDir = path.join(process.cwd(), "public", "models", "generated");
    await fs.mkdir(outDir, { recursive: true });

    const glbPath = path.join(outDir, `${id}.glb`);
    const manifestPath = path.join(outDir, `${id}.manifest.json`);

    // Store GLB (manifest optional)
    await fs.writeFile(glbPath, Buffer.from(await glb.arrayBuffer()));
    if (manifestFile) {
      const manifestText = await manifestFile.text();
      await fs.writeFile(manifestPath, manifestText);
    }

    return NextResponse.json({
      ok: true,
      glbUri: `/models/generated/${id}.glb`,
      manifestUri: manifestFile ? `/models/generated/${id}.manifest.json` : null,
    });

  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}