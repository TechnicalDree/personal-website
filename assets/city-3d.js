import * as THREE from './vendor/three.module.min.js';
import { createCityLayout, parseCitySeed, createRng } from './city-3d-layout.js?v=20260614b';

const canvas = document.getElementById('bg-city3d');
const params = new URLSearchParams(window.location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORLD_WIDTH = 180;
const VIEW_HEIGHT = 82;
const WINDOW_LABELS = ['CMU', 'MUNOZ', 'DREE', 'NOVA', 'BYTE', 'ORBIT', 'AETHER'];

let renderer = null;
let scene = null;
let camera = null;
let renderTarget = null;
let postScene = null;
let postCamera = null;
let postMaterial = null;
let cityRoot = null;
let directionalLight = null;
let ambientLight = null;
let animationFrame = 0;
let frameCount = 0;
let lastFrame = performance.now();
let elapsed = 0;
let scrollDistance = 0;
let speed = 1;
let pointerX = 0;
let pointerY = 0;
let pointerTargetX = 0;
let pointerTargetY = 0;
let currentTheme = window.PhosphorTheme ? window.PhosphorTheme.readSaved() : 'default';
let palette = null;
let buildingMaterials = [];
let accentMaterials = [];
let windowMaterials = [];
let signRecords = [];
let flyers = [];
let flyersGroup = null;
let disposed = false;

const fallbackSeed = () => {
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    return window.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
};

const seed = parseCitySeed(window.location.search, fallbackSeed);
const api = {
  ready: false,
  seed,
  renderer: 'three',
  setSpeed(value) {
    speed = Math.max(0, Math.min(2.5, Number(value) || 0));
    if (canvas) canvas.dataset.speed = speed.toFixed(1);
  },
  applyTheme(name) {
    applyTheme(name);
  },
  resize() {
    resize();
  },
  dispose() {
    dispose();
  },
};
window.City3D = api;
if (canvas) {
  canvas.dataset.renderer = 'three';
  canvas.dataset.seed = String(seed);
  canvas.dataset.state = 'loading';
}

function dispatchReady(ready, detail = {}) {
  api.ready = ready;
  if (canvas) {
    canvas.dataset.state = ready ? 'ready' : (detail.error ? 'error' : 'fallback');
    canvas.dataset.error = detail.error || '';
  }
  window.dispatchEvent(new CustomEvent('city-3d-ready', {
    detail: { ready, seed, ...detail },
  }));
}

function getPalette(name = currentTheme) {
  if (window.PhosphorTheme) return window.PhosphorTheme.get(name);
  return {
    col: {
      bld1: '#04101f',
      bld2: '#061a2e',
      bld3: '#082744',
      bld4: '#0b3656',
      bld5: '#104a70',
      cyan: '#36f5ff',
      mag: '#ff2fb3',
      yel: '#f6ff7a',
      wht: '#e8fbff',
      streetDark: '#020a13',
    },
  };
}

function liftedBuildingColor(color, index) {
  return new THREE.Color(color).lerp(
    new THREE.Color(palette.col.cyan),
    0.045 + index * 0.012,
  );
}

function makeMaterials() {
  palette = getPalette();
  const col = palette.col;
  buildingMaterials = [col.bld1, col.bld2, col.bld3, col.bld4, col.bld5].map((color, index) => {
    const lifted = liftedBuildingColor(color, index);
    return new THREE.MeshStandardMaterial({
      color: lifted,
      emissive: lifted,
      emissiveIntensity: 0.3 + index * 0.035,
      roughness: 0.72 - index * 0.05,
      metalness: 0.24 + index * 0.05,
      flatShading: true,
    });
  });
  accentMaterials = [col.cyan, col.mag, col.yel].map((color) => (
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.5,
      roughness: 0.35,
      metalness: 0.35,
    })
  ));
  windowMaterials = [col.cyan, col.mag, col.yel].map((color) => (
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.94,
    })
  ));
}

