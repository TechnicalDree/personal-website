import * as THREE from './vendor/three.module.min.js';
import { createCityLayout, parseCitySeed, createRng } from './city-3d-layout.js?v=20260624b';
import { createGroundAgents, wrapX, AGENT_BOUND, AVENUE } from './city-3d-agents.js?v=20260626b';

const canvas = document.getElementById('bg-city3d');
const params = new URLSearchParams(window.location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORLD_WIDTH = 180;
const VIEW_HEIGHT = 82;
const WINDOW_LABELS = ['CMU', 'MUNOZ', 'DREE', 'NOVA', 'BYTE', 'ORBIT', 'AETHER'];

// Random big-tech name for a building sign (falls back if the list isn't loaded).
function pickSign() {
  if (typeof window !== 'undefined' && typeof window.randomTechCompany === 'function') {
    return window.randomTechCompany();
  }
  return WINDOW_LABELS[(Math.random() * WINDOW_LABELS.length) | 0];
}

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
let groundAgents = null;
let groundGroup = null;
let pedestrianBodies = null;
let pedestrianHeads = null;
let pedestrianHeadMaterial = null;
let pedestrianState = [];
let robotState = [];
let vehicleState = [];
let headlightMaterial = null;
let taillightMaterial = null;
// Dark road/ground surface materials whose colour is baked from the palette at build
// time; recolored together on theme change. Each entry: { material, mix } where mix is
// the lerp amount from streetDark toward bld4.
let groundSurfaceMaterials = [];
// Weather (off by default). One InstancedMesh of streaks shared by rain/snow/wind;
// fog is a fog-density boost (no particles). See WEATHER below.
let weatherMode = 'none';
let weatherGroup = null;
let weatherMesh = null;
let weatherMaterial = null;
let weatherParticles = [];
let weatherCountScale = 1;
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
  setWeather(mode) {
    setWeather(mode);
  },
  get weather() {
    return weatherMode;
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

// Current hex for an accent slot (cyan / magenta / yellow), used to tint the
// per-instance pedestrian heads from the active palette.
function accentHex(index) {
  const col = palette.col;
  return [col.cyan, col.mag, col.yel][index] || col.cyan;
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
  recolorPedestrianHeads();
  groundSurfaceMaterials.forEach(({ material, mix }) => {
    material.color.copy(new THREE.Color(col.streetDark).lerp(new THREE.Color(col.bld4), mix));
  });
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
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  // Shrink the font until the label fits the sign (tech names vary in length).
  const maxTextWidth = record.canvas.width - 14;
  let fontSize = 22;
  do {
    context.font = `bold ${fontSize}px monospace`;
    if (context.measureText(record.text).width <= maxTextWidth) break;
    fontSize -= 1;
  } while (fontSize > 10);
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
  addSign(parent, pickSign(), x, h * 0.7, z + d * 0.42, w * 0.48, 3.1, a);
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
  addSign(parent, pickSign(), x - w * 0.12, h * 0.62, z + d / 2 + 0.24, w * 0.68, 5.2, a);
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
  addSign(parent, pickSign(), x, h * 0.64, z + d * 0.28, w * 0.4, 3.8, a);
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
  groundSurfaceMaterials.push({ material: laneMat, mix: 0.45 });
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
  //
  // The plane is asymmetric on purpose: the near edge runs well forward (z=+84)
  // so it covers the foreground and slides off the bottom of the frame, while
  // the far edge sits just behind the farthest building row (z=-120, ~8 units
  // past the z=-112 row). Because the camera is orthographic and tilted down,
  // the ground's far edge projects HIGH in the frame; if it extends much past
  // the buildings it paints over the starfield sky. Depth 204 centered at
  // z=-18 keeps near=+84 / far=-120 — tight behind the deepest row.
  const groundMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.col.streetDark),
    roughness: 0.48,
    metalness: 0.42,
    transparent: true,
    opacity: 0.92,
  });
  groundSurfaceMaterials.push({ material: groundMat, mix: 0 });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_WIDTH * 3, 204),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.4, -18);
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

  // --- Airships: big, slow, branded with tech-company names (same list
  // as the building signs); pick distinct names so no two ships repeat. ---
  const usedSigns = new Set();
  const pickDistinctSign = () => {
    let s = pickSign();
    for (let tries = 0; tries < 8 && usedSigns.has(s); tries++) s = pickSign();
    usedSigns.add(s);
    return s;
  };
  const airshipDefs = [
    { sign: pickDistinctSign(), accent: 1, baseY: 58, z: -4, vx: 0.06 },
    { sign: pickDistinctSign(), accent: 0, baseY: 67, z: 12, vx: -0.045 },
    { sign: pickDistinctSign(), accent: 2, baseY: 49, z: -22, vx: 0.034 },
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

// --- Ground life: pedestrians, robots and two-way traffic. ---
// Like the flyers, ground agents live in their own group (NOT the 3×-tiled city),
// drift on their own velocity independent of the speed slider, and wrap at
// AGENT_BOUND so the street always feels busy. Spawn definitions come from the
// pure, seeded city-3d-agents module so the layout is deterministic + testable.

// Pedestrians are instanced (a dark body box + a glowing accent head) so a packed
// crowd stays cheap; their per-instance head colour is re-tinted on theme change.
function buildPedestrians(list) {
  pedestrianState = [];
  if (!list.length) return;
  pedestrianHeadMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  pedestrianBodies = new THREE.InstancedMesh(unitBox, buildingMaterials[1], list.length);
  pedestrianHeads = new THREE.InstancedMesh(unitBox, pedestrianHeadMaterial, list.length);
  pedestrianBodies.castShadow = false;
  pedestrianBodies.frustumCulled = false;
  pedestrianHeads.frustumCulled = false;
  pedestrianHeads.renderOrder = 3;
  const color = new THREE.Color();
  list.forEach((p, i) => {
    const bodyW = p.height * 0.3;
    const bodyH = p.height * 0.72;
    const bodyD = p.height * 0.26;
    const headSize = p.height * 0.26;
    const state = {
      x: p.x, z: p.z, vx: p.vx, accentIndex: p.accentIndex,
      bodyW, bodyH, bodyD, headSize,
      bodyBaseY: bodyH * 0.5,
      headBaseY: bodyH + headSize * 0.45,
      bobSpeed: p.bobSpeed, bobPhase: p.bobPhase, bobAmp: p.bobAmp,
      index: i,
    };
    pedestrianState.push(state);
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(p.x, state.bodyBaseY, p.z);
    dummy.scale.set(bodyW, bodyH, bodyD);
    dummy.updateMatrix();
    pedestrianBodies.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, state.headBaseY, p.z);
    dummy.scale.set(headSize, headSize, headSize);
    dummy.updateMatrix();
    pedestrianHeads.setMatrixAt(i, dummy.matrix);
    pedestrianHeads.setColorAt(i, color.set(accentHex(p.accentIndex)));
  });
  pedestrianBodies.instanceMatrix.needsUpdate = true;
  pedestrianHeads.instanceMatrix.needsUpdate = true;
  if (pedestrianHeads.instanceColor) pedestrianHeads.instanceColor.needsUpdate = true;
  groundGroup.add(pedestrianBodies);
  groundGroup.add(pedestrianHeads);
}

