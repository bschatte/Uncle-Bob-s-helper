// storage.js
// ---------------------------------------------------------------------------
// Default words and settings, plus saving/loading everything in localStorage.
// To change the starting words, edit DEFAULT_CATEGORIES and DEFAULT_WORDS below.
// (Changes only show up after "Reset to defaults" in caregiver mode, because
// saved data takes priority over these defaults.)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'gazeboard.v1';

// Each category: id (never changes), name (shown on screen), emoji, color.
const DEFAULT_CATEGORIES = [
  { id: 'favorites', name: 'Favorites', emoji: '⭐', color: '#d4a000' },
  { id: 'needs', name: 'Needs', emoji: '🙋', color: '#1f6fd1' },
  { id: 'answers', name: 'Answers', emoji: '✅', color: '#1a8a3a' },
  { id: 'people', name: 'People', emoji: '👪', color: '#8a3ab9' },
  { id: 'feelings', name: 'Feelings', emoji: '💬', color: '#d1452f' },
];

// Each word: text (shown), category, emoji (optional),
// say (optional, spoken instead of the text, e.g. "I need the bathroom").
const DEFAULT_WORDS = [
  // Favorites start with copies of the most-used words.
  ['favorites', 'Yes', '👍'],
  ['favorites', 'No', '👎'],
  ['favorites', 'Pain', '🤕'],
  ['favorites', 'Bathroom', '🚽'],
  ['favorites', 'Thirsty', '🥤'],
  ['favorites', 'Love you', '❤️'],

  ['needs', 'Hungry', '🍽️'],
  ['needs', 'Thirsty', '🥤'],
  ['needs', 'Bathroom', '🚽'],
  ['needs', 'Pain', '🤕'],
  ['needs', 'Tired', '😴'],
  ['needs', 'Cold', '🥶'],
  ['needs', 'Hot', '🥵'],

  ['answers', 'Yes', '👍'],
  ['answers', 'No', '👎'],
  ['answers', 'Maybe', '🤷'],
  ['answers', 'Stop', '✋'],
  ['answers', 'More', '➕'],

  ['people', 'Wife', '👩'],
  ['people', 'Kids', '👧👦'],
  ['people', 'Nurse', '🧑‍⚕️'],
  ['people', 'Doctor', '🩺'],

  ['feelings', 'Happy', '😊'],
  ['feelings', 'Sad', '😢'],
  ['feelings', 'Scared', '😨'],
  ['feelings', 'Frustrated', '😤'],
  ['feelings', 'Love you', '❤️'],
];

export const DEFAULT_SETTINGS = {
  dwellMs: 1500,        // how long to look/hover before a tile is picked (500-4000)
  tilesPerPage: 6,      // 4 to 9
  textScale: 1,         // tile text size multiplier (0.8 - 1.6)
  voiceURI: '',         // '' = system default voice
  rate: 0.9,            // speech speed (0.5 slow - 1.5 fast)
  theme: 'auto',        // 'auto' | 'light' | 'dark'
  keyboardLayout: 'qwerty', // 'qwerty' | 'abc'
  gazeEnabled: false,   // camera eye tracking on/off
  showGazeDot: true,    // show where the camera thinks the eyes are looking
  hoverDwell: true,     // dwell with a pointer (iPad Eye Tracking, mouse, trackpad)
};

let idCounter = 0;
export function newId(prefix = 'w') {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter}${Math.random().toString(36).slice(2, 6)}`;
}

export function buildDefaults() {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    words: DEFAULT_WORDS.map(([categoryId, text, emoji]) => ({
      id: newId(),
      categoryId,
      text,
      emoji,
      say: '',
      image: '',
    })),
    settings: { ...DEFAULT_SETTINGS },
    recentPhrases: [],   // [{ text, ts }]
    calibration: null,   // saved camera calibration (see gaze.js)
  };
}

// Make sure loaded/imported data has every field we expect.
// Anything missing is filled in from the defaults, so old backups still work.
export function normalize(data) {
  const d = buildDefaults();
  if (!data || typeof data !== 'object') return d;
  const out = {
    version: 1,
    categories: Array.isArray(data.categories) ? data.categories : d.categories,
    words: Array.isArray(data.words) ? data.words : d.words,
    settings: { ...d.settings, ...(data.settings || {}) },
    recentPhrases: Array.isArray(data.recentPhrases) ? data.recentPhrases : [],
    calibration: data.calibration || null,
  };
  out.categories = out.categories
    .filter((c) => c && c.id && c.name)
    .map((c) => ({ id: String(c.id), name: String(c.name), emoji: c.emoji || '', color: c.color || '#555555' }));
  // Favorites must always exist.
  if (!out.categories.some((c) => c.id === 'favorites')) {
    out.categories.unshift({ ...DEFAULT_CATEGORIES[0] });
  }
  const catIds = new Set(out.categories.map((c) => c.id));
  out.words = out.words
    .filter((w) => w && w.text && catIds.has(w.categoryId))
    .map((w) => ({
      id: w.id || newId(),
      categoryId: w.categoryId,
      text: String(w.text),
      emoji: w.emoji || '',
      say: w.say || '',
      image: typeof w.image === 'string' ? w.image : '',
    }));
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not read saved data, using defaults', err);
  }
  return buildDefaults();
}

// Returns true if saved. False usually means storage is full (too many photos).
export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Save failed', err);
    alert('Could not save. Storage may be full. Try removing some photos, or export a backup.');
    return false;
  }
}

// Ask the browser not to clear our data when space runs low (best effort).
export function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

// ---------- Backup: export / import as a JSON file ----------

export async function exportBackup(data) {
  const json = JSON.stringify({ app: 'gaze-board', exportedAt: new Date().toISOString(), ...data }, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `talk-board-backup-${date}.json`;
  const file = new File([json], filename, { type: 'application/json' });

  // On iPad the Share sheet is the friendliest way ("Save to Files", AirDrop, email...).
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Talk Board backup' });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user closed the share sheet
    }
  }
  // Fallback: normal download.
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function readBackupFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text); // throws if not valid JSON
  if (!parsed || (!parsed.words && !parsed.categories && !parsed.settings)) {
    throw new Error('This file does not look like a Talk Board backup.');
  }
  return normalize(parsed);
}
