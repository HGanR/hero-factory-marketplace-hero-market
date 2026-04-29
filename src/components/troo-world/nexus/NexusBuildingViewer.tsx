"use client";

/**
 * Nexus Tower Building Viewer
 * Full interactive 9-floor office with workers, elevator, and AI chat.
 * Scenery: procedural interiors, GLB exterior. NPC knowledge: Admin → NPCS.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BUILDING_GLB_URL,
  BUILDING,
  FLOOR_HEIGHT,
  INTERIOR,
  ELEVATOR,
  buildScene,
  updateElevator,
  getFloorCameraY,
  getDefaultExteriorCamera,
  type ElevatorState,
  type CameraState,
} from "@/lib/troo-world/nexus/BuildingScene";
import {
  createWorkerDefinitions,
  buildWorkerMesh,
  updateWorkerAnimation,
  type WorkerDef,
  type WorkerMesh,
} from "@/lib/troo-world/nexus/WorkerSystem";
import NPCChatPanel from "../NPCChatPanel";
import { getNpcIdForNexusWorker } from "@/lib/troo-world/npcMapping";

const FLOOR_NAMES = [
  "G  — Lobby & Reception",
  "1F — Open Office A",
  "2F — Open Office B",
  "3F — Conference Center",
  "4F — Open Office C",
  "5F — Executive Suites",
  "6F — Open Office D",
  "7F — Break Room & Kitchen",
  "8F — Rooftop Lounge",
];

export default function NexusBuildingViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const timerRef = useRef<{ lastTime: number; getDelta: () => number } | null>(null);
  const animFrameRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, locked: false, dx: 0, dy: 0 });
  const elevatorCabRef = useRef<THREE.Group | null>(null);
  const elevatorDoorLRef = useRef<THREE.Mesh | null>(null);
  const elevatorDoorRRef = useRef<THREE.Mesh | null>(null);
  const elevStateRef = useRef<ElevatorState>({
    currentFloor: 0,
    targetFloor: 0,
    cabY: 0,
    doorOpenAmount: 0,
    isMoving: false,
    doorState: "closed",
    doorTimer: 0,
  });
  const camStateRef = useRef<CameraState>({
    mode: "exterior",
    floor: 0,
    x: 30,
    y: 20,
    z: 35,
    yaw: -2.3,
    pitch: 0,
    isInElevator: false,
  });

  const workerMeshesRef = useRef<WorkerMesh[]>([]);
  const workerDefsRef = useRef<WorkerDef[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const workerGroupRef = useRef<THREE.Group | null>(null);

  const [workerScreenPositions, setWorkerScreenPositions] = useState<
    Array<{ id: string; name: string; role: string; x: number; y: number; visible: boolean }>
  >([]);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerDef | null>(null);
  const [hoveredWorkerId, setHoveredWorkerId] = useState<string | null>(null);
  const [uiState, setUiState] = useState({
    mode: "exterior" as "exterior" | "interior",
    currentFloor: 0,
    elevatorFloor: 0,
    elevatorMoving: false,
    elevatorDoorState: "closed" as string,
    loading: true,
    loadProgress: 0,
    hint: 'Click "Enter Building" to explore the interior',
    showElevator: false,
    isInElevator: false,
  });

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const timer = {
      lastTime: performance.now(),
      getDelta() {
        const now = performance.now();
        const d = (now - this.lastTime) / 1000;
        this.lastTime = now;
        return Math.min(d, 0.05);
      },
    };
    timerRef.current = timer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020408);
    scene.fog = new THREE.FogExp2(0x020408, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 500);
    const ext = getDefaultExteriorCamera();
    camera.position.copy(ext.position);
    camera.lookAt(ext.target);
    cameraRef.current = camera;

    const ambientLight = new THREE.AmbientLight(0x6688bb, 4.0);
    scene.add(ambientLight);
    const moonLight = new THREE.DirectionalLight(0xaaccff, 3.0);
    moonLight.position.set(-20, 40, 20);
    scene.add(moonLight);
    const fillLight = new THREE.DirectionalLight(0x6699cc, 2.0);
    fillLight.position.set(20, 10, -20);
    scene.add(fillLight);
    const frontLight = new THREE.DirectionalLight(0xccddff, 1.5);
    frontLight.position.set(0, 20, 40);
    scene.add(frontLight);
    const blueAccent = new THREE.PointLight(0x00d4ff, 3.0, 60);
    blueAccent.position.set(BUILDING.centerX, BUILDING.height * 0.5, 20);
    scene.add(blueAccent);
    const warmAccent = new THREE.PointLight(0xfff4e0, 2.0, 40);
    warmAccent.position.set(BUILDING.centerX - 15, BUILDING.height * 0.3, -15);
    scene.add(warmAccent);

    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPositions[i] = (Math.random() - 0.5) * 400;
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 })));

    const { buildingGroup, elevatorCab, elevatorDoorL, elevatorDoorR } = buildScene(scene);
    elevatorCabRef.current = elevatorCab;
    elevatorDoorLRef.current = elevatorDoorL;
    elevatorDoorRRef.current = elevatorDoorR;

    const workerGroup = new THREE.Group();
    workerGroup.name = "workers";
    scene.add(workerGroup);
    workerGroupRef.current = workerGroup;

    const defs = createWorkerDefinitions();
    workerDefsRef.current = defs;

    const meshes: WorkerMesh[] = defs.map((def) => {
      const wm = buildWorkerMesh(def);
      workerGroup.add(wm.group);
      return wm;
    });
    workerMeshesRef.current = meshes;

    const loader = new GLTFLoader();
    loader.load(
      BUILDING_GLB_URL,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            const applyToMat = (m: THREE.Material) => {
              const lm = m as THREE.MeshLambertMaterial;
              lm.transparent = true;
              lm.opacity = 0.82;
              lm.side = THREE.DoubleSide;
              lm.needsUpdate = true;
            };
            const mat = mesh.material;
            if (Array.isArray(mat)) mat.forEach(applyToMat);
            else applyToMat(mat);
          }
        });
        buildingGroup.add(model);
        setUiState((s) => ({ ...s, loading: false }));
      },
      (progress) => {
        const pct = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 50;
        setUiState((s) => ({ ...s, loadProgress: pct }));
      },
      () => {
        setUiState((s) => ({ ...s, loading: false }));
      }
    );

    const orbitTarget = new THREE.Vector3(BUILDING.centerX, BUILDING.height / 2, BUILDING.centerZ);
    let orbitTheta = 0.8;
    let orbitPhi = 0.35;
    let orbitRadius = 55;
    let isDragging = false;
    let lastMX = 0,
      lastMY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (camStateRef.current.mode === "exterior") {
        isDragging = true;
        lastMX = e.clientX;
        lastMY = e.clientY;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (camStateRef.current.mode === "exterior" && isDragging) {
        const dx = e.clientX - lastMX;
        const dy = e.clientY - lastMY;
        orbitTheta -= dx * 0.005;
        orbitPhi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, orbitPhi - dy * 0.005));
        lastMX = e.clientX;
        lastMY = e.clientY;
      } else if (camStateRef.current.mode === "interior" && mouseRef.current.locked) {
        mouseRef.current.dx = e.movementX;
        mouseRef.current.dy = e.movementY;
      }
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (camStateRef.current.mode === "exterior") {
        orbitRadius = Math.max(10, Math.min(100, orbitRadius + e.deltaY * 0.05));
      }
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      mouseRef.current.locked = locked;
      setPointerLocked(locked);
    };
    document.addEventListener("pointerlockchange", onPointerLockChange);

    const onCanvasClick = (e: MouseEvent) => {
      if (camStateRef.current.mode === "interior" && !mouseRef.current.locked) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycasterRef.current.setFromCamera(mouse, camera);

        const workerObjects: THREE.Object3D[] = [];
        workerMeshesRef.current.forEach((wm) => {
          wm.group.traverse((child) => {
            if (child instanceof THREE.Mesh) workerObjects.push(child);
          });
        });

        const intersects = raycasterRef.current.intersectObjects(workerObjects, false);
        if (intersects.length > 0) {
          const hitObj = intersects[0].object;
          for (const wm of workerMeshesRef.current) {
            let found = false;
            wm.group.traverse((child) => {
              if (child === hitObj) found = true;
            });
            if (found) {
              setSelectedWorker(wm.def);
              return;
            }
          }
        }
        renderer.domElement.requestPointerLock();
      } else if (camStateRef.current.mode === "interior" && mouseRef.current.locked) {
        raycasterRef.current.setFromCamera(new THREE.Vector2(0, 0), camera);
        const workerObjects: THREE.Object3D[] = [];
        workerMeshesRef.current.forEach((wm) => {
          wm.group.traverse((child) => {
            if (child instanceof THREE.Mesh) workerObjects.push(child);
          });
        });
        const intersects = raycasterRef.current.intersectObjects(workerObjects, false);
        if (intersects.length > 0 && intersects[0].distance < 5) {
          const hitObj = intersects[0].object;
          for (const wm of workerMeshesRef.current) {
            let found = false;
            wm.group.traverse((child) => {
              if (child === hitObj) found = true;
            });
            if (found) {
              document.exitPointerLock();
              setSelectedWorker(wm.def);
              return;
            }
          }
        }
      }
    };
    renderer.domElement.addEventListener("click", onCanvasClick);

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === "Escape") {
        setSelectedWorker(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let frameTime = 0;
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = timerRef.current ? timerRef.current.getDelta() : 0.016;
      frameTime += delta;
      const cam = camStateRef.current;

      if (cam.mode === "exterior") {
        if (!isDragging) orbitTheta += delta * 0.08;
        const x = orbitTarget.x + orbitRadius * Math.cos(orbitPhi) * Math.sin(orbitTheta);
        const y = orbitTarget.y + orbitRadius * Math.sin(orbitPhi);
        const z = orbitTarget.z + orbitRadius * Math.cos(orbitPhi) * Math.cos(orbitTheta);
        camera.position.set(x, y, z);
        camera.lookAt(orbitTarget);
      } else {
        const speed = 8 * delta;
        const keys = keysRef.current;

        if (mouseRef.current.locked) {
          cam.yaw -= mouseRef.current.dx * 0.002;
          cam.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cam.pitch - mouseRef.current.dy * 0.002));
          mouseRef.current.dx = 0;
          mouseRef.current.dy = 0;
        }

        const forward = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
        const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));

        if (keys.has("KeyW") || keys.has("ArrowUp")) {
          cam.x += forward.x * speed;
          cam.z += forward.z * speed;
        }
        if (keys.has("KeyS") || keys.has("ArrowDown")) {
          cam.x -= forward.x * speed;
          cam.z -= forward.z * speed;
        }
        if (keys.has("KeyA") || keys.has("ArrowLeft")) {
          cam.x -= right.x * speed;
          cam.z -= right.z * speed;
        }
        if (keys.has("KeyD") || keys.has("ArrowRight")) {
          cam.x += right.x * speed;
          cam.z += right.z * speed;
        }

        const halfW = INTERIOR.width / 2 - 0.5;
        const halfD = INTERIOR.depth / 2 - 0.5;
        cam.x = Math.max(INTERIOR.x - halfW, Math.min(INTERIOR.x + halfW, cam.x));
        cam.z = Math.max(INTERIOR.z - halfD, Math.min(INTERIOR.z + halfD, cam.z));

        if (cam.isInElevator) {
          cam.x = ELEVATOR.x;
          cam.z = ELEVATOR.z;
          cam.y = elevStateRef.current.cabY + 1.7;
          const newFloor = Math.round(elevStateRef.current.cabY / FLOOR_HEIGHT);
          if (newFloor !== cam.floor && newFloor >= 0 && newFloor < BUILDING.floors) {
            cam.floor = newFloor;
            setUiState((s) => ({ ...s, currentFloor: newFloor }));
          }
        } else {
          cam.y = getFloorCameraY(cam.floor);
        }

        camera.position.set(cam.x, cam.y, cam.z);
        camera.lookAt(
          cam.x + Math.sin(cam.yaw) * Math.cos(cam.pitch),
          cam.y + Math.sin(cam.pitch),
          cam.z + Math.cos(cam.yaw) * Math.cos(cam.pitch)
        );
      }

      const currentFloor = camStateRef.current.floor;
      const currentMode = camStateRef.current.mode;
      workerMeshesRef.current.forEach((wm) => {
        const onCurrentFloor = wm.def.floor === currentFloor;
        wm.group.visible = currentMode === "exterior" ? false : onCurrentFloor;
        if (wm.group.visible) {
          updateWorkerAnimation(wm, frameTime);
        }
      });

      if (currentMode === "interior" && !mouseRef.current.locked) {
        const positions: typeof workerScreenPositions = [];
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        workerMeshesRef.current.forEach((wm) => {
          if (wm.def.floor !== currentFloor) return;
          const worldPos = new THREE.Vector3();
          wm.group.getWorldPosition(worldPos);
          worldPos.y += 1.8;
          const projected = worldPos.clone().project(camera);
          const x = (projected.x * 0.5 + 0.5) * w;
          const y = (-projected.y * 0.5 + 0.5) * h;
          const visible = projected.z < 1 && projected.z > -1 && x > 0 && x < w && y > 0 && y < h;
          const dist = camera.position.distanceTo(worldPos);
          positions.push({
            id: wm.def.id,
            name: wm.def.name,
            role: wm.def.role,
            x,
            y,
            visible: visible && dist < 12,
          });
        });
        setWorkerScreenPositions(positions);
      } else {
        setWorkerScreenPositions([]);
      }

      if (elevatorCabRef.current && elevatorDoorLRef.current && elevatorDoorRRef.current) {
        const newState = updateElevator(
          elevStateRef.current,
          elevatorCabRef.current,
          elevatorDoorLRef.current,
          elevatorDoorRRef.current,
          delta
        );
        elevStateRef.current = newState;
        const elevFloor = Math.round(newState.cabY / FLOOR_HEIGHT);
        setUiState((s) => {
          if (
            s.elevatorFloor !== elevFloor ||
            s.elevatorMoving !== newState.isMoving ||
            s.elevatorDoorState !== newState.doorState
          ) {
            return {
              ...s,
              elevatorFloor: elevFloor,
              elevatorMoving: newState.isMoving,
              elevatorDoorState: newState.doorState,
            };
          }
          return s;
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      try {
        const ext = renderer.getContext().getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
      } catch {
        // ignore
      }
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  const enterBuilding = useCallback((floor = 0) => {
    const cam = camStateRef.current;
    cam.mode = "interior";
    cam.floor = floor;
    cam.x = INTERIOR.x;
    cam.y = getFloorCameraY(floor);
    cam.z = INTERIOR.z;
    cam.yaw = 0;
    cam.pitch = 0;
    cam.isInElevator = false;
    setUiState((s) => ({
      ...s,
      mode: "interior",
      currentFloor: floor,
      hint: "WASD / Arrow keys to move • Click canvas to capture mouse • Click workers to chat with AI agents",
      showElevator: true,
    }));
  }, []);

  const exitBuilding = useCallback(() => {
    const cam = camStateRef.current;
    cam.mode = "exterior";
    cam.isInElevator = false;
    if (document.pointerLockElement) document.exitPointerLock();
    setSelectedWorker(null);
    setUiState((s) => ({
      ...s,
      mode: "exterior",
      hint: 'Drag to orbit • Scroll to zoom • Click "Enter Building" to explore',
      showElevator: false,
      isInElevator: false,
    }));
  }, []);

  const callElevator = useCallback((targetFloor: number) => {
    const state = elevStateRef.current;
    if (state.isMoving) return;
    elevStateRef.current = {
      ...state,
      targetFloor,
      doorState: state.doorState === "closed" ? "opening" : state.doorState,
    };
  }, []);

  const enterElevator = useCallback(() => {
    camStateRef.current.isInElevator = true;
    setUiState((s) => ({ ...s, isInElevator: true, hint: "You are in the elevator. Select a floor." }));
  }, []);

  const exitElevator = useCallback(() => {
    camStateRef.current.isInElevator = false;
    const floor = elevStateRef.current.currentFloor;
    camStateRef.current.floor = floor;
    camStateRef.current.x = ELEVATOR.x - ELEVATOR.width;
    camStateRef.current.z = ELEVATOR.z;
    setUiState((s) => ({
      ...s,
      isInElevator: false,
      currentFloor: floor,
      hint: `Floor ${floor === 0 ? "G" : floor} — ${FLOOR_NAMES[floor]?.split("—")[1]?.trim() ?? ""}`,
    }));
  }, []);

  const goToFloor = useCallback((floor: number) => {
    callElevator(floor);
    setUiState((s) => ({ ...s, hint: `Elevator → Floor ${floor === 0 ? "G" : floor}` }));
  }, [callElevator]);

  return (
    <div className="relative w-full h-full min-h-[600px] bg-[#020408] overflow-hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div ref={mountRef} className="absolute inset-0" />

      {uiState.loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408] z-50">
          <div className="text-[#00d4ff] text-2xl font-bold tracking-widest mb-6 uppercase">
            Loading Nexus Tower
          </div>
          <div className="w-64 h-1 bg-[#0d1b2a] rounded-full overflow-hidden">
            <div className="h-full bg-[#00d4ff] transition-all duration-300" style={{ width: `${uiState.loadProgress}%` }} />
          </div>
          <div className="text-[#3a5a7a] text-sm mt-3 tracking-wider">{Math.round(uiState.loadProgress)}%</div>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3" style={{ background: "linear-gradient(to bottom, rgba(2,4,8,0.9) 0%, transparent 100%)" }}>
        <div>
          <div className="text-white text-lg font-bold tracking-wider">NEXUS TOWER</div>
          <div className="text-[#3a6a9a] text-xs tracking-widest uppercase">
            {uiState.mode === "exterior"
              ? "Exterior View"
              : `Floor ${uiState.currentFloor === 0 ? "G" : uiState.currentFloor} — ${FLOOR_NAMES[uiState.currentFloor]?.split("—")[1]?.trim() ?? ""}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {uiState.mode === "interior" && (
            <button onClick={exitBuilding} className="px-4 py-2 text-sm text-[#00d4ff] border border-[#00d4ff33] rounded hover:bg-[#00d4ff15] transition-colors tracking-wider" type="button">
              ← Exit Building
            </button>
          )}
          {uiState.mode === "exterior" && !uiState.loading && (
            <button onClick={() => enterBuilding(0)} className="px-5 py-2 text-sm font-semibold text-[#020408] bg-[#00d4ff] rounded hover:bg-[#33ddff] transition-colors tracking-wider" type="button">
              Enter Building
            </button>
          )}
        </div>
      </div>

      {uiState.mode === "interior" && !pointerLocked &&
        workerScreenPositions.map(
          (wp) =>
            wp.visible && (
              <div
                key={wp.id}
                className="absolute z-30 pointer-events-auto cursor-pointer select-none"
                style={{ left: wp.x, top: wp.y, transform: "translate(-50%, -100%)", transition: "opacity 0.2s" }}
                onClick={() => {
                  const def = workerDefsRef.current.find((d) => d.id === wp.id);
                  if (def) setSelectedWorker(def);
                }}
                onMouseEnter={() => setHoveredWorkerId(wp.id)}
                onMouseLeave={() => setHoveredWorkerId(null)}
                role="button"
                tabIndex={0}
              >
                <div
                  style={{
                    background: hoveredWorkerId === wp.id ? "rgba(0, 212, 255, 0.25)" : "rgba(4, 8, 20, 0.85)",
                    backdropFilter: "blur(8px)",
                    border: `1px solid ${hoveredWorkerId === wp.id ? "rgba(0,212,255,0.6)" : "rgba(0,212,255,0.25)"}`,
                    borderRadius: "8px",
                    padding: "5px 10px",
                    textAlign: "center",
                    minWidth: "90px",
                    transition: "all 0.15s",
                    boxShadow: hoveredWorkerId === wp.id ? "0 0 12px rgba(0,212,255,0.3)" : "none",
                  }}
                >
                  <div style={{ color: "#e8f4ff", fontSize: "11px", fontWeight: 700, letterSpacing: "0.03em" }}>{wp.name}</div>
                  <div style={{ color: "#00d4ff", fontSize: "9px", fontWeight: 500, marginTop: "1px" }}>{wp.role}</div>
                  {hoveredWorkerId === wp.id && <div style={{ color: "#4a8aaa", fontSize: "9px", marginTop: "2px" }}>Click to chat</div>}
                </div>
                <div style={{ width: "1px", height: "8px", background: "rgba(0,212,255,0.4)", margin: "0 auto" }} />
                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00d4ff", margin: "0 auto", boxShadow: "0 0 4px #00d4ff" }} />
              </div>
            )
        )}

      {uiState.showElevator && !selectedWorker && (
        <div
          className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-52 rounded-xl overflow-hidden"
          style={{ background: "rgba(10, 15, 30, 0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(0, 212, 255, 0.2)", boxShadow: "0 0 30px rgba(0, 212, 255, 0.1)" }}
        >
          <div className="px-4 py-3 border-b border-[#00d4ff22]">
            <div className="text-[#00d4ff] text-xs font-bold tracking-widest uppercase">Elevator</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-white text-2xl font-bold" style={{ fontFamily: "'Orbitron', monospace" }}>
                {uiState.elevatorFloor === 0 ? "G" : `${uiState.elevatorFloor}F`}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  uiState.elevatorMoving
                    ? "bg-[#f59e0b22] text-[#f59e0b]"
                    : uiState.elevatorDoorState === "open" || uiState.elevatorDoorState === "opening"
                      ? "bg-[#00d4ff22] text-[#00d4ff]"
                      : "bg-[#1a2a3a] text-[#3a5a7a]"
                }`}
              >
                {uiState.elevatorMoving ? "▲ Moving" : uiState.elevatorDoorState === "open" ? "Open" : uiState.elevatorDoorState === "opening" ? "Opening" : uiState.elevatorDoorState === "closing" ? "Closing" : "Ready"}
              </span>
            </div>
          </div>
          <div className="p-3 grid grid-cols-3 gap-1.5">
            {FLOOR_NAMES.map((name, i) => {
              const label = i === 0 ? "G" : `${i}`;
              const isCurrentElevFloor = uiState.elevatorFloor === i;
              const isTarget = elevStateRef.current.targetFloor === i;
              return (
                <button
                  key={i}
                  onClick={() => goToFloor(i)}
                  title={name}
                  type="button"
                  className={`relative h-10 rounded-lg text-sm font-bold transition-all duration-200 ${
                    isCurrentElevFloor
                      ? "bg-[#00d4ff] text-[#020408] shadow-[0_0_12px_rgba(0,212,255,0.6)]"
                      : isTarget && uiState.elevatorMoving
                        ? "bg-[#f59e0b22] text-[#f59e0b] border border-[#f59e0b44]"
                        : "bg-[#0d1b2a] text-[#6a9abf] hover:bg-[#1a2a3a] hover:text-[#00d4ff] border border-[#1a2a3a]"
                  }`}
                  style={{ fontFamily: "'Orbitron', monospace" }}
                >
                  {label}
                  {isCurrentElevFloor && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#020408]" />}
                </button>
              );
            })}
          </div>
          <div className="px-3 pb-3 flex flex-col gap-1.5">
            {!uiState.isInElevator ? (
              <button onClick={enterElevator} className="w-full py-2 text-xs font-semibold text-[#00d4ff] border border-[#00d4ff33] rounded-lg hover:bg-[#00d4ff15] transition-colors tracking-wider" type="button">
                Enter Elevator
              </button>
            ) : (
              <button onClick={exitElevator} disabled={uiState.elevatorMoving} className="w-full py-2 text-xs font-semibold text-[#f59e0b] border border-[#f59e0b33] rounded-lg hover:bg-[#f59e0b15] transition-colors tracking-wider disabled:opacity-40" type="button">
                Exit Elevator
              </button>
            )}
          </div>
          <div className="border-t border-[#00d4ff22] px-3 py-2">
            <div className="text-[#3a5a7a] text-[10px] font-bold tracking-widest uppercase mb-1">Directory</div>
            <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {FLOOR_NAMES.map((name, i) => (
                <div
                  key={i}
                  className={`text-[10px] leading-tight cursor-pointer px-1 py-0.5 rounded transition-colors ${uiState.currentFloor === i ? "text-[#00d4ff] bg-[#00d4ff11]" : "text-[#4a6a8a] hover:text-[#7aaacf]"}`}
                  onClick={() => {
                    if (uiState.mode === "interior") {
                      camStateRef.current.floor = i;
                      camStateRef.current.x = INTERIOR.x;
                      camStateRef.current.z = INTERIOR.z;
                      camStateRef.current.isInElevator = false;
                      setUiState((s) => ({ ...s, currentFloor: i, isInElevator: false }));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedWorker && (
        <NPCChatPanel
          npcId={getNpcIdForNexusWorker(selectedWorker.id, selectedWorker.role)}
          npcName={selectedWorker.name}
          npcTitle={selectedWorker.role}
          onClose={() => setSelectedWorker(null)}
        />
      )}

      {uiState.mode === "interior" && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
          {[...Array(BUILDING.floors)].map((_, i) => {
            const fi = BUILDING.floors - 1 - i;
            return (
              <div
                key={fi}
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => {
                  camStateRef.current.floor = fi;
                  camStateRef.current.x = INTERIOR.x;
                  camStateRef.current.z = INTERIOR.z;
                  camStateRef.current.isInElevator = false;
                  setUiState((s) => ({ ...s, currentFloor: fi, isInElevator: false }));
                }}
                role="button"
                tabIndex={0}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all ${uiState.currentFloor === fi ? "bg-[#00d4ff] scale-150" : "bg-[#1a3a5a] group-hover:bg-[#3a6a9a]"}`} />
                <span className={`text-[10px] tracking-wider transition-colors ${uiState.currentFloor === fi ? "text-[#00d4ff]" : "text-[#1a3a5a] group-hover:text-[#3a6a9a]"}`} style={{ fontFamily: "'Orbitron', monospace" }}>
                  {fi === 0 ? "G" : `${fi}F`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {uiState.mode === "interior" && pointerLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="relative w-6 h-6">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#00d4ff88] -translate-y-1/2" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#00d4ff88] -translate-x-1/2" />
            <div className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-[#00d4ff] -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
      )}

      {uiState.mode === "interior" && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-5 py-2 rounded-full text-sm font-semibold tracking-wider pointer-events-none"
          style={{ background: "rgba(0, 212, 255, 0.12)", border: "1px solid rgba(0, 212, 255, 0.3)", color: "#00d4ff", backdropFilter: "blur(8px)" }}
        >
          {FLOOR_NAMES[uiState.currentFloor]}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 py-3 flex items-center justify-between" style={{ background: "linear-gradient(to top, rgba(2,4,8,0.9) 0%, transparent 100%)" }}>
        <div className="text-[#3a5a7a] text-xs tracking-wider">{uiState.hint}</div>
        {uiState.mode === "interior" && (
          <div className="flex items-center gap-4 text-[#2a4a6a] text-xs">
            <span>W A S D — Move</span>
            <span>Mouse — Look</span>
            <span>Click Worker — AI Chat</span>
            <span>ESC — Release cursor</span>
          </div>
        )}
        {uiState.mode === "exterior" && (
          <div className="flex items-center gap-4 text-[#2a4a6a] text-xs">
            <span>Drag — Orbit</span>
            <span>Scroll — Zoom</span>
          </div>
        )}
      </div>
    </div>
  );
}
