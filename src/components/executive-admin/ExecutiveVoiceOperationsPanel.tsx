"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExecutiveCollapsibleTile, ExecutiveEmbeddedStack } from "./ExecutiveCollapsibleTile";
import type { VoiceOperationalSnapshot } from "@/lib/executive-agent/executive-voice-operational-types";
import { formatExecutiveInboxTimestamp } from "@/components/executive-inbox/ExecutiveInboxAttachmentsBlock";

type InboxAudioAction = {
  messageId: string;
  attachmentId: string;
  url: string;
  filename: string;
  mimeType: string;
};

type Props = {
  refreshSignal?: number;
  phoneQueueRevealed?: boolean;
  pendingInboxAudio?: InboxAudioAction | null;
  onPlayInboxAudio?: (action: InboxAudioAction) => void;
};

export function ExecutiveVoiceOperationsPanel({
  refreshSignal = 0,
  phoneQueueRevealed = false,
  pendingInboxAudio = null,
  onPlayInboxAudio,
}: Props) {
  const [snapshot, setSnapshot] = useState<VoiceOperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneRevealRequested, setPhoneRevealRequested] = useState(false);
  const [phoneQueueIndex, setPhoneQueueIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/voice-operations/snapshot", {
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as VoiceOperationalSnapshot & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Failed to load voice operations");
      setSnapshot(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  useEffect(() => {
    if (phoneQueueRevealed) setPhoneRevealRequested(true);
  }, [phoneQueueRevealed]);

  const playAudio = useCallback(
    (action: InboxAudioAction) => {
      if (onPlayInboxAudio) {
        onPlayInboxAudio(action);
        return;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(action.url);
      audioRef.current = audio;
      void audio.play().catch(() => {
        /* user gesture may be required */
      });
    },
    [onPlayInboxAudio],
  );

  useEffect(() => {
    if (pendingInboxAudio?.url) playAudio(pendingInboxAudio);
  }, [pendingInboxAudio, playAudio]);

  const pendingWithPhone =
    snapshot?.registrations.filter((r) => r.phoneAvailable && !r.isApproved) ?? [];
  const showPhoneControls = phoneRevealRequested || phoneQueueRevealed;

  return (
    <ExecutiveEmbeddedStack>
      {loading && !snapshot ? (
        <div className="rounded-xl border border-[#00A3FF]/15 bg-[#000814]/70 p-3 text-xs text-slate-500">
          Loading agent & inbox signals…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-950/20 p-3 text-xs text-amber-100/90">
          {error}
        </div>
      ) : null}

      <ExecutiveCollapsibleTile title="Agent Activity" subtitle="Jarva & Reality transcripts today">
        <div className="space-y-3 text-xs">
          <div>
            <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
              Jarva / Smart Trust
            </h4>
            {!snapshot?.jarva.length ? (
              <p className="text-slate-500">No Jarva activity today.</p>
            ) : (
              <ul className="space-y-2">
                {snapshot.jarva.map((row) => (
                  <li
                    key={row.sessionId}
                    className="rounded-lg border border-cyan-500/20 bg-cyan-950/15 px-2 py-2"
                  >
                    <div className="flex justify-between gap-2 text-[10px] text-slate-400">
                      <span className="font-medium text-slate-200">{row.accountDisplayName}</span>
                      <span>{formatExecutiveInboxTimestamp(row.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300">{row.conversationSummary}</p>
                    {row.userRequestExcerpts.length ? (
                      <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                        {row.userRequestExcerpts.map((ex, i) => (
                          <li key={`${row.sessionId}-${i}`} className="truncate">
                            “{ex}”
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-1 text-[9px] uppercase tracking-wide text-slate-600">
                      {row.identityStatus}
                      {row.jarvaWorkflowPath ? ` · ${row.jarvaWorkflowPath}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Reality</h4>
            {!snapshot?.reality.length ? (
              <p className="text-slate-500">No Reality widget activity today.</p>
            ) : (
              <ul className="space-y-2">
                {snapshot.reality.map((row) => (
                  <li
                    key={row.conversationId}
                    className="rounded-lg border border-violet-500/20 bg-violet-950/15 px-2 py-2"
                  >
                    <div className="flex justify-between gap-2 text-[10px] text-slate-400">
                      <span className="font-medium text-slate-200">{row.userDisplayName}</span>
                      <span>{formatExecutiveInboxTimestamp(row.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300">{row.conversationSummary}</p>
                    <div className="mt-1 text-[9px] uppercase tracking-wide text-slate-600">{row.identityStatus}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="Inbox Signals" subtitle="Executive department inbox today">
        {!snapshot?.inbox.length ? (
          <p className="text-xs text-slate-500">No new inbox messages today.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {snapshot.inbox.map((msg) => (
              <li key={msg.messageId} className="rounded-lg border border-[#00A3FF]/20 bg-slate-900/40 px-2 py-2">
                <div className="flex justify-between gap-2 text-[10px] text-slate-400">
                  <span className="font-medium text-slate-200">{msg.senderName}</span>
                  <span>{formatExecutiveInboxTimestamp(msg.receivedAt)}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-300">{msg.subjectOrPreview}</p>
                {msg.hasAttachment ? (
                  <div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">
                    {msg.attachmentCount} attachment{msg.attachmentCount === 1 ? "" : "s"}
                    {msg.hasAudioAttachment ? " · audio on file" : ""}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {pendingInboxAudio ? (
          <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-950/20 px-2 py-2 text-[10px] text-emerald-100">
            Voice confirmed —{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => playAudio(pendingInboxAudio)}
            >
              Play {pendingInboxAudio.filename}
            </button>
          </div>
        ) : null}
      </ExecutiveCollapsibleTile>

      <ExecutiveCollapsibleTile title="New Registrations" subtitle="Today's sign-ups (PII masked)">
        {snapshot?.visitorsToday != null && snapshot.visitorsToday > 0 ? (
          <p className="mb-2 text-[10px] text-slate-400">
            Site visitors today: <span className="font-mono text-slate-200">{snapshot.visitorsToday}</span>
          </p>
        ) : null}
        {!snapshot?.registrations.length ? (
          <p className="text-xs text-slate-500">No new registrations today.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {snapshot.registrations.map((r) => (
              <li key={r.userId} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2 py-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-slate-200">{r.accountDisplayName}</span>
                  <span className="text-[10px] text-slate-500">{formatExecutiveInboxTimestamp(r.createdAt)}</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">{r.emailMasked}</div>
                {r.phoneAvailable ? (
                  <span className="mt-1 inline-block text-[9px] uppercase tracking-wide text-amber-300/80">
                    Phone on file
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {showPhoneControls && pendingWithPhone.length ? (
          <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-950/15 px-2 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">Phone queue</p>
            <p className="mt-1 text-[10px] text-slate-400">
              Say <span className="text-white">next number</span>, <span className="text-white">repeat</span>,{" "}
              <span className="text-white">skip</span>, or <span className="text-white">stop</span> in voice mode.
            </p>
            {(() => {
              const row = pendingWithPhone[phoneQueueIndex];
              if (!row) return <p className="mt-1 text-[10px] text-slate-500">Queue complete.</p>;
              return (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-200">
                    {phoneQueueIndex + 1}/{pendingWithPhone.length} — {row.accountDisplayName}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-600 px-2 py-0.5 text-[9px] uppercase text-slate-300"
                    onClick={() => setPhoneQueueIndex((i) => Math.min(i + 1, pendingWithPhone.length - 1))}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-600 px-2 py-0.5 text-[9px] uppercase text-slate-300"
                    onClick={() => setPhoneQueueIndex((i) => i)}
                  >
                    Repeat
                  </button>
                </div>
              );
            })()}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-slate-600">
            Phone numbers are hidden until you explicitly request them via voice.
          </p>
        )}
      </ExecutiveCollapsibleTile>
    </ExecutiveEmbeddedStack>
  );
}
