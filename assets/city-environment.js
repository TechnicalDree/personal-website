// Visitor-local time, lightweight weather (Open-Meteo), pointer / gyro parallax,
// and a WebGL overlay for rain · fog · neon bloom on top of the pixel city.
(function () {
  const parallaxRoot = document.getElementById('bg-parallax');
  const fxCanvas = document.getElementById('bg-fx');
  const unit = document.querySelector('.unit');
  const docEl = document.documentElement;

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DEFAULT_LAT = 40.4433;
  const DEFAULT_LON = -79.9436;

  let weather = {
    rain: 0,
    snow: 0,
    wind: 0.08,
    fog: 0.08,
    cloud: 0.2,
    isDay: 1,
    source: 'default',
    mode: 'auto',
  };

  let phosphorThemeName = window.PhosphorTheme ? PhosphorTheme.readSaved() : 'default';

  function getNeonGL() {
    if (window.PhosphorTheme) return PhosphorTheme.get(phosphorThemeName).neonGL;
    return { a: [0.2, 0.95, 1.0], b: [1.0, 0.15, 0.75] };
  }

  function getChroma() {
    if (window.PhosphorTheme) return PhosphorTheme.get(phosphorThemeName).chroma;
    return [0.2, 0.95, 1.0];
  }

  function getTwilightHorizon() {
    if (window.PhosphorTheme) return PhosphorTheme.get(phosphorThemeName).twilightHorizon;
    return [54, 245, 255];
  }

  function syncPhosphorTheme(name) {
    if (window.PhosphorTheme && PhosphorTheme.get(name)) phosphorThemeName = name;
  }

  window.addEventListener('phosphor-theme', (e) => {
    if (e.detail && e.detail.theme) syncPhosphorTheme(e.detail.theme);
  });

  let targetPx = 0;
  let targetPy = 0;
  let px = 0;
  let py = 0;
  let oriSupported = false;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function mapWeatherCode(code, precipitation, cloudCover) {
    let rain = 0;
    let snow = 0;
    let wind = 0.08;
    let fog = 0.06 + clamp((cloudCover || 0) / 100, 0, 1) * 0.22;

    const p = typeof precipitation === 'number' ? precipitation : 0;
    if (p > 0.05) rain = clamp(p / 8, 0.15, 1);

    const c = code | 0;
    if ([45, 48].includes(c)) fog = Math.max(fog, 0.42);
    if (c >= 51 && c <= 57) rain = Math.max(rain, 0.35);
    if (c >= 61 && c <= 67) rain = Math.max(rain, 0.55);
    if (c >= 80 && c <= 82) rain = Math.max(rain, 0.7);
    if (c >= 95) rain = Math.max(rain, 0.85);
    if (c >= 71 && c <= 77) {
      snow = Math.max(snow, 0.45);
      fog = Math.max(fog, 0.2);
    }
    if (rain > 0.4 || snow > 0.35 || cloudCover > 70) wind = 0.22;

    return { rain, snow, wind, fog, cloud: clamp((cloudCover || 0) / 100, 0, 1) };
  }

  async function fetchWeather(lat, lon) {
    const u = new URL('https://api.open-meteo.com/v1/forecast');
    u.searchParams.set('latitude', String(lat));
    u.searchParams.set('longitude', String(lon));
    u.searchParams.set('current', 'weather_code,cloud_cover,precipitation,is_day');
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const cur = data.current || {};
    const mapped = mapWeatherCode(cur.weather_code, cur.precipitation, cur.cloud_cover);
    if (weather.mode !== 'auto') return;
    weather = {
      ...mapped,
      isDay: cur.is_day ? 1 : 0,
      source: 'open-meteo',
      mode: 'auto',
    };
  }

  function setWeatherMode(mode = 'auto', intensity = 0.8) {
    const nextMode = String(mode || 'auto').toLowerCase();
    const amt = clamp(Number(intensity), 0, 1);
    if (nextMode === 'auto') {
      weather = { rain: 0, snow: 0, wind: 0.08, fog: 0.08, cloud: 0.2, isDay: weather.isDay, source: 'default', mode: 'auto' };
      requestWeather();
      return weather;
    }
    const base = {
      rain: 0,
      snow: 0,
      wind: 0.08,
      fog: 0.08,
      cloud: 0.18,
      isDay: weather.isDay,
      source: 'manual',
      mode: nextMode,
    };
    if (nextMode === 'rain') {
      Object.assign(base, { rain: Math.max(0.18, amt), wind: 0.25 + amt * 0.45, fog: 0.18 + amt * 0.22, cloud: 0.8 });
    } else if (nextMode === 'snow') {
      Object.assign(base, { snow: Math.max(0.18, amt), wind: 0.14 + amt * 0.28, fog: 0.2 + amt * 0.22, cloud: 0.72 });
    } else if (nextMode === 'wind') {
      Object.assign(base, { wind: Math.max(0.2, amt), fog: 0.14, cloud: 0.38 });
    } else if (nextMode === 'clear') {
      Object.assign(base, { fog: 0.03, cloud: 0.04, wind: 0.04 });
    }
    weather = base;
    return weather;
  }

  function requestWeather() {
    if (!navigator.geolocation) {
      fetchWeather(DEFAULT_LAT, DEFAULT_LON).catch(() => {});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeather(pos.coords.latitude, pos.coords.longitude).catch(() => {
          fetchWeather(DEFAULT_LAT, DEFAULT_LON).catch(() => {});
        });
      },
      () => {
        fetchWeather(DEFAULT_LAT, DEFAULT_LON).catch(() => {});
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }

  // --- Solar / sky (logical 640×360 space; bg.js uses same W,H) ---
  const SKY_W = 640;
  const SKY_H = 360;

  function getLocalSolar(date) {
    const d = date || new Date();
    const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

    let dayT = 0;
    if (hour >= 4 && hour <= 20) dayT = (hour - 4) / 16;
    const sunAlt = Math.sin(dayT * Math.PI);

    const sunAngle = dayT * Math.PI;
    const sunX = 70 + Math.sin(sunAngle) * (SKY_W - 140);
    const sunY = 125 - Math.sin(sunAngle) * 88;

    const starVisibility = clamp(1 - smoothstep(0.08, 0.45, sunAlt), 0, 1);
    const showSun = hour >= 5.2 && hour <= 19.8 && sunAlt > 0.04;
    const moonAngle = sunAngle + Math.PI;
    const moonX = 70 + Math.sin(moonAngle) * (SKY_W - 140);
    const moonY = 125 - Math.sin(moonAngle) * 88;

    const showMoon = starVisibility > 0.28 && !showSun;

    let twilight = 0;
    if (hour >= 4 && hour < 7) twilight = smoothstep(4, 7, hour) * (1 - smoothstep(5.5, 7, hour) * 0.5);
    else if (hour >= 17 && hour < 21) twilight = smoothstep(17, 19.5, hour) * (1 - smoothstep(19, 21, hour));

    const nightVeil = clamp(1 - sunAlt * 1.15, 0, 1) * 0.55;

    return {
      hour,
      sunAlt,
      sun: { x: sunX, y: sunY, r: 15, show: showSun },
      moon: { x: moonX, y: moonY, r: 16, show: showMoon },
      starVisibility,
      twilight,
      nightVeil,
    };
  }

  function drawSkyOverlay(ctx, solar) {
    const W = SKY_W;
    const H = SKY_H;
    const horizonY = 248;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    if (solar.nightVeil > 0.02) {
      const g = ctx.createLinearGradient(0, 0, 0, horizonY);
      g.addColorStop(0, `rgba(2,4,18,${solar.nightVeil * 0.55})`);
      g.addColorStop(0.55, `rgba(8,20,45,${solar.nightVeil * 0.35})`);
      g.addColorStop(1, `rgba(4,12,28,${solar.nightVeil * 0.2})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizonY + 8);
    }

    if (solar.twilight > 0.02) {
      const tg = ctx.createLinearGradient(0, 160, 0, horizonY + 24);
      tg.addColorStop(0, `rgba(255,120,60,0)`);
      tg.addColorStop(0.45, `rgba(255,90,120,${0.12 * solar.twilight})`);
      tg.addColorStop(0.72, `rgba(255,190,90,${0.22 * solar.twilight})`);
      const th = getTwilightHorizon();
      tg.addColorStop(1, `rgba(${th[0]},${th[1]},${th[2]},${0.06 * solar.twilight})`);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = tg;
      ctx.fillRect(0, 130, W, horizonY - 100);
      ctx.globalCompositeOperation = 'source-over';
    }

    const noonWash = smoothstep(0.35, 0.95, solar.sunAlt) * 0.18;
    if (noonWash > 0.01) {
      const ng = ctx.createLinearGradient(0, 0, 0, 120);
      ng.addColorStop(0, `rgba(180,230,255,${noonWash})`);
      ng.addColorStop(1, 'rgba(180,230,255,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, 130);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Lift the baked night gradient toward real daylight when the sun is up
    // (mid-morning through afternoon — synthwave base stays too dark otherwise).
    const dayLift = smoothstep(0.18, 0.88, solar.sunAlt) * (solar.sun && solar.sun.show ? 1 : 0.4);
    if (dayLift > 0.02) {
      const dg = ctx.createLinearGradient(0, 0, 0, horizonY);
      dg.addColorStop(0, `rgba(150, 205, 255, ${0.5 * dayLift})`);
      dg.addColorStop(0.38, `rgba(95, 165, 230, ${0.42 * dayLift})`);
      dg.addColorStop(0.72, `rgba(185, 220, 252, ${0.38 * dayLift})`);
      dg.addColorStop(1, `rgba(255, 248, 215, ${0.28 * dayLift})`);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, W, horizonY + 8);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  function drawSun(ctx, s) {
    if (!s.show) return;
    const { x, y, r } = s;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 1, x, y, r + 10);
    g.addColorStop(0, 'rgba(255,252,220,0.95)');
    g.addColorStop(0.35, 'rgba(255,220,140,0.55)');
    g.addColorStop(0.7, 'rgba(255,180,90,0.12)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffce8';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMoon(ctx, m) {
    if (!m.show) return;
    const { x, y, r } = m;
    ctx.save();
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const edge = dx * dx + dy * dy > (r - 2) * (r - 2);
        ctx.fillStyle = edge ? '#7fc0de' : (((dx + dy) & 1) ? '#d9f8ff' : '#a8d9ef');
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
    ctx.fillStyle = '#4f87a2';
    [[-5, -3, 2], [4, 4, 2], [-3, 6, 2], [5, -5, 1]].forEach(([cx, cy, cr]) => {
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          if (dx * dx + dy * dy <= cr * cr) ctx.fillRect(x + cx + dx, y + cy + dy, 1, 1);
        }
      }
    });
    ctx.restore();
  }

  // --- Parallax ---
  function onMouseMove(e) {
    targetPx = (e.clientX / window.innerWidth - 0.5) * 2;
    targetPy = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  function onDeviceOrientation(e) {
    if (e.gamma == null || e.beta == null) return;
    oriSupported = true;
    const gx = clamp(e.gamma / 25, -1, 1);
    const by = clamp((e.beta - 40) / 35, -1, 1);
    targetPx = gx;
    targetPy = by;
  }

  function onTouchMove(e) {
    if (!e.touches || !e.touches[0]) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    targetPx = (x / window.innerWidth - 0.5) * 2;
    targetPy = (y / window.innerHeight - 0.5) * 2;
  }

  if (!reducedMotion) {
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
  }

  function applyParallax() {
    if (reducedMotion || !parallaxRoot) return;
    const smooth = oriSupported ? 0.12 : 0.07;
    px += (targetPx - px) * smooth;
    py += (targetPy - py) * smooth;

    const depthBg = 14;
    const tx = px * depthBg;
    const ty = py * depthBg * 0.65;
    parallaxRoot.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(1.06)`;

    if (unit) {
      const maxTilt = 5.5;
      const rx = (-py * maxTilt).toFixed(3);
      const ry = (px * maxTilt).toFixed(3);
      unit.style.setProperty('--tilt-x', `${rx}deg`);
      unit.style.setProperty('--tilt-y', `${ry}deg`);
    }
  }

  // --- WebGL overlay ---
  let gl;
  let program;
  let locs;
  let rafFx;
  let startFx = performance.now();

  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initFxWebGL() {
    if (!fxCanvas) return false;
    gl = fxCanvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return false;

    const vsSrc = `
      attribute vec4 a_position;
      void main() { gl_Position = a_position; }
    `;
    const fsSrc = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_rain;
      uniform float u_snow;
      uniform float u_wind;
      uniform float u_fog;
      uniform float u_neon;
      uniform float u_isDay;
      uniform vec3 u_neonA;
      uniform vec3 u_neonB;
      uniform vec3 u_chroma;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 frag = gl_FragCoord.xy;
        vec2 uv = frag / u_resolution.xy;

        float alpha = 0.0;
        vec3 col = vec3(0.35, 0.55, 0.95);

        float fogAmt = u_fog * pow(clamp(uv.y, 0.0, 1.0), 1.25) * 0.42;
        alpha += fogAmt;

        if (u_rain > 0.002) {
          float t = u_time * (1.0 + u_rain);
          float wind = sin(uv.y * 3.1 + t * 0.4) * (0.04 + u_wind * 0.08);
          vec2 p = vec2(frag.x * (0.06 + u_rain * 0.04) + wind * 40.0, frag.y * 0.11 - t * 2.4);
          vec2 id = floor(p);
          vec2 gv = fract(p) - 0.5;
          float n = hash(id);
          float drop = step(0.65 + n * 0.2, n) * u_rain;
          float streak = smoothstep(0.0, 0.7, 0.5 - gv.y);
          float groundMask = smoothstep(0.05, 0.38, uv.y);
          alpha += drop * streak * 0.55 * groundMask;
          col = mix(col, vec3(0.7, 0.85, 1.0), 0.35);
        }

        if (u_snow > 0.002) {
          float st = u_time * (0.55 + u_snow);
          vec2 sp = vec2(frag.x * 0.035 + st * (8.0 + u_wind * 46.0), frag.y * 0.045 - st * 7.0);
          vec2 sid = floor(sp);
          vec2 sg = fract(sp) - 0.5;
          float sn = hash(sid);
          float flake = smoothstep(0.13, 0.01, length(sg)) * step(0.68, sn) * u_snow;
          float groundMask = smoothstep(0.0, 0.28, uv.y);
          alpha += flake * 0.58 * groundMask;
          col = mix(col, vec3(0.82, 0.94, 1.0), 0.5);
        }

        float pulse = 0.5 + 0.5 * sin(u_time * 0.8);
        vec2 cp = uv - vec2(0.15, 0.55);
        vec2 cp2 = uv - vec2(0.88, 0.42);
        float bloom = u_neon * (exp(-dot(cp, cp) * 3.2) * 0.14 + exp(-dot(cp2, cp2) * 2.8) * 0.12) * (0.55 + 0.45 * pulse);
        alpha += bloom;
        col = mix(col, u_neonA, bloom * 2.2 * (1.0 - u_isDay * 0.35));
        col = mix(col, u_neonB, bloom * 1.6 * u_neon);

        float edge = abs(uv.x - 0.5) * 2.0;
        float chromaAmt = u_neon * pow(edge, 2.2) * 0.04 * (1.0 - u_isDay * 0.2);
        alpha += chromaAmt;
        col += u_chroma * chromaAmt;

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.88));
      }
    `;

    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    locs = {
      res: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      rain: gl.getUniformLocation(program, 'u_rain'),
      snow: gl.getUniformLocation(program, 'u_snow'),
      wind: gl.getUniformLocation(program, 'u_wind'),
      fog: gl.getUniformLocation(program, 'u_fog'),
      neon: gl.getUniformLocation(program, 'u_neon'),
      isDay: gl.getUniformLocation(program, 'u_isDay'),
      neonA: gl.getUniformLocation(program, 'u_neonA'),
      neonB: gl.getUniformLocation(program, 'u_neonB'),
      chroma: gl.getUniformLocation(program, 'u_chroma'),
    };

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  function resizeFx() {
    if (!fxCanvas || !gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (fxCanvas.width !== w || fxCanvas.height !== h) {
      fxCanvas.width = w;
      fxCanvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  function fxFrame(now) {
    rafFx = requestAnimationFrame(fxFrame);
    applyParallax();

    if (!gl || !program) return;
    resizeFx();

    const rm = reducedMotion ? 0.25 : 1;
    const solar = getLocalSolar();
    let rain = clamp(weather.rain * rm, 0, 1);
    let snow = clamp((weather.snow || 0) * rm, 0, 1);
    let wind = clamp(weather.wind || 0, 0, 1);
    let fog = clamp(weather.fog * rm + (1 - solar.starVisibility) * 0.12, 0, 1);
    if (weather.source === 'default') fog = clamp(fog + 0.05, 0, 1);

    const neonBoost = rm * (0.55 + solar.starVisibility * 0.75 + fog * 0.25);
    const neonGL = getNeonGL();
    const chroma = getChroma();

    gl.useProgram(program);
    gl.uniform2f(locs.res, fxCanvas.width, fxCanvas.height);
    gl.uniform1f(locs.time, (now - startFx) / 1000);
    gl.uniform1f(locs.rain, rain);
    gl.uniform1f(locs.snow, snow);
    gl.uniform1f(locs.wind, wind);
    gl.uniform1f(locs.fog, fog);
    gl.uniform1f(locs.neon, neonBoost);
    gl.uniform1f(locs.isDay, solar.sun.show ? 1 : 0);
    gl.uniform3f(locs.neonA, neonGL.a[0], neonGL.a[1], neonGL.a[2]);
    gl.uniform3f(locs.neonB, neonGL.b[0], neonGL.b[1], neonGL.b[2]);
    gl.uniform3f(locs.chroma, chroma[0], chroma[1], chroma[2]);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  window.CityEnvironment = {
    SKY_W,
    SKY_H,
    getWeather: () => weather,
    setWeatherMode,
    getLocalSolar,
    /** @returns {{ starVisibility: number, overlay: boolean }} snapshot for sky */
    applyDynamicSkyBeforeStars(ctx, solar) {
      drawSkyOverlay(ctx, solar);
      return solar;
    },
    drawSun,
    drawMoon,
  };

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      requestWeather();
      startFxLoop();
    });
  } else {
    requestWeather();
    startFxLoop();
  }

  function startFxLoop() {
    if (fxCanvas && initFxWebGL()) {
      startFx = performance.now();
      rafFx = requestAnimationFrame(fxFrame);
    } else if (fxCanvas) {
      fxCanvas.style.display = 'none';
      const fallback = () => {
        applyParallax();
        requestAnimationFrame(fallback);
      };
      requestAnimationFrame(fallback);
    } else {
      const fallback = () => {
        applyParallax();
        requestAnimationFrame(fallback);
      };
      requestAnimationFrame(fallback);
    }
  }

  window.addEventListener('resize', () => {
    resizeFx();
  });
})();
