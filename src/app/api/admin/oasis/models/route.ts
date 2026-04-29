import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

function toPublicPath(fileAbs: string, publicAbs: string) {
  const rel = path.relative(publicAbs, fileAbs).split(path.sep).join("/");
  return `/${rel}`;
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const publicAbs = path.join(process.cwd(), "public");
    const modelsAbs = path.join(publicAbs, "models");

    // If models dir doesn't exist yet, return empty lists (admin can still use IPFS upload)
    try {
      const stat = await fs.stat(modelsAbs);
      if (!stat.isDirectory()) {
        return NextResponse.json({ models: [], previews: [] });
      }
    } catch {
      return NextResponse.json({ models: [], previews: [] });
    }

    const files = await walk(modelsAbs);
    const models = files
      .filter((f) => /\.(glb|gltf)$/i.test(f))
      .map((f) => toPublicPath(f, publicAbs))
      .sort();

    const previews = files
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map((f) => toPublicPath(f, publicAbs))
      .sort();

    return NextResponse.json({ models, previews });
  } catch (error) {
    console.error("Admin OASIS models GET error:", error);
    return NextResponse.json({ error: "Failed to list models" }, { status: 500 });
  }
}



