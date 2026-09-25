# Wick's End

*The lamps went out, and the Hollow woke up.*

A gothic, hand-inked wilderness survival game for the browser, inspired by *Don't Starve*. Gather, craft, cook and survive the dark, the seasons and whatever lives in the woods. There is no tutorial and no quest marker. How long can you last?

**Play:** https://partlywhole.github.io/wicks-end/

## Features
- A procedurally generated island with 6 biomes, roads, hog villages, shagbeast herds, spider dens and graveyards
- A 16-segment day/dusk/night cycle; the dark is lethal without light
- Health, Hunger and Sanity, plus body temperature, wetness and four seasons with weather
- About 40 recipes across three tech tiers, with prototyping at a Tinker's Bench or Alembic Engine
- Cooking on fires, a Cook Pot with ingredient-tag recipes, drying racks, farms and spoilage
- Creatures driven by behavior trees: rabbits, crows, hogfolk (befriend them with meat), shagbeasts, spiders, frogs, hound waves, and shadow creatures when you lose your mind
- Fire that spreads, summer wildfires, lightning, and rain that douses flames
- Autosave at dawn and permadeath
- Every sprite and every sound is procedural: no image or audio assets

## Controls
| Input | Action |
|---|---|
| WASD / arrows | Walk |
| Left click | Walk, gather, attack, or use the held item |
| Right click | Examine, light, or use an inventory item |
| Space (hold) | Gather the nearest thing |
| F (hold) | Attack the nearest enemy (Ctrl+click forces an attack) |
| 1–0 | Use an inventory slot |
| M / Tab | Map |
| Esc | Pause / close |

## Development
```bash
npm install
npm run dev      # local dev server
npm test         # headless simulation tests
npm run build    # static build to dist/
```

The architecture is documented in [docs/DESIGN.md](docs/DESIGN.md) and progress is tracked in [docs/PROGRESS.md](docs/PROGRESS.md). The simulation (`src/sim`) is headless and deterministic and is driven only by commands, so multiplayer can be added later without a rewrite.

Fan project, not affiliated with Klei Entertainment. All names, characters and art are original.
