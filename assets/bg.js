// Pixel synthwave city — signature skyline edition.
// Renders the 640x360 artboard into a denser backing canvas, with a finer
// sub-pixel facade pass for crisper building detail.
(function () {
  const canvas = document.getElementById('bg');
  const skyCanvas = document.getElementById('bg-sky');
  if (!canvas || !skyCanvas) return;
  const foregroundCtx = canvas.getContext('2d');
  const skyCtx = skyCanvas.getContext('2d');
  let ctx = foregroundCtx;
  const W = 640, H = 360;
  const DETAIL_SCALE = 2;
  const RENDER_SCALE = 3;
  const CANVAS_SCALE = RENDER_SCALE * DETAIL_SCALE;
  let citySpeed = 1;
  let cityT = 0;
  let city3DReady = Boolean(window.City3D && window.City3D.ready);
  canvas.width = W * CANVAS_SCALE;
  canvas.height = H * CANVAS_SCALE;
  skyCanvas.width = W * CANVAS_SCALE;
  skyCanvas.height = H * CANVAS_SCALE;
  foregroundCtx.imageSmoothingEnabled = false;
  skyCtx.imageSmoothingEnabled = false;

  function fit() {
    [canvas, skyCanvas].forEach((layerCanvas) => {
      layerCanvas.style.width = window.innerWidth + 'px';
      layerCanvas.style.height = window.innerHeight + 'px';
    });
    if (window.City3D && typeof window.City3D.resize === 'function') {
      window.City3D.resize();
    }
  }
  fit();
  window.addEventListener('resize', fit);

  const speedInput = document.getElementById('city-speed');
  const speedValue = document.getElementById('city-speed-value');
  function setCitySpeed(value) {
    citySpeed = Math.max(0, Math.min(2.5, Number(value) || 0));
    if (speedValue) speedValue.textContent = `${citySpeed.toFixed(1)}x`;
    try { localStorage.setItem('citySpeed', String(citySpeed)); } catch (_) {}
    if (window.City3D && typeof window.City3D.setSpeed === 'function') {
      window.City3D.setSpeed(citySpeed);
    }
    window.dispatchEvent(new CustomEvent('city-speed', {
      detail: { speed: citySpeed },
    }));
  }
  if (speedInput) {
    let savedSpeed = null;
    try { savedSpeed = localStorage.getItem('citySpeed'); } catch (_) {}
    if (savedSpeed !== null) speedInput.value = savedSpeed;
    setCitySpeed(speedInput.value);
    speedInput.addEventListener('input', () => setCitySpeed(speedInput.value));
  }

  // ---------- PALETTE ----------
  const COL = {
    sky1: [2, 7, 18],
    sky2: [4, 18, 35],
    sky3: [7, 36, 62],
    sky4: [14, 72, 112],
    sky5: [30, 98, 142],
    sky6: [52, 136, 174],
    cyan: '#36f5ff',
    cyanDk: '#178bb8',
    cyanDim: '#0e5f87',
    mag:  '#ff2fb3',
    magDk:'#9b1d70',
    pink: '#ff70dc',
    violet: '#9b5cff',
    blue: '#158dff',
    yel:  '#f6ff7a',
    amber:'#ffcc4d',
    org:  '#ff8e3c',
    red:  '#ff2f65',
    wht:  '#e8fbff',
    grnLed: '#62ff9b',
    bld1: '#04101f',  // far
    bld2: '#061a2e',
    bld3: '#082744',
    bld4: '#0b3656',  // near
    bld5: '#104a70',
    glassBlue: '#124b76',
    streetDark: '#020a13',
    streetMid:  '#061827',
  };

  function remapHex(hex, map) {
    if (!hex || !map) return hex;
    return window.PhosphorTheme ? PhosphorTheme.remapHex(hex, map) : hex;
  }

  function remapBuilding(b, map) {
    b.color = remapHex(b.color, map);
    b.accent = remapHex(b.accent, map);
    for (let i = 0; i < b.windows.length; i++) {
      b.windows[i].color = remapHex(b.windows[i].color, map);
    }
    for (let i = 0; i < b.lightBands.length; i++) {
      b.lightBands[i].color = remapHex(b.lightBands[i].color, map);
    }
    for (let i = 0; i < b.pipes.length; i++) {
      b.pipes[i].color = remapHex(b.pipes[i].color, map);
    }
    for (let i = 0; i < b.decks.length; i++) {
      b.decks[i].color = remapHex(b.decks[i].color, map);
    }
    if (b.sign) b.sign.color = remapHex(b.sign.color, map);
  }

  function remapCityScene(fromTheme, toTheme) {
    if (!window.PhosphorTheme) return;
    const map = PhosphorTheme.buildRemap(fromTheme, toTheme);
    [layer1, layer2, layer3, layer4].forEach((layer) => {
      layer.forEach((b) => remapBuilding(b, map));
    });
  }

  let themePulse = 0;
  let themePulseColor = COL.cyan;

  function triggerThemePulse() {
    const p = window.PhosphorTheme ? PhosphorTheme.get(phosphorThemeName) : null;
    themePulseColor = (p && p.pulse) || COL.cyan;
    themePulse = 1;
  }

  function drawThemePulse() {
    if (themePulse <= 0.008) {
      themePulse = 0;
      return;
    }
    const sweepY = ((1 - themePulse) * H) | 0;
    ctx.fillStyle = themePulseColor;
    ctx.globalAlpha = themePulse * 0.55;
    ctx.fillRect(0, sweepY, W, 3);
    ctx.globalAlpha = themePulse * 0.14;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    themePulse *= 0.88;
  }

  let phosphorThemeName = window.PhosphorTheme ? PhosphorTheme.readSaved() : 'default';
  let lastPhosphorTheme = phosphorThemeName;
  let themeWash = null;

  function syncColFromTheme(name) {
    if (!window.PhosphorTheme) return;
    const palette = PhosphorTheme.get(name);
    Object.assign(COL, palette.col);
    themeWash = palette.wash || null;
    phosphorThemeName = name;
  }
  syncColFromTheme(phosphorThemeName);

  function triggerThemeSweep() {
    const root = document.getElementById('bg-parallax');
    if (!root) return;
    root.classList.remove('theme-sweep');
    void root.offsetWidth;
    root.classList.add('theme-sweep');
  }

  const BAYER = [
    [ 0,32, 8,40, 2,34,10,42],
    [48,16,56,24,50,18,58,26],
    [12,44, 4,36,14,46, 6,38],
    [60,28,52,20,62,30,54,22],
    [ 3,35,11,43, 1,33, 9,41],
    [51,19,59,27,49,17,57,25],
    [15,47, 7,39,13,45, 5,37],
    [63,31,55,23,61,29,53,21],
  ];
  function lerp(a,b,t){return a+(b-a)*t;}
  function mix(c1,c2,t){return [lerp(c1[0],c2[0],t),lerp(c1[1],c2[1],t),lerp(c1[2],c2[2],t)];}
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function d(v) { return Math.round(v * DETAIL_SCALE); }
  function dz(v) { return Math.max(1, Math.round(v * DETAIL_SCALE)); }
  function baseTransform() {
    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  function withDetailTransform(fn) {
    const m = ctx.getTransform();
    ctx.save();
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, m.e, m.f);
    ctx.imageSmoothingEnabled = false;
    fn();
    ctx.restore();
  }

  // ---------- STARS (multi-layer) ----------
  const stars = [];
  for (let i = 0; i < 190; i++) {
    stars.push({
      x: (Math.random() * W) | 0,
      y: (Math.random() * H * 0.55) | 0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.09,
      color: Math.random() < 0.18 ? COL.cyan : (Math.random() < 0.28 ? '#89c8e8' : (Math.random() < 0.34 ? COL.pink : COL.wht)),
      big: Math.random() < 0.06,
    });
  }

  // ---------- BUILDINGS ----------
  // Each building has a deterministic seed for windows so they don't reshuffle every frame.
  const BUILDING_NAMES = (typeof window !== 'undefined' && window.TECH_COMPANIES)
    ? window.TECH_COMPANIES
    : ['PEAK', 'MUNOZ', 'DREE', 'AETHER', 'KAI', 'NOVA', 'CMU', 'BYTE', 'ORBIT', 'VOLT', 'LUMA', 'NEON', 'ATLAS', 'VANTA', 'HEX', 'SORA'];
  const WINDOW_PALETTES = [
    [COL.yel, '#9bdcf4', '#d9f8ff'],
    [COL.cyan, COL.blue, '#86d8ff'],
    [COL.pink, COL.mag, '#b96fa6'],
    [COL.grnLed, COL.cyan, '#5bb9d6'],
    ['#7aa9d8', '#315f88', '#b8ecff'],
  ];

  const SIMPLE_BUILDING_KINDS = ['block', 'pyramid', 'tower', 'spire', 'slant', 'pagoda', 'notched', 'needle', 'stacked', 'scaffold', 'billboard', 'twin'];
  const COMPLEX_BUILDING_KINDS = ['megaTwin', 'skyGate', 'steppedNeedle', 'holoTower', 'tieredTemple', 'lattice', 'crownTower', 'tapered', 'podiumSpire'];
  function pickBuildingKind(w, h) {
    if (h > 98 && w > 24 && Math.random() < 0.68) return pick(COMPLEX_BUILDING_KINDS);
    if (h > 70 && w > 18 && Math.random() < 0.24) return pick(COMPLEX_BUILDING_KINDS);
    return pick(SIMPLE_BUILDING_KINDS);
  }

  function addWindowGrid(b, opts) {
    const winW = opts.winW || 3;
    const winH = opts.winH || 3;
    const gapX = opts.gapX || 2;
    const gapY = opts.gapY || 2;
    const cols = Math.max(1, Math.floor((b.w - 4) / (winW + gapX)));
    const rows = Math.max(1, Math.floor((b.h - 6) / (winH + gapY)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let density = opts.winDensity;
        if (b.windowStyle === 'stripes') density *= (r % 3 === 0) ? 1.75 : 0.32;
        if (b.windowStyle === 'clusters') density *= ((c + r) % 4 < 2) ? 1.35 : 0.22;
        if (b.windowStyle === 'vertical') density *= (c % 3 === 0) ? 1.55 : 0.28;
        if (b.windowStyle === 'lobby') density *= r > rows * 0.7 ? 1.65 : 0.38;
        if (b.windowStyle === 'fullGrid') density *= 1.8;
        if (b.windowStyle === 'pinstripes') density *= (c % 2 === 0) ? 1.95 : 0.18;
        if (Math.random() < density) {
          const col = pick(b.palette);
          b.windows.push({
            x: b.x + 2 + c * (winW + gapX),
            y: b.y + 4 + r * (winH + gapY),
            w: winW, h: winH,
            color: col,
            phase: Math.random() * Math.PI * 2,
            speed: 0.005 + Math.random() * 0.04,
            alwaysOn: Math.random() < 0.28,
          });
        }
      }
    }
  }

  function mkLayer(opts) {
    const out = [];
    let x = -10;
    while (x < W + 20) {
      const w = (opts.wMin + Math.random() * (opts.wMax - opts.wMin)) | 0;
      const h = (opts.hMin + Math.random() * (opts.hMax - opts.hMin)) | 0;
      const b = {
        x, y: opts.baseY - h, w, h,
        color: opts.color,
        accent: Math.random() < 0.5 ? COL.mag : COL.cyan,
        windows: [],
        kind: pickBuildingKind(w, h),
        ribs: Math.random() < 0.55,
        crown: Math.random() < 0.45,
        windowStyle: pick(['sparse', 'stripes', 'clusters', 'vertical', 'lobby', 'pinstripes']),
        facade: pick(['panelGrid', 'vents', 'shafts', 'catwalks', 'mixed']),
        palette: pick(WINDOW_PALETTES),
        skybridge: null,
        lightBands: [],
        pipes: [],
        decks: [],
        sign: null,
        rooftop: [],
      };
      // Window grid (deterministic windows from seeded rand)
      addWindowGrid(b, opts);
      if (h > 55 && Math.random() < 0.5) {
        const bandCount = 1 + ((Math.random() * 2) | 0);
        for (let i = 0; i < bandCount; i++) {
          b.lightBands.push({
            y: b.y + 10 + ((Math.random() * Math.max(8, h - 24)) | 0),
            h: Math.random() < 0.6 ? 1 : 2,
            color: pick([b.accent, COL.cyanDk, COL.magDk, COL.amber, COL.violet]),
            alpha: 0.22 + Math.random() * 0.25,
          });
        }
      }
      if (h > 45) {
        const pipeCount = Math.min(5, 1 + ((w / 18) | 0));
        for (let i = 0; i < pipeCount; i++) {
          if (Math.random() < 0.68) {
            b.pipes.push({
              x: 3 + ((Math.random() * Math.max(4, w - 7)) | 0),
              y: 4 + ((Math.random() * 12) | 0),
              h: Math.max(12, h - 8 - ((Math.random() * 20) | 0)),
              color: pick([COL.cyanDim, COL.glassBlue, COL.cyanDk, '#1d5b7d']),
              alpha: 0.28 + Math.random() * 0.2,
            });
          }
        }
      }
      if (h > 70 && w > 22) {
        const deckCount = 1 + ((Math.random() * 3) | 0);
        for (let i = 0; i < deckCount; i++) {
          b.decks.push({
            y: b.y + 16 + ((Math.random() * Math.max(12, h - 36)) | 0),
            x: Math.random() < 0.5 ? -3 : 2,
            w: w + (Math.random() < 0.45 ? 6 : -4),
            color: pick([COL.cyanDk, COL.glassBlue, COL.magDk]),
            alpha: 0.26 + Math.random() * 0.2,
          });
        }
      }
      // Rooftop antenna / dish / sign
      if (h > 40 && Math.random() < 0.7) {
        const top = b.y;
        const cx = b.x + ((w / 2) | 0);
        const r = Math.random();
        if (r < 0.35) {
          // antenna with multiple cross arms
          const ah = 6 + (Math.random() * 14) | 0;
          b.rooftop.push({ kind: 'antenna', x: cx, y: top, h: ah });
        } else if (r < 0.55) {
          // satellite dish
          b.rooftop.push({ kind: 'dish', x: cx - 3, y: top - 6 });
        } else if (r < 0.75) {
          // water tower / cylinder
          b.rooftop.push({ kind: 'cyl', x: cx - 4, y: top - 8, w: 8, h: 8 });
        } else {
          // multi-spike skyline
          for (let i = 0; i < 3; i++) {
            const sh = 4 + (Math.random() * 8) | 0;
            b.rooftop.push({ kind: 'antenna', x: b.x + 4 + i * ((w - 8) / 2), y: top, h: sh });
          }
        }
      }
      if (h > 70 && w > 28 && Math.random() < 0.28) {
        b.skybridge = {
          y: b.y + 18 + ((Math.random() * Math.max(12, h * 0.35)) | 0),
          w: 10 + ((Math.random() * 18) | 0),
          h: 4 + ((Math.random() * 3) | 0),
          side: Math.random() < 0.5 ? -1 : 1,
        };
      }
      // Holographic sign on bigger buildings
      if (h > 60 && w > 26 && Math.random() < 0.48) {
        b.sign = {
          text: BUILDING_NAMES[(Math.random() * BUILDING_NAMES.length) | 0],
          y: b.y + 8 + (Math.random() * (h - 30)) | 0,
          color: Math.random() < 0.48 ? COL.cyan : (Math.random() < 0.82 ? COL.mag : COL.yel),
          flicker: Math.random() * Math.PI * 2,
          vertical: Math.random() < 0.38,
        };
      }
      out.push(b);
      x += w + ((opts.gapMin + Math.random() * opts.gapRange) | 0);
    }
    return out;
  }

  function makeLandmark(cfg) {
    const b = {
      x: cfg.x,
      y: cfg.baseY - cfg.h,
      w: cfg.w,
      h: cfg.h,
      color: cfg.color,
      accent: cfg.accent || pick([COL.cyan, COL.mag, COL.yel]),
      windows: [],
      kind: cfg.kind,
      ribs: cfg.ribs !== undefined ? cfg.ribs : true,
      crown: cfg.crown !== undefined ? cfg.crown : true,
      windowStyle: cfg.windowStyle || 'fullGrid',
      facade: cfg.facade || 'mixed',
      palette: cfg.palette || pick(WINDOW_PALETTES),
      skybridge: cfg.skybridge || null,
      lightBands: [],
      pipes: [],
      decks: [],
      sign: cfg.sign ? {
        text: BUILDING_NAMES[(Math.random() * BUILDING_NAMES.length) | 0],
        y: cfg.baseY - cfg.h + (cfg.signY || Math.max(10, (cfg.h * 0.34) | 0)),
        color: cfg.signColor || cfg.accent || COL.cyan,
        flicker: cfg.x * 0.17,
        vertical: !!cfg.verticalSign,
      } : null,
      rooftop: [],
    };

    addWindowGrid(b, {
      winW: cfg.winW || 1,
      winH: cfg.winH || 2,
      gapX: cfg.gapX || 2,
      gapY: cfg.gapY || 2,
      winDensity: cfg.winDensity || 0.38,
    });

    for (let y = b.y + 14; y < b.y + b.h - 12; y += cfg.bandStep || 24) {
      b.lightBands.push({
        y,
        h: y % 3 === 0 ? 2 : 1,
        color: pick([b.accent, COL.cyanDk, COL.magDk, COL.amber, COL.violet]),
        alpha: 0.28,
      });
    }

    const pipeCount = Math.max(2, Math.min(7, (b.w / 12) | 0));
    for (let i = 0; i < pipeCount; i++) {
      b.pipes.push({
        x: 4 + ((i * (b.w - 8)) / Math.max(1, pipeCount - 1) | 0),
        y: 8 + (i % 3) * 4,
        h: Math.max(22, b.h - 16 - (i % 4) * 8),
        color: pick([COL.cyanDim, COL.glassBlue, COL.cyanDk, '#1d5b7d']),
        alpha: 0.28,
      });
    }

    const antennaCount = cfg.antennaCount || 5;
    for (let i = 0; i < antennaCount; i++) {
      const px = b.x + 4 + ((i * Math.max(1, b.w - 8)) / Math.max(1, antennaCount - 1));
      b.rooftop.push({ kind: 'antenna', x: px, y: b.y, h: 7 + (i % 4) * 4 });
    }
    if (cfg.dish) b.rooftop.push({ kind: 'dish', x: b.x + b.w - 10, y: b.y - 7 });
    return b;
  }

  // 4 building layers for parallax depth
  const layer1 = mkLayer({ // farthest, behind moon
    wMin: 7, wMax: 18, hMin: 24, hMax: 78, baseY: 202,
    color: COL.bld1, winDensity: 0.16,
    winW: 1, winH: 1, gapX: 2, gapY: 2,
    gapMin: 0, gapRange: 2,
  });
  const layer2 = mkLayer({
    wMin: 12, wMax: 30, hMin: 42, hMax: 116, baseY: 232,
    color: COL.bld2, winDensity: 0.2,
    winW: 1, winH: 2, gapX: 2, gapY: 2,
    gapMin: 1, gapRange: 3,
  });
  const layer3 = mkLayer({
    wMin: 20, wMax: 46, hMin: 76, hMax: 162, baseY: 270,
    color: COL.bld3, winDensity: 0.22,
    winW: 2, winH: 2, gapX: 2, gapY: 2,
    gapMin: 2, gapRange: 4,
  });
  const layer4 = mkLayer({ // closest
    wMin: 32, wMax: 72, hMin: 72, hMax: 168, baseY: 308,
    color: COL.bld4, winDensity: 0.2,
    winW: 2, winH: 3, gapX: 2, gapY: 2,
    gapMin: 2, gapRange: 6,
  });

  layer2.push(
    makeLandmark({ x: 76, baseY: 232, w: 54, h: 86, kind: 'tieredTemple', color: COL.bld2, accent: COL.cyan, sign: 'KAI', signColor: COL.yel, winDensity: 0.28, antennaCount: 3 }),
    makeLandmark({ x: 378, baseY: 232, w: 88, h: 126, kind: 'skyGate', color: COL.bld2, accent: COL.cyan, sign: 'SYN', winDensity: 0.3, antennaCount: 6 }),
    makeLandmark({ x: 560, baseY: 232, w: 52, h: 104, kind: 'lattice', color: COL.bld2, accent: COL.violet, sign: 'SKY', winDensity: 0.3, antennaCount: 4 }),
  );
  layer3.push(
    makeLandmark({ x: 116, baseY: 270, w: 58, h: 148, kind: 'crownTower', color: COL.bld3, accent: COL.mag, sign: 'BYTE', winDensity: 0.34, antennaCount: 7 }),
    makeLandmark({ x: 252, baseY: 270, w: 66, h: 156, kind: 'holoTower', color: COL.bld3, accent: COL.cyan, sign: 'SYS', signColor: COL.wht, verticalSign: true, winDensity: 0.42, dish: true }),
    makeLandmark({ x: 488, baseY: 270, w: 68, h: 138, kind: 'megaTwin', color: COL.bld3, accent: COL.yel, sign: 'KAI', winDensity: 0.36, antennaCount: 8 }),
    makeLandmark({ x: 18, baseY: 270, w: 78, h: 116, kind: 'skyGate', color: COL.bld3, accent: COL.blue, sign: 'PORT', winDensity: 0.34, antennaCount: 5 }),
  );
  layer4.push(
    makeLandmark({ x: 38, baseY: 308, w: 52, h: 154, kind: 'steppedNeedle', color: COL.bld4, accent: COL.cyan, sign: 'NEO', verticalSign: true, winDensity: 0.36, antennaCount: 6 }),
    makeLandmark({ x: 192, baseY: 308, w: 62, h: 132, kind: 'podiumSpire', color: COL.bld4, accent: COL.mag, sign: 'VOLT', signColor: COL.yel, winDensity: 0.34, antennaCount: 5 }),
    makeLandmark({ x: 318, baseY: 308, w: 86, h: 168, kind: 'megaTwin', color: COL.bld4, accent: COL.cyan, sign: 'AETHER', winDensity: 0.42, antennaCount: 9 }),
    makeLandmark({ x: 512, baseY: 308, w: 70, h: 146, kind: 'lattice', color: COL.bld4, accent: COL.yel, sign: 'CMU', verticalSign: true, winDensity: 0.32, antennaCount: 6 }),
    makeLandmark({ x: 420, baseY: 308, w: 54, h: 126, kind: 'tieredTemple', color: COL.bld4, accent: COL.grnLed, sign: 'LAB', winDensity: 0.38, antennaCount: 5 }),
  );

  // ---------- SHOOTING STARS ----------
  const shoots = [];

  // ---------- PRE-BAKED SKY ----------
  const sky = document.createElement('canvas');
  sky.width = W; sky.height = H;
  const sctx = sky.getContext('2d');

  function drawCloud(x, y, w, c, alpha = 0.5) {
    sctx.fillStyle = c;
    sctx.globalAlpha = alpha;
    for (let i = 0; i < w; i++) {
      const h = (Math.sin(i * 0.3) + 1) * 1.2 + 1;
      sctx.fillRect(x + i, y - (h | 0), 1, (h | 0));
    }
    sctx.globalAlpha = 1;
  }

  function rebakeSky() {
    sctx.clearRect(0, 0, W, H);
    const decor = window.PhosphorTheme
      ? PhosphorTheme.get(phosphorThemeName).skyDecor
      : null;
    const hazePrefix = decor ? decor.hazeLine : 'rgba(71, 217, 255,';
    const hazeA = decor ? decor.hazePillarA : 'rgba(71,217,255,0.08)';
    const hazeB = decor ? decor.hazePillarB : 'rgba(255,63,166,0.07)';
    const clouds = decor ? decor.clouds : ['#16496a', '#235d7d', '#123d5e', '#1d5372', '#2a6f92', '#25617f'];
    const hg = decor ? decor.horizonGlow : {
      top: 'rgba(71, 217, 255, 0)',
      mid: 'rgba(71, 217, 255, 0.42)',
      mag: 'rgba(255, 63, 166, 0.18)',
      bottom: 'rgba(71, 217, 255, 0)',
    };

    const skyImg = sctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      let col;
      if (y < 70)        col = mix(COL.sky1, COL.sky2, y / 70);
      else if (y < 140)  col = mix(COL.sky2, COL.sky3, (y - 70) / 70);
      else if (y < 200)  col = mix(COL.sky3, COL.sky4, (y - 140) / 60);
      else if (y < 230)  col = mix(COL.sky4, COL.sky5, (y - 200) / 30);
      else if (y < 245)  col = mix(COL.sky5, COL.sky6, (y - 230) / 15);
      else               col = mix(COL.sky1, [2, 9, 18], 0.5);

      for (let x = 0; x < W; x++) {
        const b = (BAYER[y & 7][x & 7] - 31.5) / 4;
        const i = (y * W + x) * 4;
        skyImg.data[i]   = Math.max(0, Math.min(255, col[0] + b * 0.7));
        skyImg.data[i + 1] = Math.max(0, Math.min(255, col[1] + b * 0.7));
        skyImg.data[i + 2] = Math.max(0, Math.min(255, col[2] + b * 0.7));
        skyImg.data[i + 3] = 255;
      }
    }
    sctx.putImageData(skyImg, 0, 0);

    for (let y = 84; y < 250; y++) {
      const t = (y - 84) / 166;
      const width = (190 + Math.sin(y * 0.08) * 24 + t * 160) | 0;
      sctx.fillStyle = `${hazePrefix}${0.018 + t * 0.045})`;
      sctx.fillRect((W - width) / 2, y, width, 1);
    }
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() * W) | 0;
      const y = 92 + ((Math.random() * 145) | 0);
      const h = 16 + ((Math.random() * 58) | 0);
      sctx.fillStyle = Math.random() < 0.78 ? hazeA : hazeB;
      sctx.fillRect(x, y, 1 + ((Math.random() * 2) | 0), h);
    }

    drawCloud(20, 95, 110, clouds[0], 0.55);
    drawCloud(150, 116, 72, clouds[1], 0.48);
    drawCloud(355, 88, 128, clouds[2], 0.62);
    drawCloud(500, 132, 86, clouds[3], 0.42);
    drawCloud(54, 162, 64, clouds[4], 0.28);
    drawCloud(412, 176, 96, clouds[5], 0.26);

    const glowG = sctx.createLinearGradient(0, 230, 0, 278);
    glowG.addColorStop(0, hg.top);
    glowG.addColorStop(0.42, hg.mid);
    glowG.addColorStop(0.68, hg.mag);
    glowG.addColorStop(1, hg.bottom);
    sctx.fillStyle = glowG;
    sctx.fillRect(0, 230, W, 48);
    sctx.fillStyle = COL.cyan;
    sctx.fillRect(0, 246, W, 1);
    sctx.fillStyle = COL.mag;
    sctx.globalAlpha = 0.28;
    sctx.fillRect(0, 247, W, 1);
    sctx.globalAlpha = 1;
  }
  rebakeSky();

  // ---------- DRAWING HELPERS ----------
  function drawAntenna(x, y, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - h, 1, h);
    // cross arms
    if (h > 8) {
      ctx.fillRect(x - 2, y - h + 2, 5, 1);
      ctx.fillRect(x - 1, y - h + 5, 3, 1);
    }
  }
  function drawDish(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 6, 1);
    ctx.fillRect(x + 1, y - 1, 4, 1);
    ctx.fillRect(x + 2, y - 2, 2, 1);
    ctx.fillStyle = COL.cyanDk;
    ctx.fillRect(x + 3, y + 1, 1, 3);
  }
  function drawCyl(x, y, w, h, color, accent) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
  }
  function drawSignText(x, y, text, color, t, flicker) {
    const charW = 4;
    const flickering = (Math.sin(t * 0.05 + flicker) + 1) * 0.5;
    if (flickering < 0.18) return;
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(1, flickering + 0.4);
    for (let i = 0; i < text.length; i++) {
      const cx = x + i * (charW + 1);
      ctx.fillRect(cx, y, charW, 1);     // simplified pixel font: top
      ctx.fillRect(cx, y + 4, charW, 1); // bot
      ctx.fillRect(cx, y + 2, charW, 1); // mid
      ctx.fillRect(cx, y + 1, 1, 3);
      ctx.fillRect(cx + charW - 1, y + 1, 1, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawBuildingName(x, y, text, color, t, flicker, vertical) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 0.035 + flicker);
    ctx.save();
    ctx.font = '6px "Share Tech Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.max(0.42, pulse);
    if (vertical) {
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], x, y + i * 6);
      }
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x - 2, y - 1, 8, text.length * 6 + 1);
    } else {
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x - 1, y - 1, Math.min(text.length * 5 + 3, 38), 8);
    }
    ctx.restore();
  }

  function drawBuildingBody(b) {
    // body
    ctx.fillStyle = b.color;
    if (b.kind === 'pyramid') {
      // stepped pyramid
      const steps = 4;
      const stepH = (b.h / steps) | 0;
      const stepDx = ((b.w * 0.15) / steps) | 0;
      for (let s = 0; s < steps; s++) {
        ctx.fillRect(b.x + s * stepDx, b.y + s * stepH, b.w - s * stepDx * 2, stepH + 1);
      }
    } else if (b.kind === 'spire') {
      const cap = Math.max(8, (b.h * 0.18) | 0);
      ctx.fillRect(b.x, b.y + cap, b.w, b.h - cap);
      ctx.beginPath();
      ctx.moveTo(b.x + ((b.w / 2) | 0), b.y);
      ctx.lineTo(b.x + b.w, b.y + cap);
      ctx.lineTo(b.x, b.y + cap);
      ctx.closePath();
      ctx.fill();
    } else if (b.kind === 'slant') {
      const lean = Math.max(4, (b.w * 0.22) | 0);
      ctx.beginPath();
      ctx.moveTo(b.x + lean, b.y);
      ctx.lineTo(b.x + b.w, b.y + Math.max(3, lean / 2));
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.lineTo(b.x, b.y + b.h);
      ctx.closePath();
      ctx.fill();
    } else if (b.kind === 'pagoda') {
      const tiers = 5;
      const tierH = Math.max(5, (b.h / tiers) | 0);
      for (let s = 0; s < tiers; s++) {
        const inset = Math.min((b.w * 0.28) | 0, s * 2);
        const overhang = s % 2 === 0 ? 2 : 0;
        ctx.fillRect(b.x + inset - overhang, b.y + s * tierH, b.w - inset * 2 + overhang * 2, tierH + 1);
        ctx.fillStyle = b.accent;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(b.x + inset - overhang, b.y + s * tierH, b.w - inset * 2 + overhang * 2, 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = b.color;
      }
    } else if (b.kind === 'notched') {
      const notchW = Math.max(6, (b.w * 0.25) | 0);
      const notchH = Math.max(8, (b.h * 0.12) | 0);
      ctx.fillRect(b.x, b.y + notchH, b.w, b.h - notchH);
      ctx.fillRect(b.x, b.y, ((b.w - notchW) / 2) | 0, notchH + 1);
      ctx.fillRect(b.x + ((b.w + notchW) / 2), b.y, ((b.w - notchW) / 2) | 0, notchH + 1);
    } else if (b.kind === 'needle') {
      const shaftW = Math.max(8, (b.w * 0.45) | 0);
      const shaftX = b.x + ((b.w - shaftW) / 2 | 0);
      ctx.fillRect(shaftX, b.y + 8, shaftW, b.h - 8);
      ctx.fillRect(b.x, b.y + ((b.h * 0.48) | 0), b.w, Math.max(8, (b.h * 0.12) | 0));
      ctx.fillStyle = b.accent;
      ctx.fillRect(shaftX + ((shaftW / 2) | 0), b.y - 12, 1, 20);
    } else if (b.kind === 'stacked') {
      const tiers = 4;
      for (let s = 0; s < tiers; s++) {
        const y = b.y + ((b.h / tiers) * s | 0);
        const h = ((b.h / tiers) | 0) + 1;
        const inset = (s % 2) * 3 + Math.min(6, s * 2);
        ctx.fillRect(b.x + inset, y, b.w - inset * 2, h);
        ctx.fillStyle = s % 2 ? COL.glassBlue : b.color;
      }
      ctx.fillStyle = b.color;
    } else if (b.kind === 'scaffold') {
      ctx.fillRect(b.x + 3, b.y, b.w - 6, b.h);
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = COL.cyanDk;
      for (let y = b.y + 8; y < b.y + b.h; y += 12) ctx.fillRect(b.x - 2, y, b.w + 4, 1);
      for (let x = b.x + 2; x < b.x + b.w; x += 8) ctx.fillRect(x, b.y + 2, 1, b.h - 2);
      ctx.globalAlpha = 1;
    } else if (b.kind === 'billboard') {
      ctx.fillRect(b.x, b.y + 12, b.w, b.h - 12);
      ctx.fillRect(b.x + 4, b.y, Math.max(8, b.w - 8), 14);
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.32;
      ctx.fillRect(b.x + 6, b.y + 3, Math.max(4, b.w - 12), 8);
      ctx.globalAlpha = 1;
    } else if (b.kind === 'twin') {
      const gap = Math.max(3, (b.w * 0.12) | 0);
      const towerW = ((b.w - gap) / 2) | 0;
      ctx.fillRect(b.x, b.y + 10, towerW, b.h - 10);
      ctx.fillRect(b.x + towerW + gap, b.y, towerW, b.h);
      ctx.fillStyle = COL.cyanDk;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(b.x + towerW, b.y + ((b.h * 0.38) | 0), gap, 2);
      ctx.fillRect(b.x + towerW, b.y + ((b.h * 0.62) | 0), gap, 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  function traceBuildingShapeD(b) {
    const x = d(b.x);
    const y = d(b.y);
    const w = dz(b.w);
    const h = dz(b.h);
    ctx.beginPath();
    if (b.kind === 'pyramid') {
      ctx.moveTo(x + w * 0.18, y);
      ctx.lineTo(x + w * 0.82, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (b.kind === 'spire') {
      const cap = Math.max(d(8), Math.round(h * 0.18));
      ctx.moveTo(x + Math.round(w / 2), y);
      ctx.lineTo(x + w, y + cap);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + cap);
      ctx.closePath();
    } else if (b.kind === 'slant') {
      const lean = Math.max(d(4), Math.round(w * 0.22));
      ctx.moveTo(x + lean, y);
      ctx.lineTo(x + w, y + Math.max(d(3), Math.round(lean / 2)));
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (b.kind === 'needle') {
      const shaftW = Math.max(d(8), Math.round(w * 0.45));
      const shaftX = x + Math.round((w - shaftW) / 2);
      ctx.rect(shaftX, y + d(8), shaftW, h - d(8));
      ctx.rect(x, y + Math.round(h * 0.48), w, Math.max(d(8), Math.round(h * 0.12)));
    } else if (b.kind === 'twin') {
      const gap = Math.max(d(3), Math.round(w * 0.12));
      const towerW = Math.round((w - gap) / 2);
      ctx.rect(x, y + d(10), towerW, h - d(10));
      ctx.rect(x + towerW + gap, y, towerW, h);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  function drawBuildingDetailPass(b, t) {
    withDetailTransform(() => {
      traceBuildingShapeD(b);
      ctx.clip();

      const x = d(b.x);
      const y = d(b.y);
      const w = dz(b.w);
      const h = dz(b.h);
      const bay = Math.max(d(5), Math.round((b.w / Math.max(3, Math.round(b.w / 12))) * DETAIL_SCALE));
      const floor = Math.max(d(5), Math.round((b.h / Math.max(4, Math.round(b.h / 18))) * DETAIL_SCALE));

      ctx.globalAlpha = 0.2;
      ctx.fillStyle = b.accent;
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x, y, 1, h);
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x + w - 1, y + 1, 1, Math.max(1, h - 1));

      ctx.fillStyle = '#b8ecff';
      ctx.globalAlpha = 0.08;
      for (let px = x + bay; px < x + w - 2; px += bay) {
        ctx.fillRect(px, y + d(4), 1, Math.max(1, h - d(8)));
      }

      ctx.fillStyle = COL.glassBlue;
      ctx.globalAlpha = 0.14;
      for (let py = y + floor; py < y + h - d(3); py += floor) {
        ctx.fillRect(x + d(2), py, Math.max(1, w - d(4)), 1);
      }

      if (b.facade === 'catwalks' || b.facade === 'mixed') {
        ctx.fillStyle = b.accent;
        ctx.globalAlpha = 0.18;
        for (let py = y + d(12); py < y + h - d(10); py += d(18)) {
          ctx.fillRect(x + d(1), py, Math.max(1, w - d(2)), 1);
          for (let px = x + d(4); px < x + w - d(3); px += d(7)) {
            ctx.fillRect(px, py + 1, 1, d(2));
          }
        }
      }

      if (b.facade === 'vents' || b.facade === 'mixed') {
        ctx.fillStyle = '#0b5f83';
        ctx.globalAlpha = 0.2;
        for (let py = y + d(16); py < y + h - d(8); py += d(17)) {
          for (let px = x + d(4); px < x + w - d(8); px += d(8)) {
            ctx.fillRect(px, py, d(2), 1);
            ctx.fillRect(px + d(3), py, d(2), 1);
          }
        }
      }

      const pulse = 0.5 + 0.5 * Math.sin(t * 0.03 + b.x);
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.05 + pulse * 0.05;
      ctx.fillRect(x + d(1), y + d(1), Math.max(1, w - d(2)), Math.max(1, h - d(2)));
      ctx.globalAlpha = 1;
    });
  }

  function drawBuildingWindowsHiRes(b, t) {
    withDetailTransform(() => {
      traceBuildingShapeD(b);
      ctx.clip();

      for (let i = 0; i < b.windows.length; i++) {
        const w = b.windows[i];
        let f;
        if (w.alwaysOn) {
          f = 0.8 + 0.2 * Math.sin(t * w.speed + w.phase);
        } else {
          f = 0.5 + 0.5 * Math.sin(t * w.speed + w.phase);
        }

        const wx = d(w.x);
        const wy = d(w.y);
        const ww = dz(w.w);
        const wh = dz(w.h);

        if (f > 0.25) {
          ctx.fillStyle = w.color;
          ctx.globalAlpha = Math.min(1, f + 0.15);
          ctx.fillRect(wx, wy, ww, wh);

          ctx.globalAlpha = Math.min(0.45, f * 0.5);
          ctx.fillStyle = '#e8fbff';
          ctx.fillRect(wx, wy, Math.max(1, ww - 1), 1);

          if (ww >= 4 && wh >= 4) {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#020914';
            ctx.fillRect(wx + ww - 1, wy + 1, 1, wh - 1);
            ctx.fillRect(wx + 1, wy + wh - 1, ww - 1, 1);
            if (((w.x + w.y + i) & 1) === 0) ctx.fillRect(wx + Math.floor(ww / 2), wy + 1, 1, wh - 2);
          }
        } else {
          ctx.fillStyle = COL.glassBlue;
          ctx.globalAlpha = 0.08;
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawBuilding(b, t) {
    drawBuildingBody(b);
    // accent top
    ctx.fillStyle = b.accent;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(b.x, b.y, b.w, 1);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(b.x, b.y, 1, b.h);
    ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
    ctx.globalAlpha = 1;

    if (b.ribs) {
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.12;
      for (let rx = b.x + 4; rx < b.x + b.w - 2; rx += 6) {
        ctx.fillRect(rx, b.y + 3, 1, b.h - 3);
      }
      ctx.globalAlpha = 1;
    }

    if (b.pipes.length) {
      for (let i = 0; i < b.pipes.length; i++) {
        const pipe = b.pipes[i];
        ctx.fillStyle = pipe.color;
        ctx.globalAlpha = pipe.alpha;
        ctx.fillRect(b.x + pipe.x, b.y + pipe.y, 1, Math.min(pipe.h, b.h - pipe.y));
        if (i % 2 === 0) ctx.fillRect(b.x + pipe.x - 1, b.y + pipe.y + 6, 3, 1);
      }
      ctx.globalAlpha = 1;
    }

    if (b.decks.length) {
      for (let i = 0; i < b.decks.length; i++) {
        const deck = b.decks[i];
        ctx.fillStyle = deck.color;
        ctx.globalAlpha = deck.alpha;
        ctx.fillRect(b.x + deck.x, deck.y, deck.w, 2);
        ctx.fillRect(b.x + deck.x, deck.y + 3, deck.w, 1);
        for (let px = b.x + deck.x + 3; px < b.x + deck.x + deck.w; px += 7) {
          ctx.fillRect(px, deck.y + 1, 1, 3);
        }
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = COL.glassBlue;
    ctx.globalAlpha = 0.16;
    if (b.facade === 'panelGrid' || b.facade === 'mixed') {
      for (let y = b.y + 12; y < b.y + b.h - 4; y += 14) ctx.fillRect(b.x + 2, y, Math.max(2, b.w - 4), 1);
    }
    if (b.facade === 'vents' || b.facade === 'mixed') {
      for (let y = b.y + 18; y < b.y + b.h - 10; y += 20) {
        for (let x = b.x + 4; x < b.x + b.w - 6; x += 9) ctx.fillRect(x, y, 5, 1);
      }
    }
    if (b.facade === 'shafts' || b.facade === 'catwalks') {
      for (let x = b.x + 6; x < b.x + b.w - 4; x += 11) ctx.fillRect(x, b.y + 8, 2, b.h - 12);
    }
    ctx.globalAlpha = 1;

    if (b.crown && b.w > 18) {
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.45;
      for (let cx = b.x + 3; cx < b.x + b.w - 3; cx += 6) {
        ctx.fillRect(cx, b.y - 2, 3, 2);
      }
      ctx.globalAlpha = 1;
    }

    if (b.lightBands.length) {
      for (let i = 0; i < b.lightBands.length; i++) {
        const band = b.lightBands[i];
        ctx.fillStyle = band.color;
        ctx.globalAlpha = band.alpha;
        ctx.fillRect(b.x + 1, band.y, Math.max(2, b.w - 2), band.h);
      }
      ctx.globalAlpha = 1;
    }

    drawBuildingDetailPass(b, t);
    drawBuildingWindowsHiRes(b, t);

    if (b.skybridge) {
      const dir = b.skybridge.side;
      const bx = dir > 0 ? b.x + b.w - 1 : b.x - b.skybridge.w + 1;
      ctx.fillStyle = COL.cyanDk;
      ctx.globalAlpha = 0.82;
      ctx.fillRect(bx, b.skybridge.y, b.skybridge.w, b.skybridge.h);
      ctx.fillStyle = b.accent;
      ctx.fillRect(bx, b.skybridge.y, b.skybridge.w, 1);
      ctx.globalAlpha = 1;
    }

    // rooftop
    for (let i = 0; i < b.rooftop.length; i++) {
      const r = b.rooftop[i];
      if (r.kind === 'antenna') {
        drawAntenna(r.x | 0, r.y, r.h, b.accent);
        // Blink tip
        if ((t | 0) % 50 < 25) {
          ctx.fillStyle = COL.red;
          ctx.fillRect((r.x | 0), r.y - r.h - 1, 1, 1);
        }
      } else if (r.kind === 'dish') {
        drawDish(r.x, r.y, b.accent);
      } else if (r.kind === 'cyl') {
        drawCyl(r.x, r.y, r.w, r.h, b.color, b.accent);
      }
    }

    // sign
    if (b.sign) {
      if (BUILDING_NAMES.includes(b.sign.text)) {
        const sx = b.sign.vertical ? b.x + Math.max(2, (b.w / 2) | 0) : b.x + 2;
        drawBuildingName(sx, b.sign.y, b.sign.text, b.sign.color, t, b.sign.flicker, b.sign.vertical);
      } else {
        drawSignText(b.x + 2, b.sign.y, b.sign.text, b.sign.color, t, b.sign.flicker);
      }
    }
  }

  function drawScrollingLayer(layer, t, speed) {
    const shift = (t * speed) % W;
    for (let copy = -1; copy <= 1; copy++) {
      ctx.save();
      ctx.translate(shift + copy * W, 0);
      layer.forEach(b => drawBuilding(b, t));
      ctx.restore();
    }
  }

  function maybeShoot() {
    if (Math.random() < 0.005 && shoots.length < 3) {
      shoots.push({
        x: Math.random() * W | 0,
        y: Math.random() * 80 | 0,
        life: 0, maxLife: 25 + (Math.random() * 18) | 0,
        dx: 2 + Math.random() * 2.5,
        dy: 0.4 + Math.random() * 1.2,
      });
    }
  }

  function drawShoots() {
    for (let i = shoots.length - 1; i >= 0; i--) {
      const s = shoots[i];
      s.life++;
      s.x += s.dx; s.y += s.dy;
      for (let k = 0; k < 12; k++) {
        ctx.fillStyle = k < 2 ? COL.wht : (k < 5 ? COL.cyan : COL.pink);
        ctx.globalAlpha = (1 - k / 12) * 0.95 * starVisForShoots;
        ctx.fillRect((s.x - k * s.dx * 0.5) | 0, (s.y - k * s.dy * 0.5) | 0, 1, 1);
      }
      ctx.globalAlpha = 1;
      if (s.life > s.maxLife || s.x > W || s.y > H) shoots.splice(i, 1);
    }
  }

  function drawDistantMountains(t) {
    const ridges = [
      { y: 214, color: '#06172b', alpha: 0.72, offset: 0.018, peaks: [[0, 28], [70, -8], [142, 18], [218, -20], [308, 8], [392, -28], [480, 12], [562, -14], [640, 22]] },
      { y: 232, color: '#08243a', alpha: 0.86, offset: 0.028, peaks: [[0, 16], [54, -18], [136, 10], [224, -26], [318, 22], [430, -16], [544, 12], [640, -20]] },
    ];
    ridges.forEach((ridge) => {
      const shift = (t * ridge.offset) % W;
      for (let copy = -1; copy <= 1; copy++) {
        ctx.save();
        ctx.translate(shift + copy * W, 0);
        ctx.globalAlpha = ridge.alpha;
        ctx.fillStyle = ridge.color;
        ctx.beginPath();
        ctx.moveTo(0, ridge.y + 60);
        ridge.peaks.forEach(([x, dy]) => ctx.lineTo(x, ridge.y + dy));
        ctx.lineTo(W, ridge.y + 60);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = COL.cyanDk;
        for (let i = 1; i < ridge.peaks.length - 1; i += 2) {
          const [x, dy] = ridge.peaks[i];
          ctx.fillRect(x - 4, ridge.y + dy + 4, 8, 1);
          ctx.fillRect(x - 2, ridge.y + dy + 6, 4, 1);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    });
  }

  function drawHarborBridge(t) {
    const shift = (t * 0.05) % W;
    for (let copy = -1; copy <= 1; copy++) {
      ctx.save();
      ctx.translate(shift + copy * W, 0);
      const y = 244;
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = COL.cyanDk;
      ctx.fillRect(0, y, W, 2);
      ctx.fillRect(0, y + 9, W, 1);
      for (let x = 26; x < W; x += 128) {
        ctx.fillRect(x, y - 45, 3, 56);
        ctx.fillRect(x + 42, y - 58, 3, 69);
        ctx.fillStyle = COL.magDk;
        ctx.fillRect(x - 8, y - 47, 62, 2);
        ctx.fillStyle = COL.cyanDk;
        for (let k = 0; k < 9; k++) {
          const cx = x + k * 8;
          const drop = Math.abs(k - 4) * 5;
          ctx.fillRect(cx, y - 40 + drop, 1, 40 - drop);
        }
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = COL.yel;
      for (let x = 4; x < W; x += 38) ctx.fillRect(x, y + 4, 2, 1);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }


  // ---------- LIGHTNING / NEON FLICKER OVERLAY ----------
  function drawCRTFlicker(t) {
    const scanY = (t * 0.8) % H;
    ctx.fillStyle = COL.cyan;
    ctx.globalAlpha = 0.05;
    ctx.fillRect(0, scanY | 0, W, 2);
    ctx.globalAlpha = 1;
  }

  // ---------- Visitor-local sky (sun / moon / star dim) ----------
  function getSolarState() {
    const env = window.CityEnvironment;
    if (env && typeof env.getLocalSolar === 'function') return env.getLocalSolar();
    const d = new Date();
    const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    let dayT = 0;
    if (hour >= 4 && hour <= 20) dayT = (hour - 4) / 16;
    const sunAlt = Math.sin(dayT * Math.PI);
    const sunAngle = dayT * Math.PI;
    const sunX = 70 + Math.sin(sunAngle) * (W - 140);
    const sunY = 125 - Math.sin(sunAngle) * 88;
    const starVisibility = Math.max(0, Math.min(1, 1 - Math.max(0, Math.min(1, (sunAlt - 0.08) / 0.37))));
    const showSun = hour >= 5.2 && hour <= 19.8 && sunAlt > 0.04;
    const moonAngle = sunAngle + Math.PI;
    return {
      starVisibility,
      sun: { x: sunX, y: sunY, r: 15, show: showSun },
      moon: { x: 70 + Math.sin(moonAngle) * (W - 140), y: 125 - Math.sin(moonAngle) * 88, r: 16, show: starVisibility > 0.28 && !showSun },
    };
  }

  function drawSolarBodies(ctx2, solar) {
    const env = window.CityEnvironment;
    if (env && env.drawSun && env.drawMoon) {
      env.drawSun(ctx2, solar.sun);
      env.drawMoon(ctx2, solar.moon);
      return;
    }
    if (solar.sun && solar.sun.show) {
      ctx2.fillStyle = 'rgba(255,252,220,0.9)';
      ctx2.beginPath();
      ctx2.arc(solar.sun.x, solar.sun.y, solar.sun.r * 0.55, 0, Math.PI * 2);
      ctx2.fill();
    }
    if (solar.moon && solar.moon.show) {
      const m = solar.moon;
      for (let dy = -m.r; dy <= m.r; dy++) {
        for (let dx = -m.r; dx <= m.r; dx++) {
          if (dx * dx + dy * dy <= m.r * m.r) {
            ctx2.fillStyle = (dx * dx + dy * dy > (m.r - 2) * (m.r - 2)) ? '#7fc0de' : '#d9f8ff';
            ctx2.fillRect((m.x + dx) | 0, (m.y + dy) | 0, 1, 1);
          }
        }
      }
    }
  }

  // Shooting stars fade with daylight (updated each frame).
  let starVisForShoots = 1;

  // ---------- MAIN LOOP ----------
  let T = 0;
  function frame() {
    T++;
    cityT += citySpeed;
    ctx = skyCtx;
    baseTransform();
    const solar = getSolarState();
    starVisForShoots = solar.starVisibility;
    // sky baseline
    ctx.drawImage(sky, 0, 0);

    const env = window.CityEnvironment;
    if (env && typeof env.applyDynamicSkyBeforeStars === 'function') {
      env.applyDynamicSkyBeforeStars(ctx, solar);
    }

    // Twinkle stars (dimmed by local daylight)
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const f = 0.5 + 0.5 * Math.sin(T * s.speed + s.phase);
      if (f > 0.32) {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = f * solar.starVisibility;
        ctx.fillRect(s.x, s.y, 1, 1);
        if (s.big && f > 0.7) {
          ctx.globalAlpha *= 0.85;
          ctx.fillRect(s.x - 1, s.y, 1, 1);
          ctx.fillRect(s.x + 1, s.y, 1, 1);
          ctx.fillRect(s.x, s.y - 1, 1, 1);
          ctx.fillRect(s.x, s.y + 1, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    drawSolarBodies(ctx, solar);

    maybeShoot();
    drawShoots();
    drawDistantMountains(cityT);

    // Keep the original skyline live until the WebGL renderer confirms success.
    if (!city3DReady) {
      drawScrollingLayer(layer1, cityT, 0.035);
      drawScrollingLayer(layer2, cityT, 0.06);
      drawHarborBridge(cityT);
      drawScrollingLayer(layer3, cityT, 0.1);
      drawScrollingLayer(layer4, cityT, 0.16);
    }

    ctx = foregroundCtx;
    baseTransform();
    ctx.clearRect(0, 0, W, H);

    // CRT flicker
    drawCRTFlicker(T);

    drawThemePulse();
    drawThemeWash();

    requestAnimationFrame(frame);
  }

  function refreshStarColors() {
    const starAlt = window.PhosphorTheme
      ? PhosphorTheme.get(phosphorThemeName).starAlt
      : '#89c8e8';
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.color = Math.random() < 0.18 ? COL.cyan
        : (Math.random() < 0.28 ? starAlt : (Math.random() < 0.34 ? COL.pink : COL.wht));
    }
  }

  function drawThemeWash() {
    if (!themeWash) return;
    ctx.fillStyle = themeWash.color;
    ctx.globalCompositeOperation = themeWash.blend || 'soft-light';
    ctx.globalAlpha = themeWash.alpha;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function applyPhosphorTheme(name, previous) {
    const prev = previous !== undefined ? previous : lastPhosphorTheme;
    if (prev !== name) remapCityScene(prev, name);
    syncColFromTheme(name);
    rebakeSky();
    refreshStarColors();
    triggerThemePulse();
    triggerThemeSweep();
    lastPhosphorTheme = name;
  }

  window.CityBackground = { applyPhosphorTheme };

  window.addEventListener('city-3d-ready', (e) => {
    city3DReady = Boolean(e.detail && e.detail.ready);
  });

  window.addEventListener('phosphor-theme', (e) => {
    if (e.detail && e.detail.theme) {
      applyPhosphorTheme(e.detail.theme, e.detail.previous);
    }
  });

  frame();
})();