function recolorPedestrianHeads() {
  if (!pedestrianHeads) return;
  const color = new THREE.Color();
  pedestrianState.forEach((p) => {
    pedestrianHeads.setColorAt(p.index, color.set(accentHex(p.accentIndex)));
  });
  if (pedestrianHeads.instanceColor) pedestrianHeads.instanceColor.needsUpdate = true;
}

function buildRobot(group, r) {
  const bodyMat = buildingMaterials[2];
  const accent = accentMaterials[r.accentIndex];
  const H = r.height;
  if (r.kind === 'wheeled') {
    const bodyH = H * 0.6;
    addFlyerPart(group, unitBox, bodyMat, { y: bodyH * 0.5, sx: H * 0.5, sy: bodyH, sz: H * 0.42 });
    addFlyerPart(group, unitSphere, bodyMat, { y: bodyH + H * 0.12, sx: H * 0.34, sy: H * 0.3, sz: H * 0.34 });
    addFlyerPart(group, unitBox, accent, { y: bodyH + H * 0.12, z: H * 0.2, sx: H * 0.16, sy: H * 0.1, sz: 0.12 });
    addFlyerPart(group, unitBox, accent, { y: bodyH + H * 0.32, sx: 0.08, sy: H * 0.18, sz: 0.08 });
    addFlyerPart(group, unitSphere, accent, { y: bodyH + H * 0.46, sx: 0.24, sy: 0.24, sz: 0.24 });
  } else {
    const legH = H * 0.28;
    const bodyH = H * 0.5;
    addFlyerPart(group, unitBox, bodyMat, { x: -H * 0.1, y: legH * 0.5, sx: H * 0.12, sy: legH, sz: H * 0.14 });
    addFlyerPart(group, unitBox, bodyMat, { x: H * 0.1, y: legH * 0.5, sx: H * 0.12, sy: legH, sz: H * 0.14 });
    addFlyerPart(group, unitBox, bodyMat, { y: legH + bodyH * 0.5, sx: H * 0.34, sy: bodyH, sz: H * 0.3 });
    addFlyerPart(group, unitBox, bodyMat, { y: legH + bodyH + H * 0.1, sx: H * 0.26, sy: H * 0.2, sz: H * 0.26 });
    addFlyerPart(group, unitBox, accent, { y: legH + bodyH + H * 0.1, z: H * 0.15, sx: H * 0.18, sy: H * 0.06, sz: 0.12 });
    addFlyerPart(group, unitBox, accent, { y: legH + bodyH * 0.55, z: H * 0.16, sx: H * 0.08, sy: bodyH * 0.5, sz: 0.08 });
  }
}

