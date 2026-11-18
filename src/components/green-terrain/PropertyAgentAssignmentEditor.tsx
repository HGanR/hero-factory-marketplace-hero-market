"use client";
import { useEffect, useState } from "react";
type NPC = { npcId: string; name: string; isActive: boolean };
type Placement = { elementKey: string; glbUrl: string };
type Assignment = { agentId: string; status: "published" | "unlisted" } | null;
/** Admin-only editor. Server rechecks all world, building and agent permissions. */
export default function PropertyAgentAssignmentEditor({ worldId }: { worldId: string }) {
  const [buildings, setBuildings] = useState<Placement[]>([]);
  const [agents, setAgents] = useState<NPC[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState<"published" | "unlisted">("unlisted");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setBuildingId(""); setAgentId(""); setStatus("unlisted");
    Promise.all([
      fetch(`/api/admin/troo-world/placements?worldId=${encodeURIComponent(worldId)}`, { credentials: "include", cache: "no-store" }).then(r => { if (!r.ok) throw new Error("Unable to load buildings"); return r.json(); }),
      fetch(`/api/admin/troo-world/npcs?worldId=${encodeURIComponent(worldId)}`, { credentials: "include", cache: "no-store" }).then(r => { if (!r.ok) throw new Error("Unable to load agents"); return r.json(); }),
    ]).then(([p, n]) => {
      if (!active) return;
      setBuildings((p.placements ?? []).filter((v: Placement) => v.elementKey && (v.glbUrl?.endsWith(".glb") || v.glbUrl?.startsWith("procedural:"))));
      setAgents((n.npcs ?? []).filter((v: NPC) => v.isActive));
    }).catch(e => { if (active) setNotice(String(e.message)); });
    return () => { active = false; };
  }, [worldId]);
  useEffect(() => {
    let active = true;
    setAgentId(""); setStatus("unlisted"); setNotice("");
    if (!buildingId) return;
    fetch(`/api/admin/green-terrain/assignments?worldId=${encodeURIComponent(worldId)}&buildingId=${encodeURIComponent(buildingId)}`, { credentials: "include", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error("Unable to load assignment"); return r.json(); })
      .then((data: { assignment: Assignment }) => {
        if (!active) return;
        if (data.assignment) { setAgentId(data.assignment.agentId); setStatus(data.assignment.status); }
      }).catch(e => { if (active) setNotice(String(e.message)); });
    return () => { active = false; };
  }, [worldId, buildingId]);
  async function save() {
    if (!buildingId || !agentId) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/green-terrain/assignments", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, buildingId, agentId, source: "npc", status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save assignment");
      setNotice("Assignment saved");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  return <details style={{ position: "absolute", top: 110, right: 18, zIndex: 80, background: "#0d1929", color: "#fff", padding: 12, borderRadius: 10, width: 290, maxWidth: "90vw" }}>
    <summary style={{ cursor: "pointer", fontWeight: 700 }}>Assign Property Agent</summary>
    <label style={{ display: "block", marginTop: 12 }}>Building
      <select aria-label="Building" value={buildingId} onChange={e => setBuildingId(e.target.value)} style={{ display: "block", width: "100%", color: "#f8fafc", background: "#17263d", border: "1px solid #64748b", borderRadius: 6, padding: 7, marginTop: 4 }}>
        <option value="">Select a building</option>{buildings.map(b => <option key={b.elementKey} value={b.elementKey}>{b.elementKey}</option>)}
      </select>
    </label>
    <label style={{ display: "block", marginTop: 12 }}>Active NPC
      <select aria-label="Active NPC" value={agentId} onChange={e => setAgentId(e.target.value)} style={{ display: "block", width: "100%", color: "#f8fafc", background: "#17263d", border: "1px solid #64748b", borderRadius: 6, padding: 7, marginTop: 4 }}>
        <option value="">Select an agent</option>{agents.map(a => <option key={a.npcId} value={a.npcId}>{a.name}</option>)}
      </select>
    </label>
    <label style={{ display: "block", marginTop: 12 }}>Listing
      <select aria-label="Listing status" value={status} onChange={e => setStatus(e.target.value as "published" | "unlisted")} style={{ display: "block", width: "100%", color: "#f8fafc", background: "#17263d", border: "1px solid #64748b", borderRadius: 6, padding: 7, marginTop: 4 }}>
        <option value="unlisted">Unlisted (hidden)</option><option value="published">Published (For Sale / Lease)</option>
      </select>
    </label>
    <button type="button" disabled={busy || !buildingId || !agentId} onClick={save} style={{ marginTop: 12, padding: "8px 12px", background: "#e53e3e", borderRadius: 8, color: "#fff" }}>{busy ? "Saving…" : "Save Assignment"}</button>
    {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
  </details>;
}
