// board.js
// ---------------------------------------------------------------------------
// Draws the main board: the group (category) bar and the grid of word tiles,
// with Back/Next tiles when a group has more words than fit on one page.
// ---------------------------------------------------------------------------

import { esc, picHtml } from './util.js';

// How many columns x rows to use for each "tiles per page" setting.
// Wide screen (iPad sideways) and tall screen (iPad upright) differ.
const SHAPES = {
  wide: { 4: [2, 2], 5: [3, 2], 6: [3, 2], 7: [4, 2], 8: [4, 2], 9: [3, 3] },
  tall: { 4: [2, 2], 5: [2, 3], 6: [2, 3], 7: [2, 4], 8: [2, 4], 9: [3, 3] },
};

export function createBoard(app) {
  const catBar = document.getElementById('category-bar');
  const grid = document.getElementById('grid');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageLabel = document.getElementById('page-label');

  const view = { categoryId: 'favorites', page: 0 };

  function currentWords() {
    return app.state.words.filter((w) => w.categoryId === view.categoryId);
  }

  function renderCategories() {
    const cats = app.state.categories;
    if (!cats.some((c) => c.id === view.categoryId)) view.categoryId = cats[0]?.id;
    catBar.innerHTML = cats.map((c) => `
      <button class="cat-btn" data-dwell data-cat="${esc(c.id)}" style="--cat-color:${esc(c.color)}"
        aria-pressed="${c.id === view.categoryId}">
        <span class="cat-emoji" aria-hidden="true">${esc(c.emoji)}</span><span class="cat-name">${esc(c.name)}</span>
      </button>`).join('') + `
      <button class="cat-btn type-btn" data-dwell data-open-type>
        <span class="cat-emoji" aria-hidden="true">⌨️</span><span class="cat-name">Type</span>
      </button>`;
  }

  function renderGrid() {
    const perPage = app.state.settings.tilesPerPage;
    const words = currentWords();
    const pages = Math.max(1, Math.ceil(words.length / perPage));
    view.page = ((view.page % pages) + pages) % pages;

    const wide = window.innerWidth >= window.innerHeight;
    const [cols, rows] = SHAPES[wide ? 'wide' : 'tall'][perPage] || [3, 2];
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;

    const cat = app.state.categories.find((c) => c.id === view.categoryId);
    const color = cat ? cat.color : '';
    const shown = words.slice(view.page * perPage, (view.page + 1) * perPage);

    let html = shown.map((w) => {
      const pic = picHtml(w);
      return `
        <button class="tile${pic ? '' : ' no-pic'}" data-dwell data-word="${esc(w.id)}" style="--cat-color:${esc(color)}">
          ${pic ? `<span class="tile-pic">${pic}</span>` : ''}
          <span class="tile-word">${esc(w.text)}</span>
        </button>`;
    }).join('');
    // Keep empty spaces so tiles stay in the same place on every page.
    for (let i = shown.length; i < cols * rows; i++) html += '<div class="tile empty"></div>';
    if (!words.length) {
      html = `<div class="tile no-pic" style="grid-column:1/-1;grid-row:1/-1">
        <span class="tile-word" style="font-size:2rem;color:var(--muted)">No words in this group yet.<br>Add some in caregiver settings.</span></div>`;
    }
    grid.innerHTML = html;

    const paged = pages > 1;
    prevBtn.hidden = nextBtn.hidden = !paged;
    pageLabel.textContent = paged ? `${view.page + 1} of ${pages}` : '';
  }

  function render() {
    renderCategories();
    renderGrid();
  }

  function showCategory(id) {
    view.categoryId = id;
    view.page = 0;
    render();
  }

  // ---- Clicks (a tap, or a finished dwell) ----
  catBar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.hasAttribute('data-open-type')) return app.openTyping();
    if (btn.dataset.cat) showCategory(btn.dataset.cat);
  });

  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-word]');
    if (!tile) return;
    const word = app.state.words.find((w) => w.id === tile.dataset.word);
    if (word) app.say(word.say || word.text, word.text, picHtml(word));
  });

  prevBtn.addEventListener('click', () => { view.page -= 1; renderGrid(); });
  nextBtn.addEventListener('click', () => { view.page += 1; renderGrid(); });

  // Re-layout when the iPad is turned.
  let lastWide = window.innerWidth >= window.innerHeight;
  window.addEventListener('resize', () => {
    const wide = window.innerWidth >= window.innerHeight;
    if (wide !== lastWide) {
      lastWide = wide;
      renderGrid();
    }
  });

  return { render, showCategory, view };
}