function buildRobots(list) {
  robotState = [];
  list.forEach((r) => {
    const group = new THREE.Group();
    buildRobot(group, r);
    group.position.set(r.x, 0, r.z);
    groundGroup.add(group);
    robotState.push({
      mesh: group, x: r.x, z: r.z, vx: r.vx,
      bobSpeed: r.bobSpeed, bobPhase: r.bobPhase, bobAmp: r.bobAmp,
    });
  });
}

// Built in local space facing its travel direction (dir = +1 or -1): headlights on
// the leading end, taillights on the trailing end, glowing windows + bus sign on the
// camera-facing (+z) side so they read regardless of which way the vehicle drives.
function buildVehicle(group, v, dir) {
  const L = v.length;
  const W = v.width;
  const H = v.height;
  const a = v.accentIndex;
  const chassisMat = v.kind === 'bus' ? buildingMaterials[4]
    : v.kind === 'truck' ? buildingMaterials[3]
      : buildingMaterials[2];
  addFlyerPart(group, unitBox, chassisMat, { y: H * 0.32, sx: L, sy: H * 0.5, sz: W });
  if (v.kind === 'sedan') {
    addFlyerPart(group, unitBox, chassisMat, { x: -dir * L * 0.06, y: H * 0.72, sx: L * 0.52, sy: H * 0.42, sz: W * 0.9 });
  } else if (v.kind === 'truck') {
    addFlyerPart(group, unitBox, chassisMat, { x: dir * L * 0.3, y: H * 0.74, sx: L * 0.3, sy: H * 0.5, sz: W * 0.94 });
    addFlyerPart(group, unitBox, buildingMaterials[2], { x: -dir * L * 0.18, y: H * 0.78, sx: L * 0.58, sy: H * 0.6, sz: W * 0.98 });
  } else {
    addFlyerPart(group, unitBox, chassisMat, { y: H * 0.74, sx: L * 0.94, sy: H * 0.5, sz: W * 0.95 });
  }
  const winLen = v.kind === 'sedan' ? L * 0.46 : L * 0.8;
  const winY = v.kind === 'sedan' ? H * 0.74 : H * 0.72;
  [W * 0.5 + 0.05, -W * 0.5 - 0.05].forEach((zo) => {
    addFlyerPart(group, unitBox, windowMaterials[a], { x: dir * L * 0.02, y: winY, z: zo, sx: winLen, sy: H * 0.2, sz: 0.06 });
  });
  [W * 0.32, -W * 0.32].forEach((zo) => {
    addFlyerPart(group, unitBox, headlightMaterial, { x: dir * L * 0.5, y: H * 0.3, z: zo, sx: 0.3, sy: 0.28, sz: 0.3 });
    addFlyerPart(group, unitBox, taillightMaterial, { x: -dir * L * 0.5, y: H * 0.32, z: zo, sx: 0.22, sy: 0.26, sz: 0.28 });
  });
  if (v.kind === 'bus') {
    addSign(group, pickSign(), dir * L * 0.12, H * 0.74, W * 0.5 + 0.12, L * 0.4, H * 0.4, a);
  }
  if (v.hasTrail) {
    const trailLen = L * 1.5;
    addFlyerPart(group, unitBox, windowMaterials[a], { x: -dir * (L * 0.5 + trailLen * 0.5), y: H * 0.34, sx: trailLen, sy: 0.28, sz: 0.4 });
  }
}

