"use client";

/**
 * Stadium Elyseum — GLB venue asset for green-terrain / Troo Town.
 * Purchasable from World Explorer catalog; placeable in green-terrain editor.
 * Animates screens, host node, VR cams, ticker (emissive pulse) when insideBuilding.
 * TROO STADIUM holographic band on EXTERIOR (like the inner ring but outside).
 * When event is hosted, host performance/title displayed on screens.
 */
import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

const MODEL_URL = "/models/world-assets/stadium-elyseum.glb";

/** Draco on, Meshopt off — this GLB is not meshopt-compressed; skipping MeshoptDecoder avoids extra WASM + chunk init that can interact badly with WebGL/SWC bundles. */
const GLTF_LOADER_OPTS = [true, false] as const;

export interface StadiumElyseumProps {
  position: [number, number, number];
  scale?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  /** When true, runs entrance animations (screens, host, VR cams, ticker pulse, rotating signage) */
  animate?: boolean;
  /** When set, displayed on stadium screens (host performance / event title) */
  activeEventTitle?: string | null;
}

// Build TROO STADIUM holographic signage — bold white text with bright glow on dark blue band (matches inner ring style)
function buildSignageTexture(): THREE.CanvasTexture {
  const CW = 2048;
  const CH = 320;
  const cvs = document.createElement("canvas");
  cvs.width = CW;
  cvs.height = CH;
  const ctx = cvs.getContext("2d")!;
  ctx.fillStyle = "#0a1628";
  ctx.fillRect(0, 0, CW, CH);
  const text = "TROO STADIUM";
  const fontSize = 140;
  ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let rep = 0; rep < 5; rep++) {
    const cx = (CW / 5) * rep + CW / 10;
    const cy = CH / 2;
    ctx.shadowColor = "#a0d8ff";
    ctx.shadowBlur = 48;
    ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(200, 230, 255, 0.95)";
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, cx, cy);
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

// Build screen texture for host performance / event title
function buildScreenTexture(title: string): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const cvs = document.createElement("canvas");
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext("2d")!;
  ctx.fillStyle = "#0a1628";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#00E5FF";
  ctx.strokeStyle = "#00E5FF";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.font = `900 48px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("LIVE", W / 2, 50);
  ctx.font = `700 36px Arial, sans-serif`;
  ctx.fillStyle = "#a0d8ff";
  const lines = title.length > 40 ? [title.slice(0, 40) + "..."] : title.match(/.{1,25}/g) || [title];
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, W / 2, 120 + i * 45));
  return new THREE.CanvasTexture(cvs);
}

export default function StadiumElyseum({ position, scale = 1, isSelected, onSelect, animate = false, activeEventTitle }: StadiumElyseumProps) {
  const gltf = useGLTF(MODEL_URL, ...GLTF_LOADER_OPTS);
  const groupRef = useRef<THREE.Group>(null);
  const scene = useMemo(() => gltf.scene.clone(), [gltf.scene]);

  const signageRef = useRef<THREE.Mesh>(null);
  const signageTex = useMemo(() => buildSignageTexture(), []);

  const screenTex = useMemo(() => activeEventTitle ? buildScreenTexture(activeEventTitle) : null, [activeEventTitle]);

  // Navy blue for outside walls (Bowl_Wall, Roof_Ring)
  const NAVY_BLUE = 0x000080;
  useEffect(() => {
    function isWallOrRoof(obj: THREE.Object3D): boolean {
      let o: THREE.Object3D | null = obj;
      while (o) {
        const n = o.name || "";
        if (n === "Bowl_Wall" || n === "Roof_Ring") return true;
        o = o.parent;
      }
      return false;
    }
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (!isWallOrRoof(mesh)) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m && (m as THREE.MeshStandardMaterial).color) {
          (m as THREE.MeshStandardMaterial).color.setHex(NAVY_BLUE);
        }
      });
    });
  }, [scene]);

  useEffect(() => {
    if (!screenTex || !activeEventTitle) return;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.name.startsWith("SCREEN_")) return;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (mat) {
        (mat as THREE.MeshStandardMaterial).map = screenTex;
      }
    });
    return () => {
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.name.startsWith("SCREEN_")) return;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat) (mat as THREE.MeshStandardMaterial).map = null;
      });
    };
  }, [scene, screenTex, activeEventTitle]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (animate && scene) {
      scene.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const n = mesh.name;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (!mat || !(mat as THREE.MeshStandardMaterial).emissive) return;
        const m = mat as THREE.MeshStandardMaterial;
        if (n === "SPAWN_HOST") {
          mesh.scale.y = 1 + 0.3 * Math.sin(t * 3);
          m.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 3);
        } else if (n.startsWith("VR_CAM")) {
          m.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 2 + 1);
        } else if (n === "Ticker_Board") {
          m.emissiveIntensity = 0.8 + 0.2 * Math.sin(t * 4);
        } else if (n.startsWith("SCREEN_")) {
          m.emissiveIntensity = activeEventTitle ? 1.8 : 1.2 + 0.3 * Math.sin(t * 1.5);
        }
      });
    }
    if (signageRef.current?.material) {
      const m = signageRef.current.material as THREE.MeshStandardMaterial;
      if (m.map) m.map.offset.x = (t * 0.04) % 1;
      m.emissiveIntensity = 2.8 + 0.5 * Math.sin(t * 2);
    }
  });

  return (
    <>
      <group ref={groupRef} position={position} scale={scale} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
        <primitive object={scene} />
        {/* Raised stage platform — adds depth to interior */}
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[6, 32]} />
          <meshStandardMaterial color={0x1a1a2e} roughness={0.9} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.8, 6, 32]} />
          <meshStandardMaterial color={0x00E5FF} emissive={0x003344} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
            <ringGeometry args={[8, 10, 32]} />
            <meshBasicMaterial color={0xffdd44} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      {/* TROO STADIUM holographic band — matches outer black ring diameter at top of stadium */}
      <group position={position} scale={scale} renderOrder={100}>
        <mesh ref={signageRef} position={[0, 26, 0]} renderOrder={10}>
          <cylinderGeometry args={[41, 41, 4, 64, 1, true]} />
          <meshStandardMaterial
            map={signageTex}
            emissiveMap={signageTex}
            emissive={new THREE.Color(0xa0d8ff)}
            emissiveIntensity={4}
            side={THREE.FrontSide}
            depthWrite={true}
          />
        </mesh>
      </group>
    </>
  );
}

useGLTF.preload(MODEL_URL, ...GLTF_LOADER_OPTS);
