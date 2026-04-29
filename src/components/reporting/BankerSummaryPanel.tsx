"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Landmark, Download, RefreshCw, FileText } from "lucide-react";

interface FinancingProfile {
  id: string;
  trustId: string;
  instrumentId?: string;
  principalAmount?: number;
  outstandingPrincipal?: number;
  interestRate?: number;
  accruedInterest?: number;
  nextPaymentDate?: string;
  maturityDate?: string;
  status?: string;
  currency?: string;
}

interface Encumbrance {
  id: string;
  trustId: string;
  assetId: string;
  instrumentId?: string;
  pledgedValue?: number;
  lienPosition?: number;
  coverageRatio?: number;
  effectiveDate?: string;
  releaseDate?: string;
  status?: string;
}

interface AccountingData {
  transactions?: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    type: string;
    transactionClass?: string;
    instrumentId?: string;
  }>;
  businessInfo?: { name: string; ein: string; taxYear?: number };
}

export default function BankerSummaryPanel() {
  const [syncData, setSyncData] = useState<{
    financingProfiles: FinancingProfile[];
    encumbrances: Encumbrance[];
  } | null>(null);
  const [accountingData, setAccountingData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [syncRes] = await Promise.all([
        fetch("/api/accounting/sync/trust-records", { credentials: "include" }),
      ]);
      const syncJson = await syncRes.json();
      if (syncJson.ok) {
        setSyncData({
          financingProfiles: syncJson.financingProfiles ?? [],
          encumbrances: syncJson.encumbrances ?? [],
        });
      } else {
        setSyncData(null);
      }

      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("troothhurtz_accounting_data");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setAccountingData(parsed);
          } catch {
            setAccountingData(null);
          }
        } else {
          setAccountingData(null);
        }
      }
    } catch {
      setSyncData(null);
      setAccountingData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const transactions = accountingData?.transactions ?? [];
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const financingInflow = transactions
    .filter((t) => t.transactionClass === "financing_inflow")
    .reduce((s, t) => s + t.amount, 0);
  const interestPaid = transactions
    .filter((t) => t.transactionClass === "interest_expense")
    .reduce((s, t) => s + t.amount, 0);
  const brokerFees = transactions
    .filter((t) => t.transactionClass === "fee_expense")
    .reduce((s, t) => s + t.amount, 0);
  const outstandingPrincipal =
    syncData?.financingProfiles.reduce(
      (s, p) => s + (p.outstandingPrincipal ?? 0),
      0
    ) ?? 0;
  const encumberedValue =
    syncData?.encumbrances.reduce(
      (s, e) => s + (e.pledgedValue ?? 0),
      0
    ) ?? 0;

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      businessInfo: accountingData?.businessInfo,
      trustRecords: {
        financingProfiles: syncData?.financingProfiles ?? [],
        encumbrances: syncData?.encumbrances ?? [],
      },
      accounting: {
        totalIncome,
        totalExpenses,
        netIncome: totalIncome - totalExpenses,
        financingProceedsReceived: financingInflow,
        interestPaidYtd: interestPaid,
        brokerCustodyFeesYtd: brokerFees,
      },
      instrumentSummary: {
        outstandingPrincipal,
        encumberedAssetValue: encumberedValue,
        collateralCoverageRatio:
          outstandingPrincipal > 0 ? encumberedValue / outstandingPrincipal : null,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `banker_summary_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    accountingData?.businessInfo,
    syncData,
    totalIncome,
    totalExpenses,
    financingInflow,
    interestPaid,
    brokerFees,
    outstandingPrincipal,
    encumberedValue,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-cyan-400" />
          Banker Summary Report
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500"
          >
            <FileText className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 print:border print:bg-white print:text-black">
        <h3 className="text-lg font-semibold text-slate-100 print:text-black mb-4">
          Combined Trust Records + Accounting Presentation Packet
        </h3>
        <p className="text-sm text-slate-400 print:text-gray-600 mb-6">
          Generated {new Date().toLocaleString()} •{" "}
          {accountingData?.businessInfo?.name ?? "Business"}
        </p>

        {/* From Trust Records */}
        <section className="mb-8">
          <h4 className="text-md font-semibold text-cyan-400 print:text-gray-800 mb-3">
            Trust Records — Legal & Asset State
          </h4>
          <div className="space-y-4">
            <div>
              <h5 className="text-sm font-medium text-slate-300 print:text-gray-700 mb-2">
                Outstanding Instruments
              </h5>
              {syncData?.financingProfiles?.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-2">Instrument</th>
                      <th className="pb-2">Principal</th>
                      <th className="pb-2">Outstanding</th>
                      <th className="pb-2">Maturity</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncData.financingProfiles.map((f) => (
                      <tr key={f.id} className="border-b border-slate-800/50">
                        <td className="py-2 font-mono text-cyan-300 print:text-gray-800">
                          {f.instrumentId?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="py-2">
                          ${(f.principalAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2">
                          ${(f.outstandingPrincipal ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2">{f.maturityDate ?? "—"}</td>
                        <td className="py-2">{f.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-slate-500 text-sm">No instruments</p>
              )}
            </div>
            <div>
              <h5 className="text-sm font-medium text-slate-300 print:text-gray-700 mb-2">
                Collateral Schedule
              </h5>
              {syncData?.encumbrances?.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-2">Asset</th>
                      <th className="pb-2">Instrument</th>
                      <th className="pb-2">Pledged Value</th>
                      <th className="pb-2">Lien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncData.encumbrances.map((e) => (
                      <tr key={e.id} className="border-b border-slate-800/50">
                        <td className="py-2 font-mono text-cyan-300 print:text-gray-800">
                          {e.assetId?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="py-2 font-mono">
                          {e.instrumentId?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="py-2">
                          ${(e.pledgedValue ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2">{e.lienPosition ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-slate-500 text-sm">No encumbrances</p>
              )}
            </div>
          </div>
        </section>

        {/* From Accounting */}
        <section>
          <h4 className="text-md font-semibold text-cyan-400 print:text-gray-800 mb-3">
            Accounting — Economic & Tax State
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 print:border-gray-300">
              <p className="text-xs text-slate-400 print:text-gray-600">Cashflow Summary</p>
              <p className="text-lg font-semibold text-slate-100 print:text-black">
                Total Income: ${totalIncome.toLocaleString()}
              </p>
              <p className="text-lg font-semibold text-slate-100 print:text-black">
                Total Expenses: ${totalExpenses.toLocaleString()}
              </p>
              <p
                className={`text-lg font-semibold ${
                  totalIncome - totalExpenses >= 0 ? "text-green-400" : "text-red-400"
                } print:text-black`}
              >
                Net Income: ${(totalIncome - totalExpenses).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 print:border-gray-300">
              <p className="text-xs text-slate-400 print:text-gray-600">
                Debt Service & Fee Snapshot
              </p>
              <p className="text-sm text-slate-200 print:text-black">
                Financing Proceeds: ${financingInflow.toLocaleString()}
              </p>
              <p className="text-sm text-slate-200 print:text-black">
                Interest Paid YTD: ${interestPaid.toLocaleString()}
              </p>
              <p className="text-sm text-slate-200 print:text-black">
                Broker/Custody Fees YTD: ${brokerFees.toLocaleString()}
              </p>
              <p className="text-sm text-slate-200 print:text-black">
                Outstanding Principal: ${outstandingPrincipal.toLocaleString()}
              </p>
              <p className="text-sm text-slate-200 print:text-black">
                Encumbered Asset Value: ${encumberedValue.toLocaleString()}
              </p>
              {outstandingPrincipal > 0 && (
                <p className="text-sm text-slate-200 print:text-black">
                  Collateral Coverage:{" "}
                  {((encumberedValue / outstandingPrincipal) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
