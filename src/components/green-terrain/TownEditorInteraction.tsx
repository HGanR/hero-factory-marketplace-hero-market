'use client';
import {useEffect,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {ImportedPlacement} from '@/lib/troo-world/airport';
interface ICProps {
  imports: ImportedPlacement[];
  terrainHeight:(x:number,z:number)=>number;
  onSelectAirport:(key:string|null)=>void;
  onMoveAirport:(key:string,pos:[number,number,number],saveHistory?:boolean)=>void;
  trees: Array<{id:number;pos:[number,number,number];scale:number}>;
  placedObjects: Array<{id:string;position:[number,number,number];type:string}>;
  nexusPos: [number,number,number];
  meridianPos: [number,number,number];
  troothhertzPos: [number,number,number];
  stadiumPos: [number,number,number];
  veritasPos: [number,number,number];
  isEditorMode: boolean;
  onSelectTree: (id: number | null) => void;
  onMoveTree: (id: number, pos: [number,number,number], saveHistory?: boolean) => void;
  onSelectObject: (id: string | null) => void;
  onMoveObject: (id: string, pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveNexus: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveMeridian: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveTroothhertz: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveStadium: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveVeritas: (pos: [number,number,number], saveHistory?: boolean) => void;
  orbitRef: React.RefObject<any>;
}

export default function InteractionController(props: ICProps) {
  const latest=useRef(props);latest.current=props;
  const { camera, gl, scene } = useThree();
  const ray = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0,1,0), 0));
  const pt = useRef(new THREE.Vector3());
  const ndc = useRef(new THREE.Vector2());
  const dragging = useRef<
    | { kind: "airport"; id:string; offsetX:number; offsetZ:number; y:number }
    | { kind: "tree"; id: number }
    | { kind: "object"; id: string }
    | { kind: "nexus" }
    | { kind: "meridian" }
    | { kind: "troothhertz" }
    | { kind: "stadium" }
    | { kind: "veritas" }
    | null
  >(null);
  const dragStartedRef = useRef(false);

  const getNDC = (e: PointerEvent) => {
    const r = gl.domElement.getBoundingClientRect();
    ndc.current.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    return ndc.current;
  };

  // Object size mapping for more precise hit detection
  const getObjectHitRadius = (type: string): number => {
    switch (type) {
      case "street": return 3;
      case "sidewalk": return 2.5;
      case "parkinglot": return 4;
      case "lake": return 5;
      case "pond": return 3;
      case "bench": return 1;
      case "lightpost": return 0.8;
      default: return 2;
    }
  };

  const hitTree = (e: PointerEvent) => {
    ray.current.setFromCamera(getNDC(e), camera);
    let best: { id: number; dist: number } | null = null;
    for (const t of latest.current.trees) {
      const c = new THREE.Vector3(...t.pos).addScaledVector(new THREE.Vector3(0,1,0), 1.5*t.scale);
      // Reduced radius for more precise selection
      const s = new THREE.Sphere(c, 0.8*t.scale);
      if (ray.current.ray.intersectsSphere(s)) {
        const d = ray.current.ray.origin.distanceTo(c);
        if (!best || d < best.dist) best = { id: t.id, dist: d };
      }
    }
    return best?.id ?? null;
  };

  const hitObject = (e: PointerEvent) => {
    ray.current.setFromCamera(getNDC(e), camera);
    let best: { id: string; dist: number } | null = null;
    for (const obj of latest.current.placedObjects) {
      const c = new THREE.Vector3(...obj.position).add(new THREE.Vector3(0, 0.5, 0));
      // Use type-specific hit radius for more precise selection
      const radius = getObjectHitRadius(obj.type);
      const s = new THREE.Sphere(c, radius);
      if (ray.current.ray.intersectsSphere(s)) {
        const d = ray.current.ray.origin.distanceTo(c);
        if (!best || d < best.dist) best = { id: obj.id, dist: d };
      }
    }
    return best?.id ?? null;
  };

  const hitBuilding = (e: PointerEvent, pos: [number,number,number], radius: number) => {
    ray.current.setFromCamera(getNDC(e), camera);
    // Use center of building footprint, not elevated
    const c = new THREE.Vector3(...pos).add(new THREE.Vector3(0, 5, 0));
    return ray.current.ray.intersectsSphere(new THREE.Sphere(c, radius));
  };

  useEffect(() => {
    if (!latest.current.isEditorMode) return;
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      if(e.button!==0||dragging.current)return;
      dragPlane.current.constant=0;
      dragStartedRef.current = false;
      ray.current.setFromCamera(getNDC(e),camera);
      const hits=ray.current.intersectObjects(scene.children,true);
      let airportKey:string|undefined;
      if(hits[0]){let node:THREE.Object3D|null=hits[0].object;while(node){if(typeof node.userData.airportPlacementKey==='string'){airportKey=node.userData.airportPlacementKey;break;}node=node.parent;}}
      const airport=latest.current.imports.find(row=>row.elementKey===airportKey);
      if(airport){
        dragPlane.current.constant=-airport.position[1];
        if(!ray.current.ray.intersectPlane(dragPlane.current,pt.current))return;
        latest.current.onSelectAirport(airport.elementKey);
        dragging.current={kind:'airport',id:airport.elementKey,offsetX:airport.position[0]-pt.current.x,offsetZ:airport.position[2]-pt.current.z,y:airport.position[1]};
        if(latest.current.orbitRef.current)latest.current.orbitRef.current.enabled=false;
        el.setPointerCapture(e.pointerId);return;
      }
      latest.current.onSelectAirport(null);
      const treeHit = hitTree(e);
      if (treeHit !== null) {
        latest.current.onSelectTree(treeHit);
        latest.current.onSelectObject(null);
        dragging.current = { kind: "tree", id: treeHit };
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      const objHit = hitObject(e);
      if (objHit !== null) {
        latest.current.onSelectObject(objHit);
        latest.current.onSelectTree(null);
        dragging.current = { kind: "object", id: objHit };
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      // Reduced building hit radii for more precise selection
      if (hitBuilding(e, latest.current.nexusPos, 8)) {
        dragging.current = { kind: "nexus" };
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, latest.current.meridianPos, 10)) {
        dragging.current = { kind: "meridian" };
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, latest.current.troothhertzPos, 8)) {
        dragging.current = { kind: "troothhertz" };
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, latest.current.stadiumPos, 15)) {
        dragging.current = { kind: "stadium" };
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, latest.current.veritasPos, 18)) {
        dragging.current = { kind: "veritas" };
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      latest.current.onSelectTree(null);
      latest.current.onSelectObject(null);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      ray.current.setFromCamera(getNDC(e), camera);
      if (!ray.current.ray.intersectPlane(dragPlane.current, pt.current)) return;
      const x = pt.current.x, z = pt.current.z;
      const shouldSaveHistory = !dragStartedRef.current;
      dragStartedRef.current = true;
      if(dragging.current.kind==='airport'){
        const drag=dragging.current;
        const clamp=(n:number)=>Math.max(-1000,Math.min(1000,n));
        latest.current.onMoveAirport(drag.id,[clamp(x+drag.offsetX),drag.y,clamp(z+drag.offsetZ)],shouldSaveHistory);
      } else if (dragging.current.kind === "tree") {
        latest.current.onMoveTree(dragging.current.id, [x, latest.current.terrainHeight(x, z), z], shouldSaveHistory);
      } else if (dragging.current.kind === "object") {
        latest.current.onMoveObject(dragging.current.id, [x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "nexus") {
        latest.current.onMoveNexus([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "meridian") {
        latest.current.onMoveMeridian([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "troothhertz") {
        latest.current.onMoveTroothhertz([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "stadium") {
        latest.current.onMoveStadium([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "veritas") {
        latest.current.onMoveVeritas([x, 0, z], shouldSaveHistory);
      }
    };

    const onUp = () => {
      if (dragging.current) {
        dragging.current = null;
        if (latest.current.orbitRef.current) latest.current.orbitRef.current.enabled = true;
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel",onUp);
    el.addEventListener("lostpointercapture",onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel",onUp);
      el.removeEventListener("lostpointercapture",onUp);onUp();
    };
  }, [props.isEditorMode,camera,gl,scene]);

  return null;
}