function buildVehicles(list) {
  vehicleState = [];
  headlightMaterial = headlightMaterial || new THREE.MeshBasicMaterial({ color: 0xfff2cc, toneMapped: false });
  taillightMaterial = taillightMaterial || new THREE.MeshBasicMaterial({ color: 0xff2b3d, toneMapped: false });
  list.forEach((v) => {
    const group = new THREE.Group();
    const dir = Math.sign(v.vx) || 1;
    buildVehicle(group, v, dir);
    group.position.set(v.x, 0, v.z);
    groundGroup.add(group);
    vehicleState.push({ mesh: group, x: v.x, z: v.z, vx: v.vx });
  });
}

// The foreground avenue surface the traffic drives on: a faintly lit pavement
// strip with glowing curb lines and centre dashes. Static (the cars provide the
// motion), spanning the full agent-wrap width.
function buildAvenue() {
  const col = palette.col;
  const width = AGENT_BOUND * 2 + 40;
  const laneMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(col.streetDark).lerp(new THREE.Color(col.bld4), 0.5),
    roughness: 0.5,
    metalness: 0.5,
    transparent: true,
    opacity: 0.95,
  });
  groundSurfaceMaterials.push({ material: laneMat, mix: 0.5 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(width, AVENUE.depth), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, -0.32, AVENUE.z);
  lane.receiveShadow = true;
  groundGroup.add(lane);
  [AVENUE.z - AVENUE.depth / 2, AVENUE.z + AVENUE.depth / 2].forEach((edgeZ, index) => {
    addMass(groundGroup, {
      x: 0, y: -0.02, z: edgeZ, w: width, h: 0.05, d: 0.22,
      material: accentMaterials[index === 0 ? 0 : 1], castShadow: false,
    });
  });
  // Centre dashes, instanced per accent material (one draw call each), like finishWindows.
  const dashCount = Math.round(width / 6);
  const dashSpacing = width / dashCount;
  const dashMatrices = [[], [], []];
  for (let i = 0; i < dashCount; i++) {
    const x = -width / 2 + (i + 0.5) * dashSpacing;
    dummy.position.set(x, -0.02, AVENUE.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(3.4, 0.05, 0.42);
    dummy.updateMatrix();
    dashMatrices[i % 3].push(dummy.matrix.clone());
  }
  dashMatrices.forEach((matrices, accentIndex) => {
    if (!matrices.length) return;
    const mesh = new THREE.InstancedMesh(unitBox, accentMaterials[accentIndex], matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    groundGroup.add(mesh);
  });
}

// A low-poly NYC-style subway entrance, built as a clear foreground landmark: a railed
// stairwell with neon steps, two tall posts with big glowing globes (cyan + magenta,
// like real station lamps) rising above the crowd, and an overhead SUBWAY marquee.
function buildSubwayEntrance(x, z, accentIndex) {
  const rim = buildingMaterials[3];
  const dark = buildingMaterials[1];
  const accent = accentMaterials[accentIndex];
  const W = 6;
  const D = 4.2;
  const wallH = 0.8;
  const backZ = z - D / 2 + 0.25;
  const frontZ = z + D / 2 - 0.25;
  // Recessed dark opening + neon step ledges descending toward the back.
  addMass(groundGroup, { x, y: 0.05, z, w: W - 0.8, h: 0.1, d: D - 0.8, material: dark, castShadow: false });
  for (let i = 0; i < 4; i++) {
    addMass(groundGroup, {
      x, y: 0.08, z: z + D * 0.2 - i * 0.5, w: W - 1.6, h: 0.05, d: 0.2,
      material: accentMaterials[i % 3], castShadow: false,
    });
  }
  // Curb walls on three sides (front open toward the camera) with neon caps.
  addMass(groundGroup, { x, y: 0, z: backZ, w: W, h: wallH, d: 0.4, material: rim });
  [-1, 1].forEach((side) => {
    const wx = x + side * (W / 2 - 0.2);
    addMass(groundGroup, { x: wx, y: 0, z, w: 0.4, h: wallH, d: D, material: rim });
    addMass(groundGroup, { x: wx, y: wallH, z, w: 0.46, h: 0.1, d: D, material: accent, castShadow: false });
  });
  // Handrail along the open front edge.
  addBeam(groundGroup,
    new THREE.Vector3(x - W / 2 + 0.25, wallH, frontZ),
    new THREE.Vector3(x + W / 2 - 0.25, wallH, frontZ),
    0.07, accent);
  // Two tall posts with big glowing globes (cyan + magenta) at the front corners.
  [[-1, 0], [1, 1]].forEach(([side, lampAccent]) => {
    const px = x + side * (W / 2 - 0.25);
    addBeam(groundGroup, new THREE.Vector3(px, 0, frontZ), new THREE.Vector3(px, 3.2, frontZ), 0.1, rim);
    addFlyerPart(groundGroup, unitSphere, accentMaterials[lampAccent], { x: px, y: 3.5, z: frontZ, sx: 0.95, sy: 0.95, sz: 0.95 });
  });
  // Overhead SUBWAY marquee on a frame above the entrance, facing the camera.
  const signY = wallH + 2.5;
  [-1, 1].forEach((side) => {
    const px = x + side * (W * 0.42);
    addBeam(groundGroup, new THREE.Vector3(px, wallH, backZ + 0.05), new THREE.Vector3(px, signY + 0.85, backZ + 0.05), 0.09, rim);
  });
  addSign(groundGroup, 'SUBWAY', x, signY, backZ + 0.1, W * 0.92, 1.5, accentIndex);
}

// --- Weather (off by default) ---
const WTAU = Math.PI * 2;
// Particle volume, sized to the visible frame so particles aren't wasted off-screen.
// Streaks are sized in WORLD units; the camera shows ~9px per unit, so they must be
// chunky (a 0.06-unit streak is sub-pixel and invisible).
const WEATHER_HALF_W = 95; // half-width (wrap bound)
const WEATHER_TOP = 92; // particles fall from here to y=0, then recycle
const WEATHER_Z_MIN = 20; // foreground-to-mid slab (in front of / among nearer buildings)
const WEATHER_Z_MAX = 76;
const WEATHER_CAPACITY = 1400; // max instances (rain uses the most); one InstancedMesh
const WEATHER = {
  none: { count: 0, fog: 0 },
  // vy: fall speed, vx: horizontal drift, sway: lateral wobble amplitude,
  // sx/sy/sz: per-instance streak scale (world units), color/opacity: look, fog: density.
  rain: { count: 1400, vy: 72, vx: -11, sway: 0, sx: 0.28, sy: 2.6, sz: 0.28, color: 0xbef2ff, opacity: 0.6, fog: 0.002 },
  snow: { count: 700, vy: 11, vx: -2, sway: 2.0, sx: 0.55, sy: 0.55, sz: 0.55, color: 0xf2feff, opacity: 0.92, fog: 0.0015 },
  wind: { count: 900, vy: 8, vx: -56, sway: 0.6, sx: 3.4, sy: 0.24, sz: 0.24, color: 0xd6ecff, opacity: 0.5, fog: 0.0024 },
  fog: { count: 0, fog: 0.01 },
};

function wRand(min, max) {
  return min + Math.random() * (max - min);
}

function buildWeather() {
  weatherCountScale = window.innerWidth < 700 ? 0.45 : 1;
  weatherGroup = new THREE.Group();
  weatherMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false,
  });
  weatherMesh = new THREE.InstancedMesh(unitBox, weatherMaterial, WEATHER_CAPACITY);
  weatherMesh.frustumCulled = false;
  weatherMesh.renderOrder = 5;
  weatherMesh.count = 0;
  weatherParticles = [];
  for (let i = 0; i < WEATHER_CAPACITY; i++) {
    weatherParticles.push({
      x: wRand(-WEATHER_HALF_W, WEATHER_HALF_W),
      y: wRand(0, WEATHER_TOP),
      z: wRand(WEATHER_Z_MIN, WEATHER_Z_MAX),
      phase: wRand(0, WTAU),
      jitter: wRand(0.8, 1.25),
    });
  }
  weatherGroup.add(weatherMesh);
  weatherGroup.visible = false;
  scene.add(weatherGroup);
}

