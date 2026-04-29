// src/lib/challenge/spring2026/scoring.ts
import crypto from "crypto";
import type { SpringAnswers } from "./zod";
import { MIN_QUALIFY_SCORE } from "./constants";

export interface PhaseScores {
  phase1: number;
  phase2: number;
  phase3: number;
  phase4: number;
  phase5: number;
}

/** Deterministic scoring: each phase worth up to 20 points. */
export function computeSpring2026Score(answers: SpringAnswers): { total: number; phaseScores: PhaseScores } {
  const phase1 = scorePhase1(answers.phase1);
  const phase2 = scorePhase2(answers.phase2);
  const phase3 = scorePhase3(answers.phase3);
  const phase4 = scorePhase4(answers.phase4);
  const phase5 = scorePhase5(answers.phase5);

  const phaseScores: PhaseScores = { phase1, phase2, phase3, phase4, phase5 };
  const total = phase1 + phase2 + phase3 + phase4 + phase5;
  return { total, phaseScores };
}

function scorePhase1(p: SpringAnswers["phase1"]): number {
  let s = 0;
  if (p.entityType && ["llc", "c-corp", "s-corp"].includes(p.entityType)) s += 6;
  else if (p.entityType) s += 4;
  if (p.jurisdiction?.length >= 2) s += 6;
  if (p.businessPurpose?.length >= 20 && p.businessPurpose?.length <= 500) s += 8;
  else if (p.businessPurpose?.length >= 10) s += 4;
  return Math.min(20, s);
}

function scorePhase2(p: SpringAnswers["phase2"]): number {
  let s = 0;
  const owners = p.owners || [];
  if (owners.length >= 1 && owners.length <= 10) s += 6;
  const totalPct = owners.reduce((sum, o) => sum + (o.pct ?? 0), 0);
  if (Math.abs(totalPct - 100) < 1) s += 8;
  else if (Math.abs(totalPct - 100) < 5) s += 4;
  const allNamed = owners.every((o) => o.name?.trim?.().length >= 1);
  if (allNamed) s += 6;
  return Math.min(20, s);
}

function scorePhase3(p: SpringAnswers["phase3"]): number {
  let s = 0;
  if (p.operatingAgreement) s += 6;
  if (p.capTable) s += 5;
  if (p.bankAccountSim === "yes") s += 4;
  else if (p.bankAccountSim === "pending") s += 2;
  if (p.einSim === "yes") s += 5;
  else if (p.einSim === "pending") s += 2;
  return Math.min(20, s);
}

function scorePhase4(p: SpringAnswers["phase4"]): number {
  let s = 0;
  const checklist = p.complianceChecklist || [];
  if (checklist.length >= 3) s += 10;
  else if (checklist.length >= 1) s += 5;
  const filings = p.filingAwareness || [];
  if (filings.length >= 2) s += 5;
  else if (filings.length >= 1) s += 2;
  return Math.min(20, s);
}

function scorePhase5(p: SpringAnswers["phase5"]): number {
  let s = 0;
  if (p.governanceChoice) s += 6;
  if (p.annualMeeting) s += 7;
  if (p.recordkeeping) s += 7;
  return Math.min(20, s);
}

export function submissionHash(answers: SpringAnswers, submissionId: string): string {
  const payload = JSON.stringify({ answers, submissionId }, Object.keys(answers).sort());
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function qualifies(totalScore: number): boolean {
  return totalScore >= MIN_QUALIFY_SCORE;
}
