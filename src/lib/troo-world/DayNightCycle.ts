/**
 * DayNightCycle.ts
 *
 * Manages a full 24-hour day/night cycle for the campus world.
 *
 * Time is stored as a normalised value in [0, 1) representing the fraction
 * of a full day elapsed.  The mapping is:
 *   0.00  →  midnight
 *   0.25  →  6 AM  (sunrise)
 *   0.50  →  noon
 *   0.75  →  6 PM  (sunset)
 *   1.00  →  midnight (wraps)
 *
 * Features:
 *  - Sun sphere that arcs across the sky (east → west)
 *  - Moon sphere visible at night
 *  - Star field that fades in at dusk / out at dawn
 *  - Dynamic sky colour (scene.background + fog)
 *  - Ambient + directional (sun) light intensity and colour
 *  - Hemisphere light sky/ground colour
 *  - Building window glow (emissive) that activates at night
 */

import * as THREE from "three";

interface Keyframe {
  t: number;
  sky: THREE.Color;
  fog: THREE.Color;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
}

function c(hex: number) {
  return new THREE.Color(hex);
}

const KEYFRAMES: Keyframe[] = [
  { t: 0.0, sky: c(0x020510), fog: c(0x020510), ambientColor: c(0x1a2040), ambientIntensity: 0.12, sunColor: c(0x000000), sunIntensity: 0.0, hemiSky: c(0x0a0f20), hemiGround: c(0x050a10), hemiIntensity: 0.15 },
  { t: 0.2, sky: c(0x0d1a3a), fog: c(0x0d1a3a), ambientColor: c(0x203060), ambientIntensity: 0.18, sunColor: c(0x000000), sunIntensity: 0.0, hemiSky: c(0x0d1a3a), hemiGround: c(0x080d18), hemiIntensity: 0.2 },
  { t: 0.25, sky: c(0xff8c42), fog: c(0xf5a060), ambientColor: c(0xffd0a0), ambientIntensity: 0.45, sunColor: c(0xff9944), sunIntensity: 0.9, hemiSky: c(0xff8c42), hemiGround: c(0x3a2a10), hemiIntensity: 0.5 },
  { t: 0.33, sky: c(0x6ab0e8), fog: c(0x7ec0f0), ambientColor: c(0xfff0d8), ambientIntensity: 0.65, sunColor: c(0xffe8c0), sunIntensity: 1.4, hemiSky: c(0x87ceeb), hemiGround: c(0x4a7c3f), hemiIntensity: 0.55 },
  { t: 0.5, sky: c(0x87ceeb), fog: c(0x87ceeb), ambientColor: c(0xffffff), ambientIntensity: 0.75, sunColor: c(0xfff8e8), sunIntensity: 2.0, hemiSky: c(0x87ceeb), hemiGround: c(0x4a7c3f), hemiIntensity: 0.6 },
  { t: 0.65, sky: c(0x6ab0e8), fog: c(0x7ec0f0), ambientColor: c(0xfff0d8), ambientIntensity: 0.65, sunColor: c(0xffe8c0), sunIntensity: 1.6, hemiSky: c(0x87ceeb), hemiGround: c(0x4a7c3f), hemiIntensity: 0.55 },
  { t: 0.75, sky: c(0xff6030), fog: c(0xff7040), ambientColor: c(0xffa060), ambientIntensity: 0.4, sunColor: c(0xff5500), sunIntensity: 0.8, hemiSky: c(0xff6030), hemiGround: c(0x3a1a08), hemiIntensity: 0.45 },
  { t: 0.82, sky: c(0x1a0a30), fog: c(0x1a0a30), ambientColor: c(0x302060), ambientIntensity: 0.2, sunColor: c(0x000000), sunIntensity: 0.0, hemiSky: c(0x1a0a30), hemiGround: c(0x0a0510), hemiIntensity: 0.2 },
  { t: 0.9, sky: c(0x020510), fog: c(0x020510), ambientColor: c(0x1a2040), ambientIntensity: 0.12, sunColor: c(0x000000), sunIntensity: 0.0, hemiSky: c(0x0a0f20), hemiGround: c(0x050a10), hemiIntensity: 0.15 },
  { t: 1.0, sky: c(0x020510), fog: c(0x020510), ambientColor: c(0x1a2040), ambientIntensity: 0.12, sunColor: c(0x000000), sunIntensity: 0.0, hemiSky: c(0x0a0f20), hemiGround: c(0x050a10), hemiIntensity: 0.15 },
];

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color().lerpColors(a, b, t);
}

