// Pixel synthwave city — signature skyline edition.
// Renders the 640x360 artboard into a dense backing canvas for sharper pixel detail.
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 640, H = 360;
  const RENDER_SCALE = 4;
  let citySpeed = 1;
  let cityT = 0;
  canvas.width = W * RENDER_SCALE;
  canvas.height = H * RENDER_SCALE;
  ctx.imageSmoothingEnabled = false;

  function fit() {
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  fit();
  window.addEventListener('resize', fit);

  const speedInput = document.getElementById('city-speed');
  const speedValue = document.getElementById('city-speed-value');
  function setCitySpeed(value) {
    citySpeed = Math.max(0, Math.min(2.5, Number(value) || 0));
    if (speedValue) speedValue.textContent = `${citySpeed.toFixed(1)}x`;
    try { localStorage.setItem('citySpeed', String(citySpeed)); } catch (_) {}
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

  // 8x8 Bayer matrix gives richer "more bits" gradients without smoothing.
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
  const BUILDING_NAMES = ['PEAK', 'MUNOZ', 'DREE', 'AETHER', 'KAI', 'NOVA', 'CMU', 'BYTE', 'ORBIT', 'VOLT', 'LUMA', 'NEON', 'ATLAS', 'VANTA', 'HEX', 'SORA'];
  const WINDOW_PALETTES = [
    [COL.yel, '#9bdcf4', '#d9f8ff'],
    [COL.cyan, COL.blue, '#86d8ff'],
    [COL.pink, COL.mag, '#b96fa6'],
    [COL.grnLed, COL.cyan, '#5bb9d6'],
    ['#7aa9d8', '#315f88', '#b8ecff'],
  ];
  function mkLayer(opts) {
    const out = [];
    let x = -10;
    while (x < W + 20) {
      const w = (opts.wMin + Math.random() * (opts.wMax - opts.wMin)) | 0;
      const h = (opts.hMin + Math.random() * (opts.hMax - opts.hMin)) | 0;
      const kinds = ['block', 'pyramid', 'tower', 'spire', 'slant', 'pagoda', 'notched', 'needle', 'stacked', 'scaffold', 'billboard', 'twin'];
      const b = {
        x, y: opts.baseY - h, w, h,
        color: opts.color,
        accent: Math.random() < 0.5 ? COL.mag : COL.cyan,
        windows: [],
        kind: kinds[(Math.random() * kinds.length) | 0],
        ribs: Math.random() < 0.55,
        crown: Math.random() < 0.45,
        windowStyle: pick(['sparse', 'stripes', 'clusters', 'vertical', 'lobby']),
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
      const winW = opts.winW || 3;
      const winH = opts.winH || 3;
      const gapX = opts.gapX || 2;
      const gapY = opts.gapY || 2;
      const cols = Math.max(1, Math.floor((w - 4) / (winW + gapX)));
      const rows = Math.max(1, Math.floor((h - 6) / (winH + gapY)));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let density = opts.winDensity;
          if (b.windowStyle === 'stripes') density *= (r % 3 === 0) ? 1.75 : 0.32;
          if (b.windowStyle === 'clusters') density *= ((c + r) % 4 < 2) ? 1.35 : 0.22;
          if (b.windowStyle === 'vertical') density *= (c % 3 === 0) ? 1.55 : 0.28;
          if (b.windowStyle === 'lobby') density *= r > rows * 0.7 ? 1.65 : 0.38;
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
        const signs = Math.random() < 0.55 ? BUILDING_NAMES : ['NEO', 'SIN', 'BAR', 'RAMEN', 'ICE', 'NULL', 'ZERO', '88', 'KAI', 'MAX', 'LIVE', 'BIT'];
        b.sign = {
          text: signs[(Math.random() * signs.length) | 0],
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

  // 4 building layers for parallax depth
  const layer1 = mkLayer({ // farthest, behind moon
    wMin: 7, wMax: 18, hMin: 24, hMax: 78, baseY: 202,
    color: COL.bld1, winDensity: 0.16,
    winW: 1, winH: 2, gapX: 2, gapY: 2,
    gapMin: 0, gapRange: 2,
  });
  const layer2 = mkLayer({
    wMin: 12, wMax: 30, hMin: 42, hMax: 116, baseY: 232,
    color: COL.bld2, winDensity: 0.2,
    winW: 2, winH: 2, gapX: 2, gapY: 3,
    gapMin: 1, gapRange: 3,
  });
  const layer3 = mkLayer({
    wMin: 20, wMax: 46, hMin: 76, hMax: 162, baseY: 270,
    color: COL.bld3, winDensity: 0.22,
    winW: 2, winH: 3, gapX: 3, gapY: 3,
    gapMin: 2, gapRange: 4,
  });
  const layer4 = mkLayer({ // closest
    wMin: 32, wMax: 72, hMin: 72, hMax: 168, baseY: 308,
    color: COL.bld4, winDensity: 0.2,
    winW: 3, winH: 4, gapX: 3, gapY: 3,
    gapMin: 2, gapRange: 6,
  });

  // ---------- VEHICLES (flying cars w/ multiple shapes) ----------
  const vehicles = [];
  function spawnVehicles() {
    const types = [
      { sz: 5, h: 2, palette: [COL.cyan, COL.mag] },
      { sz: 4, h: 2, palette: [COL.blue, COL.cyanDk] },
      { sz: 7, h: 3, palette: [COL.pink, COL.mag] },
      { sz: 3, h: 1, palette: [COL.cyan, COL.blue] },
    ];
    for (let i = 0; i < 9; i++) {
      const t = types[(Math.random() * types.length) | 0];
      const dir = Math.random() < 0.5 ? 1 : -1;
      vehicles.push({
        x: Math.random() * W,
        y: 30 + Math.random() * 130,
        sp: dir * (0.3 + Math.random() * 0.9),
        col: t.palette[0],
        trail: t.palette[1],
        sz: t.sz, hgt: t.h,
        depth: 0.3 + Math.random() * 0.7, // affects alpha + size
      });
    }
  }
  spawnVehicles();

  // Big airships (slow, large)
  const airships = [
    { x: -120, y: 75, sp: 0.08, w: 32, h: 7, body: COL.bld5, glow: COL.mag, sign: 'KAI-CORP' },
    { x: W + 80, y: 110, sp: -0.05, w: 28, h: 6, body: COL.bld3, glow: COL.cyan, sign: 'SYS//07' },
  ];

  // ---------- DRONES / DROIDS ----------
  const droids = [];
  for (let i = 0; i < 7; i++) {
    droids.push({
      x: Math.random() * W,
      y: 25 + Math.random() * 140,
      dx: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.12),
      bob: Math.random() * Math.PI * 2,
      bobSp: 0.05 + Math.random() * 0.07,
      kind: Math.random() < 0.5 ? 'orb' : 'box',
    });
  }

  // ---------- STREET / SIDEWALK / PEOPLE ----------
  // Street is at the front near the bottom.
  const STREET_Y = 312;
  const SIDEWALK_Y = 305;
  const STREET_BOT = 360;

  // Walking people (animated 4-frame)
  const people = [];
  for (let i = 0; i < 14; i++) {
    people.push({
      x: Math.random() * W,
      sp: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.12),
      y: SIDEWALK_Y + (Math.random() < 0.5 ? -2 : 0), // upper or lower sidewalk row
      hatColor: pickPersonColor(),
      bodyColor: pickPersonColor(),
      legColor: '#1a0a35',
      step: Math.random() * 4,
      tall: Math.random() < 0.4 ? 9 : 8,
    });
  }
  function pickPersonColor() {
    const opts = [COL.cyan, COL.mag, COL.yel, COL.blue, COL.pink, COL.red, COL.violet, COL.grnLed];
    return opts[(Math.random() * opts.length) | 0];
  }

  // Ground vehicles (cars on the street)
  const groundCars = [];
  for (let i = 0; i < 5; i++) {
    groundCars.push({
      x: Math.random() * W,
      sp: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7),
      color: pickPersonColor(),
      headlight: Math.random() < 0.5 ? COL.yel : COL.cyan,
      taillight: COL.red,
    });
  }

  const robots = [];
  for (let i = 0; i < 8; i++) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    robots.push({
      x: Math.random() * W,
      y: SIDEWALK_Y + (Math.random() < 0.58 ? -8 : 5),
      sp: dir * (0.045 + Math.random() * 0.08),
      body: pick([COL.cyanDk, COL.blue, COL.violet, COL.bld5, COL.magDk]),
      glow: pick([COL.cyan, COL.mag, COL.yel, COL.grnLed, COL.violet]),
      eye: pick([COL.mag, COL.cyan, COL.yel]),
      kind: pick(['tread', 'walker', 'antenna', 'delivery']),
      bob: Math.random() * Math.PI * 2,
      phase: Math.random() * 80,
    });
  }

  const buses = [
    { x: -90, y: STREET_Y + 20, sp: 0.28, body: COL.bld5, stripe: COL.yel, route: '88' },
    { x: W + 120, y: STREET_Y + 7, sp: -0.22, body: COL.bld4, stripe: COL.cyan, route: 'NK' },
  ];

  const streetProps = [
    { kind: 'trafficLight', x: 78, y: SIDEWALK_Y - 25, phase: 0 },
    { kind: 'trafficLight', x: 562, y: SIDEWALK_Y - 25, phase: 42 },
    { kind: 'subway', x: 416, y: SIDEWALK_Y - 33, label: 'MTR' },
    { kind: 'busStop', x: 518, y: SIDEWALK_Y - 27, label: 'BUS' },
    { kind: 'door', x: 34, y: SIDEWALK_Y - 30, label: '24H' },
    { kind: 'door', x: 172, y: SIDEWALK_Y - 28, label: 'BAR' },
    { kind: 'door', x: 296, y: SIDEWALK_Y - 29, label: 'RAM' },
    { kind: 'sign', x: 246, y: SIDEWALK_Y - 42, label: 'OPEN' },
    { kind: 'sign', x: 360, y: SIDEWALK_Y - 46, label: 'NOODLES' },
  ];

  const overpassPanels = [];
  for (let x = -40; x < W + 80; x += 44 + ((Math.random() * 30) | 0)) {
    overpassPanels.push({
      x,
      y: 214 + ((Math.random() * 46) | 0),
      w: 18 + ((Math.random() * 46) | 0),
      h: 8 + ((Math.random() * 18) | 0),
      label: pick(['PEAK', 'KAI', 'VOLT', 'HEX', 'CMU', 'DREE', 'SORA', '24H']),
      color: pick([COL.cyan, COL.mag, COL.blue]),
    });
  }

  // ---------- SHOOTING STARS ----------
  const shoots = [];

  // ---------- PRE-BAKED SKY ----------
  const sky = document.createElement('canvas');
  sky.width = W; sky.height = H;
  const sctx = sky.getContext('2d');
  const skyImg = sctx.createImageData(W, H);

  // Multi-stop dithered gradient
  for (let y = 0; y < H; y++) {
    let col;
    if (y < 70)        col = mix(COL.sky1, COL.sky2, y / 70);
    else if (y < 140)  col = mix(COL.sky2, COL.sky3, (y - 70) / 70);
    else if (y < 200)  col = mix(COL.sky3, COL.sky4, (y - 140) / 60);
    else if (y < 230)  col = mix(COL.sky4, COL.sky5, (y - 200) / 30);
    else if (y < 245)  col = mix(COL.sky5, COL.sky6, (y - 230) / 15);
    else               col = [2, 9, 18];

    for (let x = 0; x < W; x++) {
      const b = (BAYER[y & 7][x & 7] - 31.5) / 4;
      const i = (y * W + x) * 4;
      skyImg.data[i]   = Math.max(0, Math.min(255, col[0] + b * 0.7));
      skyImg.data[i+1] = Math.max(0, Math.min(255, col[1] + b * 0.7));
      skyImg.data[i+2] = Math.max(0, Math.min(255, col[2] + b * 0.7));
      skyImg.data[i+3] = 255;
    }
  }
  sctx.putImageData(skyImg, 0, 0);

  // ----- Cold urban haze, inspired by rainy blue cyberpunk city light -----
  for (let y = 84; y < 250; y++) {
    const t = (y - 84) / 166;
    const width = (190 + Math.sin(y * 0.08) * 24 + t * 160) | 0;
    sctx.fillStyle = `rgba(71, 217, 255, ${0.018 + t * 0.045})`;
    sctx.fillRect((W - width) / 2, y, width, 1);
  }
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() * W) | 0;
    const y = 92 + ((Math.random() * 145) | 0);
    const h = 16 + ((Math.random() * 58) | 0);
    sctx.fillStyle = Math.random() < 0.78 ? 'rgba(71,217,255,0.08)' : 'rgba(255,63,166,0.07)';
    sctx.fillRect(x, y, 1 + ((Math.random() * 2) | 0), h);
  }

  // Moon is drawn each frame from visitor-local solar data (city-environment.js).

  // ----- Clouds (long horizontal pixel strips) -----
  function drawCloud(x, y, w, c, alpha=0.5) {
    sctx.fillStyle = c;
    sctx.globalAlpha = alpha;
    for (let i = 0; i < w; i++) {
      const h = (Math.sin(i * 0.3) + 1) * 1.2 + 1;
      sctx.fillRect(x + i, y - (h | 0), 1, (h | 0));
    }
    sctx.globalAlpha = 1;
  }
  drawCloud(20, 95, 110, '#16496a', 0.55);
  drawCloud(150, 116, 72, '#235d7d', 0.48);
  drawCloud(355, 88, 128, '#123d5e', 0.62);
  drawCloud(500, 132, 86, '#1d5372', 0.42);
  drawCloud(54, 162, 64, '#2a6f92', 0.28);
  drawCloud(412, 176, 96, '#25617f', 0.26);

  // Horizon glow line
  const glowG = sctx.createLinearGradient(0, 230, 0, 278);
  glowG.addColorStop(0, 'rgba(71, 217, 255, 0)');
  glowG.addColorStop(0.42, 'rgba(71, 217, 255, 0.42)');
  glowG.addColorStop(0.68, 'rgba(255, 63, 166, 0.18)');
  glowG.addColorStop(1, 'rgba(71, 217, 255, 0)');
  sctx.fillStyle = glowG;
  sctx.fillRect(0, 230, W, 48);
  // Sharp horizon line
  sctx.fillStyle = COL.cyan;
  sctx.fillRect(0, 246, W, 1);
  sctx.fillStyle = COL.mag;
  sctx.globalAlpha = 0.28;
  sctx.fillRect(0, 247, W, 1);
  sctx.globalAlpha = 1;

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

    // windows
    for (let i = 0; i < b.windows.length; i++) {
      const w = b.windows[i];
      let f;
      if (w.alwaysOn) {
        f = 0.8 + 0.2 * Math.sin(t * w.speed + w.phase);
      } else {
        f = 0.5 + 0.5 * Math.sin(t * w.speed + w.phase);
      }
      if (f > 0.25) {
        ctx.fillStyle = w.color;
        ctx.globalAlpha = Math.min(1, f + 0.15);
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
    }
    ctx.globalAlpha = 1;

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

  function drawVehicle(v, t) {
    v.x += v.sp;
    if (v.sp > 0 && v.x > W + 30) v.x = -30;
    if (v.sp < 0 && v.x < -30) v.x = W + 30;

    const len = (12 + v.sz * 4) | 0;
    const dir = v.sp > 0 ? 1 : -1;
    // Trail
    for (let i = 1; i < len; i++) {
      const tx = v.x - dir * i;
      const a = (1 - i / len) * 0.85 * v.depth;
      ctx.fillStyle = i < 3 ? v.col : v.trail;
      ctx.globalAlpha = a;
      ctx.fillRect(tx | 0, v.y, 1, v.hgt);
    }
    // Faint bloom
    ctx.globalAlpha = 0.18 * v.depth;
    ctx.fillStyle = v.col;
    ctx.fillRect((v.x - dir * 2) | 0, v.y - 1, v.sz + 2, v.hgt + 2);
    ctx.globalAlpha = 1;
    // Body
    ctx.fillStyle = v.col;
    ctx.fillRect(v.x | 0, v.y, v.sz, v.hgt);
    // Headlight bright pixel
    ctx.fillStyle = COL.wht;
    ctx.fillRect((v.x + (dir > 0 ? v.sz - 1 : 0)) | 0, v.y, 1, 1);
  }

  function drawAirship(a, t) {
    a.x += a.sp;
    if (a.sp > 0 && a.x > W + 60) a.x = -a.w - 60;
    if (a.sp < 0 && a.x < -a.w - 60) a.x = W + 60;
    const x = a.x | 0, y = a.y | 0;
    // hull (oval-ish)
    ctx.fillStyle = a.body;
    ctx.fillRect(x + 1, y, a.w - 2, a.h);
    ctx.fillRect(x, y + 1, a.w, a.h - 2);
    // Top stripe
    ctx.fillStyle = a.glow;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x + 2, y, a.w - 4, 1);
    ctx.globalAlpha = 1;
    // Underside cabin
    ctx.fillStyle = COL.bld1;
    ctx.fillRect(x + ((a.w / 2) | 0) - 3, y + a.h, 6, 2);
    // Blinking lights
    const blink = (t | 0) % 60;
    if (blink < 30) {
      ctx.fillStyle = COL.red;
      ctx.fillRect(x + 1, y + ((a.h / 2) | 0), 1, 1);
      ctx.fillRect(x + a.w - 2, y + ((a.h / 2) | 0), 1, 1);
    }
    // Sign on side
    drawSignText(x + 4, y + 1, a.sign, a.glow, t, 0);
  }

  function drawDroid(d, t) {
    d.x += d.dx;
    if (d.x < -10) d.x = W + 10;
    if (d.x > W + 10) d.x = -10;
    d.bob += d.bobSp;
    const by = d.y + Math.sin(d.bob) * 1.8;
    const dx = d.x | 0, dy = by | 0;
    if (d.kind === 'orb') {
      ctx.fillStyle = COL.cyan;
      ctx.fillRect(dx, dy, 2, 2);
      ctx.fillStyle = COL.mag;
      ctx.fillRect(dx + 2, dy + 1, 1, 1);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = COL.cyan;
      ctx.fillRect(dx - 1, dy - 1, 4, 4);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = COL.bld5;
      ctx.fillRect(dx, dy, 4, 3);
      ctx.fillStyle = COL.yel;
      if ((t | 0) % 24 < 12) {
        ctx.fillRect(dx + 1, dy + 1, 1, 1);
        ctx.fillRect(dx + 3, dy + 1, 1, 1);
      }
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

  // ---------- STREET ----------
  const streetBg = document.createElement('canvas');
  streetBg.width = W; streetBg.height = H - SIDEWALK_Y + 20;
  const stc = streetBg.getContext('2d');
  // Sidewalk
  stc.fillStyle = '#071827';
  stc.fillRect(0, 0, W, 7);
  stc.fillStyle = '#123a56';
  stc.fillRect(0, 0, W, 1);
  // Sidewalk tile lines
  stc.fillStyle = '#174b6c';
  for (let x = 0; x < W; x += 6) stc.fillRect(x, 3, 1, 4);
  stc.fillStyle = COL.streetDark;
  // Street body
  stc.fillRect(0, 7, W, H - SIDEWALK_Y + 13);
  // Center dashed line
  stc.fillStyle = COL.cyanDk;
  for (let x = 4; x < W; x += 14) stc.fillRect(x, 18, 8, 1);
  // Side stripes
  stc.fillStyle = COL.cyan;
  stc.globalAlpha = 0.4;
  stc.fillRect(0, 26, W, 1);
  stc.globalAlpha = 1;
  // neon street reflection
  stc.fillStyle = COL.cyan;
  stc.globalAlpha = 0.06;
  for (let y = 8; y < 30; y++) stc.fillRect(0, y, W, 1);
  stc.globalAlpha = 1;

  function drawStreet(t) {
    const shift = (t * 0.18) % W;
    ctx.drawImage(streetBg, shift - W, SIDEWALK_Y);
    ctx.drawImage(streetBg, shift, SIDEWALK_Y);
    // Animated reflective shimmer
    ctx.globalAlpha = 0.05 + 0.05 * Math.sin(t * 0.04);
    ctx.fillStyle = COL.blue;
    ctx.fillRect(0, SIDEWALK_Y + 8, W, 18);
    ctx.globalAlpha = 1;
  }

  function drawTinyLabel(x, y, text, color) {
    ctx.font = '6px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawTrafficLight(x, y, t, phase) {
    ctx.fillStyle = COL.cyanDk;
    ctx.fillRect(x + 3, y + 6, 1, 20);
    ctx.fillRect(x - 2, y + 25, 11, 1);
    ctx.fillStyle = '#07030f';
    ctx.fillRect(x, y, 7, 11);
    ctx.fillStyle = COL.red;
    ctx.globalAlpha = ((t + phase) % 120) < 44 ? 1 : 0.25;
    ctx.fillRect(x + 2, y + 1, 3, 2);
    ctx.fillStyle = COL.cyan;
    ctx.globalAlpha = ((t + phase) % 120) >= 44 && ((t + phase) % 120) < 62 ? 1 : 0.25;
    ctx.fillRect(x + 2, y + 4, 3, 2);
    ctx.fillStyle = COL.grnLed;
    ctx.globalAlpha = ((t + phase) % 120) >= 62 ? 1 : 0.25;
    ctx.fillRect(x + 2, y + 7, 3, 2);
    ctx.globalAlpha = 1;
  }

  function drawSubwayEntrance(x, y, label) {
    ctx.fillStyle = '#080214';
    ctx.fillRect(x, y + 17, 34, 15);
    ctx.fillStyle = COL.cyanDk;
    ctx.fillRect(x - 3, y + 16, 40, 2);
    ctx.fillRect(x + 1, y + 20, 30, 1);
    ctx.fillRect(x + 4, y + 24, 24, 1);
    ctx.fillRect(x + 7, y + 28, 18, 1);
    ctx.fillStyle = COL.mag;
    ctx.fillRect(x + 2, y, 30, 9);
    ctx.fillStyle = COL.yel;
    ctx.fillRect(x + 4, y + 2, 26, 5);
    drawTinyLabel(x + 8, y + 2, label, '#12051f');
    ctx.fillStyle = COL.cyan;
    ctx.fillRect(x + 6, y + 9, 22, 2);
  }

  function drawBusStop(x, y, label) {
    ctx.fillStyle = COL.cyanDk;
    ctx.fillRect(x, y, 1, 27);
    ctx.fillRect(x + 22, y + 4, 1, 23);
    ctx.fillRect(x, y + 4, 23, 1);
    ctx.fillRect(x + 2, y + 18, 18, 1);
    ctx.fillStyle = '#080214';
    ctx.globalAlpha = 0.62;
    ctx.fillRect(x + 2, y + 5, 19, 13);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COL.cyan;
    ctx.fillRect(x - 4, y - 7, 12, 7);
    drawTinyLabel(x - 3, y - 6, label, '#12051f');
  }

  function drawDoor(x, y, label) {
    ctx.fillStyle = '#080214';
    ctx.fillRect(x, y, 24, 30);
    ctx.fillStyle = COL.bld5;
    ctx.fillRect(x + 2, y + 9, 20, 21);
    ctx.fillStyle = COL.cyanDk;
    ctx.fillRect(x + 4, y + 12, 7, 12);
    ctx.fillRect(x + 13, y + 12, 7, 12);
    ctx.fillStyle = COL.mag;
    ctx.fillRect(x - 1, y, 26, 8);
    drawTinyLabel(x + 4, y + 1, label, COL.yel);
  }

  function drawStreetSign(x, y, label, t) {
    ctx.fillStyle = COL.cyanDk;
    ctx.fillRect(x + 2, y + 9, 1, 22);
    ctx.fillStyle = COL.mag;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.06 + x);
    ctx.fillRect(x, y, label.length * 4 + 8, 9);
    ctx.globalAlpha = 1;
    drawTinyLabel(x + 4, y + 2, label, COL.yel);
  }

  function drawStreetProp(p, t) {
    if (p.kind === 'trafficLight') drawTrafficLight(p.x, p.y, t, p.phase);
    else if (p.kind === 'subway') drawSubwayEntrance(p.x, p.y, p.label);
    else if (p.kind === 'busStop') drawBusStop(p.x, p.y, p.label);
    else if (p.kind === 'door') drawDoor(p.x, p.y, p.label);
    else if (p.kind === 'sign') drawStreetSign(p.x, p.y, p.label, t);
  }

  function drawStreetProps(t) {
    const shift = (t * 0.18) % W;
    for (let copy = -1; copy <= 1; copy++) {
      ctx.save();
      ctx.translate(shift + copy * W, 0);
      for (let i = 0; i < streetProps.length; i++) {
        drawStreetProp(streetProps[i], t);
      }
      ctx.restore();
    }
  }

  function drawElevatedRails(t) {
    const shift = (t * 0.12) % W;
    for (let copy = -1; copy <= 1; copy++) {
      ctx.save();
      ctx.translate(shift + copy * W, 0);
      ctx.fillStyle = '#020914';
      ctx.globalAlpha = 0.82;
      ctx.fillRect(0, 226, W, 8);
      ctx.fillRect(0, 252, W, 5);
      ctx.globalAlpha = 1;

      ctx.fillStyle = COL.cyanDk;
      ctx.globalAlpha = 0.38;
      ctx.fillRect(0, 224, W, 1);
      ctx.fillRect(0, 234, W, 1);
      ctx.fillRect(0, 250, W, 1);
      for (let x = 8; x < W; x += 34) {
        ctx.fillRect(x, 210, 2, 72);
        ctx.fillRect(x - 6, 222, 14, 1);
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < overpassPanels.length; i++) {
        const p = overpassPanels[i];
        ctx.fillStyle = '#04101f';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(p.x + 2, p.y + 2, Math.max(3, p.w - 4), Math.max(2, p.h - 4));
        ctx.globalAlpha = 1;
        drawTinyLabel(p.x + 4, p.y + 3, p.label, p.color === COL.mag ? COL.yel : '#020914');
      }
      ctx.restore();
    }
  }

  // ---------- PEOPLE ----------
  function drawPerson(p, t) {
    p.x += p.sp;
    if (p.x < -8) p.x = W + 8;
    if (p.x > W + 8) p.x = -8;
    p.step += Math.abs(p.sp) * 0.35;
    const px = p.x | 0, py = p.y | 0;
    const frame = (p.step | 0) % 4;
    // Hat / hair
    ctx.fillStyle = p.hatColor;
    ctx.fillRect(px, py, 3, 1);
    // Head
    ctx.fillStyle = '#ffd0a0';
    ctx.fillRect(px, py + 1, 3, 2);
    // Body
    ctx.fillStyle = p.bodyColor;
    ctx.fillRect(px, py + 3, 3, 3);
    // Glow halo (city neon)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = p.bodyColor;
    ctx.fillRect(px - 1, py + 3, 5, 3);
    ctx.globalAlpha = 1;
    // Legs (animated)
    ctx.fillStyle = p.legColor;
    if (frame === 0) {
      ctx.fillRect(px, py + 6, 1, 2);
      ctx.fillRect(px + 2, py + 6, 1, 2);
    } else if (frame === 1) {
      ctx.fillRect(px + (p.sp > 0 ? 2 : 0), py + 6, 1, 3);
      ctx.fillRect(px + 1, py + 6, 1, 2);
    } else if (frame === 2) {
      ctx.fillRect(px, py + 6, 1, 2);
      ctx.fillRect(px + 2, py + 6, 1, 2);
    } else {
      ctx.fillRect(px + (p.sp > 0 ? 0 : 2), py + 6, 1, 3);
      ctx.fillRect(px + 1, py + 6, 1, 2);
    }
    // Tall = include taller silhouette (trenchcoat, etc.)
    if (p.tall === 9) {
      ctx.fillStyle = p.bodyColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(px - 1, py + 4, 5, 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawRobot(r, t) {
    r.x += r.sp * citySpeed;
    if (r.x < -18) r.x = W + 18;
    if (r.x > W + 18) r.x = -18;
    r.bob += 0.08;
    const rx = r.x | 0;
    const ry = (r.y + Math.sin(r.bob) * (r.kind === 'walker' ? 1 : 0.35)) | 0;
    const blink = ((t + r.phase) | 0) % 70 < 44;

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = r.glow;
    ctx.fillRect(rx - 2, ry + 9, 13, 3);
    ctx.globalAlpha = 1;

    if (r.kind === 'delivery') {
      ctx.fillStyle = r.body;
      ctx.fillRect(rx, ry + 1, 11, 9);
      ctx.fillStyle = r.glow;
      ctx.fillRect(rx + 2, ry + 3, 7, 3);
      ctx.fillStyle = '#03111f';
      ctx.fillRect(rx + 3, ry + 4, 5, 1);
      ctx.fillStyle = COL.cyanDk;
      ctx.fillRect(rx + 1, ry + 10, 3, 2);
      ctx.fillRect(rx + 7, ry + 10, 3, 2);
    } else {
      ctx.fillStyle = r.body;
      ctx.fillRect(rx + 2, ry + 3, 7, 7);
      ctx.fillRect(rx + 3, ry, 5, 4);
      ctx.fillStyle = r.eye;
      if (blink) {
        ctx.fillRect(rx + 4, ry + 1, 1, 1);
        ctx.fillRect(rx + 7, ry + 1, 1, 1);
      }
      ctx.fillStyle = r.glow;
      ctx.fillRect(rx + 3, ry + 5, 5, 1);
      if (r.kind === 'antenna') {
        ctx.fillRect(rx + 5, ry - 5, 1, 5);
        ctx.fillRect(rx + 4, ry - 6, 3, 1);
      }
      ctx.fillStyle = COL.cyanDk;
      if (r.kind === 'walker') {
        const step = ((t / 12) | 0) % 2;
        ctx.fillRect(rx + 2 + step, ry + 10, 2, 3);
        ctx.fillRect(rx + 7 - step, ry + 10, 2, 3);
      } else {
        ctx.fillRect(rx, ry + 10, 11, 2);
        ctx.fillStyle = '#020914';
        ctx.fillRect(rx + 1, ry + 11, 2, 1);
        ctx.fillRect(rx + 8, ry + 11, 2, 1);
      }
    }
  }

  // ---------- GROUND CARS ----------
  function drawGroundCar(c, t) {
    c.x += c.sp;
    if (c.x < -16) c.x = W + 16;
    if (c.x > W + 16) c.x = -16;
    const cx = c.x | 0;
    const cy = STREET_Y + 14;
    const dir = c.sp > 0 ? 1 : -1;
    // Body
    ctx.fillStyle = c.color;
    ctx.fillRect(cx, cy, 12, 3);
    ctx.fillRect(cx + 2, cy - 2, 8, 2);
    // Window strip
    ctx.fillStyle = COL.cyanDk;
    ctx.fillRect(cx + 3, cy - 1, 6, 1);
    // Wheels
    ctx.fillStyle = '#000';
    ctx.fillRect(cx + 1, cy + 3, 2, 1);
    ctx.fillRect(cx + 9, cy + 3, 2, 1);
    // Headlight beam
    ctx.fillStyle = c.headlight;
    ctx.fillRect(cx + (dir > 0 ? 11 : 0), cy, 1, 1);
    ctx.globalAlpha = 0.35;
    for (let i = 1; i < 12; i++) {
      ctx.fillRect(cx + (dir > 0 ? 11 + i : -i), cy + 1, 1, 1);
    }
    ctx.globalAlpha = 1;
    // Tail
    ctx.fillStyle = c.taillight;
    ctx.fillRect(cx + (dir > 0 ? 0 : 11), cy + 1, 1, 1);
    // Reflection
    ctx.fillStyle = c.color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(cx, cy + 5, 12, 3);
    ctx.globalAlpha = 1;
  }

  function drawBus(bus, t) {
    bus.x += bus.sp;
    if (bus.sp > 0 && bus.x > W + 80) bus.x = -80;
    if (bus.sp < 0 && bus.x < -80) bus.x = W + 80;
    const bx = bus.x | 0;
    const by = bus.y | 0;
    const dir = bus.sp > 0 ? 1 : -1;
    ctx.fillStyle = bus.body;
    ctx.fillRect(bx, by, 44, 11);
    ctx.fillRect(bx + 4, by - 3, 33, 3);
    ctx.fillStyle = bus.stripe;
    ctx.fillRect(bx, by + 8, 44, 1);
    ctx.fillStyle = COL.yel;
    for (let x = 5; x < 34; x += 6) ctx.fillRect(bx + x, by + 2, 4, 4);
    ctx.fillStyle = COL.cyan;
    ctx.fillRect(bx + (dir > 0 ? 39 : 1), by + 2, 3, 3);
    ctx.fillStyle = '#05020c';
    ctx.fillRect(bx + 4, by + 11, 4, 2);
    ctx.fillRect(bx + 33, by + 11, 4, 2);
    ctx.fillStyle = COL.mag;
    ctx.fillRect(bx + 16, by - 2, 10, 2);
    drawTinyLabel(bx + 17, by - 3, bus.route, COL.yel);
    ctx.fillStyle = bus.stripe;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(bx, by + 15, 44, 5);
    ctx.globalAlpha = 1;
  }

  // ---------- TRAIN ----------
  // A maglev train along a track in the mid-distance.
  const train = {
    x: -250, y: 215, sp: 1.4, len: 6, carW: 18, carH: 8, color: COL.bld5, accent: COL.cyan,
  };
  function drawTrain(t) {
    train.x += train.sp;
    if (train.x > W + 50) train.x = -((train.len + 1) * (train.carW + 2));
    // track
    ctx.fillStyle = COL.cyanDk;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, train.y + train.carH + 1, W, 1);
    ctx.globalAlpha = 1;
    for (let i = 0; i < train.len; i++) {
      const cx = train.x + i * (train.carW + 2);
      if (cx > W + 30 || cx < -train.carW) continue;
      // Body
      ctx.fillStyle = train.color;
      ctx.fillRect(cx | 0, train.y, train.carW, train.carH);
      // Windows
      ctx.fillStyle = COL.yel;
      for (let w = 2; w < train.carW - 2; w += 3) {
        ctx.fillRect((cx | 0) + w, train.y + 2, 2, 3);
      }
      // Glow stripe
      ctx.fillStyle = train.accent;
      ctx.fillRect(cx | 0, train.y + train.carH - 1, train.carW, 1);
    }
    // Front headlight
    const head = train.x + train.len * (train.carW + 2);
    if (head > 0 && head < W) {
      ctx.fillStyle = COL.wht;
      ctx.fillRect((head | 0) - 1, train.y + 3, 2, 2);
      // beam
      ctx.fillStyle = COL.yel;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 18; i++) ctx.fillRect((head | 0) + i, train.y + 4 + (i % 2), 1, 1);
      ctx.globalAlpha = 1;
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
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
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

    // Far airships behind buildings
    airships.forEach(a => drawAirship(a, T));

    // Buildings (back to front)
    drawScrollingLayer(layer1, cityT, 0.035);
    drawScrollingLayer(layer2, cityT, 0.06);

    // Train rides at mid-depth
    drawTrain(T);

    drawScrollingLayer(layer3, cityT, 0.1);

    // Elevated rails, cables, and signage add foreground city density.
    drawElevatedRails(cityT);

    // Flying vehicles (mid)
    vehicles.forEach(v => drawVehicle(v, T));

    drawScrollingLayer(layer4, cityT, 0.16);

    // Drones
    droids.forEach(d => drawDroid(d, T));

    // Street + people + cars
    drawStreet(cityT);
    drawStreetProps(cityT);
    buses.forEach(b => drawBus(b, T));
    groundCars.forEach(c => drawGroundCar(c, T));
    people.forEach(p => drawPerson(p, T));
    robots.forEach(r => drawRobot(r, T));

    // CRT flicker
    drawCRTFlicker(T);

    requestAnimationFrame(frame);
  }
  frame();
})();
