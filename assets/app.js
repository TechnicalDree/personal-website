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
    gallery:  { tpl: 'tpl-gallery',  cmd: 'open ./photos',        crumb: '~/photos' },
    contact:  { tpl: 'tpl-contact',  cmd: 'open_comms --secure',  crumb: '~/contact' },
  };

  const VIEW_COMMANDS = {
    home: ['home', '0', '00', 'whoami', 'cat home.txt', 'cat ./home.txt', 'cd ~', 'cd home'],
    projects: ['projects', 'project', '1', '01', 'ls projects', 'ls ./projects', 'cd projects'],
    about: ['about', '2', '02', 'cat about.log', 'cat ./about.log'],
    log: ['experience', 'exp', 'log', '3', '03', 'tail -f changelog', 'tail -f ./changelog', 'tail -f ./log', 'cat ./changelog'],
    gallery: ['photos', 'photo', 'gallery', '4', '04', 'open photos', 'open ./photos', 'ls photos', 'ls ./photos', 'cat photos.json'],
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
    'photos/',
    'contact',
  ];
  const VIEW_ORDER = ['home', 'projects', 'about', 'log', 'gallery', 'contact'];
  const COMMAND_HELP = [
    'home | cat ./home.txt          open the intro',
    'projects | ls ./projects       browse selected work',
    'about | cat ./about.log        read operator file',
    'experience | tail -f ./log     show work history',
    'photos | open ./photos         view photo roll',
    'contact | open_comms --secure  open uplink',
    'ls | pwd | clear | help        terminal utilities',
    'arcade                          launch the mini-game',
    'whoami | neofetch | fortune     system introspection',
    'uptime | ping | stats | email   misc telemetry',
    'cowsay <msg> | theme | matrix   easter eggs',
    'Up/Down                        command history',
    '0-5 / ← →                        jump views',
    '/ | T                          focus cmd / theme',
  ];
  const FORTUNES = [
    'the best code is the code you can delete.',
    'ship the panel, then polish the neon.',
    'latency is a feature until it is not.',
    'robots do not care about your sprint velocity.',
    'every buffer pool teaches you about life.',
    'if it compiles on the first try, be suspicious.',
    'systems thinking beats framework chasing.',
    'the city never sleeps; neither does the CI.',
  ];
  const THEME_CYCLE = ['default', 'amber', 'green', 'mono'];
  const THEME_LABELS = window.PhosphorTheme ? PhosphorTheme.LABELS : { default: 'CYAN', amber: 'AMBER', green: 'MATRIX', mono: 'MONO' };
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
    screen.classList.remove('view-glitch');
    void screen.offsetWidth;
    screen.classList.add('view-glitch');
    crumb.textContent = meta.crumb;
    if (options.commandText !== undefined) {
      setCommandLine(options.commandText);
    } else {
      typeCmd(meta.cmd);
    }
    document.dispatchEvent(new CustomEvent('adrian:view-rendered', { detail: { view: viewName } }));
    rewireInteractiveView();
    screen.scrollTop = 0;
    if (options.scrollToTerm && window.matchMedia('(max-width: 900px)').matches) {
      requestAnimationFrame(() => document.querySelector('.term')?.scrollIntoView({ block: 'start' }));
    }
  }

  function rewireInteractiveView() {
    screen.querySelectorAll('[data-nav]').forEach(b => {
      if (b.dataset.wiredNav === '1') return;
      b.dataset.wiredNav = '1';
      b.addEventListener('click', () => setView(b.getAttribute('data-nav'), { scrollToTerm: true }));
    });
    wireProjectCards();
    wirePhotoCards();
    assignProjectSerials();
  }

  document.addEventListener('adrian:content-applied', rewireInteractiveView);

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

  function renderTerminalOutput(command, lines, options = {}) {
    navBtns.forEach(b => b.classList.remove('active'));
    crumb.textContent = '~/terminal';
    const body = options.pre
      ? `<pre class="terminal-pre">${escapeHtml(options.pre)}</pre>`
      : `<ul class="terminal-lines">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
    screen.innerHTML = `
      <div class="view terminal-output">
        <div class="row-head">
          <span class="tag tag-cyan">&gt;_ ${escapeHtml(command)}</span>
          <span class="tag tag-mag">TERMINAL</span>
        </div>
        <h2 class="h2">COMMAND OUTPUT</h2>
        ${body}
      </div>
    `;
    screen.scrollTop = 0;
  }

  function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function bumpVisitCount() {
    let visits = 1;
    try {
      visits = Number(localStorage.getItem('adrianVisits') || 0) + 1;
      localStorage.setItem('adrianVisits', String(visits));
    } catch (_) {}
    return visits;
  }

  function readVisitCount() {
    try {
      return Number(localStorage.getItem('adrianVisits') || 1);
    } catch (_) {
      return 1;
    }
  }

  function cowsay(text) {
    const msg = (text || 'i build systems').slice(0, 48);
    const top = ` ${'_'.repeat(msg.length + 2)} `;
    const mid = `< ${msg} >`;
    const bot = ` ${'-'.repeat(msg.length + 2)} `;
    return [
      top,
      mid,
      bot,
      '        \\   ^__^',
      '         \\  (oo)\\_______',
      '            (__)\\       )\\/\\',
      '                ||----w |',
      '                ||     ||',
    ].join('\n');
  }

  function applyTheme(name) {
    const next = THEME_CYCLE.includes(name) ? name : 'default';
    document.body.dataset.theme = next;
    THEME_CYCLE.forEach((themeName) => {
      if (themeName !== 'default') document.body.classList.remove(`theme-${themeName}`);
    });
    if (next !== 'default') document.body.classList.add(`theme-${next}`);
    try { localStorage.setItem('crtTheme', next); } catch (_) {}
    const label = document.querySelector('.theme-label');
    if (label) label.textContent = THEME_LABELS[next] || 'CYAN';
    if (envPhosphor) envPhosphor.textContent = THEME_LABELS[next] || 'CYAN';
    if (window.PhosphorTheme) PhosphorTheme.apply(next);
    return next;
  }

  function cycleTheme(direction = 1) {
    const current = document.body.dataset.theme || 'default';
    const idx = THEME_CYCLE.indexOf(current);
    const next = THEME_CYCLE[(idx + direction + THEME_CYCLE.length) % THEME_CYCLE.length];
    return applyTheme(next);
  }

  function loadSavedTheme() {
    try {
      const saved = localStorage.getItem('crtTheme');
      if (saved && saved !== 'default') applyTheme(saved);
    } catch (_) {}
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  function runPingOutput(input) {
    renderTerminalOutput(input, ['PING github.com (TechnicalDree)...']);
    const lines = ['PING github.com (TechnicalDree)...'];
    let i = 0;
    const host = 'github.com';
    const id = setInterval(() => {
      if (i >= 4) {
        clearInterval(id);
        lines.push(`--- ${host} ping statistics ---`);
        lines.push('4 packets transmitted, 4 received, 0% packet loss');
        renderTerminalOutput(input, lines);
        return;
      }
      const ms = 18 + Math.floor(Math.random() * 24);
      lines.push(`64 bytes from ${host}: icmp_seq=${i + 1} ttl=52 time=${ms}ms`);
      renderTerminalOutput(input, lines);
      i += 1;
    }, 380);
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
    } else if (normalized === 'whoami') {
      renderTerminalOutput(input, [
        'adrian munoz (@a3rean)',
        'bs+ms electrical & computer engineering @ cmu',
        'software engineer · full-stack · systems · robotics',
        'graduating may 2026 · gpa 3.43',
      ]);
    } else if (normalized === 'neofetch') {
      renderTerminalOutput(input, [
        '       adrian@cmu-ece',
        '       os: adrian-OS 4.2.1',
        '       host: personal-website',
        '       kernel: vanilla-js',
        '       uptime: session active',
        '       shell: terminal-ui',
        '       stack: python · c++ · java · ts · react · aws',
      ]);
    } else if (normalized === 'arcade' || normalized === 'minigame' || normalized === 'neon runner') {
      openArcade();
      renderTerminalOutput(input, ['arcade cabinet opened', '// arrow keys or A/D to move · collect cyan packets']);
    } else if (normalized === 'fortune' || normalized === 'motd') {
      const quote = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      renderTerminalOutput(input, [`"${quote}"`, '// adrian-os fortune daemon']);
    } else if (normalized === 'uptime') {
      const s = ((Date.now() - startT) / 1000) | 0;
      renderTerminalOutput(input, [
        `session uptime: ${formatUptime(s)}`,
        `view: ${activeView}`,
        `theme: ${document.body.dataset.theme || 'default'}`,
        `operator: adrian@cmu-ece`,
      ]);
    } else if (normalized === 'stats' || normalized === 'visits') {
      renderTerminalOutput(input, [
        `site visits (local): ${readVisitCount()}`,
        `boot skipped: ${sessionStorage.getItem('bootDone') === '1' ? 'yes' : 'no'}`,
        `commands run: ${commandHistory.length}`,
      ]);
    } else if (normalized === 'ping' || normalized.startsWith('ping ')) {
      runPingOutput(input);
      setCommandLine('', true);
      return;
    } else if (normalized.startsWith('cowsay ')) {
      const msg = input.replace(/^cowsay\s+/i, '').trim() || 'hello world';
      renderTerminalOutput(input, [], { pre: cowsay(msg) });
    } else if (normalized === 'cowsay') {
      renderTerminalOutput(input, [], { pre: cowsay('i build systems') });
    } else if (normalized === 'theme' || normalized === 'phosphor') {
      const next = cycleTheme(1);
      renderTerminalOutput(input, [`phosphor mode: ${THEME_LABELS[next] || next}`]);
    } else if (normalized === 'email' || normalized === 'copy email') {
      copyText('adrianm2003az@gmail.com').then((ok) => {
        renderTerminalOutput(input, ok
          ? ['adrianm2003az@gmail.com copied to clipboard']
          : ['clipboard unavailable — adrianm2003az@gmail.com']);
        setCommandLine('', true);
      });
      return;
    } else if (normalized === 'matrix' || normalized === 'overdrive') {
      activateOverdrive();
      renderTerminalOutput(input, [
        'overdrive engaged',
        'neon bloom ↑ · city speed max · scanlines hot',
        'type "clear" to dismiss',
      ]);
    } else if (normalized === 'ls' || normalized === 'ls .' || normalized === 'ls ./') {
      renderTerminalOutput(input, ROOT_COMMANDS);
    } else if (normalized === 'pwd') {
      renderTerminalOutput(input, ['/home/adrian']);
    } else if (normalized === 'clear' || normalized === 'cls' || normalized === 'reset') {
      navBtns.forEach(b => b.classList.remove('active'));
      crumb.textContent = '~/terminal';
      screen.innerHTML = '';
    } else if (
      window.SiteAdmin
      && (normalized.startsWith('sudo')
        || normalized.startsWith('admin ')
        || normalized === 'admin')
    ) {
      window.SiteAdmin.runTerminalCommand(input, normalized).then((lines) => {
        renderTerminalOutput(input, lines || [
          `command not found: ${input}`,
          'type "help" for available commands',
        ]);
        setCommandLine('', true);
      });
      return;
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
      'whoami',
      'neofetch',
      'arcade',
      'fortune',
      'uptime',
      'ping',
      'cowsay',
      'theme',
      'email',
      'stats',
      'matrix',
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
    b.addEventListener('click', () => setView(b.dataset.view, { scrollToTerm: true }));
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
  loadSavedTheme();
  bumpVisitCount();
  setView('home');

  // Minimize / expand toggle — fades the terminal so the city is visible
  const stage = document.getElementById('stage');
  const minBtn = document.getElementById('minimize-btn');
  let minimized = false;
  function setMin(v) {
    minimized = v;
    stage.classList.toggle('minimized', v);
    document.body.classList.toggle('skyline-mode', v);
    minBtn.classList.toggle('is-min', v);
    minBtn.querySelector('.mb-label').textContent = v ? 'SHOW' : 'HIDE';
    minBtn.title = v ? 'Restore terminal' : 'Hide terminal — show city';
  }
  minBtn.addEventListener('click', () => setMin(!minimized));

  let projectModal = null;
  let projectModalCleanup = null;
  let bootActive = false;
  const bootScreen = document.getElementById('boot-screen');
  const bootLog = document.getElementById('boot-log');
  const bootBar = document.getElementById('boot-bar');
  let bootTimer = null;

  // Esc to toggle, also `b` for "background"
  window.addEventListener('keydown', (e) => {
    if (bootActive && bootScreen && !bootScreen.classList.contains('is-done')) return;
    if (projectModal && e.key === 'Escape') {
      e.preventDefault();
      closeProjectModal();
      return;
    }
    if (isEditableTarget(e.target)) return;
    if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') setMin(!minimized);
  });

  const VIEW_KEYS = {
    '0': 'home', '1': 'projects', '2': 'about', '3': 'log', '4': 'gallery', '5': 'contact',
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && projectModal) return;
    if (bootActive && bootScreen && !bootScreen.classList.contains('is-done')) {
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
        finishBoot();
      }
      return;
    }
    if (isEditableTarget(e.target)) return;
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      placeCaretAtEnd(cmd);
      return;
    }
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      renderTerminalOutput('help', COMMAND_HELP);
      setCommandLine('', true);
      return;
    }
    const view = VIEW_KEYS[e.key];
    if (view) {
      e.preventDefault();
      setView(view);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const idx = VIEW_ORDER.indexOf(activeView);
      setView(VIEW_ORDER[(idx - 1 + VIEW_ORDER.length) % VIEW_ORDER.length]);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const idx = VIEW_ORDER.indexOf(activeView);
      setView(VIEW_ORDER[(idx + 1) % VIEW_ORDER.length]);
      return;
    }
    if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      cycleTheme(1);
      showToast(`◆ PHOSPHOR · ${THEME_LABELS[document.body.dataset.theme || 'default']}`);
    }
    if ((e.key === 'w' || e.key === 'W') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      cycleWeather();
    }
  });

  // --- Project detail modal ---
  function closeProjectModal() {
    if (typeof projectModalCleanup === 'function') projectModalCleanup();
    projectModalCleanup = null;
    if (projectModal) {
      projectModal.remove();
      projectModal = null;
    }
  }

  function openProjectModal(card) {
    closeProjectModal();
    const title = card.querySelector('h3')?.textContent?.trim() || 'PROJECT';
    const desc = card.querySelector('p')?.textContent?.trim() || '';
    const date = card.querySelector('.prj-meta span:first-child')?.textContent?.trim() || '';
    const status = card.querySelector('.tag')?.textContent?.trim() || '';
    const chips = [...card.querySelectorAll('.prj-chips span')].map((el) => el.textContent.trim());
    const sn = card.getAttribute('data-sn') || '0000';
    const github = card.getAttribute('data-github') || '';
    const link = card.getAttribute('data-link') || '';
    const linkLabel = card.getAttribute('data-link-label') || 'VIEW PROJECT';
    const link2 = card.getAttribute('data-link-2') || '';
    const link2Label = card.getAttribute('data-link-2-label') || 'OPEN LINK';

    projectModal = document.createElement('div');
    projectModal.className = 'prj-modal-backdrop';
    const actionBtns = [
      github ? `<a href="${escapeHtml(github)}" target="_blank" rel="noreferrer">▶ VIEW REPO</a>` : '',
      link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">▶ ${escapeHtml(linkLabel)}</a>` : '',
      link2 ? `<a href="${escapeHtml(link2)}" target="_blank" rel="noreferrer">▶ ${escapeHtml(link2Label)}</a>` : '',
    ].filter(Boolean).join('');
    projectModal.innerHTML = `
      <article class="prj-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="prj-modal-hd">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="prj-modal-close" aria-label="Close">ESC</button>
        </div>
        <div class="prj-modal-body">
          ${date ? `<div class="prj-modal-date">${escapeHtml(date)}</div>` : ''}
          <p>${escapeHtml(desc)}</p>
          <div class="prj-modal-chips">${chips.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div>
          <div class="prj-modal-actions">${actionBtns}</div>
        </div>
        <div class="prj-modal-foot">// serial ${escapeHtml(sn)} · status ${escapeHtml(status)} · click outside to close</div>
      </article>
    `;
    projectModal.addEventListener('click', (ev) => {
      if (ev.target === projectModal) closeProjectModal();
    });
    projectModal.querySelector('.prj-modal-close')?.addEventListener('click', closeProjectModal);
    document.body.appendChild(projectModal);
  }

  function openPhotoModal(card) {
    closeProjectModal();
    const src = card.getAttribute('data-src') || card.querySelector('img')?.getAttribute('src') || '';
    const caption = card.getAttribute('data-caption') || card.querySelector('span')?.textContent?.trim() || 'PHOTO';
    if (!src) return;
    projectModal = document.createElement('div');
    projectModal.className = 'prj-modal-backdrop photo-modal-backdrop';
    projectModal.innerHTML = `
      <figure class="photo-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(caption)}">
        <button type="button" class="prj-modal-close photo-modal-close" aria-label="Close">ESC</button>
        <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}">
        <figcaption>${escapeHtml(caption)}</figcaption>
      </figure>
    `;
    projectModal.addEventListener('click', (ev) => {
      if (ev.target === projectModal) closeProjectModal();
    });
    projectModal.querySelector('.photo-modal-close')?.addEventListener('click', closeProjectModal);
    document.body.appendChild(projectModal);
  }

  function openArcade() {
    closeProjectModal();
    projectModal = document.createElement('div');
    projectModal.className = 'prj-modal-backdrop arcade-backdrop';
    projectModal.innerHTML = `
      <section class="arcade-cabinet" role="dialog" aria-modal="true" aria-label="Neon Packet Runner">
        <div class="arcade-head">
          <h3>NEON PACKET RUNNER</h3>
          <button type="button" class="prj-modal-close" aria-label="Close">ESC</button>
        </div>
        <canvas class="arcade-canvas" width="320" height="180"></canvas>
        <div class="arcade-hud">
          <span id="arcade-score">SCORE 000</span>
          <span id="arcade-lives">LIVES 3</span>
          <button type="button" id="arcade-restart">RESTART</button>
        </div>
        <p>ARROWS / A-D MOVE · COLLECT CYAN PACKETS · DODGE MAGENTA STATIC</p>
      </section>
    `;
    projectModal.addEventListener('click', (ev) => {
      if (ev.target === projectModal) closeProjectModal();
    });
    projectModal.querySelector('.prj-modal-close')?.addEventListener('click', closeProjectModal);
    document.body.appendChild(projectModal);

    const canvas = projectModal.querySelector('.arcade-canvas');
    const ctx2 = canvas.getContext('2d');
    const scoreEl = projectModal.querySelector('#arcade-score');
    const livesEl = projectModal.querySelector('#arcade-lives');
    const restart = projectModal.querySelector('#arcade-restart');
    const keys = new Set();
    let raf = 0;
    let state;

    function reset() {
      state = { x: 150, tick: 0, score: 0, lives: 3, speed: 1.25, objects: [], gameOver: false };
    }

    function spawnObject() {
      const packet = Math.random() < 0.58;
      state.objects.push({
        x: 12 + Math.random() * 296,
        y: -12,
        s: packet ? 7 : 9,
        vy: state.speed + Math.random() * 1.2,
        packet,
      });
    }

    function rectHit(a, b) {
      return a.x < b.x + b.s && a.x + a.w > b.x && a.y < b.y + b.s && a.y + a.h > b.y;
    }

    function drawPixelShip(x, y) {
      ctx2.fillStyle = '#36f5ff';
      ctx2.fillRect(x + 8, y, 8, 4);
      ctx2.fillRect(x + 4, y + 4, 16, 5);
      ctx2.fillRect(x, y + 9, 24, 4);
      ctx2.fillStyle = '#ff2fb3';
      ctx2.fillRect(x + 2, y + 13, 6, 2);
      ctx2.fillRect(x + 16, y + 13, 6, 2);
      ctx2.fillStyle = '#f6ff7a';
      ctx2.fillRect(x + 11, y + 4, 3, 3);
    }

    function drawObject(o) {
      if (o.packet) {
        ctx2.fillStyle = '#36f5ff';
        ctx2.fillRect(o.x, o.y, o.s, o.s);
        ctx2.fillStyle = '#e8fbff';
        ctx2.fillRect(o.x + 2, o.y + 2, o.s - 4, 1);
      } else {
        ctx2.fillStyle = '#ff2fb3';
        ctx2.fillRect(o.x, o.y, o.s, o.s);
        ctx2.fillStyle = '#020914';
        ctx2.fillRect(o.x + 2, o.y + 2, o.s - 4, o.s - 4);
        ctx2.fillStyle = '#f6ff7a';
        ctx2.fillRect(o.x + 3, o.y + 3, 2, 2);
      }
    }

    function frameArcade() {
      raf = requestAnimationFrame(frameArcade);
      state.tick += 1;
      if (!state.gameOver) {
        const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
        const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
        if (left) state.x -= 3.4;
        if (right) state.x += 3.4;
        state.x = Math.max(4, Math.min(292, state.x));
        if (state.tick % Math.max(18, 42 - Math.floor(state.score / 20)) === 0) spawnObject();
        state.speed = Math.min(3.6, 1.25 + state.score / 90);
      }

      ctx2.fillStyle = '#020914';
      ctx2.fillRect(0, 0, canvas.width, canvas.height);
      ctx2.fillStyle = '#082d46';
      for (let x = 0; x < canvas.width; x += 16) ctx2.fillRect(x, 0, 1, canvas.height);
      for (let y = (state.tick % 16); y < canvas.height; y += 16) ctx2.fillRect(0, y, canvas.width, 1);

      const player = { x: state.x, y: 152, w: 24, h: 16 };
      if (!state.gameOver) {
        for (let i = state.objects.length - 1; i >= 0; i -= 1) {
          const o = state.objects[i];
          o.y += o.vy;
          drawObject(o);
          if (rectHit(player, o)) {
            state.objects.splice(i, 1);
            if (o.packet) {
              state.score += 5;
            } else {
              state.lives -= 1;
              if (state.lives <= 0) state.gameOver = true;
            }
          } else if (o.y > canvas.height + 12) {
            state.objects.splice(i, 1);
          }
        }
      } else {
        state.objects.forEach(drawObject);
      }

      drawPixelShip(player.x, player.y);
      scoreEl.textContent = `SCORE ${String(state.score).padStart(3, '0')}`;
      livesEl.textContent = `LIVES ${Math.max(0, state.lives)}`;
      if (state.gameOver) {
        ctx2.fillStyle = 'rgba(2,9,20,0.72)';
        ctx2.fillRect(0, 0, canvas.width, canvas.height);
        ctx2.fillStyle = '#f6ff7a';
        ctx2.font = '16px "Press Start 2P", monospace';
        ctx2.fillText('GAME OVER', 70, 82);
        ctx2.font = '8px "Press Start 2P", monospace';
        ctx2.fillText('PRESS RESTART', 94, 104);
      }
    }

    function onKey(ev) {
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(ev.key)) {
        ev.preventDefault();
        keys.add(ev.key);
      }
    }
    function onKeyUp(ev) {
      keys.delete(ev.key);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    restart.addEventListener('click', reset);
    projectModalCleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
    reset();
    frameArcade();
  }

  function assignProjectSerials() {
    screen.querySelectorAll('.prj').forEach((el, i) => {
      el.setAttribute('data-sn', (0xA000 + i * 37).toString(16).toUpperCase());
    });
  }

  function wireProjectCards() {
    screen.querySelectorAll('.prj').forEach((card) => {
      if (card.dataset.wiredCard === '1') return;
      card.dataset.wiredCard = '1';
      card.addEventListener('click', () => openProjectModal(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProjectModal(card);
        }
      });
    });
  }

  function wirePhotoCards() {
    screen.querySelectorAll('.photo-card').forEach((card) => {
      if (card.dataset.wiredPhoto === '1') return;
      card.dataset.wiredPhoto = '1';
      card.addEventListener('click', () => openPhotoModal(card));
    });
  }

  // --- Live sys stats ---
  const sysBars = document.getElementById('sys-bars');
  const statState = { cpu: 62, mem: 78, net: 41 };

  function driftStat(key, min, max) {
    const delta = (Math.random() - 0.5) * 14;
    statState[key] = Math.max(min, Math.min(max, statState[key] + delta));
    return Math.round(statState[key]);
  }

  function updateSysBars() {
    if (!sysBars) return;
    sysBars.querySelectorAll('.bar').forEach((bar) => {
      const key = bar.dataset.stat;
      if (!key) return;
      const ranges = { cpu: [38, 88], mem: [55, 92], net: [12, 74] };
      const [lo, hi] = ranges[key] || [20, 80];
      const val = driftStat(key, lo, hi);
      const fill = bar.querySelector('.fill');
      const label = bar.querySelector('.bv');
      if (fill) fill.style.width = `${val}%`;
      if (label) label.textContent = `${val}%`;
    });
  }
  setInterval(updateSysBars, 2200);
  updateSysBars();

  // --- Environment HUD (sky phase) ---
  const envPhase = document.getElementById('env-phase');
  const envPhosphor = document.getElementById('env-phosphor');

  function phaseLabel(hour) {
    if (hour >= 5 && hour < 12) return 'MORNING';
    if (hour >= 12 && hour < 17) return 'AFTERNOON';
    if (hour >= 17 && hour < 21) return 'EVENING';
    return 'NIGHT';
  }

  function updateEnvHud() {
    const solar = window.CityEnvironment?.getLocalSolar?.() || { hour: new Date().getHours() };
    const theme = document.body.dataset.theme || 'default';
    if (envPhase) envPhase.textContent = phaseLabel(solar.hour);
    if (envPhosphor) envPhosphor.textContent = THEME_LABELS[theme] || 'CYAN';
  }
  setInterval(updateEnvHud, 5000);
  updateEnvHud();

  // --- Overdrive / Konami ---
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiIdx = 0;
  let overdriveOn = false;

  function showToast(msg) {
    const existing = document.querySelector('.overdrive-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'overdrive-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function activateOverdrive() {
    if (overdriveOn) return;
    overdriveOn = true;
    document.body.classList.add('overdrive-mode');
    showToast('◆ OVERDRIVE MODE ENGAGED');
    const speedInput = document.getElementById('city-speed');
    if (speedInput) {
      speedInput.value = '2.5';
      speedInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  window.addEventListener('keydown', (e) => {
    if (bootActive) return;
    if (isEditableTarget(e.target)) return;
    if (e.key === KONAMI[konamiIdx]) {
      konamiIdx += 1;
      if (konamiIdx >= KONAMI.length) {
        konamiIdx = 0;
        activateOverdrive();
      }
    } else {
      konamiIdx = e.key === KONAMI[0] ? 1 : 0;
    }
  });

  // --- Floppy save easter egg ---
  const floppyBtn = document.getElementById('floppy-btn');
  if (floppyBtn) {
    floppyBtn.addEventListener('click', () => {
      floppyBtn.classList.add('is-saving');
      floppyBtn.querySelector('.floppy-label').textContent = 'WRITING...';
      setTimeout(() => {
        floppyBtn.classList.remove('is-saving');
        floppyBtn.querySelector('.floppy-label').textContent = 'SAVED ✓';
        showToast('// state written to SAVE.DAT on A:');
        setTimeout(() => {
          floppyBtn.querySelector('.floppy-label').textContent = 'SAVE.DAT';
        }, 2400);
      }, 900);
    });
  }

  // --- Boot sequence (once per session) ---
  const BOOT_LINES = [
    'ADRIAN-OS BIOS v4.2.1 · CMU/ECE build',
    '',
    'POST .......... OK',
    'Checking RAM 8192MB ........ OK',
    'Mounting /home/adrian ...... OK',
    'Loading pixel skyline renderer',
    'Syncing github telemetry ..... OK',
    'Starting terminal shell ...... OK',
    '',
    'Welcome, operator.',
  ];

  function finishBoot() {
    if (!bootScreen || bootScreen.classList.contains('is-done')) return;
    bootActive = false;
    if (bootTimer) clearTimeout(bootTimer);
    bootScreen.classList.add('is-done');
    try { sessionStorage.setItem('bootDone', '1'); } catch (_) {}
  }

  function runBoot() {
    if (!bootScreen || !bootLog) return;
    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let skip = reducedMotion;
    try { if (sessionStorage.getItem('bootDone') === '1') skip = true; } catch (_) {}
    if (skip) {
      bootScreen.classList.add('is-done');
      return;
    }

    bootActive = true;
    bootScreen.classList.remove('is-done');
    bootLog.textContent = '';
    let line = 0;
    let progress = 0;

    const tick = () => {
      if (line < BOOT_LINES.length) {
        bootLog.textContent += `${BOOT_LINES[line]}\n`;
        line += 1;
        progress = Math.min(100, Math.round((line / BOOT_LINES.length) * 100));
        if (bootBar) bootBar.style.width = `${progress}%`;
        bootTimer = setTimeout(tick, line === 1 ? 120 : 85 + Math.random() * 90);
      } else {
        bootTimer = setTimeout(finishBoot, 420);
      }
    };
    tick();
  }

  runBoot();

  // --- Phosphor theme button ---
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = cycleTheme(1);
      showToast(`◆ PHOSPHOR · ${THEME_LABELS[next]}`);
    });
  }

  // --- Weather toggle (off by default): none → rain → snow → wind → fog ---
  const WEATHER_MODES = ['none', 'rain', 'snow', 'wind', 'fog'];
  const WEATHER_LABELS = { none: 'OFF', rain: 'RAIN', snow: 'SNOW', wind: 'WIND', fog: 'FOG' };
  const weatherBtn = document.getElementById('weather-btn');
  function reflectWeather(mode) {
    const safe = WEATHER_LABELS[mode] ? mode : 'none';
    if (!weatherBtn) return;
    const label = weatherBtn.querySelector('.weather-label');
    if (label) label.textContent = `WEATHER: ${WEATHER_LABELS[safe]}`;
    WEATHER_MODES.forEach((m) => weatherBtn.classList.remove(`wx-${m}`));
    if (safe !== 'none') weatherBtn.classList.add(`wx-${safe}`);
  }
  function cycleWeather() {
    const current = (window.City3D && window.City3D.weather) || 'none';
    const next = WEATHER_MODES[(WEATHER_MODES.indexOf(current) + 1) % WEATHER_MODES.length];
    if (window.City3D && typeof window.City3D.setWeather === 'function') {
      window.City3D.setWeather(next);
    } else {
      reflectWeather(next);
    }
    showToast(`☂ WEATHER · ${WEATHER_LABELS[next]}`);
  }
  if (weatherBtn) weatherBtn.addEventListener('click', cycleWeather);
  // Keep the label in sync when weather is set via the API or ?weather= URL param.
  // city-3d.js is a deferred module, so City3D isn't ready when app.js runs — the event
  // (dispatched from setWeather during init) and the ready event both cover initial sync.
  window.addEventListener('city-weather', (e) => reflectWeather(e.detail && e.detail.weather));
  window.addEventListener('city-3d-ready', () => {
    if (window.City3D) reflectWeather(window.City3D.weather);
  });

  // --- Idle skyline mode (auto-hide terminal after inactivity) ---
  const IDLE_MS = 90000;
  let idleTimer = null;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!minimized && !bootActive && !projectModal) {
        setMin(true);
        showToast('// idle · skyline mode engaged');
      }
    }, IDLE_MS);
  }
  ['mousemove', 'keydown', 'click', 'touchstart'].forEach((ev) => {
    window.addEventListener(ev, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();

  // Populate GitHub contribution history + Monkeytype widgets when home view renders.
  const GITHUB_USER = 'TechnicalDree';
  const MONKEYTYPE_USER = window.MONKEYTYPE_USER || 'TechnicalDree';
  const MONKEYTYPE_USER_CANDIDATES = [
    MONKEYTYPE_USER,
    ...(window.MONKEYTYPE_USER_CANDIDATES || []),
  ].filter(Boolean);
  const DATA_CACHE_KEY = Date.now().toString(36);
  let githubHistoryPromise;
  let monkeytypeHistoryPromise;
  let dashboardSnapshotsPromise;
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

  function fetchLocalJson(path) {
    const separator = path.includes('?') ? '&' : '?';
    return fetchJson(`${path}${separator}v=${DATA_CACHE_KEY}`);
  }

  function getGitHubHistory() {
    githubHistoryPromise ||= fetchLocalJson('assets/github-history.json')
      .catch(() => window.GITHUB_HISTORY);
    return githubHistoryPromise;
  }

  function getMonkeytypeHistory() {
    monkeytypeHistoryPromise ||= fetchLocalJson('assets/monkeytype-history.json')
      .catch(() => window.MONKEYTYPE_HISTORY);
    return monkeytypeHistoryPromise;
  }

  function getDashboardSnapshots() {
    dashboardSnapshotsPromise ||= fetchLocalJson('assets/dashboard-snapshots.json')
      .catch(() => window.DASHBOARD_SNAPSHOTS || {});
    return dashboardSnapshotsPromise;
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

    const history = await getGitHubHistory();
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
      const history = await getMonkeytypeHistory();
      const data = history?.profile || await fetchMonkeytypeProfile();
      const activity = monkeytypeActivity(data);
      renderMonkeytypeCalendar(grid, activity);
      setText('#mk-user-title', `◆ MONKEYTYPE // @${escapeHtml(data.name || MONKEYTYPE_USER)}`);
      setText('#mk-total', `${activity.total.toLocaleString()} tests`);
      if (meta) meta.textContent = `${data.name} · ${history ? 'cached export' : 'public profile'}`;
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

  async function renderCursorHeatmap() {
    const grid = $('#cursor-grid');
    if (!grid || grid.dataset.ready) return;
    grid.dataset.ready = 'loading';

    const cursor = (await getDashboardSnapshots()).cursor || {};
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
    grid.dataset.ready = '1';
  }

  async function renderWisprHeatmap() {
    const grid = $('#wispr-grid');
    if (!grid || grid.dataset.ready) return;
    grid.dataset.ready = 'loading';

    const wispr = (await getDashboardSnapshots()).wispr || {};
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
    grid.dataset.ready = '1';
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
