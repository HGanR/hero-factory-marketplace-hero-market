"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type JsonPatchOp = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};

type AgentQuestion = {
  key: string;
  text: string;
  fieldTargets: string[];
  answerType: "text" | "number" | "select" | "multiselect" | "boolean";
  constraints?: Record<string, unknown>;
  options?: string[];
};

type AgentAssistPanelProps = {
  draft: any;
  setDraft: (updater: (prev: any) => any) => void;
  moduleType: string;
  playbookId?: string;
  readiness?: { blockers: { length: number } | number; advisories: { length: number } | number };
  autoStart?: boolean;
  agentSource?: "trust-records" | "smart-trust" | "ecclesiastical" | "unknown";
  trustId?: string;
  clientId?: string;
  workspaceId?: string;
  clientName?: string;
  trustName?: string;
  currentStep?: string;
  contextBlockers?: string[];
  contextAdvisories?: string[];
  completionPctOverride?: number;
};

export function buildStepFocus(source: AgentAssistPanelProps["agentSource"], currentStep?: string): string {
  const step = (currentStep || "").toLowerCase();
  if (!step) return "general trust workspace progression";

  if (source === "smart-trust") {
    if (step.includes("setup")) return "matter setup: entity type, governing state, governance package";
    if (step.includes("parties")) return "party intake: grantor, trustee, beneficiaries and role completeness";
    if (step.includes("assets")) return "asset intake and funding plan completeness";
    if (step.includes("terms")) return "trust terms consistency and missing decision points";
    if (step.includes("compliance")) return "compliance checklist and counsel-ready review items";
    if (step.includes("review")) return "final review and export readiness";
  }

  if (source === "trust-records") {
    if (step.includes("issue")) return "certificate issuance prerequisites and blockers";
    if (step.includes("assets")) return "asset registry completion and evidence quality";
    if (step.includes("registry")) return "record integrity and canonical data quality";
    if (step.includes("bonds")) return "bond issuance prerequisites and references";
    if (step.includes("governance")) return "governance records, minutes, and approvals";
    if (step.includes("estate")) return "estate instrument readiness and filing steps";
    if (step.includes("settings")) return "workspace binding and trust configuration hygiene";
  }

  if (source === "ecclesiastical") {
    if (step.includes("wizard")) return "ecclesiastical intake, legal structure, and counsel workflow";
    if (step.includes("guardrails")) return "legal guardrails and risk controls";
    if (step.includes("trustee")) return "trustee packet completion and sign-off readiness";
  }

  return `current step "${currentStep}" progression`;
}

