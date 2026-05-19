import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { redactExecutiveBriefingJsonValue } from "@/lib/executive-agent/executive-briefing-redact";
import { isExecutiveMemoryItemActive } from "@/lib/executive-agent/executive-memory-active";
import { buildSuggestedExecutiveMemoryItems } from "@/lib/executive-agent/executive-memory-suggestions";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("executive phase 7 — no auto-persist from orchestrator", () => {
  it("orchestrator module does not import memory store create/insert", () => {
    const p = join(__dirname, "executive-agent-orchestrator.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("createExecutiveMemoryItem"), false);
    assert.equal(src.includes("executive-memory-store"), false);
    assert.ok(src.includes("suggestedMemoryItems"));
    assert.ok(src.includes("buildSuggestedExecutiveMemoryItems"));
  });

  it("voice turn route persists voice rows only, not executive memory", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("insertExecutiveVoiceTurn"));
    assert.equal(src.includes("createExecutiveMemoryItem"), false);
    assert.equal(src.includes("executive-memory-store"), false);
  });
});

describe("executive phase 7 — briefing content", () => {
  it("daily briefing builder includes approvals and client follow-up channels", () => {
    const p = join(__dirname, "executive-briefing-builder.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("approvalsNeeded"));
    assert.ok(src.includes("clientFollowUps"));
    assert.ok(src.includes("listExecutiveApprovals"));
    assert.ok(src.includes("buildFollowUpRecommendations"));
  });
});

describe("executive phase 7 — memory activity", () => {
  it("treats expired or archived memory as inactive", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    assert.equal(
      isExecutiveMemoryItemActive({ archivedAt: null, expiresAt: new Date("2026-05-01T00:00:00Z") }, now),
      false,
    );
    assert.equal(
      isExecutiveMemoryItemActive({ archivedAt: new Date("2026-05-15T00:00:00Z"), expiresAt: null }, now),
      false,
    );
    assert.equal(
      isExecutiveMemoryItemActive({ archivedAt: null, expiresAt: new Date("2026-07-01T00:00:00Z") }, now),
      true,
    );
  });
});

describe("executive phase 7 — redaction", () => {
  it("redacts secrets and sensitive keys in briefing JSON", () => {
    const raw = {
      headline: "rotate sk-proj-abcdefghijklmnopqrstuvwxyz",
      approvalsNeeded: [{ id: "1", title: "x", proposedAction: "z" }],
      extra: { api_key: "super-secret" },
    };
    const out = redactExecutiveBriefingJsonValue(raw) as typeof raw;
    assert.equal(out.extra.api_key, "[REDACTED]");
    assert.equal(out.headline.includes("sk-proj-"), false);
  });
});

describe("executive phase 7 — memory API admin gate", () => {
  it("memory and briefing routes require executive admin auth helper", () => {
    for (const rel of [
      "../../app/api/admin/executive-agent/memory/route.ts",
      "../../app/api/admin/executive-agent/memory/[id]/route.ts",
      "../../app/api/admin/executive-agent/briefing/today/route.ts",
      "../../app/api/admin/executive-agent/briefing/generate/route.ts",
    ]) {
      const src = readFileSync(join(__dirname, rel), "utf8");
      assert.ok(src.includes("getExecutiveAdminUserId"));
      assert.ok(src.includes("Unauthorized"));
    }
  });
});

describe("executive phase 7 — voice/chat suggestions", () => {
  it("suggestion builder labels voice channel and does not persist", () => {
    const items = buildSuggestedExecutiveMemoryItems({
      prompt: "From now on prefer concise summaries",
      channel: "voice",
      reasoningSummary: null,
    });
    assert.ok(items.length >= 1);
    assert.equal(items[0]!.suggestionSource, "voice");
  });
});
