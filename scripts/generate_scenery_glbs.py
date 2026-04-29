#!/usr/bin/env python3
"""
Generate simple tree GLB models for OASIS scenery library.
Creates glTF2 binary (.glb) files for: birch, maple, oak, pine, willow.
Each tree is a cone (approximated with 8-sided pyramid).
Output: public/models/scenery/tree_*.glb
"""

import json
import struct
import math
from pathlib import Path


def create_cone_gltf(name: str, radius: float = 0.5, height: float = 2.0, segments: int = 8):
    """Create a cone (tree) model in glTF format."""
    # Vertices: apex at top, then base ring
    vertices = [[0, height, 0]]  # apex
    for i in range(segments):
        a = 2 * math.pi * i / segments
        vertices.append([radius * math.cos(a), 0, radius * math.sin(a)])
    # Add center of base for bottom cap
    vertices.append([0, 0, 0])

    # Indices: top triangle fan (apex to base) + bottom cap
    indices = []
    for i in range(segments):
        # Top triangles
        indices.extend([0, 1 + i, 1 + ((i + 1) % segments)])
        # Bottom triangles (for solid cone base)
        indices.extend([1 + i, segments + 1, 1 + ((i + 1) % segments)])

    # Flatten vertices
    flat_verts = []
    for v in vertices:
        flat_verts.extend(v)

    binary_data = bytearray()
    for x in flat_verts:
        binary_data.extend(struct.pack("<f", x))
    for idx in indices:
        binary_data.extend(struct.pack("<I", idx))

    gltf = {
        "asset": {"version": "2.0", "generator": "OASIS scenery"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [
            {
                "primitives": [
                    {"attributes": {"POSITION": 0}, "indices": 1, "material": 0}
                ],
                "name": f"{name}Mesh",
            }
        ],
        "materials": [
            {
                "name": "TreeMaterial",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.18, 0.35, 0.09, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.9,
                },
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": len(vertices),
                "type": "VEC3",
                "min": [-radius, 0, -radius],
                "max": [radius, height, radius],
            },
            {
                "bufferView": 1,
                "componentType": 5125,
                "count": len(indices),
                "type": "SCALAR",
            },
        ],
        "bufferViews": [
            {"buffer": 0, "byteLength": len(flat_verts) * 4, "byteOffset": 0, "target": 34962},
            {"buffer": 0, "byteLength": len(indices) * 4, "byteOffset": len(flat_verts) * 4, "target": 34963},
        ],
        "buffers": [{"byteLength": len(binary_data)}],
    }

    return gltf, bytes(binary_data)


def create_glb(gltf: dict, binary_data: bytes) -> bytes:
    """Create GLB bytes from glTF JSON and binary data."""
    gltf_json = json.dumps(gltf, separators=(",", ":"), sort_keys=True).encode("utf-8")
    json_padding = (4 - (len(gltf_json) % 4)) % 4
    gltf_json += b" " * json_padding

    bin_padding = (4 - (len(binary_data) % 4)) % 4
    binary_padded = binary_data + (b"\x00" * bin_padding)

    total_len = 12 + 8 + len(gltf_json) + 8 + len(binary_padded)

    out = bytearray()
    out.extend(b"glTF")
    out.extend(struct.pack("<I", 2))
    out.extend(struct.pack("<I", total_len))
    out.extend(struct.pack("<I", len(gltf_json)))
    out.extend(b"JSON")
    out.extend(gltf_json)
    out.extend(struct.pack("<I", len(binary_padded)))
    out.extend(b"BIN\x00")
    out.extend(binary_padded)

    return bytes(out)


TREES = [
    ("tree_birch.glb", "Birch", 0.4, 2.2),
    ("tree_maple.glb", "Maple", 0.55, 1.9),
    ("tree_oak.glb", "Oak", 0.6, 1.8),
    ("tree_pine.glb", "Pine", 0.45, 2.5),
    ("tree_willow.glb", "Willow", 0.5, 2.0),
]


def main():
    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / "public" / "models" / "scenery"
    out_dir.mkdir(parents=True, exist_ok=True)

    for filename, name, radius, height in TREES:
        gltf, binary_data = create_cone_gltf(name, radius=radius, height=height)
        glb = create_glb(gltf, binary_data)
        out_path = out_dir / filename
        out_path.write_bytes(glb)
        print(f"  ✓ {filename} ({len(glb) / 1024:.2f} KB)")

    print(f"\n✓ Scenery library created: {out_dir}")


if __name__ == "__main__":
    main()
