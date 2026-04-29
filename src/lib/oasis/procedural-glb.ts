/**
 * Pure Node procedural GLB generator - no Blender, no Python.
 * Outputs valid glTF 2.0 binary from AssetSpec.
 */
import type { AssetSpec } from "@/lib/validators/oasis-asset-gen";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function createConeVertices(radius: number, height: number, segments: number): number[] {
  const verts: number[] = [];
  verts.push(0, height, 0); // apex
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    verts.push(radius * Math.cos(a), 0, radius * Math.sin(a));
  }
  verts.push(0, 0, 0); // base center
  return verts;
}

function createConeIndices(segments: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < segments; i++) {
    idx.push(0, 1 + i, 1 + ((i + 1) % segments));
    idx.push(1 + i, segments + 1, 1 + ((i + 1) % segments));
  }
  return idx;
}

function createCubeVertices(w: number, h: number, d: number): number[] {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  return [
    -hw, -hh, -hd, hw, -hh, -hd, hw, hh, -hd, -hw, hh, -hd,
    -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd,
    -hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd,
    hw, -hh, -hd, hw, -hh, hd, hw, hh, hd, hw, hh, -hd,
    -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
    -hw, hh, -hd, hw, hh, -hd, hw, hh, hd, -hw, hh, hd,
  ];
}

function createCubeIndices(): number[] {
  const idx: number[] = [];
  for (let f = 0; f < 6; f++) {
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  return idx;
}

function createIcoSphereVertices(radius: number, subdivisions: number): { vertices: number[]; indices: number[] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: number[] = [
    -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0,
    0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t,
    t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1,
  ];
  const idx: number[] = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];
  const scale = radius / Math.sqrt(1 + t * t);
  for (let i = 0; i < verts.length; i += 3) {
    verts[i] *= scale;
    verts[i + 1] *= scale;
    verts[i + 2] *= scale;
  }
  return { vertices: verts, indices: idx };
}

function buildGlb(gltfJson: object, binaryData: Uint8Array): Buffer {
  const jsonStr = JSON.stringify(gltfJson);
  const jsonBytes = Buffer.from(jsonStr, "utf8");
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonPadded = Buffer.alloc(jsonBytes.length + jsonPad);
  jsonBytes.copy(jsonPadded);
  jsonPadded.fill(0x20, jsonBytes.length);

  const binPad = (4 - (binaryData.length % 4)) % 4;
  const binPadded = Buffer.alloc(binaryData.length + binPad);
  binPadded.set(binaryData, 0);

  const totalLen = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);

  const jsonChunk = Buffer.alloc(8 + jsonPadded.length);
  jsonChunk.writeUInt32LE(jsonPadded.length, 0);
  jsonChunk.writeUInt32LE(0x4e4f534a, 4); // "JSON"
  jsonPadded.copy(jsonChunk, 8);

  const binChunk = Buffer.alloc(8 + binPadded.length);
  binChunk.writeUInt32LE(binPadded.length, 0);
  binChunk.writeUInt32LE(0x004e4942, 4); // "BIN\0"
  binPadded.copy(binChunk, 8);

  return Buffer.concat([header, jsonChunk, binChunk]);
}

