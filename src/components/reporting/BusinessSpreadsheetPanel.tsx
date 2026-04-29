"use client";

import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";

/** US states + New Zealand for state/jurisdiction selection */
const JURISDICTION_CODES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
  "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","NZ",
] as const;

type UploadSummary = {
  sheetNames: string[];
  detectedYear?: number;
  detectedState?: string;
  reportingStart?: string;
  reportingEnd?: string;
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BusinessSpreadsheetPanel() {
  const [stateCode, setStateCode] = useState<(typeof JURISDICTION_CODES)[number]>("NY");

  // Any year (not confined)
  const [taxYear, setTaxYear] = useState<number>(2026);

  // Reporting period (changeable)
  const defaultStart = useMemo(() => `${taxYear}-01-01`, [taxYear]);
  const defaultEnd = useMemo(() => `${taxYear}-12-31`, [taxYear]);
  const [periodStart, setPeriodStart] = useState<string>(isoDate(new Date("2026-01-01")));
  const [periodEnd, setPeriodEnd] = useState<string>(isoDate(new Date("2026-12-31")));

  // Keep dates aligned when year changes (but still editable afterwards)
  React.useEffect(() => {
    setPeriodStart(defaultStart);
    setPeriodEnd(defaultEnd);
  }, [defaultStart, defaultEnd]);

  const [downloading, setDownloading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function downloadPrefilledTemplate() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        year: String(taxYear),
        state: stateCode,
        start: periodStart,
        end: periodEnd,
      });

      const res = await fetch(`/api/reporting/llc-template?${params.toString()}`);
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `LLC_Business_Spreadsheet_${taxYear}_${stateCode}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert(String(e?.message || e));
    } finally {
      setDownloading(false);
    }
  }

  async function onUpload(file: File) {
    setUploadError(null);
    setUploadSummary(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const sheetNames = wb.SheetNames || [];

      // Read embedded config if present
      const cfg = wb.Sheets["__HM_CONFIG__"];
      let detectedYear: number | undefined;
      let detectedState: string | undefined;
      let reportingStart: string | undefined;
      let reportingEnd: string | undefined;

      if (cfg) {
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(cfg, { defval: "" });
        const kv = new Map<string, string>();
        for (const row of json) {
          const k = String((row as any).Key || "").trim();
          const v = String((row as any).Value || "").trim();
          if (k) kv.set(k, v);
        }

        const y = Number(kv.get("taxYear"));
        if (Number.isFinite(y)) detectedYear = y;

        const st = kv.get("stateCode");
        if (st && /^[A-Z]{2}$/.test(st)) detectedState = st;

        const s = kv.get("reportingStart");
        const e = kv.get("reportingEnd");
        if (s) reportingStart = s;
        if (e) reportingEnd = e;
      }

      setUploadSummary({ sheetNames, detectedYear, detectedState, reportingStart, reportingEnd });
    } catch (e: any) {
      console.error(e);
      setUploadError(String(e?.message || e));
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 space-y-5">
      <div>
        <div className="text-xl font-semibold">LLC Business Spreadsheet</div>
        <div className="mt-1 text-sm text-slate-300">
          Exports the original 4-tab workbook with formulas intact. "C (no touch)" is not modified.
          You can set any reporting year and a custom reporting period.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm text-slate-300 mb-2">State</div>
          <select
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value as any)}
          >
            {JURISDICTION_CODES.map((s) => (
              <option key={s} value={s}>{s === "NZ" ? "New Zealand (NZ)" : s}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm text-slate-300 mb-2">Reporting Year</div>
          <input
            type="number"
            min={1900}
            max={2200}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
          />
          <div className="mt-2 text-xs text-slate-400">
            Any year supported (2026, 2025, or older reporting).
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 flex flex-col justify-between">
          <div>
            <div className="text-sm text-slate-300 mb-2">Export</div>
            <div className="text-xs text-slate-400">
              Generates a downloadable XLSX derived from the template (formulas preserved).
            </div>
          </div>
          <Button className="mt-4" onClick={downloadPrefilledTemplate} disabled={downloading}>
            {downloading ? "Preparing…" : "Download Spreadsheet"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm text-slate-300 mb-2">Reporting Period Start</div>
          <input
            type="date"
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm text-slate-300 mb-2">Reporting Period End</div>
          <input
            type="date"
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Upload a completed workbook (optional)</div>
            <div className="text-xs text-slate-400">
              Reads the embedded config and lists sheets (useful for ingestion).
            </div>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
            <span className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm hover:bg-slate-900">
              Choose .xlsx
            </span>
          </label>
        </div>

        {uploadError && (
          <div className="mt-3 rounded-md border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
            {uploadError}
          </div>
        )}

        {uploadSummary && (
          <div className="mt-3 rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200 space-y-1">
            <div><span className="text-slate-400">Sheets:</span> {uploadSummary.sheetNames.join(", ")}</div>
            <div><span className="text-slate-400">Detected Year:</span> {uploadSummary.detectedYear ?? "—"}</div>
            <div><span className="text-slate-400">Detected State:</span> {uploadSummary.detectedState ?? "—"}</div>
            <div><span className="text-slate-400">Reporting Start:</span> {uploadSummary.reportingStart ?? "—"}</div>
            <div><span className="text-slate-400">Reporting End:</span> {uploadSummary.reportingEnd ?? "—"}</div>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        Note: "Quarterly Taxes" due dates can be updated for the selected year, but you should still confirm IRS/state rules for exact holidays.
      </div>
    </div>
  );
}
