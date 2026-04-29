import { NextRequest, NextResponse } from "next/server";
import { wreckUpsertRoomTheme } from "@/lib/wreck-room/queries";

/** Persist room theme (optional auth in production). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomId = Number(body.roomId);
    if (!roomId) {
      return NextResponse.json({ error: "roomId required" }, { status: 400 });
    }
    await wreckUpsertRoomTheme({
      roomId,
      lightingColor: body.lightingColor,
      musicGenre: body.musicGenre,
      ambiance: body.ambiance,
      password: body.password === null ? null : body.password,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[wreck-room/theme]", e);
    return NextResponse.json({ error: "Failed to save theme" }, { status: 500 });
  }
}
