"use client";

import { useRef, useState } from "react";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 50, active: false });
  function handleCardMove(event: React.MouseEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    setTilt({ x: ((y - rect.height / 2) / (rect.height / 2)) * -12, y: ((x - rect.width / 2) / (rect.width / 2)) * 12, gx: (x / rect.width) * 100, gy: (y / rect.height) * 100, active: true });
  }
  function resetCard() { setTilt({ x: 0, y: 0, gx: 50, gy: 50, active: false }); }
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
    <div className="min-h-screen rounded-3xl border border-[#0891b2]/30 bg-[#080f23] text-[#f1f5f9] shadow-2xl overflow-hidden">
      <div className="relative overflow-hidden px-5 py-7 sm:px-10 sm:py-12" style={{ backgroundImage: "radial-gradient(ellipse at 75% 20%, rgba(34,211,238,.15), transparent 45%), linear-gradient(rgba(34,211,238,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.035) 1px, transparent 1px)", backgroundSize: "auto, 42px 42px, 42px 42px" }}>
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-[#22d3ee]/20 pb-5">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-[#22d3ee]/50 bg-[#22d3ee]/10 p-3"><ShieldCheck className="h-6 w-6 text-[#67e8f9]" /></div><div><p className="text-xs uppercase tracking-[.24em] text-[#22d3ee]">TROOTHHURTZ TRUST</p><p className="font-serif text-xl font-semibold">Digital Trust Infrastructure</p></div></div>
          <Link href="/trust-records" className="rounded-full border border-[#22d3ee]/45 px-5 py-2 text-sm text-[#a5f3fc] transition hover:bg-[#22d3ee]/10">Return to Trust Records</Link>
        </div>
        <div className="grid items-center gap-10 py-12 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#22d3ee]/35 bg-[#22d3ee]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[.14em] text-[#a5f3fc]">Private instruments · Verifiable evidence</p>
            <h1 className="max-w-2xl font-serif text-5xl font-semibold leading-[1.08] sm:text-6xl">Your trust remains <span className="text-[#67e8f9]">private.</span><br />Its proof remains <span className="text-[#67e8f9]">verifiable.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#cbd5e1]">Explore a dual-rail approach to statutory trust records and cryptographic attestations. Legal instruments govern; digital fingerprints provide supporting integrity evidence.</p>
            <div className="mt-7 flex flex-wrap gap-3"><a href="#trust-workflow" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#2563eb] px-5 py-3 font-semibold text-[#07111e] hover:brightness-110">Explore the workflow <ArrowRight size={17}/></a><a href="#document-fingerprint" className="rounded-xl border border-[#22d3ee]/45 px-5 py-3 text-[#a5f3fc] hover:bg-[#22d3ee]/10">Document fingerprint</a></div>
          </div>
          <div ref={cardRef} onMouseMove={handleCardMove} onMouseLeave={resetCard} className="relative mx-auto w-full max-w-sm rounded-[2rem] border border-[#22d3ee]/40 bg-gradient-to-br from-[#1a2250] to-[#0a1024] p-6 text-center shadow-[0_0_65px_rgba(34,211,238,.13)] transition-transform duration-200 ease-out motion-reduce:transform-none" style={{ transform: tilt.active ? `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale3d(1.02,1.02,1.02)` : "perspective(1000px) rotateX(0deg) rotateY(0deg)", transformStyle: "preserve-3d", willChange: "transform" }}><div ref={glareRef} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[2rem] transition-opacity duration-300" style={{ opacity: tilt.active ? 1 : 0, background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(34,211,238,0.25), transparent 65%)` }} />
            <div className="flex justify-between gap-2 border-b border-[#22d3ee]/20 pb-4 text-left text-xs uppercase tracking-widest text-[#22d3ee]"><span>Soulbound authority</span><span>Concept</span></div>
            <div className="relative mx-auto my-8 flex aspect-square max-w-[235px] items-center justify-center rounded-full border border-dashed border-[#22d3ee]/50 shadow-[0_0_65px_rgba(34,211,238,.16)]">
              <div className="absolute inset-4 rounded-full border border-[#22d3ee]/35" />
              <div className="flex h-[73%] w-[73%] flex-col items-center justify-center rounded-full border-4 border-[#22d3ee] bg-gradient-to-br from-[#193c68] via-[#101a3a] to-[#070e20] shadow-[inset_0_0_30px_rgba(34,211,238,.17),0_0_35px_rgba(34,211,238,.22)]"><ShieldCheck className="mb-3 h-14 w-14 text-[#a5f3fc]"/><span className="font-serif text-2xl font-bold tracking-wide text-[#67e8f9]">DIGITAL</span><span className="text-xs font-semibold tracking-[.38em] text-[#67e8f9]">TRUST</span></div>
            </div>
            <p className="font-serif text-xl text-[#67e8f9]">Soulbound Trust NFT</p><p className="mt-2 text-xs text-[#94a3b8]">Visual concept only · No token minted or verified</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{pillars.map(p => <div key={p.title} className="rounded-2xl border border-[#22d3ee]/20 bg-[#111b38]/85 p-5"><p.icon className="mb-4 h-7 w-7 text-[#22d3ee]"/><h2 className="font-serif text-xl font-semibold">{p.title}</h2><p className="mt-2 text-sm leading-6 text-[#94a3b8]">{p.detail}</p></div>)}</div>
      </div>
      <div id="trust-workflow" className="border-t border-[#22d3ee]/20 px-5 py-10 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-[#22d3ee]">Trustee & counsel workspace</p><h2 className="mt-2 font-serif text-3xl">Four-stage evidence workflow</h2><p className="mt-2 max-w-2xl text-sm text-[#94a3b8]">Interactive demonstration only. Completing stages here does not sign documents, publish notices, or change legal status.</p></div><button onClick={() => setStage(0)} className="inline-flex items-center gap-2 rounded-lg border border-[#22d3ee]/35 px-4 py-2 text-sm text-[#67e8f9]"><RotateCcw size={15}/> Reset demo</button></div>
        <div className="mt-7 grid gap-3 md:grid-cols-4">{stages.map((s,i)=><button key={s.title} onClick={()=>setStage(i+1)} className={`rounded-xl border p-5 text-left transition hover:border-[#22d3ee] ${stage>=i+1?"border-[#22d3ee]/70 bg-[#22d3ee]/10":"border-[#22d3ee]/20 bg-[#101a37]"}`}><span className="text-xs font-mono text-[#22d3ee]">0{i+1} · {stage>=i+1?"REVIEWED":"NOT REVIEWED"}</span><h3 className="mt-3 font-semibold">{s.title}</h3><p className="mt-2 text-xs leading-5 text-[#94a3b8]">{s.detail}</p></button>)}</div>
        <p className="mt-4 text-xs text-[#94a3b8]">Stage selection is local display state, not an authorization, signature or statutory-compliance determination.</p>
      </div>
      <div id="document-fingerprint" className="grid gap-8 border-t border-[#22d3ee]/20 bg-[#0d1530] px-5 py-10 sm:px-10 lg:grid-cols-2">
        <div><p className="text-xs uppercase tracking-[.2em] text-[#22d3ee]">Local privacy utility</p><h2 className="mt-2 font-serif text-3xl">Document fingerprint</h2><p className="mt-3 text-sm leading-7 text-[#94a3b8]">Generate a SHA-256 fingerprint in your browser. The selected file is not uploaded by this utility. A fingerprint alone does not establish authenticity, notarization, ownership or an on-chain match.</p><div className="mt-5 flex items-center gap-3 text-xs text-[#22d3ee]"><HardDrive size={18}/> USB authentication and encrypted vault access are planned separately; not enabled here.</div></div>
        <div className="rounded-2xl border border-[#22d3ee]/25 bg-[#0b1328] p-6"><label htmlFor="trust-fingerprint-file" className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#22d3ee]/40 p-8 text-center hover:bg-[#22d3ee]/5"><FileCheck2 className="mb-3 h-9 w-9 text-[#22d3ee]"/><span className="font-medium">Choose a document to fingerprint</span><span className="mt-2 text-xs text-[#94a3b8]">Processed locally · No file upload</span></label><input id="trust-fingerprint-file" className="sr-only" type="file" onChange={e=>void fingerprint(e.target.files?.[0])}/>{busy?<p className="mt-4 text-sm">Calculating…</p>:null}{fileResult?<div className="mt-5 rounded-lg bg-[#16213f] p-4"><p className="break-all text-sm">{fileResult.name}</p><p className="mt-2 break-all font-mono text-xs text-[#67e8f9]">{fileResult.hash}</p><p className="mt-3 text-xs text-[#94a3b8]">Fingerprint calculated. No registry comparison performed.</p></div>:null}</div>
      </div>
      <footer className="border-t border-[#22d3ee]/20 px-5 py-6 text-xs text-[#94a3b8] sm:px-10"><div className="flex items-center gap-2"><Scale size={15}/> Educational preview. Trust validity and filing requirements depend on applicable law and independently verified records.</div></footer>
    </div>
  );
}
