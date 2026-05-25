// Content hydration + password-protected inline editing for site owners.
(function () {
  const CONTENT_URL = 'assets/site-content.json';
  const SESSION_KEY = 'adrianAdminSession';
  const PASSWORD_HASH_KEY = 'adrianAdminPasswordHash';
  const SESSION_MS = 24 * 60 * 60 * 1000;

  let content = null;
  let adminActive = false;
  let adminBar = null;

  function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  function setPath(obj, path, value) {
    const parts = path.split('.');
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function toast(msg) {
    const existing = document.querySelector('.overdrive-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'overdrive-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function isSessionValid() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const session = JSON.parse(raw);
      return session.expiresAt > Date.now();
    } catch (_) {
      return false;
    }
  }

  function saveSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + SESSION_MS }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getAdminHash() {
    try {
      const stored = localStorage.getItem(PASSWORD_HASH_KEY);
      if (stored) return stored;
    } catch (_) {}
    return window.ADMIN_CONFIG && window.ADMIN_CONFIG.passwordHash;
  }

  function storeAdminHash(hash) {
    try {
      localStorage.setItem(PASSWORD_HASH_KEY, hash);
    } catch (_) {}
  }

  async function loadContent() {
    const res = await fetch(CONTENT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${CONTENT_URL}`);
    content = await res.json();
    return content;
  }

  function applyProfile() {
    if (!content) return;
    const map = [
      ['.portrait .name', 'profile.name', 'text'],
      ['.portrait .handle', 'profile.handle', 'text'],
      ['.portrait .bio', 'profile.bio', 'text'],
      ['.status-grid .stat:nth-child(1) .v', 'profile.statCmu', 'text'],
      ['.status-grid .stat:nth-child(2) .v', 'profile.statGrad', 'text'],
      ['.status-grid .stat:nth-child(4) .v', 'profile.statGithub', 'text'],
    ];
    map.forEach(([selector, path, mode]) => applyField(document, selector, path, mode));
  }

  function applyField(root, selector, path, mode) {
    const el = root.querySelector(selector);
    const value = getPath(content, path);
    if (!el || value == null) return;
    if (mode === 'html') el.innerHTML = value;
    else el.textContent = value;
    el.dataset.edit = path;
    el.dataset.editMode = mode;
  }

  function applyHome(root) {
    applyField(root, '.glitch', 'home.headlineHtml', 'html');
    const glitch = root.querySelector('.glitch');
    if (glitch && content.home.headlineGlitch) glitch.dataset.text = content.home.headlineGlitch;
    applyField(root, '.view-home .lede', 'home.ledeHtml', 'html');
    applyField(root, '.view-home .kv div:nth-child(1) .kvv', 'home.status', 'text');
    applyField(root, '.view-home .kv div:nth-child(2) .kvv', 'home.stack', 'text');
    applyField(root, '.view-home .kv div:nth-child(3) .kvv', 'home.focus', 'text');
    applyField(root, '.view-home .kv div:nth-child(4) .kvv', 'home.gpa', 'text');

    const ticker = root.querySelector('.ticker');
    if (ticker && Array.isArray(content.home.ticker)) {
      ticker.innerHTML = content.home.ticker.map((line) => `<span>${line}</span>`).join('');
      ticker.dataset.edit = 'home.ticker';
      ticker.dataset.editMode = 'ticker';
    }
  }

  function applyProjects(root) {
    applyField(root, '.view-projects .tag.tag-mag', 'projects.countLabel', 'text');
    const cards = root.querySelectorAll('.view-projects .prj');
    content.projects.items.forEach((item, index) => {
      const card = cards[index];
      if (!card) return;
      const base = `projects.items.${index}`;
      applyField(root, `.view-projects .prj:nth-child(${index + 1}) .prj-meta .tag`, `${base}.status`, 'text');
      applyField(root, `.view-projects .prj:nth-child(${index + 1}) h3`, `${base}.title`, 'text');
      applyField(root, `.view-projects .prj:nth-child(${index + 1}) p`, `${base}.description`, 'text');
      const chips = card.querySelector('.prj-chips');
      if (chips && Array.isArray(item.chips)) {
        chips.innerHTML = item.chips.map((chip) => `<span>${chip}</span>`).join('');
        chips.dataset.edit = `${base}.chips`;
        chips.dataset.editMode = 'chips';
      }
    });
  }

  function applyAbout(root) {
    applyField(root, '.view-about .lede', 'about.ledeHtml', 'html');
    applyField(root, '.view-about .body', 'about.bodyHtml', 'html');
    applyField(root, '.view-about .quote p', 'about.quote', 'text');
    const bullets = root.querySelectorAll('.view-about .bullet li');
    content.about.signals.forEach((line, index) => {
      const li = bullets[index];
      if (!li) return;
      li.textContent = line;
      li.dataset.edit = `about.signals.${index}`;
      li.dataset.editMode = 'text';
    });
    const specRows = [
      ['about.specClass', 1],
      ['about.specSchool', 2],
      ['about.specDegree', 3],
      ['about.specMinor', 4],
      ['about.specGrad', 5],
    ];
    specRows.forEach(([path, row]) => {
      applyField(root, `.view-about .spec-card:first-of-type .spec-row:nth-child(${row}) span:last-child`, path, 'text');
    });
    content.about.skills.forEach((skill, index) => {
      const row = root.querySelectorAll('.view-about .spec-card:nth-of-type(2) .skill')[index];
      if (!row) return;
      const label = row.querySelector('span');
      const fill = row.querySelector('.fi');
      if (label) {
        label.textContent = skill.name;
        label.dataset.edit = `about.skills.${index}.name`;
        label.dataset.editMode = 'text';
      }
      if (fill) {
        fill.style.width = skill.width;
        fill.dataset.edit = `about.skills.${index}.width`;
        fill.dataset.editMode = 'width';
      }
    });
  }

  function applyExperience(root) {
    const items = root.querySelectorAll('.view-log .timeline li');
    content.experience.items.forEach((item, index) => {
      const li = items[index];
      if (!li) return;
      const base = `experience.items.${index}`;
      const ts = li.querySelector('.ts');
      const tag = li.querySelector('.ev');
      const body = li.querySelector('.ev-body');
      if (ts) {
        ts.textContent = item.dates;
        ts.dataset.edit = `${base}.dates`;
        ts.dataset.editMode = 'text';
      }
      if (tag) {
        tag.textContent = item.tag;
        tag.dataset.edit = `${base}.tag`;
        tag.dataset.editMode = 'text';
      }
      if (body) {
        body.innerHTML = item.bodyHtml;
        body.dataset.edit = `${base}.bodyHtml`;
        body.dataset.editMode = 'html';
      }
    });
  }

  function applySkills(root) {
    applyField(root, '.view-gallery .caption', 'skills.caption', 'text');
  }

  function applyContact(root) {
    applyField(root, '.view-contact .disclaimer', 'contact.disclaimer', 'text');
    const channels = root.querySelectorAll('.view-contact .channels .chan');
    content.contact.channels.forEach((channel, index) => {
      const el = channels[index];
      if (!el) return;
      const base = `contact.channels.${index}`;
      const icon = el.querySelector('.c-icon');
      const label = el.querySelector('b');
      const value = el.querySelector('em');
      if (icon) {
        icon.textContent = channel.icon;
        icon.dataset.edit = `${base}.icon`;
        icon.dataset.editMode = 'text';
      }
      if (label) {
        label.textContent = channel.label;
        label.dataset.edit = `${base}.label`;
        label.dataset.editMode = 'text';
      }
      if (value) {
        value.textContent = channel.value;
        value.dataset.edit = `${base}.value`;
        value.dataset.editMode = 'text';
      }
      if (channel.href && !channel.disabled) el.href = channel.href;
    });
  }

  function applyAll(root = document) {
    if (!content) return;
    applyProfile();
    const screen = root.querySelector('#screen') || document.getElementById('screen');
    if (!screen) return;
    applyHome(screen);
    applyProjects(screen);
    applyAbout(screen);
    applyExperience(screen);
    applySkills(screen);
    applyContact(screen);
    if (adminActive) enableEditMode(screen);
  }

  function collectEditableValues(root = document) {
    root.querySelectorAll('[data-edit]').forEach((el) => {
      const path = el.dataset.edit;
      const mode = el.dataset.editMode || 'text';
      if (!path) return;
      if (mode === 'html') setPath(content, path, el.innerHTML.trim());
      else if (mode === 'ticker') {
        setPath(content, path, Array.from(el.querySelectorAll('span')).map((span) => span.innerHTML.trim()));
      } else if (mode === 'chips') {
        setPath(content, path, Array.from(el.querySelectorAll('span')).map((span) => span.textContent.trim()));
      } else if (mode === 'width') {
        setPath(content, path, el.style.width || el.getAttribute('style')?.match(/width:\s*([^;]+)/)?.[1]?.trim() || '0%');
      } else setPath(content, path, el.textContent.trim());
    });
    const glitch = root.querySelector('.glitch');
    if (glitch && glitch.dataset.text) content.home.headlineGlitch = glitch.dataset.text;
  }

  function enableEditMode(root = document) {
    root.querySelectorAll('[data-edit]').forEach((el) => {
      if (el.dataset.editMode === 'width') {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
        return;
      }
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      el.classList.add('is-editing');
    });
    document.body.classList.add('admin-edit-mode');
  }

  function disableEditMode(root = document) {
    root.querySelectorAll('[data-edit]').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.classList.remove('is-editing');
    });
    document.body.classList.remove('admin-edit-mode');
  }

  function downloadContent() {
    collectEditableValues();
    const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-content.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderAdminBar() {
    if (adminBar) adminBar.remove();
    adminBar = document.createElement('div');
    adminBar.className = 'admin-bar';
    adminBar.innerHTML = `
      <span class="admin-bar-label">◆ ADMIN EDIT MODE</span>
      <span class="admin-bar-hint">Click any highlighted text to edit</span>
      <div class="admin-bar-actions">
        <button type="button" class="admin-btn" data-action="save">SAVE JSON</button>
        <button type="button" class="admin-btn admin-btn-ghost" data-action="logout">LOG OUT</button>
      </div>
    `;
    adminBar.querySelector('[data-action="save"]').addEventListener('click', () => {
      downloadContent();
      toast('// site-content.json downloaded — replace assets/site-content.json and commit');
    });
    adminBar.querySelector('[data-action="logout"]').addEventListener('click', logoutAdmin);
    document.body.appendChild(adminBar);
  }

  function removeAdminBar() {
    if (adminBar) {
      adminBar.remove();
      adminBar = null;
    }
  }

  async function unlockWithPassword(password) {
    const pass = password.trim();
    if (!pass) {
      return ['usage: sudo <password>', '// first run sets your operator password and unlocks editing'];
    }
    if (adminActive) {
      return ['// admin edit mode already active', '// type "admin logout" to end session'];
    }

    const hash = await sha256(pass);
    const expected = getAdminHash();
    if (!expected) {
      storeAdminHash(hash);
      activateAdmin();
      return [
        '// operator password configured (stored in this browser)',
        '// admin editor unlocked · click highlighted text to edit',
        '// save with SAVE JSON or the floppy button',
      ];
    }
    if (hash !== expected) {
      return ['// authentication failed'];
    }
    activateAdmin();
    return [
      '// admin editor unlocked · click highlighted text to edit',
      '// save with SAVE JSON or the floppy button',
    ];
  }

  async function changePassword(rawInput) {
    if (!adminActive) {
      return ['// admin session required', '// run: sudo <password>'];
    }
    const next = rawInput.replace(/^admin\s+passwd\s+/i, '').trim();
    if (!next) {
      return ['usage: admin passwd <new-password>'];
    }
    storeAdminHash(await sha256(next));
    return ['// operator password updated for this browser'];
  }

  async function runTerminalCommand(rawInput, normalized) {
    if (normalized.startsWith('sudo')) {
      const password = rawInput.replace(/^sudo\s+/i, '');
      return unlockWithPassword(password);
    }
    if (normalized === 'admin logout' || normalized === 'sudo logout') {
      if (!adminActive) return ['// no active admin session'];
      logoutAdmin();
      return ['// admin session closed'];
    }
    if (normalized.startsWith('admin passwd')) {
      return changePassword(rawInput);
    }
    if (normalized === 'admin status') {
      return [
        `// edit mode: ${adminActive ? 'ON' : 'off'}`,
        `// password: ${getAdminHash() ? 'configured' : 'not set (run sudo <password>)'}`,
      ];
    }
    return null;
  }

  function activateAdmin() {
    adminActive = true;
    saveSession();
    renderAdminBar();
    applyAll();
    toast('// admin editor unlocked');
  }

  function logoutAdmin() {
    adminActive = false;
    clearSession();
    removeAdminBar();
    disableEditMode();
    toast('// admin session closed');
  }

  function wireAdminEntry() {
    const floppy = document.getElementById('floppy-btn');
    if (floppy) {
      floppy.addEventListener('click', (e) => {
        if (!adminActive) return;
        e.stopImmediatePropagation();
        downloadContent();
        toast('// site-content.json downloaded — replace assets/site-content.json and commit');
      }, true);
    }
  }

  document.addEventListener('adrian:view-rendered', () => {
    applyAll();
  });

  window.SiteAdmin = {
    isActive: () => adminActive,
    runTerminalCommand,
  };

  window.addEventListener('load', async () => {
    try {
      await loadContent();
      applyAll();
      if (isSessionValid()) activateAdmin();
      wireAdminEntry();
    } catch (err) {
      console.warn('Site content loader:', err);
    }
  });
})();
