# TRV-01: the hero computer

The home page hero is a 3D computer you scroll into. It uses Trevor's Blender model when `public/models/trv01.glb` exists, and falls back to a code-made placeholder otherwise.

## Updating the model

1. Export from Blender as **glTF Binary (.glb)** and save it over `models-src/trv01-source.glb`.
2. Run `npm run model`. It writes `public/models/trv01.glb`, which is what the site loads.
3. Open a PR and check the Vercel preview.

`npm run model` (`scripts/prepare-model.mjs`) cleans the export up so Blender can stay loose:

- **Keeps one computer.** The `KEEP` list names its objects. The current export also holds two earlier iterations, which are dropped. Exporting with "Selected Objects" avoids this.
- **Finds the screen by ray-casting** through the bezel at `screen.001`. It then adds a flat `Screen` plane with clean 0–1 UVs exactly over the visible glass (tilt included), and removes the original curved glass so it can't cover the terminal.
- **Applies the Signal palette** by part (`PART`). LEDs keep their emissive colour and go dark until power-on.
- **Orients and scales it:** front to +Z, height to 462 mm, front-left-bottom corner at the origin.
- **Draco-compresses it:** 685 KB → about 25 KB.

The site measures the `Screen` mesh at runtime (`src/hero/screen-spec.ts`): its centre, facing direction, width and height. The camera zoom and the invisible typing overlay follow whatever screen the model has, so nothing needs re-tuning when the model changes.

## Reference: TRV-01 orthographic sheet

| | |
| --- | --- |
| Overall | 480 W × 520 D × 462 H mm |
| Origin | Front-left-bottom corner of the unit at (0, 0, 0) |
| Axes (Blender) | X = width, Y = depth from the front, Z = up |
| Screen | Flat, vertical (not sloped), 16:10, **336 × 210 mm** |
| Screen centre | X 208, Y 220 (depth), Z 281 mm |
| Keyboard deck | Sloped 17.7° |
| Chamfers | 40 × 40 mm on the top-right and top-rear edges |
| Screen texture | 16:10 (reference 1680 × 1050; the site renders 1280 × 800) |

## Export checklist (Blender → glTF)

1. **Units:** model in millimetres (1 unit = 1 mm). On export, scale by **0.001** so the file is in metres.
2. **Axes:** keep Blender's defaults. The glTF exporter's **+Y Up** converts Z-up to three.js Y-up, and the front of the unit faces +Z in three.js. Don't move the origin: front-left-bottom stays at (0, 0, 0).
3. **Screen:** a separate object and a separate material, named exactly **`Screen`**.
   - UVs cover the visible screen 0→1, with (0, 0) at bottom-left, unrotated.
   - The site replaces its material with the CRT shader and renders the terminal into it, so its own material doesn't matter.
4. **Glow:** anything that should light up at power-on (power LED, accent keys) gets an emissive material with emission strength above 0. The site brightens those automatically.
5. **Format:** File → Export → glTF 2.0, **glTF Binary (.glb)**.
   - Enable **Compression (Draco)**. The site bundles the Draco decoder.
   - Apply modifiers. Don't include cameras or lights.
6. **Size:** aim for **under 300 KB**. Bake detail into textures rather than geometry. Keep textures at 1024 px or smaller, and prefer WebP or KTX2 if your exporter supports them.
7. Save as `public/models/trv01.glb`, open a PR, and check the Vercel preview. The terminal overlay should sit exactly on your screen.

If the file fails to load, or has no `Screen` mesh, the site logs a warning and falls back to the placeholder. The page never breaks.

## How the hero works

- **Before any interaction:** the page is static HTML with the intro text. three.js (about 150 KB gzipped) loads only on the first scroll, touch, mouse move or key press, so it never costs first paint or the Lighthouse budget.
- **Scroll phases** of the pinned section (`PHASE` in `src/hero/scene.ts`):
  - **0–0.30:** the camera pushes in to the screen.
  - **0.30–0.72:** hold. The screen powers on once, boots, and takes typing. On desktop, keystrokes go straight to it. On phones, tapping the screen opens the keyboard.
  - **0.72–1:** the camera pulls back and the page continues.
- **Input:** a real, invisible `<input>` sits exactly over the projected screen, so typing, the phone keyboard and paste all work natively. A screen-reader log mirrors the output.
- **Fallback:** reduced motion, Save-Data, no WebGL, low-memory devices or `?flat` get the flat terminal instead, driven by the same engine.
