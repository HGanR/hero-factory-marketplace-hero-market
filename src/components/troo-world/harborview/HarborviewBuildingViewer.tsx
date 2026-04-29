"use client";

/**
 * HarborviewBuildingViewer — Glass curtain-wall waterfront tower.
 * 7 floors: Lobby, Innovation, Wellness, Media, Research, Sustainability, Penthouse.
 * Adapted from reference HarborviewBuildingScene.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Link from "next/link";

const FLOOR_H = 4;
const WIDTH = 28;
const DEPTH = 18;

export default function HarborviewBuildingViewer() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1a2a);
    scene.fog = new THREE.Fog(0x0a1a2a, 40, 100);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 8, 20);
    camera.lookAt(0, 6, 0);

    scene.add(new THREE.AmbientLight(0xe8f4ff, 0.6));
    const sun = new THREE.DirectionalLight(0xfff8f0, 1.2);
    sun.position.set(10, 25, 10);
    sun.castShadow = true;
    scene.add(sun);

    const mat = (c: number, r = 0.7, m = 0) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const box = (w: number, h: number, d: number, m: THREE.Material) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

    // Floor
    const floor = box(WIDTH, 0.25, DEPTH, mat(0xe0ddd8));
    floor.position.y = 0.12;
    floor.receiveShadow = true;
    scene.add(floor);

    // Back wall
    const backWall = box(WIDTH, FLOOR_H * 7, 0.25, mat(0xf4f4f2));
    backWall.position.set(0, FLOOR_H * 3.5, -DEPTH / 2);
    scene.add(backWall);

    // Glass front
    const glass = new THREE.MeshStandardMaterial({
      color: 0x7ac8e0,
      roughness: 0.05,
      metalness: 0.6,
      transparent: true,
      opacity: 0.55,
    });
    const frontGlass = box(WIDTH - 1, FLOOR_H * 7 - 0.5, 0.12, glass);
    frontGlass.position.set(0, FLOOR_H * 3.5, DEPTH / 2);
    scene.add(frontGlass);

    // Reception desk
    const desk = box(6, 1, 2, mat(0x8a6a4a));
    desk.position.set(0, 0.5, 4);
    desk.castShadow = true;
    scene.add(desk);

    // Plants
    const plant = box(1.2, 1.5, 1.2, mat(0x3a7a3a));
    plant.position.set(-8, 0.75, 6);
    scene.add(plant);
    const plant2 = plant.clone();
    plant2.position.set(8, 0.75, 6);
    scene.add(plant2);

    let orbitTheta = 0.5;
    let orbitPhi = 0.35;
    let radius = 35;
    let isDrag = false;
    let lastX = 0;
    let lastY = 0;

    const onMouseDown = () => { isDrag = true; };
    const onMouseMove = (e: MouseEvent) => {
      if (isDrag) {
        orbitTheta -= (e.clientX - lastX) * 0.004;
        orbitPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, orbitPhi - (e.clientY - lastY) * 0.004));
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const onMouseUp = () => { isDrag = false; };
    const onWheel = (e: WheelEvent) => {
      radius = Math.max(20, Math.min(60, radius + e.deltaY * 0.1));
    };

    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("wheel", onWheel, { passive: true });

    const animate = () => {
      requestAnimationFrame(animate);
      const x = radius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
      const y = radius * Math.sin(orbitPhi) + 14;
      const z = radius * Math.cos(orbitPhi) * Math.cos(orbitTheta);
      camera.position.set(x, y, z);
      camera.lookAt(0, 10, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("mousedown", onMouseDown);
      mount.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0a1a2a">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 z-20 flex items-center gap-4">
        <Link
          href="/troo-world"
          className="px-4 py-2 text-sm text-sky-400 border border-sky-500/50 rounded-lg hover:bg-sky-500/10 transition-colors"
        >
          ← Back to World
        </Link>
        <span className="text-sky-300 font-medium">Harborview Tower — Waterfront Lobby</span>
      </div>
      <div className="absolute bottom-4 left-4 z-20 text-sky-400/80 text-sm">
        Drag to orbit • Scroll to zoom
      </div>
    </div>
  );
}
