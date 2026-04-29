import { NextRequest, NextResponse } from "next/server";
import { wreckGetRecentMessages } from "@/lib/wreck-room/queries";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");
  const limit = req.nextUrl.searchParams.get("limit");
  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }
  try {
    const rows = await wreckGetRecentMessages(
      parseInt(roomId, 10),
      limit ? parseInt(limit, 10) : 50
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[wreck-room/messages]", e);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
