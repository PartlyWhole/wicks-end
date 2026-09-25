# Wick's End — Progress Tracker

Legend: ☐ todo · ◐ in progress · ☑ done · ✗ cut/deferred
Each phase ends with a **verification gate**: tests green plus a manual or browser check noted in the log.

## Phase 0 — Plan & scaffold
- ☑ Design & architecture doc (`docs/DESIGN.md`)
- ☑ Vite + TS + Vitest scaffold, strict tsconfig
- ☑ GitHub repo `wicks-end` + Pages deploy workflow
- **Gate:** blank page deploys to `https://partlywhole.github.io/wicks-end/`

## Phase 1 — Engine core
- ☑ ECS world, component index, spatial hash
- ☑ Event bus, seeded RNG, noise
- ☑ Scheduler (min-heap)
- ☑ Behavior-tree library
- ☑ Fixed-step loop, render interpolation
- **Gate:** unit tests for ECS/spatial/scheduler/BT/RNG

## Phase 2 — World generation & ground
- ☑ Biome map (Voronoi regions + noise, island mask, spawn in Meadow)
- ☑ Content placement per biome (density tables, set pieces: hog village, spider nests, shagbeast herd)
- ☑ Ground chunk renderer with organic borders + detail + ocean
- ☑ Camera, zoom, culling
- **Gate:** worldgen test (connectivity, biome counts, spawn safety); visual review

## Phase 3 — Player & gathering
- ☑ Player prefab, locomotion, WASD + click-to-move, collision with obstacles
- ☑ Player sprite with procedural animation
- ☑ Inventory (15 slots, stacks, 3 equip slots), pickup, drop
- ☑ Actions: pick, chop, mine, dig, hammer, examine; tool requirements
- ☑ Procedural sprites for flora & minerals
- **Gate:** can gather all basic resources in browser

## Phase 4 — Crafting & UI
- ☑ HUD: stat badges, clock, season, inventory bar, equip slots, tooltips
- ☑ Crafting menu (tabs, recipes, have/need, tech tiers, prototyping)
- ☑ Structure placement (ghost preview, validity)
- ☑ Tools durability; equip effects
- **Gate:** craft axe → pickaxe → Tinker's Bench → prototype a recipe

## Phase 5 — Time, light & fire
- ☑ Clock: 16 segments, seasonal day/dusk/night splits
- ☑ Lighting layer, dusk and night grading
- ☑ Campfire / fire pit / torch fuel, adding fuel, burnout
- ☑ The Hush (darkness damage) with warning
- ☑ Burnable + fire spread, ash, charcoal
- **Gate:** survive night 1 with a campfire; die in darkness without one

## Phase 6 — Stats, food & cooking
- ☑ Hunger/health/sanity drain & thresholds, starving
- ☑ Eating, food values, cooking on fire
- ☑ Spoilage (fresh/stale/spoiled → rot), containers
- ☑ Cook Pot with ingredient-tag matching
- ☑ Drying rack, Ice Box
- **Gate:** cookpot tests; spoilage tests

## Phase 7 — Mobs & combat
- ☑ Combat component, weapons, armor, hit feedback, death & loot
- ☑ Rabbits + holes, birds, frogs
- ☑ Shagbeast herds (neutral, shave for wool, manure)
- ☑ Hogfolk + houses (follow when fed meat, fight hostiles, flee at night)
- ☑ Spiders + dens (tiers, night hunting, warrior spiders)
- ☑ Hound waves with warning growls
- **Gate:** combat tests; browser playtest of fights

## Phase 8 — Seasons, temperature & weather
- ☑ Season clock & ambient temperature curve
- ☑ Body temperature, freezing/overheating, insulation, heat sources, thermal stone
- ☑ Rain/snow weather model, wetness, fire dampening
- ☑ Summer wildfires (smolder)
- ☑ Season visuals (snow ground tint, rain, heat shimmer)
- **Gate:** temperature tests; visual review of each season