function setWeather(mode) {
  // Own-property check so inherited keys (constructor, toString, __proto__, …) don't
  // slip past as "valid" modes.
  if (!Object.prototype.hasOwnProperty.call(WEATHER, mode)) mode = 'none';
  weatherMode = mode;
  if (canvas) canvas.dataset.weather = mode;
  window.dispatchEvent(new CustomEvent('city-weather', { detail: { weather: weatherMode } }));
  if (!weatherMesh) return;
  const params = WEATHER[mode];
  // Under prefers-reduced-motion, suppress the moving particle layer entirely (rain/
  // snow/wind). Fog stays — it's a static density boost, not motion.
  const count = reducedMotion ? 0 : Math.round((params.count || 0) * weatherCountScale);
  if (params.color !== undefined) weatherMaterial.color.set(params.color);
  if (params.opacity !== undefined) weatherMaterial.opacity = params.opacity;
  weatherMesh.count = Math.min(WEATHER_CAPACITY, count);
  weatherGroup.visible = weatherMesh.count > 0;
}

function updateWeather(delta) {
  if (!weatherMesh || weatherMesh.count === 0) return;
  const params = WEATHER[weatherMode];
  const slow = reducedMotion ? 0.45 : 1;
  const count = weatherMesh.count;
  for (let i = 0; i < count; i++) {
    const pt = weatherParticles[i];
    pt.y -= params.vy * slow * pt.jitter * delta;
    pt.x += params.vx * slow * delta;
    if (pt.y < 0) {
      pt.y += WEATHER_TOP;
      pt.x = wRand(-WEATHER_HALF_W, WEATHER_HALF_W);
      pt.z = wRand(WEATHER_Z_MIN, WEATHER_Z_MAX);
    }
    pt.x = wrapX(pt.x, WEATHER_HALF_W);
    const swayX = params.sway ? Math.sin(elapsed * 1.3 + pt.phase) * params.sway : 0;
    dummy.position.set(pt.x + swayX, pt.y, pt.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(params.sx, params.sy, params.sz);
    dummy.updateMatrix();
    weatherMesh.setMatrixAt(i, dummy.matrix);
  }
  weatherMesh.instanceMatrix.needsUpdate = true;
}

function buildGroundAgents() {
  groundGroup = new THREE.Group();
  const mobile = window.innerWidth < 700;
  groundAgents = createGroundAgents(seed, { mobile });
  buildAvenue();
  buildPedestrians(groundAgents.pedestrians);
  buildRobots(groundAgents.robots);
  buildVehicles(groundAgents.vehicles);
  buildSubwayEntrance(-34, 67, 0);
  buildSubwayEntrance(40, 67, 1);
  scene.add(groundGroup);
}

function updateGroundAgents(delta) {
  if (!groundGroup) return;
  // Under reduced motion the build-time static poses are already correct, so there is
  // nothing to animate — skip the per-frame matrix recompute + GPU re-upload entirely.
  if (reducedMotion) return;
  const step = delta * 60;
  if (pedestrianBodies && pedestrianState.length) {
    for (let i = 0; i < pedestrianState.length; i++) {
      const p = pedestrianState[i];
      if (!reducedMotion) p.x = wrapX(p.x + p.vx * step, AGENT_BOUND);
      // Abs(sin) gives an upward step-bounce rather than a sink-through-the-floor dip.
      const bob = reducedMotion ? 0 : Math.abs(Math.sin(elapsed * p.bobSpeed + p.bobPhase)) * p.bobAmp;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(p.x, p.bodyBaseY + bob, p.z);
      dummy.scale.set(p.bodyW, p.bodyH, p.bodyD);
      dummy.updateMatrix();
      pedestrianBodies.setMatrixAt(p.index, dummy.matrix);
      dummy.position.set(p.x, p.headBaseY + bob, p.z);
      dummy.scale.set(p.headSize, p.headSize, p.headSize);
      dummy.updateMatrix();
      pedestrianHeads.setMatrixAt(p.index, dummy.matrix);
    }
    pedestrianBodies.instanceMatrix.needsUpdate = true;
    pedestrianHeads.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < robotState.length; i++) {
    const r = robotState[i];
    if (!reducedMotion) r.x = wrapX(r.x + r.vx * step, AGENT_BOUND);
    const bob = (reducedMotion || !r.bobAmp) ? 0 : Math.abs(Math.sin(elapsed * r.bobSpeed + r.bobPhase)) * r.bobAmp;
    r.mesh.position.set(r.x, bob, r.z);
  }
  for (let i = 0; i < vehicleState.length; i++) {
    const v = vehicleState[i];
    if (!reducedMotion) v.x = wrapX(v.x + v.vx * step, AGENT_BOUND);
    v.mesh.position.set(v.x, 0, v.z);
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
  // Re-apply the mobile/desktop particle budget if the viewport crossed the breakpoint.
  const newScale = window.innerWidth < 700 ? 0.45 : 1;
  if (newScale !== weatherCountScale) {
    weatherCountScale = newScale;
    if (weatherMode !== 'none') setWeather(weatherMode);
  }
}

function updateEnvironment() {
  const environment = window.CityEnvironment;
  const solar = environment && typeof environment.getLocalSolar === 'function'
    ? environment.getLocalSolar()
    : { starVisibility: 1, sun: { show: false } };
  const night = Math.max(0, Math.min(1, solar.starVisibility ?? 1));
  ambientLight.intensity = 0.48 + night * 0.42;
  directionalLight.intensity = 1.1 - night * 0.35;
  const weatherFog = (WEATHER[weatherMode] && WEATHER[weatherMode].fog) || 0;
  // Clamp the total so fog mode + full night doesn't whiteout the foreground crowd.
  scene.fog.density = Math.min(0.014, 0.006 + 0.0014 + night * 0.0024 + weatherFog);
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
  updateGroundAgents(delta);
  updateWeather(delta);

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
      // InstancedMeshes own their instanceMatrix/instanceColor GPU buffers; the shared
      // geometry.dispose() below doesn't free those — release them explicitly.
      if (object.isInstancedMesh && typeof object.dispose === 'function') object.dispose();
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
  buildGroundAgents();
  buildWeather();
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
  setWeather(params.get('weather') || 'none');
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
