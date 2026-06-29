import assert from 'node:assert/strict';
import {
  createGroundAgents,
  wrapX,
  AGENT_BOUND,
  AVENUE,
  TRAFFIC_LANE,
  SIDEWALKS,
  BACK_LANE,
  BACK_SIDEWALKS,
  COUNTS,
} from '../assets/city-3d-agents.js';

// --- Determinism: same seed reproduces the same crowd & traffic ---
const a = createGroundAgents(424242, { mobile: false });
const b = createGroundAgents(424242, { mobile: false });
assert.deepEqual(a, b, 'the same seed must reproduce the same ground life');

const c = createGroundAgents(99, { mobile: false });
assert.notDeepEqual(a, c, 'different seeds should produce different ground life');

const inBand = (z, band) => z >= band.min && z <= band.max;
const byTier = (list, tier) => list.filter((x) => x.tier === tier);

// --- Counts: two tiers (foreground "front" + background "back"), each scaled for mobile ---
for (const [agents, env] of [[a, COUNTS.desktop], [createGroundAgents(424242, { mobile: true }), COUNTS.mobile]]) {
  assert.equal(byTier(agents.pedestrians, 'front').length, env.front.pedestrians);
  assert.equal(byTier(agents.pedestrians, 'back').length, env.back.pedestrians);
  assert.equal(byTier(agents.robots, 'front').length, env.front.robots);
  assert.equal(byTier(agents.robots, 'back').length, env.back.robots);
  assert.equal(byTier(agents.vehicles, 'front').length, env.front.vehicles);
  assert.equal(byTier(agents.vehicles, 'back').length, env.back.vehicles);
}
// Mobile lighter than desktop but still busy.
const m = createGroundAgents(424242, { mobile: true });
assert.ok(m.pedestrians.length < a.pedestrians.length, 'mobile crowd lighter than desktop');
assert.ok(m.pedestrians.length >= 40, 'mobile crowd still busy');
// Back tier is lighter than front.
assert.ok(COUNTS.desktop.back.pedestrians < COUNTS.desktop.front.pedestrians, 'back street lighter than foreground');

// --- The avenue sits in the foreground; the back road is the original in-city road ---
assert.ok(AVENUE.z > 42 && AVENUE.z < 80, 'avenue is in the visible foreground');
assert.equal(TRAFFIC_LANE.min, AVENUE.z - AVENUE.depth / 2);
assert.equal(TRAFFIC_LANE.max, AVENUE.z + AVENUE.depth / 2);
assert.ok(SIDEWALKS.far.max < TRAFFIC_LANE.min, 'far sidewalk sits before the avenue');
assert.ok(SIDEWALKS.near.min > TRAFFIC_LANE.max, 'near sidewalk sits after the avenue');
assert.ok(SIDEWALKS.far.min >= 45, 'far sidewalk clears the depth-scaled front building strip');
assert.ok(SIDEWALKS.near.max <= 72, 'near sidewalk stays inside the bottom frustum edge');
// Back road is deeper in the scene than the foreground avenue.
assert.ok(BACK_LANE.max < SIDEWALKS.far.min, 'back road sits behind the foreground street');
assert.ok(BACK_SIDEWALKS.behind.max < BACK_LANE.min, 'behind-sidewalk is past the back road');
assert.ok(BACK_SIDEWALKS.front.min > BACK_LANE.max, 'front-of-back sidewalk is before the back road');

const VEHICLE_KINDS = new Set(['sedan', 'van', 'truck', 'bus']);
const ROBOT_KINDS = new Set(['wheeled', 'biped']);

// --- Vehicles: front on the avenue, back on the in-city road; both lanes two-way ---
for (const v of a.vehicles) {
  assert.equal(v.type, 'vehicle');
  assert.ok(VEHICLE_KINDS.has(v.kind), `unknown vehicle kind ${v.kind}`);
  assert.ok(Math.abs(v.vx) > 0, 'vehicles must move');
  assert.ok(Math.abs(v.x) <= AGENT_BOUND, 'vehicle spawns within bounds');
  assert.ok(v.length > 0 && v.width > 0 && v.height > 0, 'vehicle has positive dimensions');
  const lane = v.tier === 'front' ? TRAFFIC_LANE : BACK_LANE;
  assert.ok(inBand(v.z, lane), `${v.tier} vehicle off its road at z=${v.z}`);
}
for (const tier of ['front', 'back']) {
  const vs = byTier(a.vehicles, tier);
  assert.ok(vs.some((v) => v.vx > 0), `${tier}: some vehicles travel +x`);
  assert.ok(vs.some((v) => v.vx < 0), `${tier}: some vehicles travel -x`);
}
assert.ok(a.vehicles.some((v) => v.kind === 'bus'), 'at least one bus');

// --- Pedestrians stay on a sidewalk for their tier, never on a road ---
for (const p of a.pedestrians) {
  assert.equal(p.type, 'pedestrian');
  if (p.tier === 'front') {
    assert.ok(inBand(p.z, SIDEWALKS.near) || inBand(p.z, SIDEWALKS.far), `front ped off sidewalk z=${p.z}`);
    assert.ok(!inBand(p.z, TRAFFIC_LANE), 'front ped must not stand in the avenue');
  } else {
    assert.ok(inBand(p.z, BACK_SIDEWALKS.front) || inBand(p.z, BACK_SIDEWALKS.behind), `back ped off sidewalk z=${p.z}`);
    assert.ok(!inBand(p.z, BACK_LANE), 'back ped must not stand in the back road');
  }
  assert.ok(Math.abs(p.x) <= AGENT_BOUND, 'pedestrian spawns within bounds');
  assert.ok(p.accentIndex >= 0 && p.accentIndex <= 2, 'accent in palette range');
  assert.ok(p.height > 0, 'pedestrian has height');
}

// Back-tier agents are scaled smaller than front (depth cue).
const maxH = (list) => Math.max(...list.map((x) => x.height));
assert.ok(maxH(byTier(a.pedestrians, 'back')) < maxH(byTier(a.pedestrians, 'front')), 'back pedestrians are smaller');

// --- Robots share the sidewalks for their tier ---
for (const r of a.robots) {
  assert.equal(r.type, 'robot');
  assert.ok(ROBOT_KINDS.has(r.kind), `unknown robot kind ${r.kind}`);
  const sidewalks = r.tier === 'front' ? SIDEWALKS : BACK_SIDEWALKS;
  const bands = Object.values(sidewalks);
  assert.ok(bands.some((band) => inBand(r.z, band)), `${r.tier} robot off the sidewalk at z=${r.z}`);
}

// --- wrapX keeps agents within [-bound, bound] in both directions ---
assert.equal(wrapX(0, 100), 0);
assert.equal(wrapX(105, 100), -95);
assert.equal(wrapX(-105, 100), 95);
for (const x of [-100, -50, 0, 50, 100, 130, -130, 250, -250]) {
  const w = wrapX(x, 100);
  assert.ok(w >= -100 && w <= 100, `wrapX(${x}) = ${w} out of range`);
}

console.log('city-3d agents tests passed');
