// View switcher + avatar sprite + uptime clock
(function () {
  // --- Avatar sprite (animated pixel head) ---
  const av = document.getElementById('avatar');
  if (av) {
    const actx = av.getContext('2d');
    const W = 64, H = 64;
    // pixel art: 16x16 drawn at 4x scale
    // Palette keys
    const P = {
      ' ': null,
      'k': '#0a0420',
      'h': '#2a1a55',           // hair dark
      'H': '#6a2fc9',           // hair highlight
      's': '#ffcfa0',           // skin
      'S': '#d89a6e',           // skin shadow
      'e': '#3dfce5',           // eye cyan
      'm': '#ff4ad6',           // mouth
      'v': '#ffe66d',           // visor highlight
      'V': '#00c7e5',           // visor
      'b': '#ff8a3a',           // earring
    };
    // 16x16 sprite rows
    const SPRITE = [
      '    hhHHhh      ',
      '   hHHHHHHh     ',
      '  hHHHHHHHhh    ',
      ' hHHsssssHHh    ',
      ' hHssssssSHh    ',
      ' hsVVVVVVVsh    ',
      ' hsVvVVvVVsh    ',  // visor row (anim)
      ' hssSssssShh    ',
      ' hsssssssSh     ',
      '  hssmmssSh     ',
      '   SsssssS      ',
      '    SSSSS       ',
      '   khhhhhk      ',
      '  khHHHHHhk     ',
      ' khHeHHHHeHhk   ',
      ' kkkkkkkkkkkk   ',
    ];
    // Frame variants: blink + visor shimmer
    function draw(t) {
      actx.clearRect(0, 0, W, H);
      const scale = 4;
      const blink = (t % 180) > 170; // blink every ~3s
      const visorShift = (t >> 2) % 3;
      for (let y = 0; y < 16; y++) {
        let row = SPRITE[y];
        // Animate visor rows
        if (y === 5 || y === 6) {
          row = row.split('').map((ch, i) => {
            if (ch === 'V' || ch === 'v') {
              return ((i + visorShift) % 3 === 0) ? 'v' : 'V';
            }
            return ch;
          }).join('');
        }
        // Blink: collapse eyes (row 14 has eye)
        if (y === 14 && blink) {
          row = row.replace(/e/g, 'H');
        }
        for (let x = 0; x < row.length; x++) {
          const c = P[row[x]];
          if (c) {
            actx.fillStyle = c;
            actx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
      // Glow around head
      actx.globalAlpha = 0.15;
      actx.fillStyle = '#3dfce5';
      actx.fillRect(0, 0, W, 2);
      actx.globalAlpha = 1;
    }
    let t = 0;
    (function loop() { draw(t++); requestAnimationFrame(loop); })();
  }

  // --- View switching ---
  const screen = document.getElementById('screen');
  const cmd = document.getElementById('cmd');
  const crumb = document.getElementById('crumb');
  const navBtns = document.querySelectorAll('.nav-item');

  const VIEW_META = {
    home:     { tpl: 'tpl-home',     cmd: 'cat ./home.txt',       crumb: '~' },
    projects: { tpl: 'tpl-projects', cmd: 'ls ./projects',        crumb: '~/projects' },
    about:    { tpl: 'tpl-about',    cmd: 'cat ./about.log',      crumb: '~/about' },
    log:      { tpl: 'tpl-log',      cmd: 'tail -f ./changelog',  crumb: '~/log' },
    gallery:  { tpl: 'tpl-gallery',  cmd: 'open ./gallery/',      crumb: '~/gallery' },
    contact:  { tpl: 'tpl-contact',  cmd: 'open_comms --secure',  crumb: '~/contact' },
  };

  function renderView(name) {
    const meta = VIEW_META[name] || VIEW_META.home;
    const tpl = document.getElementById(meta.tpl);
    if (!tpl) return;
    screen.innerHTML = '';
    screen.appendChild(tpl.content.cloneNode(true));
    crumb.textContent = meta.crumb;
    // Typewriter effect on command line
    typeCmd(meta.cmd);
    // Wire quick-action buttons inside the view
    screen.querySelectorAll('[data-nav]').forEach(b => {
      b.addEventListener('click', () => setView(b.getAttribute('data-nav')));
    });
    // serial numbers on project cards
    screen.querySelectorAll('.prj').forEach((el, i) => {
      el.setAttribute('data-sn', (0xA000 + i * 37).toString(16).toUpperCase());
    });
    screen.scrollTop = 0;
  }

  let typing = null;
  function typeCmd(text) {
    if (typing) clearInterval(typing);
    cmd.textContent = '';
    let i = 0;
    typing = setInterval(() => {
      cmd.textContent += text[i++];
      if (i >= text.length) { clearInterval(typing); typing = null; }
    }, 28);
  }

  function setView(name) {
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    renderView(name);
  }

  navBtns.forEach(b => {
    b.addEventListener('click', () => setView(b.dataset.view));
  });

  // --- Uptime + clock ---
  const startT = Date.now();
  const up = document.getElementById('uptime');
  const clock = document.getElementById('clock');
  function pad(n) { return String(n).padStart(2, '0'); }
  setInterval(() => {
    const s = ((Date.now() - startT) / 1000) | 0;
    if (up) up.textContent = `${pad((s/3600)|0)}:${pad(((s/60)|0)%60)}:${pad(s%60)}`;
    if (clock) {
      const d = new Date();
      clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  }, 1000);

  // Init
  setView('home');

  // Populate GH grid + Monkeytype chart when home view renders
  const renderHomeExtras = () => {
    const grid = document.getElementById('gh-grid');
    if (grid && !grid.dataset.ready) {
      grid.dataset.ready = '1';
      // 7 rows x 26 weeks = 182 cells. CSS is column-first; fill with plausible data.
      const cells = 7 * 26;
      // Seeded pseudo-random so it looks consistent-ish
      let seed = 12345;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < cells; i++) {
        const r = rnd();
        // weekends lower activity
        const row = i % 7;
        let bias = (row === 0 || row === 6) ? 0.4 : 1.0;
        // recent weeks higher activity
        const week = (i / 7) | 0;
        bias *= 0.6 + (week / 26) * 0.8;
        const v = r * bias;
        let lvl = 0;
        if (v > 0.15) lvl = 1;
        if (v > 0.35) lvl = 2;
        if (v > 0.6) lvl = 3;
        if (v > 0.82) lvl = 4;
        const d = document.createElement('div');
        d.className = 'cell s' + lvl;
        grid.appendChild(d);
      }
    }
    const chart = document.getElementById('mk-chart');
    if (chart && !chart.dataset.ready) {
      chart.dataset.ready = '1';
      const c = chart.getContext('2d');
      const W = chart.width, H = chart.height;
      c.clearRect(0, 0, W, H);
      // Background grid lines
      c.strokeStyle = 'rgba(107,255,191,0.15)';
      c.lineWidth = 1;
      for (let y = 0; y < H; y += 16) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); }
      // Data: recent 30 tests wpm
      const data = [88, 92, 101, 97, 105, 110, 108, 115, 112, 118, 122, 119, 124, 127, 120, 125, 131, 128, 133, 130, 138, 134, 140, 136, 142, 138, 139, 130, 128, 134];
      const minV = 80, maxV = 145;
      const step = W / (data.length - 1);
      // Area fill
      c.beginPath();
      c.moveTo(0, H);
      data.forEach((v, i) => {
        const x = i * step;
        const y = H - ((v - minV) / (maxV - minV)) * (H - 8) - 4;
        c.lineTo(x, y);
      });
      c.lineTo(W, H);
      c.closePath();
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,74,214,0.55)');
      g.addColorStop(1, 'rgba(255,74,214,0.05)');
      c.fillStyle = g;
      c.fill();
      // Line
      c.strokeStyle = '#3dfce5';
      c.lineWidth = 1.5;
      c.shadowBlur = 6; c.shadowColor = '#3dfce5';
      c.beginPath();
      data.forEach((v, i) => {
        const x = i * step;
        const y = H - ((v - minV) / (maxV - minV)) * (H - 8) - 4;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      });
      c.stroke();
      c.shadowBlur = 0;
      // Dots on last + peak
      const peakIdx = data.indexOf(Math.max.apply(null, data));
      [data.length - 1, peakIdx].forEach((i, k) => {
        const x = i * step;
        const y = H - ((data[i] - minV) / (maxV - minV)) * (H - 8) - 4;
        c.fillStyle = k === 1 ? '#ffe66d' : '#ff4ad6';
        c.fillRect(x - 2, y - 2, 4, 4);
      });
    }
  };
  // Patch setView to also run extras
  const _origSetView = setView;
  window.addEventListener('load', renderHomeExtras);
  // Also hook the nav so extras render when switching back home
  navBtns.forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'home') setTimeout(renderHomeExtras, 0); }));
  setTimeout(renderHomeExtras, 0);
})();
