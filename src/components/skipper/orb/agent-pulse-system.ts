import * as THREE from "three";

/** Orbit angles (rad) for agent communication pulses around the neural core. */
export function agentPulseAngles(count: number, phase: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / Math.max(1, count)) * Math.PI * 2 + phase * 0.15;
    out.push(t);
  }
  return out;
}

export function pulsePointOnRing(angle: number, radius: number, wobble: number): THREE.Vector3 {
  const w = Math.sin(angle * 3 + wobble) * 0.06;
  return new THREE.Vector3(Math.cos(angle) * (radius + w), Math.sin(angle * 0.7) * 0.12, Math.sin(angle) * (radius + w));
}
