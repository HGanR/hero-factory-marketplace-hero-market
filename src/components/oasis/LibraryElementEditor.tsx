"use client";

import React, { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { AlertCircle, Download, Loader2, Save } from "lucide-react";

type AdminElementRow = {
  id: number;
  categoryId: number;
  name: string;
  slug?: string | null;
  description: string | null;
  assetUri: string;
  previewImageUri: string | null;
  creatorWallet?: string | null;
  payoutSplits?: string | null;
  acceptedCurrencies?: string | null;
  price?: string;
  currency?: string;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function toGatewayMaybe(uri: string) {
  if (!uri) return uri;
  const DEFAULT_BASE_URL = "https://troothhurtz.app";
  if (uri.startsWith("ipfs://")) return uri.replace("ipfs://", "https://nftstorage.link/ipfs/");
  // Rewrite absolute app.* URLs to the configured/canonical base URL.
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    try {
      const u = new URL(uri);
      const configured = (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) || "";
      const windowBase =
        typeof window !== "undefined"
          ? `${window.location.protocol}//${
              window.location.hostname.startsWith("app.")
                ? window.location.hostname.replace(/^app\./, "")
                : window.location.hostname
            }${window.location.port ? `:${window.location.port}` : ""}`
          : "";
      const base =
        configured ||
        (typeof window !== "undefined" && window.location.hostname.endsWith("troothhurtz.com")
          ? DEFAULT_BASE_URL
          : windowBase);
      if (base && u.hostname.startsWith("app.")) {
        const b = new URL(base);
        u.hostname = b.hostname;
        u.protocol = b.protocol;
        u.port = b.port;
        return u.toString();
      }
    } catch {
      // fall through
    }
  }
  if (uri.startsWith("/")) {
    const configured = (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) || "";
    const windowBase =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${
            window.location.hostname.startsWith("app.")
              ? window.location.hostname.replace(/^app\./, "")
              : window.location.hostname
          }${window.location.port ? `:${window.location.port}` : ""}`
        : "";
    const base =
      configured ||
      (typeof window !== "undefined" && window.location.hostname.endsWith("troothhurtz.com")
        ? DEFAULT_BASE_URL
        : windowBase) ||
      "";
    try {
      return base ? new URL(uri, base).toString() : uri;
    } catch {
      return uri;
    }
  }
  return uri;
}

function cloneScene(scene: any) {
  // Clone so we can safely mutate materials/transforms per editor without affecting cached glTF.
  const cloned = scene.clone(true);
  cloned.traverse((node: any) => {
    if (node?.isMesh) {
      node.material = node.material?.clone?.() ?? node.material;
    }
  });
  return cloned;
}

function EditableModel({
  url,
  colorHex,
  scale,
}: {
  url: string;
  colorHex: string;
  scale: { x: number; y: number; z: number };
}) {
  const gatewayUrl = useMemo(() => toGatewayMaybe(url), [url]);
  const gltf = useGLTF(gatewayUrl);
  const scene = useMemo(() => cloneScene(gltf.scene), [gltf.scene]);

  useMemo(() => {
    // Apply material color
    scene.traverse((node: any) => {
      if (node?.isMesh && node.material) {
        // Most meshes will be standard material; if not, try to set color anyway.
        if (node.material.color?.set) node.material.color.set(colorHex);
      }
    });
  }, [scene, colorHex]);

  useMemo(() => {
    scene.scale.set(scale.x, scale.y, scale.z);
  }, [scene, scale.x, scale.y, scale.z]);

  return <primitive object={scene} />;
}

class PreviewErrorBoundary extends React.Component<
  { fallback: (message: string, url: string) => React.ReactNode; url: string; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError() {
    return { hasError: true, message: "" };
  }
  componentDidCatch(err: any) {
    console.error("LibraryElementEditor preview error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    this.setState({ message: msg });
  }
  render() {
    if (this.state.hasError) return this.props.fallback(this.state.message, this.props.url);
    return this.props.children;
  }
}

export function LibraryElementEditor({
  element,
  walletAddress,
  creatorWallet,
  onSaved,
}: {
  element: AdminElementRow;
  walletAddress?: string;
  creatorWallet?: string;
  onSaved?: () => Promise<void> | void;
}) {
  const [name, setName] = useState(`${element.name} (Edited)`);
  const [color, setColor] = useState("#22d3ee"); // cyan-ish
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [scaleZ, setScaleZ] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const gatewayUrl = useMemo(() => toGatewayMaybe(element.assetUri), [element.assetUri]);

  async function yieldToPaint() {
    // Let React paint state updates (e.g. "Saving…") before heavy synchronous work like GLTF export.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function exportGlbBlob(): Promise<Blob> {
    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
    const exporter = new GLTFExporter();

    // Build a small scene graph for export by re-loading the glTF and mutating it.
    const gltf = await (async () => {
      // Use drei loader to ensure consistent loading; dynamic import to avoid SSR.
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      return await new Promise<any>((resolve, reject) => {
        loader.load(
          gatewayUrl,
          (res) => resolve(res),
          undefined,
          (e) => reject(new Error((e as any)?.message || "Failed to load model for export"))
        );
      });
    })();

    const scene = cloneScene(gltf.scene);
    scene.traverse((node: any) => {
      if (node?.isMesh && node.material?.color?.set) node.material.color.set(color);
    });
    scene.scale.set(scaleX, scaleY, scaleZ);

    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        scene,
        (result) => {
          // When binary:true, result is ArrayBuffer.
          if (result instanceof ArrayBuffer) return resolve(result);
          // Some builds return { gltf: ... } - handle defensively.
          try {
            const text = JSON.stringify(result);
            const buf = new TextEncoder().encode(text).buffer;
            resolve(buf);
          } catch (e) {
            reject(new Error("Unexpected export format"));
          }
        },
        (e) => reject(new Error((e as any)?.message || "Export failed")),
        { binary: true }
      );
    });

    return new Blob([arrayBuffer], { type: "model/gltf-binary" });
  }

  async function handleDownload() {
    try {
      setBusy(true);
      setErr(null);
      setMsg(null);
      await yieldToPaint();
      const blob = await exportGlbBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(name || element.name || "model")}.glb`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Downloaded edited GLB.");
    } catch (e: any) {
      setErr(e?.message || "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAsNew() {
    try {
      setBusy(true);
      setErr(null);
      setMsg(null);
      await yieldToPaint();

      const uploaderWallet = (creatorWallet || walletAddress || "").trim();
      if (!uploaderWallet) {
        throw new Error("Creator payout wallet (or connected wallet) is required to save.");
      }

      const blob = await exportGlbBlob();
      const file = new File([blob], `${slugify(name || element.name)}.glb`, { type: "model/gltf-binary" });

      // Upload via server route (PINATA_JWT stays server-side)
      const up = new FormData();
      up.append("file", file);
      up.append("walletAddress", uploaderWallet);
      const upRes = await fetch("/api/upload-to-pinata", { method: "POST", body: up });
      const upJson = (await upRes.json().catch(() => ({}))) as any;
      if (!upRes.ok || !upJson?.success) {
        throw new Error(upJson?.error || `Upload failed (${upRes.status})`);
      }
      const cid = String(upJson.ipfsHash || "").trim();
      if (!cid) throw new Error("Upload succeeded but no CID returned");
      const assetUri = `ipfs://${cid}`;

      // Create a NEW library element row (admin endpoint)
      const accepted = (() => {
        try {
          const parsed = JSON.parse(String(element.acceptedCurrencies || "null"));
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      })();

      const res = await fetch("/api/admin/oasis/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || `${element.name} (Edited)`,
          slug: slugify(name || `${element.name}-edited`),
          description: element.description || "",
          categoryId: element.categoryId,
          assetUri,
          previewImageUri: element.previewImageUri || null,
          creatorWallet: uploaderWallet,
          payoutSplits: element.payoutSplits ? (() => {
            try { return JSON.parse(element.payoutSplits); } catch { return undefined; }
          })() : undefined,
          acceptedCurrencies: accepted || undefined,
          price: element.price ?? "0",
          currency: (element.currency ?? "TROO").toUpperCase(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      setMsg(`Saved as new element: ${assetUri}`);
      await onSaved?.();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-white/10 bg-slate-950/30 overflow-hidden">
        <div className="p-3 border-b border-white/10">
          <div className="text-xs text-slate-300 font-semibold">Editable Preview</div>
          <div className="text-[11px] text-slate-500 break-words">{element.assetUri}</div>
        </div>
        <div className="relative aspect-[4/3]">
          <PreviewErrorBoundary
            url={gatewayUrl}
            fallback={(message, url) => (
              <div className="absolute inset-0 grid place-items-center text-xs text-slate-400 px-4 text-center space-y-2">
                <div>Preview failed to load.</div>
                <div className="text-[11px] text-slate-500 break-words line-clamp-4">{message || "(No error details)"}</div>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-cyan-300 underline text-[11px]">
                    Open model URL
                  </a>
                ) : null}
              </div>
            )}
          >
            <Suspense
              fallback={
                <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading 3D…
                  </div>
                </div>
              }
            >
              <Canvas camera={{ position: [2.4, 1.8, 2.4], fov: 45 }}>
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 8, 5]} intensity={1.1} />
                <group position={[0, -0.8, 0]}>
                  <EditableModel url={element.assetUri} colorHex={color} scale={{ x: scaleX, y: scaleY, z: scaleZ }} />
                </group>
                <OrbitControls enablePan={false} />
              </Canvas>
            </Suspense>
          </PreviewErrorBoundary>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
          <div className="text-sm font-semibold text-white">Editor</div>
          <div className="text-xs text-slate-400 mt-1">Color + scale edits. Save as a new element.</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3 space-y-3">
          <label className="text-xs text-slate-400">New element name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2 text-sm text-white"
          />

          <div className="grid grid-cols-[1fr_90px] gap-2 items-center">
            <div>
              <label className="text-xs text-slate-400">Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12" />
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 rounded-lg bg-slate-950/40 border border-white/10 px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Scale X: {scaleX.toFixed(2)}</label>
            <input type="range" min={0.5} max={2} step={0.05} value={scaleX} onChange={(e) => setScaleX(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Scale Y: {scaleY.toFixed(2)}</label>
            <input type="range" min={0.5} max={2} step={0.05} value={scaleY} onChange={(e) => setScaleY(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Scale Z: {scaleZ.toFixed(2)}</label>
            <input type="range" min={0.5} max={2} step={0.05} value={scaleZ} onChange={(e) => setScaleZ(Number(e.target.value))} className="w-full" />
          </div>

          {err ? (
            <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-xs text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />
                <div className="break-words">{err}</div>
              </div>
            </div>
          ) : null}
          {msg ? (
            <div className="rounded-lg border border-green-700/50 bg-green-900/20 p-3 text-xs text-green-200">
              <div className="break-words">{msg}</div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Download edited GLB
            </button>
            <button
              type="button"
              onClick={handleSaveAsNew}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {busy ? "Saving…" : "Save as new Library Element"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LibraryElementEditor;


