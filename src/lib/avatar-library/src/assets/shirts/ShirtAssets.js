/**
 * ShirtAssets.js + JacketAssets.js  (v2 — body-wrapping)
 * Clothing that conforms to the new cartoon humanoid BodyMesh v2.
 *
 * Key changes from v1:
 *  - Torso shell uses a tapered CylinderGeometry matching the new chest/waist shape
 *  - Sleeves are CapsuleGeometry to match the arm capsules, positioned to overlap joints
 *  - Sleeve caps (shoulder pads) cover the shoulder sphere joints
 *  - Hem extends slightly over the hip joints
 *  - All dimensions tuned to the new body proportions
 */
import * as THREE from 'three';

function mkCloth(hex, roughness = 0.85, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness, metalness,
    side: THREE.FrontSide,
  });
}

// ─── Tapered torso shell ──────────────────────────────────────────────────────
function taperedShell(topW, botW, topD, botD, height, mat) {
  const geo = new THREE.CylinderGeometry(1, 1, height, 18, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y / height) + 0.5;
    pos.setX(i, pos.getX(i) * THREE.MathUtils.lerp(botW, topW, t));
    pos.setZ(i, pos.getZ(i) * THREE.MathUtils.lerp(botD, topD, t));
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// ─── Sleeve builder — CapsuleGeometry matching the arm capsules ───────────────
function buildSleeve(mat, len, radius, side) {
  const sx = side === 'L' ? -1 : 1;
  const g = new THREE.Group();

  // Shoulder cap — covers the shoulder sphere joint
  const capGeo = new THREE.SphereGeometry(radius * 1.08, 12, 10);
  const cap = new THREE.Mesh(capGeo, mat.clone());
  cap.position.set(sx * 0.285, 0.13, 0); // relative to garment origin (chest center)
  g.add(cap);

  if (len <= 0) return g;

  // Upper arm sleeve
  const upperLen = Math.min(len, 0.24);
  const upperGeo = new THREE.CapsuleGeometry(radius, upperLen, 6, 12);
  const upper = new THREE.Mesh(upperGeo, mat.clone());
  upper.position.set(sx * 0.355, 0.13 - upperLen * 0.5, 0);
  upper.rotation.z = sx * 0.10;
  g.add(upper);

  if (len > 0.24) {
    // Elbow cover
    const elbowGeo = new THREE.SphereGeometry(radius * 0.96, 10, 8);
    const elbow = new THREE.Mesh(elbowGeo, mat.clone());
    elbow.position.set(sx * 0.385, 0.13 - upperLen - 0.01, 0);
    g.add(elbow);

    // Lower arm sleeve
    const lowerLen = len - 0.24;
    const lowerGeo = new THREE.CapsuleGeometry(radius * 0.88, lowerLen, 6, 12);
    const lower = new THREE.Mesh(lowerGeo, mat.clone());
    lower.position.set(sx * 0.405, 0.13 - upperLen - 0.02 - lowerLen * 0.5, 0);
    lower.rotation.z = sx * 0.07;
    g.add(lower);
  }

  return g;
}

// ─── Main garment builder ─────────────────────────────────────────────────────
/**
 * Builds a body-wrapping top garment.
 * @param {object} cfg
 * @param {string}  cfg.color         Main fabric color hex
 * @param {string}  cfg.accentColor   Collar/trim color
 * @param {string}  cfg.collarType    'none'|'crew'|'v'|'collar'|'hood'|'turtleneck'
 * @param {number}  cfg.length        Vertical length (0.28 = crop, 0.52 = regular, 0.80 = coat)
 * @param {number}  cfg.sleeveLen     0 = sleeveless, 0.24 = short, 0.48 = long
 * @param {number}  cfg.shoulderW     Shoulder width multiplier (default 1.0)
 * @param {number}  cfg.bulkiness     Extra thickness multiplier (default 1.0)
 */
function buildGarment(cfg) {
  const g = new THREE.Group();
  const {
    color = '#FFFFFF',
    accentColor = null,
    collarType = 'crew',
    length = 0.52,
    sleeveLen = 0.48,
    shoulderW = 1.0,
    bulkiness = 1.0,
  } = cfg;

  const mat = mkCloth(color);
  const acc = mkCloth(accentColor || color, 0.7);

  // ── Torso shell ─────────────────────────────────────────────────────────────
  // Matches the new BodyMesh chest (0.44w top, 0.36w bottom) + slight offset
  const topW  = 0.235 * shoulderW * bulkiness;
  const botW  = 0.210 * bulkiness;
  const topD  = 0.155 * bulkiness;
  const botD  = 0.140 * bulkiness;
  const shell = taperedShell(topW, botW, topD, botD, length, mat.clone());
  // Position: chest center is at y=1.26, waist at y=0.98
  // Garment origin = chest attach point (0, 1.26, 0) in world space
  // Shell is centered at half-length below that
  shell.position.y = -length * 0.5 + 0.02;
  g.add(shell);

  // ── Sleeves ─────────────────────────────────────────────────────────────────
  const sleeveRadius = 0.078 * bulkiness;
  for (const side of ['L', 'R']) {
    const sleeveGroup = buildSleeve(mat, sleeveLen, sleeveRadius, side);
    sleeveGroup.position.y = -0.01; // align with shoulder top
    g.add(sleeveGroup);
  }

  // ── Collar ──────────────────────────────────────────────────────────────────
  if (collarType === 'crew') {
    const crew = new THREE.Mesh(
      new THREE.TorusGeometry(0.080, 0.013, 8, 22),
      acc.clone()
    );
    crew.rotation.x = Math.PI / 2;
    crew.position.y = 0.015;
    g.add(crew);
  } else if (collarType === 'v') {
    [-1, 1].forEach(side => {
      const vGeo = new THREE.BoxGeometry(0.009, 0.060, 0.006);
      const v = new THREE.Mesh(vGeo, acc.clone());
      v.position.set(side * 0.028, -0.018, 0.062);
      v.rotation.z = side * 0.52;
      g.add(v);
    });
  } else if (collarType === 'collar') {
    // Shirt collar band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.085, 0.028, 16, 1, true),
      acc.clone()
    );
    band.position.y = 0.015;
    g.add(band);
    // Collar points
    [-1, 1].forEach(side => {
      const pt = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.026, 0.007), acc.clone());
      pt.position.set(side * 0.058, -0.014, 0.058);
      pt.rotation.z = side * 0.30;
      g.add(pt);
    });
    // Buttons
    const btnMat = mkCloth(accentColor || '#DDDDDD', 0.3);
    for (let i = 0; i < 4; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8), btnMat.clone());
      btn.position.set(0, -0.04 - i * 0.065, 0.062);
      btn.rotation.x = Math.PI / 2;
      g.add(btn);
    }
  } else if (collarType === 'turtleneck') {
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.076, 0.082, 0.068, 16, 2),
      mat.clone()
    );
    neck.position.y = 0.048;
    g.add(neck);
  } else if (collarType === 'hood') {
    const hoodGeo = new THREE.SphereGeometry(0.105, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const hood = new THREE.Mesh(hoodGeo, mat.clone());
    hood.position.set(0, 0.025, -0.045);
    g.add(hood);
    // Hood rim
    const rimGeo = new THREE.TorusGeometry(0.085, 0.010, 8, 20, Math.PI);
    const rim = new THREE.Mesh(rimGeo, acc.clone());
    rim.position.set(0, 0.025, 0.055);
    rim.rotation.x = -0.3;
    g.add(rim);
  }

  // ── Hem band (bottom edge) ───────────────────────────────────────────────────
  const hemGeo = new THREE.TorusGeometry(botW * 0.92, 0.008, 6, 22);
  const hem = new THREE.Mesh(hemGeo, acc.clone());
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -length + 0.01;
  g.add(hem);

  return g;
}

