// src/app/api/instruments/[instrumentId]/witness/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { notarizeInstrumentAsWitness, verifyWitnessNotarization } from "@/lib/instruments/witness-adapter";

/**
 * POST /api/instruments/[instrumentId]/witness
 * 
 * Notarize an instrument on the public witness ledger (hash-only)
 * 
 * This endpoint:
 * 1. Verifies the instrument is executed
 * 2. Computes witness hash (commitment to executed state)
 * 3. Publishes hash to blockchain (no trust data)
 * 4. Stores witness receipt in private ledger
 * 
 * Returns the witness notarization result with tx hash.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ instrumentId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const { instrumentId } = await ctx.params;

    // Notarize instrument
    const result = await notarizeInstrumentAsWitness(instrumentId);

    return NextResponse.json({
      ok: true,
      witness: result,
    });
  } catch (error: any) {
    console.error("Witness notarization error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WITNESS_ERROR",
          message: error?.message || "Failed to notarize instrument",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/instruments/[instrumentId]/witness
 * 
 * Verify a witness notarization by recomputing the witness hash
 * and comparing it to the stored witness hash
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ instrumentId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const { instrumentId } = await ctx.params;

    // Verify witness notarization
    const verification = await verifyWitnessNotarization(instrumentId);

    return NextResponse.json({
      ok: true,
      verification,
    });
  } catch (error: any) {
    console.error("Witness verification error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VERIFICATION_ERROR",
          message: error?.message || "Failed to verify witness",
        },
      },
      { status: 500 }
    );
  }
}
