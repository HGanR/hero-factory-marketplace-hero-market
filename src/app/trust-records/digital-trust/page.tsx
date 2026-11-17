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
    <div className="min-h-screen rounded-3xl border border-[#d4af37]/30 bg-[#08090d] text-[#f1f5f9] shadow-2xl overflow-hidden">
      <div className="relative overflow-hidden px-5 py-7 sm:px-10 sm:py-12" style={{ backgroundImage: "radial-gradient(ellipse at 75% 20%, rgba(255,205,65,.16), transparent 45%), linear-gradient(rgba(255,205,65,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,205,65,.035) 1px, transparent 1px)", backgroundSize: "auto, 42px 42px, 42px 42px" }}>
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-[#ffd95b]/20 pb-5">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-[#ffd95b]/50 bg-[#ffd95b]/10 p-3"><ShieldCheck className="h-6 w-6 text-[#ffe17d]" /></div><div><p className="text-xs uppercase tracking-[.24em] text-[#ffd95b]">TROOTHHURTZ TRUST</p><p className="font-serif text-xl font-semibold">Digital Trust Infrastructure</p></div></div>
          <Link href="/trust-records" className="rounded-full border border-[#ffd95b]/45 px-5 py-2 text-sm text-[#fff0b3] transition hover:bg-[#ffd95b]/10">Return to Trust Records</Link>
        </div>
        <div className="grid items-center gap-10 py-12 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#ffd95b]/35 bg-[#ffd95b]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[.14em] text-[#fff0b3]">Private instruments · Verifiable evidence</p>
            <h1 className="max-w-2xl font-serif text-5xl font-semibold leading-[1.08] sm:text-6xl">Your trust remains <span className="text-[#ffe17d]">private.</span><br />Its proof remains <span className="text-[#ffe17d]">verifiable.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#ded5bc]">Explore a dual-rail approach to statutory trust records and cryptographic attestations. Legal instruments govern; digital fingerprints provide supporting integrity evidence.</p>
            <div className="mt-7 flex flex-wrap gap-3"><a href="#trust-workflow" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#ffd95b] to-[#b8860b] px-5 py-3 font-semibold text-[#161008] hover:brightness-110">Explore the workflow <ArrowRight size={17}/></a><a href="#document-fingerprint" className="rounded-xl border border-[#ffd95b]/45 px-5 py-3 text-[#fff0b3] hover:bg-[#ffd95b]/10">Document fingerprint</a></div>
          </div>
          <div ref={cardRef} onMouseMove={handleCardMove} onMouseLeave={resetCard} className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-[#f4cc59]/70 bg-gradient-to-br from-[#241b0a] via-[#15120c] to-[#080a10] p-6 text-center shadow-[0_0_28px_rgba(255,195,39,.38),0_0_75px_rgba(212,175,55,.19)] transition-transform duration-200 ease-out motion-reduce:transform-none" style={{ transform: tilt.active ? `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale3d(1.02,1.02,1.02)` : "perspective(1000px) rotateX(0deg) rotateY(0deg)", transformStyle: "preserve-3d", willChange: "transform" }}>
            <div ref={glareRef} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[2rem] transition-opacity duration-300" style={{ opacity: tilt.active ? 1 : 0, background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,214,83,.28), transparent 65%)` }} />
            <div className="relative flex justify-between gap-2 border-b border-[#f4cc59]/35 pb-4 text-left text-xs uppercase tracking-widest text-[#ffe17d]"><span>Soulbound authority</span><span>Concept</span></div>
            <div className="relative my-6 flex items-center justify-center overflow-hidden rounded-xl border border-[#d4af37]/30 bg-[#080a10]/80 py-8">
              <div aria-hidden="true" className="trust-gold-glow pointer-events-none absolute h-36 w-36 rounded-full bg-[#f9cb43]/30 blur-2xl" />
              <svg className="relative z-10 h-44 w-44 drop-shadow-[0_0_14px_rgba(255,203,50,.65)]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animated gold cryptographic seal with rotating rings and crystalline core">
                <circle cx="100" cy="100" r="88" stroke="#FFD95B" strokeWidth="2" strokeDasharray="6 6" strokeOpacity=".95" className="trust-gold-ring" />
                <polygon points="100,22 168,61 168,139 100,178 32,139 32,61" stroke="#F9E79F" strokeWidth="2" strokeOpacity=".85" className="trust-gold-hex" />
                <circle cx="100" cy="100" r="54" fill="#0B0F17" stroke="#FFD95B" strokeWidth="2.5" />
                <polygon points="100,58 128,100 100,116 72,100" fill="url(#digitalTrustGoldGradient)" />
                <polygon points="100,122 128,106 100,144 72,106" fill="#D4AF37" fillOpacity=".95" />
                <defs><linearGradient id="digitalTrustGoldGradient" x1="72" y1="58" x2="128" y2="116" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#FFF4B8" /><stop offset="50%" stopColor="#FFD95B" /><stop offset="100%" stopColor="#B8860B" /></linearGradient></defs>
              </svg>
            </div>
            <p className="font-serif text-xl font-semibold text-[#ffe17d] drop-shadow-[0_0_10px_rgba(255,211,68,.65)]">Soulbound Trust NFT</p>
            <p className="mt-2 text-xs text-[#c1b79b]">Visual concept only · No token minted or verified</p>
          </div>
          <style jsx global>{`
            .trust-gold-ring, .trust-gold-hex { transform-box: fill-box; transform-origin: center; }
            .trust-gold-ring { animation: trust-gold-spin 24s linear infinite; }
            .trust-gold-hex { animation: trust-gold-reverse 36s linear infinite; }
            .trust-gold-glow { animation: trust-gold-pulse 3s ease-in-out infinite; }
            @keyframes trust-gold-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes trust-gold-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
            @keyframes trust-gold-pulse { 0%, 100% { opacity: .55; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.12); } }
            @media (prefers-reduced-motion: reduce) { .trust-gold-ring, .trust-gold-hex, .trust-gold-glow { animation: none !important; } }
          `}</style>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{pillars.map(p => <div key={p.title} className="rounded-2xl border border-[#ffd95b]/20 bg-[#16130d]/85 p-5"><p.icon className="mb-4 h-7 w-7 text-[#ffd95b]"/><h2 className="font-serif text-xl font-semibold">{p.title}</h2><p className="mt-2 text-sm leading-6 text-[#b9ad92]">{p.detail}</p></div>)}</div>
      </div>
      <div id="trust-workflow" className="border-t border-[#ffd95b]/20 px-5 py-10 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-[#ffd95b]">Trustee & counsel workspace</p><h2 className="mt-2 font-serif text-3xl">Four-stage evidence workflow</h2><p className="mt-2 max-w-2xl text-sm text-[#b9ad92]">Interactive demonstration only. Completing stages here does not sign documents, publish notices, or change legal status.</p></div><button onClick={() => setStage(0)} className="inline-flex items-center gap-2 rounded-lg border border-[#ffd95b]/35 px-4 py-2 text-sm text-[#ffe17d]"><RotateCcw size={15}/> Reset demo</button></div>
        <div className="mt-7 grid gap-3 md:grid-cols-4">{stages.map((s,i)=><button key={s.title} onClick={()=>setStage(i+1)} className={`rounded-xl border p-5 text-left transition hover:border-[#ffd95b] ${stage>=i+1?"border-[#ffd95b]/70 bg-[#ffd95b]/10":"border-[#ffd95b]/20 bg-[#17140e]"}`}><span className="text-xs font-mono text-[#ffd95b]">0{i+1} · {stage>=i+1?"REVIEWED":"NOT REVIEWED"}</span><h3 className="mt-3 font-semibold">{s.title}</h3><p className="mt-2 text-xs leading-5 text-[#b9ad92]">{s.detail}</p></button>)}</div>
        <p className="mt-4 text-xs text-[#b9ad92]">Stage selection is local display state, not an authorization, signature or statutory-compliance determination.</p>
      </div>
      <div id="document-fingerprint" className="grid gap-8 border-t border-[#ffd95b]/20 bg-[#0d0d0d] px-5 py-10 sm:px-10 lg:grid-cols-2">
        <div><p className="text-xs uppercase tracking-[.2em] text-[#ffd95b]">Local privacy utility</p><h2 className="mt-2 font-serif text-3xl">Document fingerprint</h2><p className="mt-3 text-sm leading-7 text-[#b9ad92]">Generate a SHA-256 fingerprint in your browser. The selected file is not uploaded by this utility. A fingerprint alone does not establish authenticity, notarization, ownership or an on-chain match.</p><div className="mt-5 flex items-center gap-3 text-xs text-[#ffd95b]"><HardDrive size={18}/> USB authentication and encrypted vault access are planned separately; not enabled here.</div></div>
        <div className="rounded-2xl border border-[#ffd95b]/25 bg-[#13110c] p-6"><label htmlFor="trust-fingerprint-file" className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#ffd95b]/40 p-8 text-center hover:bg-[#ffd95b]/5"><FileCheck2 className="mb-3 h-9 w-9 text-[#ffd95b]"/><span className="font-medium">Choose a document to fingerprint</span><span className="mt-2 text-xs text-[#b9ad92]">Processed locally · No file upload</span></label><input id="trust-fingerprint-file" className="sr-only" type="file" onChange={e=>void fingerprint(e.target.files?.[0])}/>{busy?<p className="mt-4 text-sm">Calculating…</p>:null}{fileResult?<div className="mt-5 rounded-lg bg-[#201a0f] p-4"><p className="break-all text-sm">{fileResult.name}</p><p className="mt-2 break-all font-mono text-xs text-[#ffe17d]">{fileResult.hash}</p><p className="mt-3 text-xs text-[#b9ad92]">Fingerprint calculated. No registry comparison performed.</p></div>:null}</div>
      </div>
      <footer className="border-t border-[#ffd95b]/20 px-5 py-6 text-xs text-[#b9ad92] sm:px-10"><div className="flex items-center gap-2"><Scale size={15}/> Educational preview. Trust validity and filing requirements depend on applicable law and independently verified records.</div></footer>
    </div>
  );
}
