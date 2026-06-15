const LANDMARK_KINDS = [
  'megaTwin',
  'skyGate',
  'steppedNeedle',
  'holoTower',
  'tieredTemple',
  'lattice',
  'crownTower',
];

const SUPPORT_KINDS = [
  'stacked',
  'tapered',
  'notched',
  'podium',
  'slab',
];

export function createRng(seed) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function range(rng, min, max) {
  return min + (max - min) * rng();
}

function shuffle(rng, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function parseCitySeed(search, fallback) {
  const params = new URLSearchParams(search || '');
  const parsed = Number(params.get('citySeed'));
  if (Number.isFinite(parsed) && params.has('citySeed')) return parsed >>> 0;
  return Number(fallback()) >>> 0;
}

const TAU = Math.PI * 2;

// The camera looks at the skyline from +z toward 0, so HIGHER z is closer to the
// camera (front) and LOWER/negative z recedes into the background.
// One sparse strip sits in FRONT of the road; the road is a clear lane; the
// remaining strips recede behind it, shrinking with depth.
export const ROAD_Z = 17;
export const ROAD_DEPTH = 12;            // clear lane spans z in [ROAD_Z ± ROAD_DEPTH/2] = [11, 23]
export const CITY_PERIOD = 180;          // must equal WORLD_WIDTH in city-3d.js for seamless tiling

const STRIPS = [
  { z: 36, scale: 1.00, landmarks: 3, supports: 7 },   // front strip (in front of the road)
  { z: 0, scale: 1.00, landmarks: 3, supports: 9 },     // first strip behind the road
  { z: -16, scale: 0.82, landmarks: 1, supports: 11 },  // background strips, receding + shrinking
  { z: -32, scale: 0.66, landmarks: 0, supports: 13 },
  { z: -48, scale: 0.52, landmarks: 0, supports: 15 },
];

export function createCityLayout(seed) {
  const rng = createRng(seed);
  const landmarks = [];
  const supporting = [];

  STRIPS.forEach((strip, stripIndex) => {
    // Depths are clamped so no building face intrudes into the road lane.
    const zJitter = stripIndex === 0 ? 2 : 2.6;

    if (strip.landmarks > 0) {
      const kinds = shuffle(rng, LANDMARK_KINDS).slice(0, strip.landmarks);
      const step = CITY_PERIOD / strip.landmarks;
      kinds.forEach((kind, index) => {
        landmarks.push({
          id: `lm-${stripIndex}-${index}`,
          kind,
          strip: stripIndex,
          x: -CITY_PERIOD / 2 + (index + 0.5) * step + range(rng, -step * 0.16, step * 0.16),
          z: strip.z + range(rng, -zJitter, zJitter),
          width: range(rng, 14, 22) * (0.62 + strip.scale * 0.38),
          depth: range(rng, 7, 12) * strip.scale,
          height: range(rng, 34, 58) * strip.scale,
          accentIndex: index % 3,
          windowDensity: range(rng, 0.56, 0.78),
          phase: range(rng, 0, TAU),
        });
      });
    }

    const supportStep = CITY_PERIOD / strip.supports;
    for (let index = 0; index < strip.supports; index++) {
      supporting.push({
        id: `sp-${stripIndex}-${index}`,
        kind: SUPPORT_KINDS[Math.floor(rng() * SUPPORT_KINDS.length)],
        strip: stripIndex,
        x: -CITY_PERIOD / 2 + (index + 0.5) * supportStep + range(rng, -supportStep * 0.3, supportStep * 0.3),
        z: strip.z + range(rng, -zJitter, zJitter),
        width: Math.min(range(rng, 4.2, 7.2), supportStep * 0.9) * (0.72 + strip.scale * 0.28),
        depth: range(rng, 4, 7) * strip.scale,
        height: range(rng, 15, 36) * strip.scale,
        accentIndex: Math.floor(rng() * 3),
        windowDensity: range(rng, 0.38, 0.62),
        phase: range(rng, 0, TAU),
      });
    }
  });

  return {
    seed: Number(seed) >>> 0,
    landmarks,
    supporting,
    road: { z: ROAD_Z, depth: ROAD_DEPTH, period: CITY_PERIOD },
  };
}
