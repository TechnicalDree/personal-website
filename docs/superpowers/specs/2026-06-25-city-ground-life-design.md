# 3D City — Ground Life (pedestrians, vehicles, robots)

**Date:** 2026-06-25
**Branch:** mobile-responsive-layout-v1
**Goal:** The 3D skyline background looks like a ghost town. Make it feel like a busy
city — crowds of people on the sidewalks, two-way traffic (cars, vans, trucks,
buses) on the road, and robots mixed into the crowd. Maximum density ("packed NYC"),
full on desktop, scaled-down-but-still-busy on mobile.

## Context (existing engine)

`assets/city-3d.js` is a Three.js scene rendered through a low-poly / neon /
pixel-dither post-process:

- Orthographic camera at `(40, 56, 116)` looking at `(0, 23, 0)`. **Higher z = closer
  to camera (front); negative z recedes into the background.**
- The skyline **scrolls horizontally** and tiles seamlessly: `baseCity` is cloned 3×
  across `WORLD_WIDTH = 180` and `cityRoot.position.x = -(scrollDistance % WORLD_WIDTH)`.
- A **road lane** lives inside the scrolling city group: `ROAD_Z = 17`,
  `ROAD_DEPTH = 12` → the clear lane spans **z ∈ [11, 23]**, between the front
  building strip (`z = 36`) and the receding background strips (`z = 0, −16, …`).
- An independent **flyer system** (`buildFlyers`/`updateFlyers`) drifts airships,
  drones and flying cars across the sky on *their own velocity* and wraps at
  `FLYER_BOUND = WORLD_WIDTH * 0.62 ≈ 111.6`. **This is the exact pattern ground
  life reuses.**
- `prefers-reduced-motion` freezes motion but keeps everything present/lit.
- A speed slider scales the building scroll only; flyers deliberately ignore it so
  the scene "always feels alive even when the speed slider freezes the buildings."

## Design

### Architecture (mirrors the layout/render split)

- **NEW `assets/city-3d-agents.js`** — a *pure, seeded, Three.js-free* module like
  `city-3d-layout.js`. `createGroundAgents(seed, { mobile })` returns deterministic
  spawn definitions: `{ pedestrians[], robots[], vehicles[] }`, each entry carrying
  `type`, `x`, `z`, `vx`, `accentIndex`, plus per-type fields (length, walk phase,
  vehicle kind, etc.). Imports only `createRng`, `ROAD_Z`, `ROAD_DEPTH`,
  `CITY_PERIOD` from `city-3d-layout.js`. Exports lane/sidewalk/bound constants and a
  pure `wrapX(x, bound)` helper so both the renderer and the tests share one source
  of truth.
- **EDIT `assets/city-3d.js`** — add `buildGroundAgents()` and
  `updateGroundAgents(delta)`, called immediately after `buildFlyers()` /
  `updateFlyers()` in `init()` and `renderFrame()`. Same independent-velocity + wrap
  pattern as the flyers. All agent groups/meshes are added to `scene`, so the
  existing `dispose()` traversal cleans them up.
- **NEW `scripts/test-city-3d-agents.mjs`** — Node unit tests mirroring
  `test-city-3d-layout.mjs`.

### Lanes & placement (real coordinates)

- **Road, two sub-lanes** inside z ∈ [11, 23]:
  - near lane `z ≈ 20.5`, travelling **−x**
  - far lane `z ≈ 13.5`, travelling **+x**
- **Front sidewalk** `z ∈ [24, 30]` (closest to camera, most visible) and **far
  sidewalk** `z ∈ [6, 10]` (depth). Pedestrians + robots walk along x in both
  directions within these bands.
- Vehicles sit at street level (base y ≈ 0). All agents live in their own group
  (NOT the 3×-cloned city) and wrap at `±AGENT_BOUND` (= `FLYER_BOUND`), exactly
  like flyers.

### Agent appearance (blocky / flat-shaded / neon, matching buildings + flyers)

- **Pedestrians** — instanced body box + head box, ~2.5 units tall, per-instance neon
  accent (cyan/mag/yel) so a crowd reads as a field of moving glowing figures.
