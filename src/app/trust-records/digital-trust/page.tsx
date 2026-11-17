"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, LockKeyhole, Fingerprint, FileCheck2, Landmark, ArrowRight, HardDrive, Scale, RotateCcw } from "lucide-react";

const stages = [
  { title: "Trust instrument", detail: "Execute and retain the governing document under applicable law." },
  { title: "Official recordation", detail: "Attach applicable agency filing evidence when required." },
  { title: "Witness / notary evidence", detail: "Associate independently verified signatures or attestations." },
  { title: "Publication, if required", detail: "Document jurisdiction-specific notice requirements." },
];
const pillars = [
  { title: "Private trust records", detail: "Declarations, beneficiary schedules and certificates belong in a protected vault.", icon: LockKeyhole },
  { title: "Cryptographic evidence", detail: "Compare a local document fingerprint against a separately authenticated record.", icon: Fingerprint },
  { title: "Trustee governance", detail: "Track responsible parties, succession and approvals without exposing secrets.", icon: Landmark },
];
export default function DigitalTrustPage() {
  const [stage, setStage] = useState(0);
  const [fileResult, setFileResult] = useState<{ name: string; hash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function fingerprint(file?: File) {
    if (!file) return;
    setBusy(true);
    setFileResult(null);
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      setFileResult({ name: file.name, hash });
    } finally { setBusy(false); }
  }
  return (
    <div className="min-h-screen rounded-3xl border border-[#ae8436]/30 bg-[#08090b] text-[#f4eee1] shadow-2xl overflow-hidden">
      <div className="relative overflow-hidden px-5 py-7 sm:px-10 sm:py-12" style={{ backgroundImage: "radial-gradient(ellipse at 75% 20%, rgba(212,175,55,.15), transparent 45%), linear-gradient(rgba(212,175,55,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,.035) 1px, transparent 1px)", backgroundSize: "auto, 42px 42px, 42px 42px" }}>
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-[#d4af37]/20 pb-5">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-[#d4af37]/50 bg-[#d4af37]/10 p-3"><ShieldCheck className="h-6 w-6 text-[#e8c66b]" /></div><div><p className="text-xs uppercase tracking-[.24em] text-[#d4af37]">TROOTHHURTZ TRUST</p><p className="font-serif text-xl font-semibold">Digital Trust Infrastructure</p></div></div>
          <Link href="/trust-records" className="rounded-full border border-[#d4af37]/45 px-5 py-2 text-sm text-[#f0d78e] transition hover:bg-[#d4af37]/10">Return to Trust Records</Link>
        </div>
        <div className="grid items-center gap-10 py-12 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[.14em] text-[#f2d88a]">Private instruments · Verifiable evidence</p>
            <h1 className="max-w-2xl font-serif text-5xl font-semibold leading-[1.08] sm:text-6xl">Your trust remains <span className="text-[#e6bd58]">private.</span><br />Its proof remains <span className="text-[#e6bd58]">verifiable.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#bcb5a9]">Explore a dual-rail approach to statutory trust records and cryptographic attestations. Legal instruments govern; digital fingerprints provide supporting integrity evidence.</p>
            <div className="mt-7 flex flex-wrap gap-3"><a href="#trust-workflow" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f1d47e] to-[#bd8b30] px-5 py-3 font-semibold text-[#171107] hover:brightness-110">Explore the workflow <ArrowRight size={17}/></a><a href="#document-fingerprint" className="rounded-xl border border-[#d4af37]/45 px-5 py-3 text-[#f0d78e] hover:bg-[#d4af37]/10">Document fingerprint</a></div>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-[#d4af37]/40 bg-gradient-to-br from-[#1b1a16] to-[#090a0c] p-6 text-center shadow-[0_0_65px_rgba(212,175,55,.13)]">
            <div className="flex justify-between gap-2 border-b border-[#d4af37]/20 pb-4 text-left text-xs uppercase tracking-widest text-[#d4af37]"><span>Soulbound authority</span><span>Concept</span></div>
            <div className="relative mx-auto my-8 flex aspect-square max-w-[235px] items-center justify-center rounded-full border border-dashed border-[#d4af37]/50 shadow-[0_0_65px_rgba(212,175,55,.16)]">
              <div className="absolute inset-4 rounded-full border border-[#d4af37]/35" />
              <div className="flex h-[73%] w-[73%] flex-col items-center justify-center rounded-full border-4 border-[#e1bb5c] bg-gradient-to-br from-[#493519] via-[#17130d] to-[#070808] shadow-[inset_0_0_30px_rgba(212,175,55,.17),0_0_35px_rgba(212,175,55,.22)]"><ShieldCheck className="mb-3 h-14 w-14 text-[#f3d77e]"/><span className="font-serif text-2xl font-bold tracking-wide text-[#f1d47e]">DIGITAL</span><span className="text-xs font-semibold tracking-[.38em] text-[#e8c66b]">TRUST</span></div>
            </div>
            <p className="font-serif text-xl text-[#f1d47e]">Soulbound Trust NFT</p><p className="mt-2 text-xs text-[#aaa395]">Visual concept only · No token minted or verified</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{pillars.map(p => <div key={p.title} className="rounded-2xl border border-[#d4af37]/20 bg-[#161512]/85 p-5"><p.icon className="mb-4 h-7 w-7 text-[#e1bb5c]"/><h2 className="font-serif text-xl font-semibold">{p.title}</h2><p className="mt-2 text-sm leading-6 text-[#b9b1a2]">{p.detail}</p></div>)}</div>
      </div>
      <div id="trust-workflow" className="border-t border-[#d4af37]/20 px-5 py-10 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-[#d4af37]">Trustee & counsel workspace</p><h2 className="mt-2 font-serif text-3xl">Four-stage evidence workflow</h2><p className="mt-2 max-w-2xl text-sm text-[#b9b1a2]">Interactive demonstration only. Completing stages here does not sign documents, publish notices, or change legal status.</p></div><button onClick={() => setStage(0)} className="inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/35 px-4 py-2 text-sm text-[#e6c87c]"><RotateCcw size={15}/> Reset demo</button></div>
        <div className="mt-7 grid gap-3 md:grid-cols-4">{stages.map((s,i)=><button key={s.title} onClick={()=>setStage(i+1)} className={`rounded-xl border p-5 text-left transition hover:border-[#d4af37] ${stage>=i+1?"border-[#d4af37]/70 bg-[#d4af37]/10":"border-[#d4af37]/20 bg-[#131313]"}`}><span className="text-xs font-mono text-[#d4af37]">0{i+1} · {stage>=i+1?"REVIEWED":"NOT REVIEWED"}</span><h3 className="mt-3 font-semibold">{s.title}</h3><p className="mt-2 text-xs leading-5 text-[#b9b1a2]">{s.detail}</p></button>)}</div>
        <p className="mt-4 text-xs text-[#a9a092]">Stage selection is local display state, not an authorization, signature or statutory-compliance determination.</p>
      </div>
      <div id="document-fingerprint" className="grid gap-8 border-t border-[#d4af37]/20 bg-[#10100f] px-5 py-10 sm:px-10 lg:grid-cols-2">
        <div><p className="text-xs uppercase tracking-[.2em] text-[#d4af37]">Local privacy utility</p><h2 className="mt-2 font-serif text-3xl">Document fingerprint</h2><p className="mt-3 text-sm leading-7 text-[#b9b1a2]">Generate a SHA-256 fingerprint in your browser. The selected file is not uploaded by this utility. A fingerprint alone does not establish authenticity, notarization, ownership or an on-chain match.</p><div className="mt-5 flex items-center gap-3 text-xs text-[#e1bb5c]"><HardDrive size={18}/> USB authentication and encrypted vault access are planned separately; not enabled here.</div></div>
        <div className="rounded-2xl border border-[#d4af37]/25 bg-[#090909] p-6"><label htmlFor="trust-fingerprint-file" className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#d4af37]/40 p-8 text-center hover:bg-[#d4af37]/5"><FileCheck2 className="mb-3 h-9 w-9 text-[#d4af37]"/><span className="font-medium">Choose a document to fingerprint</span><span className="mt-2 text-xs text-[#a9a092]">Processed locally · No file upload</span></label><input id="trust-fingerprint-file" className="sr-only" type="file" onChange={e=>void fingerprint(e.target.files?.[0])}/>{busy?<p className="mt-4 text-sm">Calculating…</p>:null}{fileResult?<div className="mt-5 rounded-lg bg-[#1c1a14] p-4"><p className="break-all text-sm">{fileResult.name}</p><p className="mt-2 break-all font-mono text-xs text-[#e6c87c]">{fileResult.hash}</p><p className="mt-3 text-xs text-[#b9b1a2]">Fingerprint calculated. No registry comparison performed.</p></div>:null}</div>
      </div>
      <footer className="border-t border-[#d4af37]/20 px-5 py-6 text-xs text-[#a9a092] sm:px-10"><div className="flex items-center gap-2"><Scale size={15}/> Educational preview. Trust validity and filing requirements depend on applicable law and independently verified records.</div></footer>
    </div>
  );
}
