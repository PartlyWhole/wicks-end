# Wick's End — Art Style Guide: **Magic-Lantern Gothic**

> *The Hollow is a shadow play, and Silas carries the only projector.* Wherever his lamp shines, the world is projected into colour: hand-tinted, warm, a little theatrical. Beyond it, everything is a black paper cut-out against indigo. The Hush is never drawn; it is the projection failing.

Influences: Lotte Reiniger silhouette animation, magic-lantern and phantasmagoria shows, candlelit painting (Georges de La Tour, Joseph Wright of Derby), and Gorey's deadpan in *posture only*. Background: `knowledge-base/09-art-direction-and-animation.md`.

## 1. Canvas & format
- One asset per file: `art/assets/<id>.svg`. The root is `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" data-duration="<loop seconds>">`.
- The **ground contact sits at y ≈ 232**, centered at x = 128. The subject fills 60–85% of the box and faces **right**.
- Fully self-contained: no `<script>`, `<image>`, external fonts or URLs. Aim for under 25 KB. Use no blur or turbulence filters on sprites; soft edges belong only to light, fog and phantasms.
- **No background.** Sprites are transparent; the harness supplies grounds.

### 1.1 World scale (one world, one ruler)
Every sprite lives in the same human-scale world, so "fill 60–85% of the box" is about composition, not size. The ruler is **Silas: 190 px tall in a standard 256 box** (world scale 1). Target heights relative to Silas:

| Subject | × Silas | Notes |
|---|---|---|
| Trees (pine, dead oak) | 1.8–2.2 | a grown tree must tower over a man |
| Silas, humans | 1.0 | 190 px in the box |
| Shadow creatures | 0.9–1.4 | wrong, but not giants |
| Hogfolk | 0.6–0.7 | round, waist-to-chest high |
| Campfire | 0.35 | ~70 px |

An asset that is bigger than a person in the world may still draw to fill its own box, and declares how big that box is on the root: `data-world-scale="k"` means the 256 box spans **k × the standard box** in world units (the engine and the harness multiply its on-screen size by k, anchored on the y = 232 contact). Choose k = target height ÷ drawn height in the box (e.g. a 229 px pine at 2.1× Silas → k = 399 / 229 ≈ 1.75). Assets without the attribute are k = 1 and must be drawn at their world height. The harness's game-scale cells apply k and stand Silas beside non-Silas sprites for reference.

## 2. The two-layer sprite (the core rule)
Every sprite has exactly two top-level layers, **in this order**:

```xml
<g id="silhouette"> … solid ink #0b0907 shapes, with filigree holes cut out … </g>
<g id="colour"> … flat tint planes laid over the silhouette … </g>
```
- **`#silhouette`** carries the whole shape and must read on its own. It's what you see at night outside the lamp. Detail comes from **cut-out filigree**: holes for eyes, buttons, leaf veins, knots, window panes. Use `fill-rule="evenodd"` or separate hole paths filled with the background. Interior lines are **not allowed**.
- **`#colour`** holds 1–4 flat tint planes that sit *inside* the silhouette. It's what the lamp "projects". It's shown only where light falls; the game fades it by light level.
- **The silhouette dominates.** Colour planes cover roughly **35–65%** of the silhouette's area and leave generous areas of pure ink: shadow sides, limbs, hair, boots, the undersides of foliage. The colour is a *projected tint* on the puppet, not a fill with an outline. If the lit sprite reads like a coloured cartoon with a black outline, it's wrong.
- **Visual target:** `art/studies/a-magic-lantern.svg` (the approved direction study). Render it with the harness and match its balance: black cut-paper shapes, sparse tint, amber lamp as the hero.
- **Warm rim:** include the 1.5–2 px amber `#f2a94a` rim on the lamp-facing (right or upper-right) edge in the `#colour` layer, so it too appears only in light.
- Fire and lamp flames are **light**, not puppets. Put them in `#colour` as well, plus a small ink wick or holder in `#silhouette`.

