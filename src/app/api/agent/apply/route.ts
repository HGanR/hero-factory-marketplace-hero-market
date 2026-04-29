import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { agentActions, agentSessions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { applyJsonPatch, deepEqual, validatePatch } from "@/lib/agent/patch";
import { DaoTokenVotingConstitutionSchema } from "@/lib/governance/constitution/dao-token-voting/schema";
import { DAO_FIELD_BINDINGS, DAO_FIELD_ORDER, DAO_SCHEMA_VERSION, getDaoBindingByPath } from "@/lib/governance/constitution/dao-token-voting/bindings";
import { getPlaybookById } from "@/lib/entity-playbooks";
import { getPlaybookProgress } from "@/lib/entity-playbooks/progress";

const PatchSchema = z.object({
  op: z.enum(["add", "replace", "remove"]),
  path: z.string().min(1),
  value: z.any().optional(),
});

const RequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  moduleType: z.string(),
  playbookId: z.string().optional(),
  draft: z.any(),
  patch: z.array(PatchSchema),
  proposal: z.any().optional(),
  accepted: z.boolean().optional(),
  expectedStateVersion: z.number().int().optional(),
  confirmClear: z.boolean().optional(),
});

const ALLOWED_PATHS: Record<string, string[]> = {
  constitution_dao_token_voting: ["/constitutionDraft", "/governanceDocs", "/constitutionSubtype"],
};

function getMissingFields(payload: unknown): string[] {
  const parsed = DaoTokenVotingConstitutionSchema.safeParse(payload);
  if (parsed.success) return [];
  const keys = parsed.error.issues
    .map((issue) => String(issue.path[0] ?? ""))
    .filter((key) => Boolean(key) && DAO_FIELD_BINDINGS[key]);
  const unique = Array.from(new Set(keys));
  const ordered = DAO_FIELD_ORDER.filter((key) => unique.includes(key));
  return ordered;
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body", details: body.error.flatten() }, { status: 400 });
  }

  const { moduleType, draft, patch, proposal, accepted, sessionId, expectedStateVersion, confirmClear } = body.data;
  const playbookId = body.data.playbookId;
  const playbook = playbookId ? getPlaybookById(playbookId) : undefined;
  const allowedPrefixes = ALLOWED_PATHS[moduleType] ?? [];
  if (allowedPrefixes.length === 0) {
    return NextResponse.json({ error: "Unsupported module type" }, { status: 400 });
  }
  try {
    validatePatch(patch, allowedPrefixes);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Invalid patch" }, { status: 400 });
  }

  const currentVersion = typeof draft?.stateVersion === "number" ? draft.stateVersion : 0;
  if (typeof expectedStateVersion === "number" && expectedStateVersion !== currentVersion) {
    return NextResponse.json(
      { error: "STATE_VERSION_MISMATCH", currentVersion },
      { status: 409 }
    );
  }

  if (moduleType === "constitution_dao_token_voting") {
    for (const op of patch) {
      if (op.op === "remove") {
        const binding = getDaoBindingByPath(op.path);
        if (binding && (binding.required === true || binding.required === "conditional") && !confirmClear) {
          return NextResponse.json(
            { error: "REQUIRES_CONFIRM_CLEAR", bindingKey: binding.key, bindingPath: binding.path },
            { status: 400 }
          );
        }
      }
    }
  }

  const nextDraft = structuredClone(draft ?? {});
  if (moduleType === "constitution_dao_token_voting") {
    if (!nextDraft.constitutionDraft || typeof nextDraft.constitutionDraft !== "object") {
      nextDraft.constitutionDraft = {
        subtype: "dao_token_voting",
        state: nextDraft.governingState ?? "NY",
        data: {},
      };
    } else if (!nextDraft.constitutionDraft.data) {
      nextDraft.constitutionDraft.data = {};
    }
  }

  const beforeHash = hashJson(nextDraft);
  const patchHash = hashJson(patch);
  applyJsonPatch(nextDraft, patch);
  const noOp = deepEqual(nextDraft, draft ?? {});
  if (!noOp) {
    nextDraft.stateVersion = currentVersion + 1;
  }

  let validation: { ok: boolean; issues?: string[] } | null = null;
  let remainingQuestions: number | null = null;
  let remainingQuestionsDoc: number | null = null;
  let nextQuestion: any = null;
  let missingFieldKeys: string[] = [];
  let currentDocument: { docType: string; subtype?: string; schemaVersion?: string } | null = null;
  let progress: any = playbook ? getPlaybookProgress(playbook, nextDraft) : null;
  if (
    moduleType === "constitution_dao_token_voting" &&
    (nextDraft.governanceDocs ?? []).includes("constitution") &&
    nextDraft.constitutionSubtype === "dao_token_voting"
  ) {
    const payload = nextDraft.constitutionDraft?.data ?? nextDraft.constitutionDraft ?? {};
    const parsed = DaoTokenVotingConstitutionSchema.safeParse(payload);
    validation = parsed.success
      ? { ok: true }
      : { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };

    missingFieldKeys = getMissingFields(payload);
    const missingRequired = missingFieldKeys.filter((key) => {
      const binding = DAO_FIELD_BINDINGS[key];
      return binding?.required === true || binding?.required === "conditional";
    });
    remainingQuestions = missingRequired.length;
    remainingQuestionsDoc = missingRequired.length;
    currentDocument = { docType: "constitution", subtype: "dao_token_voting", schemaVersion: DAO_SCHEMA_VERSION };
    if (missingFieldKeys[0]) {
      const binding = DAO_FIELD_BINDINGS[missingFieldKeys[0]];
      nextQuestion = {
        key: binding.key,
        text: binding.question,
        fieldTargets: [binding.path],
        answerType: binding.answerType,
        constraints: binding.constraints,
        options: binding.options,
      };
    }
    progress = playbook ? getPlaybookProgress(playbook, nextDraft) : progress;
  }

  const db = await getDb();
  let resolvedSessionId = sessionId ?? null;
  if (!resolvedSessionId) {
    resolvedSessionId = crypto.randomUUID();
    await db.insert(agentSessions).values({
      id: resolvedSessionId,
      trustId: null,
      moduleType,
      status: "active",
      createdByUserId: userId,
      messages: [],
    } as any);
  }

  const afterHash = hashJson(nextDraft);
  const firstBinding = moduleType === "constitution_dao_token_voting" ? getDaoBindingByPath(patch[0]?.path ?? "") : null;

  await db.insert(agentActions).values({
    id: crypto.randomUUID(),
    sessionId: resolvedSessionId,
    proposalJson: proposal ?? {},
    appliedPatchJson: patch,
    acceptedByUserId: accepted ? userId : null,
    notes: null,
    bindingKey: firstBinding?.key ?? null,
    bindingPath: firstBinding?.path ?? null,
    schemaVersion: moduleType === "constitution_dao_token_voting" ? DAO_SCHEMA_VERSION : null,
    beforeHash,
    afterHash,
    patchHash,
    noOp,
  } as any);

  return NextResponse.json({
    ok: true,
    sessionId: resolvedSessionId,
    updatedDraft: nextDraft,
    validation,
    noOp,
    remainingQuestions,
    remainingQuestionsDoc,
    currentDocument,
    progress,
    nextQuestion,
    missingFieldKeys,
  });
}
