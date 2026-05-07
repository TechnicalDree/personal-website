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
  const termFooter = document.querySelector('.term-footer');
  const navBtns = document.querySelectorAll('.nav-item');

  const VIEW_META = {
    home:     { tpl: 'tpl-home',     cmd: 'cat ./home.txt',       crumb: '~' },
    projects: { tpl: 'tpl-projects', cmd: 'ls ./projects',        crumb: '~/projects' },
    about:    { tpl: 'tpl-about',    cmd: 'cat ./about.log',      crumb: '~/about' },
    log:      { tpl: 'tpl-log',      cmd: 'tail -f ./changelog',  crumb: '~/log' },
    gallery:  { tpl: 'tpl-gallery',  cmd: 'cat ./skills.json',    crumb: '~/skills' },
    contact:  { tpl: 'tpl-contact',  cmd: 'open_comms --secure',  crumb: '~/contact' },
  };

  const VIEW_COMMANDS = {
    home: ['home', '0', '00', 'whoami', 'cat home.txt', 'cat ./home.txt', 'cd ~', 'cd home'],
    projects: ['projects', 'project', '1', '01', 'ls projects', 'ls ./projects', 'cd projects'],
    about: ['about', '2', '02', 'cat about.log', 'cat ./about.log'],
    log: ['experience', 'exp', 'log', '3', '03', 'tail -f changelog', 'tail -f ./changelog', 'tail -f ./log', 'cat ./changelog'],
    gallery: ['skills', 'skill', 'gallery', '4', '04', 'cat skills.json', 'cat ./skills.json'],
    contact: ['contact', '5', '05', 'open_comms', 'open_comms --secure', 'mail', 'email'],
  };
  const COMMAND_TO_VIEW = new Map(
    Object.entries(VIEW_COMMANDS).flatMap(([view, commands]) => (
      commands.map((command) => [command, view])
    )),
  );
  const ROOT_COMMANDS = [
    'home.txt',
    'projects/',
    'about.log',
    'changelog',
    'skills.json',
    'contact',
  ];
  const COMMAND_HELP = [
    'home | cat ./home.txt          open the intro',
    'projects | ls ./projects       browse selected work',
    'about | cat ./about.log        read operator file',
    'experience | tail -f ./log     show work history',
    'skills | cat ./skills.json     show toolchain',
    'contact | open_comms --secure  open uplink',
    'ls | pwd | clear | help        terminal utilities',
    'Up/Down                        command history',
  ];
  const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
  let activeView = 'home';

  function normalizeCommand(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function renderView(name, options = {}) {
    const viewName = VIEW_META[name] ? name : 'home';
    const meta = VIEW_META[viewName];
    const tpl = document.getElementById(meta.tpl);
    if (!tpl) return;
    activeView = viewName;
    screen.innerHTML = '';
    screen.appendChild(tpl.content.cloneNode(true));
    crumb.textContent = meta.crumb;
    if (options.commandText !== undefined) {
      setCommandLine(options.commandText);
    } else {
      typeCmd(meta.cmd);
    }
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
  const commandHistory = [];
  let historyIndex = 0;

  function stopTyping() {
    if (!typing) return;
    clearInterval(typing);
    typing = null;
  }

  function placeCaretAtEnd(el) {
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function setCommandLine(text = '', focus = false) {
    stopTyping();
    cmd.textContent = text;
    cmd.dataset.prefill = '';
    if (focus) placeCaretAtEnd(cmd);
  }

  function typeCmd(text) {
    stopTyping();
    cmd.textContent = '';
    cmd.dataset.prefill = text;
    let i = 0;
    typing = setInterval(() => {
      cmd.textContent += text[i++];
      if (i >= text.length) {
        stopTyping();
        if (document.activeElement === cmd) placeCaretAtEnd(cmd);
      }
    }, 28);
  }

  function setView(name, options = {}) {
    const viewName = VIEW_META[name] ? name : 'home';
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
    renderView(viewName, options);
  }

  function renderTerminalOutput(command, lines) {
    navBtns.forEach(b => b.classList.remove('active'));
    crumb.textContent = '~/terminal';
    screen.innerHTML = `
      <div class="view terminal-output">
        <div class="row-head">
          <span class="tag tag-cyan">&gt;_ ${escapeHtml(command)}</span>
          <span class="tag tag-mag">TERMINAL</span>
        </div>
        <h2 class="h2">COMMAND OUTPUT</h2>
        <ul class="terminal-lines">
          ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
      </div>
    `;
    screen.scrollTop = 0;
  }

  function executeCommand(rawCommand) {
    const input = rawCommand.trim();
    const normalized = normalizeCommand(input);
    if (!normalized) {
      setCommandLine('', true);
      return;
    }

    commandHistory.push(input);
    historyIndex = commandHistory.length;

    const targetView = COMMAND_TO_VIEW.get(normalized);
    if (targetView) {
      setView(targetView, { commandText: '' });
      placeCaretAtEnd(cmd);
      return;
    }

    if (normalized === 'help' || normalized === '?' || normalized === 'man') {
      renderTerminalOutput(input, COMMAND_HELP);
    } else if (normalized === 'ls' || normalized === 'ls .' || normalized === 'ls ./') {
      renderTerminalOutput(input, ROOT_COMMANDS);
    } else if (normalized === 'pwd') {
      renderTerminalOutput(input, ['/home/adrian']);
    } else if (normalized === 'clear' || normalized === 'cls' || normalized === 'reset') {
      navBtns.forEach(b => b.classList.remove('active'));
      crumb.textContent = '~/terminal';
      screen.innerHTML = '';
    } else {
      renderTerminalOutput(input, [
        `command not found: ${input}`,
        'type "help" for available commands',
      ]);
    }

    setCommandLine('', true);
  }

  function clearPrefillForEdit() {
    if (typing || (cmd.dataset.prefill && cmd.textContent === cmd.dataset.prefill)) {
      setCommandLine('');
    }
  }

  function showHistory(delta) {
    if (!commandHistory.length) return;
    historyIndex = Math.min(commandHistory.length, Math.max(0, historyIndex + delta));
    setCommandLine(commandHistory[historyIndex] || '', true);
  }

  function autocompleteCommand() {
    const current = normalizeCommand(cmd.textContent);
    if (!current) {
      renderTerminalOutput('help', COMMAND_HELP);
      setCommandLine('', true);
      return;
    }

    const commands = [
      ...COMMAND_TO_VIEW.keys(),
      'help',
      'ls',
      'pwd',
      'clear',
    ];
    const matches = [...new Set(commands.filter((command) => command.startsWith(current)))];
    if (matches.length === 1) {
      setCommandLine(matches[0], true);
    } else if (matches.length > 1) {
      renderTerminalOutput('complete', [`matches: ${matches.slice(0, 12).join('  ')}`]);
      setCommandLine(current, true);
    }
  }

  function isEditableTarget(target) {
    return target instanceof Element && target.closest(EDITABLE_SELECTOR);
  }

  navBtns.forEach(b => {
    b.addEventListener('click', () => setView(b.dataset.view));
  });

  cmd.setAttribute('contenteditable', 'true');
  cmd.setAttribute('role', 'textbox');
  cmd.setAttribute('aria-label', 'Terminal command input');
  cmd.setAttribute('spellcheck', 'false');

  termFooter.addEventListener('click', () => placeCaretAtEnd(cmd));
  cmd.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(cmd.textContent);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      showHistory(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      showHistory(1);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      autocompleteCommand();
      return;
    }
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
      clearPrefillForEdit();
    }
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
    if (isEditableTarget(e.target)) return;
    if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') setMin(!minimized);
  });

  // Populate GitHub contribution history + Monkeytype widgets when home view renders.
  const GITHUB_USER = 'TechnicalDree';
  const MONKEYTYPE_USER = window.MONKEYTYPE_USER || 'TechnicalDree';
  const MONKEYTYPE_USER_CANDIDATES = [
    MONKEYTYPE_USER,
    ...(window.MONKEYTYPE_USER_CANDIDATES || []),
  ].filter(Boolean);
  const SNAPSHOTS = window.DASHBOARD_SNAPSHOTS || {};
  const MONKEYTYPE_FALLBACK_ACTIVITY = {
    total: 548,
    weeks: {
      1: [[1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 2]],
      2: [[1, 4], [2, 2], [6, 2], [7, 4]],
      3: [[3, 3], [4, 2], [5, 2], [6, 3], [7, 3]],
      4: [[2, 1], [3, 4], [4, 3], [5, 3], [6, 3]],
      5: [[2, 1], [3, 3], [4, 2], [5, 2]],
      6: [[1, 3], [7, 1]],
      7: [[2, 2]],
      8: [[3, 2], [7, 2]],
      9: [[2, 4]],
      10: [[1, 4]],
      14: [[1, 2], [2, 2]],
      15: [[2, 2]],
      16: [[3, 2], [7, 2]],
      17: [[1, 3], [3, 3], [5, 3], [6, 2]],
      20: [[5, 2], [6, 2], [7, 1]],
      21: [[1, 4], [3, 3], [6, 2], [7, 3]],
      22: [[1, 4], [3, 2], [7, 3]],
      23: [[6, 1], [7, 3]],
      24: [[2, 2], [3, 4], [5, 3], [6, 4], [7, 4]],
      25: [[3, 4], [4, 4], [5, 2]],
      26: [[1, 3], [3, 3], [4, 2], [5, 2], [6, 3], [7, 3]],
      27: [[2, 4], [4, 2], [5, 2]],
      29: [[2, 3]],
      30: [[4, 2], [5, 2]],
      31: [[4, 2], [5, 2]],
      32: [[3, 2], [6, 2], [7, 3]],
      33: [[2, 2], [3, 2], [4, 2], [5, 3], [6, 3], [7, 2]],
      34: [[4, 4], [5, 2]],
      35: [[3, 4], [5, 3], [6, 3]],
      41: [[2, 2]],
      44: [[1, 3]],
      45: [[3, 2], [6, 1], [7, 2]],
      50: [[4, 3]],
      51: [[1, 4], [7, 2]],
      52: [[7, 2]],
      53: [[4, 2], [7, 3]],
    },
  };

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
    const grid = $('#mk-grid');
    const meta = $('#mk-meta');
    if (!grid || grid.dataset.ready) return;
    grid.dataset.ready = '1';

    try {
      const data = window.MONKEYTYPE_HISTORY?.profile || await fetchMonkeytypeProfile();
      const activity = monkeytypeActivity(data);
      renderMonkeytypeCalendar(grid, activity);
      setText('#mk-user-title', `◆ MONKEYTYPE // @${escapeHtml(data.name || MONKEYTYPE_USER)}`);
      setText('#mk-total', `${activity.total.toLocaleString()} tests`);
      if (meta) meta.textContent = `${data.name} · ${window.MONKEYTYPE_HISTORY ? 'cached export' : 'public profile'}`;
    } catch (error) {
      renderMonkeytypeCalendar(grid, MONKEYTYPE_FALLBACK_ACTIVITY);
      setText('#mk-user-title', '◆ MONKEYTYPE // @a3rean');
      setText('#mk-total', `${MONKEYTYPE_FALLBACK_ACTIVITY.total.toLocaleString()} tests`);
      if (meta) meta.textContent = 'needs public username or Monkeytype export';
    }
  }

  async function fetchMonkeytypeProfile() {
    let lastError;
    const uniqueCandidates = [...new Set(MONKEYTYPE_USER_CANDIDATES)];
    for (const username of uniqueCandidates) {
      try {
        const profile = await fetchJson(`https://api.monkeytype.com/users/${encodeURIComponent(username)}/profile?isUid=false`);
        if (profile.data?.name) return profile.data;
        lastError = new Error(profile.message || 'Monkeytype profile unavailable');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Monkeytype profile unavailable');
  }

  function setText(selector, html) {
    const el = $(selector);
    if (el) el.innerHTML = html;
  }

  function setHref(selector, href) {
    const el = $(selector);
    if (el && href) el.href = href;
  }

  function monkeytypeActivity(data) {
    const days = data.testActivity?.days || [];
    if (days.length) {
      const weeks = {};
      let total = 0;
      days.slice(-371).forEach((day, index) => {
        const week = Math.floor(index / 7) + 1;
        const row = day.row || day.weekday || ((new Date(`${day.date}T00:00:00Z`).getUTCDay()) + 1);
        const count = Number(day.count || 0);
        if (!Number.isFinite(count) || count <= 0) return;
        total += count;
        weeks[week] ||= [];
        weeks[week].push([row, day.level || activityLevel(count)]);
      });
      return { total: data.testActivity?.total || total, weeks };
    }

    if ((data.testActivity?.testsByDays || []).length >= 52) {
      const values = data.testActivity.testsByDays.slice(-371);
      const weeks = {};
      let total = 0;
      values.forEach((count, index) => {
        if (!count) return;
        total += count;
        const week = Math.floor(index / 7) + 1;
        const row = (index % 7) + 1;
        weeks[week] ||= [];
        weeks[week].push([row, activityLevel(count)]);
      });
      return { total, weeks };
    }

    return MONKEYTYPE_FALLBACK_ACTIVITY;
  }

  function activityLevel(count) {
    if (count <= 0) return 0;
    if (count <= 1) return 1;
    if (count <= 3) return 2;
    if (count <= 6) return 3;
    return 4;
  }

  function renderMonkeytypeCalendar(grid, activity) {
    grid.innerHTML = '';
    for (let week = 1; week <= 53; week += 1) {
      for (let day = 1; day <= 7; day += 1) {
        const cell = document.createElement('span');
        const activeDay = activity.weeks?.[week]?.find(([row]) => row === day);
        const level = activeDay?.[1] || 0;
        cell.className = `mk-cell${level ? ` s${level}` : ''}`;
        cell.style.gridColumn = String(week);
        cell.style.gridRow = String(day);
        grid.appendChild(cell);
      }
    }
  }

  function renderCursorHeatmap() {
    const grid = $('#cursor-grid');
    if (!grid || grid.dataset.ready) return;
    grid.dataset.ready = '1';

    const cursor = SNAPSHOTS.cursor || {};
    const activeWeeks = cursor.weeks || {
      20: [[6, 3]],
      22: [[1, 1], [3, 1], [4, 1], [6, 1], [7, 2]],
      23: [[1, 3]],
      24: [[4, 1], [5, 1], [6, 1], [7, 1]],
      26: [[1, 1], [2, 2], [3, 1], [4, 1], [5, 2], [6, 1], [7, 1]],
      27: [[1, 1], [2, 2], [4, 1], [5, 1]],
      28: [[4, 2], [7, 1]],
      29: [[7, 1]],
      30: [[1, 1], [3, 1], [5, 2]],
      31: [[2, 1], [3, 1], [5, 1]],
      32: [[3, 1], [5, 1], [6, 1]],
      39: [[7, 2]],
      40: [[1, 2], [7, 1]],
      41: [[1, 1], [2, 2], [6, 3], [7, 2]],
      42: [[2, 1], [3, 1], [4, 2], [5, 1], [6, 1], [7, 1]],
      43: [[3, 1], [4, 1], [5, 3], [6, 2]],
      44: [[1, 1], [5, 2]],
      45: [[1, 1], [3, 1], [4, 1], [5, 1], [6, 2]],
      46: [[1, 4], [3, 4], [5, 1], [7, 1]],
      47: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 3], [6, 1]],
      48: [[1, 1], [4, 1], [5, 2], [6, 1], [7, 1]],
      49: [[4, 3], [5, 1], [6, 4]],
      50: [[1, 2], [2, 1], [5, 3], [6, 1]],
      51: [[2, 1], [3, 1], [6, 2], [7, 1]],
      52: [[5, 1], [6, 1]],
      53: [[1, 4], [2, 2]],
    };
    setText('#cursor-total', Number(cursor.totalLineEdits || 49999).toLocaleString());
    setText('#cursor-active-month', escapeHtml(cursor.mostActiveMonth || 'April'));
    setText('#cursor-active-day', escapeHtml(cursor.mostActiveDay || 'Mar 10, 2026'));
    setText('#cursor-longest-streak', escapeHtml(cursor.longestStreak || '9d'));
    setText('#cursor-current-streak', escapeHtml(cursor.currentStreak || '2d'));
    setHref('.cursor-panel .panel-link', cursor.dashboardUrl);
    setHref('.cursor-card', cursor.dashboardUrl);

    for (let week = 1; week <= 53; week += 1) {
      for (let day = 1; day <= 7; day += 1) {
        const cell = document.createElement('span');
        const activeDay = activeWeeks[week]?.find(([row]) => row === day);
        cell.className = `cursor-cell${activeDay ? ` s${activeDay[1]}` : ''}`;
        cell.style.gridColumn = String(week);
        cell.style.gridRow = String(day);
        grid.appendChild(cell);
      }
    }
  }

  function renderWisprHeatmap() {
    const grid = $('#wispr-grid');
    if (!grid || grid.dataset.ready) return;
    grid.dataset.ready = '1';

    const wispr = SNAPSHOTS.wispr || {};
    const activeWeeks = wispr.weeks || {
      14: [[2, 3], [3, 4], [4, 4], [5, 4], [6, 4], [7, 3]],
      15: [[1, 1], [2, 1], [3, 'muted'], [4, 1], [5, 3], [6, 3], [7, 'muted']],
      16: [[1, 1], [2, 1], [3, 2], [4, 2], [5, 2], [6, 'muted'], [7, 2]],
      17: [[1, 'muted'], [2, 1, true], [3, 1, true], [4, 1, true], [5, 4, true], [6, 4, true], [7, 2, true]],
      18: [[1, 2, true], [2, 2, true]],
    };
    setText('#wispr-current-streak', escapeHtml(wispr.currentStreak || '8 day streak'));
    setText('#wispr-longest-streak', escapeHtml(wispr.longestStreak || '18 DAYS'));
    setHref('.wispr-panel .panel-link', wispr.dashboardUrl);
    setHref('.wispr-card', wispr.dashboardUrl);

    for (let week = 1; week <= 18; week += 1) {
      for (let day = 1; day <= 7; day += 1) {
        const cell = document.createElement('span');
        const activeDay = activeWeeks[week]?.find(([row]) => row === day);
        const level = activeDay?.[1];
        const current = activeDay?.[2];
        cell.className = [
          'wispr-cell',
          level ? `s${level}` : '',
          current ? 'current' : '',
        ].filter(Boolean).join(' ');
        cell.style.gridColumn = String(week);
        cell.style.gridRow = String(day);
        grid.appendChild(cell);
      }
    }
  }

  const renderHomeExtras = () => {
    loadGitHub();
    renderCursorHeatmap();
    renderWisprHeatmap();
    loadMonkeytype();
  };
  window.addEventListener('load', renderHomeExtras);
  navBtns.forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'home') setTimeout(renderHomeExtras, 0); }));
  setTimeout(renderHomeExtras, 0);
})();