function applyTheme(name) {
  currentTheme = name || 'default';
  palette = getPalette(currentTheme);
  if (canvas) canvas.dataset.theme = currentTheme;
  if (!scene) return;
  const col = palette.col;
  const buildingColors = [col.bld1, col.bld2, col.bld3, col.bld4, col.bld5];
  const accentColors = [col.cyan, col.mag, col.yel];
  buildingMaterials.forEach((material, index) => {
    const lifted = liftedBuildingColor(buildingColors[index], index);
    material.color.copy(lifted);
    material.emissive.copy(lifted);
  });
  accentMaterials.forEach((material, index) => {
    material.color.set(accentColors[index]);
    material.emissive.set(accentColors[index]);
  });
  windowMaterials.forEach((material, index) => material.color.set(accentColors[index]));
  signRecords.forEach((record) => drawSignTexture(record));
  scene.fog.color.set(col.bld1);
  if (postMaterial) {
    postMaterial.uniforms.uTint.value.set(col.cyan);
  }
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false);
const unitSphere = new THREE.SphereGeometry(0.5, 12, 8);
const windowMatrices = [[], [], []];
const dummy = new THREE.Object3D();

function addMass(parent, {
  x, y, z, w, h, d, material = buildingMaterials[2], castShadow = true,
}) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(x, y + h / 2, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBeam(parent, start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(unitCylinder, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.set(radius * 2, direction.length(), radius * 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function matrixForWindow(x, y, z, sx, sy, sz, rotationY = 0) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, rotationY, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

function detailHash(a, b, c) {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function addFacade({
  x, y = 0, z, w, h, d, accentIndex, density = 0.58, side = true,
}) {
  const cols = Math.max(2, Math.floor((w - 1.2) / 1.55));
  const rows = Math.max(2, Math.floor((h - 2) / 2.15));
  const stepX = (w - 1.25) / cols;
  const stepY = (h - 2) / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (detailHash(x + col, z + row, h) > density) continue;
      const wx = x - (w - stepX) / 2 + col * stepX;
      const wy = y + 1.1 + row * stepY;
      windowMatrices[accentIndex].push(
        matrixForWindow(wx, wy, z + d / 2 + 0.09, 0.72, 0.48, 0.12),
      );
    }
  }
  if (!side) return;
  const sideCols = Math.max(1, Math.floor((d - 0.8) / 1.6));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < sideCols; col++) {
      if (detailHash(z + col, x + row, w) > density * 0.82) continue;
      const wz = z - (d - 0.8) / 2 + col * ((d - 0.8) / sideCols);
      const wy = y + 1.1 + row * stepY;
      windowMatrices[(accentIndex + 1) % 3].push(
        matrixForWindow(x + w / 2 + 0.09, wy, wz, 0.12, 0.48, 0.72),
      );
    }
  }
}

function addMassWithFacade(parent, options) {
  const mesh = addMass(parent, options);
  addFacade(options);
  return mesh;
}

function addRoofMachinery(parent, x, y, z, w, d, accentIndex) {
  const dark = buildingMaterials[1];
  addMass(parent, { x: x - w * 0.18, y, z, w: w * 0.22, h: 1.4, d: d * 0.34, material: dark, castShadow: false });
  addMass(parent, { x: x + w * 0.16, y, z: z - d * 0.08, w: w * 0.16, h: 0.9, d: d * 0.2, material: accentMaterials[accentIndex], castShadow: false });
  addBeam(
    parent,
    new THREE.Vector3(x + w * 0.28, y, z),
    new THREE.Vector3(x + w * 0.28, y + 4.2, z),
    0.11,
    accentMaterials[accentIndex],
  );
}

function drawSignTexture(record) {
  const col = palette.col;
  const accent = [col.cyan, col.mag, col.yel][record.accentIndex];
  const context = record.canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, record.canvas.width, record.canvas.height);
  context.fillStyle = col.bld1;
  context.fillRect(0, 0, record.canvas.width, record.canvas.height);
  context.strokeStyle = accent;
  context.lineWidth = 4;
  context.strokeRect(2, 2, record.canvas.width - 4, record.canvas.height - 4);
  context.fillStyle = accent;
  context.font = 'bold 22px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(record.text, record.canvas.width / 2, record.canvas.height / 2 + 1);
  record.texture.needsUpdate = true;
}

