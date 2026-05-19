"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

const VS = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  attribute float aPhase;
  attribute float aRadius;
  varying float vAlpha;
  void main() {
    float orbit = uTime * 0.12 + aPhase;
    float r = aRadius * (0.85 + 0.15 * sin(uTime * 0.35 + aPhase * 2.0));
    vec3 base = vec3(cos(orbit) * r, sin(orbit * 0.7) * r * 0.35, sin(orbit) * r);
    float turb = sin(uTime * 1.1 + aPhase * 5.0) * 0.04 * (0.4 + uEnergy);
    vec3 pos = base + vec3(turb, turb * 0.6, turb * 0.8);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix(1.2, 3.2, uEnergy) * (140.0 / -mv.z);
    vAlpha = 0.25 + uEnergy * 0.45;
  }
`;

const FS = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.15, d);
    gl_FragColor = vec4(uColor, soft * vAlpha);
  }
`;

type Props = {
  count?: number;
  maxRadius?: number;
  energy: number;
};

/** Deterministic 0–1 hash for stable particle seeds (no Math.random in render). */
function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function ParticleField({ count = 1800, maxRadius = 0.95, energy }: Props) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { geometry } = useMemo(() => {
    const phases = new Float32Array(count);
    const radii = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      phases[i] = hash01(i, 1) * Math.PI * 2;
      radii[i] = 0.15 + hash01(i, 2) * maxRadius;
    }
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, count);
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
    return { geometry: geo };
  }, [count, maxRadius]);

  useFrame((state) => {
    const m = mat.current;
    if (m) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uEnergy.value = energy;
    }
  });

  return (
    <points frustumCulled={false} renderOrder={0}>
      <primitive object={geometry} attach="geometry" />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={VS}
        fragmentShader={FS}
        uniforms={{
          uTime: { value: 0 },
          uEnergy: { value: 0 },
          uColor: { value: new THREE.Color("#00A3FF") },
        }}
      />
    </points>
  );
}
