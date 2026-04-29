import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { resolveNpcAdminSessionFromCookieHeader } from "@/lib/admin/require-npc-admin";
import { createNpc, deactivateNpc, listNpcs, seedDefaultNpcs, updateNpc } from "@/lib/npc/db";
import type { NPCRole, PersonalityTraits } from "@/lib/npc/types";
import { DEFAULT_PERSONALITY } from "@/lib/npc/engine";

/** Pages Router Node — `/api/npc/admin/npcs` (App route removed). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authed = await resolveNpcAdminSessionFromCookieHeader(req.headers.cookie);
  if (!authed) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      await seedDefaultNpcs();
      const npcs = await listNpcs({ includeInactive: true });
      return res.status(200).json({ npcs });
    } catch (e) {
      console.error("GET /api/npc/admin/npcs failed", e);
      const message = e instanceof Error ? e.message : "Failed to list NPCs";
      return res.status(500).json({ error: message, npcs: [] });
    }
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const name = String(body?.name || "").trim();
      const role = body?.role as NPCRole | undefined;
      if (!name || !role) {
        return res.status(400).json({ error: "Missing name or role" });
      }

      const personality = (body?.personality as PersonalityTraits) || DEFAULT_PERSONALITY;
      const npc = await createNpc({
        npcId: body?.npcId ? String(body.npcId) : randomUUID(),
        name,
        role,
        title: body?.title ? String(body.title) : null,
        avatarEmoji: body?.avatarEmoji ? String(body.avatarEmoji) : "🤖",
        voiceStyle: body?.voiceStyle || "friendly",
        language: body?.language ? String(body.language).trim() || null : null,
        worldId: body?.worldId ? String(body.worldId) : null,
        greeting: body?.greeting ? String(body.greeting) : null,
        farewell: body?.farewell ? String(body.farewell) : null,
        personality,
      });

      if (!npc?.id) {
        return res.status(500).json({ error: "Create succeeded but profile is missing id" });
      }

      return res.status(200).json({ npc });
    } catch (e) {
      console.error("POST /api/npc/admin/npcs failed", e);
      const message = e instanceof Error ? e.message : "Failed to create NPC";
      return res.status(500).json({ error: message });
    }
  }

  if (req.method === "PATCH") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const npcId = String(body?.npcId || "").trim();
      if (!npcId) {
        return res.status(400).json({ error: "Missing npcId" });
      }

      const npc = await updateNpc({
        npcId,
        name: body?.name ? String(body.name) : undefined,
        title: body?.title !== undefined ? String(body.title) : undefined,
        avatarEmoji: body?.avatarEmoji !== undefined ? String(body.avatarEmoji) : undefined,
        voiceStyle: body?.voiceStyle,
        language: body?.language !== undefined ? (body.language ? String(body.language).trim() : null) : undefined,
        greeting: body?.greeting !== undefined ? String(body.greeting) : undefined,
        farewell: body?.farewell !== undefined ? String(body.farewell) : undefined,
        personality: body?.personality,
      });

      if (!npc?.id) {
        return res.status(500).json({ error: "Update returned no NPC profile" });
      }

      return res.status(200).json({ npc });
    } catch (e) {
      console.error("PATCH /api/npc/admin/npcs failed", e);
      const message = e instanceof Error ? e.message : "Failed to update NPC";
      return res.status(500).json({ error: message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const npcId = String(body?.npcId || "").trim();
      if (!npcId) {
        return res.status(400).json({ error: "Missing npcId" });
      }
      await deactivateNpc(npcId);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("DELETE /api/npc/admin/npcs failed", e);
      const message = e instanceof Error ? e.message : "Failed to deactivate NPC";
      return res.status(500).json({ error: message });
    }
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