- **Robots** — slightly taller pooled groups: a wheeled delivery droid and a bipedal
  unit, each with a glowing "eye" and antenna. Sprinkled among pedestrians.
- **Vehicles** — pooled groups: sedans, vans, box trucks, and **buses** (longer, lit
  window strip + a tech-name route sign via the existing `addSign`). Glowing
  **headlights** (warm white) on the leading end, **taillights** (red) on the
  trailing end; the group is rotated 180° when travelling −x so lights stay correct.
  The fastest cars get a fading trail like the existing flying cars.

### Rendering strategy — hybrid

- **Pedestrians → `InstancedMesh`** (2 instanced meshes: bodies + heads, per-instance
  color). Walk animation = per-frame matrix update (position advance + wrap + vertical
  bob). Hundreds of instances stay cheap.
- **Vehicles & robots → pooled `THREE.Group`s** (low count, varied shapes / lights /
  signage) — the same approach the 29 existing flyers already use successfully.

### Motion & controls

- Ground agents move on **their own velocity, independent of the speed slider**
  (consistent with flyers — keeps the city alive when buildings are frozen). Cars
  moving relative to the scrolling road dashes reads as real driving.
- Per-agent speed variation so traffic flows rather than marches in lockstep.
- **`prefers-reduced-motion`** → no movement, no bob; agents present with lights on.

### Density & mobile (Option A — "packed NYC")

`mobile = window.innerWidth < 700`, decided once at init (resize only adjusts the
render target, never rebuilds the scene).

| Agent       | Desktop | Mobile |
|-------------|--------:|-------:|
| Pedestrians |    ~140 |    ~55 |
| Robots      |     ~14 |     ~6 |
| Vehicles    |     ~24 |    ~10 |

Counts come from the seeded module so they are trivial to tune.

## Testing

`scripts/test-city-3d-agents.mjs`:
- **Determinism** — same seed ⇒ deep-equal agent sets.
- **Counts** — within the expected desktop/mobile ranges per type.
- **Lane containment** — every vehicle's z is inside the road lane [11, 23]; every
  pedestrian/robot z is inside a sidewalk band; no ground agent z falls in a building
  footprint.
- **`wrapX`** — keeps x within `[−bound, bound]` across forward/backward steps.

After implementation: verify the live scene with `/browse` screenshots (desktop +
mobile widths) and an FPS sanity check; tune counts if needed.

## Out of scope (YAGNI)

- Pedestrians crossing the road / crosswalk logic (sidewalk-bound for now).
- Coupling traffic speed to the speed slider (independent, like flyers).
- Per-agent pathfinding / collision avoidance.

## Addendum (2026-06-26): back street, subway, weather

Three follow-on additions, approved interactively.

### Back-street life (the second road, z=17)
`createGroundAgents` now emits **two tiers**, tagged `tier: 'front' | 'back'`:
- **front** — the foreground avenue + sidewalks above.
- **back** — agents on the original in-city road (`BACK_LANE` z∈[11,23], lanes z≈13.5/20.5)
  and its sidewalks (`BACK_SIDEWALKS.front` z∈[24,29], `.behind` z∈[6,10]). Rendered on the
  existing `buildRoad` surface. Lighter counts (~half) and `sizeScale` 0.85 as a depth cue.
`COUNTS` is restructured to `{ desktop|mobile: { front:{…}, back:{…} } }`.

### Subway station
Static foreground furniture (renderer-only, not agents): 2 NYC-style entrances on the near
sidewalk — recessed neon-edged stairwell, low railings, two glowing globe lamps (cyan +
magenta) on posts, and a "SUBWAY" sign. Fixed x, low-poly.

### Weather (default OFF) + toggle
Five modes: **none (default) / rain / snow / wind / fog**, via a new cycle button in the
control panel (`weather-btn`, styled like `theme-btn`), `window.City3D.setWeather(mode)`, and a
`?weather=` URL param.
- rain/snow/wind share ONE InstancedMesh of streaks (per-instance scale/color/velocity per
  mode); particles fall + wrap inside a world-space volume covering the visible frame.
- fog = elevated `scene.fog.density` (handled in updateEnvironment) — no particles.
- Animates only when the user opts in; velocities capped under `prefers-reduced-motion`.
- Button hides on mobile, consistent with the other controls.
