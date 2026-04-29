"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Building2,
  ClipboardCheck,
  FileText,
  Globe2,
  Layers,
  Scale,
  Shield,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { HolographicCard, HOLO_TILE_SM } from "@/components/dashboard/HolographicCard";
import type { RetAgentDraft } from "@/lib/ret/types";
import { RetAgentWidget } from "@/components/ret/RetAgentWidget";

export type { RetAgentDraft } from "@/lib/ret/types";

const DEFAULT_ESCALATION: Record<string, boolean> = {
  "Title defect or missing instrument": false,
  "Lien payoff or subordination required": false,
  "Lender / covenant breach exposure": false,
  "Securities / token offering review": false,
  "Jurisdiction or tax counsel": false,
};

const defaultDraft = (): RetAgentDraft => ({
  intake: { propertyLabel: "", ownerContact: "", notes: "" },
  flags: { titleClear: false, lienRecorded: false, mortgageActive: false },
  structure: "llc",
  tokenDesign: "utility-receipt",
  risk: { securities: 3, lender: 3, title: 3 },
  jurisdiction: "",
  consultantSummary: "",
  clientSummary: "",
  escalation: { ...DEFAULT_ESCALATION },
  maaniaIntakePath: "sell",
});

export default function RET() {
  const [draft, setDraft] = useState<RetAgentDraft>(defaultDraft);

  const setIntake = useCallback((patch: Partial<RetAgentDraft["intake"]>) => {
    setDraft((d) => ({ ...d, intake: { ...d.intake, ...patch } }));
  }, []);

  const setFlags = useCallback((patch: Partial<RetAgentDraft["flags"]>) => {
    setDraft((d) => ({ ...d, flags: { ...d.flags, ...patch } }));
  }, []);

  const setRisk = useCallback((patch: Partial<RetAgentDraft["risk"]>) => {
    setDraft((d) => ({ ...d, risk: { ...d.risk, ...patch } }));
  }, []);

  const toggleEscalation = useCallback((key: string) => {
    setDraft((d) => ({
      ...d,
      escalation: { ...d.escalation, [key]: !d.escalation[key] },
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#050a12] text-slate-100">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-purple-950/20 pointer-events-none" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 pb-24">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-cyan-300/90 hover:text-cyan-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/for-realtors"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/15"
          >
            <Users className="w-4 h-4" />
            Share with real estate agents
          </Link>
        </div>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase">
              Real Estate Transfer
            </span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            RET — AI agent
          </h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Configure an agent-ready intake for property transfer workflows: risk, jurisdiction,
            summaries, and escalation. The same AI agent as your Site Builder site can load here with RET
            intake as context when{" "}
            <code className="text-cyan-500/90">NEXT_PUBLIC_RET_WIDGET_KEY</code> is set.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/25 bg-slate-900/40 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300/90">
            MAANIA intake focus
          </span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["sell", "Selling / transfer (RET)"],
                ["buy", "Purchasing a home"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    maaniaIntakePath: value,
                  }))
                }
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  (draft.maaniaIntakePath ?? "sell") === value
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/40"
                    : "border border-white/15 bg-slate-900/60 text-slate-300 hover:border-cyan-500/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 w-full md:w-auto md:ml-2">
            The floating widget receives this choice in <code className="text-cyan-600/90">retSnapshot</code> so
            MAANIA follows the seller RET workflow or the buyer qualification script.
          </p>
        </div>

        <RetAgentWidget draft={draft} />

        <div className="space-y-6">
          {/* Agent intake */}
          <HolographicCard accent="both">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-cyan-100">
                <Bot className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Agent-ready intake</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-slate-400">Property / deal label</Label>
                  <Input
                    className="mt-1 bg-slate-900/80 border-white/10"
                    value={draft.intake.propertyLabel}
                    onChange={(e) => setIntake({ propertyLabel: e.target.value })}
                    placeholder="e.g. 123 Main St — Phase 2"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Owner contact (email or handle)</Label>
                  <Input
                    className="mt-1 bg-slate-900/80 border-white/10"
                    value={draft.intake.ownerContact}
                    onChange={(e) => setIntake({ ownerContact: e.target.value })}
                    placeholder="owner@…"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-slate-400">Notes for the agent</Label>
                  <Textarea
                    className="mt-1 bg-slate-900/80 border-white/10 min-h-[88px]"
                    value={draft.intake.notes}
                    onChange={(e) => setIntake({ notes: e.target.value })}
                    placeholder="Material facts, deadlines, counterparties…"
                  />
                </div>
              </div>
            </div>
          </HolographicCard>

          {/* Title / lien / mortgage */}
          <HolographicCard accent="cyan">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-cyan-100">
                <FileText className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Title / lien / mortgage flags</h2>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={draft.flags.titleClear}
                    onCheckedChange={(v) => setFlags({ titleClear: v === true })}
                  />
                  <span className="text-sm">Title reported clear</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={draft.flags.lienRecorded}
                    onCheckedChange={(v) => setFlags({ lienRecorded: v === true })}
                  />
                  <span className="text-sm">Lien recorded</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={draft.flags.mortgageActive}
                    onCheckedChange={(v) => setFlags({ mortgageActive: v === true })}
                  />
                  <span className="text-sm">Mortgage active</span>
                </label>
              </div>
            </div>
          </HolographicCard>

          {/* Structure + token design */}
          <HolographicCard accent="both">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-cyan-100">
                <Layers className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Structure & token design</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-slate-400">Holding structure</Label>
                  <Select
                    value={draft.structure}
                    onValueChange={(v) => setDraft((d) => ({ ...d, structure: v }))}
                  >
                    <SelectTrigger className="mt-1 bg-slate-900/80 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llc">LLC / SPV</SelectItem>
                      <SelectItem value="trust">Trust</SelectItem>
                      <SelectItem value="dao">DAO / on-chain entity</SelectItem>
                      <SelectItem value="tbd">TBD with counsel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Token design (target)</Label>
                  <Select
                    value={draft.tokenDesign}
                    onValueChange={(v) => setDraft((d) => ({ ...d, tokenDesign: v }))}
                  >
                    <SelectTrigger className="mt-1 bg-slate-900/80 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utility-receipt">Utility / receipt token</SelectItem>
                      <SelectItem value="nft-fraction">NFT fractional interest</SelectItem>
                      <SelectItem value="security-token">Regulated security token</SelectItem>
                      <SelectItem value="none">No token / off-chain only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </HolographicCard>

          {/* Risk scoring */}
          <HolographicCard accent="both">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-cyan-100">
                <Shield className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Risk scoring (1–5)</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Placeholder sliders — wire to your model or rules engine later.
              </p>
              <div className="grid gap-6 md:grid-cols-3">
                {(
                  [
                    ["securities", "Securities / token"],
                    ["lender", "Lender / covenant"],
                    ["title", "Title / recording"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-cyan-400 font-mono">{draft.risk[key]}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      className="w-full accent-cyan-500"
                      value={draft.risk[key]}
                      onChange={(e) =>
                        setRisk({ [key]: Number(e.target.value) } as Partial<RetAgentDraft["risk"]>)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </HolographicCard>

          {/* Jurisdiction */}
          <HolographicCard accent="cyan">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-cyan-100">
                <Globe2 className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Jurisdiction prompts</h2>
              </div>
              <Textarea
                className="bg-slate-900/80 border-white/10 min-h-[100px]"
                value={draft.jurisdiction}
                onChange={(e) => setDraft((d) => ({ ...d, jurisdiction: e.target.value }))}
                placeholder="State / country, recording office, tax, securities exemptions, etc."
              />
            </div>
          </HolographicCard>

          {/* Summaries */}
          <div className="grid gap-6 md:grid-cols-2">
            <HolographicCard accent="both">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 text-cyan-100">
                  <Scale className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Consultant summary</h2>
                </div>
                <Textarea
                  className="bg-slate-900/80 border-white/10 min-h-[140px]"
                  value={draft.consultantSummary}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, consultantSummary: e.target.value }))
                  }
                  placeholder="Internal notes for counsel / consultants…"
                />
              </div>
            </HolographicCard>
            <HolographicCard accent="both">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 text-cyan-100">
                  <FileText className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Client-facing summary</h2>
                </div>
                <Textarea
                  className="bg-slate-900/80 border-white/10 min-h-[140px]"
                  value={draft.clientSummary}
                  onChange={(e) => setDraft((d) => ({ ...d, clientSummary: e.target.value }))}
                  placeholder="Plain-language summary for the property owner…"
                />
              </div>
            </HolographicCard>
          </div>

          {/* Escalation */}
          <HolographicCard accent="both">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-cyan-100">
                <TriangleAlert className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Escalation checklist</h2>
              </div>
              <div className="space-y-2">
                {Object.keys(draft.escalation).map((k) => (
                  <label
                    key={k}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${HOLO_TILE_SM}`}
                  >
                    <Checkbox
                      checked={draft.escalation[k]}
                      onCheckedChange={() => toggleEscalation(k)}
                    />
                    <span className="text-sm">{k}</span>
                  </label>
                ))}
              </div>
            </div>
          </HolographicCard>

          {/* Deal intelligence bridge */}
          <HolographicCard accent="cyan">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2 text-cyan-100">
                <TrendingUp className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Offer & listing intelligence</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4 max-w-3xl">
                Property Twin layers in directional ROI scenarios, a buyer-offer simulator, before/after viewer
                modes (staged / modern / luxury), a Property DNA score, and a one-click Markdown listing package
                with your twin link — so you show up to appointments with numbers, not just visuals. From the
                studio, open <strong className="text-slate-300">Presentation</strong> for a client-facing twin view
                (add <code className="text-cyan-500/90">?propertyId=</code> or use the in-app button).
              </p>
              <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white">
                <Link href="/property-twin">Open Property Twin — deal intelligence</Link>
              </Button>
            </div>
          </HolographicCard>

          {/* Hooks — future */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className={`${HOLO_TILE_SM} p-5 border border-dashed border-cyan-500/30`}>
              <div className="flex items-center gap-2 text-cyan-200 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="font-semibold">Owner AI concierge</span>
              </div>
              <p className="text-xs text-slate-500">
                The floating widget uses your Agency widget key and sends this draft as{" "}
                <code className="text-cyan-600/90">context.retSnapshot</code> on each message. Saved RET
                sessions (server-side) can be added later.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-white/15 text-slate-300"
                asChild
              >
                <Link href="/app/agents">Open AI Agency</Link>
              </Button>
            </div>
            <div className={`${HOLO_TILE_SM} p-5 border border-dashed border-purple-500/30`}>
              <div className="flex items-center gap-2 text-purple-200 mb-2">
                <Building2 className="w-4 h-4" />
                <span className="font-semibold">3D Property Twin</span>
              </div>
              <p className="text-xs text-slate-500">
                Digital twin intake, uploads, reconstruction jobs, planning nodes, and vendor search —
                wired to Drizzle tables and API routes.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-white/15 text-slate-300"
                asChild
              >
                <Link href="/property-twin">Open Property Twin Studio</Link>
              </Button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-white/10">
            <Button
              variant="outline"
              className="border-white/20"
              onClick={() => setDraft(defaultDraft())}
            >
              Reset draft
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
              disabled
              title="Save will be enabled when Drizzle + API routes are wired"
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Save (API next)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
