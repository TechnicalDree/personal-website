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

export function createCityLayout(seed) {
  const rng = createRng(seed);
  const landmarkCount = 5 + Math.floor(rng() * 3);
  const landmarkKinds = shuffle(rng, LANDMARK_KINDS).slice(0, landmarkCount);
  const landmarkStep = 144 / Math.max(1, landmarkCount - 1);
  const landmarks = landmarkKinds.map((kind, index) => {
    const width = range(rng, 14, 22);
    return {
      id: `landmark-${index}`,
      kind,
      x: -72 + index * landmarkStep + range(rng, -3.2, 3.2),
      z: range(rng, -7, 5),
      width,
      depth: range(rng, 8, 15),
      height: range(rng, 34, 58),
      accentIndex: index % 3,
      windowDensity: range(rng, 0.56, 0.78),
      phase: range(rng, 0, Math.PI * 2),
    };
  });

  const supportCount = 28 + Math.floor(rng() * 7);
  const supportStep = 164 / Math.max(1, supportCount - 1);
  const supporting = [];
  for (let index = 0; index < supportCount; index++) {
    const width = Math.min(range(rng, 4.2, 7.2), supportStep * 1.28);
    supporting.push({
      id: `support-${index}`,
      kind: SUPPORT_KINDS[Math.floor(rng() * SUPPORT_KINDS.length)],
      x: -82 + index * supportStep + range(rng, -0.7, 0.7),
      z: range(rng, 4, 24),
      width,
      depth: range(rng, 4, 8),
      height: range(rng, 15, 36),
      accentIndex: Math.floor(rng() * 3),
      windowDensity: range(rng, 0.38, 0.62),
      phase: range(rng, 0, Math.PI * 2),
    });
  }

  return {
    seed: Number(seed) >>> 0,
    landmarks,
    supporting,
  };
}
