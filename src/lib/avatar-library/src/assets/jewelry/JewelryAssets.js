/**
 * JewelryAssets.js
 * Jewelry library — necklaces, earrings, bracelets, rings
 * All built procedurally with Three.js geometry.
 */
import * as THREE from 'three';

// ─── Material helpers ─────────────────────────────────────────────────────────

const METALS = {
  gold:      { color: '#FFD700', roughness: 0.15, metalness: 0.95 },
  silver:    { color: '#C0C0C0', roughness: 0.10, metalness: 0.98 },
  rose_gold: { color: '#E8A090', roughness: 0.15, metalness: 0.92 },
  bronze:    { color: '#CD7F32', roughness: 0.25, metalness: 0.85 },
  black:     { color: '#1A1A1A', roughness: 0.20, metalness: 0.90 },
  platinum:  { color: '#E8E8F0', roughness: 0.08, metalness: 0.99 },
};

const GEMS = {
  diamond:   { color: '#E8F4FF', roughness: 0.0, metalness: 0.0, transparent: true, opacity: 0.85 },
  ruby:      { color: '#C0392B', roughness: 0.05, metalness: 0.1 },
  emerald:   { color: '#1B7A4A', roughness: 0.05, metalness: 0.1 },
  sapphire:  { color: '#1565C0', roughness: 0.05, metalness: 0.1 },
  amethyst:  { color: '#7B1FA2', roughness: 0.05, metalness: 0.1 },
  pearl:     { color: '#F8F0E8', roughness: 0.1, metalness: 0.3 },
  onyx:      { color: '#0A0A0A', roughness: 0.1, metalness: 0.5 },
  turquoise: { color: '#00897B', roughness: 0.1, metalness: 0.1 },
};

function mkMetal(type = 'gold') {
  const m = METALS[type] || METALS.gold;
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(m.color), roughness: m.roughness, metalness: m.metalness });
}
function mkGem(type = 'diamond') {
  const g = GEMS[type] || GEMS.diamond;
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(g.color), roughness: g.roughness, metalness: g.metalness });
  if (g.transparent) { mat.transparent = true; mat.opacity = g.opacity; }
  return mat;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NECKLACES
// ═══════════════════════════════════════════════════════════════════════════════

function chainNecklace(metal = 'gold') {
  const g = new THREE.Group(); g.name = 'necklace-chain';
  const mat = mkMetal(metal);
  // Chain arc
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.003, 6, 32, Math.PI * 1.4), mat);
  chain.rotation.x = Math.PI / 2;
  chain.rotation.z = Math.PI * 0.1;
  g.add(chain);
  // Pendant
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), mat.clone());
  pendant.position.set(0, -0.068, 0);
  g.add(pendant);
  return g;
}

function pearlNecklace() {
  const g = new THREE.Group(); g.name = 'necklace-pearl';
  const mat = mkGem('pearl');
  const chainMat = mkMetal('gold');
  for (let i = 0; i < 18; i++) {
    const angle = (i / 17) * Math.PI * 1.4 - Math.PI * 0.7;
    const r = 0.068;
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), mat.clone());
    pearl.position.set(Math.sin(angle) * r, -Math.cos(angle) * r * 0.3, 0);
    g.add(pearl);
  }
  // Clasp
  const clasp = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 6), chainMat);
  clasp.position.set(0, 0.068, 0);
  g.add(clasp);
  return g;
}

function pendantNecklace(metal = 'silver', gem = 'sapphire') {
  const g = new THREE.Group(); g.name = 'necklace-pendant';
  const chainMat = mkMetal(metal);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.002, 6, 32, Math.PI * 1.4), chainMat);
  chain.rotation.x = Math.PI / 2;
  chain.rotation.z = Math.PI * 0.1;
  g.add(chain);
  // Pendant setting
  const setting = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.004, 12), chainMat.clone());
  setting.position.set(0, -0.068, 0);
  g.add(setting);
  // Gem
  const gemMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.009), mkGem(gem));
  gemMesh.position.set(0, -0.068, 0.005);
  g.add(gemMesh);
  return g;
}

function choker(metal = 'black') {
  const g = new THREE.Group(); g.name = 'necklace-choker';
  const mat = mkMetal(metal);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.006, 8, 32, Math.PI * 1.5), mat);
  band.rotation.x = Math.PI / 2;
  g.add(band);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EARRINGS
// ═══════════════════════════════════════════════════════════════════════════════