function addSign(parent, text, x, y, z, w, h, accentIndex) {
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 128;
  signCanvas.height = 32;
  const texture = new THREE.CanvasTexture(signCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const record = { canvas: signCanvas, texture, text, accentIndex };
  signRecords.push(record);
  drawSignTexture(record);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(unitPlane, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, 1);
  parent.add(mesh);
}

function buildSupport(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a, windowDensity: density } = item;
  const mat = buildingMaterials[2 + (Math.abs(Math.floor(x)) % 3)];
  if (item.kind === 'stacked') {
    addMassWithFacade(parent, { x, y: 0, z, w: w * 1.12, h: h * 0.28, d: d * 1.08, material: buildingMaterials[3], accentIndex: a, density });
    addMassWithFacade(parent, { x: x + w * 0.08, y: h * 0.28, z, w: w * 0.78, h: h * 0.72, d: d * 0.82, material: mat, accentIndex: a, density });
  } else if (item.kind === 'tapered') {
    for (let tier = 0; tier < 3; tier++) {
      addMassWithFacade(parent, {
        x, y: tier * h / 3, z, w: w * (1 - tier * 0.16), h: h / 3 + 0.12,
        d: d * (1 - tier * 0.12), material: buildingMaterials[Math.min(4, 2 + tier)],
        accentIndex: (a + tier) % 3, density,
      });
    }
  } else if (item.kind === 'notched') {
    addMassWithFacade(parent, { x: x - w * 0.22, y: 0, z, w: w * 0.52, h, d, material: mat, accentIndex: a, density });
    addMassWithFacade(parent, { x: x + w * 0.26, y: 0, z: z + 0.4, w: w * 0.42, h: h * 0.72, d: d * 0.84, material: buildingMaterials[3], accentIndex: (a + 1) % 3, density });
  } else if (item.kind === 'podium') {
    addMassWithFacade(parent, { x, y: 0, z, w: w * 1.24, h: h * 0.22, d: d * 1.22, material: buildingMaterials[4], accentIndex: a, density });
    addMassWithFacade(parent, { x, y: h * 0.22, z: z - 0.2, w: w * 0.66, h: h * 0.78, d: d * 0.76, material: mat, accentIndex: a, density });
  } else {
    addMassWithFacade(parent, { x, y: 0, z, w, h, d, material: mat, accentIndex: a, density });
    addMass(parent, { x, y: h * 0.61, z: z + d / 2 + 0.14, w: w * 1.08, h: 0.35, d: 0.22, material: accentMaterials[a], castShadow: false });
  }
  addRoofMachinery(parent, x, h, z, w, d, a);
}

function buildMegaTwin(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a, windowDensity: density } = item;
  addMassWithFacade(parent, { x, y: 0, z, w: w * 1.25, h: h * 0.18, d: d * 1.16, material: buildingMaterials[4], accentIndex: a, density });
  [-1, 1].forEach((side, index) => {
    const towerX = x + side * w * 0.27;
    const towerH = h * (index ? 0.93 : 1);
    addMassWithFacade(parent, { x: towerX, y: h * 0.18, z, w: w * 0.39, h: towerH * 0.82, d: d * 0.78, material: buildingMaterials[3], accentIndex: (a + index) % 3, density });
    addMass(parent, { x: towerX, y: h * 0.84, z, w: w * 0.46, h: 0.65, d: d * 0.9, material: accentMaterials[(a + index) % 3] });
    addRoofMachinery(parent, towerX, h, z, w * 0.38, d * 0.7, (a + index) % 3);
  });
  addMass(parent, { x, y: h * 0.58, z: z + 0.1, w: w * 0.6, h: 3.3, d: d * 0.42, material: buildingMaterials[4] });
  addMass(parent, { x, y: h * 0.59, z: z + d * 0.24, w: w * 0.54, h: 0.38, d: 0.35, material: accentMaterials[a], castShadow: false });
  addSign(parent, 'DREE', x, h * 0.7, z + d * 0.42, w * 0.48, 3.1, a);
}

function buildSkyGate(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a, windowDensity: density } = item;
  const pylonW = w * 0.28;
  [-1, 1].forEach((side) => {
    const px = x + side * w * 0.33;
    addMassWithFacade(parent, { x: px, y: 0, z, w: pylonW, h, d, material: buildingMaterials[3], accentIndex: a, density });
    addMass(parent, { x: px, y: h, z, w: pylonW * 1.3, h: 1.2, d: d * 1.08, material: accentMaterials[a] });
  });
  addMass(parent, { x, y: h * 0.56, z, w: w * 0.7, h: 4.2, d: d * 0.62, material: buildingMaterials[4] });
  addMass(parent, { x, y: h * 0.58, z: z + d * 0.33, w: w * 0.58, h: 0.5, d: 0.3, material: accentMaterials[(a + 1) % 3], castShadow: false });
  addBeam(parent, new THREE.Vector3(x - w * 0.43, h + 1, z), new THREE.Vector3(x, h + 7, z), 0.16, accentMaterials[a]);
  addBeam(parent, new THREE.Vector3(x + w * 0.43, h + 1, z), new THREE.Vector3(x, h + 7, z), 0.16, accentMaterials[a]);
}

