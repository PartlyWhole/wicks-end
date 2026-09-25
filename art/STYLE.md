# Wick's End — SVG Art Style Guide

The art should read as a **hand-inked gothic storybook**: pen-and-ink outlines over a muted, paper-toned palette, whimsical but uneasy. Think woodcut-meets-puppet-show, not flat vector clip-art.

## 1. Canvas & format
- One asset per file: `art/assets/<id>.svg`. The root is `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" data-duration="<loop seconds>">`.
- The **feet or ground contact sit at y ≈ 232**, horizontally centered at x = 128. The subject fills about 60–85% of the box, with room for motion (arms swing, flames lick).
- The file is fully self-contained: no `<script>`, no `<image>`, no external fonts or URLs. Aim for under 25 KB.
- Group by part (`<g id="body">`, `<g id="head">`, `<g id="arm-r">`) so parts can be animated and reused.
- The subject faces **right** by default; the game mirrors it.

## 2. Line
- Outlines are **ink `#1a1410`**. Stroke 4–6 px on silhouettes, 2–3 px on interior detail. Use `stroke-linejoin="round"` and `stroke-linecap="round"`.
- Lines are **hand-drawn, never geometric**. Build shapes from paths with slight irregularity (bulges, tapers, uneven curves). Avoid perfect circles or rectangles for organic things. Wobble comes from path points, not filters.
- Allow a few **overshoots**: a stray line past a corner, a hatch that escapes.
- Shading is **hatching**: groups of 3–7 short, slightly curved parallel strokes (1.5–2.5 px, ink at 40–70% opacity) on the shadow side. Light comes from the **upper left**, so shadows fall lower right.

## 3. Palette (muted, earthy; one accent at most)
| Role | Colors |
|---|---|
| Ink | `#1a1410` |
| Paper / highlights | `#e9dfc7`, `#f4efe4` |
| Wood / earth | `#5a3d27`, `#7d5634`, `#9a6b3c`, `#c9a26a` |
| Foliage | `#2f4a2c`, `#3e5a34`, `#6a8a3a`, `#8f9a4f` |
| Stone | `#6b6a66`, `#8a8780`, `#a19d94` |
| Cloth (Silas) | coat `#3b3548`, scarf `#c0563a`, skin `#ecdcc4` |
| Fire | `#c2381e` → `#f07a26` → `#ffd25a` (core) |
| Night & shadow magic | `#05070d`, `#2a1e3a`, `#a58cff` |
| Frost | `#dfe6ea`, `#a9c6d6` |

Fills are flat, plus at most one soft gradient per asset (fire glow, a pool of light). Never use neon or pure saturated primaries.

## 4. Shape language
- **Friendly or neutral**: round bellies, stubby limbs, tilted heads.
- **Dangerous**: spikes, thin long limbs, too many eyes, asymmetric jaws.
- **Shadow creatures**: pure black ink with white or violet eyes, shapes that don't quite resolve.
- Exaggerate proportions. Heads are large, and hands and feet are small or tapered.
- Every subject must read as a **distinct silhouette** in solid black at 40 px tall.

## 5. Animation
- Animate with **SMIL** (`<animate>`, `<animateTransform>` with `repeatCount="indefinite"`) or **CSS keyframes** inside `<style>`. It must loop seamlessly: the value at t = 0 equals the value at t = duration.
- Use real animation principles:
  - **Anticipation**: a wind-up before a swing.
  - **Squash and stretch**: on bounces and landings.
  - **Follow-through and overlap**: the scarf, hair and ears lag behind the body.
  - **Easing**: `calcMode="spline"` with keySplines, or CSS cubic-beziers. No constant-speed linear motion except for spinning.
  - **Arcs**: limbs rotate about joints (`transform-origin` or rotate pivots), so motion traces curves.
- An idle breath of about 2–3% scale on a ~2 s loop keeps characters alive. Fire flickers with 2–3 overlapping cycles of different lengths, so the loop doesn't feel mechanical. Keep the overall loop 0.8–3 s.
- Timing guide: walk cycle ~0.8 s, chop swing ~0.6 s, flame flicker 0.6–1.2 s, idle 2–3 s.

## 6. Review rubric (a critic scores each dimension 0–10)
1. **Silhouette**: readable and distinctive in solid black and greyscale, and at game scale (40–64 px).
2. **Style fidelity**: ink outlines, hand-drawn wobble, hatching, palette, light from the upper left.
3. **Craft**: clean path joins, consistent line weights, no stray artifacts, no accidental gaps or overlaps.
4. **Appeal & character**: charm, personality, gothic-whimsy tone.
5. **Animation** (skip for static assets): seamless loop, easing, arcs visible in the onion skin, secondary motion, no popping.
6. **Technical**: self-contained, a viewBox, feet at y ≈ 232, reasonable size, grouped parts.

An asset **passes** when every dimension is 7 or higher and the average is 8 or higher.
