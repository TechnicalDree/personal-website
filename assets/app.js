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
    gallery:  { tpl: 'tpl-gallery',  cmd: 'cat ./skills.json',    crumb: '~/skills' },
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

  // Minimize / expand toggle — fades the terminal so the city is visible
  const stage = document.getElementById('stage');
  const minBtn = document.getElementById('minimize-btn');
  let minimized = false;
  function setMin(v) {
    minimized = v;
    stage.classList.toggle('minimized', v);
    minBtn.classList.toggle('is-min', v);
    minBtn.querySelector('.mb-label').textContent = v ? 'SHOW.UI' : 'HIDE.UI';
    minBtn.title = v ? 'Restore terminal' : 'Hide terminal — show city';
  }
  minBtn.addEventListener('click', () => setMin(!minimized));
  // Esc to toggle, also `b` for "background"
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') setMin(!minimized);
  });

  // Populate GitHub contribution history + Monkeytype widgets when home view renders.
  const GITHUB_USER = 'TechnicalDree';
  const MONKEYTYPE_USER = 'TechnicalDree';

  const $ = (sel) => document.querySelector(sel);
  const shortDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const repoName = (fullName) => (fullName || '').split('/').pop() || 'repo';
  const cleanMessage = (message) => (message || 'commit').split('\n')[0].slice(0, 72);

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  async function loadGitHub() {
    const grid = $('#gh-grid');
    const list = $('#gh-commits');
    const meta = $('#gh-meta');
    const yearsEl = $('#gh-years');
    const monthsEl = $('#gh-months');
    if (!grid || !list || !yearsEl || !monthsEl || grid.dataset.ready) return;
    grid.dataset.ready = '1';

    const history = window.GITHUB_HISTORY;
    if (!history?.years?.length) {
      list.innerHTML = '<li><span class="cdate">ERR</span><span class="crepo">github</span> public activity could not be loaded</li>';
      if (meta) meta.textContent = 'history data missing';
      return;
    }

    const years = history.years.slice().sort((a, b) => b.year - a.year);
    yearsEl.innerHTML = years.map((entry, index) => (
      `<button class="gh-year-btn${index === 0 ? ' active' : ''}" type="button" data-year="${entry.year}">${entry.year}</button>`
    )).join('');

    const renderYear = (year) => {
      const entry = years.find((item) => String(item.year) === String(year)) || years[0];
      yearsEl.querySelectorAll('.gh-year-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.year === String(entry.year));
      });
      renderGitHubHeatmap(grid, monthsEl, entry.days || []);
      renderGitHubCommits(list, history.commitsByYear?.[String(entry.year)] || []);
      if (meta) meta.textContent = `${entry.total.toLocaleString()} contributions in ${entry.year}`;
    };

    yearsEl.querySelectorAll('.gh-year-btn').forEach((button) => {
      button.addEventListener('click', () => renderYear(button.dataset.year));
    });
    renderYear(years[0].year);
  }

  function renderGitHubHeatmap(grid, monthsEl, days) {
    grid.innerHTML = '';
    monthsEl.innerHTML = '';
    if (!days.length) return;

    const maxWeek = Math.max(...days.map((day) => day.week || 1));
    grid.style.setProperty('--gh-weeks', maxWeek);
    monthsEl.style.setProperty('--gh-weeks', maxWeek);

    days.forEach((dayInfo) => {
      const cell = document.createElement('div');
      const count = dayInfo.count || 0;
      cell.className = `cell s${dayInfo.level || 0}`;
      cell.title = `${count} ${count === 1 ? 'contribution' : 'contributions'} on ${dayInfo.date}`;
      cell.style.gridRow = String((dayInfo.row ?? 0) + 1);
      cell.style.gridColumn = String(dayInfo.week || 1);
      grid.appendChild(cell);
    });
    renderMonthLabels(monthsEl, days);
  }

  function renderMonthLabels(monthsEl, days) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const seen = new Set();
    days.forEach((dayInfo) => {
      const d = new Date(`${dayInfo.date}T00:00:00`);
      const month = d.getMonth();
      if (seen.has(month)) return;
      seen.add(month);
      const label = document.createElement('span');
      label.textContent = monthNames[month];
      label.style.gridColumn = String(dayInfo.week || 1);
      monthsEl.appendChild(label);
    });
  }

  function renderGitHubCommits(list, commits) {
    if (commits.length === 0) {
      list.innerHTML = '<li><span class="cdate">--</span><span class="crepo">github</span> no public commits loaded for this year</li>';
      return;
    }
    list.innerHTML = commits.map((commit) => `
      <li>
        <span class="cdate">${escapeHtml(shortDate(commit.date))}</span>
        <span class="crepo">${escapeHtml(repoName(commit.repo))}</span>
        <a href="${escapeHtml(commit.url)}" target="_blank" rel="noreferrer">${escapeHtml(cleanMessage(commit.message))}</a>
      </li>
    `).join('');
  }

  async function loadMonkeytype() {
    const chart = $('#mk-chart');
    const meta = $('#mk-meta');
    if (!chart || chart.dataset.ready) return;
    chart.dataset.ready = '1';

    try {
      const profile = await fetchJson(`https://api.monkeytype.com/users/${MONKEYTYPE_USER}/profile?isUid=false`);
      if (!profile.data?.name) throw new Error(profile.message || 'Monkeytype profile unavailable');
      const data = profile.data;
      const pbs = flattenPersonalBests(data.personalBests);
      const best60 = pbs.find((pb) => pb.mode === 'time' && String(pb.mode2) === '60') || pbs[0];
      const avgAcc = pbs.length ? pbs.reduce((sum, pb) => sum + (pb.acc || 0), 0) / pbs.length : 0;
      const tests = data.typingStats?.completedTests || 0;
      const hours = Math.round(((data.typingStats?.timeTyping || 0) / 3600) * 10) / 10;

      setText('#mk-pb', best60?.wpm ? `${Math.round(best60.wpm)}<small>wpm</small>` : '--<small>wpm</small>');
      setText('#mk-acc', avgAcc ? `${avgAcc.toFixed(1)}<small>%</small>` : '--<small>%</small>');
      setText('#mk-tests', String(tests || '--'));
      setText('#mk-time', hours ? `${hours}<small>h</small>` : '--<small>h</small>');
      renderMonkeytypeList(pbs.slice(0, 4));
      renderLineChart(chart, data.testActivity?.testsByDays || []);
      if (meta) meta.textContent = `${data.name} · public profile`;
    } catch (error) {
      setText('#mk-pb', '--<small>wpm</small>');
      setText('#mk-acc', '--<small>%</small>');
      setText('#mk-tests', '--');
      setText('#mk-time', '--<small>h</small>');
      renderMonkeytypeList([]);
      renderLineChart(chart, []);
      if (meta) meta.textContent = 'profile not found/public history disabled';
    }
  }

  function setText(selector, html) {
    const el = $(selector);
    if (el) el.innerHTML = html;
  }

  function flattenPersonalBests(personalBests) {
    const out = [];
    Object.entries(personalBests || {}).forEach(([mode, byMode2]) => {
      Object.entries(byMode2 || {}).forEach(([mode2, results]) => {
        (results || []).forEach((result) => out.push({ ...result, mode, mode2 }));
      });
    });
    return out
      .filter((result) => result.wpm)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  function renderMonkeytypeList(results) {
    const list = document.querySelector('.mk-recent');
    if (!list) return;
    if (results.length === 0) {
      list.innerHTML = '<li><span class="mt-mode">public profile</span><span class="mt-wpm">unavailable</span><span class="mt-acc">--</span></li>';
      return;
    }
    list.innerHTML = results.map((result) => `
      <li>
        <span class="mt-mode">${escapeHtml(result.mode)} ${escapeHtml(result.mode2)} · ${escapeHtml(result.language || 'english')}</span>
        <span class="mt-wpm">${escapeHtml(Math.round(result.wpm))} wpm</span>
        <span class="mt-acc">${escapeHtml(Math.round(result.acc || 0))}%</span>
      </li>
    `).join('');
  }

  function renderLineChart(canvas, rawValues) {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const values = rawValues.filter((v) => Number.isFinite(v)).slice(-30);
    const data = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
    const maxV = Math.max(1, ...data);
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(107,255,191,0.15)';
    c.lineWidth = 1;
    for (let y = 0; y < H; y += 16) {
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke();
    }
    const step = data.length > 1 ? W / (data.length - 1) : W;
    c.beginPath();
    c.moveTo(0, H);
    data.forEach((v, i) => {
      const x = i * step;
      const y = H - (v / maxV) * (H - 8) - 4;
      c.lineTo(x, y);
    });
    c.lineTo(W, H);
    c.closePath();
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,74,214,0.55)');
    g.addColorStop(1, 'rgba(255,74,214,0.05)');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = '#3dfce5';
    c.lineWidth = 1.5;
    c.shadowBlur = 6; c.shadowColor = '#3dfce5';
    c.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = H - (v / maxV) * (H - 8) - 4;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();
    c.shadowBlur = 0;
  }

  const renderHomeExtras = () => {
    loadGitHub();
    loadMonkeytype();
  };
  window.addEventListener('load', renderHomeExtras);
  navBtns.forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'home') setTimeout(renderHomeExtras, 0); }));
  setTimeout(renderHomeExtras, 0);
})();