function buildSteppedNeedle(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a, windowDensity: density } = item;
  let y = 0;
  for (let tier = 0; tier < 4; tier++) {
    const tierH = h * (0.28 - tier * 0.025);
    addMassWithFacade(parent, {
      x: x + (tier % 2 ? w * 0.04 : 0), y, z,
      w: w * (1 - tier * 0.16), h: tierH, d: d * (1 - tier * 0.13),
      material: buildingMaterials[Math.min(4, 1 + tier)], accentIndex: (a + tier) % 3, density,
    });
    addMass(parent, { x, y: y + tierH, z: z + d * 0.34, w: w * (1.06 - tier * 0.15), h: 0.35, d: 0.24, material: accentMaterials[(a + tier) % 3], castShadow: false });
    y += tierH;
  }
  addBeam(parent, new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + 13, z), 0.14, accentMaterials[a]);
  addMass(parent, { x, y: y + 4.5, z, w: 1.8, h: 1.2, d: 1.8, material: accentMaterials[(a + 2) % 3] });
}

function buildHoloTower(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a, windowDensity: density } = item;
  addMassWithFacade(parent, { x: x - w * 0.12, y: 0, z, w: w * 0.72, h, d, material: buildingMaterials[3], accentIndex: a, density });
  addMassWithFacade(parent, { x: x + w * 0.34, y: 0, z: z + 0.7, w: w * 0.34, h: h * 0.64, d: d * 0.82, material: buildingMaterials[2], accentIndex: (a + 1) % 3, density });
  addMass(parent, { x: x - w * 0.12, y: h * 0.76, z: z + d / 2 + 0.16, w: w * 0.82, h: 0.42, d: 0.26, material: accentMaterials[a], castShadow: false });
  addSign(parent, WINDOW_LABELS[Math.abs(Math.floor(x)) % WINDOW_LABELS.length], x - w * 0.12, h * 0.62, z + d / 2 + 0.24, w * 0.68, 5.2, a);
  addRoofMachinery(parent, x - w * 0.12, h, z, w * 0.65, d, a);
}

function buildTieredTemple(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a, windowDensity: density } = item;
  const levels = 5;
  const levelH = h / levels;
  for (let level = 0; level < levels; level++) {
    const scale = 1 - level * 0.12;
    addMassWithFacade(parent, {
      x, y: level * levelH, z, w: w * scale * 0.7, h: levelH * 0.78,
      d: d * scale * 0.72, material: buildingMaterials[Math.min(4, 1 + level)],
      accentIndex: (a + level) % 3, density: density * 0.8,
    });
    addMass(parent, {
      x, y: level * levelH + levelH * 0.72, z,
      w: w * scale, h: levelH * 0.16, d: d * scale,
      material: accentMaterials[(a + level) % 3],
    });
  }
  addBeam(parent, new THREE.Vector3(x, h, z), new THREE.Vector3(x, h + 8, z), 0.12, accentMaterials[a]);
}

function buildLattice(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a } = item;
  const x0 = x - w * 0.35;
  const x1 = x + w * 0.35;
  const z0 = z - d * 0.34;
  const z1 = z + d * 0.34;
  [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([px, pz]) => {
    addMass(parent, { x: px, y: 0, z: pz, w: 1.3, h, d: 1.3, material: buildingMaterials[4] });
  });
  for (let level = 0; level <= 6; level++) {
    const y = level * h / 6;
    addBeam(parent, new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y, z1), 0.16, accentMaterials[(a + level) % 3]);
    if (level < 6) {
      addBeam(parent, new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y + h / 6, z1), 0.13, buildingMaterials[4]);
      addBeam(parent, new THREE.Vector3(x1, y, z1), new THREE.Vector3(x0, y + h / 6, z1), 0.13, buildingMaterials[4]);
    }
  }
  addMass(parent, { x, y: h * 0.42, z, w: w * 0.48, h: h * 0.42, d: d * 0.5, material: buildingMaterials[2] });
  addSign(parent, 'CMU', x, h * 0.64, z + d * 0.28, w * 0.4, 3.8, a);
}

