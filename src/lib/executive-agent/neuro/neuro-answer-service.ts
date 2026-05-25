import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  NEURO_NO_SOURCE_MESSAGE,
  neuroDisclaimerForSubject,
  neuroSourceBackedPreamble,
} from "@/lib/executive-agent/neuro/neuro-governance";
import { searchNeuroSources } from "@/lib/executive-agent/neuro/neuro-search-service";
import { insertNeuroAccessLog } from "@/lib/executive-agent/neuro/neuro-store";
import type {
  NeuroAssignedAgent,
  NeuroSourceAnswerDto,
  NeuroSubjectArea,
} from "@/lib/executive-agent/neuro/neuro-types";

type Db = MySql2Database<typeof schema>;

/** Read-only Skipper tool — answers strictly from indexed NEURO chunks (no LLM fabrication). */
export async function getNeuroSourceAnswer(
  db: Db,
  input: {
    adminUserId: number;
    query: string;
    subjectArea?: NeuroSubjectArea | null;
    assignedAgent?: NeuroAssignedAgent | null;
  }
): Promise<NeuroSourceAnswerDto> {
  const q = input.query.trim();
  await insertNeuroAccessLog(db, {
    adminUserId: input.adminUserId,
    action: "source_answer",
    queryText: q,
    subjectArea: input.subjectArea ?? null,
    assignedAgent: input.assignedAgent ?? null,
  });

  const search = await searchNeuroSources(db, {
    adminUserId: input.adminUserId,
    query: q,
    subjectArea: input.subjectArea,
    assignedAgent: input.assignedAgent,
    limit: 5,
  });

  if (!search.sourceBacked || search.hits.length === 0) {
    return {
      query: q,
      answerSummary: NEURO_NO_SOURCE_MESSAGE,
      citedSources: [],
      sourceConfidence: 0,
      unsupportedClaims: [],
      recommendedFollowUp: "Upload a source document to the NEURO desk for this subject region.",
      sourceBacked: false,
      disclaimer: neuroDisclaimerForSubject(input.subjectArea ?? null),
      noSourceMessage: NEURO_NO_SOURCE_MESSAGE,
    };
  }

  const top = search.hits[0]!;
  const preamble = neuroSourceBackedPreamble(search.hits.length, top.fileName);
  const passage = top.snippet.replace(/^…/, "").replace(/…$/, "");
  const pagePart = top.pageNumber != null ? `page ${top.pageNumber}` : top.sourceLocator;
  const answerSummary =
    `${preamble} ` +
    `From ${top.fileName} (${pagePart}): "${passage}" ` +
    `(Source-backed excerpt — not general reasoning.)`;

  const avgConfidence =
    search.hits.reduce((s, h) => s + h.confidence, 0) / Math.max(1, search.hits.length);

  return {
    query: q,
    answerSummary,
    citedSources: search.hits,
    sourceConfidence: Math.round(avgConfidence * 1000) / 1000,
    unsupportedClaims: [],
    recommendedFollowUp:
      search.hits.length > 1
        ? "Say “open the source” to view the strongest cited passage in the NEURO HUD."
        : null,
    sourceBacked: true,
    disclaimer: search.disclaimer,
    noSourceMessage: null,
  };
}