## 3. Palette
| Role | Hex |
|---|---|
| Silhouette ink (the only colour in `#silhouette`) | `#0b0907` |
| Umber / wood / bark | `#2a1a10`, `#5a3a24`, `#8a5a36` |
| Rose ground glow | `#b4574a` |
| Night indigo | `#2a2340` |
| Day paper / highlight | `#e9dfc6`, `#fff0c8` |
| Moss / foliage tints | `#4c5a3a`, `#7a7d55` |
| Slate / stone | `#5b6f7a`, `#8a8a80` |
| Lamp amber (reserved for fire, lamps, Silas's eye-glint and rims) | `#f2a94a`, core `#fff0c8`, deep `#c2381e` |
| Silas | coat `#3b3548`, scarf `#b4574a`, face `#e9dfc6` |
| Hush / shadow magic (Prussian blue, violet eyes) | `#1f3a5f`, `#e8f0ff` |
| Phantasm (hallucinations only) | `#c0392b`, `#2e86ab`, `#f1c40f` |

The colour planes are **muted and hand-tinted** (think watercolour washes on a chapbook), except amber, the single warm accent.

## 4. Shape language
- **Paper puppets:** rigid parts with crisp, slightly irregular cut edges, as if cut with scissors. Avoid perfect circles or rectangles for organic things. Joints are visible (round pivots, overlapping parts).
- **Filigree gives character:** Reiniger-like lace holes, scalloped edges, curled tips. Use 2–6 cut-outs per sprite, never noise.
- **Posture:** Silas is tall, stiff, upright and dignified, with a slightly oversized head, a lamplighter's cap and a long coat. Hogfolk are round and jolly. Threats are thin, spiky, too many limbs, asymmetric.
- **Shadow creatures are wrong puppets:** their silhouettes don't quite resolve (ragged edges, too many joints). Thin **control rods** rise from them. Their only colour is `#e8f0ff` eyes.
- **Solid-silhouette test:** every sprite must be identifiable as a solid black shape at 48 px tall.

## 5. Animation: two clocks
- **Puppet parts step at 12 fps** (animation "on 2s"). Use `calcMode="discrete"` in SMIL or `steps()` in CSS, with keyframe times on multiples of 1/12 s. This is the paper-theatre signature.
- **Light, flame, smoke and glow are smooth:** `calcMode="spline"`, with 2–3 overlapping cycles of *co-prime* durations (e.g. 0.7 / 1.1 / 1.3 s) so they never visibly repeat.
- **Shadow creatures are the exception:** they move **smoothly** (a glide), with at most one sudden snap per loop. Smooth motion signals "wrong".
- Rig with nested `<g>` joints rotating about pivots (`transform="rotate(a cx cy)"` via `animateTransform`). Motion follows arcs.
- Use real animation principles: anticipation before swings, follow-through (scarf and coat tails lag one drawing, lantern swings like a pendulum), squash on contacts, and holds on key poses (at least 2 drawings).
- **Loops are seamless:** the last value equals the first; every cycle length divides `data-duration`.

| Action | Loop | Structure |
|---|---|---|
| Idle (breath) | 2.4 s | 1–2% vertical rise, lantern sway phase-offset, blink once |
| Walk | 1.0 s (2 steps) | contact, down, pass, up; head bob; lantern pendulum lags |
| Work / chop | 1.0 s | wind-up hold (≈0.33 s), strike in 2 drawings, recovery; lantern set down or at hip |
| Creature walk | 0.8–1.2 s | gait expresses personality (hog: bouncy trot with belly squash) |
| Flicker | 1.1–2.2 s | smooth, layered, with small "gutters" (brief dips) |
| Shadow glide | 2–3 s | smooth drift, a tendril curl, one snap |

## 6. Review rubric (a critic scores each dimension 0–10)
1. **Silhouette:** in solid black it's readable, distinctive and appealing at 48–64 px. Filigree holes read and aren't noise.
2. **Style fidelity:** a true two-layer sprite (a solid ink silhouette plus inset flat colour planes); paper-puppet cut edges; the palette; one amber accent; no outlines, hatching or soft edges on puppets.
3. **Craft:** clean cut edges, consistent inset of the colour planes, joints that stay attached across frames, no stray artifacts.
4. **Appeal and character:** charm, personality, gothic-whimsy tone (dignified, slightly absurd, uneasy).
5. **Animation:** stepped puppet motion on 12 fps (smooth only for light and shadow things), seamless loop, anticipation and follow-through, clear arcs in the onion skin. Use 10 for a static asset.
6. **Technical:** the required `#silhouette` / `#colour` structure, a viewBox, ground at y ≈ 232, self-contained, under 25 KB, grouped parts.

An asset **passes** when every dimension is 7 or higher and the average is 8 or higher.