function buildCrownTower(parent, item) {
  const { x, z, width: w, depth: d, height: h, accentIndex: a, windowDensity: density } = item;
  addMassWithFacade(parent, { x, y: 0, z, w: w * 0.78, h: h * 0.86, d, material: buildingMaterials[3], accentIndex: a, density });
  addMassWithFacade(parent, { x: x - w * 0.43, y: 0, z: z + 0.6, w: w * 0.22, h: h * 0.55, d: d * 0.72, material: buildingMaterials[2], accentIndex: (a + 1) % 3, density });
  addMassWithFacade(parent, { x: x + w * 0.43, y: 0, z: z + 0.6, w: w * 0.22, h: h * 0.65, d: d * 0.72, material: buildingMaterials[2], accentIndex: (a + 2) % 3, density });
  for (let prong = -2; prong <= 2; prong++) {
    addMass(parent, {
      x: x + prong * w * 0.12, y: h * 0.86, z,
      w: w * 0.075, h: 4 + (2 - Math.abs(prong)) * 1.6, d: d * 0.52,
      material: accentMaterials[(a + Math.abs(prong)) % 3],
    });
  }
  addBeam(parent, new THREE.Vector3(x, h * 0.94, z), new THREE.Vector3(x, h + 10, z), 0.12, accentMaterials[a]);
}

const landmarkBuilders = {
  megaTwin: buildMegaTwin,
  skyGate: buildSkyGate,
  steppedNeedle: buildSteppedNeedle,
  holoTower: buildHoloTower,
  tieredTemple: buildTieredTemple,
  lattice: buildLattice,
  crownTower: buildCrownTower,
};

function finishWindows(parent) {
  windowMatrices.forEach((matrices, accentIndex) => {
    if (!matrices.length) return;
    const mesh = new THREE.InstancedMesh(unitBox, windowMaterials[accentIndex], matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    parent.add(mesh);
  });
}

function buildRoad(parent, road) {
  const col = palette.col;
  // The road is one period wide and lives inside the tiled/scrolling city group,
  // so it slides along with the buildings and wraps seamlessly. It sits in the
  // clear lane between the front strip and the strips behind it.
  const laneMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(col.streetDark).lerp(new THREE.Color(col.bld4), 0.45),
    roughness: 0.5,
    metalness: 0.5,
    transparent: true,
    opacity: 0.95,
  });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(road.period, road.depth), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, -0.28, road.z);
  lane.receiveShadow = true;
  parent.add(lane);

  // Center dashes — the primary motion cue now that the road scrolls. The dash
  // spacing divides the period evenly so the markings tile seamlessly on wrap.
  const dashCount = 20;
  const dashSpacing = road.period / dashCount;
  for (let i = 0; i < dashCount; i++) {
    const x = -road.period / 2 + (i + 0.5) * dashSpacing;
    addMass(parent, {
      x, y: -0.02, z: road.z, w: 3.6, h: 0.06, d: 0.5,
      material: accentMaterials[i % 3], castShadow: false,
    });
  }

  // Glowing edge lines along the front and back of the lane.
  [road.z - road.depth / 2 + 0.45, road.z + road.depth / 2 - 0.45].forEach((edgeZ, index) => {
    addMass(parent, {
      x: 0, y: -0.02, z: edgeZ, w: road.period, h: 0.05, d: 0.16,
      material: accentMaterials[index === 0 ? 0 : 1], castShadow: false,
    });
  });
}

function buildCity() {
  const layout = createCityLayout(seed);
  const baseCity = new THREE.Group();
  layout.landmarks.forEach((item) => landmarkBuilders[item.kind](baseCity, item));
  layout.supporting.forEach((item) => buildSupport(baseCity, item));
  finishWindows(baseCity);
  buildRoad(baseCity, layout.road);

  cityRoot = new THREE.Group();
  [-WORLD_WIDTH, 0, WORLD_WIDTH].forEach((offset, index) => {
    const copy = index === 1 ? baseCity : baseCity.clone(true);
    copy.position.x = offset;
    cityRoot.add(copy);
  });
  scene.add(cityRoot);
}

function buildGround() {
  // Static dark floor spanning every strip from the front row to the far
  // background. The road lane + markings (which convey motion) live in the
  // scrolling city group instead.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_WIDTH * 3, 180),
    new THREE.MeshStandardMaterial({
      color: palette.col.streetDark,
      roughness: 0.48,
      metalness: 0.42,
      transparent: true,
      opacity: 0.92,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.4, -6);
  ground.receiveShadow = true;
  scene.add(ground);
}

const FLYER_BOUND = WORLD_WIDTH * 0.62;

function addFlyerPart(group, geometry, material, opts) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
  mesh.scale.set(opts.sx || 1, opts.sy || 1, opts.sz || 1);
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  mesh.castShadow = false;
  group.add(mesh);
  return mesh;
}

