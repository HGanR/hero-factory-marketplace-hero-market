"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardParticleBackground } from "@/components/dashboard/DashboardParticleBackground";
import { BenchmarkComparisonPanel } from "@/components/revenue-os/BenchmarkComparisonPanel";
import { PrimaryFocusLeverCard } from "@/components/ai-revenue-os/PrimaryFocusLeverCard";
import { ProjectionCurveChartLazy } from "@/components/ai-revenue-os/ProjectionCurveChartLazy";
import {
  INDUSTRY_PROFILES,
  INDUSTRY_OPTIONS,
  type IndustryKey,
} from "@/lib/revenue-os/industry-profiles";

const ACCENT = "#00D1FF";
const GOLD = "#D4AF37";

type ScenarioPayload = {
  industry?: string;
  traffic?: number;
  conversion?: number;
  aov?: number;
  cac?: number;
  revenue?: number;
  delta?: number;
  annualImpact?: number;
  focusLever?: string;
  title?: string;
};

function apiKeyToIndustryKey(apiKey: string): IndustryKey {
  const raw = (apiKey ?? "").trim().toLowerCase();
  if (!raw) return "consulting";
  const byLabel = INDUSTRY_OPTIONS.find((o) => o.label.toLowerCase() === raw);
  if (byLabel) return byLabel.value;
  const byApiKey = (Object.entries(INDUSTRY_PROFILES) as [IndustryKey, { apiKey: string }][]).find(
    ([, p]) => p.apiKey.toLowerCase().replace(/\s+/g, " ") === raw.replace(/\s+/g, " ")
  );
  return byApiKey?.[0] ?? "consulting";
}

export default function ScenarioPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const [payload, setPayload] = useState<ScenarioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Missing scenario ID");
      setLoading(false);
      return;
    }
    let ignore = false;
    (async () => {
      try {
        const r = await fetch(`/api/revenue-os/scenarios/${id}`);
        const j = await r.json();
        if (ignore) return;
        if (!r.ok) {
          setError(j?.message ?? "Scenario not found");
          return;
        }
        setPayload(j.payload ?? {});
      } catch {
        if (!ignore) setError("Failed to load scenario");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <DashboardParticleBackground />
        <div className="relative z-10 text-gray-400">Loading scenario…</div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <DashboardParticleBackground />
        <div className="relative z-10 text-center">
          <div className="text-red-400 mb-4">{error ?? "Scenario not found"}</div>
          <Link href="/ai-revenue-os" className="text-cyan-400 hover:underline">
            ← Back to AI Revenue OS
          </Link>
        </div>
      </div>
    );
  }

  const industryKey = apiKeyToIndustryKey(payload.industry ?? "Consulting");
  const profile = INDUSTRY_PROFILES[industryKey];
  const traffic = payload.traffic ?? profile.defaultTraffic;
  const conversion = payload.conversion ?? profile.defaultConversion;
  const aov = payload.aov ?? profile.defaultAov;
  const cac = payload.cac ?? profile.benchmarks.cacTypical ?? 350;
  const baselineRevenue =
    profile.defaultTraffic * (profile.defaultConversion / 100) * profile.defaultAov;
  const revenue = traffic * (conversion / 100) * aov;
  const delta = revenue - baselineRevenue;
  const annualImpact = delta * 12;

  return (
    <div className="min-h-screen bg-slate-950 text-white relative">
      <DashboardParticleBackground />
      <div className="relative z-10 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-8">
            <Link
              href="/ai-revenue-os"
              className="text-sm text-gray-400 hover:text-cyan-400"
            >
              ← Back to AI Revenue OS
            </Link>
            <h1 className="text-3xl font-bold mt-2" style={{ color: ACCENT }}>
              {payload.title || "Saved Scenario"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {payload.title ? "Saved scenario" : "Shared scenario"} • {payload.industry ?? "Consulting"}{" "}
              {payload.focusLever ? `• Focus: ${payload.focusLever}` : ""}
            </p>
          </div>

          <div className="rounded-2xl border-2 p-8 shadow-xl border-cyan-500/60 bg-slate-800/60">
            <h3 className="text-xl font-semibold mb-6" style={{ color: ACCENT }}>
              Revenue Equation Engine™
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Revenue = Traffic × Conversion × AOV
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-sm text-gray-500">Industry</div>
                <div className="text-lg font-medium mt-1">{profile.label}</div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Traffic / Conversion / AOV</div>
                  <div className="text-lg font-medium mt-1">
                    {traffic.toLocaleString()} / {conversion}% / ${aov.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">CAC</div>
                  <div className="text-lg font-medium mt-1">${cac.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="rounded-xl border border-[#D4AF37]/40 bg-black/40 p-5">
                <div className="text-sm text-gray-400">Modeled Revenue</div>
                <div className="text-2xl font-bold mt-2">${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="rounded-xl border border-[#D4AF37]/40 bg-black/40 p-5">
                <div className="text-sm text-gray-400">Annual Impact</div>
                <div className="text-2xl font-bold mt-2" style={{ color: ACCENT }}>
                  {annualImpact >= 0 ? "+" : ""}${
                    annualImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  }
                </div>
              </div>
            </div>

            <PrimaryFocusLeverCard
              traffic={traffic}
              conversion={conversion}
              aov={aov}
            />
            <ProjectionCurveChartLazy
              baselineRevenue={baselineRevenue}
              yourRevenue={revenue}
            />
          </div>

          <div className="mt-8">
            <BenchmarkComparisonPanel
              industry={profile.apiKey}
              yourConversionPct={conversion}
              yourCac={cac}
            />
          </div>

          <div className="mt-8 text-center">
            <Link href="/ai-revenue-os#industry-intelligence">
              <button
                className="px-6 py-3 rounded-xl font-semibold border-2"
                style={{
                  borderColor: GOLD,
                  color: GOLD,
                  backgroundColor: "rgba(212,175,55,0.1)",
                }}
              >
                Try Your Own Scenario →
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