function buildEarringPair(buildSingle) {
  const g = new THREE.Group(); g.name = 'earrings';
  const left  = buildSingle(); left.name  = 'earringLeft';  left.position.x  = -0.115;
  const right = buildSingle(); right.name = 'earringRight'; right.position.x =  0.115;
  g.add(left); g.add(right);
  return g;
}

function studEarrings(metal = 'gold', gem = 'diamond') {
  return buildEarringPair(() => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.008, 6), mkMetal(metal));
    post.position.y = -0.004;
    g.add(post);
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), mkGem(gem));
    g.add(stone);
    return g;
  });
}

function hoopEarrings(metal = 'gold') {
  return buildEarringPair(() => {
    const g = new THREE.Group();
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.002, 8, 20, Math.PI * 1.9), mkMetal(metal));
    hoop.rotation.y = Math.PI / 2;
    g.add(hoop);
    return g;
  });
}

function dropEarrings(metal = 'gold', gem = 'ruby') {
  return buildEarringPair(() => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.008, 6), mkMetal(metal));
    post.position.y = -0.004;
    g.add(post);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.020, 4), mkMetal(metal));
    chain.position.y = -0.018;
    g.add(chain);
    const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.007), mkGem(gem));
    drop.position.y = -0.030;
    g.add(drop);
    return g;
  });
}

function chandelierEarrings(metal = 'gold') {
  return buildEarringPair(() => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 14), mkMetal(metal));
    g.add(top);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 4) * Math.PI;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.022, 4), mkMetal(metal));
      strand.position.set(Math.cos(angle) * 0.008, -0.018, 0);
      strand.rotation.z = Math.cos(angle) * 0.4;
      g.add(strand);
    }
    return g;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BRACELETS
// ═══════════════════════════════════════════════════════════════════════════════

function buildBraceletPair(buildSingle) {
  const g = new THREE.Group(); g.name = 'bracelets';
  const left  = buildSingle(); left.name  = 'braceletLeft';  left.position.x  = -0.27;
  const right = buildSingle(); right.name = 'braceletRight'; right.position.x =  0.27;
  g.add(left); g.add(right);
  return g;
}

function bangles(metal = 'gold') {
  return buildBraceletPair(() => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const bangle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 8, 24), mkMetal(metal));
      bangle.rotation.x = Math.PI / 2;
      bangle.position.y = i * 0.010;
      g.add(bangle);
    }
    return g;
  });
}

function chainBracelet(metal = 'silver') {
  return buildBraceletPair(() => {
    const g = new THREE.Group();
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.003, 6, 24, Math.PI * 1.85), mkMetal(metal));
    chain.rotation.x = Math.PI / 2;
    g.add(chain);
    return g;
  });
}

function pearlBracelet() {
  return buildBraceletPair(() => {
    const g = new THREE.Group();
    const mat = mkGem('pearl');
    for (let i = 0; i < 14; i++) {
      const angle = (i / 13) * Math.PI * 1.85;
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), mat.clone());
      pearl.position.set(Math.cos(angle) * 0.028, 0, Math.sin(angle) * 0.028);
      g.add(pearl);
    }
    return g;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RINGS
// ═══════════════════════════════════════════════════════════════════════════════

function plainRing(metal = 'gold') {
  const g = new THREE.Group(); g.name = 'ring-plain';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.010, 0.003, 8, 20), mkMetal(metal));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}

function gemRing(metal = 'gold', gem = 'diamond') {
  const g = new THREE.Group(); g.name = 'ring-gem';
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.010, 0.003, 8, 20), mkMetal(metal));
  band.rotation.x = Math.PI / 2;
  g.add(band);
  // Setting
  const setting = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 8), mkMetal(metal));
  setting.position.y = 0.010;
  g.add(setting);
  // Gem
  const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.005), mkGem(gem));
  stone.position.y = 0.014;
  g.add(stone);
  return g;
}

function signetRing(metal = 'gold') {
  const g = new THREE.Group(); g.name = 'ring-signet';
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.010, 0.003, 8, 20), mkMetal(metal));
  band.rotation.x = Math.PI / 2;
  g.add(band);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.008, 0.003), mkMetal(metal));
  face.position.y = 0.010;
  g.add(face);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JEWELRY LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

