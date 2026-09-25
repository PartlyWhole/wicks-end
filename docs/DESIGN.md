# Wick's End — Game Design & Architecture

A single-player (multiplayer-ready) wilderness survival game in the spirit of *Don't Starve*, playable in the browser and hosted statically on GitHub Pages.

References: `../knowledge-base/` (01 survival, 03 crafting, 04 food, 05 mobs, 06 world, 07 architecture, 08 design principles).

---

## 1. Vision

> *The lamps went out, and the Hollow woke up.*

You are **Silas Wick**, a lamplighter who followed a flicker too far into the woods and woke up in **the Hollow** — a patchwork wilderness where light is life and the dark is alive. There is no quest marker and no tutorial. Survive as many days as you can.

### Design pillars (from KB 08)
1. **Uncompromising, but fair.** Threats are telegraphed (growls before hounds, the screen darkens before the Hush strikes), and every death teaches something.
2. **Knowledge is progression.** No XP. Players get stronger by learning recipes, mob habits, and seasons.
3. **Competing pressures.** Three meters (Health, Hunger, Sanity) plus temperature and light pull in different directions; there is never time to do everything.
4. **Night is a forcing function.** Every day ends with a hard deadline: be near light.
5. **Emergent systems over scripts.** Fire spreads, hogs fight spiders, rain dampens fires, and players can exploit these interactions.
6. **Discovery without hand-holding.** The crafting menu is the soft tutorial: recipes show what is possible. Examining things gives characterful hints.
7. **Readable gothic whimsy.** Hand-inked silhouettes, a muted paper palette, strong outlines, and a clear danger vocabulary.

### Core loops
| Loop | Span | Content |
|---|---|---|
| Moment | seconds | walk, gather, dodge, eat |
| Day | 8 min | explore by day → return with loot at dusk → survive the night by a fire |
| Season | 5–20 days | stock food, craft insulation, and build a base before winter and summer |
| Run | weeks | base building, farming, taming, and "how long can I last?" |

---

## 2. Scope (v1, single-player)

