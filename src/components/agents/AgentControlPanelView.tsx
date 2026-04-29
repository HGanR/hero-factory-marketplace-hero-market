"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AgentControlPanelPayload } from "@/lib/agents/agent-control-panel-data";

const KNOWLEDGE_LABEL: Record<string, string> = {
  faq: "FAQs",
  pdf: "PDFs / files",
  note: "Notes",
  url: "URLs",
  web_crawler: "Web crawls",
  tables: "Tabular",
};

function labelForKnowledgeType(t: string): string {
  return KNOWLEDGE_LABEL[t] ?? t;
}

type Props = { data: AgentControlPanelPayload };

export function AgentControlPanelView({ data }: Props) {
  const router = useRouter();
  const agentId = data.agent.id;
  const [status, setStatus] = useState(data.agent.status);
  const [toolCrm, setToolCrm] = useState(!!data.tools.crm);
  const [toolTasks, setToolTasks] = useState(!!data.tools.tasks);
  const [toolAuto, setToolAuto] = useState(!!data.tools.automations);
  const [toolSite, setToolSite] = useState(!!data.tools.siteContext);
  const [wDomains, setWDomains] = useState((data.binding?.allowedDomains ?? []).join(", "));
  const [wWelcome, setWWelcome] = useState(data.binding?.metadata.welcomeMessage ?? "");
  const [wTheme, setWTheme] = useState<"dark" | "light">(data.binding?.metadata.visual?.theme ?? "dark");
  const [wPos, setWPos] = useState<"left" | "right">(data.binding?.metadata.visual?.launcherPosition ?? "right");
  const [wMode, setWMode] = useState(
    (data.binding?.metadata.mode as string | undefined) ?? "public_chat",
  );
  const [wActive, setWActive] = useState(data.binding?.isActive ?? true);
  const [wProvider, setWProvider] = useState(
    (data.binding?.metadata.providerStrategy as "agent" | "site_builder" | undefined) ?? "agent",
  );
  const [avatarAltText, setAvatarAltText] = useState(data.binding?.metadata.widgetAppearance?.avatarAltText ?? "");
  const [avatarBorderColor, setAvatarBorderColor] = useState(data.binding?.metadata.widgetAppearance?.avatarBorderColor ?? "#2563eb");
  const [avatarBorderWidth, setAvatarBorderWidth] = useState<number>(data.binding?.metadata.widgetAppearance?.avatarBorderWidth ?? 2);
  const [widgetBubbleColor, setWidgetBubbleColor] = useState(data.binding?.metadata.widgetAppearance?.widgetBubbleColor ?? "#ffffff");
  const [widgetWindowBackgroundColor, setWidgetWindowBackgroundColor] = useState(
    data.binding?.metadata.widgetAppearance?.widgetWindowBackgroundColor ?? "#0f172a",
  );
  const [widgetHeaderColor, setWidgetHeaderColor] = useState(data.binding?.metadata.widgetAppearance?.widgetHeaderColor ?? "#1e293b");
  const [widgetTextColor, setWidgetTextColor] = useState(data.binding?.metadata.widgetAppearance?.widgetTextColor ?? "#e2e8f0");
  const [widgetAccentColor, setWidgetAccentColor] = useState(data.binding?.metadata.widgetAppearance?.widgetAccentColor ?? "#22d3ee");
  const [avatarImageUrl, setAvatarImageUrl] = useState(data.binding?.metadata.widgetAppearance?.avatarImageUrl ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [showLlm, setShowLlm] = useState(false);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const saveAgentCore = async () => {
    setBusy("agent");
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status,
          toolsJson: { crm: toolCrm, tasks: toolTasks, automations: toolAuto, siteContext: toolSite },
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast.error(j.error ?? "Save failed");
        return;
      }
      toast.success("Agent settings saved");
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const saveWidget = async () => {
    if (!data.binding?.siteId) {
      toast.error("No site binding — bind a site in Configure first.");
      return;
    }
    setBusy("widget");
    try {
      const allowedDomains = wDomains
        .split(/[\n,]/)
        .map((d) => d.trim())
        .filter(Boolean);
      const r = await fetch(
        `/api/site-builder/sites/${encodeURIComponent(data.binding.siteId)}/agency-widget`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            agentId,
            siteId: data.binding.siteId,
            allowedDomains,
            welcomeMessage: wWelcome,
            isActive: wActive,
            providerStrategy: wProvider,
            widgetMode: wMode,
            widgetVisual: { theme: wTheme, launcherPosition: wPos },
            widgetAppearance: {
              avatarImageUrl: avatarImageUrl || undefined,
              avatarAltText,
              avatarShape: "circle",
              avatarBorderColor,
              avatarBorderWidth,
              widgetBubbleColor,
              widgetWindowBackgroundColor,
              widgetHeaderColor,
              widgetTextColor,
              widgetAccentColor,
            },
          }),
        },
      );
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast.error(j.error ?? "Widget save failed");
        return;
      }
      toast.success("Widget settings updated");
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const siteBuilderHref = useMemo(() => {
    if (!data.binding?.siteId) return "/site-builder";
    const c = data.client?.id;
    return c
      ? `/site-builder?siteId=${encodeURIComponent(data.binding.siteId)}&clientId=${encodeURIComponent(c)}`
      : `/site-builder?siteId=${encodeURIComponent(data.binding.siteId)}`;
  }, [data.binding?.siteId, data.client?.id]);

  return (
    <div className="space-y-8 text-slate-100">
      <header className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-500/90">Operator</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{data.agent.name}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Consultant control surface. Client portal users cannot see this page — marketplace session
          (operator or authorized collaborator) only.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-white/10 bg-black/30 px-2 py-0.5 text-slate-300">
            Access: {data.accessRole}
          </span>
          {data.client ? (
            <Link
              href={`/ai-revenue-os/clients/${encodeURIComponent(data.client.id)}/command-center`}
              className="rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-200 hover:bg-cyan-500/15"
            >
              Client command center
            </Link>
          ) : null}
          <Link
            href={`/app/agents?agent=${encodeURIComponent(agentId)}`}
            className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-slate-200 hover:bg-white/10"
          >
            Full agent editor
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white/90">Overview</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-1">
              <select
                className="mt-0.5 w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-slate-100"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {(["draft", "active", "paused"] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Service (client account)</dt>
            <dd className="mt-1 text-slate-200">
              {data.client ? (
                <>
                  {data.client.name}
                  {data.service ? (
                    <span
                      className={
                        data.service.status === "paused" ? " ml-2 text-rose-300" : " ml-2 text-emerald-200"
                      }
                    >
                      — {data.service.status}
                    </span>
                  ) : (
                    <span className="ml-2 text-slate-500">—</span>
                  )}
                </>
              ) : (
                "Not linked to a Revenue OS client on this binding"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Bound site</dt>
            <dd className="mt-1 text-slate-200">
              {data.binding ? (
                <>
                  {data.binding.siteName}{" "}
                  <span className="text-slate-500">({data.binding.siteStatus})</span>
                  <div>
                    <Link
                      href={siteBuilderHref}
                      className="text-xs text-cyan-300 hover:underline"
                    >
                      Open in Site Builder
                    </Link>
                  </div>
                </>
              ) : (
                <span className="text-amber-200/90">No site bound yet</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Widget</dt>
            <dd className="mt-1 font-mono text-xs text-slate-300 break-all">
              {data.binding ? (
                <>
                  <span
                    className={data.binding.isActive ? "text-emerald-300" : "text-rose-300"}
                  >
                    {data.binding.isActive ? "Active" : "Paused"}
                  </span>
                  <div className="mt-1 text-slate-400">Key (public): {data.binding.widgetKey}</div>
                </>
              ) : (
                <span>—</span>
              )}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={busy === "agent"}
          onClick={() => void saveAgentCore()}
          className="mt-4 rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy === "agent" ? "Saving…" : "Save status & tools (below)"}
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white/90">Knowledge base</h2>
            <p className="mt-1 text-xs text-slate-500">Counts by type for this agent.</p>
          </div>
          <Link
            href={`/app/agents?agent=${encodeURIComponent(agentId)}&tab=knowledge`}
            className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/15"
          >
            Update knowledge
          </Link>
        </div>
        {data.knowledge.total === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No knowledge items yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.knowledge.byType.map((k) => (
              <li
                key={k.type}
                className="flex justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">{labelForKnowledgeType(k.type)}</span>
                <span className="font-mono text-slate-100">{k.count}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Use notes, PDFs, FAQs, and structured tables in the full editor — linked above.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white/90">Skills & tools</h2>
        <p className="mt-1 text-xs text-slate-500">
          Agent tools JSON, plugins, and Google tool runtime.
        </p>

        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-white/20"
              checked={toolCrm}
              onChange={(e) => setToolCrm(e.target.checked)}
            />
            <span>CRM & lead capture paths</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-white/20"
              checked={toolTasks}
              onChange={(e) => setToolTasks(e.target.checked)}
            />
            <span>Tasks / conversation routing (tasks)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-white/20"
              checked={toolAuto}
              onChange={(e) => setToolAuto(e.target.checked)}
            />
            <span>Automations (follow-ups, workflows)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-white/20"
              checked={toolSite}
              onChange={(e) => setToolSite(e.target.checked)}
            />
            <span>Site context (published site grounding when enabled in widget)</span>
          </label>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Plugin integrations</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {data.pluginSummary.length === 0 ? (
              <li className="text-slate-500">No plugins toggled on — use full editor → Capabilities to enable.</li>
            ) : (
              data.pluginSummary.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className={p.enabled ? "text-emerald-300/90" : "text-slate-500"}>●</span> {p.label}
                  <span className="text-xs text-slate-500">({p.status})</span>
                </li>
              ))
            )}
            <li>
              <span className="text-slate-400">Runtime authorized:</span>{" "}
              {data.capabilities.providerAuthorized ? "Yes" : "No"}{" "}
              {data.capabilities.reconnectSuggested ? (
                <span className="text-amber-200/90">(reconnect suggested)</span>
              ) : null}
            </li>
            {data.capabilities.lastError ? (
              <li className="text-rose-200/90 text-xs">Provider note: {data.capabilities.lastError}</li>
            ) : null}
          </ul>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          <Link
            className="text-cyan-300 hover:underline"
            href={`/app/agents?agent=${encodeURIComponent(agentId)}&tab=capabilities`}
          >
            Connect Google (Calendar, Gmail) for the tool loop
          </Link>
        </p>

        <ul className="mt-2 list-disc pl-5 text-sm text-slate-400">
          <li>Calendar: {data.capabilitySummary.calendar ? "enabled" : "disabled"}.</li>
          <li>Email follow-up: {data.capabilitySummary.followup ? "enabled" : "disabled"}.</li>
          <li>CRM capture: {data.capabilitySummary.crm ? "enabled" : "disabled"}.</li>
          <li>Booking flows: {data.capabilitySummary.booking ? "enabled" : "disabled"}.</li>
          <li>
            Social / campaigns:{" "}
            {data.capabilitySummary.social
              ? "revenue-OS social modules can apply when configured for the workspace"
              : "opt-in modules — your deployment may expose more flags in tools JSON"}
            .
            {data.socialToolsHint.customFlags.length > 0
              ? ` Custom keys: ${data.socialToolsHint.customFlags.join(", ")}`
              : null}
          </li>
        </ul>
        <button
          type="button"
          onClick={() => void saveAgentCore()}
          disabled={busy === "agent"}
          className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
        >
          Save tool toggles
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white/90">Widget (embed)</h2>
        {!data.binding ? (
          <p className="mt-2 text-sm text-amber-200/90">Bind a site in the main agent editor (Deploy) first.</p>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <label>
              <span className="text-xs text-slate-500">Allowed domains (comma or newline)</span>
              <textarea
                className="mt-1 w-full min-h-[72px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-slate-200"
                value={wDomains}
                onChange={(e) => setWDomains(e.target.value)}
                placeholder="example.com, app.example.com"
              />
            </label>
            <label>
              <span className="text-xs text-slate-500">Greeting (welcome message)</span>
              <textarea
                className="mt-1 w-full min-h-[64px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-slate-200"
                value={wWelcome}
                onChange={(e) => setWWelcome(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-xs text-slate-500">Theme</span>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  value={wTheme}
                  onChange={(e) => setWTheme(e.target.value as "dark" | "light")}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <label>
                <span className="text-xs text-slate-500">Launcher position</span>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  value={wPos}
                  onChange={(e) => setWPos(e.target.value as "left" | "right")}
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-xs text-slate-500">Mode (routing / UX)</span>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  value={wMode}
                  onChange={(e) => setWMode(e.target.value)}
                >
                  <option value="public_chat">public_chat</option>
                  <option value="lead_capture">lead_capture</option>
                  <option value="support">support</option>
                  <option value="hybrid">hybrid</option>
                  <option value="site_operator">site_operator</option>
                </select>
              </label>
              <label>
                <span className="text-xs text-slate-500">LLM routing for widget</span>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  value={wProvider}
                  onChange={(e) => setWProvider(e.target.value as "agent" | "site_builder")}
                >
                  <option value="agent">Agent (your model)</option>
                  <option value="site_builder">Site Builder AI (site settings)</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-white/20"
                checked={wActive}
                onChange={(e) => setWActive(e.target.checked)}
              />
              <span>Widget active (serve embed + accept chats)</span>
            </label>
            <button
              type="button"
              onClick={() => void saveWidget()}
              disabled={busy === "widget"}
              className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy === "widget" ? "Saving…" : "Save widget settings"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white/90">Widget Appearance</h2>
        <p className="mt-1 text-xs text-slate-500">Customize the floating assistant avatar and widget colors.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Avatar alt text
            <input
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-slate-100"
              value={avatarAltText}
              onChange={(e) => setAvatarAltText(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            Avatar border width
            <input
              type="number"
              min={0}
              max={12}
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-slate-100"
              value={avatarBorderWidth}
              onChange={(e) => setAvatarBorderWidth(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
            />
          </label>
          <ColorField label="Avatar border color" value={avatarBorderColor} onChange={setAvatarBorderColor} />
          <ColorField label="Bubble color" value={widgetBubbleColor} onChange={setWidgetBubbleColor} />
          <ColorField label="Window background" value={widgetWindowBackgroundColor} onChange={setWidgetWindowBackgroundColor} />
          <ColorField label="Header color" value={widgetHeaderColor} onChange={setWidgetHeaderColor} />
          <ColorField label="Text color" value={widgetTextColor} onChange={setWidgetTextColor} />
          <ColorField label="Accent color" value={widgetAccentColor} onChange={setWidgetAccentColor} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              fd.append("altText", avatarAltText);
              setBusy("avatar");
              try {
                const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/avatar`, {
                  method: "POST",
                  body: fd,
                  credentials: "include",
                });
                const j = (await r.json().catch(() => ({}))) as { error?: string; avatarImageUrl?: string };
                if (!r.ok || !j.avatarImageUrl) {
                  toast.error(j.error ?? "Avatar upload failed");
                } else {
                  setAvatarImageUrl(j.avatarImageUrl);
                  toast.success("Avatar uploaded");
                }
              } finally {
                setBusy(null);
              }
            }}
            className="text-xs"
          />
          <button
            type="button"
            onClick={() => void saveWidget()}
            disabled={busy === "widget" || busy === "avatar"}
            className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            Save appearance
          </button>
        </div>
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex justify-end">
            <div
              className="h-14 w-14 rounded-full shadow"
              style={{
                borderStyle: "solid",
                borderWidth: `${avatarBorderWidth}px`,
                borderColor: avatarBorderColor,
                backgroundColor: widgetBubbleColor,
                backgroundImage: avatarImageUrl ? `url(${avatarImageUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              aria-label={avatarAltText || "assistant avatar preview"}
              title={avatarAltText || "assistant avatar preview"}
            />
          </div>
          <div
            className="mt-3 rounded-lg p-3"
            style={{ backgroundColor: widgetWindowBackgroundColor, color: widgetTextColor }}
          >
            <div className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: widgetHeaderColor }}>
              Assistant preview
            </div>
            <p className="mt-2 text-xs">How can I help your client today?</p>
            <button className="mt-2 rounded px-2 py-1 text-xs font-medium" style={{ backgroundColor: widgetAccentColor, color: widgetTextColor }}>
              Sample action
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white/90">Conversation intelligence</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium uppercase text-slate-500">Recent visitor questions</h3>
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm text-slate-300">
              {data.recentQuestions.length === 0 ? (
                <li className="text-slate-500">No widget traffic yet for this agent.</li>
              ) : (
                data.recentQuestions.map((q) => (
                  <li key={q.id} className="border-b border-white/5 pb-2">
                    {q.text}
                    <div className="text-[10px] text-slate-500">{new Date(q.at).toLocaleString()}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase text-slate-500">Unresolved / error turns</h3>
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm text-rose-100/90">
              {data.unresolvedIssues.length === 0 ? (
                <li className="text-slate-500">No assistant error rows in recent history.</li>
              ) : (
                data.unresolvedIssues.map((u) => (
                  <li key={u.id} className="border-b border-white/5 pb-2">
                    {u.text}
                    <div className="text-[10px] text-slate-500">
                      {u.errorCode ?? u.status} · {new Date(u.at).toLocaleString()}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase text-slate-500">Suggested FAQ updates (heuristic)</h3>
          {data.suggestedFaqUpdates.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No repeat questions detected in recent history.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {data.suggestedFaqUpdates.map((s) => (
                <li
                  key={s.questionSample.slice(0, 64)}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                >
                  <div className="text-amber-100/90">×{s.occurrenceCount} — {s.questionSample}</div>
                  <div className="mt-1 text-xs text-amber-200/70">{s.hint}</div>
                  <Link
                    className="mt-2 inline-block text-xs text-cyan-300 hover:underline"
                    href={`/app/agents?agent=${encodeURIComponent(agentId)}&tab=knowledge`}
                  >
                    Add FAQ in Knowledge
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white/90">Client requests</h2>
        {data.clientRequests.items.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No client requests linked to this agent.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.clientRequests.items.map((r) => {
              const href = r.clientId
                ? `/ai-revenue-os/clients/${encodeURIComponent(r.clientId)}/requests`
                : null;
              return (
                <li key={r.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-100">{r.title}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">{r.type}</span>
                    <span className="rounded bg-cyan-900/60 px-1.5 py-0.5 text-[10px] uppercase text-cyan-200">{r.status}</span>
                    <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
                    {href ? (
                      <Link href={href} className="text-xs text-cyan-300 hover:underline">
                        Open request queue
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
        <h2 className="text-sm font-semibold text-rose-100/90">Safety & privacy</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-100/80">
          <li>LLM API keys and provider secrets are not shown here. Use the full editor only when rotating keys.</li>
          <li>
            Custom endpoint: default hidden.{" "}
            <button
              type="button"
              className="text-cyan-300 hover:underline"
              onClick={() => setShowLlm((s) => !s)}
            >
              {showLlm ? "Hide" : "Reveal"} routing summary
            </button>
            {showLlm ? (
              <span className="ml-1 font-mono text-slate-200">
                {data.agent.hasCustomLlm ? "Custom base URL is set on the agent" : "Platform / default routing"}
                {data.agent.model ? ` · model field: ${data.agent.model}` : null}
              </span>
            ) : null}
          </li>
          <li>Client portal cannot reach `/app/...` with portal cookies — this area uses marketplace operator auth only.</li>
        </ul>
      </section>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#1e293b"
      />
    </label>
  );
}
