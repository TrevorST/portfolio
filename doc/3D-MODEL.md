# TRV-01: the hero computer

The home page hero is a 3D computer you scroll into. It is Trevor's Blender model, `src/assets/models/trv01.glb`. If that file fails to load, the site falls back to a code-made placeholder.

## Where the files live

| File | What it is |
| --- | --- |
| `src/assets/models/trv01-source.glb` | The Blender export, untouched. Never shipped to visitors. |
| `src/assets/models/trv01.glb` | The optimised model the site loads. Written by `npm run model`; don't edit it by hand. |

The page imports the optimised file (`trv01.glb?url` in `src/pages/index.astro`), so the build copies it to `/_astro/` under a hashed name. Hashed files are cached for a year (`vercel.json`), and a changed model gets a new name, so nobody sees a stale one.

## Updating the model

1. Export from Blender as **glTF Binary (.glb)** and save it over `src/assets/models/trv01-source.glb`.
2. Run `npm run model`. It writes `src/assets/models/trv01.glb`.
3. Open a PR and check the Vercel preview.

`npm run model` (`scripts/prepare-model.mjs`) cleans the export up so Blender can stay loose:

- **Finds the screen by ray-casting** through the bezel at `screen.001`. It then adds a flat `Screen` plane with clean 0–1 UVs exactly over the visible glass (tilt included), and removes the original curved glass so it can't cover the terminal.
- **Keeps your materials and the texture sheet.** Three adjustments:
  - LEDs keep their emissive colour and go dark until power-on.
  - **Vertex shading is baked in** (`VERTEX_SHADE`). `front-plate` multiplies the sheet by its `Color` attribute through a Color Ramp. The exporter writes the raw attribute but not the ramp or the multiply, so the script applies the ramp and stores the result as the model's vertex colour, which three.js multiplies with the texture. It costs no extra texture. If you change the ramp, run `blender --background your.blend --python scripts/blender-ramp.py -- front-plate` and paste the numbers into `VERTEX_SHADE`.
  - Cords (`CORD*`) get a plain dark rubber material (`CORD`) until they are unwrapped onto the sheet.
- **Orients and scales it:** front to +Z, the body scaled to 462 mm tall, its front-left-bottom corner at the origin. Cords don't count toward the size or the camera framing; they sit in a separate `Loose` group next to `Body`.
- **Shrinks it:**
  - Vertex colours are dropped, and UVs are dropped from parts with no texture.
  - Meshes that share a material are joined, so the GPU draws about 10 objects, not 25.
  - The texture is re-encoded as lossless WebP, capped at 1024 px.
  - Geometry is Draco-compressed.
  - Current result: 251 KB → 42 KB, one file, one request.

The site measures the `Screen` mesh at runtime (`src/hero/screen-spec.ts`): its centre, facing direction, width and height. The camera zoom and the invisible typing overlay follow whatever screen the model has, so nothing needs re-tuning when the model changes.

## Texturing rules that keep it fast

- **One sheet for everything.** Every textured material should point at the same image (`terminal-sheet.png`). One image means one download and one GPU upload.
- **Keep node setups simple.** The glTF exporter follows Image Texture → Base Color, and Image Texture × something → Base Color (it keeps the image, drops the rest). Color Ramps and Mix factors are not exported. Vertex shading works through `VERTEX_SHADE` above; keep the Multiply node's Factor at 1, because a glTF vertex colour can only multiply.
- **Flat-coloured parts** can map all their UVs onto a colour swatch on the sheet, or just use a plain material colour. Both are cheap.
- **Keep the sheet at 1024 px** unless text on it looks soft up close.

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

## Export checklist (Blender → glTF), without `npm run model`

`npm run model` handles all of this for you. Follow the checklist only if you export a finished file by hand.

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
7. Save as `src/assets/models/trv01.glb`, open a PR, and check the Vercel preview. The terminal overlay should sit exactly on your screen.

If the file fails to load, or has no `Screen` mesh, the site logs a warning and falls back to the placeholder. The page never breaks.

## How the hero works

- **Before any interaction:** the page is static HTML with the intro text. three.js (about 150 KB gzipped) loads only on the first scroll, touch, mouse move or key press, so it never costs first paint or the Lighthouse budget.
- **Scroll phases** of the pinned section (`PHASE` in `src/hero/scene.ts`):
  - **0–0.30:** the camera pushes in to the screen.
  - **0.30–0.72:** hold. The screen powers on once, boots, and takes typing. On desktop, keystrokes go straight to it. On phones, tapping the screen opens the keyboard.
  - **0.72–1:** the camera pulls back and the page continues.
- **Input:** a real, invisible `<input>` sits exactly over the projected screen, so typing, the phone keyboard and paste all work natively. A screen-reader log mirrors the output.
- **Fallback:** reduced motion, Save-Data, no WebGL, low-memory devices or `?flat` get the flat terminal instead, driven by the same engine.