**Included**
- Procedurally generated island, ~200×200 tiles, with 6 biomes: Meadow, Pinewood, Plains, Rocklands, Marsh, Hollow Glade (graveyard), connected by painted roads.
- Day/dusk/night cycle (16 segments, 480 s per day), 4 seasons (Autumn 20, Winter 15, Spring 20, Summer 15 days; lengths can be shortened in settings).
- Health/Hunger/Sanity, temperature (freezing/overheating), wetness from rain, darkness damage ("the Hush").
- Gathering: trees (3 growth stages; chop, stump, dig), saplings, grass, berry bushes, carrots, flowers, reeds, boulders, flint.
- Crafting in 8 tabs, tech tiers (hand → Tinker's Bench → Alembic Engine), prototyping (+sanity), placement of structures.
- Fire: campfires and fire pits with fuel, torches, fire spread and burning, wildfires in summer, ash and charcoal.
- Food: eating, cooking on fire, drying rack, spoilage (fresh/stale/spoiled → rot), a Cook Pot with ingredient-tag matching, a chest, and an Ice Box (slows spoilage).
- Mobs with behavior-tree AI: rabbits, birds, shagbeasts (beefalo-like herds), hogfolk + houses (followers), spiders + dens (tiered), frogs, hound waves, and shadow creatures when insane.
- Combat: weapons, armor absorption, attack cooldowns, kiting, loot tables.
- Sanity effects: visual distortion, shadow creatures, and sanity auras.
- Minimap/world map with fog of war, examine text, a pause menu, autosave at dawn, and a death screen with stats.
- Procedural audio (WebAudio): sfx, ambience, threat cues, and work/danger music.
- **Frostmaw**, a mid-winter giant (telegraphed by roars and quakes) that hunts you and flattens structures; it drops a Frost Heart that keeps you cool in summer.
- **Journal** (J): creatures, foods and items unlock when encountered and show their stats. It persists across lives.

**Deferred (post-v1):** multiplayer, caves, more seasonal giants, farming 2.0, boats, multiple characters, controller support, and camera rotation.

---

## 3. Technical Architecture

### 3.1 Stack
- **TypeScript + Vite**, zero runtime dependencies. The build is a static bundle deployed to GitHub Pages through GitHub Actions.
- **Canvas 2D** for rendering, with procedurally generated sprites cached to offscreen canvases; **DOM + CSS** for UI (crisp text, accessible, cheap).
- **Vitest** for headless simulation tests.

### 3.2 Layering (strict, one-directional)

```
            ┌─────────────── app (main.ts) ────────────────┐
            │  wires everything, owns rAF loop & screens    │
            └───────┬─────────────┬──────────────┬─────────┘
                    │             │              │
        ┌───────────▼──┐  ┌───────▼──────┐ ┌─────▼──────┐
        │  render/     │  │  ui/         │ │  audio/    │   presentation (reads sim, never mutates)
        └───────┬──────┘  └───────┬──────┘ └─────┬──────┘
                │   reads state    │ emits Commands│ listens to sim events
        ┌───────▼──────────────────▼──────────────▼──────┐
        │  sim/  (Game, systems, actions, worldgen, save)│   deterministic, headless
        └───────┬───────────────────────────────┬───────┘
                │ uses                           │ reads defs
        ┌───────▼──────┐                 ┌───────▼───────┐
        │  engine/     │                 │  content/     │
        │ ECS, events, │                 │ items, prefabs│
        │ rng, noise,  │                 │ recipes, foods│
        │ spatial, BT  │                 │ tuning, text  │
        └──────────────┘                 └───────────────┘
```

Rules:
- `sim/` never imports from `render/`, `ui/`, `audio/`, or the DOM, so it runs in Node tests and later in a Worker or on a server.
- The only way input changes the simulation is through **Commands** (`move`, `act`, `craft`, `equip`, `useItem`, `drop`, `place`, …) queued into `Game`. That is the multiplayer seam: later, commands come from the network and state goes out as snapshots.
- Presentation subscribes to **sim events** (`hit`, `died`, `crafted`, `ate`, `say`, `sfx`, …) for feedback and never holds game state of its own.

### 3.3 Engine
- **Entities**: plain JS objects `{ id, prefab, x, y, ...components }`. Components are plain data (JSON-serializable), so save/load and networking are simple.
- **World**: `Map<id, Entity>`, plus a **component index** (`Set<Entity>` per component key) for fast queries, and a **spatial hash** (8-unit cells) for proximity queries.
- **Systems**: `{ name, interval?, update(game, dt) }`, run in a fixed order by the fixed-step loop (**30 Hz sim**, rendering interpolated at display rate). Slow systems (spoilage, growth) run at 1–2 Hz through `interval`.
- **Scheduler**: a min-heap of `(time, entityId, event)` for sparse timers (regrowth, tree growth, fire burnout) instead of per-tick countdowns.
- **Entity sleep**: AI/locomotion only tick within ~48 units of the player ("awake radius"); far entities advance through scheduler timers only.
- **Seeded RNG** (sfc32) with separate streams for world generation and runtime, so a seed reproduces a world.
- **Behavior trees**: small combinator library (`Selector`, `Sequence`, `Condition`, `Action`, `Wait`) with a per-entity blackboard; brains are defined in content.

### 3.4 Content (data-driven, "mod-shaped")
Everything game-specific lives in `content/` and is registered in registries:
- `items.ts` — `ItemDef { id, name, stack, tags, food?, fuel?, equip?, weapon?, armor?, tool?, perish?, burnable? }`
- `prefabs.ts` — `PrefabDef { id, name, components: {...defaults}, sprite, brain? }`, where the components object is cloned into an entity at spawn.
- `recipes.ts` — `Recipe { id, tab, tech, ingredients, result|place }`
- `cookpot.ts` — ingredient tag values + `CookRecipe { id, priority, test(tags,names), time }`
- `tuning.ts` — every numeric constant in one place (KB 01/05 numbers).
- `strings.ts` — examine quotes and hint text.

Adding a new mob = add a prefab + brain + sprite function. Adding an item = one entry. Systems key off components and tags, never prefab ids.

### 3.5 Key components
| Component | Data | System |
|---|---|---|
| `health` | cur, max, invuln, regen, fireDmg | health / combat |
| `hunger`, `sanity` | cur, max, rate | stats |
| `temperature` | cur, insulation | temperature |
| `wetness` | cur | weather |
| `locomotor` | speed, runSpeed, dest, dir | locomotion |
| `combat` | damage, period, range, target, lastAttack | combat |
| `brain` | id, blackboard | ai |
| `inventory` | slots[15], equip{hand,body,head} | inventory |
| `container` | slots[n], kind | containers / cookpot |
| `workable` | action(chop/mine/dig/hammer), left, onFinish | actions |
| `pickable` | product, regrowTime, ready | actions / scheduler |
| `growable` | stage, stages | scheduler |
| `burnable` | burning, burnTime, spreadRadius | fire |
| `fueled` | fuel, max, rate, level | fire / light |
| `light` | radius, intensity, color | lighting / darkness |
| `perishable` | (items) perish time left | spoilage |
| `loot` | table | combat death |
| `follower` / `leader` | leader id, loyalty until | ai |
| `home` / `spawner` | child prefab, children, regen | spawner |
| `sanityAura` | value per minute | stats |
| `insulator`, `waterproof` | on equip items | temperature / weather |

Items in inventories are **item stacks** `{ id, n, perish?, uses?, fuel? }`, not world entities. They become `item` entities only when dropped. This keeps the entity count low.

### 3.6 Actions
`ActionDef { id, verb, range, duration, canDo(game, actor, target, held), execute(...) }`. The input layer asks `actions.resolve(actor, target, held)` for the best left-click action and the alternate (right-click) action. This drives the tooltip ("Chop Pine Tree" / "Examine"). The player walks into range, then performs the action through the state machine (`idle` / `walk` / `work` / `attack` / `eat` / `hit` / `dead`).

### 3.7 Rendering
- **Camera**: top-down ¾ view; world units → pixels at 16 px/unit × zoom (mouse wheel, 3 levels). Entities are y-sorted and anchored at their feet.
- **Ground**: pre-rendered per 16×16-tile chunk into offscreen canvases (lazily, LRU cache). Biome borders are organic, using noise-perturbed tile lookups at 8 px resolution, plus a detail pass (grass strokes, pebbles, puddles) and a paper grain overlay. Ocean has animated foam at the coast.
- **Sprites**: procedural "ink" art. Wobbly polygons with dark outline strokes, hatching, and a limited palette, generated at startup into canvas atlases per prefab/state/variant. Actors (player, mobs) are drawn from cached parts with procedural animation (bob, squash, limb swing, facing flip).
- **Lighting**: a darkness layer (half resolution) filled with the ambient night color, with light sources punched out using radial gradients (`destination-out`) plus a warm additive glow. Dusk and season tints are applied as a color grade.
- **Sanity FX**: CSS filter (saturation/contrast) on the game canvas plus a wobbling vignette overlay and ghost silhouettes as sanity drops.
- **Weather FX**: rain/snow particles and a wet-screen tint; a summer heat shimmer.

### 3.8 UI (DOM overlay)
- **Top right**: day clock dial (day/dusk/night wedges plus hand, day number) and a season badge.
- **Right**: three stat badges (heart, stomach, brain) with fill, value on hover, and rising/falling arrows; a thermometer badge when near danger.
- **Bottom**: 15-slot inventory bar plus 3 equip slots, with durability/freshness rings and stack counts.
- **Left**: crafting tabs → recipe list → detail card (ingredients have/need, "needs Tinker's Bench", Craft/Prototype button).
- **Container panel** for chests, the cook pot (Cook button) and the backpack.
- **Cursor tooltip**: the action verb + target name; right-click shows the alternate action.
- **Map (Tab/M)**: explored-tile map with icons.
- **Menus**: title screen (New World with seed, Continue), pause (Esc) with settings (volume, season length, difficulty), death screen (days survived, cause, killer).
- A **speech bubble** over the player for examine text and warnings ("I'm getting hungry…").

### 3.9 Input
| Input | Effect |
|---|---|
| WASD / arrows | move |
| Left click | walk to / do default action / pick up / attack |
| Right click | alternate action (examine, eat, equip, cook on fire) |
| Space | act on nearest interactable (gather, pick) |
| F | attack nearest hostile |
| 1–9, 0 | use inventory slot |
| Tab / M | map |
| Esc | pause / close panels |
| Shift+click | inspect |
| Mouse wheel | zoom |
Drag and drop in the inventory; right-click an inventory item to use/equip/eat.

### 3.10 Save/Load
The whole world state is JSON: `{version, seed, time, entities, player, explored (RLE), tiles (RLE)}`, stored in `localStorage` (compressed with CompressionStream when available). It autosaves at every dawn and on pause/quit. Permadeath: dying deletes the save, as in DS.

### 3.11 Performance budget
- Sim: < 3 ms per 30 Hz tick with ~8k entities (sleep radius, scheduler, spatial hash).
- Render: < 8 ms per frame at 1080p (chunk caching, visible-only culling, half-res lighting).
- Bundle: < 300 KB gz, no external assets (everything procedural).

### 3.12 Multiplayer readiness (later)
Sim is headless, deterministic per seed, and fed only by commands. Adding multiplayer then means: run `Game` on the host (tab or Worker), replicate entity snapshots (position/state/visual components) with deltas, and send commands from clients through WebRTC (Trystero). The player is a regular entity with an `owner` field.

---

## 4. Directory layout (as built)

```
wicks-end/
  index.html                 page shell (canvas + DOM UI roots), Google Fonts
  src/
    main.ts                  App: screens, fixed-step loop, autosave, post-FX, title backdrop
    debug.ts                 dev-only console helpers (dbg.*), stripped from production
    engine/                  content-agnostic building blocks
      ecs.ts                 World: entity map + component index + spatial hash
      spatial.ts             uniform-grid spatial hash (radius/rect/nearest queries)
      scheduler.ts           min-heap of timed events (regrowth, growth, regen)
      bt.ts                  behavior-tree combinators
      events.ts rng.ts noise.ts math.ts
    content/                 data only: the "mod" layer
      tuning.ts              every number (KB-derived)
      defs.ts                ItemDef / PrefabDef / Recipe types + registries
      items.ts prefabs.ts recipes.ts cookpot.ts strings.ts
    sim/                     headless, deterministic simulation (no DOM)
      game.ts                Game: world, clock, systems, command queue, events
      create.ts              newGame(), serialize()/deserialize()
      commands.ts            Command union (the only input into the sim)
      player.ts              command handling, player controller, crafting, inventory ops
      actions.ts             ActionDef table + resolution (primary / alternate)
      combat.ts              attacks, damage, armor, aggro, death & loot, giant slam
      spawn.ts inventory.ts clock.ts light.ts tiles.ts types.ts
      systems/               ai (brains + actor states), locomotion (steering/collision),
                             stats (hunger/sanity/temp/wetness/Hush), fire, spoilage,
                             weather, world (scheduler/spawners/cookers/traps), threats
                             (hounds, Frostmaw, shadows, birds)
      brains/                common behaviors + per-creature behavior trees
      worldgen/              island mask → Voronoi biomes → roads → content & set pieces
    render/                  Canvas 2D presentation (reads sim, never mutates)
      renderer.ts            camera, culling, y-sort, lighting, weather, speech, placement ghost
      ground.ts              per-chunk ground painting (warped borders, coast ink, roads)
      ink.ts icons.ts fx.ts  hand-inked drawing helpers, item icons, particles
      sprites/static.ts      cached world sprites; sprites/actors.ts animated creatures
    ui/                      DOM UI: hud, inventory, crafting, journal, map, menus, tooltip
    input/input.ts           keyboard/mouse → Commands, hover tooltips
    audio/audio.ts           WebAudio synthesis: sfx, ambience, work/danger music
  tests/                     vitest: engine + gameplay (headless sim)
  docs/                      DESIGN.md, PROGRESS.md
  .github/workflows/deploy.yml   test → build → GitHub Pages
```