function getKeyframeValues(time: number): Omit<Keyframe, "t"> {
  let lo = KEYFRAMES[KEYFRAMES.length - 1]!;
  let hi = KEYFRAMES[0]!;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (time >= KEYFRAMES[i]!.t && time < KEYFRAMES[i + 1]!.t) {
      lo = KEYFRAMES[i]!;
      hi = KEYFRAMES[i + 1]!;
      break;
    }
  }
  const span = hi.t - lo.t;
  const alpha = span > 0 ? (time - lo.t) / span : 0;
  return {
    sky: lerpColor(lo.sky, hi.sky, alpha),
    fog: lerpColor(lo.fog, hi.fog, alpha),
    ambientColor: lerpColor(lo.ambientColor, hi.ambientColor, alpha),
    ambientIntensity: lo.ambientIntensity + (hi.ambientIntensity - lo.ambientIntensity) * alpha,
    sunColor: lerpColor(lo.sunColor, hi.sunColor, alpha),
    sunIntensity: lo.sunIntensity + (hi.sunIntensity - lo.sunIntensity) * alpha,
    hemiSky: lerpColor(lo.hemiSky, hi.hemiSky, alpha),
    hemiGround: lerpColor(lo.hemiGround, hi.hemiGround, alpha),
    hemiIntensity: lo.hemiIntensity + (hi.hemiIntensity - lo.hemiIntensity) * alpha,
  };
}

function getSunPosition(time: number, radius = 180): THREE.Vector3 {
  const sunAngle = ((time - 0.25) * Math.PI) / 0.5;
  const elevation = Math.sin(sunAngle);
  const horizontal = Math.cos(sunAngle);
  return new THREE.Vector3(horizontal * radius * 0.8, elevation * radius, -horizontal * radius * 0.4);
}

function getMoonPosition(time: number, radius = 180): THREE.Vector3 {
  const moonTime = (time + 0.5) % 1.0;
  const moonAngle = ((moonTime - 0.25) * Math.PI) / 0.5;
  const elevation = Math.sin(moonAngle);
  const horizontal = Math.cos(moonAngle);
  return new THREE.Vector3(horizontal * radius * 0.8, elevation * radius, -horizontal * radius * 0.4);
}

function buildStarField(): THREE.Points {
  const count = 1500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 400;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, sizeAttenuation: true, transparent: true, opacity: 0 });
  const stars = new THREE.Points(geo, mat);
  stars.name = "starField";
  return stars;
}

