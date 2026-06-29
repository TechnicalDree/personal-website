import assert from 'node:assert/strict';
import {
  createCityLayout,
  parseCitySeed,
} from '../assets/city-3d-layout.js';

const seededA = createCityLayout(424242);
const seededB = createCityLayout(424242);
assert.deepEqual(seededA, seededB, 'the same seed must reproduce the same skyline');

assert.equal(parseCitySeed('?citySeed=9001', () => 17), 9001);
assert.equal(parseCitySeed('?citySeed=not-a-number', () => 17), 17);

// Landmark count is structural (sum of STRIPS[].landmarks: 3+3+1+1 = 8), not
// seed-dependent. The deeper background rows added a far-row landmark.
assert.ok(seededA.landmarks.length === 8);
assert.ok(seededA.supporting.length >= 24);
// A skyline still needs a variety of landmark silhouettes (per-strip shuffles of a
// 7-kind palette across 8 slots yield several distinct kinds).
assert.ok(new Set(seededA.landmarks.map((item) => item.kind)).size >= 4);

// Overlap only matters within a strip: buildings on different strips sit at
// different depths (z), so two that share an x are not actually colliding.
for (const lane of [seededA.landmarks, seededA.supporting]) {
  const byStrip = new Map();
  for (const item of lane) {
    if (!byStrip.has(item.strip)) byStrip.set(item.strip, []);
    byStrip.get(item.strip).push(item);
  }
  for (const group of byStrip.values()) {
    const sorted = [...group].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      const overlap = (previous.x + previous.width / 2) - (current.x - current.width / 2);
      assert.ok(
        overlap < Math.min(previous.width, current.width) * 0.72,
        `severe overlap between ${previous.kind} and ${current.kind} on strip ${current.strip}`,
      );
    }
  }
}

console.log('city-3d layout tests passed');
