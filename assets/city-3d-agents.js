// Pure, seeded layout for the city's "ground life": pedestrians and robots on the
// sidewalks, and two-way vehicle traffic. No Three.js here — this module only produces
// deterministic spawn definitions so it can be unit-tested in Node. The renderer
// (city-3d.js) turns these into meshes and animates them, reusing the flyer system's
// independent-velocity + wrap pattern.
//
// Two tiers, tagged `tier`:
//   - 'front': a foreground avenue + sidewalks, in the empty unoccluded space between
//     the camera and the front building strip (the most visible part of the frame).
//   - 'back':  the original in-city road at z=17 and its sidewalks, glimpsed between the
//     front buildings. Lighter and slightly smaller, as a depth cue.
import { createRng, CITY_PERIOD, ROAD_Z, ROAD_DEPTH } from './city-3d-layout.js';

const TAU = Math.PI * 2;

// Agents drift in their own group (not the 3×-tiled city) and wrap at this bound,
// exactly like the flyers (FLYER_BOUND = WORLD_WIDTH * 0.62 in city-3d.js).
export const AGENT_BOUND = CITY_PERIOD * 0.62;

// --- Foreground tier ---
export const AVENUE = { z: 56, depth: 16 };
export const TRAFFIC_LANE = {
  min: AVENUE.z - AVENUE.depth / 2, // 48
  max: AVENUE.z + AVENUE.depth / 2, // 64
};
export const SIDEWALKS = {
  near: { min: 66, max: 71 }, // closest to camera (the prominent crowd)
  far: { min: 45.5, max: 47.5 }, // clears the depth-scaled front building strip (~z=45)
};

// --- Background tier: the original in-city road (z=17, lane z∈[11,23]) ---
export const BACK_LANE = {
  min: ROAD_Z - ROAD_DEPTH / 2, // 11
  max: ROAD_Z + ROAD_DEPTH / 2, // 23
};
export const BACK_SIDEWALKS = {
  front: { min: 24, max: 29 }, // between the back road and the front building strip
  behind: { min: 6, max: 10 }, // between the back road and the first strip behind it
};

// Packed-NYC density on desktop; lighter but still busy on phones. The back tier is
// roughly half the foreground (it's partly occluded by the front buildings).
export const COUNTS = {
  desktop: {
    front: { pedestrians: 150, robots: 16, vehicles: 30 },
    back: { pedestrians: 70, robots: 8, vehicles: 14 },
  },
  mobile: {
    front: { pedestrians: 60, robots: 7, vehicles: 12 },
    // The back tier is the least-visible, most-expensive part (pooled robot/vehicle
    // groups) — trimmed hard on phones. Pedestrians are instanced, so a few are cheap.
    back: { pedestrians: 14, robots: 0, vehicles: 4 },
  },
};

// Per-tier placement config consumed by the generator.
const TIERS = {
  front: {
    sidewalks: [SIDEWALKS.near, SIDEWALKS.far],
    sidewalkBias: 0.6, // favour the prominent near sidewalk
    laneFar: AVENUE.z - 4, // 52, travels +x
    laneNear: AVENUE.z + 4, // 60, travels -x
    laneJitter: 1,
    sizeScale: 1,
  },
  back: {
    sidewalks: [BACK_SIDEWALKS.front, BACK_SIDEWALKS.behind],
    sidewalkBias: 0.62, // favour the more-visible front-of-road sidewalk
    laneFar: ROAD_Z - 3.5, // 13.5, travels +x
    laneNear: ROAD_Z + 3.5, // 20.5, travels -x
    laneJitter: 0.8,
    sizeScale: 0.85,
  },
};

const VEHICLE_DIMS = {
  bus: (rng) => ({ length: range(rng, 8.5, 11.5), width: range(rng, 2.2, 2.5), height: range(rng, 2.8, 3.2) }),
  truck: (rng) => ({ length: range(rng, 5.5, 7.5), width: range(rng, 2.1, 2.4), height: range(rng, 2.4, 2.9) }),
  van: (rng) => ({ length: range(rng, 4.4, 5.4), width: range(rng, 2.0, 2.2), height: range(rng, 2.1, 2.5) }),
  sedan: (rng) => ({ length: range(rng, 3.6, 4.8), width: range(rng, 1.8, 2.1), height: range(rng, 1.4, 1.7) }),
};

