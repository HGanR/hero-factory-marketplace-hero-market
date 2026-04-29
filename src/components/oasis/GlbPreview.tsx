"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { AlertCircle, Loader2 } from "lucide-react";

function Model({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} />;
}

class PreviewErrorBoundary extends React.Component<
  { fallback: (message: string) => React.ReactNode; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError() {
    return { hasError: true, message: "" };
  }
  componentDidCatch(err: any) {
    console.error("GlbPreview render error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    this.setState({ message: msg });
  }
  render() {
    if (this.state.hasError) return this.props.fallback(this.state.message);
    return this.props.children;
  }
}

export function GlbPreview({
  file,
  heightClassName = "h-64",
  className = "",
}: {
  file: File | null;
  heightClassName?: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const canRender = useMemo(() => !!file && !!objectUrl, [file, objectUrl]);

  return (
    <div
      className={[
        heightClassName,
        "w-full rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden",
        className,
      ].join(" ")}
    >
      {!file ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-xs text-slate-500">Select a .glb/.gltf file to preview</p>
        </div>
      ) : null}

      {canRender ? (
        <PreviewErrorBoundary
          fallback={(message) => (
            <div className="flex items-center justify-center h-full p-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <AlertCircle className="h-6 w-6 text-red-400" />
                <p className="text-xs text-red-300 break-words">{message || "Failed to render model."}</p>
              </div>
            </div>
          )}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                  <p className="text-xs text-slate-400">Loading model…</p>
                </div>
              </div>
            }
          >
            <Canvas camera={{ position: [2.4, 1.8, 2.4], fov: 45 }}>
              <ambientLight intensity={0.8} />
              <directionalLight position={[5, 8, 5]} intensity={1.1} />
              <group position={[0, -0.8, 0]}>
                <Model url={objectUrl!} />
              </group>
              <OrbitControls enablePan={false} />
            </Canvas>
          </Suspense>
        </PreviewErrorBoundary>
      ) : null}
    </div>
  );
}

export default GlbPreview;





