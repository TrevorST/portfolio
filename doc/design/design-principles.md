# Portfolio aesthetic: "Signal" (graphic retro futurism for code)

Live style bible: https://claude.ai/artifact/2cvZtiPaDicw1AqPhUH4xM (source: design/style-bible.html)
Owner: "Portfolio look and feel" thread. Sources: Bungie Marathon, typesafe.ai (Jev), War Dogs revive widget.

## Principles
1. One signal: acid green #C6FF1A is the only loud colour. Magenta only for glitch/error, orange only for hazard/warning.
2. Label everything: every section/card gets a `// TAG //` label (two down-triangles at the ends) plus a real data point (build tag, date, commit, stack).
3. Scale is drama: huge ultra-wide headlines + tiny mono captions + calm body. No mid-size headings.
4. Show the machine: page grid lines, registration corners on panels, faint scanlines, Bayer dither, a running Game of Life in the hero.
5. Quiet ground: ~70% void, 15% carbon, 10% bone, 4% signal, <1% flare.
6. Motion is a boot: one load sequence, text decode on headings/labels, ring fills, stepped (not eased) hovers. Honour prefers-reduced-motion.
7. Terse, confident copy with real numbers and units (TypeSafe voice).

## Tokens
--void #07080A; --carbon #111316; --line #262A2F; --dim #7C838B; --bone #E9E7E0; --signal #C6FF1A; --flare #FF2E7E; --hazard #FF6B1A
Fonts (Google): Anybody (display, 900 @ wdth 150; alt 600 @ wdth 50), Martian Mono (labels/data, caps, +0.08em), Geist (body).
Shapes: square corners; buttons use a chamfered top-right corner via clip-path. No rounded cards, no soft shadows, no purple gradients.

## Components (see style bible #kit)
// TAG // label, name plate under label, progress ring (War Dogs), project card (dithered preview + build tag + status + stack chips), chamfered button, hazard stripe, big stat readout, terminal boot log, text-decode heading.
