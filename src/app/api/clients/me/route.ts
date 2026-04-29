import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { workflowClientProfiles } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocateClientId } from "@/lib/sequences";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function GET(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

  // Get existing client profile for this user
  const clientRows = await db
    .select()
    .from(workflowClientProfiles)
    .where(eq(workflowClientProfiles.userId, userId))
    .limit(1);

  if (clientRows.length > 0) {
    return NextResponse.json({
      client: {
        id: clientRows[0].id,
        publicId: clientRows[0].publicId,
        fullName: clientRows[0].fullName,
        email: clientRows[0].email,
        createdAt: clientRows[0].createdAt?.toISOString(),
      }
    });
  }

  // No client exists yet
  return NextResponse.json({
    client: null,
    message: "No client profile found. Use POST to create one."
  });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fullName?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fullName, email } = body;
  if (!fullName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "fullName and email are required" }, { status: 400 });
  }

  const db = await getDb();

  // Check if client already exists
  const existingRows = await db
    .select()
    .from(workflowClientProfiles)
    .where(eq(workflowClientProfiles.userId, userId))
    .limit(1);

  if (existingRows.length > 0) {
    return NextResponse.json({
      error: "Client profile already exists",
      client: {
        id: existingRows[0].id,
        publicId: existingRows[0].publicId,
        fullName: existingRows[0].fullName,
        email: existingRows[0].email,
      }
    }, { status: 409 });
  }

  // Create new client with CID
  const clientId = crypto.randomUUID();
  const publicId = await allocateClientId();

  const result = await db.insert(workflowClientProfiles).values({
    id: clientId,
    userId,
    publicId,
    fullName: fullName.trim(),
    email: email.trim(),
  });

  return NextResponse.json({
    client: {
      id: clientId,
      publicId,
      fullName: fullName.trim(),
      email: email.trim(),
      createdAt: new Date().toISOString(),
    }
  }, { status: 201 });
}
