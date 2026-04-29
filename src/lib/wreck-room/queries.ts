import { eq, desc } from "drizzle-orm";
import * as crypto from "crypto";
import { getDb } from "@/lib/db";
import { wreckRooms, wreckMessages, wreckRoomThemes } from "./schema";

export async function wreckGetRooms() {
  const db = await getDb();
  return db.select().from(wreckRooms).where(eq(wreckRooms.isPublic, 1));
}

export async function wreckGetRecentMessages(roomId: number, limit = 50) {
  const db = await getDb();
  return db
    .select()
    .from(wreckMessages)
    .where(eq(wreckMessages.roomId, roomId))
    .orderBy(desc(wreckMessages.createdAt))
    .limit(limit)
    .then((rows) => rows.reverse());
}

export async function wreckSaveMessage(data: {
  roomId: number;
  userId?: number;
  username: string;
  content: string;
  type?: "chat" | "system" | "emote";
}) {
  const db = await getDb();
  await db.insert(wreckMessages).values({
    roomId: data.roomId,
    userId: data.userId,
    username: data.username,
    content: data.content,
    type: data.type ?? "chat",
  });
}

export async function wreckGetRoomThemes() {
  const db = await getDb();
  return db.select().from(wreckRoomThemes);
}

export async function wreckVerifyRoomPassword(roomId: number, password: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(wreckRoomThemes)
    .where(eq(wreckRoomThemes.roomId, roomId))
    .limit(1);
  const row = rows[0];
  if (!row?.passwordHash) return true;
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  return hash === row.passwordHash;
}

export async function wreckUpsertRoomTheme(data: {
  roomId: number;
  lightingColor?: string;
  musicGenre?: string;
  password?: string | null;
  ambiance?: string;
}) {
  const db = await getDb();
  const passwordHash =
    data.password != null
      ? crypto.createHash("sha256").update(data.password).digest("hex")
      : data.password === null
        ? null
        : undefined;
  const values: Record<string, unknown> = {
    roomId: data.roomId,
    lightingColor: data.lightingColor ?? "#ff0080",
    musicGenre: data.musicGenre ?? "Electronic",
    ambiance: data.ambiance ?? "club",
  };
  if (passwordHash !== undefined) values.passwordHash = passwordHash;
  await db
    .insert(wreckRoomThemes)
    .values(values as never)
    .onDuplicateKeyUpdate({ set: values as never });
}
