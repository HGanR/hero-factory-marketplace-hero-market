"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  formatJarvaSourceApplyKind,
  getJarvaIntakeValueForFieldKeyPreferForm,
  jarvaConfidenceBadgeClass,
  jarvaFieldKeyToLabel,
} from "@/lib/jarva/jarva-field-labels";
import { jarvaHandoffTrustDraftingIntakeLine } from "@/lib/jarva/jarva-handoff";

type LineageEntry = {
  id: string;
  at: string;
  messageSnippet: string;
  extractedFieldKeys: string[];
  targets: string[];
  note?: string;
};

type Props = { trustId: string; handoffDraftingKind?: "revocable" | "irrevocable" | null };

export function JarvaTrustIntakeMvp({ trustId, handoffDraftingKind = null }: Props) {
  const [matterLabel, setMatterLabel] = useState("");
  const [objectives, setObjectives] = useState("");
  const [governingState, setGoverningState] = useState("");
  const [trustName, setTrustName] = useState("");
  const [grantorName, setGrantorName] = useState("");
  const [grantorState, setGrantorState] = useState("");
  const [trusteeName, setTrusteeName] = useState("");
  const [beneficiariesSummary, setBeneficiariesSummary] = useState("");
  const [pourOver, setPourOver] = useState(false);
  const [spiritualNotes, setSpiritualNotes] = useState("");
  const [securitiesNotes, setSecuritiesNotes] = useState("");
  const [firmName, setFirmName] = useState("");
  const [firmEmail, setFirmEmail] = useState("");
  const [successorTrusteeNote, setSuccessorTrusteeNote] = useState("");
  const [jurisdictionAmbiguityNote, setJurisdictionAmbiguityNote] = useState("");
  const [assetScheduleNotesDraft, setAssetScheduleNotesDraft] = useState("");
  const [jarvaMode, setJarvaMode] = useState<"assist" | "build" | "review">("assist");

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState<number>(0);
  const [lineage, setLineage] = useState<LineageEntry[]>([]);
  const [applyReadiness, setApplyReadiness] = useState<{
    canApply: boolean;
    missing: string[];
    blockers: string[];
    completenessPercent: number;
    autoApplyAllowed: boolean;
    softReady?: boolean;
    suggestedApplyTiming?: string;
  } | null>(null);
  const [readinessRow, setReadinessRow] = useState<{
    ok: boolean;
    missing: string[];
    blockers: string[];
    advisories: string[];
  } | null>(null);
  const [readinessFull, setReadinessFull] = useState<{
    suggestedApplyTiming: string;
    narrative: string;
    softReady: boolean;
  } | null>(null);
  const [fieldSources, setFieldSources] = useState<
    Record<string, { messageSnippet: string; confidence?: string; at: string; lineageEntryId: string }>
  >({});
  const [fieldExplainability, setFieldExplainability] = useState<
    Record<
      string,
      {
        fieldKey: string;
        messageSnippet: string;
        confidence?: string;
        at: string;
        inferredFromLlm?: boolean;
        destinationHints?: string[];
        applyTimestamp?: string;
        sourceApplyKind?: string;
        lastApplyTimestampForField?: string;
        lastApplyKindForField?: string;
        lastApplyLineageEntryId?: string;
      }
    >
  >({});
  /** Last persisted intake from session (may include paths not on the short form). */
  const [savedIntakeSnapshot, setSavedIntakeSnapshot] = useState<Record<string, unknown> | null>(null);

  const applyIntakeToForm = useCallback((i: Record<string, unknown> | null | undefined) => {
    if (!i || typeof i !== "object") return;
    setMatterLabel(typeof i.matterLabel === "string" ? i.matterLabel : "");
    setObjectives(typeof i.objectives === "string" ? i.objectives : "");
    setGoverningState(typeof i.governingState === "string" ? i.governingState : "");
    setTrustName(typeof i.trustName === "string" ? i.trustName : "");
    const g = i.grantor as { name?: string; state?: string } | undefined;
    setGrantorName(typeof g?.name === "string" ? g.name : "");
    setGrantorState(typeof g?.state === "string" ? g.state : "");
    const t = i.trustee as { name?: string } | undefined;
    setTrusteeName(typeof t?.name === "string" ? t.name : "");
    setBeneficiariesSummary(typeof i.beneficiariesSummary === "string" ? i.beneficiariesSummary : "");
    setPourOver(Boolean(i.pourOverWillNeeded));
    setSpiritualNotes(typeof i.spiritualOrEcclesiasticalNotes === "string" ? i.spiritualOrEcclesiasticalNotes : "");
    setSecuritiesNotes(typeof i.securitiesIntentNotes === "string" ? i.securitiesIntentNotes : "");
    const f = i.firm as { name?: string; email?: string } | undefined;
    setFirmName(typeof f?.name === "string" ? f.name : "");
    setFirmEmail(typeof f?.email === "string" ? f.email : "");
    setSuccessorTrusteeNote(typeof i.successorTrusteeNote === "string" ? i.successorTrusteeNote : "");
    setJurisdictionAmbiguityNote(typeof i.jurisdictionAmbiguityNote === "string" ? i.jurisdictionAmbiguityNote : "");
    setAssetScheduleNotesDraft(typeof i.assetScheduleNotesDraft === "string" ? i.assetScheduleNotesDraft : "");
  }, []);

  const refreshFromSession = useCallback(async () => {
    const res = await fetch(`/api/jarva/trust-intake/session?trustId=${encodeURIComponent(trustId)}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    if (typeof data.version === "number") setDraftVersion(data.version);
    setLineage(Array.isArray(data.lineage) ? data.lineage : []);
    setApplyReadiness(data.applyReadiness ?? null);
    setReadinessRow(data.readiness ?? null);
    setReadinessFull(data.readinessFull ?? null);
    setFieldSources(
      data.fieldSources && typeof data.fieldSources === "object" ? data.fieldSources : {}
    );
    setFieldExplainability(
      data.fieldExplainability && typeof data.fieldExplainability === "object" ? data.fieldExplainability : {}
    );
    const mode = data.jarvaMode;
    if (mode === "assist" || mode === "build" || mode === "review") setJarvaMode(mode);
    const rawIntake = data.intake;
    if (rawIntake && typeof rawIntake === "object") {
      setSavedIntakeSnapshot(rawIntake as Record<string, unknown>);
    } else {
      setSavedIntakeSnapshot(null);
    }
    applyIntakeToForm(data.intake);
  }, [applyIntakeToForm, trustId]);

  const buildIntake = useCallback(() => {
    return {
      schemaVersion: 1,
      matterLabel: matterLabel.trim() || undefined,
      objectives: objectives.trim() || undefined,
      governingState: governingState.trim() || undefined,
      trustName: trustName.trim() || undefined,
      grantor:
        grantorName.trim() || grantorState.trim()
          ? {
              name: grantorName.trim() || undefined,
              state: grantorState.trim() || undefined,
            }
          : undefined,
      trustee: trusteeName.trim() ? { name: trusteeName.trim() } : undefined,
      beneficiariesSummary: beneficiariesSummary.trim() || undefined,
      pourOverWillNeeded: pourOver,
      spiritualOrEcclesiasticalNotes: spiritualNotes.trim() || undefined,
      securitiesIntentNotes: securitiesNotes.trim() || undefined,
      firm:
        firmName.trim() || firmEmail.trim()
          ? { name: firmName.trim() || undefined, email: firmEmail.trim() || undefined }
          : undefined,
      successorTrusteeNote: successorTrusteeNote.trim() || undefined,
      jurisdictionAmbiguityNote: jurisdictionAmbiguityNote.trim() || undefined,
      assetScheduleNotesDraft: assetScheduleNotesDraft.trim() || undefined,
    };
  }, [
    matterLabel,
    objectives,
    governingState,
    trustName,
    grantorName,
    grantorState,
    trusteeName,
    beneficiariesSummary,
    pourOver,
    spiritualNotes,
    securitiesNotes,
    firmName,
    firmEmail,
    successorTrusteeNote,
    jurisdictionAmbiguityNote,
    assetScheduleNotesDraft,
  ]);

  useEffect(() => {
    void refreshFromSession();
  }, [trustId, refreshFromSession]);

  useEffect(() => {
    const onJarvaUpdated = (ev: Event) => {
      const ce = ev as CustomEvent<{ trustId?: string }>;
      if (ce.detail?.trustId !== trustId) return;
      void refreshFromSession();
    };
    window.addEventListener("jarva-intake-updated", onJarvaUpdated as EventListener);
    return () => window.removeEventListener("jarva-intake-updated", onJarvaUpdated as EventListener);
  }, [trustId, refreshFromSession]);

  useEffect(() => {
    const onWorkspace = (ev: Event) => {
      const ce = ev as CustomEvent<{ trustId?: string }>;
      if (ce.detail?.trustId !== trustId) return;
      void refreshFromSession();
    };
    window.addEventListener("jarva-workspace-updated", onWorkspace as EventListener);
    return () => window.removeEventListener("jarva-workspace-updated", onWorkspace as EventListener);
  }, [trustId, refreshFromSession]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshFromSession();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshFromSession]);

  const onSaveSession = async () => {
    setBusy("save");
    setStatus(null);
    try {
      const res = await fetch("/api/jarva/trust-intake/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustId, intake: buildIntake(), jarvaMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");
      if (data.jarvaMode === "assist" || data.jarvaMode === "build" || data.jarvaMode === "review") {
        setJarvaMode(data.jarvaMode);
      }
      setStatus("Intake saved as draft snapshot.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const onApply = async () => {
    setBusy("apply");
    setStatus(null);
    try {
      const res = await fetch("/api/jarva/trust-intake/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustId, intake: buildIntake() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.readiness) {
          setStatus(`Blocked: ${(data.readiness.blockers || []).join("; ") || data.error}`);
        } else {
          throw new Error(data?.error || "Apply failed");
        }
        return;
      }
      setStatus(data?.message || "Applied to Smart Trust draft.");
      void refreshFromSession();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(null);
    }
  };

  const mappedFieldKeysFromLineage = (() => {
    const s = new Set<string>();
    for (const e of lineage) {
      for (const k of e.extractedFieldKeys || []) s.add(k);
    }
    return [...s];
  })();

  const intakePreview = useMemo(
    () => buildIntake() as unknown as Record<string, unknown>,
    [buildIntake]
  );

  const consultantFieldKeys = useMemo(() => {
    const s = new Set([...Object.keys(fieldExplainability), ...Object.keys(fieldSources)]);
    return [...s].sort();
  }, [fieldExplainability, fieldSources]);

  const onPacket = async () => {
    setBusy("packet");
    setStatus(null);
    try {
      const res = await fetch("/api/jarva/trust-intake/review-packet", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustId, intake: buildIntake() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Packet failed");
      const md = String(data.markdown ?? "");
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jarva-review-${trustId.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Review packet downloaded (Markdown).");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Packet failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      className={cn(
        "border-slate-700 bg-slate-950/80",
        handoffDraftingKind && "ring-2 ring-violet-500/30 ring-offset-2 ring-offset-slate-950",
      )}
    >
      <CardHeader>
        <CardTitle className="text-white">Build with Jarva — structured intake</CardTitle>
        <CardDescription className="text-slate-400">
          Enter client facts once; apply merges into the Smart Trust workspace draft (parties, objectives, firm header).
          Export and issuance remain gated by existing readiness, counsel, and trustee controls.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {handoffDraftingKind ? (
          <Alert className="border-violet-500/30 bg-violet-950/25 text-slate-100">
            <AlertDescription>{jarvaHandoffTrustDraftingIntakeLine(handoffDraftingKind)}</AlertDescription>
          </Alert>
        ) : null}
        <Alert className="border-amber-700/80 bg-amber-950/40 text-amber-50">
          <AlertTitle className="text-amber-100">Legal review required — DRAFT workspace only</AlertTitle>
          <AlertDescription className="text-amber-200/90">
            Jarva does not finalize legal instruments. All trust, will, certificate, PPM, bond, or related outputs remain
            drafts for counsel review. Not legal advice. Subject to jurisdiction-specific review. Counsel and trustee
            approvals apply per workspace settings.
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertTitle>Draft / review only</AlertTitle>
          <AlertDescription>
            Not legal advice. Not a final trust instrument. Counsel must review before execution. Jurisdiction-specific
            review is required.
          </AlertDescription>
        </Alert>

        {applyReadiness ? (
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-4 text-sm text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-white">Readiness</span>
              <span className="text-emerald-400/90">{applyReadiness.completenessPercent}% complete</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Structural apply: {applyReadiness.canApply ? "ready" : "blocked"} — auto-apply from chat:{" "}
              {applyReadiness.autoApplyAllowed ? "allowed when enabled in chat" : "blocked"} (export/issuance gates
              unchanged).
            </p>
            {applyReadiness.missing.length > 0 ? (
              <p className="mt-2 text-xs text-amber-200/90">
                <span className="text-slate-400">Missing:</span> {applyReadiness.missing.join("; ")}
              </p>
            ) : null}
            {readinessRow && readinessRow.blockers.length > 0 ? (
              <p className="mt-1 text-xs text-amber-200/80">
                <span className="text-slate-400">Blockers:</span> {readinessRow.blockers.join("; ")}
              </p>
            ) : null}
            {readinessRow && readinessRow.advisories.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-slate-400">
                {readinessRow.advisories.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {readinessFull ? (
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Apply timing (advisory — DRAFT only)</p>
            <p className="mt-1">{readinessFull.narrative}</p>
            <p className="mt-1 text-slate-500">
              Suggested:{" "}
              <span className="text-slate-300">{readinessFull.suggestedApplyTiming.replace(/_/g, " ")}</span>
              {applyReadiness?.softReady ? " · partial / soft data present" : null}
            </p>
          </div>
        ) : null}

        {applyReadiness && applyReadiness.missing.length > 0 ? (
          <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-2">
            <div className="rounded border border-slate-800 p-2">
              <span className="font-medium text-slate-300">Missing — parties</span>
              <ul className="mt-1 list-inside list-disc">
                {applyReadiness.missing
                  .filter((m) => /Grantor|Trustee/i.test(m))
                  .map((m, i) => (
                    <li key={`party-${i}-${m}`}>{m}</li>
                  ))}
                {applyReadiness.missing.filter((m) => /Grantor|Trustee/i.test(m)).length === 0 ? (
                  <li className="list-none text-slate-600">—</li>
                ) : null}
              </ul>
            </div>
            <div className="rounded border border-slate-800 p-2">
              <span className="font-medium text-slate-300">Missing — jurisdiction / intent</span>
              <ul className="mt-1 list-inside list-disc">
                {applyReadiness.missing
                  .filter((m) => /Governing|state|situs/i.test(m))
                  .map((m, i) => (
                    <li key={`jur-${i}-${m}`}>{m}</li>
                  ))}
                {applyReadiness.missing.filter((m) => /Governing|state|situs/i.test(m)).length === 0 ? (
                  <li className="list-none text-slate-600">—</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-sm">
          <div className="space-y-1">
            <Label className="text-slate-300">Jarva mode (saved with draft)</Label>
            <select
              value={jarvaMode}
              onChange={(e) => setJarvaMode(e.target.value as "assist" | "build" | "review")}
              className="rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-200"
            >
              <option value="assist">Assist — capture only</option>
              <option value="build">Build — auto-apply when structurally ready</option>
              <option value="review">Review — no workspace writes from chat</option>
            </select>
          </div>
          <p className="max-w-md text-xs text-slate-500">
            Matches floating chat. Use &ldquo;Save intake snapshot&rdquo; to persist mode with the form (DRAFT only — not
            legal advice).
          </p>
        </div>

        {consultantFieldKeys.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-slate-700/80 p-3 text-xs">
            <div>
              <p className="font-semibold text-white">Mapped fields &amp; explainability</p>
              <p className="mt-1 text-slate-500">
                Each row shows the current value (form first, then saved draft snapshot for fields not on this form), how
                it was sourced from chat, confidence, where it maps in the workspace, and workspace apply metadata when
                lineage lists this field. DRAFT intake — verify against client records; counsel review still required
                before execution.
              </p>
            </div>
            <ul className="space-y-3">
              {consultantFieldKeys.map((k) => {
                const ex = fieldExplainability[k];
                const src = fieldSources[k];
                const snippet = (ex?.messageSnippet ?? src?.messageSnippet ?? "").trim() || "—";
                const snippetShort = snippet.length > 220 ? `${snippet.slice(0, 220)}…` : snippet;
                const conf = ex?.confidence ?? src?.confidence;
                const inferred = Boolean(ex?.inferredFromLlm);
                const sourceKindLabel = formatJarvaSourceApplyKind(ex?.sourceApplyKind);
                const workspaceApplyKindLabel = formatJarvaSourceApplyKind(ex?.lastApplyKindForField);
                const lastApplyDisplay = ex?.lastApplyTimestampForField ?? ex?.applyTimestamp;
                const value = getJarvaIntakeValueForFieldKeyPreferForm(intakePreview, savedIntakeSnapshot, k);
                const label = jarvaFieldKeyToLabel(k);
                const capturedAt = ex?.at ?? src?.at;

                return (
                  <li key={k} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-100">{label}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-emerald-400/80">{k}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            inferred
                              ? "border border-amber-700/50 bg-amber-950/60 text-amber-100"
                              : "border border-emerald-700/50 bg-emerald-950/50 text-emerald-100"
                          )}
                        >
                          {inferred ? "Inferred" : "Extracted"}
                        </span>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            jarvaConfidenceBadgeClass(conf)
                          )}
                        >
                          {conf ? `Confidence: ${conf}` : "Confidence: —"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 rounded border border-slate-800/80 bg-slate-900/50 px-2 py-1.5 text-slate-200">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        Current value (form or saved draft)
                      </span>
                      <div className="mt-0.5 break-words text-slate-100">{value}</div>
                    </div>
                    <div className="mt-2 text-slate-400">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Source message</span>
                      <div className="mt-0.5 italic">&ldquo;{snippetShort}&rdquo;</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      {capturedAt ? (
                        <span>
                          Captured:{" "}
                          <span className="text-slate-300">{new Date(capturedAt).toLocaleString()}</span>
                        </span>
                      ) : null}
                      {lastApplyDisplay ? (
                        <span>
                          Last workspace apply
                          {ex?.lastApplyTimestampForField ? "" : " (shared fallback)"}:{" "}
                          <span className="text-slate-300">{new Date(lastApplyDisplay).toLocaleString()}</span>
                        </span>
                      ) : null}
                      {workspaceApplyKindLabel ? (
                        <span>
                          Workspace apply kind: <span className="text-slate-300">{workspaceApplyKindLabel}</span>
                        </span>
                      ) : null}
                      {sourceKindLabel ? (
                        <span>
                          Source kind: <span className="text-slate-300">{sourceKindLabel}</span>
                        </span>
                      ) : null}
                      {ex?.lastApplyLineageEntryId ? (
                        <span className="font-mono text-[10px] text-slate-600">
                          Apply row: {ex.lastApplyLineageEntryId}
                        </span>
                      ) : null}
                    </div>
                    {ex?.destinationHints?.length ? (
                      <div className="mt-2 rounded border border-slate-800/60 bg-slate-900/40 px-2 py-1.5 text-[11px] text-slate-400">
                        <span className="font-medium text-slate-500">Maps to </span>
                        {ex.destinationHints.join(" · ")}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {mappedFieldKeysFromLineage.length > 0 ? (
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200/90">
            <span className="font-semibold text-emerald-100">Mapped automatically from chat (audit):</span>{" "}
            {mappedFieldKeysFromLineage.join(", ")}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-4 text-sm text-slate-300">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-white">Live sync from Jarva chat</p>
            {draftVersion > 0 ? (
              <span className="text-xs text-slate-500">Intake draft v{draftVersion}</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            When you answer the Trust Advisor in floating chat, labeled facts merge into this intake. Below: recent
            extractions (audit trail).
          </p>
          {lineage.length === 0 ? (
            <p className="mt-2 text-slate-500">No chat-driven updates yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {lineage
                .slice(-8)
                .reverse()
                .map((e) => (
                  <li key={e.id} className="rounded border border-slate-700/60 bg-slate-950/60 p-2">
                    <div className="text-slate-400">{new Date(e.at).toLocaleString()}</div>
                    <div className="text-slate-300">&ldquo;{e.messageSnippet.slice(0, 160)}
                      {e.messageSnippet.length > 160 ? "…" : ""}&rdquo;</div>
                    <div className="mt-1 text-emerald-400/90">
                      Mapped: {(e.extractedFieldKeys || []).join(", ") || "—"}
                    </div>
                    <div className="text-slate-500">→ {(e.targets || []).join(", ")}</div>
                    {e.note ? <div className="text-slate-500">{e.note}</div> : null}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Matter label</Label>
            <Input value={matterLabel} onChange={(e) => setMatterLabel(e.target.value)} placeholder="Client / engagement name" />
          </div>
          <div className="space-y-2">
            <Label>Trust name (working title)</Label>
            <Input value={trustName} onChange={(e) => setTrustName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Objectives</Label>
          <Textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={3} placeholder="Client goals, probate avoidance, succession, etc." />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Governing / situs state (2-letter)</Label>
            <Input value={governingState} onChange={(e) => setGoverningState(e.target.value)} maxLength={4} />
          </div>
          <div className="flex items-center gap-2 pt-8">
            <input
              id="pour"
              type="checkbox"
              checked={pourOver}
              onChange={(e) => setPourOver(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="pour">Pour-over will coordination (intent flag)</Label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Grantor name</Label>
            <Input value={grantorName} onChange={(e) => setGrantorName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Grantor state</Label>
            <Input value={grantorState} onChange={(e) => setGrantorState(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Trustee name</Label>
          <Input value={trusteeName} onChange={(e) => setTrusteeName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Beneficiaries (summary)</Label>
          <Textarea value={beneficiariesSummary} onChange={(e) => setBeneficiariesSummary(e.target.value)} rows={3} />
        </div>

        <div className="space-y-2">
          <Label>Successor trustees (order / backups)</Label>
          <Textarea
            value={successorTrusteeNote}
            onChange={(e) => setSuccessorTrusteeNote(e.target.value)}
            rows={2}
            placeholder="Numbered or ordered successors when known — DRAFT notes only."
          />
        </div>

        <div className="space-y-2">
          <Label>Jurisdiction ambiguity (draft note)</Label>
          <Textarea
            value={jurisdictionAmbiguityNote}
            onChange={(e) => setJurisdictionAmbiguityNote(e.target.value)}
            rows={2}
            placeholder="If multiple states or situs questions appear — does not replace counsel review."
          />
        </div>

        <div className="space-y-2">
          <Label>Asset / schedule notes (non-authoritative)</Label>
          <Textarea
            value={assetScheduleNotesDraft}
            onChange={(e) => setAssetScheduleNotesDraft(e.target.value)}
            rows={2}
            placeholder="Chat references to accounts or property — not titling; confirm in asset registry."
          />
        </div>

        <div className="space-y-2">
          <Label>Spiritual / ecclesiastical notes (optional)</Label>
          <Textarea value={spiritualNotes} onChange={(e) => setSpiritualNotes(e.target.value)} rows={2} />
        </div>

        <div className="space-y-2">
          <Label>Securities / capital intent (informational only)</Label>
          <Textarea value={securitiesNotes} onChange={(e) => setSecuritiesNotes(e.target.value)} rows={2} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Firm name (optional)</Label>
            <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Firm email (optional)</Label>
            <Input value={firmEmail} onChange={(e) => setFirmEmail(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled={!!busy} onClick={() => void onSaveSession()}>
            {busy === "save" ? "Saving…" : "Save intake snapshot"}
          </Button>
          <Button type="button" disabled={!!busy} onClick={() => void onApply()}>
            {busy === "apply" ? "Applying…" : "Apply to Smart Trust draft"}
          </Button>
          <Button type="button" variant="outline" disabled={!!busy} onClick={() => void onPacket()}>
            {busy === "packet" ? "Building…" : "Download review packet (.md)"}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href={`/smart-trust?trustId=${encodeURIComponent(trustId)}`}>Open Smart Trust</Link>
          </Button>
        </div>

        {status ? (
          <p className="text-sm text-slate-300" role="status">
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
