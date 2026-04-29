"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Shield, TrendingUp, Plus } from "lucide-react";

type Certificate = {
  id: string;
  denomination: number;
  beneficiaryName: string;
  notes?: string;
  issuedAt: string;
};

type Asset = {
  id: string;
  assetType: string;
  description: string;
  valuation: number;
  acquisitionDate: string;
};

const CERTS_KEY = "securities_certificates_v1";
const ASSETS_KEY = "securities_assets_v1";

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSave<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export default function SecuritiesCertificatesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"issue" | "assets" | "registry">("issue");

  const [certs, setCerts] = useState<Certificate[]>(() => safeLoad(CERTS_KEY, []));
  const [assets, setAssets] = useState<Asset[]>(() => safeLoad(ASSETS_KEY, []));

  // Issue form
  const [denomination, setDenomination] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [notes, setNotes] = useState("");

  // Asset form
  const [assetType, setAssetType] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [assetValuation, setAssetValuation] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => safeSave(CERTS_KEY, certs), [certs]);
  useEffect(() => safeSave(ASSETS_KEY, assets), [assets]);

  const totalAssetValue = useMemo(() => assets.reduce((s, a) => s + (a.valuation || 0), 0), [assets]);
  const totalCertValue = useMemo(() => certs.reduce((s, c) => s + (c.denomination || 0), 0), [certs]);

  const issueCertificate = () => {
    const denom = Number(denomination);
    if (!beneficiaryName.trim() || !isFinite(denom) || denom <= 0) {
      alert("Please fill in all required fields (denomination + beneficial owner).");
      return;
    }
    const id = `CERT-${new Date().getFullYear()}-${String(certs.length + 1).padStart(4, "0")}`;
    const next: Certificate = {
      id,
      denomination: denom,
      beneficiaryName: beneficiaryName.trim(),
      notes: notes.trim() || undefined,
      issuedAt: new Date().toISOString(),
    };
    setCerts((prev) => [next, ...prev]);
    setDenomination("");
    setBeneficiaryName("");
    setNotes("");
    setActiveTab("registry");
  };

  const registerAsset = () => {
    const val = Number(assetValuation);
    if (!assetType || !assetDescription.trim() || !isFinite(val) || val <= 0 || !acquisitionDate) {
      alert("Please fill in all required fields for asset registration.");
      return;
    }
    const id = `ASSET-${new Date().getFullYear()}-${String(assets.length + 1).padStart(4, "0")}`;
    const next: Asset = {
      id,
      assetType,
      description: assetDescription.trim(),
      valuation: val,
      acquisitionDate,
    };
    setAssets((prev) => [next, ...prev]);
    setAssetType("");
    setAssetDescription("");
    setAssetValuation("");
    setAcquisitionDate("");
    setActiveTab("assets");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Trust Certificates</h1>
            <p className="text-sm text-slate-300 mt-1">
              Issue certificates, register backing assets, and view your registry.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/securities" className="text-slate-300 hover:text-white underline">
              Back to Securities
            </Link>
            <Link href="/dashboard" className="text-slate-300 hover:text-white underline">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <MetricCard title="Registered Assets" value={`$${totalAssetValue.toLocaleString()}`} icon={<Shield className="h-5 w-5 text-green-300" />} />
          <MetricCard title="Issued Certificates" value={`$${totalCertValue.toLocaleString()}`} icon={<FileText className="h-5 w-5 text-cyan-300" />} />
          <MetricCard title="Certificates Count" value={`${certs.length}`} icon={<TrendingUp className="h-5 w-5 text-purple-300" />} />
        </div>

        <div className="flex gap-2 border-b border-white/10 mb-6 flex-wrap">
          <TabButton active={activeTab === "issue"} onClick={() => setActiveTab("issue")}>
            <FileText className="inline mr-2" size={16} />
            Issue Certificate
          </TabButton>
          <TabButton active={activeTab === "assets"} onClick={() => setActiveTab("assets")}>
            <Shield className="inline mr-2" size={16} />
            Asset Registry
          </TabButton>
          <TabButton active={activeTab === "registry"} onClick={() => setActiveTab("registry")}>
            <TrendingUp className="inline mr-2" size={16} />
            Certificate Registry
          </TabButton>
        </div>

        {activeTab === "issue" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-2">Issue New Trust Certificate</h2>
            <p className="text-slate-300 mb-6 text-sm">
              Create a new certificate representing beneficial interest in trust assets.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Denomination (USD) *</label>
                <input
                  type="number"
                  placeholder="10000"
                  value={denomination}
                  onChange={(e) => setDenomination(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Beneficial Owner Name *</label>
                <input
                  placeholder="John Doe"
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
              <textarea
                placeholder="Additional information about this certificate..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-h-[100px]"
              />
            </div>

            <button
              onClick={issueCertificate}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <FileText className="mr-2" size={16} />
              Issue Certificate
            </button>
          </div>
        ) : null}

        {activeTab === "assets" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-2">Register Trust Asset</h2>
            <p className="text-slate-300 mb-6 text-sm">
              Add assets to the trust that will back issued certificates.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Asset Type *</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950/30 border border-white/10 rounded-lg text-white"
                >
                  <option value="">Select asset type</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="securities">Securities</option>
                  <option value="cash">Cash & Equivalents</option>
                  <option value="promissory_note">Promissory Note</option>
                  <option value="intellectual_property">Intellectual Property</option>
                  <option value="equipment">Equipment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Current Valuation (USD) *</label>
                <input
                  type="number"
                  placeholder="50000"
                  value={assetValuation}
                  onChange={(e) => setAssetValuation(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950/30 border border-white/10 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Asset Description *</label>
              <textarea
                placeholder="Detailed description of the asset..."
                value={assetDescription}
                onChange={(e) => setAssetDescription(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950/30 border border-white/10 rounded-lg text-white min-h-[100px]"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Acquisition Date *</label>
              <input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950/30 border border-white/10 rounded-lg text-white"
              />
            </div>

            <button
              onClick={registerAsset}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <Plus className="mr-2" size={16} />
              Register Asset
            </button>

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {assets.length === 0 ? <div className="text-slate-300 text-sm">No assets registered yet.</div> : null}
              {assets.slice(0, 6).map((a) => (
                <div key={a.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="font-semibold">{a.id}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {a.assetType} • ${a.valuation.toLocaleString()} • {a.acquisitionDate}
                  </div>
                  <div className="text-sm text-slate-200 mt-2">{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "registry" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-2">Certificate Registry</h2>
            <p className="text-slate-300 mb-6 text-sm">Issued certificates (stored locally in this browser).</p>

            {certs.length === 0 ? (
              <div className="text-slate-300 text-sm">No certificates issued yet.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {certs.map((c) => (
                  <div key={c.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{c.id}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Issued {new Date(c.issuedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-cyan-200">${c.denomination.toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-slate-200 mt-2">
                      Beneficial owner: <span className="font-semibold">{c.beneficiaryName}</span>
                    </div>
                    {c.notes ? <div className="text-xs text-slate-400 mt-2">Notes: {c.notes}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition-colors border-b-2 ${
        active ? "text-cyan-300 border-cyan-300" : "text-slate-300 border-transparent hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-300">{title}</div>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}