// 3D flying traffic: airships, drones and streaking flying cars. They drift on
// their own velocity (independent of the building scroll) so the sky always
// feels alive, even when the speed slider freezes the buildings.
function buildFlyers() {
  flyers = [];
  flyersGroup = new THREE.Group();
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const rand = (min, max) => min + (max - min) * rng();
  const TAU = Math.PI * 2;

  // --- Airships: big, slow, branded ---
  const airshipDefs = [
    { sign: 'KAI-CORP', accent: 1, baseY: 58, z: -4, vx: 0.06 },
    { sign: 'SYS//07', accent: 0, baseY: 67, z: 12, vx: -0.045 },
    { sign: 'CMU-LIFT', accent: 2, baseY: 49, z: -22, vx: 0.034 },
  ];
  airshipDefs.forEach((def) => {
    const group = new THREE.Group();
    const len = rand(17, 24);
    const rad = rand(3.4, 4.6);
    addFlyerPart(group, unitSphere, buildingMaterials[3], { sx: len, sy: rad, sz: rad });
    addFlyerPart(group, unitSphere, accentMaterials[def.accent], { x: len * 0.42, sx: rad * 0.5, sy: rad * 0.5, sz: rad * 0.5 });
    addFlyerPart(group, unitBox, buildingMaterials[1], { y: -rad * 0.9, sx: len * 0.3, sy: rad * 0.45, sz: rad * 0.55 });
    addFlyerPart(group, unitBox, accentMaterials[def.accent], { y: -rad * 0.55, sx: len * 0.66, sy: 0.28, sz: rad * 0.6 });
    addSign(group, def.sign, 0, 0, rad + 0.25, len * 0.5, rad * 1.1, def.accent);
    const x = rand(-FLYER_BOUND, FLYER_BOUND);
    group.position.set(x, def.baseY, def.z);
    flyersGroup.add(group);
    flyers.push({
      mesh: group, x, z: def.z, baseY: def.baseY, vx: def.vx,
      bobSpeed: rand(0.3, 0.5), bobPhase: rand(0, TAU), bobAmp: rand(0.8, 1.6),
    });
  });

  // --- Drones / droids: small bobbing orbs and boxes ---
  for (let i = 0; i < 12; i++) {
    const group = new THREE.Group();
    const accent = i % 3;
    const orb = rng() < 0.5;
    addFlyerPart(group, orb ? unitSphere : unitBox, buildingMaterials[2], {
      sx: orb ? 2 : 2.3, sy: orb ? 2 : 1.5, sz: orb ? 2 : 2.3,
    });
    addFlyerPart(group, unitBox, accentMaterials[accent], { z: orb ? 1.05 : 1.2, sx: 0.8, sy: 0.4, sz: 0.4 });
    const baseY = rand(34, 72);
    const z = rand(-28, 14);
    const x = rand(-FLYER_BOUND, FLYER_BOUND);
    group.position.set(x, baseY, z);
    flyersGroup.add(group);
    flyers.push({
      mesh: group, x, z, baseY, vx: (rng() < 0.5 ? -1 : 1) * rand(0.03, 0.09),
      bobSpeed: rand(0.6, 1.1), bobPhase: rand(0, TAU), bobAmp: rand(1.2, 2.4),
      spin: orb ? 0 : (rng() < 0.5 ? -1 : 1) * 0.04,
    });
  }

  // --- Flying cars: fast, with a fading trail ---
  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group();
    const accent = i % 3;
    const dir = rng() < 0.5 ? 1 : -1;
    addFlyerPart(group, unitBox, accentMaterials[accent], { sx: rand(2.2, 3.4), sy: 0.7, sz: 1.0 });
    const trail = addFlyerPart(group, unitBox, windowMaterials[accent], { sx: rand(4, 7), sy: 0.34, sz: 0.5 });
    const trailOffset = rand(3, 5);
    trail.position.x = -dir * trailOffset;
    const baseY = rand(28, 64);
    const z = rand(-26, 16);
    const x = rand(-FLYER_BOUND, FLYER_BOUND);
    group.position.set(x, baseY, z);
    flyersGroup.add(group);
    flyers.push({
      mesh: group, x, z, baseY, vx: dir * rand(0.35, 0.7),
      bobSpeed: rand(0.4, 0.8), bobPhase: rand(0, TAU), bobAmp: rand(0.4, 0.9),
      trail, trailOffset, dir,
    });
  }

  scene.add(flyersGroup);
}

