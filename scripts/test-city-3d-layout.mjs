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

assert.ok(seededA.landmarks.length >= 5 && seededA.landmarks.length <= 7);
assert.ok(seededA.supporting.length >= 24);
assert.ok(new Set(seededA.landmarks.map((item) => item.kind)).size >= 5);

for (const lane of [seededA.landmarks, seededA.supporting]) {
  const sorted = [...lane].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const overlap = (previous.x + previous.width / 2) - (current.x - current.width / 2);
    assert.ok(
      overlap < Math.min(previous.width, current.width) * 0.72,
      `severe overlap between ${previous.kind} and ${current.kind}`,
    );
  }
}

console.log('city-3d layout tests passed');
