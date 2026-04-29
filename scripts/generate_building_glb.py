#!/usr/bin/env python3
"""
Generate a simple 3D Building GLB Model.

Creates a glTF2 binary (.glb) containing a single "building" box mesh.
Output defaults to: public/models/generated/building.glb
"""

import json
import struct
from pathlib import Path


def create_building_gltf():
    """Create a building model in glTF format (box mesh)."""

    # Building dimensions
    building_width = 4.0
    building_depth = 3.0
    story_height = 2.0
    total_height = story_height * 3

    # Vertices for the main building box
    vertices = [
        # Front face (z = depth/2)
        [-building_width / 2, 0, building_depth / 2],
        [building_width / 2, 0, building_depth / 2],
        [building_width / 2, total_height, building_depth / 2],
        [-building_width / 2, total_height, building_depth / 2],
        # Back face (z = -depth/2)
        [-building_width / 2, 0, -building_depth / 2],
        [building_width / 2, 0, -building_depth / 2],
        [building_width / 2, total_height, -building_depth / 2],
        [-building_width / 2, total_height, -building_depth / 2],
    ]

    # Indices for the building box (12 triangles)
    indices = [
        # Front
        0, 1, 2, 0, 2, 3,
        # Back
        5, 4, 7, 5, 7, 6,
        # Left
        4, 0, 3, 4, 3, 7,
        # Right
        1, 5, 6, 1, 6, 2,
        # Top
        3, 2, 6, 3, 6, 7,
        # Bottom
        4, 5, 1, 4, 1, 0,
    ]

    # Create binary data
    binary_data = bytearray()
    for vertex in vertices:
        for coord in vertex:
            binary_data.extend(struct.pack("<f", coord))
    for idx in indices:
        binary_data.extend(struct.pack("<I", idx))

    # glTF JSON
    gltf = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Building"}],
        "meshes": [
            {
                "primitives": [
                    {"attributes": {"POSITION": 0}, "indices": 1, "material": 0}
                ],
                "name": "BuildingMesh",
            }
        ],
        "materials": [
            {
                "name": "BrickMaterial",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.77, 0.12, 0.23, 1.0],
                    "metallicFactor": 0.1,
                    "roughnessFactor": 0.7,
                },
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": len(vertices),
                "type": "VEC3",
                "min": [-building_width / 2, 0, -building_depth / 2],
                "max": [building_width / 2, total_height, building_depth / 2],
            },
            {
                "bufferView": 1,
                "componentType": 5125,  # UNSIGNED_INT
                "count": len(indices),
                "type": "SCALAR",
            },
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteLength": len(vertices) * 12,
                "byteOffset": 0,
                "target": 34962,  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteLength": len(indices) * 4,
                "byteOffset": len(vertices) * 12,
                "target": 34963,  # ELEMENT_ARRAY_BUFFER
            },
        ],
        "buffers": [{"byteLength": len(binary_data)}],
    }

    return gltf, bytes(binary_data)


def create_glb(gltf: dict, binary_data: bytes) -> bytes:
    """Create GLB bytes from glTF JSON and binary data."""

    gltf_json = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
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


def main():
    gltf, binary_data = create_building_gltf()
    glb = create_glb(gltf, binary_data)

    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / "public" / "models" / "generated"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "building.glb"
    out_path.write_bytes(glb)

    print("✓ Building model created:", out_path)
    print("  File size:", f"{len(glb) / 1024:.2f} KB")


if __name__ == "__main__":
    main()





