import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function safeState(state: string | null): string {
  const s = String(state || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(s)) return s;
  return "NY";
}

function safeYear(year: string | null): number {
  const y = Number(String(year || "").trim());
  if (Number.isFinite(y) && y >= 1900 && y <= 2200) return y;
  return 2026;
}

function safeISODate(value: string | null, fallback: string): string {
  const v = String(value || "").trim();
  // Expect YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return fallback;
}

function monthName(m: number) {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m];
}

function formatLongDate(d: Date) {
  // "April 15, 2026"
  return `${monthName(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
}

function adjustWeekend(d: Date) {
  // Conservative weekend-only adjustment:
  // Sat -> +2 days, Sun -> +1 day
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

function setCellString(ws: XLSX.WorkSheet, addr: string, value: string) {
  (ws as any)[addr] = { t: "s", v: value };
}

function upsertConfigSheet(
  wb: XLSX.WorkBook,
  payload: { taxYear: number; stateCode: string; reportingStart: string; reportingEnd: string }
) {
  const data = [
    { Key: "taxYear", Value: String(payload.taxYear) },
    { Key: "stateCode", Value: payload.stateCode },
    { Key: "reportingStart", Value: payload.reportingStart },
    { Key: "reportingEnd", Value: payload.reportingEnd },
    { Key: "generatedAt", Value: new Date().toISOString() },
    { Key: "sourceTemplate", Value: "Business-Spreadsheet-Template-2019-LLC.xlsx" },
  ];

  const ws = XLSX.utils.json_to_sheet(data, { header: ["Key", "Value"] });
  wb.Sheets["__HM_CONFIG__"] = ws;
  if (!wb.SheetNames.includes("__HM_CONFIG__")) wb.SheetNames.push("__HM_CONFIG__");
}

function updateQuarterlyTaxesSheet(wb: XLSX.WorkBook, taxYear: number) {
  const sheetName = "#2 Quarterly Taxes";
  const ws = wb.Sheets[sheetName];
  if (!ws) return;

  // Update the "Overpayment applies…" lines (template uses fixed years)
  // D7: "2017 Overpayment applies to 2018"
  // D16: same for state section
  setCellString(ws, "D7", `${taxYear - 1} Overpayment applies to ${taxYear}`);
  setCellString(ws, "D16", `${taxYear - 1} Overpayment applies to ${taxYear}`);

  // Federal estimated tax due dates (typical)
  // Row 8: Apr 15 taxYear
  // Row 9: Jun 15 taxYear
  // Row 10: Sep 15 taxYear
  // Row 11: Jan 15 (taxYear + 1)
  const d1 = adjustWeekend(new Date(Date.UTC(taxYear, 3, 15)));      // Apr 15
  const d2 = adjustWeekend(new Date(Date.UTC(taxYear, 5, 15)));      // Jun 15
  const d3 = adjustWeekend(new Date(Date.UTC(taxYear, 8, 15)));      // Sep 15
  const d4 = adjustWeekend(new Date(Date.UTC(taxYear + 1, 0, 15)));  // Jan 15 next year

  setCellString(ws, "E8", formatLongDate(new Date(d1.getTime())));
  setCellString(ws, "E9", formatLongDate(new Date(d2.getTime())));
  setCellString(ws, "E10", formatLongDate(new Date(d3.getTime())));
  setCellString(ws, "E11", formatLongDate(new Date(d4.getTime())));

  // State estimated tax section mirrors the same pattern in rows 17-20
  setCellString(ws, "E17", formatLongDate(new Date(d1.getTime())));
  setCellString(ws, "E18", formatLongDate(new Date(d2.getTime())));
  setCellString(ws, "E19", formatLongDate(new Date(d3.getTime())));
  setCellString(ws, "E20", formatLongDate(new Date(d4.getTime())));

  // IMPORTANT: We are not touching formulas anywhere; these cells are label/date cells.
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const taxYear = safeYear(searchParams.get("year"));
  const stateCode = safeState(searchParams.get("state"));

  const reportingStart = safeISODate(searchParams.get("start"), `${taxYear}-01-01`);
  const reportingEnd = safeISODate(searchParams.get("end"), `${taxYear}-12-31`);

  // Base template in /public/templates
  const templatePath = path.join(
    process.cwd(),
    "public",
    "templates",
    "Business-Spreadsheet-Template-2019-LLC.xlsx"
  );

  const buf = await fs.readFile(templatePath);

  // Read workbook; preserve formulas
  const wb = XLSX.read(buf, {
    type: "buffer",
    cellFormula: true,
    cellNF: true,
  });

  // DO NOT modify "C (no touch)" at all.
  // DO NOT do global replacements across all sheets.

  // Update only the targeted "Quarterly Taxes" due-date labels and overpayment label.
  updateQuarterlyTaxesSheet(wb, taxYear);

  // Add config sheet (safe; does not interfere with existing formulas)
  upsertConfigSheet(wb, { taxYear, stateCode, reportingStart, reportingEnd });

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(out as any, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="LLC_Business_Spreadsheet_${taxYear}_${stateCode}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
