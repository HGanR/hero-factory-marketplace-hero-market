/* eslint-disable react-hooks/immutability -- ShaderMaterial uniforms are updated each frame by R3F useFrame. */
"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";

const NeuralCoreMaterial = shaderMaterial(
  {
    uTime: 0,
    uIntensity: 0,
    uAlert: 0,
    uColor: new THREE.Color("#00A3FF"),
    uAccent: new THREE.Color("#00FF85"),
  },
  /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    uniform float uTime;
    uniform float uIntensity;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec3 pos = position;
      float breathe = sin(uTime * 0.9) * 0.012;
      float voice = sin(uTime * 2.4 + pos.y * 10.0 + pos.x * 6.0) * 0.055 * (0.28 + uIntensity * 1.6);
      vec3 displaced = pos + normal * (breathe + voice);
      vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uAccent;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uAlert;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec3 n = normalize(vNormal);
      float fresnel = pow(1.0 - abs(dot(n, vView)), 2.4);
      vec3 alertMix = mix(uColor, vec3(1.0, 0.15, 0.2), uAlert * 0.55);
      float core = 0.22 + fresnel * (1.05 + uIntensity * 0.95);
      vec3 col = mix(alertMix, uAccent, fresnel * 0.08 * (1.0 - uAlert));
      col *= core;
      col += vec3(0.85, 0.95, 1.0) * fresnel * 0.06;
      float alpha = 0.86 + uIntensity * 0.1;
      gl_FragColor = vec4(col, alpha);
    }
  `,
);

type NeuralCoreMat = InstanceType<typeof NeuralCoreMaterial>;

type Props = {
  radius?: number;
  intensity: number;
  alert: boolean;
};

export function NeuralCoreMesh({ radius = 0.52, intensity, alert }: Props) {
  const [mat] = useState(() => new NeuralCoreMaterial() as NeuralCoreMat);
  const alertSmooth = useRef(0);

  useEffect(() => () => mat.dispose(), [mat]);

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uIntensity.value = intensity;
    const target = alert ? 1 : 0;
    alertSmooth.current = THREE.MathUtils.lerp(alertSmooth.current, target, 0.08);
    mat.uniforms.uAlert.value = alertSmooth.current;
  });

  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={[radius, 96, 96]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
