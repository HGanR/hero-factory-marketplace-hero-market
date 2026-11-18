"use client";
import { useEffect, useState } from "react";
type Listing = { worldId: string; buildingId: string; agent: { npcId: string; name: string; title?: string | null } };
type Message = { role: "visitor" | "agent"; text: string };
export default function PropertyListings({ worldId }: { worldId: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/green-terrain/assignments?worldId=${encodeURIComponent(worldId)}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Listings unavailable")))
      .then(d => { if (active) setListings(d.assignments ?? []); })
      .catch(() => { if (active) setListings([]); });
    return () => { active = false; };
  }, [worldId]);
  useEffect(() => {
    const open = () => {
      if (!listings.length) return;
      setSelected(null);
      setMessages([]);
      setSessionId(null);
      setError("");
    };
    window.addEventListener("green-terrain:open-property-listings", open);
    return () => window.removeEventListener("green-terrain:open-property-listings", open);
  }, [listings]);
  async function send() {
    if (!selected || !input.trim() || busy) return;
    const text = input.trim();
    setMessages(prev => [...prev, { role: "visitor", text }]);
    setInput(""); setBusy(true); setError("");
    try {
      const r = await fetch("/api/green-terrain/property-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, buildingId: selected.buildingId, message: text, sessionId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Chat unavailable");
      if (typeof data.sessionId === "string") setSessionId(data.sessionId);
      setMessages(prev => [...prev, { role: "agent", text: data.response || "Please try again." }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Chat unavailable"); }
    finally { setBusy(false); }
  }
  if (!listings.length && !selected) return null;
  return <div className="absolute bottom-5 right-5 z-30 max-w-[min(340px,90vw)] text-white">
    {!selected ? <div className="rounded-xl border border-amber-400/50 bg-slate-950/90 p-3 shadow-xl">
      <div className="mb-2 text-sm font-bold text-amber-300">Available properties</div>
      <div className="max-h-52 overflow-y-auto space-y-2">{listings.map(item =>
        <button key={item.buildingId} type="button" onClick={() => { setSelected(item); setMessages([]); setSessionId(null); setError(""); }}
          className="block w-full rounded-lg border border-amber-500/40 p-2 text-left text-sm hover:bg-amber-500/20">
          <span className="font-semibold">For Sale / Lease · {item.buildingId}</span>
          <span className="block text-xs text-slate-300">Ask {item.agent.name} about this property</span>
        </button>)}</div>
    </div> : <div className="rounded-xl border border-cyan-400/40 bg-slate-950/95 p-3 shadow-xl">
      <div className="flex justify-between gap-3 border-b border-slate-700 pb-2">
        <div><div className="text-sm font-bold">{selected.buildingId}</div><div className="text-xs text-cyan-300">{selected.agent.name} · Property advisor</div></div>
        <button type="button" aria-label="Close property chat" onClick={() => { setSelected(null); setSessionId(null); }} className="text-slate-300">✕</button>
      </div>
      <div role="log" aria-live="polite" className="my-2 max-h-52 min-h-20 space-y-2 overflow-y-auto text-sm">
        {messages.length === 0 && <p className="text-slate-300">Ask about leasing, purchasing, or bringing your business into this property.</p>}
        {messages.map((m, i) => <p key={i} className={m.role === "visitor" ? "text-cyan-200" : "text-slate-100"}><strong>{m.role === "visitor" ? "You" : selected.agent.name}: </strong>{m.text}</p>)}
      </div>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex gap-2">
        <input aria-label="Property chat message" value={input} onChange={e => setInput(e.target.value)} maxLength={4000} className="min-w-0 flex-1 rounded bg-slate-800 p-2 text-sm" placeholder="Ask a question…" />
        <button type="submit" disabled={busy || !input.trim()} className="rounded bg-cyan-700 px-3 py-2 text-sm disabled:opacity-50">Send</button>
      </form>
    </div>}
  </div>;
}
