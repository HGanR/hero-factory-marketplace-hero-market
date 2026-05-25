"use client";

/**
 * ApexBuildingViewer — 7-floor luxury business tower.
 * Ported from home/ubuntu/office-building-3d.
 * Interior: elevator, workers, WASD nav, NPCChatPanel.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildApexScene,
  updateApexElevator,
  getApexFloorY,
  APEX_FLOOR_HEIGHT,
  APEX_NUM_FLOORS,
  APEX_INTERIOR,
  APEX_ELEVATOR,
  type ApexElevatorState,
} from "@/lib/troo-world/apex/ApexBuildingScene";
import {
  createApexWorkerDefinitions,
  buildApexWorkerMesh,
  updateApexWorkerAnimation,
  type WorkerDef,
  type WorkerMesh,
} from "@/lib/troo-world/apex/ApexWorkerSystem";
import { buildApexExterior } from "@/lib/troo-world/apex/ApexExterior";
import NPCChatPanel from "../NPCChatPanel";
import { getNpcIdForApexWorker } from "@/lib/troo-world/npcMapping";

const WALK_SPEED = 0.09;
const SPRINT_SPEED = 0.18;
const LOOK_SENSITIVITY = 0.0018;
const PLAYER_HEIGHT = 1.65;

const FLOOR_NAMES = [
  "G — Reception & Concierge",
  "1F — Legal & Compliance",
  "2F — Finance & Accounting",
  "3F — Human Resources",
  "4F — Executive Leadership",
  "5F — Technology & Security",
  "6F — Strategy Suite",
];

function getRoleEmoji(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("ceo") || r.includes("chief exec")) return "👔";
  if (r.includes("cfo") || r.includes("finance") || r.includes("controller")) return "💰";
  if (r.includes("legal") || r.includes("counsel") || r.includes("attorney")) return "⚖️";
  if (r.includes("hr") || r.includes("people") || r.includes("talent")) return "🤝";
  if (r.includes("security") || r.includes("concierge")) return "🏛️";
  if (r.includes("strategy") || r.includes("consulting")) return "🚀";
  if (r.includes("tech") || r.includes("cto") || r.includes("ciso")) return "💻";
  return "💼";
}

export default function ApexBuildingViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());

  const camRef = useRef({
    mode: "exterior" as "exterior" | "interior",
    floor: 0,
    x: APEX_INTERIOR.x,
    y: PLAYER_HEIGHT,
    z: APEX_INTERIOR.z + 5,
    yaw: Math.PI,
    pitch: 0,
    isInElevator: false,
  });
  const orbitRef = useRef({ theta: 0.6, phi: 0.32, radius: 55, isDragging: false, lastX: 0, lastY: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const pointerLockedRef = useRef(false);

  const elevStateRef = useRef<ApexElevatorState>({
    currentFloor: 0,
    targetFloor: 0,
    cabY: 0,
    doorOpenAmount: 0,
    isMoving: false,
    doorState: "opening",
    doorTimer: 0,
  });
  const elevCabRef = useRef<THREE.Group | null>(null);
  const elevDoorLRef = useRef<THREE.Mesh | null>(null);
  const elevDoorRRef = useRef<THREE.Mesh | null>(null);

  const workerMeshesRef = useRef<WorkerMesh[]>([]);

  const [mode, setMode] = useState<"exterior" | "interior">("exterior");
  const [currentFloor, setCurrentFloor] = useState(0);
  const [elevFloor, setElevFloor] = useState(0);
  const [elevDoorState, setElevDoorState] = useState<string>("opening");
  const [isInElevator, setIsInElevator] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerDef | null>(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0700);
    scene.fog = new THREE.Fog(0x0d0700, 70, 150);

    scene.add(new THREE.AmbientLight(0xfff0d0, 0.85));
    const sun = new THREE.DirectionalLight(0xffd080, 2.0);
    sun.position.set(30, 60, 30);
    sun.castShadow = true;
    scene.add(sun);
    const fillLight = new THREE.DirectionalLight(0xff8c00, 0.45);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);

    const { cab, doorL, doorR } = buildApexScene(scene);
    elevCabRef.current = cab;
    elevDoorLRef.current = doorL;
    elevDoorRRef.current = doorR;

    const exteriorGroup = buildApexExterior();
    exteriorGroup.position.set(0, 0, 0);
    scene.add(exteriorGroup);

    const defs = createApexWorkerDefinitions();
    const meshes: WorkerMesh[] = [];
    for (const def of defs) {
      const wm = buildApexWorkerMesh(def);
      scene.add(wm.group);
      meshes.push(wm);
    }
    workerMeshesRef.current = meshes;

    const camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 300);
    camera.position.set(0, 22, 60);
    camera.lookAt(0, 12, 0);
    cameraRef.current = camera;

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === "Escape") {
        document.exitPointerLock();
        setSelectedWorker(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handleClick = (e: MouseEvent) => {
      if (pointerLockedRef.current) return;
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes.map((m) => m.group), true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !(obj.userData as { workerDef?: WorkerDef }).workerDef) obj = obj.parent;
        const def = obj ? (obj.userData as { workerDef?: WorkerDef }).workerDef : null;
        if (def) setSelectedWorker(def);
      }
    };
    container.addEventListener("click", handleClick);

    const onPointerLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === container;
      setPointerLocked(pointerLockedRef.current);
    };
    document.addEventListener("pointerlockchange", onPointerLockChange);
    container.addEventListener("click", () => {
      if (camRef.current.mode === "interior" && !pointerLockedRef.current && !selectedWorker) {
        container.requestPointerLock();
      }
    });

    const onMouseMove = (e: MouseEvent) => {
      if (camRef.current.mode === "exterior") {
        if (orbitRef.current.isDragging) {
          orbitRef.current.theta -= e.movementX * 0.005;
          orbitRef.current.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, orbitRef.current.phi - e.movementY * 0.005));
        }
        return;
      }
      if (!pointerLockedRef.current) return;
      camRef.current.yaw -= e.movementX * LOOK_SENSITIVITY;
      camRef.current.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, camRef.current.pitch - e.movementY * LOOK_SENSITIVITY));
    };
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mousedown", (e) => {
      if (camRef.current.mode === "exterior") orbitRef.current.isDragging = e.button === 0;
    });
    container.addEventListener("mouseup", () => {
      orbitRef.current.isDragging = false;
    });
    container.addEventListener("wheel", (e) => {
      orbitRef.current.radius = Math.max(20, Math.min(120, orbitRef.current.radius + e.deltaY * 0.05));
    });

    const onResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clockRef.current.getDelta(), 0.05);
      const cam = camRef.current;
      const elev = elevStateRef.current;

      for (const wm of meshes) updateApexWorkerAnimation(wm, dt);

      if (elevCabRef.current && elevDoorLRef.current && elevDoorRRef.current) {
        updateApexElevator(elev, elevCabRef.current, elevDoorLRef.current, elevDoorRRef.current, dt);
        setElevFloor(elev.currentFloor);
        setElevDoorState(elev.doorState);
        setIsInElevator(cam.isInElevator);
      }

      for (const wm of meshes) {
        wm.group.visible = cam.mode === "interior" && wm.def.floor === cam.floor;
      }

      if (cam.mode === "exterior") {
        const { theta, phi, radius } = orbitRef.current;
        camera.position.set(
          Math.sin(theta) * Math.cos(phi) * radius,
          Math.sin(phi) * radius + 12,
          Math.cos(theta) * Math.cos(phi) * radius
        );
        camera.lookAt(0, 12, 0);
      } else {
        const speed = keysRef.current["ShiftLeft"] || keysRef.current["ShiftRight"] ? SPRINT_SPEED : WALK_SPEED;
        const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
        const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));

        if (!cam.isInElevator) {
          if (keysRef.current["KeyW"] || keysRef.current["ArrowUp"]) {
            cam.x += fwd.x * speed;
            cam.z += fwd.z * speed;
          }
          if (keysRef.current["KeyS"] || keysRef.current["ArrowDown"]) {
            cam.x -= fwd.x * speed;
            cam.z -= fwd.z * speed;
          }
          if (keysRef.current["KeyA"] || keysRef.current["ArrowLeft"]) {
            cam.x -= right.x * speed;
            cam.z -= right.z * speed;
          }
          if (keysRef.current["KeyD"] || keysRef.current["ArrowRight"]) {
            cam.x += right.x * speed;
            cam.z += right.z * speed;
          }

          const hw = APEX_INTERIOR.width / 2 - 0.5;
          const hd = APEX_INTERIOR.depth / 2 - 0.5;
          cam.x = Math.max(APEX_INTERIOR.x - hw, Math.min(APEX_INTERIOR.x + hw, cam.x));
          cam.z = Math.max(APEX_INTERIOR.z - hd, Math.min(APEX_INTERIOR.z + hd, cam.z));
        }

        cam.isInElevator =
          Math.abs(cam.x - APEX_ELEVATOR.x) < 1.3 && Math.abs(cam.z - APEX_ELEVATOR.z) < 1.3;

        const targetY = getApexFloorY(cam.floor) + PLAYER_HEIGHT;
        cam.y += (targetY - cam.y) * 0.15;

        setCurrentFloor(cam.floor);
        camera.position.set(cam.x, cam.y, cam.z);
        const lookDir = new THREE.Vector3(
          -Math.sin(cam.yaw) * Math.cos(cam.pitch),
          Math.sin(cam.pitch),
          -Math.cos(cam.yaw) * Math.cos(cam.pitch)
        );
        camera.lookAt(cam.x + lookDir.x, cam.y + lookDir.y, cam.z + lookDir.z);
      }

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, []);

  const enterBuilding = () => {
    const cam = camRef.current;
    cam.mode = "interior";
    cam.floor = 0;
    cam.x = APEX_INTERIOR.x;
    cam.z = APEX_INTERIOR.z + 4;
    cam.y = getApexFloorY(0) + PLAYER_HEIGHT;
    cam.yaw = Math.PI;
    cam.pitch = 0;
    cam.isInElevator = false;
    setMode("interior");
    setCurrentFloor(0);
    setTimeout(() => setShowHint(false), 4000);
  };

  const exitBuilding = () => {
    camRef.current.mode = "exterior";
    setMode("exterior");
    if (document.pointerLockElement) document.exitPointerLock();
  };

  const callElevator = (floor: number) => {
    const elev = elevStateRef.current;
    const cam = camRef.current;
    if (elev.isMoving) return;
    elev.targetFloor = floor;
    elev.isMoving = true;
    elev.doorState = "closing";
    const check = setInterval(() => {
      if (!elevStateRef.current.isMoving) {
        cam.floor = floor;
        cam.x = APEX_ELEVATOR.x;
        cam.z = APEX_ELEVATOR.z;
        cam.isInElevator = false;
        setCurrentFloor(floor);
        clearInterval(check);
      }
    }, 100);
  };

  return (
    <div className="relative w-full h-screen bg-[#0d0700] overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-black/70 backdrop-blur-sm border-b border-amber-900/40 z-10">
        <div className="flex items-center gap-3">
          <span className="text-amber-300 font-semibold text-sm tracking-wider">⬡ APEX TOWER</span>
          {mode === "interior" && (
            <>
              <span className="text-amber-900/60">|</span>
              <span className="text-amber-500 text-xs">{FLOOR_NAMES[currentFloor]}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {mode === "exterior" ? (
            <button
              onClick={enterBuilding}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded transition-colors shadow-lg shadow-amber-900/40"
            >
              Enter Building →
            </button>
          ) : (
            <button
              onClick={exitBuilding}
              className="px-3 py-1.5 bg-amber-900/50 hover:bg-amber-800/70 text-amber-300 text-xs font-medium rounded border border-amber-700/40 transition-colors"
            >
              ← Exit to Exterior
            </button>
          )}
        </div>
      </div>

      {mode === "interior" && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
          {FLOOR_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => callElevator(i)}
              title={name}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                i === currentFloor ? "bg-amber-400 scale-125 shadow-[0_0_10px_rgba(251,191,36,0.9)]" : "bg-amber-900/60 hover:bg-amber-600 hover:scale-110"
              }`}
            />
          ))}
        </div>
      )}

      {mode === "interior" && isInElevator && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 p-3 bg-black/80 border border-amber-700/50 rounded-xl backdrop-blur-sm">
          <div className="text-amber-400 text-xs font-mono text-center mb-1 tracking-widest">
            {elevDoorState === "open" || elevDoorState === "opening" ? "▶◀" : "◀▶"} FL {elevFloor}
          </div>
          {FLOOR_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => callElevator(i)}
              className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                i === elevFloor ? "bg-amber-500 text-black font-bold" : "bg-amber-900/40 text-amber-300 hover:bg-amber-700/60"
              }`}
            >
              {i === 0 ? "G" : `${i}F`} {i === 6 ? "★" : ""}
            </button>
          ))}
        </div>
      )}

      {mode === "interior" && !isInElevator && (
        <div className="absolute right-4 bottom-24 z-10 flex flex-col gap-1">
          <div className="text-amber-600/60 text-xs font-mono text-center mb-1">ELEVATOR</div>
          {FLOOR_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => callElevator(i)}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-all ${
                i === currentFloor ? "bg-amber-500/30 text-amber-300 border border-amber-500/50" : "bg-black/40 text-amber-700 hover:text-amber-400 hover:bg-amber-900/30"
              }`}
            >
              {i === 0 ? "G" : `${i}F`} {i === 6 ? "★" : ""}
            </button>
          ))}
        </div>
      )}

      {mode === "interior" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 flex-wrap justify-center">
          {createApexWorkerDefinitions()
            .filter((d) => d.floor === currentFloor)
            .map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedWorker(d)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 border border-amber-700/50 rounded-full text-xs text-amber-300 hover:bg-amber-900/50 hover:border-amber-500 transition-all backdrop-blur-sm"
              >
                <span>{getRoleEmoji(d.role)}</span>
                <span className="font-medium">{d.name}</span>
              </button>
            ))}
        </div>
      )}

      {mode === "interior" && showHint && !pointerLocked && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-black/70 border border-amber-700/30 rounded-lg text-amber-400/80 text-xs font-mono backdrop-blur-sm text-center">
          Click to lock mouse · WASD to walk · Shift to sprint · ESC to unlock
        </div>
      )}
      {mode === "interior" && pointerLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-5">
          <div className="w-3 h-3 border border-amber-400/60 rounded-full flex items-center justify-center">
            <div className="w-0.5 h-0.5 bg-amber-400/80 rounded-full" />
          </div>
        </div>
      )}

      {mode === "exterior" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-center">
          <div className="px-5 py-3 bg-black/70 border border-amber-700/40 rounded-xl backdrop-blur-sm">
            <p className="text-amber-300 text-sm font-semibold mb-1">⬡ Apex Tower</p>
            <p className="text-amber-600 text-xs">7 floors · 14 AI specialists · Luxury Strategy Suite</p>
            <p className="text-amber-800 text-xs mt-1">Drag to orbit · Scroll to zoom</p>
          </div>
        </div>
      )}

      {selectedWorker && (
        <NPCChatPanel
          npcId={getNpcIdForApexWorker(selectedWorker.id, selectedWorker.role)}
          npcName={selectedWorker.name}
          npcTitle={selectedWorker.role}
          onClose={() => setSelectedWorker(null)}
        />
      )}
    </div>
  );
}
