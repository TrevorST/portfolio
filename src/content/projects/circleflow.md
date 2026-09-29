---
title: CircleFlow
summary: A keyboard-driven logo tool. Place circles, join them with belts, and the outline falls out of the geometry. Exports clean SVG.
build: 0.1.0
status: active
year: 2026
stack: [React, TypeScript, Zustand, Vite, Vitest, SVG]
cover: ../../assets/projects/circleflow.webp
coverAlt: The CircleFlow editor. A shapes panel on the left, a red corner mark on a dotted canvas, and a command toolbar on the right.
featured: true
order: 1
---

CircleFlow draws marks out of **circles joined by belts**. Each joined pair is filled as its convex hull: two tangent lines with the perimeter between them. A handful of placed circles becomes one solid mark whose stroke width changes smoothly with the radii.

The premise: **radius is the expressive dimension.** There is no pen and no bezier handle. You position mass, and the outline follows from the geometry.

## How it works

- Modal `G` / `R` / `S` transforms borrowed from Blender and Plasticity. Press a key and the geometry follows the pointer until you commit or cancel.
- A circle can carry any number of belts, so a `K` is one object: a stem and two arms meeting at a junction.
- Split inserts a circle into a belt without moving the silhouette. Dissolve removes one and heals the run.
- Deflectors bend a band inward. Cutters subtract their silhouette from every shape below them.
- The canvas and the SVG export come from the same geometry module, so what you see is exactly what you export.

## Engineering

Geometry and the document model are pure TypeScript with no React, no DOM and no store, and their claims are checked numerically in Vitest. Saved documents are versioned, and older ones are converted on load.

A live demo lands here in v0.3.