export function generateProceduralGlb(spec: AssetSpec): Buffer {
  const kind = spec.kind;
  const params = spec.params ?? {};
  const mats = spec.materials ?? { primary: "#6B4E2E", secondary: "#2E6B3A" };
  const [pr, pg, pb] = hexToRgb(mats.primary);

  let vertices: number[];
  let indices: number[];
  let bounds: { min: [number, number, number]; max: [number, number, number] };

  if (kind === "tree") {
    const trunkH = Number(params.trunkHeight ?? 2.2);
    const trunkR = Number(params.trunkRadius ?? 0.18);
    const leafR = Number(params.leafRadius ?? 0.9);
    const trunkVerts = createConeVertices(trunkR, trunkH, 8);
    const trunkIdx = createConeIndices(8);
    const leafCenterY = trunkH + leafR * 0.75;
    const leaf = createIcoSphereVertices(leafR, 0);
    for (let i = 0; i < leaf.vertices.length; i += 3) {
      leaf.vertices[i + 1] += leafCenterY;
    }
    vertices = [...trunkVerts];
    const leafOffset = trunkVerts.length / 3;
    for (let i = 0; i < leaf.indices.length; i++) {
      leaf.indices[i] += leafOffset;
    }
    indices = [...trunkIdx, ...leaf.indices];
    vertices.push(...leaf.vertices);
    bounds = {
      min: [-leafR, 0, -leafR],
      max: [leafR, trunkH + leafR * 2, leafR],
    };
  } else if (kind === "rock") {
    const radius = Number(params.radius ?? 0.7);
    const ico = createIcoSphereVertices(radius, 0);
    vertices = ico.vertices;
    indices = ico.indices;
    for (let i = 1; i < vertices.length; i += 3) vertices[i] += radius;
    bounds = {
      min: [-radius, 0, -radius],
      max: [radius, radius * 2, radius],
    };
  } else if (kind === "hut") {
    const w = Number(params.width ?? 2.4);
    const d = Number(params.depth ?? 2.2);
    const h = Number(params.height ?? 2.0);
    const roofH = Number(params.roofHeight ?? 1.0);
    vertices = createCubeVertices(w, h, d);
    for (let i = 1; i < vertices.length; i += 3) vertices[i] += h / 2;
    indices = createCubeIndices();
    const roofVerts = createConeVertices(Math.max(w, d) / 2, roofH, 8);
    for (let i = 0; i < roofVerts.length; i += 3) roofVerts[i + 1] += h;
    const roofIdx = createConeIndices(8).map((x) => x + vertices.length / 3);
    vertices.push(...roofVerts);
    indices.push(...roofIdx);
    bounds = {
      min: [-w / 2, 0, -d / 2],
      max: [w / 2, h + roofH, d / 2],
    };
  } else {
    const w = Number(params.width ?? 0.8);
    const h = Number(params.height ?? 0.6);
    const d = Number(params.depth ?? 0.8);
    vertices = createCubeVertices(w, h, d);
    for (let i = 1; i < vertices.length; i += 3) vertices[i] += h / 2;
    indices = createCubeIndices();
    bounds = {
      min: [-w / 2, 0, -d / 2],
      max: [w / 2, h, d / 2],
    };
  }

  const flatVerts = new Float32Array(vertices);
  const useShortIndices = vertices.length / 3 <= 65535;
  const flatIdx = useShortIndices
    ? new Uint16Array(indices)
    : new Uint32Array(indices);
  const vertByteLen = flatVerts.byteLength;
  const idxByteLen = flatIdx.byteLength;
  const vertOffset = 0;
  const idxOffset = vertByteLen + ((4 - (vertByteLen % 4)) % 4);
  const totalBinLen = idxOffset + idxByteLen;
  const binaryData = new Uint8Array(totalBinLen);
  binaryData.set(new Uint8Array(flatVerts.buffer), vertOffset);
  binaryData.set(new Uint8Array(flatIdx.buffer), idxOffset);

  const vertexCount = vertices.length / 3;
  const indexCount = indices.length;

  const gltf = {
    asset: { version: "2.0", generator: "OASIS procedural" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: kind }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
        name: `${kind}Mesh`,
      },
    ],
    materials: [
      {
        name: "Primary",
        pbrMetallicRoughness: {
          baseColorFactor: [pr, pg, pb, 1],
          metallicFactor: 0,
          roughnessFactor: 0.9,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        min: bounds.min,
        max: bounds.max,
      },
      {
        bufferView: 1,
        componentType: useShortIndices ? 5123 : 5125,
        count: indexCount,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteLength: vertByteLen, byteOffset: vertOffset, target: 34962 },
      { buffer: 0, byteLength: idxByteLen, byteOffset: idxOffset, target: 34963 },
    ],
    buffers: [{ byteLength: binaryData.length }],
  };

  return Buffer.from(buildGlb(gltf, binaryData));
}
