"""Prints the Color Ramp of a material, sampled for VERTEX_SHADE in prepare-model.mjs.

    blender --background your-file.blend --python scripts/blender-ramp.py -- front-plate

Read-only: it never saves the .blend.
"""
import sys

import bpy

name = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "front-plate"
for node in bpy.data.materials[name].node_tree.nodes:
    if node.type == "VALTORGB":
        ramp = node.color_ramp
        print("RAMP", [round(ramp.evaluate(i / 32)[0], 4) for i in range(33)])
