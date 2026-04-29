// app/api/jurisdictions/dapt/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { listDaptJurisdictions } from "@/lib/jurisdictions/dapt/engine";

const QuerySchema = z.object({
  selfSettled: z.string().optional(),
  hasDigitalAssets: z.string().optional(),
  objective: z.enum(["ASSET_PROTECTION", "STATE_TAX_MINIMIZATION", "DIGITAL_ASSET_FIDUCIARY_ACCESS"]).optional()
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    selfSettled: url.searchParams.get("selfSettled") ?? undefined,
    hasDigitalAssets: url.searchParams.get("hasDigitalAssets") ?? undefined,
    objective: url.searchParams.get("objective") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "Invalid query params." } },
      { status: 400 }
    );
  }

  const selfSettled = (parsed.data.selfSettled ?? "true") === "true";
  const hasDigitalAssets = (parsed.data.hasDigitalAssets ?? "false") === "true";
  const objective = parsed.data.objective ?? "ASSET_PROTECTION";

  const rows = listDaptJurisdictions({ selfSettled, hasDigitalAssets, objective });

  return NextResponse.json({ ok: true, rows });
}