// ─── Lapel builder for jackets ────────────────────────────────────────────────
function addLapels(g, color) {
  const mat = mkCloth(color, 0.7);
  [-1, 1].forEach(side => {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.088, 0.009), mat.clone());
    lapel.position.set(side * 0.042, -0.008, 0.065);
    lapel.rotation.z = side * 0.30;
    g.add(lapel);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHIRT LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

export const SHIRT_LIBRARY = [
  {
    id: 'shirt-white-dress',
    label: 'White Dress Shirt',
    category: 'formal',
    thumbnail: '👔',
    description: 'Classic white dress shirt with collar.',
    build: (color = '#F5F5F5') => buildGarment({ color, accentColor: '#FFFFFF', collarType: 'collar', length: 0.52, sleeveLen: 0.48 }),
  },
  {
    id: 'shirt-polo',
    label: 'Polo Shirt',
    category: 'casual',
    thumbnail: '👕',
    description: 'Classic polo shirt.',
    build: (color = '#1565C0') => buildGarment({ color, accentColor: color, collarType: 'collar', length: 0.50, sleeveLen: 0.24 }),
  },
  {
    id: 'shirt-tshirt',
    label: 'T-Shirt',
    category: 'casual',
    thumbnail: '👕',
    description: 'Basic crew-neck T-shirt.',
    build: (color = '#E53935') => buildGarment({ color, collarType: 'crew', length: 0.48, sleeveLen: 0.24 }),
  },
  {
    id: 'shirt-vneck',
    label: 'V-Neck Tee',
    category: 'casual',
    thumbnail: '👕',
    description: 'V-neck T-shirt.',
    build: (color = '#4CAF50') => buildGarment({ color, collarType: 'v', length: 0.48, sleeveLen: 0.24 }),
  },
  {
    id: 'shirt-tank',
    label: 'Tank Top',
    category: 'casual',
    thumbnail: '🎽',
    description: 'Sleeveless tank top.',
    build: (color = '#FF9800') => buildGarment({ color, collarType: 'crew', length: 0.48, sleeveLen: 0 }),
  },
  {
    id: 'shirt-turtleneck',
    label: 'Turtleneck',
    category: 'casual',
    thumbnail: '🧥',
    description: 'Fitted turtleneck sweater.',
    build: (color = '#212121') => buildGarment({ color, collarType: 'turtleneck', length: 0.50, sleeveLen: 0.48 }),
  },
  {
    id: 'shirt-hoodie-base',
    label: 'Hoodie',
    category: 'streetwear',
    thumbnail: '🧥',
    description: 'Pullover hoodie.',
    build: (color = '#455A64') => buildGarment({ color, collarType: 'hood', length: 0.54, sleeveLen: 0.48, bulkiness: 1.08 }),
  },
  {
    id: 'shirt-crop',
    label: 'Crop Top',
    category: 'fashion',
    thumbnail: '👚',
    description: 'Short crop top.',
    build: (color = '#E91E8C') => buildGarment({ color, collarType: 'crew', length: 0.28, sleeveLen: 0.20 }),
  },
  {
    id: 'shirt-flannel',
    label: 'Flannel Shirt',
    category: 'casual',
    thumbnail: '🟥',
    description: 'Plaid flannel shirt.',
    build: (color = '#8B0000') => buildGarment({ color, accentColor: '#FFCCCC', collarType: 'collar', length: 0.52, sleeveLen: 0.48 }),
  },
  {
    id: 'shirt-athletic',
    label: 'Athletic Jersey',
    category: 'sport',
    thumbnail: '🏅',
    description: 'Sports jersey.',
    build: (color = '#1565C0') => buildGarment({ color, accentColor: '#FFFFFF', collarType: 'v', length: 0.50, sleeveLen: 0.24 }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  JACKET LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

export const JACKET_LIBRARY = [
  {
    id: 'jacket-blazer',
    label: 'Blazer',
    category: 'formal',
    thumbnail: '🧥',
    description: 'Tailored blazer.',
    build: (color = '#1A237E') => {
      const g = buildGarment({ color, accentColor: color, collarType: 'collar', length: 0.56, sleeveLen: 0.48, shoulderW: 1.06 });
      addLapels(g, color);
      return g;
    },
  },
  {
    id: 'jacket-bomber',
    label: 'Bomber Jacket',
    category: 'casual',
    thumbnail: '✈️',
    description: 'Classic bomber jacket.',
    build: (color = '#33691E') => buildGarment({ color, accentColor: '#FFC107', collarType: 'crew', length: 0.50, sleeveLen: 0.48, bulkiness: 1.06 }),
  },
  {
    id: 'jacket-denim',
    label: 'Denim Jacket',
    category: 'casual',
    thumbnail: '👖',
    description: 'Classic denim jacket.',
    build: (color = '#1565C0') => {
      const g = buildGarment({ color, accentColor: '#0D47A1', collarType: 'collar', length: 0.50, sleeveLen: 0.48, shoulderW: 1.04 });
      addLapels(g, '#0D47A1');
      return g;
    },
  },
  {
    id: 'jacket-leather',
    label: 'Leather Jacket',
    category: 'fashion',
    thumbnail: '🖤',
    description: 'Biker leather jacket.',
    build: (color = '#1A1A1A') => {
      const g = buildGarment({ color, accentColor: '#333333', collarType: 'collar', length: 0.50, sleeveLen: 0.48, shoulderW: 1.05 });
      addLapels(g, '#333333');
      return g;
    },
  },
  {
    id: 'jacket-puffer',
    label: 'Puffer Jacket',
    category: 'casual',
    thumbnail: '🧊',
    description: 'Quilted puffer jacket.',
    build: (color = '#E53935') => {
      const g = buildGarment({ color, collarType: 'crew', length: 0.54, sleeveLen: 0.48, bulkiness: 1.14 });
      // Quilt rings
      for (let i = 0; i < 5; i++) {
        const quilt = new THREE.Mesh(
          new THREE.TorusGeometry(0.21, 0.004, 6, 22, Math.PI * 2),
          mkCloth(color, 0.9)
        );
        quilt.rotation.x = Math.PI / 2;
        quilt.position.y = -0.04 - i * 0.085;
        g.add(quilt);
      }
      return g;
    },
  },
  {
    id: 'jacket-varsity',
    label: 'Varsity Jacket',
    category: 'sport',
    thumbnail: '🏆',
    description: 'Letterman varsity jacket.',
    build: (color = '#B71C1C') => buildGarment({ color, accentColor: '#FFFFFF', collarType: 'crew', length: 0.52, sleeveLen: 0.48, bulkiness: 1.06 }),
  },
  {
    id: 'jacket-trench',
    label: 'Trench Coat',
    category: 'formal',
    thumbnail: '🕵️',
    description: 'Classic trench coat.',
    build: (color = '#8D6E63') => {
      const g = buildGarment({ color, accentColor: '#6D4C41', collarType: 'collar', length: 0.80, sleeveLen: 0.48, shoulderW: 1.04 });
      addLapels(g, '#6D4C41');
      // Belt
      const beltGeo = new THREE.TorusGeometry(0.195, 0.009, 6, 24);
      const belt = new THREE.Mesh(beltGeo, mkCloth('#5D4037', 0.7));
      belt.rotation.x = Math.PI / 2;
      belt.position.y = -0.32;
      g.add(belt);
      return g;
    },
  },
  {
    id: 'jacket-windbreaker',
    label: 'Windbreaker',
    category: 'sport',
    thumbnail: '💨',
    description: 'Lightweight windbreaker.',
    build: (color = '#0288D1') => buildGarment({ color, accentColor: '#01579B', collarType: 'hood', length: 0.52, sleeveLen: 0.48 }),
  },
];
