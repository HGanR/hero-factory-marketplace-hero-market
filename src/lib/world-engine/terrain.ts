/**
 * Procedural terrain height from seed.
 * Shared by viewer and editor.
 */
const _p = new Uint8Array(512);

function initPermutation(seed: number) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let s0 = seed;
  for (let i = 255; i > 0; i--) {
    s0 = (s0 * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s0) % (i + 1);
    [s[i], s[j]] = [s[j], s[i]];
  }
  for (let i = 0; i < 512; i++) _p[i] = s[i & 255];
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerpN(a: number, b: number, t: number) {
  return a + t * (b - a);
}
function grad(h: number, x: number, y: number) {
  const u = h & 2 ? -x : x;
  const v = h & 1 ? -y : y;
  return u + v;
}

let _lastSeed = -1;
function noise2(x: number, y: number, seed: number) {
  if (seed !== _lastSeed) {
    initPermutation(seed);
    _lastSeed = seed;
  }
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  return lerpN(
    lerpN(
      grad(_p[_p[X] + Y], xf, yf),
      grad(_p[_p[X + 1] + Y], xf - 1, yf),
      u
    ),
    lerpN(
      grad(_p[_p[X] + Y + 1], xf, yf - 1),
      grad(_p[_p[X + 1] + Y + 1], xf - 1, yf - 1),
      u
    ),
    v
  );
}

function fbm(x: number, y: number, seed: number, octaves = 5) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let m = 0;
  for (let i = 0; i < octaves; i++) {
    v += noise2(x * f, y * f, seed + i * 1000) * a;
    m += a;
    a *= 0.5;
    f *= 2;
  }
  return v / m;
}

export function terrainHeight(x: number, z: number, seed: number = 42): number {
  const nx = x / 200 + 0.5;
  const nz = z / 200 + 0.5;
  const h = fbm(nx * 3, nz * 3, seed) * 8 + fbm(nx * 7, nz * 7, seed + 1) * 2;
  const d = Math.sqrt(x * x + z * z);
  if (d < 60) return 0;
  const t = Math.min(1, (d - 60) / 30);
  return h * t * t * (3 - 2 * t);
}
