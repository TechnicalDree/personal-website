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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
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
    const grid = root.querySelector('.view-projects .prj-grid');
    if (!grid || !Array.isArray(content.projects?.items)) return;
    grid.innerHTML = content.projects.items.map((item, index) => renderProjectCard(item, index)).join('');
  }

  function optionalAttr(name, value) {
    return value ? ` ${name}="${escapeHtml(value)}"` : '';
  }

  function renderProjectCard(item, index) {
    const base = `projects.items.${index}`;
    const chips = Array.isArray(item.chips) ? item.chips : [];
    return `
      <article class="prj" tabindex="0"${optionalAttr('data-github', item.github)}${optionalAttr('data-link', item.link)}${optionalAttr('data-link-label', item.linkLabel)}${optionalAttr('data-link-2', item.link2)}${optionalAttr('data-link-2-label', item.link2Label)}>
        <div class="prj-thumb" data-thumb="${escapeHtml(item.thumb || 'database')}"></div>
        <div class="prj-body">
          <div class="prj-meta">
            <span data-edit="${base}.date" data-edit-mode="text">${escapeHtml(item.date || 'DATE TBD')}</span>
            <span class="tag tag-yel" data-edit="${base}.status" data-edit-mode="text">${escapeHtml(item.status || 'PROJECT')}</span>
          </div>
          <h3 data-edit="${base}.title" data-edit-mode="text">${escapeHtml(item.title || 'PROJECT')}</h3>
          <p data-edit="${base}.description" data-edit-mode="text">${escapeHtml(item.description || '')}</p>
          <div class="prj-chips" data-edit="${base}.chips" data-edit-mode="chips">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}</div>
        </div>
      </article>
    `;
  }

  function applyAbout(root) {
    applyField(root, '.view-about .lede', 'about.ledeHtml', 'html');
    applyField(root, '.view-about .body', 'about.bodyHtml', 'html');
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
    const list = root.querySelector('.view-log .timeline');
    if (!list || !Array.isArray(content.experience?.items)) return;
    list.innerHTML = content.experience.items.map((item, index) => {
      const base = `experience.items.${index}`;
      return `
        <li>
          <span class="ts" data-edit="${base}.dates" data-edit-mode="text">${escapeHtml(item.dates || '')}</span>
          <span class="ev ev-ship" data-edit="${base}.tag" data-edit-mode="text">${escapeHtml(item.tag || '')}</span>
          <div class="ev-body" data-edit="${base}.bodyHtml" data-edit-mode="html">${item.bodyHtml || ''}</div>
        </li>
      `;
    }).join('');
  }

  function applyPhotos(root) {
    applyField(root, '.view-gallery .caption', 'photos.caption', 'text');
    const grid = root.querySelector('.view-gallery .photo-grid');
    if (!grid || !Array.isArray(content.photos?.items)) return;
    grid.innerHTML = content.photos.items.map((item, index) => {
      const base = `photos.items.${index}`;
      return `
        <button class="photo-card" type="button" data-src="${escapeHtml(item.src || '')}" data-caption="${escapeHtml(item.caption || `PHOTO ${index + 1}`)}">
          <img src="${escapeHtml(item.src || '')}" alt="${escapeHtml(item.alt || `Personal photo ${index + 1}`)}" loading="lazy" decoding="async">
          <span data-edit="${base}.caption" data-edit-mode="text">${escapeHtml(item.caption || `PHOTO ${index + 1}`)}</span>
        </button>
      `;
    }).join('');
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
    applyPhotos(screen);
    applyContact(screen);
    if (adminActive) enableEditMode(screen);
    document.dispatchEvent(new CustomEvent('adrian:content-applied', { detail: { root: screen } }));
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
