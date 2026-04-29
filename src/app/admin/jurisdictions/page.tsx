// src/app/admin/jurisdictions/page.tsx
"use client";

import React from "react";
import { DAPT_JURISDICTIONS } from "@/lib/jurisdictions/dapt/data";
import { assertDaptDataIntegrity } from "@/lib/jurisdictions/dapt/validate";

export default function AdminJurisdictionsPage() {
  const [dataValid, setDataValid] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    try {
      assertDaptDataIntegrity();
      setDataValid(true);
    } catch (err: any) {
      setDataValid(false);
      setError(err.message);
    }
  }, []);

  const tierStats = React.useMemo(() => {
    const stats = {
      TOP_TIER: 0,
      ADVISORY_ONLY: 0,
      RESTRICTED: 0,
      total: DAPT_JURISDICTIONS.length
    };

    DAPT_JURISDICTIONS.forEach(jur => {
      stats[jur.tier]++;
    });

    return stats;
  }, []);

  const handleExportCSV = () => {
    const csvContent = [
      // Header
      ["State Code", "State Name", "Tier", "DAPT Legislation", "Protection Statute", "RUFADAA Statute", "Tax Status", "Tags"].join(","),
      // Data rows
      ...DAPT_JURISDICTIONS.map(jur => [
        jur.stateCode,
        `"${jur.stateName}"`,
        jur.tier,
        `"${jur.daptLegislation}"`,
        `"${jur.protectionStatute}"`,
        jur.rufadaaStatute ? `"${jur.rufadaaStatute}"` : "",
        `"${jur.stateTaxStatus}"`,
        `"${jur.tags.join("; ")}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dapt-jurisdictions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">DAPT Jurisdiction Data</h1>
          <p className="text-slate-400 mt-1">Governance and validation of jurisdiction dataset</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Data Integrity Status */}
      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${dataValid === true ? 'bg-green-500' : dataValid === false ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          <div>
            <h3 className="font-medium text-slate-100">Data Integrity</h3>
            <p className="text-sm text-slate-400">
              {dataValid === true && "All jurisdiction data validates against schema"}
              {dataValid === false && `Validation failed: ${error}`}
              {dataValid === null && "Checking data integrity..."}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">{tierStats.total}</div>
          <div className="text-sm text-slate-400">Total Jurisdictions</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{tierStats.TOP_TIER}</div>
          <div className="text-sm text-slate-400">Top Tier</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{tierStats.ADVISORY_ONLY}</div>
          <div className="text-sm text-slate-400">Advisory Only</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{tierStats.RESTRICTED}</div>
          <div className="text-sm text-slate-400">Restricted</div>
        </div>
      </div>

      {/* Jurisdiction Table */}
      <div className="bg-slate-900 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Jurisdiction Details</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">State</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">DAPT Law</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tax Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">RUFADAA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {DAPT_JURISDICTIONS.map((jur) => (
                <tr key={jur.stateCode} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-100">{jur.stateName}</div>
                    <div className="text-sm text-slate-400">{jur.stateCode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      jur.tier === "TOP_TIER" ? "bg-green-900 text-green-200" :
                      jur.tier === "ADVISORY_ONLY" ? "bg-yellow-900 text-yellow-200" :
                      "bg-red-900 text-red-200"
                    }`}>
                      {jur.tier.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-100">{jur.daptLegislation}</div>
                    <div className="text-xs text-slate-400">{jur.protectionStatute}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {jur.stateTaxStatus}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {jur.rufadaaStatute ? (
                      <span className="text-green-400">✓ {jur.rufadaaStatute}</span>
                    ) : (
                      <span className="text-slate-500">Not listed</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {jur.tags.map((tag) => (
                        <span key={tag} className="inline-flex px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}