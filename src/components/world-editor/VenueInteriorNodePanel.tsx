"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { VenueInteriorNode } from "@/types/venue-nodes";
import type { Placement } from "@/lib/world-engine/chunk-utils";
import { worldToNode } from "@/lib/world-editor/venue-node-transforms";
import { getNodeTypePreset } from "@/lib/venue-nodes/node-type-presets";
import { VenueNodeCreateModal } from "./VenueNodeCreateModal";
import { VenueNodeEditModal } from "./VenueNodeEditModal";


const ACCESS_LABELS: Record<string, string> = {
  public: "Public",
  private: "Private",
  token_gated: "Token Gated",
  owner_only: "Owner Only",
};

interface VenueInteriorNodePanelProps {
  worldId: string;
  placementId: string;
  placement?: Placement | null;
  placementSummary?: { assetId?: string; position?: number[] };
  assetSummary?: { name?: string; category?: string };
  /** Nodes from parent (when in editor with layer). If not provided, panel fetches. */
  nodes?: VenueInteriorNode[];
  loading?: boolean;
  selectedVenueNodeId?: string | null;
  onSelectVenueNode?: (id: string | null) => void;
  /** World position from "Place Visually" click; panel opens create modal with converted relative pos */
  pendingVenueNodeWorldPosition?: [number, number, number] | null;
  onClearPendingPosition?: () => void;
  placingVenueNode?: boolean;
  onPlaceVisually?: () => void;
  onCancelPlaceVisually?: () => void;
  movingVenueNodeId?: string | null;
  onMoveNode?: (node: VenueInteriorNode) => void;
  onCancelMoveNode?: () => void;
  onRefresh?: () => void;
  embedded?: boolean;
}

