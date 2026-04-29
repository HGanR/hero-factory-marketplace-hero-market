"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Kpi = { label: string; value: string; hint?: string };
type PipelineStage = { name: string; count: number; amount: number };
type Task = { id: string; title: string; due: string; priority: "Low" | "Med" | "High" };

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function AppDashboardPage() {
  const [kpis, setKpis] = useState<Kpi[]>([
    { label: "New Leads (7d)", value: "0", hint: "Contacts created" },
    { label: "Appointments (7d)", value: "0", hint: "Booked + completed" },
    { label: "Open Opportunities", value: "0", hint: "Pipeline items" },
    { label: "Pipeline Value", value: "$0", hint: "Open amount" },
  ]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [kpiRes, pipeRes, taskRes] = await Promise.all([
          fetch("/api/app/dashboard/kpis", { credentials: "include" }),
          fetch("/api/app/pipelines/summary", { credentials: "include" }),
          fetch("/api/app/tasks?status=open", { credentials: "include" }),
        ]);
        if (active && kpiRes.ok) {
          const d = await kpiRes.json();
          if (d.kpis) setKpis(d.kpis);
        }
        if (active && pipeRes.ok) {
          const d = await pipeRes.json();
          if (d.stages) setPipeline(d.stages);
        }
        if (active && taskRes.ok) {
          const d = await taskRes.json();
          if (d.tasks) setTasks(d.tasks);
        }
      } catch {
        // Keep defaults
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const defaultPipeline: PipelineStage[] = pipeline.length
    ? pipeline
    : [
        { name: "New", count: 0, amount: 0 },
        { name: "Contacted", count: 0, amount: 0 },
        { name: "Qualified", count: 0, amount: 0 },
        { name: "Proposal", count: 0, amount: 0 },
        { name: "Won", count: 0, amount: 0 },
      ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60">
              CRM • Pipelines • Conversations • Automations • Calendar • AI / Voice Agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/contacts/new"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              + New Contact
            </Link>
            <Link
              href="/app/pipelines"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              View Pipeline
            </Link>
            <Link
              href="/app/voice-agents"
              className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20"
            >
              AI / Voice Agents
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/6 to-white/3 p-4 shadow-sm"
            >
              <div className="text-xs text-white/60">{k.label}</div>
              <div className="mt-2 text-2xl font-semibold">{loading ? "—" : k.value}</div>
              {k.hint ? <div className="mt-1 text-xs text-white/50">{k.hint}</div> : null}
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Pipeline Snapshot</h2>
                <p className="text-xs text-white/60">Open opportunities by stage</p>
              </div>
              <Link href="/app/pipelines" className="text-sm text-white/80 hover:text-white">
                Open →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {defaultPipeline.map((s) => (
                <div key={s.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-white/60">{s.count} items</div>
                  </div>
                  <div className="mt-2 text-lg font-semibold">{money(s.amount)}</div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-white"
                      style={{
                        width: `${Math.min(100, s.amount > 0 ? (s.amount / 15000) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Tasks</h2>
                <p className="text-xs text-white/60">What needs attention</p>
              </div>
              <Link href="/app/tasks" className="text-sm text-white/80 hover:text-white">
                All →
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {tasks.length === 0 && !loading ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-white/50">
                  No tasks yet
                </div>
              ) : (
                tasks.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-black/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="mt-1 text-xs text-white/60">Due: {t.due}</div>
                      </div>
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-xs shrink-0",
                          t.priority === "High"
                            ? "bg-white text-black"
                            : t.priority === "Med"
                              ? "bg-white/15 text-white"
                              : "bg-white/10 text-white/80",
                        ].join(" ")}
                      >
                        {t.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/app/tasks"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              + Create Task
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {[
            { title: "Contacts", desc: "Search, tags, custom fields", href: "/app/contacts" },
            { title: "Conversations", desc: "Unified inbox & threads", href: "/app/conversations" },
            { title: "Automations", desc: "Triggers & workflows", href: "/app/automations" },
            { title: "Calendar", desc: "Appointments & booking", href: "/app/calendar" },
            {
              title: "AI / Voice Agents",
              desc: "Phone-answering & chatbot agents",
              href: "/app/voice-agents",
            },
            { title: "Payroll", desc: "Workers, pay runs, tax documents", href: "/payroll" },
          ].map((x) => (
            <Link
              key={x.title}
              href={x.href}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
            >
              <div className="text-base font-semibold">{x.title}</div>
              <div className="mt-1 text-sm text-white/60">{x.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
