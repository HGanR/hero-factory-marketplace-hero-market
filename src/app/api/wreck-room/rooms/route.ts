import { NextResponse } from "next/server";
import { wreckGetRooms } from "@/lib/wreck-room/queries";

export async function GET() {
  try {
    const rooms = await wreckGetRooms();
    return NextResponse.json(rooms);
  } catch (e) {
    console.error("[wreck-room/rooms]", e);
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}
