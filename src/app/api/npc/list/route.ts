import { NextResponse } from "next/server";
import { listNpcs, seedDefaultNpcs } from "@/lib/npc/db";

export async function GET() {
  await seedDefaultNpcs();
  const npcs = await listNpcs();
  return NextResponse.json({ npcs });
}