export const JEWELRY_LIBRARY = [
  // Necklaces
  { id: 'necklace-chain',    label: 'Gold Chain',       slot: 'necklace',  category: 'necklace',  thumbnail: '📿', description: 'Classic gold chain.',         build: () => chainNecklace('gold')              },
  { id: 'necklace-silver',   label: 'Silver Chain',     slot: 'necklace',  category: 'necklace',  thumbnail: '📿', description: 'Silver chain necklace.',      build: () => chainNecklace('silver')            },
  { id: 'necklace-pearl',    label: 'Pearl Strand',     slot: 'necklace',  category: 'necklace',  thumbnail: '🪩', description: 'Elegant pearl necklace.',     build: () => pearlNecklace()                    },
  { id: 'necklace-pendant',  label: 'Sapphire Pendant', slot: 'necklace',  category: 'necklace',  thumbnail: '💎', description: 'Silver pendant with sapphire.', build: () => pendantNecklace('silver','sapphire') },
  { id: 'necklace-choker',   label: 'Choker',           slot: 'necklace',  category: 'necklace',  thumbnail: '🖤', description: 'Black choker.',               build: () => choker('black')                    },
  // Earrings
  { id: 'earring-stud-diamond', label: 'Diamond Studs',  slot: 'earringL', category: 'earring',  thumbnail: '💎', description: 'Diamond stud earrings.',      build: () => studEarrings('gold','diamond')     },
  { id: 'earring-stud-ruby',    label: 'Ruby Studs',     slot: 'earringL', category: 'earring',  thumbnail: '🔴', description: 'Ruby stud earrings.',         build: () => studEarrings('gold','ruby')        },
  { id: 'earring-hoop-gold',    label: 'Gold Hoops',     slot: 'earringL', category: 'earring',  thumbnail: '⭕', description: 'Gold hoop earrings.',         build: () => hoopEarrings('gold')               },
  { id: 'earring-hoop-silver',  label: 'Silver Hoops',   slot: 'earringL', category: 'earring',  thumbnail: '⭕', description: 'Silver hoop earrings.',       build: () => hoopEarrings('silver')             },
  { id: 'earring-drop',         label: 'Ruby Drop',      slot: 'earringL', category: 'earring',  thumbnail: '💧', description: 'Gold drop earrings with ruby.', build: () => dropEarrings('gold','ruby')       },
  { id: 'earring-chandelier',   label: 'Chandelier',     slot: 'earringL', category: 'earring',  thumbnail: '✨', description: 'Chandelier earrings.',        build: () => chandelierEarrings('gold')         },
  // Bracelets
  { id: 'bracelet-bangle-gold',   label: 'Gold Bangles',   slot: 'braceletL', category: 'bracelet', thumbnail: '🔱', description: 'Stacked gold bangles.',    build: () => bangles('gold')                    },
  { id: 'bracelet-bangle-silver', label: 'Silver Bangles', slot: 'braceletL', category: 'bracelet', thumbnail: '🔱', description: 'Stacked silver bangles.',  build: () => bangles('silver')                  },
  { id: 'bracelet-chain',         label: 'Chain Bracelet', slot: 'braceletL', category: 'bracelet', thumbnail: '⛓️', description: 'Silver chain bracelet.',   build: () => chainBracelet('silver')            },
  { id: 'bracelet-pearl',         label: 'Pearl Bracelet', slot: 'braceletL', category: 'bracelet', thumbnail: '🪩', description: 'Pearl bracelet.',          build: () => pearlBracelet()                    },
  // Rings
  { id: 'ring-plain-gold',   label: 'Gold Band',      slot: 'ring', category: 'ring', thumbnail: '💍', description: 'Plain gold band.',            build: () => plainRing('gold')                  },
  { id: 'ring-plain-silver', label: 'Silver Band',    slot: 'ring', category: 'ring', thumbnail: '💍', description: 'Plain silver band.',          build: () => plainRing('silver')                },
  { id: 'ring-diamond',      label: 'Diamond Ring',   slot: 'ring', category: 'ring', thumbnail: '💎', description: 'Diamond solitaire ring.',     build: () => gemRing('gold','diamond')          },
  { id: 'ring-emerald',      label: 'Emerald Ring',   slot: 'ring', category: 'ring', thumbnail: '💚', description: 'Emerald ring.',               build: () => gemRing('gold','emerald')          },
  { id: 'ring-signet',       label: 'Signet Ring',    slot: 'ring', category: 'ring', thumbnail: '🔏', description: 'Gold signet ring.',           build: () => signetRing('gold')                 },
];

export { METALS, GEMS };