## Phase 9 — Sanity & insanity
- ☑ Sanity sources (night, darkness, auras, flowers, food, prototyping)
- ☑ Insanity visuals (filters, vignette, phantoms)
- ☑ Shadow creatures (Crawling Dread) when insane; they drop nightmare fuel
- **Gate:** browser check at low sanity

## Phase 10 — Regrowth & world life
- ☑ Tree growth stages, pinecone planting, saplings/grass/berry regrowth
- ☑ Spawner regen (rabbits, hogs, spiders)
- ☑ Entity sleep radius optimization
- **Gate:** 20-day headless sim stable, entity counts bounded

## Phase 11 — Meta: saves, menus, map, audio
- ☑ Save/load + autosave at dawn; permadeath
- ☑ Title screen, pause, settings, death screen
- ☑ World map with fog of war
- ☑ Procedural audio: sfx + ambience + threat cues
- ☑ Examine strings & character speech
- **Gate:** save/load roundtrip test; full browser flow

## Phase 11b — Additions from design review
- ☑ Frostmaw: mid-winter giant with roar/quake warnings, AoE slam, smashes structures, drops Frost Heart (summer coolant)
- ☑ Journal (J): discover-then-reveal stat sheets, persists across lives
- ☑ Painted roads (polyline strokes over biome ground)
- ☑ Obstacle steering (mobs and player slide around trees)
- ☑ Idle-time chunk prefetch (no hitches when walking)

## Phase 12 — Review & polish
- ☑ Graphics review: all structures/creatures reviewed in-browser; shadow creatures redrawn (were hound-like), roads repainted, burning trees char, summer pollen, title backdrop
- ☑ Gameplay review against design pillars (KB 08 checklist): added Frostmaw + Journal; summer made dangerous; fire spread widened
- ☑ UI/UX review: craft-tab glow for new recipes, responsive inventory, HUD hidden on title, stale-tooltip fixes, touch notice
- ☑ Balance pass: DS-derived numbers (KB 01/04/05); Hush 100 dmg, hounds day 6–8, winter −6°/−18°, summer peak 78°
- ☑ Performance: 60 fps, sim ≈0.05 ms/tick, chunk builds ≈25 ms moved to idle prefetch, 70 KB gz bundle
- ☑ Independent code review (subagent): 8 bugs found and fixed with regression tests (34 tests total)
- ☑ Final deploy + smoke test on github.io

## Deferred / next ideas
- Multiplayer (host-authoritative over WebRTC; sim is already command-driven and headless)
- Caves & ruins, boats, more seasonal giants (spring/summer/autumn)
- Additional playable characters with asymmetric perks
- Hogfolk that help chop; bee boxes & honey (taffy); bird cage & eggs
- Save compression (currently ~0.7 MB JSON in localStorage)
- Gamepad support

---

## Log
| Date | Entry |
|---|---|
| 2026-09-24 | Design doc written. Name chosen: **Wick's End** (repo `wicks-end`). |
| 2026-09-24 | Engine + full sim written (ECS, BT, scheduler, worldgen, actions, 9 systems, 8 brains, save/load). 22 headless tests green (incl. 10-day soak). |
| 2026-09-24 | Phase 0 gate: deployed to https://partlywhole.github.io/wicks-end/ (Actions: tests → build → Pages). |
| 2026-09-24 | Browser playtest round 1: fixed dark dawn (Hush at spawn!), stuck mobs (steering), stale UI refresh timer, blocky roads, hound-like shadow art, cookpot always glowing, summer too mild. |
| 2026-09-24 | Code review subagent: fixed stale-action crash, item loss into destroyed containers, backpack-as-fuel deletion, dryer/cookpot exploits, backpack spoilage freeze, sleeping in darkness, spawner drift. |
| 2026-09-24 | Responsive inventory, title backdrop, work/danger music, fire charring. Final deploy. |
| 2026-09-24 | Design review vs KB 08 principles: added seasonal giant (late-game pressure, #7/#9), Journal (#16). 24 tests green. |
| 2026-09-24 | Presentation layer written (ink sprites, icons, ground chunks, lighting, fx, DOM HUD/inventory/crafting/map/menus, WebAudio). Typecheck clean. Starting browser verification. |
