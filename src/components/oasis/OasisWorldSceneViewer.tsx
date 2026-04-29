"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArcRotateCamera,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  Quaternion,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders";
import type { WorldBlueprint, WorldObject } from "@/lib/oasis/world-blueprint-schema";

const SKYBOX_COLOR = "#0b1220";
const GROUND_SIZE = 50;
const PLACEHOLDER_BOX_SIZE = 2;
const LOAD_CONCURRENCY = 5;
const CAMERA_DISTANCE = 12;
const CAMERA_HEIGHT_OFFSET = 8;

type ResolvedAsset = {
  id: string | number;
  name: string;
  url: string;
  bounds: [number, number, number];
  defaultScale: number;
  colliderType: string;
  tags: string[];
};

type LoadPhase = "BOOT" | "TERRAIN" | "ASSETS" | "DONE";
type AssetError = { assetId: string | number; url?: string; reason: string };
type LoadProgress = {
  phase: LoadPhase;
  done: number;
  total: number;
  failed: number;
  status: string;
};
type OasisWorldSceneViewerProps = {
  sceneGraph: WorldBlueprint;
  onProgress?: (p: LoadProgress) => void;
};

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  const inFlight = new Set<Promise<void>>();

  const launch = async () => {
    while (idx < items.length) {
      const i = idx++;
      const item = items[i];
      const p = (async () => {
        const r = await worker(item);
        results[i] = r;
      })().finally(() => inFlight.delete(p));
      inFlight.add(p);
      if (inFlight.size >= limit) await Promise.race(inFlight);
    }
  };

  await launch();
  while (inFlight.size) {
    await Promise.race(inFlight);
  }
  return results;
}

function isVegetation(obj: WorldObject): boolean {
  return obj.type === "vegetation" || (obj.tags ?? []).includes("vegetation");
}

/** Y offset so object bottom sits on ground (pivot-at-center). */
function groundY(pos: [number, number, number], bounds: [number, number, number], scale: number): number {
  if (pos[1] > 0.01) return pos[1]; // already has lift from assembly
  return (bounds[1] * scale) / 2;
}

