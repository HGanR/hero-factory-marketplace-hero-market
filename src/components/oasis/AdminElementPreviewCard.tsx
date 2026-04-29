"use client";

import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function toGatewayMaybe(uri: string) {
  if (!uri) return uri;
  const DEFAULT_BASE_URL = "https://troothhurtz.app";
  // Rewrite known-bad app subdomain URLs to the canonical base URL (fixes "Failed to fetch" when assets live on apex domain).
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
  // Prefer a canonical base URL for local assets so previews still work even if the admin
  // is opened on a protected *.vercel.app URL (which would return HTML/login for /models/*).
  if (uri.startsWith("/")) {
    const configured = (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) || "";
    const windowBase =
      typeof window !== "undefined"
        ? // If you are on app.<domain>, prefer the apex domain for static assets by default.
          `${window.location.protocol}//${
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
    try {
      return base ? new URL(uri, base).toString() : uri;
    } catch {
      return uri;
    }
  }
  return uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://nftstorage.link/ipfs/") : uri;
}

function Model({ url }: { url: string }) {
  const gatewayUrl = useMemo(() => toGatewayMaybe(url), [url]);
  // Don't enable DRACO by default; most creator .glb files are not draco-compressed.
  const gltf = useGLTF(gatewayUrl);
  return <primitive object={gltf.scene} />;
}

class PreviewErrorBoundary extends React.Component<
  { fallback: (message: string, gatewayUrl: string | null) => React.ReactNode; gatewayUrl: string | null; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError() {
    return { hasError: true, message: "" };
  }
  componentDidCatch(err: any) {
    // Keep the page alive; log for debugging.
    console.error("AdminElementPreviewCard render error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    this.setState({ message: msg });
  }
  render() {
    if (this.state.hasError) return this.props.fallback(this.state.message, this.props.gatewayUrl);
    return this.props.children;
  }
}

export function AdminElementPreviewCard({
  name,
  assetUri,
  previewImageUri,
}: {
  name: string;
  assetUri: string;
  previewImageUri?: string | null;
}) {
  const gatewayUri = useMemo(() => toGatewayMaybe(assetUri), [assetUri]);
  return (
    <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/70 shadow-lg p-4">
      <div className="text-xs text-slate-300 mb-2 font-semibold">Preview</div>
      <div className="rounded-xl border border-slate-800 bg-black/30 overflow-hidden">
        <div className="relative aspect-[4/3]">
          <PreviewErrorBoundary
            gatewayUrl={gatewayUri || null}
            fallback={(message, url) =>
              previewImageUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImageUri}
                  alt={`${name} preview`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs text-slate-400 px-4 text-center space-y-2">
                  <div>Preview failed to load.</div>
                  <div className="text-[11px] text-slate-500 break-words line-clamp-4">{message || "(No error details)"}</div>
                  {assetUri?.startsWith("/") ? (
                    <div className="text-[11px] text-slate-500">
                      Tip: if <span className="text-slate-300">Open model URL</span> shows a login/HTML page (Vercel deployment protection), the 3D loader will fail.
                      Use <span className="text-slate-300">Upload to IPFS</span> or disable protection for static assets.
                    </div>
                  ) : null}
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative z-10 pointer-events-auto text-cyan-300 underline text-[11px]"
                      onClick={(e) => {
                        // Ensure parent containers / canvas handlers never swallow this click.
                        e.stopPropagation();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      Open model URL
                    </a>
                  ) : null}
                </div>
              )
            }
          >
            <Suspense
              fallback={
                previewImageUri ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewImageUri}
                    alt={`${name} preview`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">Loading 3D preview…</div>
                )
              }
            >
              <Canvas camera={{ position: [2.4, 1.8, 2.4], fov: 45 }}>
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 8, 5]} intensity={1.1} />
                <group position={[0, -0.8, 0]}>
                  <Model url={assetUri} />
                </group>
                <OrbitControls enablePan={false} />
              </Canvas>
            </Suspense>
          </PreviewErrorBoundary>
        </div>
      </div>
      <div className="mt-2 text-sm text-white font-semibold line-clamp-1">{name}</div>
      <div className="mt-1 text-[11px] text-slate-400 line-clamp-1">{assetUri}</div>
      <div className="mt-2 text-[11px] text-slate-500">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}

export default AdminElementPreviewCard;


