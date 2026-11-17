"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const sizes = [10, 50, 100, 500] as const;
type Format = "Code 128" | "QR" | "Both";

function checkDigit(value: string) {
  let sum = 0;
  for (let i = 0; i < value.length; i++) sum += value.charCodeAt(i) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

export default function BarcodeRegistryPage() {
  const [entity, setEntity] = useState("");
  const [custodian, setCustodian] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState<number>(50);
  const [format, setFormat] = useState<Format>("Both");
  const [accepted, setAccepted] = useState(false);
  const [preview, setPreview] = useState(false);

  // Preview IDs are deliberately non-issuable. Production IDs must be reserved
  // atomically by the server after verified payment, never in browser state.
  const ids = useMemo(() => {
    return Array.from({ length: quantity }, (_, i) => {
      const base = `DEMO-SEQ-2026-0000-${String(i + 1).padStart(4, "0")}`;
      return `${base}-${checkDigit(base)}`;
    });
  }, [quantity]);

  function exportPreview() {
    const rows = [
      ["Sequence ID", "Entity", "Custodian", "Format", "Status"].join(","),
      ...ids.map((id) => [id, entity, custodian, format, "DEMO_NOT_ISSUED"]
        .map((value) => `"${value.replace(/"/g, '""')}"`).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "barcode-registry-preview.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const valid = entity.trim() && custodian.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard" className="text-sm text-cyan-300 hover:underline">← Back to dashboard</Link>
        <header className="rounded-2xl border border-cyan-800/50 bg-slate-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">TROOTHHURTZ · Internal administration</p>
          <h1 className="mt-2 text-3xl font-bold">Client Barcode Registry & Certificates</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Prepare a private identifier allocation and preview the certificate clients will receive after purchase.
            Payment, permanent assignment, certificate signing, account delivery and verification are not enabled yet.
          </p>
          <p className="mt-3 inline-block rounded-md border border-amber-600/60 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
            Preview only · No purchases or identifiers issued
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">1. Client and sequence details</h2>
            <label className="block text-sm">Purchasing entity legal name
              <input value={entity} onChange={(e) => { setEntity(e.target.value); setPreview(false); }} maxLength={160} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" placeholder="Legal business or trust name" />
            </label>
            <label className="block text-sm">Authorized administrator and title
              <input value={custodian} onChange={(e) => { setCustodian(e.target.value); setPreview(false); }} maxLength={160} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" placeholder="Name and title" />
            </label>
            <label className="block text-sm">Administrator email
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setPreview(false); }} maxLength={254} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" placeholder="admin@example.com" />
            </label>
            <fieldset>
              <legend className="mb-2 text-sm">Sequence quantity</legend>
              <div className="grid grid-cols-4 gap-2">
                {sizes.map((size) => <button type="button" key={size} onClick={() => { setQuantity(size); setPreview(false); }} className={`rounded-lg border p-3 text-sm ${quantity === size ? "border-emerald-400 bg-emerald-900/40" : "border-slate-600"}`}>{size}</button>)}
              </div>
            </fieldset>
            <label className="block text-sm">Requested barcode format
              <select value={format} onChange={(e) => { setFormat(e.target.value as Format); setPreview(false); }} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3">
                <option>Code 128</option><option>QR</option><option>Both</option>
              </select>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setPreview(false); }} className="mt-1" />
              I understand these are proposed private, non-GS1 identifiers for internal use only, not UPC/EAN retail identifiers for third-party marketplaces.
            </label>
            <button type="button" disabled={!valid || !accepted} onClick={() => setPreview(true)} className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Generate certificate preview</button>
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">2. Certificate preview</h2>
            {preview ? (
              <>
                <div id="certificate-preview" className="space-y-5 rounded-xl border-4 border-amber-500 bg-amber-50 p-7 text-center text-slate-900">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">TROOTHHURTZ Private Registry</div>
                  <h3 className="font-serif text-3xl font-bold">Certificate of Sequence Allocation</h3>
                  <div className="text-sm font-bold text-rose-700">SAMPLE · NOT ISSUED · NOT VALID</div>
                  <p className="text-sm">Prepared for</p>
                  <p className="break-words font-serif text-2xl font-bold">{entity}</p>
                  <p className="break-words text-sm">Authorized custodian: {custodian}</p>
                  <div className="rounded-lg bg-slate-900 p-4 font-mono text-xs text-white">
                    <p className="text-amber-300">Preview range · {quantity} identifiers</p>
                    <p className="mt-2 break-all">{ids[0]}</p><p>through</p><p className="break-all">{ids[ids.length - 1]}</p>
                  </div>
                  <p className="text-xs">Requested format: {format}</p>
                  <p className="text-xs">PRIVATE INTERNAL USE ONLY · NON-GS1</p>
                  <p className="text-xs text-slate-600">No certificate number, signature, ownership rights, payment confirmation or permanent reservation has been issued.</p>
                </div>
                <button type="button" onClick={exportPreview} className="w-full rounded-lg border border-cyan-600 px-4 py-3 text-sm font-semibold text-cyan-200">Download sample sequence CSV</button>
                <p className="text-xs text-slate-400">Certificate PDF, actual Code 128/QR rendering and client delivery will be enabled with the issuance backend. This preview does not generate scannable codes.</p>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-600 p-10 text-center text-sm text-slate-400">Enter client information and accept the disclosure to generate a clearly marked sample certificate.</div>
            )}
          </section>
        </div>
        <p className="text-xs text-slate-400">Production prerequisites: authenticated client ownership, durable registry with unique constraints, payment confirmation webhook, audited issuance, standards-compliant barcode encoding, signed PDF and verification endpoint.</p>
      </div>
    </main>
  );
}
