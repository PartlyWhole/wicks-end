# SVG Art Workflow: render → look → critique → revise

A multi-agent pipeline that produces hand-inked SVG art and animations for Wick's End. It judges the work by **looking at rendered images**, never by trusting the source code.

## The loop
```
             ┌──────────────── tight inner loop (inside one agent) ───────────────┐
 brief ──▶ AUTHOR: write SVG ──▶ render.mjs ──▶ Read contact sheet ──▶ fix worst issue ─┘ (≤4 renders)
                │
                ▼                         outer gate (fresh eyes every round)
          CRITIC (independent) ──▶ scores 6 rubric lines + ≤5 concrete visual fixes
                │  pass? (avg ≥ 8, every line ≥ 7)
                ├── yes ─▶ done
                └── no ──▶ REVISER applies fixes (renders & looks again) ──▶ next CRITIC (≤3 rounds)
                                     │
 all assets ──▶ ART DIRECTOR compares every sheet side by side (scale, palette, line weight, tempo)
                                     │
                     flagged assets ──▶ REVISER ──▶ CRITIC (1 round) ──▶ gallery.mjs ──▶ art/gallery.html
```
Why it works:
- **Authors self-check visually.** Most problems (a floating foot, a muddy silhouette) are fixed within seconds, before any critic sees them.
- **Critics are always fresh agents** that re-render the current file themselves. They can't grade stale images, and they don't share the author's blind spots.
- **Calibrated scoring.** A first draft is about 5–6 and an 8 is portfolio-quality. Passing needs *every* dimension to be acceptable, so strong art can't hide a broken loop seam.
- **Consistency check.** A separate art director reviews the whole set together, since single-asset critics can't see drift between assets.

## Tools
| Tool | What it does |
|---|---|
| `node art/tools/render.mjs art/assets/<id>.svg [--frames 8] [--duration S]` | Renders a contact sheet `art/renders/<id>.sheet.png` (8 frames, onion skin, greyscale and solid silhouette, game-scale day and night, large hero view), a 24 fps preview GIF, and a JSON report with lint warnings and console errors. Uses headless Chrome; each frame is an independent timeline paused at an exact time (works with SMIL and CSS animation). |
| `node art/tools/gallery.mjs` | Builds `art/gallery.html` with every asset animating live on day and night ground, plus `art/renders/gallery.png`. |
| `art/STYLE.md` | Style guide and rubric shared by every agent: canvas, line, palette, shape language, animation principles, scoring. |

## Running it
The workflow is saved at `/Users/alan/DontStarveClone/.claude/workflows/svg-art.js` and run by name (`svg-art`) with arguments:
```json
{
  "assets": [
    { "id": "campfire", "brief": "Log campfire; 3-layer flicker with overlapping cycles, rising embers, warm glow. Loop 1.2 s." },
    { "id": "silas-idle", "brief": "Silas the lamplighter, idle: breathing, blinking, scarf trailing a beat behind. Loop 2.4 s." },
    { "id": "hog-walk", "brief": "Hogfolk walk cycle: belly bounce, squash on contact, ears lag. Loop 0.8 s." }
  ],
  "maxRounds": 3, "passAvg": 8, "passMin": 7, "harmonize": true
}
```
**Cost:** per asset, 1 author, up to 3 critics and up to 2 revisers. Add 1 director, up to 2 agents per flagged asset, and 1 gallery agent. Three assets come to about 20–25 agents; a single asset with `harmonize: false` is 3–6 agents.

## Using the art in the game
The game currently draws procedurally on Canvas 2D. To use the SVGs:
- **Static sprites:** rasterize each SVG once at load (`new Image()` with a data URL, drawn into an offscreen canvas at 40 px per world unit). The renderer then blits the cached canvas exactly as it does today.
- **Animated sprites:** pre-bake N frames per loop with the same pause-at-time technique `render.mjs` uses, into a sprite sheet, and pick a frame by the entity's state time.
