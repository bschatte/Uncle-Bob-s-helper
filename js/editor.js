// editor.js
// ---------------------------------------------------------------------------
// Caregiver mode. Opened by pressing and holding the small gear for 2 s.
// Tabs: Words, Groups, Settings, Backup.
// Nothing in here can be picked by gaze (no data-dwell), on purpose.
// ---------------------------------------------------------------------------

import { esc, picHtml, toast, resizeImage } from './util.js';
import { newId, buildDefaults, exportBackup, readBackupFile } from './storage.js';
import * as Speech from './speech.js';

const HOLD_MS = 2000;

// Quick-pick emoji in the word form. Add or remove any you like.
const EMOJI = ['👍', '👎', '🙏', '❤️', '🤕', '💊', '🚽', '🛏️', '🥤', '💧', '☕', '🍽️', '🍎', '🍞',
  '🥶', '🥵', '😴', '😊', '😢', '😨', '😤', '😂', '📺', '🎵', '📞', '👓', '📖', '🪥', '🚿',
  '🧥', '🧦', '🛋️', '🪑', '♿', '🌞', '🌧️', '🏠', '🌳', '🐶', '🐱', '⛪', '💬', '❓', '✋', '➕'];

export function createEditor(app) {
  const panel = document.getElementById('editor');
  const body = document.getElementById('editor-body');
  const gear = document.getElementById('gear');
  let tab = 'words';
  let wordsFilter = 'favorites';

  // ---------- Press-and-hold gear ----------
  let holdTimer = 0;
  const startHold = (e) => {
    e.preventDefault();
    gear.classList.add('holding');
    holdTimer = setTimeout(() => {
      gear.classList.remove('holding');
      open();
    }, HOLD_MS);
  };
  const cancelHold = () => {
    clearTimeout(holdTimer);
    gear.classList.remove('holding');
  };
  gear.addEventListener('pointerdown', startHold);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => gear.addEventListener(t, cancelHold));
  gear.addEventListener('contextmenu', (e) => e.preventDefault());
  gear.addEventListener('click', () => {
    if (!panel.hidden) return;
    toast('Press and hold for 2 seconds to open settings');
  });

  function open() {
    panel.hidden = false;
    render();
  }

  function close() {
    panel.hidden = true;
    app.applySettings();
    app.board.render();
  }
  document.getElementById('editor-close').addEventListener('click', close);

  panel.querySelector('.editor-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    tab = t.dataset.tab;
    render();
  });

  function render() {
    panel.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    if (tab === 'words') renderWords();
    else if (tab === 'categories') renderCategories();
    else if (tab === 'settings') renderSettings();
    else renderBackup();
  }

  const cats = () => app.state.categories;
  const catById = (id) => cats().find((c) => c.id === id);

  // ================= WORDS TAB =================
  function renderWords() {
    if (!catById(wordsFilter)) wordsFilter = cats()[0].id;
    const words = app.state.words.filter((w) => w.categoryId === wordsFilter);
    const color = catById(wordsFilter).color;
    body.innerHTML = `
      <div class="toolbar">
        <label>Group:
          <select id="words-filter">${cats().map((c) =>
            `<option value="${esc(c.id)}" ${c.id === wordsFilter ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <button class="btn btn-primary" data-act="add-word">➕ Add word</button>
      </div>
      <p class="help">Use ▲ ▼ to change the order on the board. ✏️ edits the word, picture, or group. ⭐ copies a word into Favorites.</p>
      <div class="list">
        ${words.length ? words.map((w, i) => `
          <div class="row" style="--cat-color:${esc(color)}">
            <div class="row-pic">${picHtml(w)}</div>
            <div class="row-main">
              <div class="row-title">${esc(w.text)}</div>
              ${w.say ? `<div class="row-sub">Says: “${esc(w.say)}”</div>` : ''}
            </div>
            <div class="row-btns">
              <button class="icon-btn" data-act="word-up" data-id="${esc(w.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
              <button class="icon-btn" data-act="word-down" data-id="${esc(w.id)}" ${i === words.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
              <button class="icon-btn" data-act="word-edit" data-id="${esc(w.id)}" aria-label="Edit">✏️</button>
              ${wordsFilter !== 'favorites' ? `<button class="icon-btn" data-act="word-fav" data-id="${esc(w.id)}" aria-label="Copy to Favorites">⭐</button>` : ''}
              <button class="icon-btn danger" data-act="word-delete" data-id="${esc(w.id)}" aria-label="Delete">🗑</button>
            </div>
          </div>`).join('') : '<p class="help">No words in this group yet.</p>'}
      </div>`;
    body.querySelector('#words-filter').addEventListener('change', (e) => {
      wordsFilter = e.target.value;
      renderWords();
    });
  }

  // Move a word up/down among the words of the same group.
  function moveWord(id, dir) {
    const all = app.state.words;
    const idx = all.findIndex((w) => w.id === id);
    if (idx < 0) return;
    let j = idx + dir;
    while (j >= 0 && j < all.length && all[j].categoryId !== all[idx].categoryId) j += dir;
    if (j < 0 || j >= all.length) return;
    [all[idx], all[j]] = [all[j], all[idx]];
    app.save();
    renderWords();
  }

  // ---------- Word form (add / edit) ----------
  const wordDialog = document.getElementById('word-dialog');
  const wordForm = document.getElementById('word-form');
  const photoInput = document.getElementById('photo-input');
  const photoPreview = document.getElementById('photo-preview');
  const photoRemove = document.getElementById('photo-remove');
  let editingId = null;
  let formImage = '';

  document.getElementById('emoji-picker').innerHTML =
    EMOJI.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
  document.getElementById('emoji-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-emoji]');
    if (b) wordForm.elements.emoji.value = b.dataset.emoji;
  });

  function showPhoto() {
    photoPreview.innerHTML = formImage ? `<img src="${esc(formImage)}" alt="">` : '';
    photoRemove.hidden = !formImage;
  }
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    try {
      formImage = await resizeImage(file);
      showPhoto();
    } catch (err) {
      alert(err.message);
    }
    photoInput.value = '';
  });
  photoRemove.addEventListener('click', () => { formImage = ''; showPhoto(); });

  function openWordForm(word) {
    editingId = word ? word.id : null;
    document.getElementById('word-dialog-title').textContent = word ? 'Edit word' : 'Add a word';
    wordForm.elements.categoryId.innerHTML = cats().map((c) =>
      `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join('');
    wordForm.elements.text.value = word ? word.text : '';
    wordForm.elements.say.value = word ? word.say : '';
    wordForm.elements.emoji.value = word ? word.emoji : '';
    wordForm.elements.categoryId.value = word ? word.categoryId : wordsFilter;
    formImage = word ? word.image : '';
    showPhoto();
    wordDialog.showModal();
  }
  document.getElementById('word-cancel').addEventListener('click', () => wordDialog.close());

  wordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = wordForm.elements;
    const data = {
      text: f.text.value.trim(),
      say: f.say.value.trim(),
      emoji: f.emoji.value.trim(),
      categoryId: f.categoryId.value,
      image: formImage,
    };
    if (!data.text) return;
    if (editingId) {
      const w = app.state.words.find((x) => x.id === editingId);
      // Moving to another group puts it at the end of that group.
      if (w.categoryId !== data.categoryId) {
        app.state.words = app.state.words.filter((x) => x.id !== editingId);
        app.state.words.push(Object.assign(w, data));
      } else {
        Object.assign(w, data);
      }
    } else {
      app.state.words.push({ id: newId(), ...data });
    }
    if (!app.save()) return;
    wordDialog.close();
    wordsFilter = data.categoryId;
    renderWords();
    toast('Saved');
  });

  // ================= GROUPS TAB =================
  function renderCategories() {
    const list = cats();
    body.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-primary" data-act="add-cat">➕ New group</button>
      </div>
      <p class="help">Groups appear as buttons above the tiles. Keep to about 6 so they stay big. Favorites can't be deleted.</p>
      <div class="list">
        ${list.map((c, i) => {
          const count = app.state.words.filter((w) => w.categoryId === c.id).length;
          return `
          <div class="row" style="--cat-color:${esc(c.color)}">
            <div class="row-pic">${esc(c.emoji)}</div>
            <div class="row-main">
              <div class="row-title">${esc(c.name)}</div>
              <div class="row-sub">${count} word${count === 1 ? '' : 's'}</div>
            </div>
            <div class="row-btns">
              <button class="icon-btn" data-act="cat-up" data-id="${esc(c.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
              <button class="icon-btn" data-act="cat-down" data-id="${esc(c.id)}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
              <button class="icon-btn" data-act="cat-edit" data-id="${esc(c.id)}" aria-label="Edit">✏️</button>
              ${c.id !== 'favorites' ? `<button class="icon-btn danger" data-act="cat-delete" data-id="${esc(c.id)}" aria-label="Delete">🗑</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  const catDialog = document.getElementById('cat-dialog');
  const catForm = document.getElementById('cat-form');
  let editingCat = null;

  function openCatForm(cat) {
    editingCat = cat ? cat.id : null;
    document.getElementById('cat-dialog-title').textContent = cat ? 'Edit group' : 'New group';
    catForm.elements.name.value = cat ? cat.name : '';
    catForm.elements.emoji.value = cat ? cat.emoji : '';
    catForm.elements.color.value = cat ? cat.color : '#1f6fd1';
    // Keep a custom color (e.g. from a backup) selectable.
    if (catForm.elements.color.value !== (cat ? cat.color : '#1f6fd1')) catForm.elements.color.value = '#555555';
    catDialog.showModal();
  }
  document.getElementById('cat-cancel').addEventListener('click', () => catDialog.close());
  catForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = catForm.elements;
    const data = { name: f.name.value.trim(), emoji: f.emoji.value.trim(), color: f.color.value };
    if (!data.name) return;
    if (editingCat) Object.assign(catById(editingCat), data);
    else app.state.categories.push({ id: newId('c'), ...data });
    app.save();
    catDialog.close();
    renderCategories();
  });

  function moveCat(id, dir) {
    const list = app.state.categories;
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    app.save();
    renderCategories();
  }

  function deleteCat(id) {
    const c = catById(id);
    const count = app.state.words.filter((w) => w.categoryId === id).length;
    const msg = count
      ? `Delete the group "${c.name}" and its ${count} word${count === 1 ? '' : 's'}?`
      : `Delete the group "${c.name}"?`;
    if (!confirm(msg)) return;
    app.state.categories = app.state.categories.filter((x) => x.id !== id);
    app.state.words = app.state.words.filter((w) => w.categoryId !== id);
    app.save();
    renderCategories();
  }

  // ================= SETTINGS TAB =================
  function segmented(name, options, value) {
    return `<div class="segmented" data-setting="${name}">${options.map(([v, label]) =>
      `<button type="button" data-value="${v}" aria-pressed="${String(v) === String(value)}">${label}</button>`).join('')}</div>`;
  }

  async function renderSettings() {
    const s = app.state.settings;
    const camState = app.gazeStatus();
    body.innerHTML = `
      <h3>Picking words</h3>
      <div class="setting">
        <div class="setting-label"><span>Dwell time (how long to look before a tile is picked)</span><span id="dwell-val">${(s.dwellMs / 1000).toFixed(2)} s</span></div>
        <input type="range" min="500" max="4000" step="250" value="${s.dwellMs}" data-setting-range="dwellMs">
      </div>
      <div class="setting">
        <div class="setting-label"><span>Tiles per page</span></div>
        ${segmented('tilesPerPage', [4, 5, 6, 7, 8, 9].map((n) => [n, n]), s.tilesPerPage)}
      </div>
      <div class="setting">
        <div class="setting-label"><span>Tile text size</span></div>
        ${segmented('textScale', [[0.8, 'Small'], [1, 'Medium'], [1.2, 'Large'], [1.4, 'Extra large']], s.textScale)}
      </div>
      <div class="setting switch-row">
        <span>Dwell with a pointer (iPad Eye Tracking, mouse, or trackpad)</span>
        <input type="checkbox" data-setting-check="hoverDwell" ${s.hoverDwell ? 'checked' : ''}>
      </div>

      <h3>Voice</h3>
      <div class="setting">
        <div class="setting-label"><span>Voice</span></div>
        <select data-setting-select="voiceURI"><option value="">Default voice</option></select>
      </div>
      <div class="setting">
        <div class="setting-label"><span>Speech speed</span><span id="rate-val">${s.rate.toFixed(2)}×</span></div>
        <input type="range" min="0.5" max="1.5" step="0.05" value="${s.rate}" data-setting-range="rate">
      </div>
      <button class="btn" data-act="test-voice">🔊 Test voice</button>

      <h3>Camera eye tracking</h3>
      <p class="help">Uses the front camera to follow the eyes. The video is processed on this iPad only and is never recorded or uploaded.
        Status: <strong>${esc(camState)}</strong></p>
      <div class="setting switch-row">
        <span>Camera eye tracking</span>
        <input type="checkbox" data-setting-check="gazeEnabled" ${s.gazeEnabled ? 'checked' : ''}>
      </div>
      <div class="setting switch-row">
        <span>Show the gaze dot</span>
        <input type="checkbox" data-setting-check="showGazeDot" ${s.showGazeDot ? 'checked' : ''}>
      </div>
      <div class="toolbar"><button class="btn" data-act="calibrate" ${s.gazeEnabled ? '' : 'disabled'}>🎯 Calibrate now</button></div>

      <h3>Look</h3>
      <div class="setting">
        <div class="setting-label"><span>Theme</span></div>
        ${segmented('theme', [['auto', 'Match iPad'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}
      </div>
      <div class="setting">
        <div class="setting-label"><span>Keyboard layout (Type screen)</span></div>
        ${segmented('keyboardLayout', [['qwerty', 'QWERTY'], ['abc', 'A B C']], s.keyboardLayout)}
      </div>`;

    // Fill in the voice list (voices load a moment later on iPad).
    const voices = await Speech.getVoices();
    const select = body.querySelector('[data-setting-select="voiceURI"]');
    if (!select) return; // tab changed while waiting
    const lang = (navigator.language || 'en').slice(0, 2);
    const sorted = [...voices].sort((a, b) =>
      (b.lang.startsWith(lang) - a.lang.startsWith(lang)) || a.name.localeCompare(b.name));
    select.innerHTML = '<option value="">Default voice</option>' + sorted.map((v) =>
      `<option value="${esc(v.voiceURI)}" ${v.voiceURI === s.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  }

  // Settings changes are saved immediately.
  body.addEventListener('input', (e) => {
    const key = e.target.dataset.settingRange;
    if (!key) return;
    const v = Number(e.target.value);
    app.state.settings[key] = v;
    if (key === 'dwellMs') body.querySelector('#dwell-val').textContent = `${(v / 1000).toFixed(2)} s`;
    if (key === 'rate') body.querySelector('#rate-val').textContent = `${v.toFixed(2)}×`;
    app.save();
    app.applySettings();
  });

  body.addEventListener('change', (e) => {
    const s = app.state.settings;
    if (e.target.dataset.settingSelect) {
      s[e.target.dataset.settingSelect] = e.target.value;
    } else if (e.target.dataset.settingCheck) {
      const key = e.target.dataset.settingCheck;
      if (key === 'gazeEnabled') {
        if (e.target.checked) app.enableCamera();   // shows the camera explanation first
        else app.disableCamera();
        return;
      }
      s[key] = e.target.checked;
    } else if (e.target.id === 'import-file') {
      importFile(e.target.files[0]);
      e.target.value = '';
      return;
    } else {
      return;
    }
    app.save();
    app.applySettings();
  });

  // ================= BACKUP TAB =================
  function renderBackup() {
    body.innerHTML = `
      <h3>Save a backup</h3>
      <p class="help">Saves all words, photos, groups, and settings into one file. Keep it in Files, iCloud Drive, or email it to yourself.</p>
      <button class="btn btn-primary" data-act="export">⬇️ Export backup</button>

      <h3>Restore from a backup</h3>
      <p class="help">Replaces everything on this iPad with the backup file.</p>
      <label class="btn file-btn" style="display:inline-flex;align-items:center">⬆️ Import backup
        <input id="import-file" type="file" accept="application/json,.json" hidden>
      </label>

      <h3>Start over</h3>
      <p class="help">Puts back the original words and settings. Your own words and photos will be deleted. Export a backup first if you might want them.</p>
      <button class="btn btn-danger" data-act="reset">Reset to defaults</button>

      <h3>About</h3>
      <p class="help">Talk Board saves everything on this iPad only. Nothing is sent to the internet.</p>`;
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      const n = data.words.length;
      if (!confirm(`Replace everything on this iPad with this backup (${n} words)?`)) return;
      app.replaceState(data);
      toast('Backup restored');
      render();
    } catch (err) {
      alert(`Could not import that file. ${err.message || ''}`);
    }
  }

  // ---------- Buttons on any tab ----------
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act], .segmented [data-value]');
    if (!b) return;

    if (b.dataset.value !== undefined && b.closest('.segmented')) {
      const key = b.closest('.segmented').dataset.setting;
      const raw = b.dataset.value;
      app.state.settings[key] = isNaN(Number(raw)) ? raw : Number(raw);
      app.save();
      app.applySettings();
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      return;
    }

    const id = b.dataset.id;
    const word = id && app.state.words.find((w) => w.id === id);
    switch (b.dataset.act) {
      case 'add-word': openWordForm(null); break;
      case 'word-edit': if (word) openWordForm(word); break;
      case 'word-up': moveWord(id, -1); break;
      case 'word-down': moveWord(id, 1); break;
      case 'word-fav':
        if (word) {
          app.state.words.push({ ...word, id: newId(), categoryId: 'favorites' });
          app.save();
          toast(`“${word.text}” copied to Favorites`);
        }
        break;
      case 'word-delete':
        if (word && confirm(`Delete “${word.text}”?`)) {
          app.state.words = app.state.words.filter((w) => w.id !== id);
          app.save();
          renderWords();
        }
        break;
      case 'add-cat': openCatForm(null); break;
      case 'cat-edit': openCatForm(catById(id)); break;
      case 'cat-up': moveCat(id, -1); break;
      case 'cat-down': moveCat(id, 1); break;
      case 'cat-delete': deleteCat(id); break;
      case 'test-voice': Speech.speak('Hello. This is how I will sound.'); break;
      case 'calibrate': close(); app.openCalibration(); break;
      case 'export': await exportBackup(app.state); break;
      case 'reset':
        if (confirm('Reset to the original words and settings? Your own words and photos will be deleted.')) {
          app.replaceState(buildDefaults());
          toast('Reset to defaults');
          render();
        }
        break;
    }
  });

  return { open, close, render, isOpen: () => !panel.hidden };
}
