// keyboard.js
// ---------------------------------------------------------------------------
// Type-to-speak screen: big on-screen keyboard, Speak button, recent phrases,
// and "Save as tile" (adds the phrase to Favorites).
// Every key can be picked by touch, pointer dwell, or camera gaze.
// ---------------------------------------------------------------------------

import { esc, toast } from './util.js';
import { newId } from './storage.js';

const LAYOUTS = {
  qwerty: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  abc: ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ'],
};
const MAX_RECENT = 20;

export function createKeyboard(app) {
  const screen = document.getElementById('type-screen');
  const textEl = document.getElementById('type-text');
  const kb = document.getElementById('keyboard');
  const recentPanel = document.getElementById('recent-panel');
  const recentList = document.getElementById('recent-list');
  let text = '';

  function renderKeys() {
    const rows = LAYOUTS[app.state.settings.keyboardLayout] || LAYOUTS.qwerty;
    // data-repeat-guard lets the same letter be tapped quickly twice (e.g. "LL").
    const key = (k) => `<button class="key" data-dwell data-repeat-guard="200" data-key="${k}">${k}</button>`;
    kb.innerHTML = rows.map((r) => `<div class="kb-row">${[...r].map(key).join('')}</div>`).join('') + `
      <div class="kb-row">
        <button class="key mid" data-dwell data-repeat-guard="200" data-key="BACK">⌫ Delete</button>
        <button class="key" data-dwell data-repeat-guard="200" data-key="'">'</button>
        <button class="key wide" data-dwell data-repeat-guard="200" data-key=" ">Space</button>
        <button class="key" data-dwell data-repeat-guard="200" data-key="?">?</button>
        <button class="key mid" data-dwell data-repeat-guard="200" data-key="BACKWORD">⌫ Word</button>
      </div>`;
  }

  function showText() {
    textEl.textContent = text;
  }

  function press(k) {
    if (k === 'BACK') text = text.slice(0, -1);
    else if (k === 'BACKWORD') text = text.replace(/\S+\s*$/, ''); // removes the last word
    else if (k === ' ') { if (text && !text.endsWith(' ')) text += ' '; }
    else {
      // Capital letter at the start of a sentence, lower case otherwise.
      const startOfSentence = !text.trim() || /[.?!]\s*$/.test(text);
      text += startOfSentence ? k : k.toLowerCase();
    }
    showText();
  }

  function speakText() {
    const phrase = text.trim();
    if (!phrase) return;
    app.say(phrase, phrase, '');
    rememberPhrase(phrase);
  }

  function rememberPhrase(phrase) {
    const list = app.state.recentPhrases.filter((p) => p.text.toLowerCase() !== phrase.toLowerCase());
    list.unshift({ text: phrase, ts: Date.now() });
    app.state.recentPhrases = list.slice(0, MAX_RECENT);
    app.save();
  }

  // Adds the phrase as a tile in Favorites (the caregiver can move it later).
  function pin(phrase) {
    phrase = phrase.trim();
    if (!phrase) return toast('Type something first');
    const exists = app.state.words.some((w) => w.categoryId === 'favorites' && w.text.toLowerCase() === phrase.toLowerCase());
    if (exists) return toast('Already in Favorites');
    app.state.words.push({ id: newId(), categoryId: 'favorites', text: phrase, say: '', emoji: '💬', image: '' });
    app.save();
    app.board.render();
    toast('Saved to Favorites ⭐');
  }

  function renderRecent() {
    const items = app.state.recentPhrases;
    recentList.innerHTML = items.length
      ? items.map((p, i) => `
        <div class="recent-item">
          <button class="key recent-say" data-dwell data-recent="${i}">🔊 ${esc(p.text)}</button>
          <button class="key recent-pin" data-dwell data-pin="${i}">⭐ Save as tile</button>
        </div>`).join('')
      : '<p class="recent-empty">Phrases you speak will appear here.</p>';
  }

  // ---- Events ----
  kb.addEventListener('click', (e) => {
    const k = e.target.closest('[data-key]');
    if (k) press(k.dataset.key);
  });

  screen.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type-action]');
    if (!btn) return;
    switch (btn.dataset.typeAction) {
      case 'speak': speakText(); break;
      case 'clear': text = ''; showText(); break;
      case 'pin': pin(text); break;
      case 'recent': renderRecent(); recentPanel.hidden = false; break;
      case 'recent-close': recentPanel.hidden = true; break;
      case 'close': close(); break;
    }
  });

  recentList.addEventListener('click', (e) => {
    const say = e.target.closest('[data-recent]');
    const pinBtn = e.target.closest('[data-pin]');
    if (say) {
      const p = app.state.recentPhrases[Number(say.dataset.recent)];
      if (!p) return;
      text = p.text;
      showText();
      app.say(p.text, p.text, '');
      recentPanel.hidden = true;
    } else if (pinBtn) {
      const p = app.state.recentPhrases[Number(pinBtn.dataset.pin)];
      if (p) pin(p.text);
    }
  });

  // A hardware keyboard also works (handy for the caregiver).
  document.addEventListener('keydown', (e) => {
    if (screen.hidden || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Enter') speakText();
    else if (e.key === 'Backspace') press('BACK');
    else if (e.key === 'Escape') close();
    else if (e.key.length === 1) {
      text += e.key;
      showText();
    } else return;
    e.preventDefault();
  });

  function open() {
    renderKeys();
    recentPanel.hidden = true;
    showText();
    screen.hidden = false;
  }

  function close() {
    screen.hidden = true;
  }

  return { open, close, renderKeys };
}