export function AgentAssistPanel({
  draft,
  setDraft,
  moduleType,
  playbookId,
  readiness,
  autoStart = false,
  agentSource = "unknown",
  trustId,
  clientId,
  workspaceId,
  clientName,
  trustName,
  currentStep,
  contextBlockers,
  contextAdvisories,
  completionPctOverride,
}: AgentAssistPanelProps) {
  const [mode, setMode] = useState<"interview" | "draft">("interview");
  const [nextQuestion, setNextQuestion] = useState<AgentQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ ok: boolean; issues?: string[] } | null>(null);
  const [remainingQuestions, setRemainingQuestions] = useState<number | null>(null);
  const [remainingQuestionsDoc, setRemainingQuestionsDoc] = useState<number | null>(null);
  const [currentDocument, setCurrentDocument] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Array<{ code: string; message: string }>>([]);
  const [jarvaSessionId, setJarvaSessionId] = useState<string | null>(null);
  const [jarvaAdvice, setJarvaAdvice] = useState<string | null>(null);
  const [jarvaBusy, setJarvaBusy] = useState(false);

  const readinessSummary = useMemo(() => {
    const blockers = typeof readiness?.blockers === "number" ? readiness.blockers : readiness?.blockers?.length ?? 0;
    const advisories = typeof readiness?.advisories === "number" ? readiness.advisories : readiness?.advisories?.length ?? 0;
    return { blockers, advisories };
  }, [readiness]);
  const stepFocus = useMemo(() => buildStepFocus(agentSource, currentStep), [agentSource, currentStep]);
  const contextCompletion = completionPctOverride ?? progressPercent ?? null;

  const fetchJarvaAdvice = useCallback(
    async (reason: "no-question" | "manual") => {
      if (jarvaBusy) return;
      setJarvaBusy(true);
      try {
        const res = await fetch("/api/npc/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message:
              reason === "manual"
                ? `I am on ${agentSource} at step ${currentStep || "unknown"} in module ${moduleType}. Focus on ${stepFocus}. Reply as a concise checklist with exactly: (1) Next 3 actions, (2) 1 critical check, (3) 1 mistake to avoid.`
                : `Agent Assist has no structured next question for module ${moduleType} on ${agentSource}. Focus on ${stepFocus}. Reply as a concise checklist with exactly: (1) Next 3 actions, (2) 1 key unblocker question, (3) 1 risk to watch.`,
            npcId: "trust-advisor",
            ...(jarvaSessionId ? { sessionId: jarvaSessionId } : {}),
            context: {
              source: agentSource,
              trustId,
              clientId,
              currentStep,
              stepFocus,
              clientName,
              trustName,
              moduleType,
              workspaceId,
              completionPct: completionPctOverride ?? progressPercent ?? undefined,
              blockers:
                contextBlockers && contextBlockers.length > 0
                  ? contextBlockers.slice(0, 8)
                  : readinessSummary.blockers > 0
                  ? [`${readinessSummary.blockers} unresolved checklist blockers`]
                  : [],
              advisories:
                contextAdvisories && contextAdvisories.length > 0
                  ? contextAdvisories.slice(0, 8)
                  : readinessSummary.advisories > 0
                  ? [`${readinessSummary.advisories} advisory items to review`]
                  : [],
            },
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Jarva guidance failed");
        setJarvaAdvice(typeof data?.response === "string" ? data.response : null);
        if (typeof data?.sessionId === "string") setJarvaSessionId(data.sessionId);
      } catch (err) {
        setJarvaAdvice(err instanceof Error ? err.message : "Jarva guidance unavailable");
      } finally {
        setJarvaBusy(false);
      }
    },
    [
      agentSource,
      clientId,
      clientName,
      currentStep,
      jarvaBusy,
      jarvaSessionId,
      moduleType,
      completionPctOverride,
      contextAdvisories,
      contextBlockers,
      progressPercent,
      readinessSummary.advisories,
      readinessSummary.blockers,
      stepFocus,
      trustId,
      trustName,
      workspaceId,
    ]
  );

  const fetchProposal = async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/agent/structure-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleType,
          playbookId,
          draft,
          readiness: readinessSummary,
          ...(sessionId ? { sessionId } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNextQuestion(data.nextQuestion ?? null);
      setRemainingQuestions(typeof data.remainingQuestions === "number" ? data.remainingQuestions : null);
      setRemainingQuestionsDoc(typeof data.remainingQuestionsDoc === "number" ? data.remainingQuestionsDoc : null);
      setCurrentDocument(data.currentDocument ? `${data.currentDocument.docType}${data.currentDocument.subtype ? `:${data.currentDocument.subtype}` : ""}` : null);
      setProgressPercent(typeof data.progress?.percent === "number" ? data.progress.percent : null);
      setRationale(data?.nextQuestion?.key ? "Required input is missing for DAO Token Voting Constitution." : null);
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      if (data.sessionId) setSessionId(data.sessionId);
      setStatus("ready");
      if (!data?.nextQuestion) {
        void fetchJarvaAdvice("no-question");
      } else {
        setJarvaAdvice(null);
      }
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Agent request failed");
    }
  };

  const parseAnswerValue = () => {
    if (!nextQuestion) return answer;
    const t = nextQuestion.answerType;
    if (t === "number") return Number(answer);
    if (t === "multiselect") return answer.split(",").map((s) => s.trim()).filter(Boolean);
    if (t === "boolean") return answer.trim().toLowerCase() === "true";
    return answer;
  };

  const applyAnswer = async () => {
    if (!nextQuestion) return;
    const value = parseAnswerValue();
    const patch: JsonPatchOp[] =
      nextQuestion.fieldTargets.map((path) => ({ op: "replace", path, value }));
    try {
      const res = await fetch("/api/agent/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(sessionId ? { sessionId } : {}),
          moduleType,
          playbookId,
          draft,
          patch,
          proposal: { nextQuestion, rationale, warnings },
          accepted: true,
          expectedStateVersion: draft.stateVersion ?? 0,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.updatedDraft) {
        setDraft(() => data.updatedDraft);
      }
      setValidation(data.validation ?? null);
      setAnswer("");
      if (typeof data.remainingQuestions === "number") {
        setRemainingQuestions(data.remainingQuestions);
      }
      if (typeof data.remainingQuestionsDoc === "number") {
        setRemainingQuestionsDoc(data.remainingQuestionsDoc);
      }
      if (data.currentDocument) {
        setCurrentDocument(`${data.currentDocument.docType}${data.currentDocument.subtype ? `:${data.currentDocument.subtype}` : ""}`);
      }
      if (typeof data.progress?.percent === "number") {
        setProgressPercent(data.progress.percent);
      }
      if (data.nextQuestion) {
        setNextQuestion(data.nextQuestion);
        setJarvaAdvice(null);
      } else {
        void fetchJarvaAdvice("no-question");
      }
    } catch (err: any) {
      setError(err?.message ?? "Apply failed");
    }
  };

  const showPanel = moduleType !== "unknown";
  const didAutoStartRef = React.useRef(false);

  React.useEffect(() => {
    if (!autoStart || !showPanel || status !== "idle" || didAutoStartRef.current) return;
    didAutoStartRef.current = true;
    fetchProposal();
  }, [autoStart, showPanel, status]);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Agent Assist</CardTitle>
        <CardDescription>Guided, auditable structure assistance (no auto-apply).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!showPanel ? (
          <Alert>
            <AlertTitle>Agent Assist unavailable</AlertTitle>
            <AlertDescription>Select a structure/governance subtype to enable guided assistance.</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Module: {moduleType}</Badge>
              {currentDocument ? <Badge variant="outline">Document: {currentDocument}</Badge> : null}
              {contextCompletion !== null ? <Badge variant="outline">Progress: {contextCompletion}%</Badge> : null}
              <Badge variant={readinessSummary.blockers ? "destructive" : "secondary"}>Blockers: {readinessSummary.blockers}</Badge>
              <Badge variant={readinessSummary.advisories ? "outline" : "secondary"}>Advisories: {readinessSummary.advisories}</Badge>
              <Badge variant="secondary">Remaining questions: {remainingQuestions ?? readinessSummary.blockers}</Badge>
              {remainingQuestionsDoc !== null ? <Badge variant="secondary">Doc remaining: {remainingQuestionsDoc}</Badge> : null}
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "interview" | "draft")}>
              <TabsList>
                <TabsTrigger value="interview">Interview Mode</TabsTrigger>
                <TabsTrigger value="draft">Draft Mode</TabsTrigger>
              </TabsList>
              <TabsContent value="interview" className="grid gap-3">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={fetchProposal} disabled={status === "loading"}>
                    {status === "loading" ? "Thinking..." : "Get next question"}
                  </Button>
                  <Button variant="outline" onClick={() => void fetchJarvaAdvice("manual")} disabled={jarvaBusy}>
                    {jarvaBusy ? "Asking Jarva..." : "Ask Jarva next actions"}
                  </Button>
                </div>

                {nextQuestion ? (
                  <div className="grid gap-2">
                    <Label>{nextQuestion.text}</Label>
                    <Input
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Enter answer..."
                    />
                    {nextQuestion.fieldTargets?.length ? (
                      <div className="text-xs text-muted-foreground">
                        Will fill: {nextQuestion.fieldTargets.join(", ")}
                      </div>
                    ) : null}
                    {rationale ? (
                      <div className="text-xs text-muted-foreground">
                        Why this matters: {rationale}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button onClick={applyAnswer} disabled={!answer.trim()}>
                        Apply answer
                      </Button>
                    </div>
                  </div>
                ) : status === "ready" ? (
                  <Alert>
                    <AlertTitle>All required inputs captured</AlertTitle>
                    <AlertDescription>No missing fields detected for this module.</AlertDescription>
                  </Alert>
                ) : null}
              </TabsContent>
              <TabsContent value="draft" className="grid gap-3">
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Describe the client goals and governance preferences..."
                  className="min-h-[120px]"
                />
                <Button variant="outline" disabled>
                  Draft mode coming next
                </Button>
              </TabsContent>
            </Tabs>

            {warnings.length ? (
              <Alert variant="destructive">
                <AlertTitle>Agent warnings</AlertTitle>
                <AlertDescription>
                  {warnings.map((w) => (
                    <div key={w.code}>{w.message}</div>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}

            {validation && !validation.ok ? (
              <Alert variant="destructive">
                <AlertTitle>Validation issues</AlertTitle>
                <AlertDescription>
                  {(validation.issues ?? []).map((issue, idx) => (
                    <div key={idx}>{issue}</div>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Agent error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {jarvaAdvice ? (
              <Alert>
                <AlertTitle>Jarva guidance</AlertTitle>
                <AlertDescription>{jarvaAdvice}</AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
