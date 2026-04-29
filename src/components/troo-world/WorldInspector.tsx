"use client";

/**
 * WorldInspector — Floating, draggable inspector panel for selected objects.
 * Adapted from sdfsdfsadfs/WorldInspector for hero-market (placements use elementKey).
 *
 * Features:
 *  - Object name / type header
 *  - XYZ position, Y rotation (degrees), scale
 *  - Label (elements), Primary/secondary color
 *  - Scene lighting (ambient, sun)
 *  - Enter building, Delete
 */
import { useState, useRef, useEffect } from "react";

export interface InspectorPlacement {
  kind: "placement";
  elementKey: string;
  name: string;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number; // degrees
  scale: number;
  isBuiltIn: boolean;
  interiorRoute?: string;
}

export interface InspectorElement {
  kind: "element";
  id: number;
  type: string;
  label: string | null;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  scale: number;
  colorHex: number | null;
  color2Hex: number | null;
}

export interface InspectorGround {
  kind: "ground";
  colorHex: number;
}

export type InspectorTarget = InspectorPlacement | InspectorElement | InspectorGround | null;

export interface SceneLighting {
  ambientIntensity: number;
  sunIntensity: number;
  sunAzimuth: number;
  sunElevation: number;
}

interface WorldInspectorProps {
  target: InspectorTarget;
  lighting: SceneLighting;
  onUpdatePosition: (posX: number, posY: number, posZ: number) => void;
  onUpdateRotation: (rotY: number) => void;
  onUpdateScale: (scale: number) => void;
  onUpdateColor: (colorHex: number | null, color2Hex: number | null) => void;
  onUpdateLabel?: (label: string) => void;
  onUpdateLighting: (lighting: SceneLighting) => void;
  onEnterBuilding: (route: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

function hexToColor(hex: number): string {
  return "#" + hex.toString(16).padStart(6, "0");
}
function colorToHex(color: string): number {
  return parseInt(color.replace("#", ""), 16);
}

const ELEMENT_ICONS: Record<string, string> = {
  tree: "🌲",
  street_light: "💡",
  bench: "🪑",
  road_segment: "🛣️",
  crosswalk: "🦓",
  bush: "🌿",
  fountain: "⛲",
};

const ELEMENT_LABELS: Record<string, string> = {
  tree: "Tree",
  street_light: "Street Light",
  bench: "Bench",
  road_segment: "Road Segment",
  crosswalk: "Crosswalk",
  bush: "Bush",
  fountain: "Fountain",
};

function placementToRoute(elementKey: string): string {
  if (elementKey.includes("nexus")) return "/modeling?enter=nexus";
  if (elementKey.includes("meridian")) return "/modeling?enter=meridian";
  if (elementKey.includes("apex")) return "/modeling?enter=apex";
  if (elementKey.includes("harborview")) return "/modeling?enter=harborview";
  return "/modeling";
}

export default function WorldInspector({
  target,
  lighting,
  onUpdatePosition,
  onUpdateRotation,
  onUpdateScale,
  onUpdateColor,
  onUpdateLabel,
  onUpdateLighting,
  onEnterBuilding,
  onDelete,
  onClose,
}: WorldInspectorProps) {
  const [panelPos, setPanelPos] = useState(() => ({ x: Math.max(16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300), y: 72 }));
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const onPanelMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,button,select")) return;
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: panelPos.x,
      origY: panelPos.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      setPanelPos({
        x: Math.max(0, dragState.current.origX + e.clientX - dragState.current.startX),
        y: Math.max(0, dragState.current.origY + e.clientY - dragState.current.startY),
      });
    };
    const onUp = () => {
      dragState.current.dragging = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const [posX, setPosX] = useState("0");
  const [posY, setPosY] = useState("0");
  const [posZ, setPosZ] = useState("0");
  const [rotDeg, setRotDeg] = useState("0");
  const [scale, setScale] = useState(1);
  const [label, setLabel] = useState("");
  const [color1, setColor1] = useState("#4a7c3f");
  const [color2, setColor2] = useState("#2d5a27");
  const [ambientInt, setAmbientInt] = useState(lighting.ambientIntensity);
  const [sunInt, setSunInt] = useState(lighting.sunIntensity);
  const [sunAz, setSunAz] = useState(lighting.sunAzimuth);
  const [sunEl, setSunEl] = useState(lighting.sunElevation);

  useEffect(() => {
    if (!target) return;
    if (target.kind === "placement") {
      setPosX(target.posX.toFixed(1));
      setPosY(target.posY.toFixed(1));
      setPosZ(target.posZ.toFixed(1));
      setRotDeg(target.rotY.toFixed(1));
      setScale(target.scale);
      setColor1("#3a6aff");
      setColor2("#1a3a8a");
    } else if (target.kind === "element") {
      setPosX(target.posX.toFixed(1));
      setPosY(target.posY.toFixed(1));
      setPosZ(target.posZ.toFixed(1));
      setRotDeg(target.rotY.toFixed(1));
      setScale(target.scale);
      setLabel(target.label ?? "");
      setColor1(target.colorHex != null ? hexToColor(target.colorHex) : "#4a7c3f");
      setColor2(target.color2Hex != null ? hexToColor(target.color2Hex) : "#2d5a27");
    } else if (target.kind === "ground") {
      setColor1(hexToColor(target.colorHex));
    }
  }, [target]);

  useEffect(() => {
    setAmbientInt(lighting.ambientIntensity);
    setSunInt(lighting.sunIntensity);
    setSunAz(lighting.sunAzimuth);
    setSunEl(lighting.sunElevation);
  }, [lighting]);

  if (!target) return null;

  const deg2rad = (d: number) => (d * Math.PI) / 180;

  const commitPosition = () => {
    if (target.kind === "placement" || target.kind === "element") {
      onUpdatePosition(parseFloat(posX) || 0, parseFloat(posY) || 0, parseFloat(posZ) || 0);
    }
  };

  const commitRotation = () => {
    const deg = parseFloat(rotDeg) || 0;
    onUpdateRotation(deg); // hero-market uses degrees for both placements and elements
  };

  const commitScale = (v: number) => {
    onUpdateScale(v);
  };

  const commitColor1 = (v: string) => {
    setColor1(v);
    onUpdateColor(colorToHex(v), target.kind !== "ground" ? colorToHex(color2) : null);
  };

  const commitColor2 = (v: string) => {
    setColor2(v);
    onUpdateColor(colorToHex(color1), colorToHex(v));
  };

  const commitLabel = () => {
    if (target.kind === "element" && onUpdateLabel) onUpdateLabel(label);
  };

  const commitLighting = (patch: Partial<SceneLighting>) => {
    onUpdateLighting({
      ambientIntensity: ambientInt,
      sunIntensity: sunInt,
      sunAzimuth: sunAz,
      sunElevation: sunEl,
      ...patch,
    });
  };

  const panel: React.CSSProperties = {
    position: "fixed",
    left: panelPos.x,
    top: panelPos.y,
    zIndex: 30,
    width: 260,
    maxHeight: "calc(100vh - 90px)",
    overflowY: "auto",
    background: "rgba(6,12,24,0.97)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(100,180,255,0.3)",
    borderRadius: 14,
    color: "#e0f0ff",
    fontFamily: "monospace",
    fontSize: 12,
    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
    userSelect: "none",
  };
  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px 8px",
    borderBottom: "1px solid rgba(100,180,255,0.15)",
    cursor: "grab",
    background: "rgba(20,40,80,0.6)",
    borderRadius: "14px 14px 0 0",
  };
  const section: React.CSSProperties = {
    padding: "10px 14px",
    borderBottom: "1px solid rgba(100,180,255,0.08)",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    color: "#5577aa",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  };
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 };
  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "4px 6px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(100,180,255,0.2)",
    borderRadius: 5,
    color: "#e0f0ff",
    fontSize: 12,
    outline: "none",
    width: 0,
  };
  const labelStyle: React.CSSProperties = {
    width: 14,
    color: "#5577aa",
    fontSize: 11,
    flexShrink: 0,
    textAlign: "center",
  };
  const sliderStyle: React.CSSProperties = { flex: 1, accentColor: "#4488ff", cursor: "pointer" };
  const btn = (color: string, bg: string): React.CSSProperties => ({
    flex: 1,
    padding: "6px 4px",
    background: bg,
    border: `1px solid ${color}`,
    borderRadius: 6,
    color,
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "monospace",
  });

  let title = "";
  let icon = "";
  if (target.kind === "placement") {
    icon = "🏢";
    title = target.name;
  } else if (target.kind === "element") {
    icon = ELEMENT_ICONS[target.type] ?? "📦";
    title = ELEMENT_LABELS[target.type] ?? target.type;
  } else if (target.kind === "ground") {
    icon = "🌿";
    title = "Ground Plane";
  }

  return (
    <div style={panel}>
      <div style={header} onMouseDown={onPanelMouseDown}>
        <span style={{ fontSize: 13, fontWeight: "bold", color: "#aaddff" }}>
          {icon} {title}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#5577aa",
            fontSize: 16,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {(target.kind === "placement" || target.kind === "element") && (
        <div style={section}>
          <div style={sectionTitle}>Transform</div>
          <div style={row}>
            <span style={labelStyle}>X</span>
            <input
              style={inputStyle}
              type="number"
              step="0.5"
              value={posX}
              onChange={(e) => setPosX(e.target.value)}
              onBlur={commitPosition}
            />
            <span style={labelStyle}>Z</span>
            <input
              style={inputStyle}
              type="number"
              step="0.5"
              value={posZ}
              onChange={(e) => setPosZ(e.target.value)}
              onBlur={commitPosition}
            />
          </div>
          <div style={row}>
            <span style={labelStyle}>Y</span>
            <input
              style={inputStyle}
              type="number"
              step="0.1"
              value={posY}
              onChange={(e) => setPosY(e.target.value)}
              onBlur={commitPosition}
            />
            <span style={{ ...labelStyle, width: "auto", fontSize: 10, color: "#5577aa" }}>height</span>
          </div>
          <div style={row}>
            <span style={labelStyle}>↻</span>
            <input
              style={inputStyle}
              type="number"
              step="5"
              value={rotDeg}
              onChange={(e) => setRotDeg(e.target.value)}
              onBlur={commitRotation}
            />
            <span style={{ ...labelStyle, width: "auto", fontSize: 10, color: "#5577aa" }}>°</span>
          </div>
          <div style={{ ...row, marginBottom: 0 }}>
            <span style={labelStyle}>⤡</span>
            <input
              style={sliderStyle}
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              onMouseUp={() => commitScale(scale)}
              onTouchEnd={() => commitScale(scale)}
            />
            <span style={{ ...labelStyle, width: 28, textAlign: "right", color: "#88aacc" }}>
              {scale.toFixed(2)}×
            </span>
          </div>
        </div>
      )}

      {target.kind === "element" && (
        <div style={section}>
          <div style={sectionTitle}>Label</div>
          <input
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            type="text"
            placeholder="Optional label…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
          />
        </div>
      )}

      {(target.kind === "placement" || target.kind === "element" || target.kind === "ground") && (
        <div style={section}>
          <div style={sectionTitle}>Color</div>
          <div style={row}>
            <span style={{ ...labelStyle, width: "auto", marginRight: 4 }}>Primary</span>
            <input
              type="color"
              value={color1}
              onChange={(e) => commitColor1(e.target.value)}
              style={{
                width: 36,
                height: 28,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                background: "transparent",
              }}
            />
            <span style={{ color: "#88aacc", fontSize: 11 }}>{color1}</span>
          </div>
          {target.kind !== "ground" && (
            <div style={row}>
              <span style={{ ...labelStyle, width: "auto", marginRight: 4 }}>Secondary</span>
              <input
                type="color"
                value={color2}
                onChange={(e) => commitColor2(e.target.value)}
                style={{
                  width: 36,
                  height: 28,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: "transparent",
                }}
              />
              <span style={{ color: "#88aacc", fontSize: 11 }}>{color2}</span>
            </div>
          )}
        </div>
      )}

      <div style={section}>
        <div style={sectionTitle}>Scene Lighting</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "#88aacc", fontSize: 11 }}>Ambient</span>
            <span style={{ color: "#88aacc", fontSize: 11 }}>{ambientInt.toFixed(1)}</span>
          </div>
          <input
            style={sliderStyle}
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={ambientInt}
            onChange={(e) => setAmbientInt(parseFloat(e.target.value))}
            onMouseUp={() => commitLighting({ ambientIntensity: ambientInt })}
            onTouchEnd={() => commitLighting({ ambientIntensity: ambientInt })}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "#88aacc", fontSize: 11 }}>Sunlight</span>
            <span style={{ color: "#88aacc", fontSize: 11 }}>{sunInt.toFixed(1)}</span>
          </div>
          <input
            style={sliderStyle}
            type="range"
            min="0"
            max="4"
            step="0.05"
            value={sunInt}
            onChange={(e) => setSunInt(parseFloat(e.target.value))}
            onMouseUp={() => commitLighting({ sunIntensity: sunInt })}
            onTouchEnd={() => commitLighting({ sunIntensity: sunInt })}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "#88aacc", fontSize: 11 }}>Sun Azimuth</span>
            <span style={{ color: "#88aacc", fontSize: 11 }}>{sunAz}°</span>
          </div>
          <input
            style={sliderStyle}
            type="range"
            min="0"
            max="360"
            step="1"
            value={sunAz}
            onChange={(e) => setSunAz(parseInt(e.target.value))}
            onMouseUp={() => commitLighting({ sunAzimuth: sunAz })}
            onTouchEnd={() => commitLighting({ sunAzimuth: sunAz })}
          />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "#88aacc", fontSize: 11 }}>Sun Elevation</span>
            <span style={{ color: "#88aacc", fontSize: 11 }}>{sunEl}°</span>
          </div>
          <input
            style={sliderStyle}
            type="range"
            min="5"
            max="90"
            step="1"
            value={sunEl}
            onChange={(e) => setSunEl(parseInt(e.target.value))}
            onMouseUp={() => commitLighting({ sunElevation: sunEl })}
            onTouchEnd={() => commitLighting({ sunElevation: sunEl })}
          />
        </div>
      </div>

      <div style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
        {target.kind === "placement" && (
          <button
            style={btn("rgba(100,200,255,0.9)", "rgba(20,60,120,0.6)")}
            onClick={() => onEnterBuilding(target.interiorRoute ?? placementToRoute(target.elementKey))}
          >
            🚪 Enter
          </button>
        )}
        {target.kind === "placement" && !target.isBuiltIn && (
          <button style={btn("rgba(255,80,80,0.9)", "rgba(80,20,20,0.6)")} onClick={onDelete}>
            🗑 Delete
          </button>
        )}
        {target.kind === "element" && (
          <button style={btn("rgba(255,80,80,0.9)", "rgba(80,20,20,0.6)")} onClick={onDelete}>
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
}
