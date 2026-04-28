// Pixel synthwave animated background.
// Renders at low res (480x270), scales up with image-rendering:pixelated.
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 480, H = 270;

  function fit() {
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  fit();
  window.addEventListener('resize', fit);

  // Palette
  const COL = {
    sky1: [10, 4, 30],      // deep purple
    sky2: [30, 10, 70],     // mid purple
    sky3: [80, 20, 110],    // horizon purple
    sky4: [155, 40, 120],   // horizon pink
    glow: [255, 100, 200],  // hot pink horizon
    bld1: '#180832',
    bld2: '#2a0d52',
    bld3: '#3d1270',
    cyan: '#3dfce5',
    mag:  '#ff4ad6',
    pink: '#ff8fd2',
    yel:  '#ffe66d',
    org:  '#ff8a3a',
    wht:  '#ffffff',
  };

  // Stars
  const stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push({
      x: (Math.random() * W) | 0,
      y: (Math.random() * H * 0.55) | 0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.08,
      color: Math.random() < 0.15 ? COL.cyan : (Math.random() < 0.3 ? COL.pink : COL.wht),
    });
  }

  // Moon
  const moon = { x: 380, y: 50, r: 22 };

  // Buildings — three depth layers
  function mkLayer(opts) {
    const out = [];
    let x = -10;
    while (x < W + 10) {
      const w = opts.wMin + (Math.random() * (opts.wMax - opts.wMin)) | 0;
      const h = opts.hMin + (Math.random() * (opts.hMax - opts.hMin)) | 0;
      const b = { x, y: opts.baseY - h, w, h, color: opts.color, accent: opts.accent, windows: [] };
      // Windows grid
      const cols = Math.max(1, Math.floor((w - 4) / 4));
      const rows = Math.max(1, Math.floor((h - 4) / 4));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (Math.random() < opts.winDensity) {
            b.windows.push({
              x: b.x + 2 + c * 4,
              y: b.y + 3 + r * 4,
              color: Math.random() < 0.2 ? COL.cyan : (Math.random() < 0.5 ? COL.yel : opts.accent),
              phase: Math.random() * Math.PI * 2,
              speed: 0.01 + Math.random() * 0.04,
            });
          }
        }
      }
      // antenna
      if (Math.random() < 0.4 && h > 30) {
        b.antenna = { x: b.x + ((w / 2) | 0), h: 4 + (Math.random() * 8) | 0 };
      }
      out.push(b);
      x += w + (opts.gapMin + (Math.random() * opts.gapRange) | 0);
    }
    return out;
  }

  const farLayer = mkLayer({
    wMin: 6, wMax: 14, hMin: 18, hMax: 42, baseY: 165,
    color: COL.bld1, accent: COL.mag, winDensity: 0.35, gapMin: 1, gapRange: 4,
  });
  const midLayer = mkLayer({
    wMin: 14, wMax: 28, hMin: 30, hMax: 70, baseY: 195,
    color: COL.bld2, accent: COL.mag, winDensity: 0.4, gapMin: 2, gapRange: 4,
  });
  const nearLayer = mkLayer({
    wMin: 24, wMax: 48, hMin: 55, hMax: 120, baseY: 240,
    color: COL.bld3, accent: COL.cyan, winDensity: 0.38, gapMin: 3, gapRange: 6,
  });

  // Flying vehicles with light trails
  const vehicles = [
    { x: -20, y: 45, sp:  0.5,  col: COL.cyan, trail: COL.mag, sz: 3 },
    { x: W+30,y: 75, sp: -0.32, col: COL.yel,  trail: COL.org, sz: 2 },
    { x: -60, y: 100,sp:  0.22, col: COL.pink, trail: COL.mag, sz: 2 },
    { x: W+20,y: 130,sp: -0.18, col: COL.cyan, trail: COL.pink,sz: 2 },
  ];

  // Drifting droids
  const droids = [
    { x: 60,  y: 30, dx: 0.08, bob: 0,         bobSp: 0.08 },
    { x: 220, y: 58, dx:-0.06, bob: Math.PI,   bobSp: 0.06 },
    { x: 340, y: 22, dx: 0.04, bob: Math.PI/2, bobSp: 0.09 },
    { x: 140, y: 85, dx:-0.05, bob: 1,         bobSp: 0.07 },
  ];

  // Pre-bake sky w/ dithered gradient
  const sky = document.createElement('canvas');
  sky.width = W; sky.height = H;
  const sctx = sky.getContext('2d');
  const img = sctx.createImageData(W, H);

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) { return [lerp(c1[0],c2[0],t), lerp(c1[1],c2[1],t), lerp(c1[2],c2[2],t)]; }

  // Bayer 4x4 threshold matrix for dithered gradient
  const BAYER = [
    [ 0, 8, 2,10],
    [12, 4,14, 6],
    [ 3,11, 1, 9],
    [15, 7,13, 5],
  ];

  for (let y = 0; y < H; y++) {
    let col;
    if (y < 80) col = mix(COL.sky1, COL.sky2, y / 80);
    else if (y < 140) col = mix(COL.sky2, COL.sky3, (y - 80) / 60);
    else if (y < 170) col = mix(COL.sky3, COL.sky4, (y - 140) / 30);
    else col = [20, 6, 40];

    for (let x = 0; x < W; x++) {
      const b = BAYER[y & 3][x & 3] - 7.5;
      const i = (y * W + x) * 4;
      img.data[i]   = Math.max(0, Math.min(255, col[0] + b * 0.6));
      img.data[i+1] = Math.max(0, Math.min(255, col[1] + b * 0.6));
      img.data[i+2] = Math.max(0, Math.min(255, col[2] + b * 0.6));
      img.data[i+3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);

  // Horizon sun/moon: pixelated half-disc with scanline stripes
  sctx.save();
  const sunX = 240, sunY = 140, sunR = 40;
  for (let y = -sunR; y < sunR; y++) {
    const w = Math.sqrt(sunR*sunR - y*y) | 0;
    const yy = sunY + y;
    if (yy > 168) break; // clip at horizon
    // stripes
    if ((yy & 3) === 2 || (yy & 3) === 3) continue; // gap every few rows
    // color gradient top→bot
    const t = (y + sunR) / (sunR * 2);
    const r = lerp(255, 255, t);
    const g = lerp(230, 74,  t);
    const b = lerp(109, 214, t);
    sctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
    sctx.fillRect(sunX - w, yy, w * 2, 1);
  }
  sctx.restore();

  // Moon (small, upper-left)
  for (let dy = -moon.r; dy <= moon.r; dy++) {
    for (let dx = -moon.r; dx <= moon.r; dx++) {
      const d2 = dx*dx + dy*dy;
      if (d2 > moon.r*moon.r) continue;
      if (d2 > (moon.r - 3)*(moon.r - 3)) {
        sctx.fillStyle = '#ffd4a0';
      } else {
        // dithered fill
        const bd = BAYER[(moon.y+dy)&3][(moon.x+dx)&3];
        sctx.fillStyle = bd > 7 ? '#ffe8c0' : '#ffb87a';
      }
      sctx.fillRect(moon.x + dx, moon.y + dy, 1, 1);
    }
  }
  // Craters
  const craters = [[-6,-2,2],[4,3,2],[-2,6,2],[7,-4,1]];
  craters.forEach(([cx,cy,cr]) => {
    for (let dy=-cr;dy<=cr;dy++) for (let dx=-cr;dx<=cr;dx++) {
      if (dx*dx+dy*dy<=cr*cr) {
        sctx.fillStyle = '#c88a4a';
        sctx.fillRect(moon.x+cx+dx, moon.y+cy+dy, 1, 1);
      }
    }
  });

  // Horizon glow line
  const glowGrad = sctx.createLinearGradient(0, 160, 0, 180);
  glowGrad.addColorStop(0, 'rgba(255,100,200,0)');
  glowGrad.addColorStop(0.5, 'rgba(255,100,200,0.7)');
  glowGrad.addColorStop(1, 'rgba(255,100,200,0)');
  sctx.fillStyle = glowGrad;
  sctx.fillRect(0, 160, W, 20);

  // ------- GROUND grid (static) -------
  // A static part with perspective lines
  const ground = document.createElement('canvas');
  ground.width = W; ground.height = H;
  const gctx = ground.getContext('2d');
  // Solid dark ground
  gctx.fillStyle = '#160630';
  gctx.fillRect(0, 170, W, H - 170);
  // Horizon strip
  gctx.fillStyle = '#ff4ad6';
  gctx.fillRect(0, 169, W, 1);
  gctx.fillStyle = '#ff8fd2';
  gctx.globalAlpha = 0.5;
  gctx.fillRect(0, 170, W, 1);
  gctx.globalAlpha = 1;

  // Draw function for perspective ground lines at time t (animated scroll)
  function drawGround(t) {
    ctx.drawImage(ground, 0, 0);
    // Vertical radiating lines (static)
    const vp = { x: W/2, y: 169 };
    ctx.strokeStyle = 'rgba(255, 74, 214, 0.45)';
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      if (i === 0) continue;
      const tx = W/2 + i * 28;
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(tx, H);
      ctx.stroke();
    }
    // Horizontal "scroll" lines moving toward camera
    const rows = 10;
    for (let i = 0; i < rows; i++) {
      // progress 0..1, loop
      const p = ((i / rows) + (t * 0.004)) % 1;
      // perspective: y goes from horizon (170) downward, nonlinear
      const y = 170 + Math.pow(p, 2) * (H - 170);
      if (y > H) continue;
      const alpha = 0.2 + p * 0.6;
      ctx.strokeStyle = `rgba(61, 252, 229, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  let T = 0;

  function drawBuildings(layer, t, parallax) {
    const ox = Math.sin(t * 0.001 + parallax) * parallax * 0.6;
    layer.forEach(b => {
      const x = b.x + ox;
      ctx.fillStyle = b.color;
      ctx.fillRect(x, b.y, b.w, b.h);
      // accent top edge
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, b.y, b.w, 1);
      ctx.globalAlpha = 1;
      // antenna
      if (b.antenna) {
        ctx.fillStyle = b.accent;
        ctx.fillRect(x + b.antenna.x, b.y - b.antenna.h, 1, b.antenna.h);
        // blink tip
        if ((t | 0) % 40 < 20) {
          ctx.fillStyle = COL.yel;
          ctx.fillRect(x + b.antenna.x, b.y - b.antenna.h - 1, 1, 1);
        }
      }
      // windows
      b.windows.forEach(w => {
        const f = 0.5 + 0.5 * Math.sin(t * w.speed + w.phase);
        if (f > 0.3) {
          ctx.fillStyle = w.color;
          ctx.globalAlpha = Math.min(1, f + 0.2);
          ctx.fillRect(w.x + ox, w.y, 1, 2);
        }
      });
      ctx.globalAlpha = 1;
    });
  }

  function drawVehicle(v, t) {
    v.x += v.sp;
    if (v.sp > 0 && v.x > W + 30) v.x = -30;
    if (v.sp < 0 && v.x < -30) v.x = W + 30;
    const trailLen = 26;
    for (let i = 1; i < trailLen; i++) {
      const tx = v.x - (v.sp > 0 ? i : -i);
      const a = (1 - i / trailLen) * 0.75;
      ctx.fillStyle = i < 4 ? v.col : v.trail;
      ctx.globalAlpha = a;
      ctx.fillRect(tx | 0, v.y, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = v.col;
    ctx.fillRect(v.x | 0, v.y, v.sz, 2);
    ctx.fillStyle = COL.wht;
    ctx.fillRect((v.x + (v.sp > 0 ? v.sz - 1 : 0)) | 0, v.y, 1, 1);
  }

  function drawDroid(d, t) {
    d.x += d.dx;
    if (d.x < -10) d.x = W + 10;
    if (d.x > W + 10) d.x = -10;
    d.bob += d.bobSp;
    const by = d.y + Math.sin(d.bob) * 1.5;
    const dx = d.x | 0, dy = by | 0;
    ctx.fillStyle = COL.cyan;
    ctx.fillRect(dx, dy, 3, 2);
    ctx.fillStyle = COL.mag;
    ctx.fillRect(dx + 1, dy + 1, 1, 1);
    if ((t | 0) % 30 < 15) {
      ctx.fillStyle = COL.yel;
      ctx.fillRect(dx + 3, dy, 1, 1);
      ctx.fillRect(dx - 1, dy + 1, 1, 1);
    }
  }

  // Shooting stars
  const shoots = [];
  function maybeSpawnShoot() {
    if (Math.random() < 0.004 && shoots.length < 2) {
      shoots.push({ x: Math.random() * W | 0, y: Math.random() * 60 | 0, life: 0, maxLife: 20 + (Math.random() * 15) | 0, dx: 2 + Math.random() * 2, dy: 0.5 + Math.random() });
    }
  }
  function drawShoots() {
    for (let i = shoots.length - 1; i >= 0; i--) {
      const s = shoots[i];
      s.life++;
      s.x += s.dx; s.y += s.dy;
      // Trail
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = k < 2 ? COL.wht : COL.cyan;
        ctx.globalAlpha = (1 - k / 8) * 0.9;
        ctx.fillRect((s.x - k * s.dx) | 0, (s.y - k * s.dy) | 0, 1, 1);
      }
      ctx.globalAlpha = 1;
      if (s.life > s.maxLife) shoots.splice(i, 1);
    }
  }

  function frame() {
    T++;
    // sky
    ctx.drawImage(sky, 0, 0);

    // stars twinkling
    stars.forEach(s => {
      const f = 0.5 + 0.5 * Math.sin(T * s.speed + s.phase);
      if (f > 0.35) {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = f;
        ctx.fillRect(s.x, s.y, 1, 1);
      }
    });
    ctx.globalAlpha = 1;

    maybeSpawnShoot();
    drawShoots();

    // building layers (back to front)
    drawBuildings(farLayer, T, 0.4);
    drawBuildings(midLayer, T, 1.0);
    drawBuildings(nearLayer, T, 1.8);

    // Flying ships
    vehicles.forEach(v => drawVehicle(v, T));
    droids.forEach(d => drawDroid(d, T));

    // Ground grid
    drawGround(T);

    // moving horizontal scanline highlight
    const scanY = (T * 0.7) % H;
    ctx.fillStyle = COL.cyan;
    ctx.globalAlpha = 0.04;
    ctx.fillRect(0, scanY | 0, W, 2);
    ctx.globalAlpha = 1;

    requestAnimationFrame(frame);
  }

  frame();
})();
