"""Writes the vertex shading of the hero model for scripts/prepare-model.mjs.

    blender --background your-file.blend --python scripts/blender-ramp.py

For every material whose Base Color is a Multiply of the texture and a Color
Attribute run through a Color Ramp, it samples the ramp at 33 even steps and
writes src/assets/models/trv01-shading.json. The glTF exporter can't export
those nodes, so prepare-model.mjs bakes them from this file instead.

Read-only: it never saves the .blend.
"""

import json
import sys

import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "src/assets/models/trv01-shading.json"
STEPS = 33


def source(socket):
    return socket.links[0].from_node if socket.links else None


shading = {}
for material in bpy.data.materials:
    if not material.users or not material.node_tree:
        continue
    for node in material.node_tree.nodes:
        if node.type != "BSDF_PRINCIPLED":
            continue
        mix = source(node.inputs["Base Color"])
        if not mix or mix.type != "MIX" or mix.blend_type != "MULTIPLY":
            continue
        for socket in mix.inputs:
            ramp = source(socket)
            if not ramp or ramp.type != "VALTORGB":
                continue
            attribute = source(ramp.inputs["Factor"])
            if not attribute or attribute.type != "VERTEX_COLOR":
                continue
            shading[material.name] = {
                "attribute": attribute.layer_name,
                "ramp": [
                    round(ramp.color_ramp.evaluate(i / (STEPS - 1))[0], 4) for i in range(STEPS)
                ],
            }

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(shading, f, indent=2)
    f.write("\n")
print("SHADING", OUT, list(shading))