export function VenueInteriorNodePanel({
  worldId,
  placementId,
  placement,
  placementSummary,
  assetSummary,
  nodes: nodesProp,
  loading: loadingProp,
  selectedVenueNodeId,
  onSelectVenueNode,
  pendingVenueNodeWorldPosition,
  onClearPendingPosition,
  placingVenueNode,
  onPlaceVisually,
  onCancelPlaceVisually,
  movingVenueNodeId,
  onMoveNode,
  onCancelMoveNode,
  onRefresh,
  embedded,
}: VenueInteriorNodePanelProps) {
  const [nodesLocal, setNodesLocal] = useState<VenueInteriorNode[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nodes = nodesProp ?? nodesLocal;
  const loading = loadingProp ?? loadingLocal;
  const [createOpen, setCreateOpen] = useState(false);
  const [editNode, setEditNode] = useState<VenueInteriorNode | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNodes = useCallback(async () => {
    if (!worldId || !placementId) {
      setNodesLocal([]);
      setLoadingLocal(false);
      return;
    }
    setLoadingLocal(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/worlds/${worldId}/venue-nodes?placementId=${encodeURIComponent(placementId)}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load nodes");
        setNodesLocal([]);
        return;
      }
      setNodesLocal(data.nodes ?? []);
    } catch {
      setError("Failed to load nodes");
      setNodesLocal([]);
    } finally {
      setLoadingLocal(false);
    }
  }, [worldId, placementId]);

  useEffect(() => {
    if (nodesProp === undefined) fetchNodes();
  }, [nodesProp, fetchNodes]);

  const initialPosition = useMemo(() => {
    if (!pendingVenueNodeWorldPosition || !placement) return undefined;
    const { posX, posY, posZ } = worldToNode(
      pendingVenueNodeWorldPosition[0],
      pendingVenueNodeWorldPosition[1],
      pendingVenueNodeWorldPosition[2],
      placement
    );
    return { posX, posY, posZ };
  }, [pendingVenueNodeWorldPosition, placement]);

  async function handleToggleActive(node: VenueInteriorNode) {
    if (togglingId) return;
    setTogglingId(node.id);
    try {
      const res = await fetch(`/api/worlds/${worldId}/venue-nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !node.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update");
        return;
      }
      toast.success(node.isActive ? "Node deactivated" : "Node activated");
      fetchNodes();
      onRefresh?.();
    } catch {
      toast.error("Failed to update");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(node: VenueInteriorNode) {
    if (deletingId) return;
    if (!confirm(`Delete "${node.title}"? This cannot be undone.`)) return;
    setDeletingId(node.id);
    try {
      const res = await fetch(`/api/worlds/${worldId}/venue-nodes/${node.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete");
        return;
      }
      toast.success("Node deleted");
      setEditNode(null);
      fetchNodes();
      onRefresh?.();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  const wrapperStyle: React.CSSProperties = embedded
    ? { width: 300, fontFamily: "system-ui, sans-serif" }
    : {
        position: "absolute",
        top: 60,
        left: 224,
        width: 280,
        maxHeight: "calc(100vh - 140px)",
        background: "rgba(10,20,40,0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(42,111,189,0.5)",
        borderRadius: 12,
        padding: 12,
        overflowY: "auto",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
      };

  return (
    <div style={wrapperStyle}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: "#e0f4ff", fontSize: 13 }}>
          Venue Interior Nodes
        </div>
        <div style={{ fontSize: 10, color: "rgba(224,244,255,0.6)", marginTop: 4 }}>
          Live-room anchors for voice, chat, events. Add nodes inside this venue.
        </div>
        {assetSummary?.name && (
          <div style={{ fontSize: 10, color: "rgba(224,244,255,0.5)", marginTop: 2 }}>
            Venue: {assetSummary.name}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "rgba(42,111,189,0.3)",
            border: "1px solid rgba(42,111,189,0.5)",
            borderRadius: 8,
            color: "#a0d4ff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Interior Node
        </button>
        <button
          type="button"
          onClick={placingVenueNode ? onCancelPlaceVisually : onPlaceVisually}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: placingVenueNode ? "rgba(78,205,196,0.4)" : "rgba(78,205,196,0.2)",
            border: "1px solid rgba(78,205,196,0.5)",
            borderRadius: 8,
            color: "#a0e8e4",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {placingVenueNode ? "Cancel place" : "Place Visually"}
        </button>
      </div>

      {error && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 8 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "rgba(224,244,255,0.5)", fontSize: 12 }}>Loading...</div>
      ) : nodes.length === 0 ? (
        <div style={{ color: "rgba(224,244,255,0.5)", fontSize: 12, padding: "12px 0" }}>
          No interior nodes yet. Add one to create a live room for voice, chat, or events.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {nodes.map((n) => (
            <div
              key={n.id}
              onClick={() => onSelectVenueNode?.(n.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectVenueNode?.(n.id)}
              style={{
                padding: "8px 10px",
                background: selectedVenueNodeId === n.id ? "rgba(42,111,189,0.4)" : "rgba(20,40,80,0.6)",
                border: selectedVenueNodeId === n.id ? "1px solid rgba(42,111,189,0.7)" : "1px solid rgba(42,111,189,0.3)",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                cursor: onSelectVenueNode ? "pointer" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <span style={{ fontWeight: 600, color: "#e0f4ff", fontSize: 12 }}>{n.title}</span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: n.isActive ? "rgba(16,185,129,0.3)" : "rgba(148,163,184,0.3)",
                    color: n.isActive ? "#6ee7b7" : "#94a3b8",
                  }}
                >
                  {n.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(224,244,255,0.6)" }}>
                {getNodeTypePreset(n.nodeType).label} • {ACCESS_LABELS[n.accessType] ?? n.accessType}
              </div>
              <div style={{ fontSize: 9, color: "rgba(224,244,255,0.5)", fontStyle: "italic" }}>
                {getNodeTypePreset(n.nodeType).description}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {onMoveNode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      movingVenueNodeId === n.id ? onCancelMoveNode?.() : onMoveNode(n);
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: 10,
                      background: movingVenueNodeId === n.id ? "rgba(78,205,196,0.4)" : "rgba(78,205,196,0.2)",
                      border: "1px solid rgba(78,205,196,0.4)",
                      borderRadius: 4,
                      color: "#a0e8e4",
                      cursor: "pointer",
                    }}
                  >
                    {movingVenueNodeId === n.id ? "Cancel move" : "Move Node"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditNode(n); }}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    background: "rgba(42,111,189,0.4)",
                    border: "1px solid rgba(42,111,189,0.5)",
                    borderRadius: 4,
                    color: "#a0d4ff",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggleActive(n); }}
                  disabled={togglingId === n.id}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    background: "rgba(16,185,129,0.2)",
                    border: "1px solid rgba(16,185,129,0.4)",
                    borderRadius: 4,
                    color: "#6ee7b7",
                    cursor: togglingId === n.id ? "wait" : "pointer",
                  }}
                >
                  {togglingId === n.id ? "..." : n.isActive ? "Deactivate" : "Activate"}
                </button>
                <Link
                  href={`/meet/${encodeURIComponent(n.roomId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    background: "rgba(78,205,196,0.2)",
                    border: "1px solid rgba(78,205,196,0.4)",
                    borderRadius: 4,
                    color: "#a0e8e4",
                    textDecoration: "none",
                  }}
                >
                  Open Room
                </Link>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(n); }}
                  disabled={deletingId === n.id}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    background: "rgba(239,68,68,0.2)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    borderRadius: 4,
                    color: "#fca5a5",
                    cursor: deletingId === n.id ? "wait" : "pointer",
                  }}
                >
                  {deletingId === n.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(createOpen || initialPosition) && (
        <VenueNodeCreateModal
          worldId={worldId}
          placementId={placementId}
          initialPosition={initialPosition}
          onCreated={() => {
            setCreateOpen(false);
            onClearPendingPosition?.();
            fetchNodes();
            onRefresh?.();
            toast.success("Interior node created");
          }}
          onCancel={() => {
            setCreateOpen(false);
            onClearPendingPosition?.();
          }}
        />
      )}

      {editNode && (
        <VenueNodeEditModal
          worldId={worldId}
          node={editNode}
          onSaved={() => {
            setEditNode(null);
            fetchNodes();
            onRefresh?.();
            toast.success("Node updated");
          }}
          onCancel={() => setEditNode(null)}
        />
      )}
    </div>
  );
}
