"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { DoubleSide } from "three";
import { AlertTriangle, Box, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImprovementPreset } from "@/lib/property-twin/deal-scenarios";
import { sceneOutputFromJob, type TwinSceneOutput } from "@/lib/property-twin/types";

type JobRow = {
  id: number;
  status: string;
  errorMessage: string | null;
  outputUrl: string | null;
  resultJson: unknown;
};

export type TwinNodeAnchor = {
  id: number;
  label: string;
  anchorX: number | null;
  anchorY: number | null;
  anchorZ: number | null;
};

function TwinScenePlaceholder({
  visualMode = "current",
  improvementPreset = "modern",
}: {
  visualMode?: "current" | "improved";
  improvementPreset?: ImprovementPreset;
}) {
  const preset = visualMode === "current" ? "current" : improvementPreset;
  const theme =
    preset === "current"
      ? { bg: "#0a1020", box: "#2563eb", floor: "#0f172a", amb: 0.55, dir: 1.1, gridA: "#334155", gridB: "#1e293b" }
      : preset === "staged"
        ? { bg: "#120a08", box: "#c2410c", floor: "#1c1917", amb: 0.65, dir: 1.2, gridA: "#78350f", gridB: "#422006" }
        : preset === "modern"
          ? { bg: "#050f1a", box: "#0891b2", floor: "#0c172a", amb: 0.6, dir: 1.15, gridA: "#155e75", gridB: "#0e3a4a" }
          : { bg: "#0f0820", box: "#a855f7", floor: "#14082a", amb: 0.55, dir: 1.25, gridA: "#6b21a8", gridB: "#3b0764" };

  return (
    <>
      <color attach="background" args={[theme.bg]} />
      <ambientLight intensity={theme.amb} />
      <directionalLight position={[4, 6, 3]} intensity={theme.dir} />
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.1, 1.35]} />
        <meshStandardMaterial color={theme.box} metalness={preset === "luxury" ? 0.35 : 0.15} roughness={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color={theme.floor} />
      </mesh>
      <Grid
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.4}
        sectionSize={2}
        fadeDistance={28}
        position={[0, 0.001, 0]}
        sectionColor={theme.gridA}
        cellColor={theme.gridB}
      />
      <OrbitControls makeDefault minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.1} />
    </>
  );
}

