"use client";

/**
 * MeridianBuildingViewer — Meridian Tower
 * 2-floor office building with receptionist avatars, elevator, first-person navigation, and AI chat.
 * Scenery: procedural lobby & office. NPC knowledge: Admin → NPCS.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { buildModernBuilding, B, TOTAL_H } from "@/lib/troo-world/meridian/ModernBuilding";
import {
  buildAvatar,
  updateAvatarAnimation,
  triggerGreet,
  RECEPTIONIST_DEFS,
  type AvatarMesh,
} from "@/lib/troo-world/meridian/ReceptionistAvatar";
import NPCChatPanel from "../NPCChatPanel";
import { getNpcIdForMeridianAvatar } from "@/lib/troo-world/npcMapping";

const WALK_SPEED = 0.07;
const LOOK_SENSITIVITY = 0.0018;
const PLAYER_HEIGHT = 1.65;
const FLOOR_NAMES = ["Ground Floor — Lobby", "2nd Floor — Office"];

export default function MeridianBuildingViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const rafRef = useRef<number>(0);

  const orbitRef = useRef({ theta: 0.6, phi: 0.32, radius: 38, isDragging: false, lastX: 0, lastY: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const camStateRef = useRef({ yaw: Math.PI, pitch: 0 });
  const pointerLockedRef = useRef(false);

  const avatarsRef = useRef<AvatarMesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseNDCRef = useRef(new THREE.Vector2());

  const elevCabRef = useRef<THREE.Group | null>(null);
  const elevDoorsRef = useRef<THREE.Mesh[]>([]);
  const elevStateRef = useRef<"idle" | "closing" | "moving" | "opening">("idle");
  const elevCurrentFloorRef = useRef(0);
  const elevTargetFloorRef = useRef(0);
  const elevDoorTRef = useRef(0);

  const [viewMode, setViewMode] = useState<"exterior" | "interior">("exterior");
  const [currentFloor, setCurrentFloor] = useState(0);
  const [elevFloor, setElevFloor] = useState(0);
  const [elevMoving, setElevMoving] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarMesh | null>(null);
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);
  const [showElevPanel, setShowElevPanel] = useState(false);

  const viewModeRef = useRef<"exterior" | "interior">("exterior");
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);
    scene.fog = new THREE.FogExp2(0x0a0e14, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.05, 300);
    camera.position.set(30, 12, 30);
    camera.lookAt(0, TOTAL_H / 2, 0);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0x6688aa, 0.8));
    const hemi = new THREE.HemisphereLight(0x1a2535, 0x0d1520, 0.8);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff8e8, 2.0);
    sun.position.set(25, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x6494c8, 0.6);
    fill.position.set(-20, 15, -15);
    scene.add(fill);

    const { cab, doors } = buildModernBuilding(scene);
    elevCabRef.current = cab;
    elevDoorsRef.current = doors;

    for (const def of RECEPTIONIST_DEFS) {
      const av = buildAvatar(def, 0.15);
      scene.add(av.group);
      avatarsRef.current.push(av);
    }

    const onResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(mount);

    const onMouseDown = (e: MouseEvent) => {
      if (viewModeRef.current === "exterior") {
        orbitRef.current.isDragging = true;
        orbitRef.current.lastX = e.clientX;
        orbitRef.current.lastY = e.clientY;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      const orbit = orbitRef.current;
      if (viewModeRef.current === "exterior" && orbit.isDragging) {
        orbit.theta -= (e.clientX - orbit.lastX) * 0.005;
        orbit.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, orbit.phi - (e.clientY - orbit.lastY) * 0.005));
        orbit.lastX = e.clientX;
        orbit.lastY = e.clientY;
      } else if (pointerLockedRef.current) {
        camStateRef.current.yaw -= e.movementX * LOOK_SENSITIVITY;
        camStateRef.current.pitch = Math.max(
          -Math.PI / 2.5,
          Math.min(Math.PI / 2.5, camStateRef.current.pitch - e.movementY * LOOK_SENSITIVITY)
        );
      }
    };
    const onMouseUp = () => {
      orbitRef.current.isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (viewModeRef.current === "exterior") {
        orbitRef.current.radius = Math.max(10, Math.min(90, orbitRef.current.radius + e.deltaY * 0.05));
      }
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

    const onPLChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      pointerLockedRef.current = locked;
      setPointerLocked(locked);
    };
    document.addEventListener("pointerlockchange", onPLChange);

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === "Escape") setSelectedAvatar(null);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const tickElevator = (delta: number) => {
      const cab = elevCabRef.current;
      if (!cab) return;
      const state = elevStateRef.current;
      if (state === "idle") return;

      const animDoors = (floor: number, openAmt: number) => {
        for (const door of elevDoorsRef.current) {
          const ud = (door as THREE.Mesh & { userData: { floor?: number; closedX?: number; openX?: number } }).userData;
          if (ud.floor !== floor) continue;
          const closedX = ud.closedX ?? 0;
          const openX = ud.openX ?? 0;
          door.position.x = closedX + (openX - closedX) * openAmt;
        }
      };

      if (state === "closing") {
        elevDoorTRef.current += delta / 1.0;
        const t = Math.min(elevDoorTRef.current, 1);
        animDoors(elevCurrentFloorRef.current, 1 - t);
        if (t >= 1) {
          elevStateRef.current = "moving";
          elevDoorTRef.current = 0;
        }
      } else if (state === "moving") {
        const targetY = elevTargetFloorRef.current * B.floorH;
        const diff = targetY - cab.position.y;
        if (Math.abs(diff) < 0.04) {
          cab.position.y = targetY;
          elevCurrentFloorRef.current = elevTargetFloorRef.current;
          setElevFloor(elevTargetFloorRef.current);
          setElevMoving(false);
          elevStateRef.current = "opening";
          elevDoorTRef.current = 0;
        } else {
          cab.position.y += Math.sign(diff) * Math.min(3.5 * delta, Math.abs(diff));
        }
      } else if (state === "opening") {
        elevDoorTRef.current += delta / 1.2;
        const t = Math.min(elevDoorTRef.current, 1);
        animDoors(elevCurrentFloorRef.current, t);
        if (t >= 1) {
          elevStateRef.current = "idle";
          elevDoorTRef.current = 0;
        }
      }
    };

    const tickFP = (delta: number) => {
      const camera = cameraRef.current;
      if (!camera) return;
      const { yaw, pitch } = camStateRef.current;
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));

      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const keys = keysRef.current;
      const move = new THREE.Vector3();
      if (keys["KeyW"] || keys["ArrowUp"]) move.addScaledVector(fwd, WALK_SPEED);
      if (keys["KeyS"] || keys["ArrowDown"]) move.addScaledVector(fwd, -WALK_SPEED);
      if (keys["KeyA"] || keys["ArrowLeft"]) move.addScaledVector(right, -WALK_SPEED);
      if (keys["KeyD"] || keys["ArrowRight"]) move.addScaledVector(right, WALK_SPEED);

      const halfW = B.width / 2 - 0.6;
      const halfD = B.depth / 2 - 0.6;
      camera.position.x = Math.max(B.cx - halfW, Math.min(B.cx + halfW, camera.position.x + move.x));
      camera.position.z = Math.max(B.cz - halfD, Math.min(B.cz + halfD, camera.position.z + move.z));
    };

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clockRef.current.getDelta(), 0.05);
      const time = clockRef.current.getElapsedTime();

      for (const av of avatarsRef.current) updateAvatarAnimation(av, time);
      tickElevator(delta);

      if (viewModeRef.current === "exterior") {
        const o = orbitRef.current;
        const tx = B.cx + o.radius * Math.sin(o.theta) * Math.cos(o.phi);
        const ty = o.radius * Math.sin(o.phi) + TOTAL_H * 0.3;
        const tz = B.cz + o.radius * Math.cos(o.theta) * Math.cos(o.phi);
        camera.position.lerp(new THREE.Vector3(tx, ty, tz), 0.08);
        camera.lookAt(B.cx, TOTAL_H * 0.4, B.cz);
      } else if (pointerLockedRef.current) {
        tickFP(delta);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObs.disconnect();
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      document.removeEventListener("pointerlockchange", onPLChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.dispose();
      const ext = renderer.getContext().getExtension("WEBGL_lose_context");
      ext?.loseContext();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  const enterBuilding = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(B.cx, PLAYER_HEIGHT, B.cz + B.depth / 2 - 1.8);
    camStateRef.current = { yaw: Math.PI, pitch: 0 };
    camera.fov = 72;
    camera.updateProjectionMatrix();
    setViewMode("interior");
    setCurrentFloor(0);
    setTimeout(() => {
      for (const av of avatarsRef.current) triggerGreet(av);
    }, 400);
  }, []);

  const exitBuilding = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    if (document.pointerLockElement) document.exitPointerLock();
    camera.fov = 60;
    camera.updateProjectionMatrix();
    setViewMode("exterior");
    setSelectedAvatar(null);
    setShowElevPanel(false);
  }, []);

  const callElevator = useCallback((floor: number) => {
    if (elevStateRef.current !== "idle") return;
    elevTargetFloorRef.current = floor;
    elevStateRef.current = "closing";
    elevDoorTRef.current = 0;
    setElevMoving(true);
  }, []);

  const goToFloor = useCallback(
    (floor: number) => {
      const camera = cameraRef.current;
      if (!camera) return;
      camera.position.y = floor * B.floorH + PLAYER_HEIGHT;
      setCurrentFloor(floor);
      callElevator(floor);
      setShowElevPanel(false);
    },
    [callElevator]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (viewMode === "exterior") {
        enterBuilding();
        return;
      }
      if (pointerLockedRef.current) {
        document.exitPointerLock();
        return;
      }

      const mount = mountRef.current;
      const camera = cameraRef.current;
      if (!mount || !camera) return;

      const rect = mount.getBoundingClientRect();
      mouseNDCRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDCRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseNDCRef.current, camera);
      const meshes: THREE.Object3D[] = [];
      for (const av of avatarsRef.current) {
        av.group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) meshes.push(o);
        });
      }
      const hits = raycasterRef.current.intersectObjects(meshes, false);
      if (hits.length > 0) {
        for (const av of avatarsRef.current) {
          let found = false;
          av.group.traverse((o) => {
            if (o === hits[0].object) found = true;
          });
          if (found) {
            setSelectedAvatar(av);
            triggerGreet(av);
            return;
          }
        }
      }
    },
    [viewMode, enterBuilding]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (viewMode !== "interior" || pointerLockedRef.current) return;
      const mount = mountRef.current;
      const camera = cameraRef.current;
      if (!mount || !camera) return;

      const rect = mount.getBoundingClientRect();
      mouseNDCRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDCRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseNDCRef.current, camera);
      const meshes: THREE.Object3D[] = [];
      for (const av of avatarsRef.current) {
        av.group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) meshes.push(o);
        });
      }
      const hits = raycasterRef.current.intersectObjects(meshes, false);
      if (hits.length > 0) {
        for (const av of avatarsRef.current) {
          let found = false;
          av.group.traverse((o) => {
            if (o === hits[0].object) found = true;
          });
          if (found) {
            setHoveredAvatarId(av.def.id);
            return;
          }
        }
      }
      setHoveredAvatarId(null);
    },
    [viewMode]
  );

  const lockPointer = useCallback(() => {
    rendererRef.current?.domElement.requestPointerLock();
  }, []);

  return (
    <div
      className="relative w-full h-full min-h-[600px] overflow-hidden bg-[#0a0e14] select-none"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <div
        ref={mountRef}
        className="w-full h-full"
        style={{
          cursor:
            hoveredAvatarId ? "pointer" : viewMode === "interior" && !pointerLocked ? "crosshair" : "default",
        }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
      />

      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(2,4,8,0.9) 0%, transparent 100%)" }}
      >
        <div>
          <div className="text-white font-bold text-xl tracking-wide">MERIDIAN TOWER</div>
          <div className="text-[#64b4dc] text-xs tracking-widest uppercase mt-0.5">
            {viewMode === "exterior" ? "Modern Office Complex" : FLOOR_NAMES[currentFloor]}
          </div>
        </div>
        {viewMode === "interior" && (
          <button
            className="pointer-events-auto px-4 py-2 text-sm text-[#64b4dc] border border-[#64b4dc33] rounded hover:bg-[#64b4dc15] transition-colors tracking-wider"
            onClick={exitBuilding}
          >
            ← Exit Building
          </button>
        )}
      </div>

      {viewMode === "exterior" && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <button
            onClick={enterBuilding}
            className="bg-[#64b4dc] hover:bg-[#7ac4ec] text-[#020408] px-10 py-3.5 rounded-full text-sm font-semibold shadow-xl transition-all"
          >
            Enter Building
          </button>
          <p className="text-[#4a6a8a] text-xs">Drag to orbit · Scroll to zoom</p>
        </div>
      )}

      {viewMode === "interior" && !pointerLocked && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-3">
          <button
            onClick={lockPointer}
            className="bg-[#0d1b2a] hover:bg-[#1a2a3a] text-[#64b4dc] px-5 py-2.5 rounded-full text-xs font-medium border border-[#64b4dc33] transition"
          >
            🖱 Free Look
          </button>
          <button
            onClick={() => setShowElevPanel((p) => !p)}
            className={`px-5 py-2.5 rounded-full text-xs font-medium transition border ${
              showElevPanel
                ? "bg-[#64b4dc15] text-[#64b4dc] border-[#64b4dc44]"
                : "bg-[#0d1b2a] text-[#64b4dc] border-[#64b4dc22] hover:bg-[#1a2a3a]"
            }`}
          >
            🛗 Elevator
          </button>
        </div>
      )}

      {pointerLocked && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[#64b4dc]/80 text-xs bg-black/35 backdrop-blur-sm px-4 py-1.5 rounded-full pointer-events-none">
          WASD — Move · Mouse — Look · ESC — Unlock
        </div>
      )}

      {pointerLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-5 h-5">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#64b4dc]/70 -translate-y-px" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#64b4dc]/70 -translate-x-px" />
            <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#64b4dc]/70" />
          </div>
        </div>
      )}

      {showElevPanel && viewMode === "interior" && (
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 w-48 rounded-xl overflow-hidden"
          style={{
            background: "rgba(10, 15, 30, 0.9)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(100, 180, 220, 0.2)",
            boxShadow: "0 0 30px rgba(100, 180, 220, 0.1)",
          }}
        >
          <div className="px-4 py-3 border-b border-[#64b4dc22]">
            <div className="text-[#64b4dc] text-xs font-bold tracking-widest uppercase">Elevator</div>
            <div className="text-white text-lg font-bold mt-1">
              Floor {elevFloor + 1} {elevMoving && "· Moving..."}
            </div>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {FLOOR_NAMES.map((_, i) => (
              <button
                key={i}
                onClick={() => goToFloor(i)}
                disabled={elevMoving}
                className={`w-full py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentFloor === i
                    ? "bg-[#64b4dc] text-[#020408]"
                    : "bg-[#0d1b2a] text-[#6a9abf] hover:bg-[#1a2a3a] border border-[#1a2a3a] disabled:opacity-40"
                }`}
              >
                <span className="font-bold">{i + 1}F</span> — {i === 0 ? "Lobby" : "Office"}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode === "interior" && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 flex flex-col gap-2.5">
          {FLOOR_NAMES.map((_, i) => (
            <button
              key={i}
              onClick={() => goToFloor(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                currentFloor === i ? "bg-[#64b4dc] scale-125 shadow-[0_0_6px_#64b4dc]" : "bg-[#1a3a5a] hover:bg-[#3a6a9a]"
              }`}
            />
          ))}
        </div>
      )}

      {hoveredAvatarId && !pointerLocked && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#0d1b2a]/95 text-[#64b4dc] text-xs px-4 py-2 rounded-full pointer-events-none border border-[#64b4dc33]">
          {avatarsRef.current.find((a) => a.def.id === hoveredAvatarId)?.def.name}
          <span className="text-[#4a8aaa] ml-1">· Click to chat with AI agent</span>
        </div>
      )}

      {selectedAvatar && (() => {
        const npcId = getNpcIdForMeridianAvatar(selectedAvatar.def.id);
        return npcId ? (
          <NPCChatPanel
            npcId={npcId}
            npcName={selectedAvatar.def.name}
            npcTitle={selectedAvatar.def.role}
            onClose={() => setSelectedAvatar(null)}
          />
        ) : null;
      })()}

      <div
        className="absolute bottom-0 left-0 right-0 px-6 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(to top, rgba(2,4,8,0.9) 0%, transparent 100%)" }}
      >
        <div className="text-[#3a5a7a] text-xs tracking-wider">
          {viewMode === "interior"
            ? "Click receptionists to chat with AI agents (Admin → NPCS)"
            : "Drag to orbit · Scroll to zoom"}
        </div>
      </div>
    </div>
  );
}
