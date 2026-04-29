"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArcRotateCamera,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  SceneLoader,
  Vector3,
} from "@babylonjs/core";

type ViewerProps = {
  modelUrl?: string | null;
  skyboxColor?: string;
};

export default function OasisWorldViewer({ modelUrl, skyboxColor = "#0b1220" }: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Loading scene...");

  useEffect(() => {
    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let cancelled = false;

    async function boot() {
      if (!canvasRef.current) return;
      if (!cancelled) setStatus("Initializing Babylon...");

      await import("@babylonjs/loaders");

      engine = new Engine(canvasRef.current, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });

      scene = new Scene(engine);
      scene.clearColor = Color4.FromHexString(skyboxColor + "ff");

      const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene);
      camera.attachControl(canvasRef.current, true);
      camera.wheelPrecision = 45;

      new HemisphericLight("hemilight", new Vector3(0, 1, 0), scene);
      const dirLight = new DirectionalLight("dirlight", new Vector3(-2, -4, -2), scene);
      dirLight.position = new Vector3(20, 40, 20);

      MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene);

      if (modelUrl) {
        try {
          if (!cancelled) setStatus("Loading model...");
          await SceneLoader.AppendAsync("", modelUrl, scene);
          if (!cancelled) setStatus("");
        } catch (err) {
          if (!cancelled) setStatus("Failed to load model.");
        }
      } else {
        if (!cancelled) setStatus("No model selected.");
      }

      engine.runRenderLoop(() => {
        if (!scene) return;
        scene.render();
      });

      const onResize = () => engine?.resize();
      window.addEventListener("resize", onResize);

      return () => window.removeEventListener("resize", onResize);
    }

    boot();

    return () => {
      cancelled = true;
      if (engine) {
        engine.stopRenderLoop();
        engine.dispose();
      }
      if (scene) {
        scene.dispose();
      }
    };
  }, [modelUrl, skyboxColor]);

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden border border-white/10 bg-slate-950/60">
      <canvas ref={canvasRef} className="h-full w-full" />
      {status ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-300 bg-black/40">
          {status}
        </div>
      ) : null}
    </div>
  );
}
