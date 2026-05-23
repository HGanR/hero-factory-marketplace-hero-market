"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExecutiveOrb, type OrbMode } from "./ExecutiveOrb";
import { OrbTelemetryOverlay } from "./OrbTelemetryOverlay";
import { VoiceFrequencyAnalyzer } from "@/lib/skipper/VoiceFrequencyAnalyzer";
import {
  computeExecutiveRevenueValue,
  formatExecutiveCurrency,
} from "@/lib/executive-agent/executive-revenue-value";
import { MOCK_AGENT_BUS, type AgentIntelligenceSnapshot } from "@/lib/skipper/agent-intelligence-bus";

type PendingMarketplaceUserPreview = {
  displayIndex: number;
  emailMasked?: string;
  usernameMasked?: string;
  createdAt: string;
};

type SummaryJson = {
  pendingAccounts?: { pendingAllTime?: number; pendingApprox30d?: number; note?: string };
  pendingMarketplaceUsers?: PendingMarketplaceUserPreview[];
  approvedAccounts?: { approvedActive?: number; approvedInactive?: number };
  platform?: { marketplaceUsers?: number; crmClients?: number; socialCampaigns?: number };
  inbox?: { threadsLast7d?: number; unavailable?: boolean };
  generatedAt?: string;
};

const DATA_SOURCES = ["ALL AGENTS", "REALITY", "ELEANOR", "BENTLEY", "CUSTOM"] as const;
const FOCUS_MODES = [
  "ANALYTICS",
  "CONVERSATIONS",
  "REVENUE",
  "LEADS",
  "SITE HEALTH",
  "CRM",
  "TASKS",
  "CAMPAIGNS",
] as const;
const TIME_RANGES = ["LIVE", "1H", "24H", "7D", "30D"] as const;

const WAVE_BAR_COUNT = 40;

function formatRelativeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

function pendingQueueRowTitle(row: PendingMarketplaceUserPreview): string {
  const username = row.usernameMasked?.trim();
  const email = row.emailMasked?.trim();
  if (username) return username;
  if (email) return email;
  return `Pending #${row.displayIndex}`;
}

function pendingQueueRowSubtitle(row: PendingMarketplaceUserPreview, title: string): string | null {
  const email = row.emailMasked?.trim();
  if (!email || email === title) return null;
  const username = row.usernameMasked?.trim();
  if (username && username !== title) return email;
  return null;
}

const MOCK_TRAFFIC = [
  { label: "Organic", v: 38 },
  { label: "Direct", v: 26 },
  { label: "Social", v: 18 },
  { label: "Referral", v: 11 },
  { label: "Paid", v: 7 },
];

function agentMatchesSource(agent: AgentIntelligenceSnapshot, src: (typeof DATA_SOURCES)[number]): boolean {
  if (src === "ALL AGENTS") return true;
  if (src === "REALITY") return agent.agentId === "reality";
  if (src === "ELEANOR") return agent.agentId === "eleanor";
  if (src === "BENTLEY") return agent.agentId === "bentley";
  return true;
}

