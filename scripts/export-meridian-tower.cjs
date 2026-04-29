#!/usr/bin/env node
/**
 * Exports the procedural Meridian Tower building to GLB.
 * Run from hero-market: node scripts/export-meridian-tower.cjs
 * Output: public/models/meridian-tower/meridian_tower.glb
 */
const { Blob, FileReader } = require("vblob");
global.Blob = Blob;
global.FileReader = FileReader;

const fs = require("fs");
const path = require("path");
const THREE = require("three");

const C = {
  concrete: 0xd4cfc8, concreteDk: 0xb8b2aa, frame: 0x2c3340, frameDk: 0x1a1f28,
  glass: 0x7ab3d4, ground: 0xc8c4bc, grass: 0x5a7a3a, bark: 0x6b4a2a,
  foliage: 0x4a8a30, roofEdge: 0x3a3a4a, elevator: 0x4a4a5a,
};
const B = { width: 20, depth: 14, floorH: 4.2, floors: 2, wallThick: 0.22, cx: 0, cz: 0 };
const TOTAL_H = B.floorH * B.floors;

function mat(color, rough = 0.7, metal = 0, opacity = 1, transparent = false) {
  return new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: metal,
    opacity, transparent, side: transparent ? THREE.DoubleSide : THREE.FrontSide,
  });
}
function box(w, h, d, m) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), m);
}
function boxSeg(w, h, d, ws, hs, ds, m) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, ws, hs, ds), m);
}

const root = new THREE.Group();
root.name = "meridian_tower";
const W = B.width;
const D = B.depth;
const H = TOTAL_H;
const cx = B.cx;
const cz = B.cz;

root.add(boxSeg(60, 0.15, 50, 6, 1, 5, mat(C.ground, 0.9, 0)));

const concMat = mat(C.concrete, 0.85, 0.05);
const concDkMat = mat(C.concreteDk, 0.85, 0.05);
const frameMat = mat(C.frame, 0.4, 0.6);

const backWall = boxSeg(W, H, B.wallThick, 8, 4, 1, concMat);
backWall.position.set(cx, H / 2, cz - D / 2 + B.wallThick / 2);
root.add(backWall);

const leftWall = boxSeg(B.wallThick, H, D, 1, 4, 6, concMat);
leftWall.position.set(cx - W / 2 + B.wallThick / 2, H / 2, cz);
root.add(leftWall);

for (let f = 1; f < B.floors; f++) {
  const band = box(W + 0.1, 0.35, D + 0.1, mat(C.frame, 0.3, 0.8));
  band.position.set(cx, f * B.floorH, cz);
  root.add(band);
}
const parapet = box(W + 0.2, 0.5, D + 0.2, mat(C.roofEdge, 0.5, 0.5));
parapet.position.set(cx, H + 0.25, cz);
root.add(parapet);

for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
  const col = box(0.4, H + 0.5, 0.4, mat(C.frame, 0.3, 0.7));
  col.position.set(cx + sx * (W / 2 - 0.2), H / 2, cz + sz * (D / 2 - 0.2));
  root.add(col);
}

const glassMat = mat(C.glass, 0.05, 0.9, 0.55, true);
const sections = [
  { x: cx - W / 2 + 2.5, w: 4.5 }, { x: cx - W / 2 + 8.5, w: 7.0 }, { x: cx + W / 2 - 4.0, w: 5.5 },
];
for (const sec of sections) {
  const glass = box(sec.w - 0.15, H - 0.5, 0.08, glassMat);
  glass.position.set(sec.x, H / 2, cz + D / 2 + 0.04);
  root.add(glass);
  for (let f = 0; f <= B.floors; f++) {
    const bar = box(sec.w, 0.18, 0.18, frameMat);
    bar.position.set(sec.x, f * B.floorH + (f === 0 ? 0.09 : 0), cz + D / 2 + 0.09);
    root.add(bar);
  }
}

const elevX = cx + W / 2 - 2.0;
const elevZ = cz;
const ew = 2.2;
const ed = 2.2;
const shaftMat = mat(C.elevator, 0.5, 0.3);
const s1 = box(ew, TOTAL_H + 0.5, 0.15, shaftMat);
s1.position.set(elevX, (TOTAL_H + 0.5) / 2, elevZ - ed / 2);
root.add(s1);
const s2 = box(0.15, TOTAL_H + 0.5, ed, shaftMat);
s2.position.set(elevX - ew / 2, (TOTAL_H + 0.5) / 2, elevZ);
root.add(s2);
const s3 = box(0.15, TOTAL_H + 0.5, ed, shaftMat);
s3.position.set(elevX + ew / 2, (TOTAL_H + 0.5) / 2, elevZ);
root.add(s3);

for (let i = 0; i < 6; i++) {
  const tx = (i % 3 - 1) * 12;
  const tz = Math.floor(i / 3) * 20 - 15;
  const trunk = box(0.4, 2.5, 0.4, mat(C.bark, 0.9, 0));
  trunk.position.set(tx, 1.25, tz);
  root.add(trunk);
  const foliage = box(2.5, 2.5, 2.5, mat(C.foliage, 0.9, 0));
  foliage.position.set(tx, 3.5, tz);
  root.add(foliage);
}

root.updateMatrixWorld(true);
const box3 = new THREE.Box3().setFromObject(root);
root.position.y = -box3.min.y;

const outDir = path.join(process.cwd(), "public", "models", "meridian-tower");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "meridian_tower.glb");

(async () => {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const exporter = new GLTFExporter();
  exporter.parse(
    root,
    (glb) => {
      const buf = Buffer.from(glb);
      fs.writeFileSync(outPath, buf);
      console.log("Exported:", outPath, "(" + buf.length + " bytes)");
    },
    (err) => console.error("Export error:", err),
    { binary: true }
  );
})();
