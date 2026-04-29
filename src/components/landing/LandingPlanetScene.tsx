"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { LandingPlanet } from "./LandingPlanet";

export function LandingPlanetScene() {
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[140px] h-[140px] sm:w-[180px] sm:h-[180px] md:w-[240px] md:h-[240px] lg:w-[280px] lg:h-[280px] pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#00D1FF" />
        <pointLight position={[-3, -2, 2]} intensity={0.8} color="#00D1FF" />
        <pointLight position={[2, 3, -1]} intensity={0.5} color="#00D1FF" />
        <Suspense fallback={null}>
          <LandingPlanet />
        </Suspense>
      </Canvas>
    </div>
  );
}
