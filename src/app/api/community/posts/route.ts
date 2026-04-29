import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { communityPosts, marketplaceUsers } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  text: z.string().max(5000).optional(),
  visibility: z.enum(["public", "private"]),
  mediaType: z.enum(["image", "video", "audio"]).optional(),
  mediaUrl: z.string().optional(),
  audioUrl: z.string().optional(),
});

export async function GET(_request: NextRequest) {
  const userId = await getAuthedUserId(); // may be null => public only
  const db = await getDb();

  const whereClause = userId
    ? or(eq(communityPosts.visibility, "public"), eq(communityPosts.userId, userId))
    : eq(communityPosts.visibility, "public");

  const rows = await db
    .select({
      id: communityPosts.id,
      userId: communityPosts.userId,
      title: communityPosts.title,
      text: communityPosts.text,
      visibility: communityPosts.visibility,
      mediaType: communityPosts.mediaType,
      mediaUrl: communityPosts.mediaUrl,
      audioUrl: communityPosts.audioUrl,
      score: communityPosts.score,
      votes: communityPosts.votes,
      superVotes: communityPosts.superVotes,
      createdAt: communityPosts.createdAt,
      username: marketplaceUsers.username,
    })
    .from(communityPosts)
    .leftJoin(marketplaceUsers, eq(marketplaceUsers.id, communityPosts.userId))
    .where(whereClause)
    .orderBy(desc(communityPosts.createdAt))
    .limit(200);

  return NextResponse.json({
    meUserId: userId,
    posts: rows.map((r) => ({
      id: String(r.id),
      userId: r.userId,
      title: r.title,
      text: r.text ?? undefined,
      visibility: r.visibility,
      mediaType: r.mediaType ?? undefined,
      mediaUrl: r.mediaUrl ?? undefined,
      audioUrl: r.audioUrl ?? undefined,
      score: r.score,
      votes: r.votes,
      superVotes: r.superVotes,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Date.now(),
      by: r.username ?? `User_${r.userId}`,
      isMine: userId ? r.userId === userId : false,
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof CreatePostSchema>;
  try {
    body = CreatePostSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  // Basic sanity: if mediaType provided, mediaUrl should exist (and vice versa)
  if (body.mediaType && !body.mediaUrl) {
    return NextResponse.json({ error: "mediaUrl is required when mediaType is set" }, { status: 400 });
  }

  const db = await getDb();

  const insertRow = {
    userId,
    title: body.title,
    text: body.text ?? null,
    visibility: body.visibility,
    mediaType: body.mediaType ?? null,
    mediaUrl: body.mediaUrl ?? null,
    audioUrl: body.audioUrl ?? null,
    score: 0,
    votes: 0,
    superVotes: 0,
  } as any;

  await db.insert(communityPosts).values(insertRow);

  const saved = await db
    .select({
      id: communityPosts.id,
      userId: communityPosts.userId,
      title: communityPosts.title,
      text: communityPosts.text,
      visibility: communityPosts.visibility,
      mediaType: communityPosts.mediaType,
      mediaUrl: communityPosts.mediaUrl,
      audioUrl: communityPosts.audioUrl,
      score: communityPosts.score,
      votes: communityPosts.votes,
      superVotes: communityPosts.superVotes,
      createdAt: communityPosts.createdAt,
      username: marketplaceUsers.username,
    })
    .from(communityPosts)
    .leftJoin(marketplaceUsers, eq(marketplaceUsers.id, communityPosts.userId))
    .where(and(eq(communityPosts.userId, userId), eq(communityPosts.title, body.title)))
    .orderBy(desc(communityPosts.createdAt))
    .limit(1);

  const r = saved[0];
  if (!r) return NextResponse.json({ success: true });

  return NextResponse.json({
    post: {
      id: String(r.id),
      userId: r.userId,
      title: r.title,
      text: r.text ?? undefined,
      visibility: r.visibility,
      mediaType: r.mediaType ?? undefined,
      mediaUrl: r.mediaUrl ?? undefined,
      audioUrl: r.audioUrl ?? undefined,
      score: r.score,
      votes: r.votes,
      superVotes: r.superVotes,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Date.now(),
      by: r.username ?? `User_${r.userId}`,
      isMine: true,
    },
  });
}


