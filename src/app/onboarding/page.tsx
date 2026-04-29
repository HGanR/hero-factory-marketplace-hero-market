"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toGateway } from "@/lib/storage";

type Onboarding = {
  id: number;
  userId: number;
  companyName: string;
  entityType: string;
  jurisdiction: string;
  taxIdLast4: string;
  serviceTier: string;
  primaryContact: string | null;
  contactEmail: string | null;
  phone: string | null;
  onboardingStatus: string;
  letterOfGoodOperationUri: string | null;
  articlesOfIncorporationUri: string | null;
  isRevoked: boolean;
  revokedReason: string | null;
};

type DocType = "LETTER_OF_GOOD_OPERATION" | "ARTICLES_OF_INCORPORATION";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);

  // form
  const [companyName, setCompanyName] = useState("");
  const [entityType, setEntityType] = useState("LLC");
  const [jurisdiction, setJurisdiction] = useState("Delaware");
  const [taxIdLast4, setTaxIdLast4] = useState("");
  const [serviceTier, setServiceTier] = useState("basic");
  const [primaryContact, setPrimaryContact] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");

  const missingDocs = useMemo(() => {
    const m: string[] = [];
    if (!onboarding?.letterOfGoodOperationUri) m.push("Letter of Good Operation Agreement");
    if (!onboarding?.articlesOfIncorporationUri) m.push("Articles of Incorporation");
    return m;
  }, [onboarding]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/me");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load onboarding");
      setOnboarding(data.onboarding || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load onboarding");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          entityType,
          jurisdiction,
          taxIdLast4,
          serviceTier,
          primaryContact,
          contactEmail,
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit onboarding");
      setOnboarding(data.onboarding);
      setMessage("Application submitted. Please upload the required documents.");
    } catch (e: any) {
      setError(e?.message || "Failed to submit onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadDoc(docType: DocType, file: File | null) {
    if (!file) return;
    setUploading(docType);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("docType", docType);
      form.set("file", file);
      const res = await fetch("/api/onboarding/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to upload document");
      setOnboarding(data.onboarding);
      setMessage("Document uploaded.");
    } catch (e: any) {
      setError(e?.message || "Failed to upload document");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="text-xl font-bold">Onboarding</div>
        <div className="flex items-center gap-4">
          <Link href="/accounting" className="text-slate-300 hover:text-cyan-300">
            Accounting
          </Link>
          <Link href="/dashboard" className="text-slate-300 hover:text-cyan-300">
            Dashboard
          </Link>
          <Link href="/" className="text-slate-300 hover:text-cyan-300">
            Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-slate-300">Loading…</div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded text-green-300 text-sm">
                {message}
              </div>
            )}

            {!onboarding ? (
              <section className="bg-black/40 rounded-2xl border border-white/10 p-6">
                <h1 className="text-2xl font-bold mb-2">Entity Onboarding</h1>
                <p className="text-slate-300 mb-6">
                  For security, we only collect the <b>last 4 digits</b> of your EIN/Tax ID.
                </p>

                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">
                      Organization / Company Name *
                    </label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="Your organization name"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Entity Type *</label>
                      <select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="LLC">LLC</option>
                        <option value="Corporation">Corporation</option>
                        <option value="Statutory Trust">Statutory Trust</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Jurisdiction *</label>
                      <select
                        value={jurisdiction}
                        onChange={(e) => setJurisdiction(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="Delaware">Delaware</option>
                        <option value="Nevada">Nevada</option>
                        <option value="Wyoming">Wyoming</option>
                        <option value="Washington DC">Washington DC</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">
                        EIN (Tax ID) — last 4 digits *
                      </label>
                      <input
                        value={taxIdLast4}
                        onChange={(e) =>
                          setTaxIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        inputMode="numeric"
                        pattern="\\d{4}"
                        maxLength={4}
                        required
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="1234"
                      />
                      <div className="text-xs text-slate-400 mt-1">We do not store the full EIN/SSN.</div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Service Tier *</label>
                      <select
                        value={serviceTier}
                        onChange={(e) => setServiceTier(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                        <option value="institutional">Institutional</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Primary Contact</label>
                      <input
                        value={primaryContact}
                        onChange={(e) => setPrimaryContact(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="name@company.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Phone</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit Onboarding"}
                  </button>
                </form>
              </section>
            ) : (
              <section className="bg-black/40 rounded-2xl border border-white/10 p-6 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="text-2xl font-bold">{onboarding.companyName}</h1>
                    <div className="text-sm text-slate-300 mt-1">
                      Status:{" "}
                      <span className={onboarding.isRevoked ? "text-red-300" : "text-yellow-300"}>
                        {onboarding.isRevoked ? "Revoked" : onboarding.onboardingStatus}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">EIN last4: ••••{onboarding.taxIdLast4}</div>
                    {onboarding.isRevoked && onboarding.revokedReason && (
                      <div className="text-xs text-slate-400 mt-1">Reason: {onboarding.revokedReason}</div>
                    )}
                  </div>
                  <button
                    onClick={refresh}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 hover:border-cyan-500/60"
                  >
                    Refresh
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
                  <h2 className="font-semibold mb-2">Required Documents</h2>
                  {missingDocs.length > 0 ? (
                    <div className="text-sm text-red-200">Missing: {missingDocs.join(", ")}</div>
                  ) : (
                    <div className="text-sm text-green-200">All required documents uploaded.</div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocUpload
                    title="Letter of Good Operation Agreement"
                    currentUri={onboarding.letterOfGoodOperationUri}
                    disabled={onboarding.isRevoked || uploading !== null}
                    uploading={uploading === "LETTER_OF_GOOD_OPERATION"}
                    onUpload={(file) => uploadDoc("LETTER_OF_GOOD_OPERATION", file)}
                  />
                  <DocUpload
                    title="Articles of Incorporation"
                    currentUri={onboarding.articlesOfIncorporationUri}
                    disabled={onboarding.isRevoked || uploading !== null}
                    uploading={uploading === "ARTICLES_OF_INCORPORATION"}
                    onUpload={(file) => uploadDoc("ARTICLES_OF_INCORPORATION", file)}
                  />
                </div>

                {onboarding.isRevoked && (
                  <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-200">
                    This onboarding has been revoked. Document uploads are disabled.
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DocUpload({
  title,
  currentUri,
  disabled,
  uploading,
  onUpload,
}: {
  title: string;
  currentUri: string | null;
  disabled: boolean;
  uploading: boolean;
  onUpload: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const url = currentUri ? toGateway(currentUri) : null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-slate-400 mt-1">
        {currentUri ? (
          <a className="underline text-cyan-300" href={url || "#"} target="_blank" rel="noreferrer">
            View uploaded document
          </a>
        ) : (
          "Not uploaded yet"
        )}
      </div>
      <div className="mt-3">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          disabled={disabled}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100 disabled:opacity-50"
        />
      </div>
      <button
        disabled={disabled || !file}
        onClick={() => onUpload(file)}
        className="mt-3 w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold disabled:opacity-50"
      >
        {uploading ? "Uploading…" : currentUri ? "Replace upload" : "Upload"}
      </button>
    </div>
  );
}


