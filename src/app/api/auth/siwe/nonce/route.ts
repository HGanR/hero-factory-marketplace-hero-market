import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  // Generate a random nonce for SIWE
  const nonce = crypto.randomBytes(16).toString('hex');

  return NextResponse.json({ nonce });
}







