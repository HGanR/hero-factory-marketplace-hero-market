/**
 * CartoonHead3D.js  — High-quality stylized cartoon head
 *
 * Builds a smooth, sculpted cartoon head matching the reference style:
 * - Large rounded cranium with tapered jaw (cartoon proportions)
 * - Prominent cheekbones and brow ridge
 * - Large expressive eyes with sclera, iris, pupil, catchlight, lids, lashes
 * - Defined lips with upper bow and lower fullness
 * - Sculpted nose with tip and nostrils
 * - Rounded ears with inner detail
 * - Smooth neck
 *
 * All geometry uses MeshToonMaterial for the stylized cartoon look.
 */

import * as THREE from 'three';

// ─── Material helpers ─────────────────────────────────────────────────────────

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    ...opts,
  });
}

function skinMat(hex, opts = {}) {
  return toon(hex, { roughness: 0.7, ...opts });
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function lathe(points, segs = 32) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segs
  );
}

function sphere(rx, ry, rz, ws = 32, hs = 24) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

function capsule(r, len, cap = 8, rad = 16) {
  return new THREE.CapsuleGeometry(r, len, cap, rad);
}

function box(w, h, d, ws = 2, hs = 2, ds = 2) {
  return new THREE.BoxGeometry(w, h, d, ws, hs, ds);
}

function cylinder(rt, rb, h, segs = 24) {
  return new THREE.CylinderGeometry(rt, rb, h, segs);
}

function cone(r, h, segs = 24) {
  return new THREE.ConeGeometry(r, h, segs);
}

function torus(r, tube, arc = Math.PI * 2, segs = 32, tseg = 16) {
  return new THREE.TorusGeometry(r, tube, tseg, segs, arc);
}