function updateFlyers(delta) {
  if (!flyersGroup || flyers.length === 0) return;
  const step = delta * 60;
  const span = FLYER_BOUND * 2;
  for (let i = 0; i < flyers.length; i++) {
    const flyer = flyers[i];
    if (!reducedMotion) {
      flyer.x += flyer.vx * step;
      if (flyer.x > FLYER_BOUND) flyer.x -= span;
      else if (flyer.x < -FLYER_BOUND) flyer.x += span;
    }
    const bobY = reducedMotion ? 0 : Math.sin(elapsed * flyer.bobSpeed + flyer.bobPhase) * flyer.bobAmp;
    flyer.mesh.position.set(flyer.x, flyer.baseY + bobY, flyer.z);
    if (flyer.spin && !reducedMotion) flyer.mesh.rotation.y += flyer.spin * step;
    if (flyer.trail) {
      const direction = Math.sign(flyer.vx) || flyer.dir;
      flyer.trail.position.x = -direction * flyer.trailOffset;
    }
  }
}

function buildPostProcess() {
  postScene = new THREE.Scene();
  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tDiffuse: { value: renderTarget.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uHorizon: { value: 0.205 },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(palette.col.cyan) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uHorizon;
      uniform float uTime;
      uniform vec3 uTint;
      varying vec2 vUv;

      float bayer4(vec2 pixel) {
        vec2 p = mod(floor(pixel), 4.0);
        float x = p.x;
        float y = p.y;
        if (y < 1.0) {
          if (x < 1.0) return 0.0;
          if (x < 2.0) return 8.0;
          if (x < 3.0) return 2.0;
          return 10.0;
        }
        if (y < 2.0) {
          if (x < 1.0) return 12.0;
          if (x < 2.0) return 4.0;
          if (x < 3.0) return 14.0;
          return 6.0;
        }
        if (y < 3.0) {
          if (x < 1.0) return 3.0;
          if (x < 2.0) return 11.0;
          if (x < 3.0) return 1.0;
          return 9.0;
        }
        if (x < 1.0) return 15.0;
        if (x < 2.0) return 7.0;
        if (x < 3.0) return 13.0;
        return 5.0;
      }

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        if (vUv.y < uHorizon) {
          float distanceToHorizon = uHorizon - vUv.y;
          float ripple = sin(vUv.y * uResolution.y * 0.32 + uTime * 1.7) / uResolution.x;
          vec2 reflectedUv = vec2(vUv.x + ripple * 3.0, uHorizon + distanceToHorizon * 0.72);
          vec4 reflection = texture2D(tDiffuse, reflectedUv);
          float fade = smoothstep(0.0, uHorizon, vUv.y) * 0.46;
          vec3 reflected = reflection.rgb * mix(vec3(0.14), uTint * 0.42, 0.35) * fade;
          color.rgb = max(color.rgb, reflected);
          color.a = max(color.a, reflection.a * fade * 0.54);
        }
        color.rgb = pow(max(color.rgb, vec3(0.0)), vec3(0.82));
        float threshold = (bayer4(gl_FragCoord.xy) / 16.0 - 0.5) / 24.0;
        color.rgb = floor(clamp(color.rgb + threshold, 0.0, 1.0) * 24.0) / 24.0;
        gl_FragColor = color;
      }
    `,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
  postScene.add(quad);
}

function resize() {
  if (!renderer || !camera || !renderTarget || disposed) return;
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const aspect = width / height;
  const quality = width < 600 ? 1 : 0.82;
  const renderWidth = Math.max(390, Math.min(1440, Math.round(width * quality)));
  const renderHeight = Math.max(320, Math.min(960, Math.round(height * quality)));
  renderer.setSize(renderWidth, renderHeight, false);
  renderer.setPixelRatio(1);
  renderTarget.setSize(renderWidth, renderHeight);
  camera.left = -VIEW_HEIGHT * aspect / 2;
  camera.right = VIEW_HEIGHT * aspect / 2;
  camera.top = VIEW_HEIGHT / 2;
  camera.bottom = -VIEW_HEIGHT / 2;
  camera.updateProjectionMatrix();
  postMaterial.uniforms.uResolution.value.set(renderWidth, renderHeight);
}

function updateEnvironment() {
  const environment = window.CityEnvironment;
  const solar = environment && typeof environment.getLocalSolar === 'function'
    ? environment.getLocalSolar()
    : { starVisibility: 1, sun: { show: false } };
  const weather = environment && typeof environment.getWeather === 'function'
    ? environment.getWeather()
    : { fog: 0.08, rain: 0 };
  const night = Math.max(0, Math.min(1, solar.starVisibility ?? 1));
  ambientLight.intensity = 0.48 + night * 0.42;
  directionalLight.intensity = 1.1 - night * 0.35;
  scene.fog.density = 0.006 + Math.max(0, weather.fog || 0) * 0.018 + Math.max(0, weather.rain || 0) * 0.004;
}

function renderFrame(now) {
  if (disposed) return;
  animationFrame = requestAnimationFrame(renderFrame);
  if (document.hidden) {
    lastFrame = now;
    return;
  }
  frameCount++;
  if (frameCount % 60 === 0) canvas.dataset.frames = String(frameCount);
  const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  elapsed += delta;
  // Accumulate scroll distance so changing speed (or freezing it to 0 while the
  // slider is dragged) never teleports the city — it just pauses and resumes.
  if (!reducedMotion) scrollDistance += delta * speed * 1.45;
  cityRoot.position.x = -(scrollDistance % WORLD_WIDTH);
  updateFlyers(delta);

  if (!reducedMotion) {
    pointerX += (pointerTargetX - pointerX) * 0.04;
    pointerY += (pointerTargetY - pointerY) * 0.04;
  }
  camera.position.x = 40 + pointerX * 3.2;
  camera.position.y = 56 + pointerY * 1.7;
  camera.lookAt(pointerX * 1.2, 23 + pointerY * 0.8, 0);

  updateEnvironment();
  accentMaterials.forEach((material, index) => {
    material.emissiveIntensity = reducedMotion
      ? 1.35
      : 1.25 + Math.sin(elapsed * (0.9 + index * 0.16) + index * 2.1) * 0.28;
  });
  windowMaterials.forEach((material, index) => {
    material.opacity = reducedMotion
      ? 0.9
      : 0.83 + Math.sin(elapsed * 0.7 + index * 1.9) * 0.11;
  });
  postMaterial.uniforms.uTime.value = elapsed;

  renderer.setRenderTarget(renderTarget);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(postScene, postCamera);
}

function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(animationFrame);
  window.removeEventListener('resize', resize);
  const geometries = new Set();
  const materials = new Set();
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
      else if (object.material) materials.add(object.material);
    });
  }
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => {
    if (material.map) material.map.dispose();
    material.dispose();
  });
  if (postMaterial) postMaterial.dispose();
  if (renderTarget) renderTarget.dispose();
  if (renderer) renderer.dispose();
  dispatchReady(false, { disposed: true });
}

async function init() {
  if (!canvas || params.get('cityRenderer') === '2d') {
    dispatchReady(false, { forced: params.get('cityRenderer') === '2d' });
    return;
  }

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;

  scene = new THREE.Scene();
  palette = getPalette();
  scene.fog = new THREE.FogExp2(palette.col.bld1, 0.008);
  camera = new THREE.OrthographicCamera(-70, 70, 41, -41, 0.1, 420);
  camera.position.set(40, 56, 116);
  camera.lookAt(0, 23, 0);

  ambientLight = new THREE.HemisphereLight(palette.col.wht, palette.col.bld1, 0.8);
  scene.add(ambientLight);
  directionalLight = new THREE.DirectionalLight('#d8f6ff', 0.9);
  directionalLight.position.set(-68, 96, 82);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 90;
  directionalLight.shadow.camera.bottom = -15;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 240;
  directionalLight.shadow.bias = -0.0008;
  scene.add(directionalLight);

  makeMaterials();
  buildCity();
  buildGround();
  buildFlyers();
  renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
  renderTarget.texture.generateMipmaps = false;
  buildPostProcess();

  const speedInput = document.getElementById('city-speed');
  if (speedInput) api.setSpeed(speedInput.value);
  applyTheme(currentTheme);
  resize();

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (event) => {
    pointerTargetX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    pointerTargetY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * -2;
  }, { passive: true });
  window.addEventListener('city-speed', (event) => {
    if (event.detail) api.setSpeed(event.detail.speed);
  });
  window.addEventListener('phosphor-theme', (event) => {
    if (event.detail && event.detail.theme) applyTheme(event.detail.theme);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    dispatchReady(false, { contextLost: true });
  });

  dispatchReady(true);
  canvas.dataset.frames = '0';
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(renderFrame);
}

init().catch((error) => {
  console.error('[City3D] WebGL renderer unavailable, using Canvas 2D fallback.', error);
  dispatchReady(false, { error: error.message });
});