function LoadedGltf({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  return <primitive object={scene} />;
}

class GltfErrorBoundary extends Component<
  { url: string; children: ReactNode; onError: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }

  componentDidUpdate(prev: { url: string }) {
    if (prev.url !== this.props.url) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

function ViewerShell({
  children,
  overlay,
  frameClassName,
}: {
  children: ReactNode;
  overlay?: ReactNode;
  frameClassName?: string;
}) {
  return (
    <div
      className={`h-[320px] rounded-xl overflow-hidden border border-white/10 bg-[#070b1a] relative ${frameClassName ?? ""}`}
    >
      <Canvas shadows camera={{ position: [2.2, 1.4, 2.6], fov: 45 }}>{children}</Canvas>
      {overlay}
    </div>
  );
}

function visualFrameClass(visualMode: "current" | "improved", preset: ImprovementPreset): string {
  if (visualMode === "current") return "";
  if (preset === "staged") return "ring-1 ring-amber-500/25 shadow-[inset_0_0_60px_rgba(234,88,12,0.06)]";
  if (preset === "modern") return "ring-1 ring-cyan-500/25 shadow-[inset_0_0_60px_rgba(6,182,212,0.07)]";
  return "ring-1 ring-violet-500/25 shadow-[inset_0_0_60px_rgba(168,85,247,0.08)]";
}

function VisualBadge({
  visualMode,
  preset,
}: {
  visualMode: "current" | "improved";
  preset: ImprovementPreset;
}) {
  if (visualMode === "current") return null;
  const label =
    preset === "staged" ? "Improved · staged" : preset === "modern" ? "Improved · modern" : "Improved · luxury";
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex justify-center">
      <span className="text-[11px] uppercase tracking-wider px-3 py-1 rounded-full bg-black/55 border border-white/15 text-amber-100/90">
        {label} — visualization
      </span>
    </div>
  );
}

function AnchorMarkers({ nodes }: { nodes: TwinNodeAnchor[] }) {
  return (
    <>
      {nodes.map((n) => {
        if (n.anchorX == null || n.anchorY == null || n.anchorZ == null) return null;
        return (
          <mesh key={n.id} position={[n.anchorX, n.anchorY, n.anchorZ]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.35} />
          </mesh>
        );
      })}
    </>
  );
}

function PlacementPlane({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick?: (p: { x: number; y: number; z: number }) => void;
}) {
  if (!enabled || !onPick) return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.04, 0]}
      renderOrder={10}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const p = e.point;
        onPick({ x: p.x, y: p.y, z: p.z });
      }}
    >
      <planeGeometry args={[280, 280]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

function Overlay({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="h-[320px] rounded-xl border border-white/10 bg-[#070b1a] flex flex-col items-center justify-center text-center px-6 gap-2">
      <div className="text-cyan-400/90">{icon}</div>
      <div className="text-white font-medium">{title}</div>
      <p className="text-xs text-slate-500 max-w-sm">{detail}</p>
      {action}
    </div>
  );
}

function UnsupportedFormatCard({
  scene,
  onRetry,
}: {
  scene: TwinSceneOutput;
  onRetry?: () => void;
}) {
  return (
    <Overlay
      icon={<Box className="w-8 h-8" />}
      title={`${scene.format.toUpperCase()} output`}
      detail="This format is not rendered in-browser yet. Download or open the asset, or export GLB/GLTF for the viewer."
      action={
        onRetry ? (
          <Button variant="outline" size="sm" className="mt-2 border-white/20" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        ) : (
          <a
            href={scene.outputUrl}
            className="text-xs text-cyan-400 hover:underline mt-1"
            target="_blank"
            rel="noreferrer"
          >
            Open URL
          </a>
        )
      }
    />
  );
}

export function TwinSceneStage({
  job,
  propertySelected,
  onRefresh,
  visualMode = "current",
  improvementPreset = "modern",
  nodes = [],
  placementEnabled = false,
  onAnchorPick,
  presentationMode = false,
  viewerClassName,
}: {
  job: JobRow | null;
  propertySelected: boolean;
  onRefresh?: () => void;
  visualMode?: "current" | "improved";
  improvementPreset?: ImprovementPreset;
  nodes?: TwinNodeAnchor[];
  placementEnabled?: boolean;
  onAnchorPick?: (p: { x: number; y: number; z: number }) => void;
  presentationMode?: boolean;
  /** e.g. h-[70vh] for presentation page */
  viewerClassName?: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  const scene = useMemo(() => {
    if (!job?.outputUrl) return null;
    return sceneOutputFromJob({
      outputUrl: job.outputUrl,
      resultJson: job.resultJson,
    });
  }, [job]);

  useEffect(() => {
    setLoadFailed(false);
  }, [job?.outputUrl, job?.resultJson]);

  const shellClass = viewerClassName ?? "h-[320px]";

  const shell = (children: ReactNode, overlay?: ReactNode, frameExtra?: string) => (
    <div
      className={`${shellClass} rounded-xl overflow-hidden border border-white/10 bg-[#070b1a] relative ${frameExtra ?? ""}`}
    >
      <Canvas shadows camera={{ position: [2.2, 1.4, 2.6], fov: 45 }}>{children}</Canvas>
      {overlay}
    </div>
  );

  if (!propertySelected) {
    return (
      <Overlay
        icon={<Box className="w-8 h-8 opacity-50" />}
        title="No property"
        detail="Select or create a property to attach reconstruction jobs and scene output."
      />
    );
  }

  if (!job) {
    return shell(
      <>
        <TwinScenePlaceholder visualMode={visualMode} improvementPreset={improvementPreset} />
        <AnchorMarkers nodes={nodes} />
        <PlacementPlane enabled={placementEnabled} onPick={onAnchorPick} />
      </>,
      !presentationMode ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
          <span className="text-[10px] text-center px-3 py-1 rounded-full bg-black/55 border border-white/10 text-slate-400 max-w-[90%]">
            No reconstruction job yet — create one below. Click the scene while placement is on to drop
            anchored nodes.
          </span>
          <VisualBadge visualMode={visualMode} preset={improvementPreset} />
        </div>
      ) : null,
      visualFrameClass(visualMode, improvementPreset)
    );
  }

  if (job.status === "failed") {
    return (
      <Overlay
        icon={<AlertTriangle className="w-8 h-8 text-amber-400" />}
        title="Reconstruction failed"
        detail={job.errorMessage ?? "The worker reported a failure. Fix inputs and retry."}
        action={
          onRefresh ? (
            <Button variant="outline" size="sm" className="mt-2 border-white/20" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh status
            </Button>
          ) : null
        }
      />
    );
  }

  if (job.status === "succeeded" && !scene) {
    return (
      <Overlay
        icon={<AlertTriangle className="w-8 h-8 text-amber-400" />}
        title="Missing scene output"
        detail="Job is marked succeeded but outputUrl is empty. The worker should set outputUrl and optional resultJson (format, previews)."
        action={
          onRefresh ? (
            <Button variant="outline" size="sm" className="mt-2 border-white/20" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          ) : null
        }
      />
    );
  }

  if (!scene && (job.status === "draft" || job.status === "queued" || job.status === "running")) {
    return (
      <Overlay
        icon={<Loader2 className="w-8 h-8 animate-spin text-cyan-400" />}
        title="Reconstruction pending"
        detail={
          job.status === "draft"
            ? "Submit the draft job to queue processing. When a worker runs, status moves to queued → running."
            : "Processing… Poll refreshes automatically while queued or running."
        }
      />
    );
  }

  if (!scene) {
    return shell(
      <>
        <TwinScenePlaceholder visualMode={visualMode} improvementPreset={improvementPreset} />
        <AnchorMarkers nodes={nodes} />
        <PlacementPlane enabled={placementEnabled} onPick={onAnchorPick} />
      </>,
      !presentationMode ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <VisualBadge visualMode={visualMode} preset={improvementPreset} />
        </div>
      ) : null,
      visualFrameClass(visualMode, improvementPreset)
    );
  }

  if (scene.format === "glb" || scene.format === "gltf") {
    if (loadFailed) {
      return (
        <Overlay
          icon={<AlertTriangle className="w-8 h-8 text-amber-400" />}
          title="Could not load model"
          detail="Check that the URL is reachable and CORS allows this origin. For local files, keep assets under /public."
          action={
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-white/20"
              onClick={() => {
                setLoadFailed(false);
                onRefresh?.();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          }
        />
      );
    }
    const gltfBg =
      visualMode === "improved"
        ? improvementPreset === "staged"
          ? "#120a08"
          : improvementPreset === "modern"
            ? "#050f1a"
            : "#0f0820"
        : "#0a1020";

    return shell(
      <>
        <color attach="background" args={[gltfBg]} />
        <ambientLight intensity={visualMode === "improved" ? 0.62 : 0.55} />
        <directionalLight position={[4, 6, 3]} intensity={visualMode === "improved" ? 1.18 : 1.1} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <Grid
          args={[40, 40]}
          cellSize={0.5}
          cellThickness={0.35}
          sectionSize={2}
          fadeDistance={28}
          position={[0, 0.001, 0]}
          sectionColor="#334155"
          cellColor="#1e293b"
        />
        <OrbitControls makeDefault minPolarAngle={0.15} maxPolarAngle={Math.PI / 2.05} />
        <Suspense
          fallback={
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[0.4, 0.4, 0.4]} />
              <meshStandardMaterial color="#38bdf8" wireframe />
            </mesh>
          }
        >
          <GltfErrorBoundary url={scene.outputUrl} onError={() => setLoadFailed(true)}>
            <LoadedGltf url={scene.outputUrl} />
          </GltfErrorBoundary>
        </Suspense>
        <AnchorMarkers nodes={nodes} />
        <PlacementPlane enabled={placementEnabled} onPick={onAnchorPick} />
      </>,
      !presentationMode ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <VisualBadge visualMode={visualMode} preset={improvementPreset} />
        </div>
      ) : null,
      visualFrameClass(visualMode, improvementPreset)
    );
  }

  return <UnsupportedFormatCard scene={scene} onRetry={onRefresh} />;
}