function place(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ─── CartoonHead3D ────────────────────────────────────────────────────────────

export class CartoonHead3D {
  constructor(skinHex = '#f4c5a0') {
    this.group = new THREE.Group();
    this.parts = {};
    this._skinHex = skinHex;
    this._build(skinHex);
  }

  _build(sk) {
    this._buildSkull(sk);
    this._buildFace(sk);
    this._buildEyes(sk);
    this._buildNose(sk);
    this._buildMouth(sk);
    this._buildEars(sk);
    this._buildNeck(sk);
  }

  // ── Skull ──────────────────────────────────────────────────────────────────
  _buildSkull(sk) {
    // Main cranium — large rounded top, tapered toward jaw
    // Use a lathe profile for the skull silhouette
    const skullPts = [
      [0.000, 0.220],   // top center
      [0.055, 0.210],
      [0.110, 0.185],
      [0.148, 0.145],
      [0.165, 0.095],   // widest point (temples)
      [0.158, 0.040],
      [0.145, -0.010],  // cheekbone
      [0.130, -0.055],
      [0.108, -0.095],  // jaw angle
      [0.080, -0.130],
      [0.045, -0.155],  // chin
      [0.000, -0.162],  // chin center
    ];
    const skullGeo = lathe(skullPts, 48);
    const skullMat = skinMat(sk);
    const skull = place(skullGeo, skullMat, 0, 0, 0);
    skull.name = 'skull';
    this.group.add(skull);
    this.parts.skull = skull;

    // Brow ridge — slight protrusion above eyes
    const browGeo = new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    browGeo.scale(1.8, 0.5, 0.8);
    const browMesh = place(browGeo, skinMat(sk), 0, 0.055, 0.130);
    browMesh.name = 'browRidge';
    this.group.add(browMesh);
    this.parts.browRidge = browMesh;

    // Cheekbones — slight protrusion
    for (const sx of [-1, 1]) {
      const ckGeo = sphere(0.048, 0.032, 0.028, 20, 14);
      const ck = place(ckGeo, skinMat(sk), sx * 0.120, -0.042, 0.095);
      ck.name = `cheek_${sx > 0 ? 'R' : 'L'}`;
      this.group.add(ck);
      this.parts[ck.name] = ck;
    }

    // Chin — slight rounded protrusion
    const chinGeo = sphere(0.038, 0.026, 0.022, 18, 12);
    const chin = place(chinGeo, skinMat(sk), 0, -0.148, 0.062);
    chin.name = 'chin';
    this.group.add(chin);
    this.parts.chin = chin;

    // Forehead — slight forward curve
    const foreGeo = sphere(0.095, 0.055, 0.040, 24, 16);
    const fore = place(foreGeo, skinMat(sk), 0, 0.120, 0.115);
    fore.name = 'forehead';
    this.group.add(fore);
    this.parts.forehead = fore;
  }

  // ── Face details ───────────────────────────────────────────────────────────
  _buildFace(sk) {
    // Cheek blush
    for (const sx of [-1, 1]) {
      const blushGeo = sphere(0.042, 0.028, 0.008, 18, 12);
      const blushMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(0xe87878),
        transparent: true,
        opacity: 0.28,
      });
      const blush = place(blushGeo, blushMat, sx * 0.108, -0.030, 0.135);
      blush.name = `blush_${sx > 0 ? 'R' : 'L'}`;
      this.group.add(blush);
      this.parts[blush.name] = blush;
    }
  }

  // ── Eyes ───────────────────────────────────────────────────────────────────
  _buildEyes(sk) {
    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';
      const ex = sx * 0.062;
      const ey = 0.022;
      const ez = 0.130;

      // Eye socket depression
      const socketGeo = sphere(0.058, 0.048, 0.018, 24, 18);
      const socketMat = new THREE.MeshToonMaterial({ color: new THREE.Color(0x0a0508) });
      const socket = place(socketGeo, socketMat, ex, ey, ez - 0.002);
      socket.name = `socket_${side}`;
      this.group.add(socket);

      // Sclera (white of eye)
      const scleraGeo = sphere(0.052, 0.044, 0.022, 24, 18);
      const scleraMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(0xfaf8f5),
        roughness: 0.2,
      });
      const sclera = place(scleraGeo, scleraMat, ex, ey, ez + 0.004);
      sclera.name = `sclera_${side}`;
      this.group.add(sclera);
      this.parts[`sclera_${side}`] = sclera;

      // Iris — large cartoon iris
      const irisGeo = sphere(0.036, 0.036, 0.020, 22, 18);
      const irisMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(0xd4820a),
        roughness: 0.1,
        emissive: new THREE.Color(0x3a1a00),
        emissiveIntensity: 0.25,
      });
      const iris = place(irisGeo, irisMat, ex, ey, ez + 0.016);
      iris.name = `iris_${side}`;
      this.group.add(iris);
      this.parts[`iris_${side}`] = iris;

      // Pupil
      const pupilGeo = sphere(0.022, 0.022, 0.016, 18, 14);
      const pupilMat = new THREE.MeshToonMaterial({ color: new THREE.Color(0x080404) });
      const pupil = place(pupilGeo, pupilMat, ex, ey, ez + 0.026);
      pupil.name = `pupil_${side}`;
      this.group.add(pupil);

      // Catchlight — specular highlight
      const catchGeo = sphere(0.010, 0.010, 0.008, 12, 10);
      const catchMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(0xffffff),
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 1.0,
      });
      const catchlight = place(catchGeo, catchMat, ex + sx * 0.012, ey + 0.012, ez + 0.030);
      catchlight.name = `catchlight_${side}`;
      this.group.add(catchlight);

      // Small secondary catchlight
      const catch2Geo = sphere(0.005, 0.005, 0.004, 10, 8);
      const catch2 = place(catch2Geo, catchMat, ex - sx * 0.008, ey - 0.008, ez + 0.030);
      this.group.add(catch2);

      // Upper eyelid — covers top of sclera
      const lidGeo = sphere(0.056, 0.028, 0.024, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const lidMat = skinMat(sk);
      const lid = place(lidGeo, lidMat, ex, ey + 0.008, ez + 0.010);
      lid.name = `upperLid_${side}`;
      this.group.add(lid);
      this.parts[`upperLid_${side}`] = lid;

      // Lower eyelid — subtle
      const lLidGeo = sphere(0.054, 0.018, 0.018, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
      const lLid = place(lLidGeo, skinMat(sk), ex, ey - 0.006, ez + 0.010);
      lLid.name = `lowerLid_${side}`;
      this.group.add(lLid);

      // Eyelash strip — dark curved band
      const lashGeo = sphere(0.058, 0.014, 0.010, 28, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
      const lashMat = new THREE.MeshToonMaterial({ color: new THREE.Color(0x0a0508) });
      const lash = place(lashGeo, lashMat, ex, ey + 0.010, ez + 0.014);
      lash.name = `lash_${side}`;
      this.group.add(lash);

      // Individual lash spikes — 8 per eye
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const la = -0.72 + t * 1.44; // angle across lid
        const lx = ex + Math.sin(la) * 0.052;
        const ly = ey + 0.016 + Math.cos(la) * 0.010;
        const lashSpikeGeo = capsule(0.003, 0.014, 4, 6);
        const lashSpike = place(lashSpikeGeo, lashMat, lx, ly, ez + 0.016);
        lashSpike.rotation.z = la * 0.4;
        lashSpike.rotation.x = -0.4;
        this.group.add(lashSpike);
      }

      // Eyebrow — thick stylized brow
      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ex - sx * 0.058, ey + 0.062, ez - 0.005),
        new THREE.Vector3(ex - sx * 0.020, ey + 0.072, ez + 0.002),
        new THREE.Vector3(ex + sx * 0.020, ey + 0.068, ez + 0.002),
        new THREE.Vector3(ex + sx * 0.055, ey + 0.055, ez - 0.002),
      ]);
      const browTubeGeo = new THREE.TubeGeometry(browCurve, 12, 0.010, 8, false);
      const browMat = new THREE.MeshToonMaterial({ color: new THREE.Color(0x2a1a5a) });
      const brow = new THREE.Mesh(browTubeGeo, browMat);
      brow.castShadow = true;
      brow.name = `brow_${side}`;
      this.group.add(brow);
      this.parts[`brow_${side}`] = brow;
    }
  }

  // ── Nose ───────────────────────────────────────────────────────────────────
  _buildNose(sk) {
    // Nose bridge
    const bridgeGeo = sphere(0.018, 0.048, 0.016, 16, 12);
    const bridge = place(bridgeGeo, skinMat(sk), 0, 0.010, 0.148);
    bridge.name = 'noseBridge';
    this.group.add(bridge);

    // Nose tip — rounded bulb
    const tipGeo = sphere(0.028, 0.024, 0.026, 18, 14);
    const tip = place(tipGeo, skinMat(sk), 0, -0.028, 0.158);
    tip.name = 'noseTip';
    this.group.add(tip);
    this.parts.noseTip = tip;

    // Nostrils
    for (const sx of [-1, 1]) {
      const nGeo = sphere(0.016, 0.012, 0.014, 14, 10);
      const n = place(nGeo, skinMat(sk, { roughness: 0.8 }), sx * 0.022, -0.038, 0.152);
      n.name = `nostril_${sx > 0 ? 'R' : 'L'}`;
      this.group.add(n);
    }
  }

  // ── Mouth ──────────────────────────────────────────────────────────────────
  _buildMouth(sk) {
    const lipColor = new THREE.Color(sk).lerp(new THREE.Color(0xb05050), 0.45);
    const lipMat = new THREE.MeshToonMaterial({ color: lipColor });
    const lipDarkMat = new THREE.MeshToonMaterial({ color: lipColor.clone().lerp(new THREE.Color(0x600000), 0.3) });

    // Upper lip — cupid's bow shape using two lobes
    for (const sx of [-1, 1]) {
      const ulGeo = sphere(0.026, 0.016, 0.018, 16, 12);
      const ul = place(ulGeo, lipMat, sx * 0.022, -0.095, 0.148);
      ul.name = `upperLip_${sx > 0 ? 'R' : 'L'}`;
      this.group.add(ul);
    }

    // Lower lip — fuller, single rounded form
    const llGeo = sphere(0.052, 0.022, 0.022, 22, 14);
    const ll = place(llGeo, lipMat, 0, -0.112, 0.148);
    ll.name = 'lowerLip';
    this.group.add(ll);
    this.parts.lowerLip = ll;

    // Lip line
    const lipLineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.048, -0.100, 0.148),
      new THREE.Vector3(-0.022, -0.096, 0.152),
      new THREE.Vector3(0, -0.098, 0.153),
      new THREE.Vector3(0.022, -0.096, 0.152),
      new THREE.Vector3(0.048, -0.100, 0.148),
    ]);
    const lipLineGeo = new THREE.TubeGeometry(lipLineCurve, 12, 0.004, 6, false);
    const lipLine = new THREE.Mesh(lipLineGeo, lipDarkMat);
    lipLine.name = 'lipLine';
    this.group.add(lipLine);

    // Mouth corners
    for (const sx of [-1, 1]) {
      const mcGeo = sphere(0.010, 0.010, 0.008, 12, 10);
      const mc = place(mcGeo, lipDarkMat, sx * 0.048, -0.100, 0.147);
      this.group.add(mc);
    }
  }

  // ── Ears ───────────────────────────────────────────────────────────────────
  _buildEars(sk) {
    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';

      // Outer ear — ellipsoid
      const earGeo = sphere(0.028, 0.048, 0.022, 20, 16);
      const ear = place(earGeo, skinMat(sk), sx * 0.162, -0.008, 0.012);
      ear.name = `ear_${side}`;
      this.group.add(ear);
      this.parts[`ear_${side}`] = ear;

      // Inner ear concha
      const conchaGeo = sphere(0.018, 0.032, 0.012, 16, 12);
      const conchaMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(sk).lerp(new THREE.Color(0xc06050), 0.25),
      });
      const concha = place(conchaGeo, conchaMat, sx * 0.166, -0.006, 0.018);
      concha.name = `concha_${side}`;
      this.group.add(concha);

      // Ear lobe
      const lobeGeo = sphere(0.018, 0.016, 0.014, 14, 10);
      const lobe = place(lobeGeo, skinMat(sk), sx * 0.158, -0.052, 0.014);
      lobe.name = `lobe_${side}`;
      this.group.add(lobe);
      this.parts[`lobe_${side}`] = lobe;
    }
  }

  // ── Neck ───────────────────────────────────────────────────────────────────
  _buildNeck(sk) {
    const neckPts = [
      [0.000, -0.162],  // connects to chin base
      [0.032, -0.175],
      [0.038, -0.200],
      [0.036, -0.230],
      [0.034, -0.260],  // base of neck
      [0.042, -0.270],  // flare into shoulders
    ];
    const neckGeo = lathe(neckPts, 32);
    const neck = place(neckGeo, skinMat(sk), 0, 0, 0);
    neck.name = 'neck';
    this.group.add(neck);
    this.parts.neck = neck;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setSkinTone(hex) {
    this._skinHex = hex;
    const skinParts = ['skull', 'browRidge', 'cheek_L', 'cheek_R', 'chin', 'forehead',
      'upperLid_L', 'upperLid_R', 'lowerLid_L', 'lowerLid_R',
      'noseTip', 'noseBridge', 'ear_L', 'ear_R', 'lobe_L', 'lobe_R', 'neck'];
    skinParts.forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
    // Update blush
    ['blush_L', 'blush_R'].forEach(n => {
      if (this.parts[n]) {
        const c = new THREE.Color(hex);
        c.lerp(new THREE.Color(0xe87878), 0.5);
        this.parts[n].material.color.set(c);
      }
    });
  }

  setEyeColor(hex) {
    ['iris_L', 'iris_R'].forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
  }

  setLipColor(hex) {
    const c = new THREE.Color(hex);
    const dark = c.clone().lerp(new THREE.Color(0x600000), 0.3);
    this.group.traverse((obj) => {
      if (!obj.isMesh || !obj.material?.color) return;
      const n = obj.name || '';
      if (n === 'lowerLip' || n.startsWith('upperLip')) {
        obj.material.color.copy(c);
      } else if (n === 'lipLine') {
        obj.material.color.copy(dark);
      }
    });
  }

  setBrowColor(hex) {
    ['brow_L', 'brow_R'].forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
  }

  getAttachPoint(slot) {
    const pts = {
      hat:        new THREE.Vector3(0,  0.230, 0),
      hair:       new THREE.Vector3(0,  0.220, 0),
      glasses:    new THREE.Vector3(0,  0.022, 0.148),
      sunglasses: new THREE.Vector3(0,  0.022, 0.148),
      earringL:   new THREE.Vector3(-0.165, -0.052, 0.014),
      earringR:   new THREE.Vector3( 0.165, -0.052, 0.014),
    };
    return pts[slot] || new THREE.Vector3(0, 0, 0);
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        obj.material?.dispose();
      }
    });
  }
}
