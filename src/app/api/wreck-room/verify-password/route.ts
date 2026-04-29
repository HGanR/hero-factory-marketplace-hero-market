import { NextRequest, NextResponse } from "next/server";
import { wreckVerifyRoomPassword } from "@/lib/wreck-room/queries";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomId = Number(body.roomId);
    const password = String(body.password ?? "");
    if (!roomId || !password) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }
    const valid = await wreckVerifyRoomPassword(roomId, password);
    return NextResponse.json({ valid });
  } catch (e) {
    console.error("[wreck-room/verify-password]", e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