function buildSunSphere(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(6, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "sunSphere";
  return mesh;
}

function buildMoonSphere(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(4, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xd0d8e8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "moonSphere";
  return mesh;
}

export interface DayNightCycleOptions {
  initialTime?: number;
  dayDurationSeconds?: number;
}

export interface DayNightCycleHandle {
  getTime(): number;
  setTime(t: number): void;
  tick(deltaSeconds: number): void;
  getTimeString(): string;
  getPhaseName(): string;
  dispose(scene: THREE.Scene): void;
  isNight(): boolean;
}

export function createDayNightCycle(
  scene: THREE.Scene,
  ambientLight: THREE.AmbientLight,
  sunLight: THREE.DirectionalLight,
  hemiLight: THREE.HemisphereLight,
  options: DayNightCycleOptions = {}
): DayNightCycleHandle {
  const dayDuration = options.dayDurationSeconds ?? 300;
  let time = options.initialTime ?? 0.5;

  const starField = buildStarField();
  scene.add(starField);
  const sunSphere = buildSunSphere();
  scene.add(sunSphere);
  const moonSphere = buildMoonSphere();
  scene.add(moonSphere);

  function applyToScene() {
    const kf = getKeyframeValues(time);
    (scene.background as THREE.Color).copy(kf.sky);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(kf.fog);
    }
    ambientLight.color.copy(kf.ambientColor);
    ambientLight.intensity = kf.ambientIntensity;
    sunLight.color.copy(kf.sunColor);
    sunLight.intensity = kf.sunIntensity;
    hemiLight.color.copy(kf.hemiSky);
    hemiLight.groundColor.copy(kf.hemiGround);
    hemiLight.intensity = kf.hemiIntensity;

    const sunPos = getSunPosition(time);
    sunSphere.position.copy(sunPos);
    sunLight.position.copy(sunPos.clone().normalize().multiplyScalar(120));

    const sunVisible = time > 0.22 && time < 0.78;
    sunSphere.visible = sunVisible;
    if (sunVisible) {
      const noonFactor = Math.sin(((time - 0.25) * Math.PI) / 0.5);
      const sunMat = sunSphere.material as THREE.MeshBasicMaterial;
      sunMat.color.lerpColors(new THREE.Color(0xff6600), new THREE.Color(0xfff8e0), noonFactor);
    }

    const moonPos = getMoonPosition(time);
    moonSphere.position.copy(moonPos);
    moonSphere.visible = !sunVisible || time < 0.27 || time > 0.73;

    const starMat = starField.material as THREE.PointsMaterial;
    if (time >= 0.85 || time <= 0.15) {
      starMat.opacity = 1.0;
    } else if (time > 0.78 && time < 0.85) {
      starMat.opacity = (time - 0.78) / 0.07;
    } else if (time > 0.15 && time < 0.22) {
      starMat.opacity = 1.0 - (time - 0.15) / 0.07;
    } else {
      starMat.opacity = 0.0;
    }

    const nightFactor = Math.max(0, 1 - Math.abs(time - 0.5) * 4);
    const windowGlow = Math.max(0, 1 - nightFactor * 2);
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && (obj.userData as { isWindowGlass?: boolean }).isWindowGlass) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        if (mat.emissive) {
          mat.emissiveIntensity = windowGlow * 0.6;
          if (windowGlow > 0.1 && mat.emissive.r === 0 && mat.emissive.g === 0 && mat.emissive.b === 0) {
            mat.emissive.set(0xfff0c0);
          }
        }
      }
    });
  }

  function tick(deltaSeconds: number) {
    time = (time + deltaSeconds / dayDuration) % 1.0;
    applyToScene();
  }

  function getTimeString(): string {
    const totalMinutes = Math.floor(time * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function getPhaseName(): string {
    if (time < 0.21) return "Night";
    if (time < 0.27) return "Dawn";
    if (time < 0.4) return "Morning";
    if (time < 0.6) return "Midday";
    if (time < 0.73) return "Afternoon";
    if (time < 0.8) return "Dusk";
    return "Night";
  }

  function isNight(): boolean {
    return time < 0.23 || time > 0.77;
  }

  function dispose(sc: THREE.Scene) {
    sc.remove(starField);
    sc.remove(sunSphere);
    sc.remove(moonSphere);
    (starField.geometry as THREE.BufferGeometry).dispose();
    (sunSphere.geometry as THREE.SphereGeometry).dispose();
    (moonSphere.geometry as THREE.SphereGeometry).dispose();
  }

  applyToScene();

  return {
    getTime: () => time,
    setTime: (t: number) => {
      time = Math.max(0, Math.min(0.9999, t));
      applyToScene();
    },
    tick,
    getTimeString,
    getPhaseName,
    dispose,
    isNight,
  };
}