export function SkipperCommandCenter() {
  const router = useRouter();
  const analyzer = useRef(new VoiceFrequencyAnalyzer());
  const micOnRef = useRef(false);
  const processingUntilRef = useRef(0);
  const [summary, setSummary] = useState<SummaryJson | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dataSource, setDataSource] = useState<(typeof DATA_SOURCES)[number]>("ALL AGENTS");
  const [focusMode, setFocusMode] = useState<(typeof FOCUS_MODES)[number]>("ANALYTICS");
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]>("LIVE");
  const [customAgents, setCustomAgents] = useState<Set<string>>(
    () => new Set(MOCK_AGENT_BUS.map((a) => a.agentId)),
  );
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(0);
  const [orbMode, setOrbMode] = useState<OrbMode>("idle");
  const [throughput, setThroughput] = useState(340_000);
  const [waveBars, setWaveBars] = useState<number[]>(() => Array.from({ length: WAVE_BAR_COUNT }, () => 0.08));
  const [activity, setActivity] = useState<string[]>([
    "Executive Admin — policy scope verified",
    "Eleanor — queued 3 FAQ refinements",
    "Bentley — AI Revenue OS sync window closed",
  ]);
  const [command, setCommand] = useState("");

  const visibleAgents = useMemo(() => {
    const list = MOCK_AGENT_BUS.filter((a) => agentMatchesSource(a, dataSource));
    if (dataSource !== "CUSTOM") return list;
    return MOCK_AGENT_BUS.filter((a) => customAgents.has(a.agentId));
  }, [dataSource, customAgents]);

  const activeAgentCount = visibleAgents.filter((a) => a.status !== "offline").length;

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  const loadSummary = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/executive-agent/summary", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as SummaryJson & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "unauthorized");
      setSummary(j);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [loadSummary]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const a = analyzer.current;
      const idleShim = 0.018 + Math.sin(performance.now() / 2200) * 0.006;
      const sample = a.isRunning ? a.sample() : a.injectSyntheticRms(idleShim);

      setIntensity((prev) => prev + (sample.rms - prev) * 0.14);

      setThroughput((tp) => {
        const delta = 2000 + sample.rms * 480_000 + Math.sin(Date.now() / 800) * 30_000;
        return Math.max(120_000, tp * 0.985 + delta * 0.015);
      });

      if (sample.bands.length > 0) {
        const step = Math.max(1, Math.floor(sample.bands.length / WAVE_BAR_COUNT));
        setWaveBars((bars) =>
          bars.map((_, i) => {
            const idx = Math.min(sample.bands.length - 1, i * step);
            const v = (sample.bands[idx] ?? 0) / 255;
            return Math.max(0.04, v * (0.6 + sample.rms));
          }),
        );
      } else {
        const breathe = 0.06 + Math.sin(Date.now() / 500) * 0.04 + sample.rms * 0.85;
        setWaveBars((bars) =>
          bars.map((_, i) =>
            Math.max(0.04, breathe * (0.5 + 0.5 * Math.sin(i * 0.4 + Date.now() / 300))),
          ),
        );
      }

      let mode: OrbMode = "idle";
      if (performance.now() < processingUntilRef.current) mode = "processing";
      else if (micOnRef.current) mode = sample.speaking ? "speaking" : "listening";
      setOrbMode(mode);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleMic = async () => {
    setMicError(null);
    if (micOn) {
      analyzer.current.stop();
      setMicOn(false);
      return;
    }
    try {
      await analyzer.current.startMicrophone();
      setMicOn(true);
    } catch (e) {
      setMicError(e instanceof Error ? e.message : "Microphone unavailable");
    }
  };

  const runCommand = () => {
    const c = command.trim();
    if (!c) return;
    processingUntilRef.current = performance.now() + 900;
    setActivity((prev) => [`Executive Admin — “${c.slice(0, 64)}${c.length > 64 ? "…" : ""}”`, ...prev].slice(0, 22));
    setCommand("");
  };

  const toggleCustomAgent = (id: string) => {
    setCustomAgents((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const clock = now.toLocaleTimeString([], { hour12: false });
  const dateStr = now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }).toUpperCase();

  const pendingN = summary?.pendingAccounts?.pendingAllTime ?? 0;
  const pending30d = summary?.pendingAccounts?.pendingApprox30d ?? 0;
  const approvedN = summary?.approvedAccounts?.approvedActive ?? 0;
  const platformUsers = summary?.platform?.marketplaceUsers ?? 0;

  const revenueSnap = useMemo(
    () =>
      computeExecutiveRevenueValue({
        pendingAccounts: summary?.pendingAccounts?.pendingAllTime,
        approvedAccounts: summary?.approvedAccounts?.approvedActive,
        unavailable: summary == null,
      }),
    [summary],
  );

  const revenueTiles = useMemo(() => {
    if (revenueSnap.unavailable) {
      return [
        { k: "Potential earnings", v: "Unavailable", d: "Pending accounts" },
        { k: "Approved value", v: "Unavailable", d: "Approved active" },
        { k: "Monthly recurring", v: "Unavailable", d: "Approved × $20 MRR" },
      ];
    }
    return [
      {
        k: "Potential earnings",
        v: formatExecutiveCurrency(revenueSnap.potentialEarnings),
        d: `${revenueSnap.pendingAccounts} pending account${revenueSnap.pendingAccounts === 1 ? "" : "s"}`,
      },
      {
        k: "Approved value",
        v: formatExecutiveCurrency(revenueSnap.approvedAccountValue),
        d: `${revenueSnap.approvedAccounts} approved active`,
      },
      {
        k: "Monthly recurring",
        v: formatExecutiveCurrency(revenueSnap.monthlyRecurringRevenue),
        d: "Approved × $20 MRR",
      },
    ];
  }, [revenueSnap]);

  return (
    <div className="min-h-screen bg-[#00050A] text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#00A3FF]/15 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="text-[11px] uppercase tracking-[0.28em] text-[#00A3FF]/80 hover:text-[#00A3FF]"
          >
            ← Admin
          </button>
          <span className="hidden h-4 w-px bg-[#00A3FF]/25 sm:inline" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#00A3FF]">Skipper Command</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
          <ControlSelect
            label="Data source"
            value={dataSource}
            onChange={(v) => setDataSource(v as (typeof DATA_SOURCES)[number])}
            options={[...DATA_SOURCES]}
          />
          <ControlSelect
            label="Mode"
            value={focusMode}
            onChange={(v) => setFocusMode(v as (typeof FOCUS_MODES)[number])}
            options={[...FOCUS_MODES]}
          />
          <ControlSelect
            label="Time"
            value={timeRange}
            onChange={(v) => setTimeRange(v as (typeof TIME_RANGES)[number])}
            options={[...TIME_RANGES]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-right">
          <button
            type="button"
            onClick={toggleMic}
            className={`rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition shadow-[0_0_16px_rgba(0,163,255,0.15)] ${
              micOn
                ? "border-[#00FF85]/60 bg-[#00FF85]/10 text-[#00FF85]"
                : "border-[#00A3FF]/40 bg-[#00A3FF]/5 text-[#00A3FF]"
            }`}
          >
            {micOn ? "Voice on" : "Voice mode"}
          </button>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00A3FF]/70">
            {clock} <span className="text-[#00A3FF]/40">|</span> {dateStr}
          </div>
        </div>
      </header>

      {micError ? (
        <div className="mx-6 mt-3 rounded border border-[#FF3B3B]/40 bg-[#FF3B3B]/5 px-3 py-2 text-sm text-[#FF3B3B]">
          {micError}
        </div>
      ) : null}

      <main className="grid min-h-[calc(100vh-132px)] grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,1.15fr)_minmax(0,1fr)]">
        <LeftColumn platformUsers={platformUsers} />
        <CenterColumn
          visibleAgents={visibleAgents}
          dataSource={dataSource}
          customAgents={customAgents}
          toggleCustomAgent={toggleCustomAgent}
          activity={activity}
          intensity={intensity}
          orbMode={orbMode}
          activeAgentCount={activeAgentCount}
          throughput={throughput}
          focusMode={`${focusMode} · ${timeRange}`}
          waveBars={waveBars}
          command={command}
          setCommand={setCommand}
          runCommand={runCommand}
          micOn={micOn}
          revenueTiles={revenueTiles}
        />
        <RightColumn
          pendingN={pendingN}
          pending30d={pending30d}
          approvedN={approvedN}
          summary={summary}
        />
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#00A3FF]/10 px-4 py-3 text-[10px] uppercase tracking-[0.25em] text-[#00A3FF]/55">
        <nav className="flex flex-wrap gap-4">
          {["Command", "CRM Intel", "AI Agents", "Site builder", "Analytics", "Inbox", "Tasks", "Settings"].map(
            (lbl, i) => (
              <span key={lbl} className={i === 0 ? "text-[#00FF85]" : ""}>
                {lbl}
              </span>
            ),
          )}
        </nav>
        <button
          type="button"
          className="rounded border border-[#00A3FF]/40 px-4 py-2 font-semibold text-[#00A3FF] shadow-[0_0_14px_rgba(0,163,255,0.2)]"
        >
          New command
        </button>
      </footer>
    </div>
  );
}

function ControlSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[9px] text-[#00A3FF]/50">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[#00A3FF]/25 bg-[#000814] px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#00A3FF] outline-none focus:border-[#00A3FF]/70"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeftColumn({ platformUsers }: { platformUsers: number }) {
  const cards = [
    { label: "Active visitors", value: platformUsers, delta: "+18.6%" },
    { label: "Page views", value: 4892, delta: "+22.4%" },
    { label: "Conversions", value: 156, delta: "+31.2%" },
    { label: "Bounce rate", value: "32.4%", delta: "-8.7%" },
  ];
  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-4"
    >
      <PanelTitle>Live site overview</PanelTitle>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-[#00A3FF]/15 bg-[#000814]/80 p-3 shadow-[0_0_24px_rgba(0,163,255,0.06)]"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#00A3FF]/55">{c.label}</p>
            <p className="mt-2 font-mono text-2xl text-white">{typeof c.value === "number" ? c.value.toLocaleString() : c.value}</p>
            <p className="mt-1 text-xs font-medium text-[#00FF85]">{c.delta}</p>
          </div>
        ))}
      </div>
      <PanelTitle>Top traffic sources</PanelTitle>
      <div className="h-52 rounded-xl border border-[#00A3FF]/15 bg-[#000814]/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MOCK_TRAFFIC} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#00A3FF" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "rgba(0,163,255,0.55)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#000814",
                border: "1px solid rgba(0,163,255,0.3)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "#00A3FF" }}
            />
            <Bar dataKey="v" fill="#00A3FF" radius={[4, 4, 0, 0]} opacity={0.88} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <PanelTitle>Top pages (live)</PanelTitle>
      <div className="overflow-hidden rounded-xl border border-[#00A3FF]/15 text-xs">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#000814] text-[10px] uppercase tracking-[0.18em] text-[#00A3FF]/55">
            <tr>
              <th className="px-3 py-2">Path</th>
              <th className="px-3 py-2">Visitors</th>
              <th className="px-3 py-2">Conv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#00A3FF]/10 bg-[#00050A]/60">
            {[
              ["/ai-revenue-os", 412, "4.2%"],
              ["/marketplace", 356, "3.1%"],
              ["/consultations", 284, "2.4%"],
              ["/oasis-elements", 198, "5.0%"],
              ["/dashboard", 512, "1.8%"],
            ].map(([path, vis, conv]) => (
              <tr key={String(path)}>
                <td className="px-3 py-2 font-mono text-[#00A3FF]/85">{path}</td>
                <td className="px-3 py-2 text-slate-300">{vis}</td>
                <td className="px-3 py-2 text-[#00FF85]">{conv}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.aside>
  );
}

function CenterColumn({
  visibleAgents,
  dataSource,
  customAgents,
  toggleCustomAgent,
  activity,
  intensity,
  orbMode,
  activeAgentCount,
  throughput,
  focusMode,
  waveBars,
  command,
  setCommand,
  runCommand,
  micOn,
  revenueTiles,
}: {
  visibleAgents: AgentIntelligenceSnapshot[];
  dataSource: string;
  customAgents: Set<string>;
  toggleCustomAgent: (id: string) => void;
  activity: string[];
  intensity: number;
  orbMode: OrbMode;
  activeAgentCount: number;
  throughput: number;
  focusMode: string;
  waveBars: number[];
  command: string;
  setCommand: (v: string) => void;
  runCommand: () => void;
  micOn: boolean;
  revenueTiles: Array<{ k: string; v: string; d: string }>;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      <div className="text-center">
        <h1 className="text-lg font-semibold uppercase tracking-[0.42em] text-white md:text-xl">Executive administration</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-[#00A3FF]/65">
          Site brain · {micOn ? "Voice active" : "Voice standby"}
        </p>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[min(100%,420px)] overflow-hidden rounded-3xl border border-[#00A3FF]/20 shadow-[0_0_60px_rgba(0,163,255,0.12)]">
        <div className="absolute inset-0">
          <ExecutiveOrb
            intensity={intensity}
            mode={orbMode}
            activeAgentCount={activeAgentCount}
            dataThroughput={throughput}
            focusMode={focusMode}
            className="h-full w-full min-h-0"
          />
        </div>
        <OrbTelemetryOverlay
          intensity={intensity}
          mode={orbMode}
          activeAgentCount={activeAgentCount}
          dataThroughput={throughput}
          focusMode={focusMode}
        />
        <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-[#00A3FF]/35 bg-[#00050A]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#00A3FF]">
          {orbMode === "listening" ? "Listening…" : orbMode === "speaking" ? "Receiving voice" : orbMode === "processing" ? "Processing…" : "Standby"}
        </div>
      </div>

      <div className="rounded-xl border border-[#00A3FF]/15 bg-[#000814]/80 p-3">
        <PanelTitle>Agent network</PanelTitle>
        {dataSource === "CUSTOM" ? (
          <p className="mb-2 text-[11px] text-[#00A3FF]/50">Multi-select agents for comparison.</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {MOCK_AGENT_BUS.map((a) => {
            const on = dataSource === "CUSTOM" ? customAgents.has(a.agentId) : visibleAgents.some((v) => v.agentId === a.agentId);
            return (
              <button
                key={a.agentId}
                type="button"
                disabled={dataSource !== "CUSTOM"}
                onClick={() => dataSource === "CUSTOM" && toggleCustomAgent(a.agentId)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                  on ? "border-[#00FF85]/45 bg-[#00FF85]/10 text-[#00FF85]" : "border-[#00A3FF]/15 text-[#00A3FF]/45"
                } ${dataSource === "CUSTOM" ? "cursor-pointer hover:border-[#00A3FF]/40" : "cursor-default opacity-90"}`}
              >
                <span className={`h-2 w-2 rounded-full ${a.status === "offline" ? "bg-slate-600" : "bg-[#00FF85] shadow-[0_0_8px_#00FF85]"}`} />
                {a.displayName}
              </button>
            );
          })}
          <span className="rounded-full border border-dashed border-[#00A3FF]/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#00A3FF]/40">
            + Add agent
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {revenueTiles.map((x) => (
          <div key={x.k} className="rounded-lg border border-[#00A3FF]/10 bg-[#00050A]/80 px-2 py-2">
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#00A3FF]/50">{x.k}</p>
            <p className="mt-1 font-mono text-sm text-white">{x.v}</p>
            <p className="text-[11px] text-slate-500">{x.d}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#00A3FF]/15 bg-[#000814]/60 p-3">
        <PanelTitle>Agent activity</PanelTitle>
        <ul className="mt-2 max-h-28 space-y-1.5 overflow-y-auto text-[12px] text-slate-300">
          {activity.map((line, i) => (
            <li key={`${i}-${line.slice(0, 24)}`} className="border-l border-[#00A3FF]/25 pl-2">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-[#00A3FF]/20 bg-[#000814]/90 p-2 shadow-[inset_0_0_28px_rgba(0,163,255,0.08)]">
        <div className="flex h-14 items-end justify-center gap-[3px] px-2">
          {waveBars.map((h, i) => (
            <motion.span
              key={i}
              className="w-1 rounded-t bg-gradient-to-t from-[#00A3FF]/15 to-[#00A3FF]"
              animate={{ height: Math.max(4, 4 + h * 52) }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              style={{ display: "block" }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runCommand()}
          placeholder="Ask anything… (e.g. 'How many approved accounts are active?')"
          className="min-w-0 flex-1 rounded-xl border border-[#00A3FF]/25 bg-[#000814] px-4 py-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-[#00A3FF]/60"
        />
        <button
          type="button"
          onClick={runCommand}
          className="rounded-xl border border-[#00A3FF]/50 bg-[#00A3FF]/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#00A3FF]"
        >
          Run
        </button>
      </div>
    </motion.section>
  );
}

function RightColumn({
  pendingN,
  pending30d,
  approvedN,
  summary,
}: {
  pendingN: number;
  pending30d: number;
  approvedN: number;
  summary: SummaryJson | null;
}) {
  const threads = summary?.inbox?.threadsLast7d ?? 0;
  const queue = summary?.pendingMarketplaceUsers ?? [];
  return (
    <motion.aside
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-4"
    >
      <PanelTitle>Pending accounts</PanelTitle>
      <div className="rounded-xl border border-[#00A3FF]/15 bg-[#000814]/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#00A3FF]/55">Queue (not approved)</span>
          <span className="rounded bg-[#FF3B3B]/90 px-2 py-0.5 text-[11px] font-bold text-white">{pendingN}</span>
        </div>
        <p className="mb-2 text-[10px] text-slate-500">
          Last 30 days: <span className="font-mono text-slate-400">{pending30d}</span>
          {summary?.pendingAccounts?.note ? (
            <span className="block text-slate-600">{summary.pendingAccounts.note}</span>
          ) : null}
        </p>
        <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
          {queue.length === 0 ? (
            <li className="rounded border border-[#00A3FF]/10 bg-[#00050A]/50 p-2 text-slate-500">
              {summary ? "No pending marketplace accounts." : "Load failed or still loading — sign in as admin."}
            </li>
          ) : (
            queue.map((r) => {
              const title = pendingQueueRowTitle(r);
              const subtitle = pendingQueueRowSubtitle(r, title);
              return (
                <li
                  key={`pending-preview-${r.displayIndex}-${r.createdAt}`}
                  className="rounded border border-[#00A3FF]/10 bg-[#00050A]/50 p-2"
                >
                  <p className="font-medium text-slate-200">{title}</p>
                  {subtitle ? <p className="text-[11px] text-[#00A3FF]/70">{subtitle}</p> : null}
                  <p className="text-[10px] text-slate-500">Joined {formatRelativeAgo(r.createdAt)} ago</p>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <PanelTitle>Approved (active)</PanelTitle>
      <div className="rounded-xl border border-[#00A3FF]/15 bg-[#000814]/80 p-3">
        <div className="flex flex-wrap gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00A3FF]/50">Users</p>
            <p className="font-mono text-xl text-white">{approvedN}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00A3FF]/50">Conv. (7d)</p>
            <p className="font-mono text-xl text-white">{threads}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00A3FF]/50">Engage</p>
            <p className="font-mono text-xl text-[#00FF85]">73.4%</p>
          </div>
        </div>
      </div>

      <PanelTitle>AI Revenue OS (Bentley)</PanelTitle>
      <div className="flex items-center gap-4 rounded-xl border border-[#00A3FF]/15 bg-[#000814]/80 p-4">
        <div className="relative h-20 w-20 rounded-full border-4 border-[#00A3FF]/35 text-center font-mono text-lg leading-[4.5rem] text-[#00FF85]">
          78%
        </div>
        <div className="flex-1 space-y-1 text-[12px] text-slate-300">
          <p>Campaigns active — 12</p>
          <p>Ready to launch — 3</p>
          <p>Revenue impact — +14.2%</p>
        </div>
      </div>

      <PanelTitle>System health</PanelTitle>
      <ul className="space-y-2 rounded-xl border border-[#00A3FF]/15 bg-[#000814]/80 p-3 text-xs">
        {[
          ["Database", "Healthy"],
          ["API services", "Online"],
          ["AI agents", "Online"],
          ["Voice", "Standby"],
          ["Security", "Secure"],
        ].map(([a, b]) => (
          <li key={a} className="flex justify-between border-b border-[#00A3FF]/10 pb-1 last:border-0">
            <span className="text-slate-400">{a}</span>
            <span className="text-[#00FF85]">{b}</span>
          </li>
        ))}
      </ul>
    </motion.aside>
  );
}

function PanelTitle({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00A3FF]/75">{children}</h2>
  );
}