export default function OasisWorldSceneViewer({ sceneGraph, onProgress }: OasisWorldSceneViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<LoadPhase>("BOOT");
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [errors, setErrors] = useState<AssetError[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const report = useCallback(
    (p: Partial<LoadProgress>) => {
      setPhase((prev) => (p.phase ?? prev));
      setProgress((prev) => ({
        done: p.done ?? prev.done,
        total: p.total ?? prev.total,
        failed: p.failed ?? prev.failed,
      }));
      onProgress?.({
        phase: p.phase ?? "BOOT",
        done: p.done ?? 0,
        total: p.total ?? 0,
        failed: p.failed ?? 0,
        status: p.status ?? "",
      });
    },
    [onProgress]
  );

  useEffect(() => {
    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let cancelled = false;
    const collectedErrors: AssetError[] = [];

    async function boot() {
      if (!canvasRef.current) return;
      report({ phase: "BOOT", done: 0, total: 1, failed: 0, status: "Initializing Babylon…" });

      const {
        Engine,
        Scene,
        ArcRotateCamera,
        HemisphericLight,
        DirectionalLight,
        Color4,
        MeshBuilder,
        Matrix,
        Quaternion,
        Vector3,
        SceneLoader,
        TransformNode,
      } = await import("@babylonjs/core");
      await import("@babylonjs/loaders");

      engine = new Engine(canvasRef.current, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      scene = new Scene(engine);
      scene.clearColor = Color4.FromHexString(SKYBOX_COLOR + "ff");
      scene.collisionsEnabled = true;

      const spawn = sceneGraph.spawnPoints?.[0] ?? [0, 2, 5];
      const spawnVec = new Vector3(spawn[0], spawn[1], spawn[2]);
      const cameraPos = new Vector3(
        spawn[0],
        spawn[1] + CAMERA_HEIGHT_OFFSET,
        spawn[2] + CAMERA_DISTANCE
      );

      const camera = new ArcRotateCamera(
        "camera",
        Math.PI / 2,
        Math.PI / 3,
        CAMERA_DISTANCE,
        spawnVec,
        scene
      );
      camera.position.copyFrom(cameraPos);
      camera.attachControl(canvasRef.current, true);
      camera.wheelPrecision = 45;

      new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
      // Note: ArcRotateCamera doesn't support ellipsoid/checkCollisions like UniversalCamera
      const dirLight = new DirectionalLight("dir", new Vector3(-2, -4, -2), scene);
      dirLight.position = new Vector3(20, 40, 20);

      const ground = MeshBuilder.CreateGround("ground", { width: GROUND_SIZE, height: GROUND_SIZE }, scene);
      ground.checkCollisions = true;

      report({ phase: "TERRAIN", done: 0, total: 1, status: "Terrain ready. Resolving assets…" });

      const objects = sceneGraph.objects ?? [];
      const uniqueAssetIds = [...new Set(objects.map((o) => (typeof o.assetRef === "number" ? o.assetRef : -1)).filter((id) => id >= 0))];

      const resolvedMap = new Map<string | number, ResolvedAsset | null>();
      const resolveResults = await Promise.allSettled(
        uniqueAssetIds.map(async (id) => {
          const res = await fetch(`/api/oasis/assets/${id}`);
          if (!res.ok) throw new Error(`Asset ${id}: ${res.status}`);
          return res.json();
        })
      );
      uniqueAssetIds.forEach((id, i) => {
        const r = resolveResults[i];
        if (r.status === "fulfilled") resolvedMap.set(id, r.value);
        else resolvedMap.set(id, null);
      });

      const vegetationByAsset = new Map<number, WorldObject[]>();
      const nonVegetation: WorldObject[] = [];
      objects.forEach((obj) => {
        const ref = obj.assetRef;
        if (typeof ref !== "number") return;
        if (isVegetation(obj)) {
          const list = vegetationByAsset.get(ref) ?? [];
          list.push(obj);
          vegetationByAsset.set(ref, list);
        } else {
          nonVegetation.push(obj);
        }
      });

      type LoadItem = { kind: "single"; obj: WorldObject } | { kind: "vegetation"; assetId: number; objs: WorldObject[] };
      const loadItems: LoadItem[] = [
        ...nonVegetation.map((obj) => ({ kind: "single" as const, obj })),
        ...Array.from(vegetationByAsset.entries()).map(([assetId, objs]) => ({ kind: "vegetation" as const, assetId, objs })),
      ];
      const total = loadItems.length;
      report({ phase: "ASSETS", done: 0, total, failed: 0, status: `Loading assets (0/${total})…` });

      let done = 0;
      let failed = 0;
      const inc = () => {
        done++;
        report({ done, total, failed, status: `Loading (${done}/${total})…` });
      };

      await runWithConcurrency(loadItems, LOAD_CONCURRENCY, async (item: LoadItem) => {
        if (cancelled) return;

        if (item.kind === "vegetation") {
          const { assetId, objs } = item;
          const asset = resolvedMap.get(assetId) ?? null;
          const url = asset?.url;

          if (!url) {
            const bnds: [number, number, number] = [2, 2, 2];
            objs.forEach((o) => {
              collectedErrors.push({ assetId, reason: "No URL" });
              const root = new TransformNode(o.id, scene!);
              const pos = o.transform?.position ?? [0, 0, 0];
              const s = typeof o.transform?.scale === "number" ? o.transform.scale : 1;
              const y = groundY(pos as [number, number, number], bnds, s);
              root.position.set(pos[0], y, pos[2]);
              MeshBuilder.CreateBox(o.id + "_ph", { size: PLACEHOLDER_BOX_SIZE }, scene!).setParent(root);
            });
            failed += objs.length;
            inc();
            return;
          }

          try {
            const result = await SceneLoader.ImportMeshAsync("", "", url, scene!);
            const meshes = result.meshes;
            if (!meshes.length) throw new Error("No meshes");

            const bnds = asset?.bounds ?? [2, 2, 2];
            const useThinInstance = objs.length >= 3 && typeof (meshes[0] as any).thinInstanceSetBuffer === "function";
            const sourceMesh = meshes[0] as any;

            if (useThinInstance && sourceMesh) {
              const matrices = new Float32Array(objs.length * 16);
              objs.forEach((o, i) => {
                const pos = o.transform?.position ?? [0, 0, 0];
                const rot = o.transform?.rotation ?? [0, 0, 0];
                const s = typeof o.transform?.scale === "number" ? o.transform.scale : 1;
                const y = groundY(pos as [number, number, number], bnds, s);
                const m = Matrix.Compose(
                  new Vector3(s, s, s),
                  Quaternion.FromEulerAngles(rot[0], rot[1], rot[2]),
                  new Vector3(pos[0], y, pos[2])
                );
                m.copyToArray(matrices, i * 16);
              });
              sourceMesh.thinInstanceSetBuffer("matrix", matrices, 16);
              sourceMesh.name = `vegetation_${assetId}`;
            } else {
              const bnds = asset?.bounds ?? [2, 2, 2];
              objs.forEach((o, i) => {
                const root = new TransformNode(o.id, scene!);
                const pos = o.transform?.position ?? [0, 0, 0];
                const rot = o.transform?.rotation ?? [0, 0, 0];
                const s = typeof o.transform?.scale === "number" ? o.transform.scale : 1;
                const y = groundY(pos as [number, number, number], bnds, s);
                root.position.set(pos[0], y, pos[2]);
                root.rotation.set(rot[0], rot[1], rot[2]);
                root.scaling.set(s, s, s);
                if (i === 0) {
                  meshes.forEach((m: any) => m.setParent(root));
                } else {
                  meshes.forEach((m: any) => {
                    const clone = m.clone(m.name + "_c" + i);
                    if (clone) clone.setParent(root);
                  });
                }
              });
            }
          } catch (e) {
            objs.forEach(() => collectedErrors.push({ assetId, url, reason: String((e as Error)?.message ?? "Load failed") }));
            const bnds = asset?.bounds ?? [2, 2, 2];
            objs.forEach((o) => {
              const root = new TransformNode(o.id, scene!);
              const pos = o.transform?.position ?? [0, 0, 0];
              const s = typeof o.transform?.scale === "number" ? o.transform.scale : 1;
              const y = groundY(pos as [number, number, number], bnds, s);
              root.position.set(pos[0], y, pos[2]);
              MeshBuilder.CreateBox(o.id + "_ph", { size: PLACEHOLDER_BOX_SIZE }, scene!).setParent(root);
            });
            failed += objs.length;
          }
          inc();
          return;
        }

        const { obj } = item;
        const ref = obj.assetRef;
        const cacheKey = typeof ref === "number" ? ref : -1;
        const asset = cacheKey >= 0 ? resolvedMap.get(cacheKey) ?? null : null;
        const url = asset?.url;
        const pos = obj.transform?.position ?? [0, 0, 0];
        const rot = obj.transform?.rotation ?? [0, 0, 0];
        const scale = typeof obj.transform?.scale === "number" ? obj.transform.scale : 1;
        const bnds = asset?.bounds ?? [2, 2, 2];
        const y = groundY(pos as [number, number, number], bnds, scale);

        const root = new TransformNode(obj.id, scene!);
        root.position.set(pos[0], y, pos[2]);
        root.rotation.set(rot[0], rot[1], rot[2]);
        root.scaling.set(scale, scale, scale);

        if (url) {
          try {
            const result = await SceneLoader.ImportMeshAsync("", "", url, scene!);
            if (result.meshes.length) result.meshes.forEach((m: any) => m.setParent(root));
          } catch (e) {
            collectedErrors.push({
              assetId: cacheKey,
              url,
              reason: String((e as Error)?.message ?? "Load failed"),
            });
            MeshBuilder.CreateBox(obj.id + "_ph", { size: PLACEHOLDER_BOX_SIZE }, scene!).setParent(root);
            failed++;
          }
        } else {
          MeshBuilder.CreateBox(obj.id + "_ph", { size: PLACEHOLDER_BOX_SIZE }, scene!).setParent(root);
        }
        inc();
      });

      if (cancelled) return;
      setErrors(collectedErrors);
      report({ phase: "DONE", done: total, total, failed, status: "" });

      engine!.runRenderLoop(() => scene!.render());
      window.addEventListener("resize", () => engine!.resize());
      return () => window.removeEventListener("resize", () => engine!.resize());
    }

    boot().catch((e) => {
      if (!cancelled) setErrors((prev) => [...prev, { assetId: -1, reason: String((e as Error)?.message) }]);
    });

    return () => {
      cancelled = true;
      engine?.stopRenderLoop();
      engine?.dispose();
      scene?.dispose();
    };
  }, [sceneGraph, report]);

  return (
    <div className="relative h-full w-full min-h-[400px] rounded-xl overflow-hidden border border-white/10 bg-slate-950/60">
      <canvas ref={canvasRef} className="h-full w-full" />
      {phase !== "DONE" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-slate-300 bg-black/50 gap-2">
          <div className="animate-pulse">{phase === "BOOT" ? "Initializing…" : phase === "TERRAIN" ? "Terrain ready…" : `Loading assets (${progress.done}/${progress.total})…`}</div>
          <div className="h-1 w-48 bg-slate-700 rounded overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ) : null}
      {errors.length > 0 ? (
        <div className="absolute bottom-2 left-2 right-2">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="text-xs text-amber-300 hover:underline"
          >
            Asset load issues ({errors.length})
          </button>
          {showErrors ? (
            <div className="mt-1 max-h-24 overflow-auto rounded bg-black/70 p-2 text-xs text-slate-400 space-y-1">
              {errors.slice(0, 10).map((e, i) => (
                <div key={i}>
                  {e.assetId}: {e.reason}
                  {e.url ? ` (${e.url.slice(0, 40)}…)` : ""}
                </div>
              ))}
              {errors.length > 10 ? <div>…and {errors.length - 10} more</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
