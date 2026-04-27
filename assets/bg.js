// Pixel synthwave city — high-detail edition.
// Renders at 640x360, scaled up via image-rendering: pixelated.
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 640, H = 360;
  canvas.width = W;
  canvas.height = H;

  function fit() {
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  fit();
  window.addEventListener('resize', fit);

  // ---------- PALETTE ----------
  const COL = {
    sky1: [6, 2, 22],
    sky2: [22, 8, 60],
    sky3: [60, 18, 100],
    sky4: [140, 30, 130],
    sky5: [220, 60, 160],
    sky6: [255, 130, 90],
    cyan: '#3dfce5',
    cyanDk: '#1f8a85',
    mag:  '#ff4ad6',
    magDk:'#a91e8c',
    pink: '#ff8fd2',
    yel:  '#ffe66d',
    org:  '#ff8a3a',
    red:  '#ff4060',
    wht:  '#ffffff',
    grnLed: '#7dffb0',
    bld1: '#0c0322',  // far
    bld2: '#1d0640',
    bld3: '#2d0a55',
    bld4: '#3d0e6b',  // near
    bld5: '#4f1480',
    glassBlue: '#2a1865',
    streetDark: '#0a0218',
    streetMid:  '#180630',
  };

  // 4x4 Bayer matrix for dithered gradients
  const BAYER = [
    [ 0, 8, 2,10],
    [12, 4,14, 6],
    [ 3,11, 1, 9],
    [15, 7,13, 5],
  ];
  function lerp(a,b,t){return a+(b-a)*t;}
  function mix(c1,c2,t){return [lerp(c1[0],c2[0],t),lerp(c1[1],c2[1],t),lerp(c1[2],c2[2],t)];}

  // ---------- STARS (multi-layer) ----------
  const stars = [];
  for (let i = 0; i < 220; i++) {
    stars.push({
      x: (Math.random() * W) | 0,
      y: (Math.random() * H * 0.55) | 0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.09,
      color: Math.random() < 0.12 ? COL.cyan : (Math.random() < 0.25 ? COL.pink : (Math.random() < 0.4 ? '#fff7d0' : COL.wht)),
      big: Math.random() < 0.06,
    });
  }

  // ---------- BUILDINGS ----------
  // Each building has a deterministic seed for windows so they don't reshuffle every frame.
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
        kind: Math.random() < 0.15 ? 'tower' : (Math.random() < 0.3 ? 'pyramid' : 'block'),
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
          if (Math.random() < opts.winDensity) {
            // Window color biased per building
            const roll = Math.random();
            let col;
            if (roll < 0.55) col = COL.yel;
            else if (roll < 0.75) col = COL.cyan;
            else if (roll < 0.9) col = COL.pink;
            else col = COL.org;
            b.windows.push({
              x: b.x + 2 + c * (winW + gapX),
              y: b.y + 4 + r * (winH + gapY),
              w: winW, h: winH,
              color: col,
              phase: Math.random() * Math.PI * 2,
              speed: 0.005 + Math.random() * 0.04,
              alwaysOn: Math.random() < 0.55,
            });
          }
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
      // Holographic sign on bigger buildings
      if (h > 60 && w > 26 && Math.random() < 0.35) {
        const signs = ['NEO', 'SIN', 'BAR', 'RAMEN', 'ICE', 'NULL', 'ZERO', '88', 'KAI', 'MAX', 'LIVE', 'BIT'];
        b.sign = {
          text: signs[(Math.random() * signs.length) | 0],
          y: b.y + 8 + (Math.random() * (h - 30)) | 0,
          color: Math.random() < 0.5 ? COL.mag : (Math.random() < 0.5 ? COL.cyan : COL.yel),
          flicker: Math.random() * Math.PI * 2,
        };
      }
      out.push(b);
      x += w + ((opts.gapMin + Math.random() * opts.gapRange) | 0);
    }
    return out;
  }

  // 4 building layers for parallax depth
  const layer1 = mkLayer({ // farthest, behind moon
    wMin: 8, wMax: 18, hMin: 22, hMax: 55, baseY: 200,
    color: COL.bld1, winDensity: 0.32,
    winW: 2, winH: 2, gapX: 2, gapY: 2,
    gapMin: 1, gapRange: 3,
  });
  const layer2 = mkLayer({
    wMin: 14, wMax: 26, hMin: 35, hMax: 90, baseY: 230,
    color: COL.bld2, winDensity: 0.4,
    winW: 2, winH: 3, gapX: 2, gapY: 2,
    gapMin: 2, gapRange: 4,
  });
  const layer3 = mkLayer({
    wMin: 22, wMax: 42, hMin: 60, hMax: 130, baseY: 265,
    color: COL.bld3, winDensity: 0.42,
    winW: 3, winH: 3, gapX: 2, gapY: 3,
    gapMin: 3, gapRange: 5,
  });
  const layer4 = mkLayer({ // closest
    wMin: 36, wMax: 70, hMin: 80, hMax: 180, baseY: 305,
    color: COL.bld4, winDensity: 0.4,
    winW: 3, winH: 4, gapX: 3, gapY: 3,
    gapMin: 4, gapRange: 8,
  });

  // ---------- VEHICLES (flying cars w/ multiple shapes) ----------
  const vehicles = [];
  function spawnVehicles() {
    const types = [
      { sz: 5, h: 2, palette: [COL.cyan, COL.mag] },
      { sz: 4, h: 2, palette: [COL.yel, COL.org] },
      { sz: 7, h: 3, palette: [COL.pink, COL.mag] },
      { sz: 3, h: 1, palette: [COL.cyan, COL.pink] },
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
      sp: (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.28),
      y: SIDEWALK_Y + (Math.random() < 0.5 ? -2 : 0), // upper or lower sidewalk row
      hatColor: pickPersonColor(),
      bodyColor: pickPersonColor(),
      legColor: '#1a0a35',
      step: Math.random() * 4,
      tall: Math.random() < 0.4 ? 9 : 8,
    });
  }
  function pickPersonColor() {
    const opts = [COL.cyan, COL.mag, COL.yel, COL.org, COL.pink, COL.red, '#9d6bff', '#ff8a3a', '#7dffb0'];
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
    else               col = [12, 4, 30];

    for (let x = 0; x < W; x++) {
      const b = BAYER[y & 3][x & 3] - 7.5;
      const i = (y * W + x) * 4;
      skyImg.data[i]   = Math.max(0, Math.min(255, col[0] + b * 0.7));
      skyImg.data[i+1] = Math.max(0, Math.min(255, col[1] + b * 0.7));
      skyImg.data[i+2] = Math.max(0, Math.min(255, col[2] + b * 0.7));
      skyImg.data[i+3] = 255;
    }
  }
  sctx.putImageData(skyImg, 0, 0);

  // ----- Big setting sun with bands -----
  const sunCx = 320, sunCy = 200, sunR = 60;
  for (let y = -sunR; y <= sunR; y++) {
    const yy = sunCy + y;
    if (yy >= 245) break;
    const w = Math.sqrt(sunR * sunR - y * y) | 0;
    // Stripe gaps
    const stripeMod = (y + sunR);
    const isGap = stripeMod > sunR && (stripeMod % 6 < 2);
    if (isGap) continue;
    // Top→bottom color
    const t = (y + sunR) / (sunR * 2);
    const r = lerp(255, 255, t);
    const g = lerp(220, 60, t);
    const b = lerp(140, 200, t);
    sctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
    sctx.fillRect(sunCx - w, yy, w * 2, 1);
  }
  // Sun outline glow
  sctx.globalAlpha = 0.3;
  for (let i = 0; i < 6; i++) {
    sctx.strokeStyle = '#ff8fd2';
    sctx.beginPath();
    sctx.arc(sunCx, sunCy, sunR + i, 0, Math.PI, true);
    sctx.stroke();
  }
  sctx.globalAlpha = 1;

  // ----- Moon (small, upper-left, behind clouds) -----
  const moon = { x: 110, y: 60, r: 18 };
  for (let dy = -moon.r; dy <= moon.r; dy++) {
    for (let dx = -moon.r; dx <= moon.r; dx++) {
      const d2 = dx*dx + dy*dy;
      if (d2 > moon.r * moon.r) continue;
      const bd = BAYER[(moon.y+dy) & 3][(moon.x+dx) & 3];
      let c;
      if (d2 > (moon.r-2)*(moon.r-2)) c = '#ffd0a0';
      else if (bd > 7) c = '#fff0d0';
      else c = '#ffd8a0';
      sctx.fillStyle = c;
      sctx.fillRect(moon.x + dx, moon.y + dy, 1, 1);
    }
  }
  // craters
  [[-6,-3,2],[4,4,2],[-3,7,2],[6,-5,1],[1,-1,1]].forEach(([cx,cy,cr]) => {
    for (let dy=-cr;dy<=cr;dy++) for (let dx=-cr;dx<=cr;dx++) {
      if (dx*dx+dy*dy<=cr*cr) {
        sctx.fillStyle = '#caa070';
        sctx.fillRect(moon.x+cx+dx, moon.y+cy+dy, 1, 1);
      }
    }
  });

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
  drawCloud(20, 95, 90, '#9d4dc0', 0.55);
  drawCloud(170, 110, 60, '#c060d0', 0.5);
  drawCloud(380, 90, 110, '#6d2d8a', 0.6);
  drawCloud(500, 130, 70, '#a040b0', 0.45);
  drawCloud(60, 160, 50, '#ff6dc0', 0.35);
  drawCloud(420, 175, 80, '#ff7dcd', 0.3);

  // Horizon glow line
  const glowG = sctx.createLinearGradient(0, 240, 0, 270);
  glowG.addColorStop(0, 'rgba(255, 110, 200, 0)');
  glowG.addColorStop(0.5, 'rgba(255, 110, 200, 0.85)');
  glowG.addColorStop(1, 'rgba(255, 110, 200, 0)');
  sctx.fillStyle = glowG;
  sctx.fillRect(0, 240, W, 30);
  // Sharp horizon line
  sctx.fillStyle = '#ff4ad6';
  sctx.fillRect(0, 246, W, 1);
  sctx.fillStyle = '#ff8fd2';
  sctx.globalAlpha = 0.7;
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

  function drawBuilding(b, t, parallax) {
    const ox = -((t * parallax) % (W + 200));
    const x = b.x; // we keep buildings static, parallax handled via scrolling layer separately if desired
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
    } else {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    // accent top
    ctx.fillStyle = b.accent;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(b.x, b.y, b.w, 1);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(b.x, b.y, 1, b.h);
    ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
    ctx.globalAlpha = 1;

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
      drawSignText(b.x + 2, b.sign.y, b.sign.text, b.sign.color, t, b.sign.flicker);
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
        ctx.globalAlpha = (1 - k / 12) * 0.95;
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
  stc.fillStyle = '#150828';
  stc.fillRect(0, 0, W, 7);
  stc.fillStyle = '#1f0d3a';
  stc.fillRect(0, 0, W, 1);
  // Sidewalk tile lines
  stc.fillStyle = '#2a1452';
  for (let x = 0; x < W; x += 6) stc.fillRect(x, 3, 1, 4);
  stc.fillStyle = '#0a0218';
  // Street body
  stc.fillRect(0, 7, W, H - SIDEWALK_Y + 13);
  // Center dashed line
  stc.fillStyle = COL.yel;
  for (let x = 4; x < W; x += 14) stc.fillRect(x, 18, 8, 1);
  // Side stripes
  stc.fillStyle = COL.cyan;
  stc.globalAlpha = 0.4;
  stc.fillRect(0, 26, W, 1);
  stc.globalAlpha = 1;
  // neon street reflection
  stc.fillStyle = COL.mag;
  stc.globalAlpha = 0.06;
  for (let y = 8; y < 30; y++) stc.fillRect(0, y, W, 1);
  stc.globalAlpha = 1;

  function drawStreet(t) {
    ctx.drawImage(streetBg, 0, SIDEWALK_Y);
    // Animated reflective shimmer
    ctx.globalAlpha = 0.05 + 0.05 * Math.sin(t * 0.04);
    ctx.fillStyle = COL.cyan;
    ctx.fillRect(0, SIDEWALK_Y + 8, W, 18);
    ctx.globalAlpha = 1;
  }

  // ---------- PEOPLE ----------
  function drawPerson(p, t) {
    p.x += p.sp;
    if (p.x < -8) p.x = W + 8;
    if (p.x > W + 8) p.x = -8;
    p.step += Math.abs(p.sp) * 0.6;
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

  // ---------- MAIN LOOP ----------
  let T = 0;
  function frame() {
    T++;
    // sky baseline
    ctx.drawImage(sky, 0, 0);

    // Twinkle stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const f = 0.5 + 0.5 * Math.sin(T * s.speed + s.phase);
      if (f > 0.32) {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = f;
        ctx.fillRect(s.x, s.y, 1, 1);
        if (s.big && f > 0.7) {
          ctx.fillRect(s.x - 1, s.y, 1, 1);
          ctx.fillRect(s.x + 1, s.y, 1, 1);
          ctx.fillRect(s.x, s.y - 1, 1, 1);
          ctx.fillRect(s.x, s.y + 1, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    maybeShoot();
    drawShoots();

    // Far airships behind buildings
    airships.forEach(a => drawAirship(a, T));

    // Buildings (back to front)
    layer1.forEach(b => drawBuilding(b, T, 0.05));
    layer2.forEach(b => drawBuilding(b, T, 0.1));

    // Train rides at mid-depth
    drawTrain(T);

    layer3.forEach(b => drawBuilding(b, T, 0.2));

    // Flying vehicles (mid)
    vehicles.forEach(v => drawVehicle(v, T));

    layer4.forEach(b => drawBuilding(b, T, 0.4));

    // Drones
    droids.forEach(d => drawDroid(d, T));

    // Street + people + cars
    drawStreet(T);
    groundCars.forEach(c => drawGroundCar(c, T));
    people.forEach(p => drawPerson(p, T));

    // CRT flicker
    drawCRTFlicker(T);

    requestAnimationFrame(frame);
  }
  frame();
})();
