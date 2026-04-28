// Animated pixel-art synthwave city background
// Renders at low resolution, scales up with image-rendering: pixelated
(function () {
  const canvas = document.getElementById('city-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Low-res internal resolution — scaled up via CSS
  const W = 320;
  const H = 200;
  canvas.width = W;
  canvas.height = H;

  // Palette
  const SKY_TOP = '#0a0420';
  const SKY_MID = '#1a0833';
  const SKY_BOT = '#3d0a4d';
  const HORIZON = '#5a1670';
  const NEON_MAGENTA = '#ff24e4';
  const NEON_CYAN = '#00f3ff';
  const NEON_PURPLE = '#a020f0';
  const NEON_PINK = '#ff6ec7';
  const NEON_ORANGE = '#ff8c42';
  const NEON_YELLOW = '#fff000';
  const BUILDING_DARK = '#1a0830';
  const BUILDING_MID = '#2d0f4a';
  const BUILDING_LIGHT = '#4a1870';

  // Stars (fixed twinkle)
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: (Math.random() * W) | 0,
      y: (Math.random() * H * 0.55) | 0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.05,
      color: Math.random() < 0.15 ? NEON_CYAN : Math.random() < 0.3 ? NEON_PINK : '#ffffff',
    });
  }

  // Building definitions (layered)
  // Each building: x, y (top), w, h, color, windows (pattern)
  const buildings = [];
  function addBuilding(x, y, w, h, color, accent) {
    const windows = [];
    // Dither window pattern
    const wCols = Math.max(1, Math.floor((w - 2) / 3));
    const wRows = Math.max(1, Math.floor((h - 2) / 3));
    for (let r = 0; r < wRows; r++) {
      for (let c = 0; c < wCols; c++) {
        if ((r + c) % 2 === 0 && Math.random() < 0.55) {
          windows.push({
            x: x + 1 + c * 3,
            y: y + 2 + r * 3,
            color: Math.random() < 0.3 ? NEON_CYAN : Math.random() < 0.5 ? NEON_YELLOW : accent,
            flicker: Math.random() * Math.PI * 2,
            flickerSpeed: 0.01 + Math.random() * 0.04,
          });
        }
      }
    }
    buildings.push({ x, y, w, h, color, accent, windows });
  }

  // Far layer (smallest, most distant)
  for (let i = 0; i < 18; i++) {
    const w = 8 + ((Math.random() * 10) | 0);
    const h = 20 + ((Math.random() * 30) | 0);
    const x = (i * 18) - 10 + ((Math.random() * 6) | 0);
    const y = 95 - h;
    addBuilding(x, y, w, h, BUILDING_DARK, NEON_MAGENTA);
  }

  // Mid layer
  const midData = [
    [15, 12, 60],  // x, w, h
    [35, 14, 50],
    [58, 10, 70],
    [75, 18, 45],
    [100, 12, 62],
    [120, 16, 55],
    [145, 14, 75],
    [168, 20, 48],
    [195, 12, 68],
    [215, 15, 58],
    [240, 22, 52],
    [268, 13, 72],
    [288, 16, 48],
    [308, 11, 60],
  ];
  midData.forEach(([x, w, h]) => {
    addBuilding(x, 110 - h, w, h, BUILDING_MID, NEON_MAGENTA);
  });

  // Near layer (largest, closest to bottom)
  const nearData = [
    [0, 28, 95],
    [30, 20, 75],
    [55, 32, 110],
    [92, 24, 88],
    [122, 30, 72],
    [158, 26, 95],
    [190, 34, 115],
    [230, 22, 80],
    [258, 30, 100],
    [293, 28, 85],
  ];
  nearData.forEach(([x, w, h]) => {
    addBuilding(x, 165 - h, w, h, BUILDING_LIGHT, NEON_CYAN);
  });

  // Ground strip highlights
  const groundBlocks = [];
  for (let x = 0; x < W; x += 2) {
    if (Math.random() < 0.3) {
      groundBlocks.push({ x, y: 165 + ((Math.random() * 3) | 0), color: Math.random() < 0.5 ? NEON_MAGENTA : NEON_PURPLE });
    }
  }

  // Flying vehicles
  const vehicles = [
    { x: -20, y: 35, speed: 0.4, color: NEON_CYAN, trail: NEON_MAGENTA, size: 3 },
    { x: W + 30, y: 55, speed: -0.25, color: NEON_YELLOW, trail: NEON_ORANGE, size: 2 },
    { x: -60, y: 72, speed: 0.18, color: NEON_PINK, trail: NEON_MAGENTA, size: 2 },
  ];

  // Droids (slow drift)
  const droids = [
    { x: 50, y: 25, dx: 0.1, dy: 0, bob: 0, bobSpeed: 0.08 },
    { x: 200, y: 42, dx: -0.07, dy: 0, bob: Math.PI, bobSpeed: 0.06 },
    { x: 280, y: 18, dx: 0.05, dy: 0, bob: Math.PI / 2, bobSpeed: 0.09 },
  ];

  function dither(x, y) {
    return (x + y) % 2 === 0;
  }

  // Pre-draw static sky gradient with dithering into an offscreen canvas
  const sky = document.createElement('canvas');
  sky.width = W;
  sky.height = H;
  const skyCtx = sky.getContext('2d');
  const skyImg = skyCtx.createImageData(W, H);
  function hex(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  const c1 = hex(SKY_TOP), c2 = hex(SKY_MID), c3 = hex(SKY_BOT), c4 = hex(HORIZON);
  for (let y = 0; y < H; y++) {
    let r, g, b;
    if (y < 50) {
      const t = y / 50;
      r = c1[0] + (c2[0] - c1[0]) * t;
      g = c1[1] + (c2[1] - c1[1]) * t;
      b = c1[2] + (c2[2] - c1[2]) * t;
    } else if (y < 95) {
      const t = (y - 50) / 45;
      r = c2[0] + (c3[0] - c2[0]) * t;
      g = c2[1] + (c3[1] - c2[1]) * t;
      b = c2[2] + (c3[2] - c2[2]) * t;
    } else if (y < 110) {
      const t = (y - 95) / 15;
      r = c3[0] + (c4[0] - c3[0]) * t;
      g = c3[1] + (c4[1] - c3[1]) * t;
      b = c3[2] + (c4[2] - c3[2]) * t;
    } else {
      // Ground — very dark purple
      r = 20; g = 5; b = 35;
    }
    for (let x = 0; x < W; x++) {
      // Add subtle dither noise
      const noise = dither(x, y) ? 6 : -6;
      const i = (y * W + x) * 4;
      skyImg.data[i] = Math.max(0, Math.min(255, r + noise));
      skyImg.data[i + 1] = Math.max(0, Math.min(255, g + noise));
      skyImg.data[i + 2] = Math.max(0, Math.min(255, b + noise));
      skyImg.data[i + 3] = 255;
    }
  }
  skyCtx.putImageData(skyImg, 0, 0);

  // Horizon glow line
  skyCtx.fillStyle = NEON_MAGENTA;
  for (let x = 0; x < W; x++) {
    if (Math.random() < 0.4) skyCtx.fillRect(x, 108, 1, 1);
  }
  skyCtx.fillStyle = NEON_PINK;
  for (let x = 0; x < W; x++) {
    if (Math.random() < 0.25) skyCtx.fillRect(x, 109, 1, 1);
  }

  let t = 0;

  function draw() {
    t += 1;

    // Blit sky
    ctx.drawImage(sky, 0, 0);

    // Stars twinkle
    stars.forEach(s => {
      const bright = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      if (bright > 0.4) {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = bright;
        ctx.fillRect(s.x, s.y, 1, 1);
      }
    });
    ctx.globalAlpha = 1;

    // Buildings
    buildings.forEach(b => {
      // Body with vertical gradient dither
      for (let y = b.y; y < b.y + b.h; y++) {
        const depth = (y - b.y) / b.h;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, y, b.w, 1);
        // Dither top edge
        if (y === b.y) {
          ctx.fillStyle = b.accent;
          for (let x = b.x; x < b.x + b.w; x += 2) {
            if (Math.random() < 0.1) ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      // Outline
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(b.x, b.y, 1, b.h);
      ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
      ctx.globalAlpha = 1;

      // Windows (flickering)
      b.windows.forEach(w => {
        const f = 0.5 + 0.5 * Math.sin(t * w.flickerSpeed + w.flicker);
        if (f > 0.35) {
          ctx.fillStyle = w.color;
          ctx.globalAlpha = Math.min(1, f + 0.3);
          ctx.fillRect(w.x, w.y, 1, 1);
        }
      });
      ctx.globalAlpha = 1;
    });

    // Ground shimmer (reflections)
    groundBlocks.forEach(g => {
      ctx.fillStyle = g.color;
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 0.1 + g.x);
      ctx.fillRect(g.x, g.y, 1, 1);
      ctx.globalAlpha = 1;
    });

    // Droids
    droids.forEach(d => {
      d.x += d.dx;
      if (d.x < -10) d.x = W + 10;
      if (d.x > W + 10) d.x = -10;
      d.bob += d.bobSpeed;
      const by = d.y + Math.sin(d.bob) * 1.5;
      // Droid body
      ctx.fillStyle = NEON_CYAN;
      ctx.fillRect(d.x | 0, by | 0, 3, 2);
      ctx.fillStyle = NEON_MAGENTA;
      ctx.fillRect((d.x | 0) + 1, (by | 0) + 1, 1, 1);
      // Blink light
      if ((t | 0) % 20 < 10) {
        ctx.fillStyle = NEON_YELLOW;
        ctx.fillRect((d.x | 0) + 3, by | 0, 1, 1);
      }
    });

    // Vehicles with light trails
    vehicles.forEach(v => {
      v.x += v.speed;
      if (v.speed > 0 && v.x > W + 30) v.x = -20;
      if (v.speed < 0 && v.x < -30) v.x = W + 20;

      // Trail
      const trailLen = 20;
      for (let i = 0; i < trailLen; i++) {
        const tx = v.x - (v.speed > 0 ? i : -i);
        const alpha = (1 - i / trailLen) * 0.7;
        ctx.fillStyle = i < 5 ? v.color : v.trail;
        ctx.globalAlpha = alpha;
        ctx.fillRect(tx | 0, v.y + ((i % 2) === 0 ? 0 : 1), 1, 1);
      }
      ctx.globalAlpha = 1;

      // Body
      ctx.fillStyle = v.color;
      ctx.fillRect(v.x | 0, v.y, v.size, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((v.x + (v.speed > 0 ? v.size - 1 : 0)) | 0, v.y, 1, 1);
    });

    // Scanline wave (subtle)
    const scanY = (t * 0.6) % H;
    ctx.fillStyle = NEON_CYAN;
    ctx.globalAlpha = 0.04;
    ctx.fillRect(0, scanY | 0, W, 2);
    ctx.globalAlpha = 1;

    requestAnimationFrame(draw);
  }

  draw();
})();
