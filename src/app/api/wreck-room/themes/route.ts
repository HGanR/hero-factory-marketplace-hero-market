import { NextResponse } from "next/server";
import { wreckGetRoomThemes } from "@/lib/wreck-room/queries";

export async function GET() {
  try {
    const themes = await wreckGetRoomThemes();
    const safe = themes.map((t) => ({
      roomId: t.roomId,
      lightingColor: t.lightingColor,
      musicGenre: t.musicGenre,
      ambiance: t.ambiance,
      passwordHash: t.passwordHash ? "locked" : null,
    }));
    return NextResponse.json(safe);
  } catch (e) {
    console.error("[wreck-room/themes]", e);
    return NextResponse.json({ error: "Failed to load themes" }, { status: 500 });
  }
}
