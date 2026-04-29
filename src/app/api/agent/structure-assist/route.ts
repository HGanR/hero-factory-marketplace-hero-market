import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { DaoTokenVotingConstitutionSchema } from "@/lib/governance/constitution/dao-token-voting/schema";
import { DAO_FIELD_BINDINGS, DAO_FIELD_ORDER } from "@/lib/governance/constitution/dao-token-voting/bindings";
import { getPlaybookById } from "@/lib/entity-playbooks";
import { getPlaybookProgress } from "@/lib/entity-playbooks/progress";

const RequestSchema = z.object({
  moduleType: z.string(),
  playbookId: z.string().optional(),
  draft: z.any(),
  readiness: z.any().optional(),
  sessionId: z.string().uuid().optional(),
  trustId: z.string().uuid().optional(),
});

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

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body", details: body.error.flatten() }, { status: 400 });
  }

  const { moduleType, playbookId, draft, sessionId, trustId, readiness } = body.data;
  const db = await getDb();
  let resolvedSessionId = sessionId ?? null;
  const playbook = playbookId ? getPlaybookById(playbookId) : undefined;
  const progress = playbook ? getPlaybookProgress(playbook, draft) : null;
  const currentDocument = playbook?.documents?.find((doc) => progress?.currentDocId?.startsWith(`${doc.docType}:${doc.subtype ?? "base"}`))
    ?? playbook?.documents?.[0]
    ?? { docType: "constitution", subtype: "dao_token_voting", schemaVersion: "1.0.0", bindingsKey: "dao_token_voting" };

  if (!resolvedSessionId) {
    resolvedSessionId = crypto.randomUUID();
    await db.insert(agentSessions).values({
      id: resolvedSessionId,
      trustId: trustId ?? null,
      moduleType,
      status: "active",
      createdByUserId: userId,
      messages: [],
    } as any);
  }

  if (moduleType !== "constitution_dao_token_voting") {
    return NextResponse.json({
      sessionId: resolvedSessionId,
      nextQuestion: null,
      remainingQuestions: 0,
      remainingQuestionsDoc: 0,
      currentDocument,
      progress,
      missingFieldKeys: [],
      blockers: readiness?.blockers ?? [],
      advisories: readiness?.advisories ?? [],
    });
  }

  const hasConstitution = (draft?.governanceDocs ?? []).includes("constitution");
  if (!hasConstitution || draft?.constitutionSubtype !== "dao_token_voting") {
    return NextResponse.json({
      sessionId: resolvedSessionId,
      nextQuestion: null,
      remainingQuestions: 0,
      remainingQuestionsDoc: 0,
      currentDocument,
      progress,
      missingFieldKeys: [],
      blockers: readiness?.blockers ?? [],
      advisories: readiness?.advisories ?? [],
    });
  }

  const payload = draft?.constitutionDraft?.data ?? draft?.constitutionDraft ?? {};
  const missingFields = getMissingFields(payload);
  const missingRequired = missingFields.filter((key) => {
    const binding = DAO_FIELD_BINDINGS[key];
    return binding?.required === true || binding?.required === "conditional";
  });
  const nextKey = missingFields[0];
  if (!nextKey) {
    return NextResponse.json({
      sessionId: resolvedSessionId,
      nextQuestion: null,
      remainingQuestions: 0,
      remainingQuestionsDoc: 0,
      currentDocument,
      progress,
      missingFieldKeys: [],
      blockers: readiness?.blockers ?? [],
      advisories: readiness?.advisories ?? [],
    });
  }

  const binding = DAO_FIELD_BINDINGS[nextKey];

  return NextResponse.json({
    sessionId: resolvedSessionId,
    nextQuestion: {
      key: binding.key,
      text: binding.question,
      fieldTargets: [binding.path],
      answerType: binding.answerType,
      constraints: binding.constraints,
      options: binding.options,
    },
    remainingQuestions: missingRequired.length,
    remainingQuestionsDoc: missingRequired.length,
    currentDocument,
    progress,
    missingFieldKeys: missingFields,
    blockers: readiness?.blockers ?? [],
    advisories: readiness?.advisories ?? [],
  });
}
