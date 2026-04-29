"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { PrimaryFocusLeverCard } from "./PrimaryFocusLeverCard";
import { ProjectionCurveChartLazy } from "./ProjectionCurveChartLazy";
import { ScenarioActions } from "./ScenarioActions";
import { CacRiskBand } from "./CacRiskBand";
import { MetricTooltip } from "./MetricTooltip";
import { GapToIndustryRoadmap } from "./GapToIndustryRoadmap";
import type { ClientReadinessAnswers } from "./ClientReadinessQuestionnaire";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F5C518";

export function RevenueSimulationBlock({
  traffic,
  setTraffic,
  conversion,
  setConversion,
  aov,
  setAov,
  baselineTraffic,
  baselineConversion,
  baselineAov,
  industry,
  industryLabel,
  cac,
  createdBy,
  questionnaireAnswers,
}: {
  traffic: number;
  setTraffic: (v: number) => void;
  conversion: number;
  setConversion: (v: number) => void;
  aov: number;
  setAov: (v: number) => void;
  baselineTraffic?: number;
  baselineConversion?: number;
  baselineAov?: number;
  industry?: string;
  industryLabel?: string;
  cac?: number;
  createdBy?: string;
  questionnaireAnswers?: ClientReadinessAnswers | null;
}) {
  const [localTraffic, setLocalTraffic] = useState(traffic);
  const [localAov, setLocalAov] = useState(aov);
  const trafficInputRef = useRef<HTMLInputElement>(null);
  const aovInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTraffic(traffic);
    setLocalAov(aov);
  }, [traffic, aov]);

  const applyFromInputs = () => {
    const trafficRaw = trafficInputRef.current?.value?.replace(/[^0-9.]/g, "") ?? "";
    const aovRaw = aovInputRef.current?.value?.replace(/[^0-9.]/g, "") ?? "";
    const t = trafficRaw === "" || trafficRaw === "." ? 100 : Number(trafficRaw);
    const a = aovRaw === "" || aovRaw === "." ? 1 : Number(aovRaw);
    const trafficVal = !Number.isFinite(t) ? 100 : Math.min(500000, Math.max(100, t));
    const aovVal = !Number.isFinite(a) ? 1 : Math.min(500000, Math.max(1, a));
    setLocalTraffic(trafficVal);
    setLocalAov(aovVal);
    setTraffic(trafficVal);
    setAov(aovVal);
  };

  const baseT = baselineTraffic ?? localTraffic;
  const baseC = baselineConversion ?? conversion;
  const baseA = baselineAov ?? localAov;

  const baselineRevenue = useMemo(
    () => baseT * (baseC / 100) * baseA,
    [baseT, baseC, baseA]
  );

  const revenue = useMemo(
    () => localTraffic * (conversion / 100) * localAov,
    [localTraffic, conversion, localAov]
  );

  const delta = revenue - baselineRevenue;
  const impliedOrders = Math.round(localTraffic * (conversion / 100));
  const annualImpact = delta * 12;

  const safeRevenue = Number.isFinite(revenue) ? revenue : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  const safeAnnualImpact = Number.isFinite(annualImpact) ? annualImpact : 0;
  const safeImpliedOrders = Number.isFinite(impliedOrders) ? impliedOrders : 0;
  const safeBaselineRevenue = Number.isFinite(baselineRevenue) ? baselineRevenue : 0;

  return (
    <div
      className="rounded-2xl border-2 p-8 shadow-xl"
      style={{
        backgroundColor: "rgba(0,0,0,0.6)",
        borderColor: GOLD,
        boxShadow: `0 0 40px rgba(212,175,55,0.15)`,
      }}
    >
      <h3 className="text-2xl font-semibold mb-6" style={{ color: GOLD }}>
        Revenue Equation Engine™
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Revenue = Traffic × Conversion × AOV
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <SimInput
            key={`traffic-${industry ?? "default"}`}
            label="Monthly Traffic"
            tooltip="Visitors, leads, or pipeline volume you can track. Used in Revenue = Traffic × Conversion × AOV."
            value={localTraffic}
            inputRef={trafficInputRef}
            min={100}
            max={500000}
          />
          <SimSlider
            label="Conversion Rate (%)"
            tooltip="Percentage of traffic that converts to a sale or qualified lead. Higher conversion = more revenue per visitor."
            value={conversion}
            onChange={setConversion}
            min={0.1}
            max={10}
            step={0.1}
          />
          <SimInput
            key={`aov-${industry ?? "default"}`}
            label="Average Order Value ($)"
            tooltip="Revenue per transaction. Includes upsells and offer ladder. A key lever for margin improvement."
            value={localAov}
            inputRef={aovInputRef}
            min={1}
            max={500000}
          />
          <button
            type="button"
            onClick={applyFromInputs}
            className="px-4 py-2 rounded-xl font-medium border-2 transition-all"
            style={{
              borderColor: GOLD,
              color: GOLD,
              backgroundColor: "rgba(212,175,55,0.1)",
            }}
          >
            Apply numbers (updates metrics below)
          </button>
        </div>

        <div className="space-y-6">
          <SimMetric
            label="Modeled Revenue"
            tooltip="Traffic × Conversion × AOV. Your projected monthly revenue at current assumptions."
            value={`$${safeRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <SimMetric
            label="Revenue Delta vs Industry"
            tooltip="Gap between your modeled revenue and industry benchmark. Negative = below standard — use the roadmap below to increase revenue."
            value={`${safeDelta >= 0 ? "+" : ""}$${safeDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            highlight
          />
          <SimMetric
            label="Implied Orders"
            tooltip="Estimated number of conversions: Traffic × (Conversion / 100)."
            value={safeImpliedOrders.toLocaleString()}
          />
          <SimMetric
            label="Compounding Annual Impact"
            tooltip="Gap × 12. Annual revenue opportunity if you close the gap to industry standard."
            value={`${safeAnnualImpact >= 0 ? "+" : ""}$${safeAnnualImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            highlight
          />
        </div>
      </div>

      {safeDelta < 0 && (
        <GapToIndustryRoadmap
          clientRevenue={Math.round(safeRevenue)}
          industryRevenue={Math.round(safeBaselineRevenue)}
          gap={safeDelta}
          annualGap={safeAnnualImpact}
          industryLabel={industryLabel ?? industry ?? "Industry"}
          questionnaireAnswers={questionnaireAnswers}
        />
      )}

      <PrimaryFocusLeverCard traffic={localTraffic} conversion={conversion} aov={localAov} />
      <ProjectionCurveChartLazy
        baselineRevenue={Math.max(safeBaselineRevenue, 1)}
        yourRevenue={Math.max(safeRevenue, 1)}
      />
      <CacRiskBand cac={cac ?? 0} aov={localAov} />
      <ScenarioActions
        payload={{
          industry: industry ?? "Consulting",
          traffic: localTraffic,
          conversion,
          aov: localAov,
          cac: cac ?? 0,
          revenue: safeRevenue,
          delta: safeDelta,
          annualImpact: safeAnnualImpact,
        }}
        createdBy={createdBy}
      />
    </div>
  );
}

function SimInput({
  label,
  tooltip,
  value,
  inputRef,
  min,
  max,
}: {
  label: string;
  tooltip?: string;
  value: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  min: number;
  max: number;
}) {
  const handleBlur = () => {
    const raw = inputRef.current?.value?.replace(/[^0-9.]/g, "") ?? "";
    const num = raw === "" || raw === "." ? min : Number(raw);
    const clamped = !Number.isFinite(num) ? min : Math.min(max, Math.max(min, num));
    if (inputRef.current) inputRef.current.value = String(clamped);
    // No React state update on blur - avoids crash
  };

  return (
    <div>
      <div className="text-sm text-gray-400 mb-2 flex items-center gap-1">
        {tooltip ? (
          <MetricTooltip tooltip={tooltip}>
            <span>{label}</span>
          </MetricTooltip>
        ) : (
          label
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={String(value)}
        onBlur={handleBlur}
        placeholder={String(min)}
        className="w-full p-3 rounded-xl bg-black/50 border-2 border-[#D4AF37]/50 text-white focus:outline-none focus:border-[#D4AF37]"
      />
    </div>
  );
}

function SimSlider({
  label,
  tooltip,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  tooltip?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <div className="text-sm text-gray-400 mb-2 flex justify-between items-center">
        <span className="flex items-center gap-1">
          {tooltip ? (
            <MetricTooltip tooltip={tooltip}>
              <span>{label}</span>
            </MetricTooltip>
          ) : (
            label
          )}
        </span>
        <span style={{ color: GOLD }}>{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-3 rounded-full cursor-pointer accent-[#D4AF37]"
      />
    </div>
  );
}

function SimMetric({
  label,
  tooltip,
  value,
  highlight,
}: {
  label: string;
  tooltip?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#D4AF37]/40 bg-black/40 p-5">
      <div className="text-sm text-gray-400 flex items-center gap-1">
        {tooltip ? (
          <MetricTooltip tooltip={tooltip}>
            <span>{label}</span>
          </MetricTooltip>
        ) : (
          label
        )}
      </div>
      <div
        className="text-2xl font-bold mt-2"
        style={highlight ? { color: GOLD_LIGHT } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
