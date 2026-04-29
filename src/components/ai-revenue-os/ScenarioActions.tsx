"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getFocusLever } from "@/lib/revenue-os/focus-lever";

const GOLD = "#D4AF37";

export type ScenarioPayload = {
  industry: string;
  traffic: number;
  conversion: number;
  aov: number;
  cac?: number;
  revenue: number;
  delta: number;
  annualImpact: number;
};

export function ScenarioActions({
  payload,
  createdBy,
}: {
  payload: ScenarioPayload;
  createdBy?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");

  const saveScenario = async (options?: { silent?: boolean }): Promise<string | null> => {
    setSaving(true);
    try {
      const res = await fetch("/api/revenue-os/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: payload.industry,
          traffic: payload.traffic,
          conversion: payload.conversion,
          aov: payload.aov,
          cac: payload.cac ?? 0,
          revenue: payload.revenue,
          delta: payload.delta,
          annualImpact: payload.annualImpact,
          title: title.trim() || undefined,
          createdBy,
        }),
      });
      const data = (await res.json()) as { id?: string; permalink?: string; message?: string };
      if (!res.ok) throw new Error(data?.message ?? "Save failed");
      const url =
        typeof window !== "undefined" && data.permalink
          ? `${window.location.origin}${data.permalink}`
          : data.permalink ?? null;
      if (!options?.silent) toast.success("Scenario saved");
      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save scenario");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => saveScenario();

  const onCopyLink = async () => {
    const url = await saveScenario({ silent: true });
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const onExportPdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const focusLever = getFocusLever(payload.traffic, payload.conversion, payload.aov);
      const pct = payload.aov > 0 ? ((payload.cac ?? 0) / payload.aov * 100).toFixed(1) : "0";
      const riskBand = payload.aov <= 0 ? "Safe" : (payload.cac ?? 0) / payload.aov <= 0.33 ? "Safe" : (payload.cac ?? 0) / payload.aov <= 0.5 ? "Caution" : "Risk";

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      doc.setFontSize(18);
      doc.text("AI Revenue OS™ — Scenario Summary", 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(title.trim() || `${payload.industry} • ${new Date().toLocaleDateString()}`, 40, 55);
      doc.setTextColor(0, 0, 0);

      const rows = [
        ["Industry", payload.industry],
        ["Traffic", payload.traffic.toLocaleString()],
        ["Conversion", `${payload.conversion}%`],
        ["AOV", `$${payload.aov.toLocaleString()}`],
        ["CAC", `$${(payload.cac ?? 0).toLocaleString()}`],
        ["Modeled Revenue", `$${payload.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
        ["Revenue Delta", `${payload.delta >= 0 ? "+" : ""}$${payload.delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
        ["Annual Impact", `${payload.annualImpact >= 0 ? "+" : ""}$${payload.annualImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
        ["Focus Lever", focusLever.charAt(0).toUpperCase() + focusLever.slice(1)],
        ["Risk Band", `${riskBand} (CAC ${pct}% of AOV)`],
      ];

      doc.setFontSize(11);
      rows.forEach(([label, value], i) => {
        const y = 80 + i * 18;
        doc.setFont("helvetica", "normal");
        doc.text(label, 40, y);
        doc.setFont("helvetica", "bold");
        doc.text(String(value), 180, y);
      });

      doc.save(`${title.trim() || "scenario"}-revenue-os.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export PDF");
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Scenario name (optional)</label>
        <input
          type="text"
          placeholder="e.g. Q1 SaaS baseline"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full max-w-xs p-2 rounded-lg bg-black/40 border border-[#D4AF37]/40 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/60"
        />
      </div>
      <div className="flex flex-wrap gap-3">
      <button
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 rounded-xl font-medium border-2 transition-all disabled:opacity-60"
        style={{
          borderColor: GOLD,
          color: GOLD,
          backgroundColor: "rgba(212,175,55,0.1)",
        }}
      >
        {saving ? "Saving…" : "Save Scenario"}
      </button>
      <button
        onClick={onCopyLink}
        disabled={saving}
        className="px-4 py-2 rounded-xl font-medium border-2 transition-all disabled:opacity-60"
        style={{
          borderColor: GOLD,
          color: GOLD,
          backgroundColor: "rgba(212,175,55,0.1)",
        }}
      >
        {saving ? "Saving…" : "Copy Link"}
      </button>
      <button
        onClick={onExportPdf}
        disabled={saving}
        className="px-4 py-2 rounded-xl font-medium border-2 transition-all disabled:opacity-60"
        style={{
          borderColor: GOLD,
          color: GOLD,
          backgroundColor: "rgba(212,175,55,0.1)",
        }}
      >
        Export PDF
      </button>
      </div>
    </div>
  );
}
