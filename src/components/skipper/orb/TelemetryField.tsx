"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

const VS = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  attribute vec3 aDir;
  attribute float aSeed;
  varying float vA;
  void main() {
    float life = fract(aSeed + uTime * (0.03 + uFlow * 0.08));
    vec3 drift = aDir * (0.35 + life * 0.85);
    float w = sin(uTime * 1.3 + aSeed * 20.0) * 0.05;
    vec3 pos = drift * (0.9 + uFlow * 0.2) + vec3(w, w * 0.7, w);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix(1.0, 2.2, uFlow) * (90.0 / -mv.z);
    vA = (1.0 - life) * 0.35;
  }
`;

const FS = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    if (length(c) > 0.5) discard;
    gl_FragColor = vec4(uColor, vA);
  }
`;

type Props = { throughput: number; intensity: number };

function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 19.9898 + salt * 91.233) * 43758.5453;
  return x - Math.floor(x);
}

export function TelemetryField({ throughput, intensity }: Props) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const count = 420;
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const dirs = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = hash01(i, 3) * Math.PI * 2;
      const v = Math.acos(2 * hash01(i, 4) - 1);
      dirs[i * 3] = Math.sin(v) * Math.cos(u);
      dirs[i * 3 + 1] = Math.sin(v) * Math.sin(u);
      dirs[i * 3 + 2] = Math.cos(v);
      seeds[i] = hash01(i, 5);
    }
    const pos = new Float32Array(count * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, count);
    geo.setAttribute("aDir", new THREE.BufferAttribute(dirs, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, []);

  useFrame((state) => {
    const m = mat.current;
    if (m) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      const flow = THREE.MathUtils.clamp(throughput / 1_000_000, 0.15, 1.2) + intensity * 0.25;
      m.uniforms.uFlow.value = flow;
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
          uFlow: {
            value: THREE.MathUtils.clamp(throughput / 1_000_000, 0.15, 1.2) + intensity * 0.25,
          },
          uColor: { value: new THREE.Color("#00A3FF") },
        }}
      />
    </points>
  );
}