function range(rng, min, max) {
  return min + (max - min) * rng();
}

function accent(rng) {
  return Math.floor(rng() * 3);
}

// Pick a z within one of two sidewalk bands, biased toward the first (more visible).
function pickSidewalkZ(rng, bands, bias) {
  const band = rng() < bias ? bands[0] : bands[1];
  return range(rng, band.min + 0.5, band.max - 0.5);
}

function pickVehicleKind(rng) {
  const r = rng();
  if (r < 0.46) return 'sedan';
  if (r < 0.68) return 'van';
  if (r < 0.86) return 'truck';
  return 'bus';
}

// Keep a coordinate inside [-bound, bound] as agents scroll past the edges.
export function wrapX(x, bound) {
  const span = bound * 2;
  let value = x;
  while (value > bound) value -= span;
  while (value < -bound) value += span;
  return value;
}

// Append one tier's pedestrians/robots/vehicles into the shared output arrays.
function spawnTier(rng, out, tierName, counts, forceBus) {
  const cfg = TIERS[tierName];
  const s = cfg.sizeScale;
  const spawnX = () => range(rng, -AGENT_BOUND, AGENT_BOUND);

  for (let i = 0; i < counts.pedestrians; i++) {
    const dir = rng() < 0.5 ? -1 : 1;
    out.pedestrians.push({
      type: 'pedestrian',
      tier: tierName,
      x: spawnX(),
      z: pickSidewalkZ(rng, cfg.sidewalks, cfg.sidewalkBias),
      vx: dir * range(rng, 0.07, 0.16),
      accentIndex: accent(rng),
      height: range(rng, 2.6, 3.4) * s,
      bobSpeed: range(rng, 2.6, 4.4),
      bobPhase: range(rng, 0, TAU),
      bobAmp: range(rng, 0.07, 0.16) * s,
    });
  }

  for (let i = 0; i < counts.robots; i++) {
    const dir = rng() < 0.5 ? -1 : 1;
    const kind = rng() < 0.5 ? 'wheeled' : 'biped';
    out.robots.push({
      type: 'robot',
      tier: tierName,
      kind,
      x: spawnX(),
      z: pickSidewalkZ(rng, cfg.sidewalks, cfg.sidewalkBias),
      vx: dir * range(rng, 0.05, 0.11),
      accentIndex: accent(rng),
      height: range(rng, 3.4, 4.4) * s,
      bobSpeed: range(rng, 1.8, 3.2),
      bobPhase: range(rng, 0, TAU),
      bobAmp: kind === 'biped' ? range(rng, 0.1, 0.2) * s : 0,
    });
  }

  for (let i = 0; i < counts.vehicles; i++) {
    // Lanes alternate by parity so both directions are always present. The first
    // vehicle of the bus-bearing tier is a bus (the showpiece with a route sign).
    const kind = (forceBus && i === 0) ? 'bus' : pickVehicleKind(rng);
    const onFarLane = i % 2 === 0;
    const dir = onFarLane ? 1 : -1;
    const laneZ = onFarLane ? cfg.laneFar : cfg.laneNear;
    const slow = kind === 'bus' || kind === 'truck';
    const speed = slow ? range(rng, 0.3, 0.5) : range(rng, 0.45, 0.95);
    const dims = VEHICLE_DIMS[kind](rng);
    out.vehicles.push({
      type: 'vehicle',
      tier: tierName,
      kind,
      x: spawnX(),
      z: laneZ + range(rng, -cfg.laneJitter, cfg.laneJitter),
      vx: dir * speed,
      accentIndex: accent(rng),
      hasTrail: kind === 'sedan' && rng() < 0.4,
      length: dims.length * s,
      width: dims.width * s,
      height: dims.height * s,
    });
  }
}

export function createGroundAgents(seed, { mobile = false } = {}) {
  // Salt distinct from the flyer RNG so ground life doesn't mirror the sky.
  const rng = createRng(((Number(seed) >>> 0) ^ 0x85ebca6b) >>> 0);
  const env = mobile ? COUNTS.mobile : COUNTS.desktop;
  const out = { pedestrians: [], robots: [], vehicles: [] };
  spawnTier(rng, out, 'front', env.front, true);
  spawnTier(rng, out, 'back', env.back, false);
  return out;
}
