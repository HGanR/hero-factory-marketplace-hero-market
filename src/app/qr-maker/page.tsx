"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

const BINDING_KEY = "smart_trust_platform_binding_v1";

function loadWorkspaceFromBinding(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BINDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { trustId?: string | null };
    return typeof parsed?.trustId === "string" && parsed.trustId.trim()
      ? parsed.trustId.trim()
      : null;
  } catch {
    return null;
  }
}

type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type ModuleShape = "square" | "rounded" | "dots" | "squircle";
type FinderStyle = "classic" | "rounded" | "dots";

function generateToken() {
  const maybeCrypto = globalThis.crypto;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === "function") {
    return maybeCrypto.randomUUID();
  }
  return `qrid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isProbablyUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function addOrReplaceParam(inputUrl: string, key: string, value: string) {
  const u = new URL(inputUrl);
  u.searchParams.set(key, value);
  return u.toString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function drawModule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: ModuleShape,
  radiusFactor: number
) {
  if (shape === "square") {
    ctx.fillRect(x, y, size, size);
    return;
  }

  if (shape === "dots") {
    const r = size / 2;
    ctx.beginPath();
    ctx.arc(x + r, y + r, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const r = clamp(size * radiusFactor, 0, size / 2);
  const ctxWithRoundRect = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, radii: number) => void;
  };

  if (typeof ctxWithRoundRect.roundRect === "function") {
    ctx.beginPath();
    ctxWithRoundRect.roundRect(x, y, size, size, r);
    ctx.fill();
    return;
  }

  // Fallback for environments without roundRect
  ctx.beginPath();
  const rr = r;
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + size, y, x + size, y + size, rr);
  ctx.arcTo(x + size, y + size, x, y + size, rr);
  ctx.arcTo(x, y + size, x, y, rr);
  ctx.arcTo(x, y, x + size, y, rr);
  ctx.closePath();
  ctx.fill();
}

function isInFinderZone(row: number, col: number, moduleCount: number) {
  const inTop = row >= 0 && row < 7;
  const inLeft = col >= 0 && col < 7;
  const inRight = col >= moduleCount - 7 && col < moduleCount;
  const inBottom = row >= moduleCount - 7 && row < moduleCount;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function drawFinderEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  moduleSize: number,
  style: FinderStyle,
  fgColor: string,
  bgColor: string
) {
  const outer = 7 * moduleSize;
  const middle = 5 * moduleSize;
  const inner = 3 * moduleSize;
  const middleOffset = moduleSize;
  const innerOffset = 2 * moduleSize;

  const drawShape = (
    fill: string,
    dx: number,
    dy: number,
    size: number,
    radiusRatio: number
  ) => {
    ctx.fillStyle = fill;
    if (style === "dots") {
      const r = size / 2;
      ctx.beginPath();
      ctx.arc(x + dx + r, y + dy + r, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    drawModule(
      ctx,
      x + dx,
      y + dy,
      size,
      style === "rounded" ? "rounded" : "square",
      radiusRatio
    );
  };

  drawShape(fgColor, 0, 0, outer, 0.28);
  drawShape(bgColor, middleOffset, middleOffset, middle, 0.24);
  drawShape(fgColor, innerOffset, innerOffset, inner, 0.3);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "").trim();
  if (![3, 6].includes(cleaned.length)) return null;
  const full =
    cleaned.length === 3
      ? `${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`
      : cleaned;
  const intValue = Number.parseInt(full, 16);
  if (Number.isNaN(intValue)) return null;
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function channelToLinear(value: number) {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export default function QRMakerPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rawUrl, setRawUrl] = useState("");
  const [uniqueMode, setUniqueMode] = useState(true);
  const [token, setToken] = useState(generateToken);

  const [ecc, setEcc] = useState<ErrorCorrectionLevel>("M");
  const [moduleShape, setModuleShape] = useState<ModuleShape>("square");
  const [sizePx, setSizePx] = useState(360);
  const [quietZone, setQuietZone] = useState(2);

  const [fgColor, setFgColor] = useState("#0b0b0b");
  const [fgColor2, setFgColor2] = useState("#f97316");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [useGradientFg, setUseGradientFg] = useState(false);
  const [radiusFactor, setRadiusFactor] = useState(0.22);
  const [finderStyle, setFinderStyle] = useState<FinderStyle>("classic");
  const [customFinderEyes, setCustomFinderEyes] = useState(true);
  const [status, setStatus] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [saveToWorkspaceBusy, setSaveToWorkspaceBusy] = useState(false);

  const normalizedUrl = useMemo(() => rawUrl.trim(), [rawUrl]);

  const finalUrl = useMemo(() => {
    if (!isProbablyUrl(normalizedUrl)) return "";
    return uniqueMode ? addOrReplaceParam(normalizedUrl, "qrid", token) : normalizedUrl;
  }, [normalizedUrl, uniqueMode, token]);

  const scanSafety = useMemo(() => {
    const issues: string[] = [];
    let score = 100;

    const baseContrast = contrastRatio(fgColor, bgColor);
    const gradientContrast = useGradientFg ? contrastRatio(fgColor2, bgColor) : baseContrast;
    const effectiveContrast = Math.min(baseContrast ?? 0, gradientContrast ?? 0);

    if (effectiveContrast < 3) {
      score -= 40;
      issues.push("Very low foreground/background contrast.");
    } else if (effectiveContrast < 4.5) {
      score -= 25;
      issues.push("Low contrast may fail on some phone cameras.");
    } else if (effectiveContrast < 7) {
      score -= 10;
      issues.push("Contrast is acceptable but not ideal.");
    }

    if (quietZone < 2) {
      score -= 25;
      issues.push("Quiet zone below 2 can break detection.");
    } else if (quietZone === 2) {
      score -= 10;
      issues.push("Quiet zone is minimal; 3-4 is safer.");
    }

    if (ecc === "L") {
      score -= 15;
      issues.push("ECC L has low damage tolerance.");
    } else if (ecc === "M") {
      score -= 8;
      issues.push("ECC M is okay; Q/H is safer for stylized codes.");
    } else if (ecc === "Q") {
      score -= 3;
    }

    if (moduleShape === "dots") {
      score -= 10;
      issues.push("Dot modules are stylish but reduce scan tolerance.");
    } else if (moduleShape === "rounded" || moduleShape === "squircle") {
      score -= 5;
    }

    if ((moduleShape === "rounded" || moduleShape === "squircle") && radiusFactor > 0.35) {
      score -= 8;
      issues.push("High roundness can blur module boundaries.");
    }

    if (customFinderEyes && finderStyle === "dots") {
      score -= 8;
      issues.push("Dot finder eyes can hurt detector reliability.");
    }

    if (sizePx < 280) {
      score -= 8;
      issues.push("Small output size may scan poorly when printed.");
    }

    if (finalUrl.length > 200) {
      score -= 15;
      issues.push("Long URL increases code density.");
    } else if (finalUrl.length > 120) {
      score -= 8;
      issues.push("URL length is moderate/high; density is rising.");
    }

    score = clamp(Math.round(score), 0, 100);

    const level =
      score >= 85
        ? "Excellent"
        : score >= 70
          ? "Good"
          : score >= 50
            ? "Caution"
            : "Risky";

    const barClass =
      level === "Excellent"
        ? "bg-emerald-500"
        : level === "Good"
          ? "bg-cyan-500"
          : level === "Caution"
            ? "bg-amber-500"
            : "bg-red-500";

    return {
      score,
      level,
      issues,
      contrastText: Number.isFinite(effectiveContrast)
        ? `${effectiveContrast.toFixed(2)}:1`
        : "n/a",
      barClass,
    };
  }, [
    bgColor,
    customFinderEyes,
    ecc,
    fgColor,
    fgColor2,
    finalUrl.length,
    finderStyle,
    moduleShape,
    quietZone,
    radiusFactor,
    sizePx,
    useGradientFg,
  ]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function renderQr() {
    setStatus("");
    if (!finalUrl) {
      setStatus("Enter a valid http(s) URL.");
      clearCanvas();
      return;
    }

    try {
      const qr = QRCode.create(finalUrl, { errorCorrectionLevel: ecc });
      const moduleCount = qr.modules.size;
      const margin = Math.max(0, quietZone);
      const totalModules = moduleCount + margin * 2;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(sizePx * dpr);
      canvas.height = Math.floor(sizePx * dpr);
      canvas.style.width = `${sizePx}px`;
      canvas.style.height = `${sizePx}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, sizePx, sizePx);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, sizePx, sizePx);

      const moduleSize = sizePx / totalModules;
      if (useGradientFg) {
        const gradient = ctx.createLinearGradient(0, 0, sizePx, sizePx);
        gradient.addColorStop(0, fgColor);
        gradient.addColorStop(1, fgColor2);
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = fgColor;
      }

      for (let r = 0; r < moduleCount; r += 1) {
        for (let c = 0; c < moduleCount; c += 1) {
          const isDark = qr.modules.get(c, r);
          if (!isDark) continue;
          if (customFinderEyes && isInFinderZone(r, c, moduleCount)) continue;
          const x = (c + margin) * moduleSize;
          const y = (r + margin) * moduleSize;
          const inset = moduleShape === "dots" ? moduleSize * 0.08 : 0;
          const s = moduleSize - inset * 2;
          drawModule(
            ctx,
            x + inset,
            y + inset,
            s,
            moduleShape,
            moduleShape === "squircle" ? 0.42 : radiusFactor
          );
        }
      }

      if (customFinderEyes) {
        const origins = [
          { row: 0, col: 0 },
          { row: 0, col: moduleCount - 7 },
          { row: moduleCount - 7, col: 0 },
        ];
        for (const origin of origins) {
          const x = (origin.col + margin) * moduleSize;
          const y = (origin.row + margin) * moduleSize;
          drawFinderEye(ctx, x, y, moduleSize, finderStyle, fgColor, bgColor);
        }
      }

      setStatus(uniqueMode ? "Rendered (unique enabled)." : "Rendered.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to render QR.";
      setStatus(message);
      clearCanvas();
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = uniqueMode ? `qr_${token.slice(0, 8)}.png` : "qr.png";
    a.click();
  }

  function downloadSvg() {
    if (!finalUrl) {
      setStatus("Enter a valid http(s) URL before exporting.");
      return;
    }
    try {
      const qr = QRCode.create(finalUrl, { errorCorrectionLevel: ecc });
      const moduleCount = qr.modules.size;
      const margin = Math.max(0, quietZone);
      const totalModules = moduleCount + margin * 2;
      const moduleSize = sizePx / totalModules;
      const dimension = sizePx;
      const radius =
        moduleShape === "squircle"
          ? moduleSize * 0.42
          : moduleShape === "rounded"
            ? moduleSize * radiusFactor
            : 0;

      const defs = useGradientFg
        ? `<defs><linearGradient id="fgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${escapeXml(fgColor)}"/><stop offset="100%" stop-color="${escapeXml(fgColor2)}"/></linearGradient></defs>`
        : "";
      const darkFill = useGradientFg ? "url(#fgGrad)" : escapeXml(fgColor);

      const modules: string[] = [];
      for (let r = 0; r < moduleCount; r += 1) {
        for (let c = 0; c < moduleCount; c += 1) {
          if (!qr.modules.get(c, r)) continue;
          if (customFinderEyes && isInFinderZone(r, c, moduleCount)) continue;
          const x = (c + margin) * moduleSize;
          const y = (r + margin) * moduleSize;
          if (moduleShape === "dots") {
            const rr = moduleSize * 0.47;
            modules.push(
              `<circle cx="${(x + moduleSize / 2).toFixed(4)}" cy="${(y + moduleSize / 2).toFixed(4)}" r="${rr.toFixed(4)}" fill="${darkFill}" />`
            );
          } else {
            modules.push(
              `<rect x="${x.toFixed(4)}" y="${y.toFixed(4)}" width="${moduleSize.toFixed(4)}" height="${moduleSize.toFixed(4)}" rx="${radius.toFixed(4)}" ry="${radius.toFixed(4)}" fill="${darkFill}" />`
            );
          }
        }
      }

      if (customFinderEyes) {
        const origins = [
          { row: 0, col: 0 },
          { row: 0, col: moduleCount - 7 },
          { row: moduleCount - 7, col: 0 },
        ];
        for (const origin of origins) {
          const x = (origin.col + margin) * moduleSize;
          const y = (origin.row + margin) * moduleSize;
          const outer = 7 * moduleSize;
          const middle = 5 * moduleSize;
          const inner = 3 * moduleSize;
          const offset1 = moduleSize;
          const offset2 = 2 * moduleSize;
          if (finderStyle === "dots") {
            modules.push(
              `<circle cx="${(x + outer / 2).toFixed(4)}" cy="${(y + outer / 2).toFixed(4)}" r="${(outer / 2).toFixed(4)}" fill="${darkFill}" />`
            );
            modules.push(
              `<circle cx="${(x + offset1 + middle / 2).toFixed(4)}" cy="${(y + offset1 + middle / 2).toFixed(4)}" r="${(middle / 2).toFixed(4)}" fill="${escapeXml(bgColor)}" />`
            );
            modules.push(
              `<circle cx="${(x + offset2 + inner / 2).toFixed(4)}" cy="${(y + offset2 + inner / 2).toFixed(4)}" r="${(inner / 2).toFixed(4)}" fill="${darkFill}" />`
            );
          } else {
            const rr = finderStyle === "rounded" ? moduleSize * 1.1 : 0;
            modules.push(
              `<rect x="${x.toFixed(4)}" y="${y.toFixed(4)}" width="${outer.toFixed(4)}" height="${outer.toFixed(4)}" rx="${rr.toFixed(4)}" ry="${rr.toFixed(4)}" fill="${darkFill}" />`
            );
            modules.push(
              `<rect x="${(x + offset1).toFixed(4)}" y="${(y + offset1).toFixed(4)}" width="${middle.toFixed(4)}" height="${middle.toFixed(4)}" rx="${rr.toFixed(4)}" ry="${rr.toFixed(4)}" fill="${escapeXml(bgColor)}" />`
            );
            modules.push(
              `<rect x="${(x + offset2).toFixed(4)}" y="${(y + offset2).toFixed(4)}" width="${inner.toFixed(4)}" height="${inner.toFixed(4)}" rx="${rr.toFixed(4)}" ry="${rr.toFixed(4)}" fill="${darkFill}" />`
            );
          }
        }
      }

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" role="img" aria-label="QR Code">${defs}<rect width="100%" height="100%" fill="${escapeXml(bgColor)}" />${modules.join("")}</svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = uniqueMode ? `qr_${token.slice(0, 8)}.svg` : "qr.svg";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export SVG.";
      setStatus(message);
    }
  }

  useEffect(() => {
    const refresh = () => setWorkspaceId(loadWorkspaceFromBinding());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === BINDING_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("smart_trust_platform_binding_updated", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("smart_trust_platform_binding_updated", refresh);
    };
  }, []);

  const saveToWorkspace = useCallback(async () => {
    if (!workspaceId) {
      setStatus("Select a workspace first (open a trust from Trust Records).");
      return;
    }
    if (!finalUrl) {
      setStatus("Enter a valid URL and render first.");
      return;
    }
    setSaveToWorkspaceBusy(true);
    setStatus("");
    try {
      const r = await fetch("/api/app/qr-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workspaceId,
          name: uniqueMode ? `QR ${token.slice(0, 8)}` : "QR Code",
          config: {
            url: finalUrl,
            token: uniqueMode ? token : null,
            uniqueMode,
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus(j?.error ?? "Save failed.");
        return;
      }
      setStatus("Saved to workspace.");
    } catch {
      setStatus("Save failed.");
    } finally {
      setSaveToWorkspaceBusy(false);
    }
  }, [workspaceId, finalUrl, uniqueMode, token]);

  useEffect(() => {
    void renderQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    finalUrl,
    ecc,
    moduleShape,
    sizePx,
    quietZone,
    fgColor,
    fgColor2,
    bgColor,
    radiusFactor,
    customFinderEyes,
    finderStyle,
    useGradientFg,
  ]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">QR GEN</h1>
            <p className="mt-1 text-sm text-slate-400">
              Fully local QR generation with custom style controls and PNG export.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-cyan-500/60 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl border border-cyan-500/30 bg-slate-800/40 p-5">
            <label className="mb-2 block text-sm font-semibold">Website URL</label>
            <input
              value={rawUrl}
              onChange={(e) => setRawUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void renderQr()}
                className="rounded-lg border border-cyan-500 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30"
              >
                Render
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawUrl("");
                  setToken(generateToken());
                  setStatus("");
                  clearCanvas();
                }}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:border-slate-400"
              >
                Reset
              </button>
            </div>

            <div className="my-4 h-px bg-slate-700" />

            <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={uniqueMode}
                onChange={(e) => setUniqueMode(e.target.checked)}
              />
              Unique QR (append `qrid` param)
            </label>

            {uniqueMode ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono">
                  {token}
                </span>
                <button
                  type="button"
                  onClick={() => setToken(generateToken())}
                  className="rounded-lg border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
                >
                  New token
                </button>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Foreground</label>
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Background</label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={useGradientFg}
                  onChange={(e) => setUseGradientFg(e.target.checked)}
                />
                Gradient foreground
              </label>
              {useGradientFg ? (
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Gradient End</label>
                  <input
                    type="color"
                    value={fgColor2}
                    onChange={(e) => setFgColor2(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Shape</label>
                <select
                  value={moduleShape}
                  onChange={(e) => setModuleShape(e.target.value as ModuleShape)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                >
                  <option value="square">Square</option>
                  <option value="rounded">Rounded</option>
                  <option value="dots">Dots</option>
                  <option value="squircle">Squircle</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">ECC</label>
                <select
                  value={ecc}
                  onChange={(e) => setEcc(e.target.value as ErrorCorrectionLevel)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                >
                  <option value="L">L (7%)</option>
                  <option value="M">M (15%)</option>
                  <option value="Q">Q (25%)</option>
                  <option value="H">H (30%)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Quiet Zone</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={quietZone}
                  onChange={(e) => setQuietZone(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={customFinderEyes}
                  onChange={(e) => setCustomFinderEyes(e.target.checked)}
                />
                Custom finder eyes
              </label>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Finder style</label>
                <select
                  value={finderStyle}
                  onChange={(e) => setFinderStyle(e.target.value as FinderStyle)}
                  disabled={!customFinderEyes}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm disabled:opacity-50"
                >
                  <option value="classic">Classic</option>
                  <option value="rounded">Rounded</option>
                  <option value="dots">Dots</option>
                </select>
              </div>
            </div>

            {(moduleShape === "rounded" || moduleShape === "squircle") ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-400">
                  Roundness ({radiusFactor.toFixed(2)})
                </label>
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.01}
                  value={radiusFactor}
                  onChange={(e) => setRadiusFactor(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            ) : null}

            <div className="mt-3">
              <label className="mb-1 block text-xs text-slate-400">Output Size (px)</label>
              <input
                type="number"
                min={200}
                max={1200}
                value={sizePx}
                onChange={(e) => setSizePx(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
              />
            </div>

            {status ? (
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                {status}
              </div>
            ) : null}

            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Scan Safety Meter</span>
                <span className="text-slate-300">
                  {scanSafety.level} - {scanSafety.score}/100
                </span>
              </div>
              <div className="h-2 w-full rounded bg-slate-800">
                <div
                  className={`h-2 rounded ${scanSafety.barClass}`}
                  style={{ width: `${scanSafety.score}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Contrast: {scanSafety.contrastText} | ECC: {ecc} | Quiet Zone: {quietZone}
              </div>
              {scanSafety.issues.length ? (
                <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                  {scanSafety.issues.slice(0, 3).map((issue) => (
                    <div key={issue}>- {issue}</div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-emerald-300">
                  Settings look scanner-friendly.
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              For best scan reliability, keep strong contrast between foreground and background.
            </p>
          </section>

          <section className="rounded-2xl border border-cyan-500/30 bg-slate-800/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Preview</div>
                <div className="mt-1 break-all text-xs text-slate-400">
                  {finalUrl || "-"}
                </div>
              </div>
              <button
                type="button"
                onClick={downloadPng}
                className="rounded-lg border border-cyan-500 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                className="rounded-lg border border-orange-500 bg-orange-500/20 px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/30"
              >
                Download SVG
              </button>
              {workspaceId ? (
                <button
                  type="button"
                  onClick={saveToWorkspace}
                  disabled={saveToWorkspaceBusy || !finalUrl}
                  className="rounded-lg border border-emerald-500 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {saveToWorkspaceBusy ? "Saving…" : "Save to Workspace"}
                </button>
              ) : (
                <span className="text-xs text-slate-400">Open a trust to save to workspace</span>
              )}
            </div>

            <div className="mt-4 grid min-h-[420px] place-items-center rounded-xl border border-slate-700 bg-slate-950 p-4">
              <canvas
                ref={canvasRef}
                style={{
                  width: sizePx,
                  maxWidth: "100%",
                  height: "auto",
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: bgColor,
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

