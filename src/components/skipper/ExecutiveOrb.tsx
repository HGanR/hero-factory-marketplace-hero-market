"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { NeuralCoreMesh } from "./orb/NeuralCoreShaderMaterial";
import { ParticleField } from "./orb/ParticleField";
import { FrequencyRing } from "./orb/FrequencyRing";
import { VoiceReactiveLayer } from "./orb/VoiceReactiveLayer";
import { AgentPulseSignals } from "./orb/AgentPulseSignals";
import { TelemetryField } from "./orb/TelemetryField";

export type OrbMode =
  | "idle"
  | "listening"
  | "speaking"
  | "processing"
  | "alert"
  | "monitoring"
  | "incident"
  | "approval_waiting"
  | "escalation"
  | "crisis_coordination"
  | "strategic_analysis"
  | "workflow_recovery";

export type OperationalIntelligenceState = Extract<
  OrbMode,
  | "idle"
  | "monitoring"
  | "incident"
  | "approval_waiting"
  | "escalation"
  | "crisis_coordination"
  | "strategic_analysis"
  | "workflow_recovery"
>;

/** Values consumed by the neural orb stack and HUD overlay. */
export type ExecutiveOrbTelemetry = {
  intensity: number;
  mode: OrbMode;
  activeAgentCount: number;
  dataThroughput: number;
  focusMode: string;
};

type SceneProps = ExecutiveOrbTelemetry;

function OrbScene({ intensity, mode, activeAgentCount, dataThroughput }: SceneProps) {
  const alert =
    mode === "alert" ||
    mode === "incident" ||
    mode === "approval_waiting" ||
    mode === "escalation" ||
    mode === "crisis_coordination";
  const processing = mode === "processing" || mode === "strategic_analysis" || mode === "workflow_recovery";
  const modeFactor =
    processing ? 1 : mode === "listening" ? 0.65 : mode === "speaking" ? 0.95 : mode === "monitoring" ? 0.4 : 0.22;
  const energy = intensity + (mode === "speaking" ? 0.22 : mode === "listening" ? 0.08 : 0);

  return (
    <>
      <color attach="background" args={["#00050a"]} />
      <TelemetryField throughput={dataThroughput} intensity={intensity} />
      <VoiceReactiveLayer intensity={intensity} mode={mode}>
        <ParticleField energy={energy} />
        <NeuralCoreMesh intensity={intensity} alert={alert} />
        <FrequencyRing intensity={intensity} modeFactor={modeFactor} alert={alert} />
        <FrequencyRing
          innerRadius={0.84}
          outerRadius={0.93}
          intensity={intensity * 0.72 + 0.08}
          modeFactor={modeFactor * 0.75}
          alert={alert}
        />
        <AgentPulseSignals agentCount={activeAgentCount} intensity={intensity} />
      </VoiceReactiveLayer>
    </>
  );
}

type ExecutiveOrbProps = ExecutiveOrbTelemetry & { className?: string };

export function ExecutiveOrb({ className, ...scene }: ExecutiveOrbProps) {
  return (
    <div className={`relative h-full min-h-[300px] w-full ${className ?? ""}`}>
      <Canvas
        className="h-full w-full rounded-2xl"
        dpr={[1, 2]}
        gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 2.85], fov: 42, near: 0.1, far: 20 }}
      >
        <Suspense fallback={null}>
          <OrbScene {...scene} />
        </Suspense>
      </Canvas>
    </div>
  );
}
