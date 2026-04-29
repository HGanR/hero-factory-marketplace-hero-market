"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, CheckCircle, Circle, ChevronRight, Rocket } from "lucide-react";

const MISSIONS = [
  {
    id: "start-business",
    title: "Start a Business",
    description: "Create entity, configure trust, set up accounting, and launch",
    steps: [
      { label: "Create entity", href: "/entity-builder", module: "Entity Builder" },
      { label: "Configure trust/workspace", href: "/trust-records", module: "Trust Records" },
      { label: "Add assets", href: "/trust-records", module: "Trust Records" },
      { label: "Setup accounting", href: "/accounting", module: "Accounting" },
      { label: "Launch website", href: "/site-builder", module: "Site Builder" },
      { label: "Deploy AI agents", href: "/app/agents", module: "AI Agency" },
    ],
  },
  {
    id: "launch-agent",
    title: "Launch an AI Agent",
    description: "Build and deploy an AI assistant for your business",
    steps: [
      { label: "Create agent", href: "/app/agents", module: "AI Agency" },
      { label: "Configure knowledge", href: "/app/agents", module: "AI Agency" },
      { label: "Connect to modules", href: "/app/agents", module: "AI Agency" },
      { label: "Publish to marketplace", href: "/nft-marketplace", module: "Marketplace" },
    ],
  },
  {
    id: "create-asset",
    title: "Create a Digital Asset",
    description: "Issue certificates, NFTs, or trust-backed instruments",
    steps: [
      { label: "Create trust/workspace", href: "/trust-records", module: "Trust Records" },
      { label: "Add collateral", href: "/trust-records", module: "Trust Records" },
      { label: "Issue instrument", href: "/trust-records", module: "Trust Records" },
      { label: "Record in accounting", href: "/accounting", module: "Accounting" },
    ],
  },
  {
    id: "issue-certificates",
    title: "Issue Trust Certificates",
    description: "Create and issue certificated securities",
    steps: [
      { label: "Setup trust", href: "/trust-records", module: "Trust Records" },
      { label: "Configure governance", href: "/trust-records", module: "Trust Records" },
      { label: "Issue certificates", href: "/securities", module: "Securities" },
      { label: "Deposit to brokerage", href: "/instrument-deposits", module: "Instrument Deposits" },
    ],
  },
  {
    id: "build-website",
    title: "Build a Website",
    description: "Create and publish a business website",
    steps: [
      { label: "Choose template", href: "/site-builder/templates", module: "Site Builder" },
      { label: "Customize content", href: "/site-builder", module: "Site Builder" },
      { label: "Connect domain", href: "/site-builder", module: "Site Builder" },
      { label: "Publish", href: "/site-builder", module: "Site Builder" },
    ],
  },
  {
    id: "launch-campaign",
    title: "Launch a Marketing Campaign",
    description: "Set up funnels, campaigns, and revenue automation",
    steps: [
      { label: "Create funnel", href: "/ai-revenue-os", module: "Revenue OS" },
      { label: "Configure campaigns", href: "/app/automations", module: "Automations" },
      { label: "Deploy AI marketing agent", href: "/app/agents", module: "AI Agency" },
    ],
  },
];

const STORAGE_KEY = "mission_path_progress";

function getStoredProgress(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStoredProgress(missionId: string, stepIndex: number) {
  if (typeof window === "undefined") return;
  const prev = getStoredProgress();
  prev[missionId] = Math.max(prev[missionId] ?? 0, stepIndex);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
}

export default function MissionPathPage() {
  const router = useRouter();
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) {
        router.push("/");
        return;
      }
      setIsLoggedIn(true);
      setProgress(getStoredProgress());
    } catch {
      router.push("/");
    } finally {
      setIsChecking(false);
    }
  }, [router]);

  const handleStepComplete = (missionId: string, stepIndex: number) => {
    setStoredProgress(missionId, stepIndex);
    setProgress((p) => ({ ...p, [missionId]: Math.max(p[missionId] ?? 0, stepIndex) }));
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const mission = selectedMission ? MISSIONS.find((m) => m.id === selectedMission) : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Mission Path</h1>
              <p className="text-slate-400">Choose your goal and follow the guided steps</p>
            </div>
          </div>
        </div>

        {!mission ? (
          /* Goal selection */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {MISSIONS.map((m) => {
              const completed = (progress[m.id] ?? 0) + 1;
              const total = m.steps.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMission(m.id)}
                  className="text-left p-6 rounded-2xl border border-slate-800 bg-slate-950/50 hover:border-cyan-500/40 hover:bg-slate-900/50 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Rocket className="w-6 h-6 text-cyan-400/70 group-hover:text-cyan-400" />
                    {pct > 0 && (
                      <span className="text-xs text-slate-500">
                        {completed}/{total} steps
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-cyan-300">{m.title}</h3>
                  <p className="text-sm text-slate-400 mb-4">{m.description}</p>
                  <div className="flex items-center gap-2 text-cyan-400 text-sm">
                    Start mission
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Step-by-step flow */
          <div>
            <button
              onClick={() => setSelectedMission(null)}
              className="text-slate-400 hover:text-white text-sm mb-6"
            >
              ← Choose different goal
            </button>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">{mission.title}</h2>
              <p className="text-slate-400">{mission.description}</p>
            </div>
            <div className="space-y-3">
              {mission.steps.map((step, idx) => {
                const isComplete = (progress[mission.id] ?? -1) >= idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                      isComplete
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {isComplete ? (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{step.label}</p>
                      <p className="text-xs text-slate-500">{step.module}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={step.href}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm"
                      >
                        Open
                      </Link>
                      {!isComplete && (
                        <button
                          onClick={() => handleStepComplete(mission.id, idx)}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-between items-center">
          <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← Back to Dashboard
          </Link>
          <Link href="/platform-map" className="text-cyan-400 hover:text-cyan-300 text-sm">
            Platform Map →
          </Link>
        </div>
      </div>
    </div>
  );
}
