// app.js
// ---------------------------------------------------------------------------
// Starts everything and connects the pieces:
//   storage.js  - words/settings saved on the iPad
//   speech.js   - speaking out loud
//   dwell.js    - pick by looking/hovering (fill ring)
//   gaze.js     - camera eye tracking + calibration
//   board.js    - the tiles and group buttons
//   keyboard.js - type-to-speak screen
//   editor.js   - caregiver mode
// ---------------------------------------------------------------------------

import * as Storage from './storage.js';
import * as Speech from './speech.js';
import * as Dwell from './dwell.js';
import * as Gaze from './gaze.js';
import { createBoard } from './board.js';
import { createKeyboard } from './keyboard.js';
import { createEditor } from './editor.js';
import { toast, notice } from './util.js';

const $ = (id) => document.getElementById(id);

const BLOCKED_HELP = `<strong>The camera is blocked, so eye tracking is off.</strong><br>
  The board still works by touch.<br>
  To allow the camera: open the iPad <em>Settings</em> app › <em>Apps</em> › <em>Safari</em> › <em>Camera</em> › <em>Allow</em>
  (on older iPads: <em>Settings</em> › <em>Safari</em> › <em>Camera</em>). Then close and reopen Talk Board.`;

// ---------- Shared app object passed to every part ----------
const app = {
  state: Storage.load(),
  lastSaid: '',
  cameraState: 'off',

  save() {
    return Storage.save(app.state);
  },

  // Speak a word and show it in the banner.
  say(spoken, shown, picHtml) {
    Speech.speak(spoken);
    app.lastSaid = spoken;
    const text = $('banner-text');
    text.textContent = shown;
    text.classList.remove('hint');
    text.classList.toggle('long', shown.length > 22);
    $('banner-pic').innerHTML = picHtml || '';
    const banner = $('banner');
    banner.classList.remove('said');
    void banner.offsetWidth; // restart the flash animation
    banner.classList.add('said');
  },

  // Apply settings that affect how things look or behave.
  applySettings() {
    const s = app.state.settings;
    Dwell.setDwellTime(s.dwellMs);
    Dwell.setPointerDwell(s.hoverDwell);
    Speech.configure({ voiceURI: s.voiceURI, rate: s.rate });
    Gaze.setShowDot(s.showGazeDot);
    const root = document.documentElement;
    root.style.setProperty('--text-scale', s.textScale);
    if (s.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', s.theme);
  },

  // Used by Import and Reset.
  replaceState(data) {
    app.state = data;
    app.save();
    Gaze.setCalibration(data.calibration);
    if (!data.settings.gazeEnabled && Gaze.isRunning()) app.disableCamera();
    app.applySettings();
    app.board.render();
  },

  openTyping() {
    app.keyboard.open();
  },

  gazeStatus() {
    return CAMERA_LABELS[app.cameraState]?.[1] || 'Off';
  },

  // Turning the camera on from caregiver settings: explain first, then ask.
  enableCamera() {
    $('camera-consent').hidden = false;
  },

  disableCamera() {
    app.state.settings.gazeEnabled = false;
    app.save();
    Gaze.stop();
    if (app.editor.isOpen()) app.editor.render();
  },

  openCalibration,
};

// ---------- Camera status chip ----------
// state: [icon, words, warn?]
const CAMERA_LABELS = {
  off: ['', 'Off', false],
  loading: ['⏳', 'Starting camera…', false],
  uncalibrated: ['🎯', 'Tap to calibrate', true],
  tracking: ['👁️', 'Eye tracking on', false],
  'no-face': ['👁️', "Can't see face", true],
  blocked: ['📷', 'Camera blocked', true],
  error: ['⚠️', 'Camera problem', true],
};

function setCameraState(state) {
  if (state === app.cameraState) return; // gaze.js reports every frame; only redraw on change
  app.cameraState = state;
  const chip = $('camera-chip');
  const [icon, words, warn] = CAMERA_LABELS[state] || CAMERA_LABELS.error;
  chip.hidden = state === 'off';
  chip.textContent = `${icon} ${words}`;
  chip.classList.toggle('warn', !!warn);
}

$('camera-chip').addEventListener('click', () => {
  if (app.cameraState === 'blocked' || app.cameraState === 'error') notice(BLOCKED_HELP);
  else openCalibration();
});

async function startCamera() {
  try {
    await Gaze.start();
    if (!Gaze.hasCalibration()) openCalibration();
  } catch (err) {
    console.warn(err);
    if (err.code === 'blocked') {
      setCameraState('blocked');
      notice(BLOCKED_HELP);
    } else {
      setCameraState('error');
      notice(`<strong>Eye tracking could not start.</strong><br>${err.message}<br>The board still works by touch.`);
    }
  }
}

// Camera explanation screen buttons
$('consent-yes').addEventListener('click', () => {
  $('camera-consent').hidden = true;
  app.state.settings.gazeEnabled = true;
  app.save();
  if (app.editor.isOpen()) app.editor.close();
  startCamera();
});
$('consent-no').addEventListener('click', () => {
  $('camera-consent').hidden = true;
  app.state.settings.gazeEnabled = false;
  app.save();
  if (app.editor.isOpen()) app.editor.render();
});

// ---------- Calibration screen ----------
const calib = $('calibration');
const calibIntro = calib.querySelector('.calib-intro');
const calibRun = calib.querySelector('.calib-run');
const calibResult = calib.querySelector('.calib-result');

function showCalibStep(step) {
  calibIntro.hidden = step !== 'intro';
  calibRun.hidden = step !== 'run';
  calibResult.hidden = step !== 'result';
}

async function openCalibration() {
  if (!Gaze.isRunning()) {
    if (!app.state.settings.gazeEnabled) return toast('Turn on camera eye tracking in settings first');
    await startCamera();
    if (!Gaze.isRunning()) return;
    if (!calib.hidden) return; // startCamera already opened it
  }
  $('calib-preview').srcObject = Gaze.getStream();
  showCalibStep('intro');
  calib.hidden = false;
}

function closeCalibration() {
  calib.hidden = true;
  $('calib-preview').srcObject = null;
}

$('calib-cancel').addEventListener('click', closeCalibration);
$('calib-done').addEventListener('click', closeCalibration);
$('calib-start').addEventListener('click', runCalibration);
$('calib-again').addEventListener('click', runCalibration);

async function runCalibration() {
  showCalibStep('run');
  const result = await Gaze.calibrate(calibRun);
  calib.querySelector('.calib-result-text').textContent = result.message;
  showCalibStep('result');
}

// ---------- Banner, notices ----------
$('banner').addEventListener('click', () => {
  if (app.lastSaid) Speech.speak(app.lastSaid);
});
$('notice-close').addEventListener('click', () => { $('notice').hidden = true; });

// ---------- Stop zooming / scrolling / text selection on the board ----------
document.addEventListener('gesturestart', (e) => e.preventDefault()); // pinch zoom (Safari)
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  // Allow scrolling only inside the caregiver panel, forms, and recent list.
  if (!e.target.closest('.scrollable, dialog')) e.preventDefault();
}, { passive: false });
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('input, textarea')) e.preventDefault();
});

// ---------- Start up ----------
app.applySettings();
Dwell.init();
Gaze.init({
  calibration: app.state.calibration,
  showDot: app.state.settings.showGazeDot,
  onStatus: (state) => setCameraState(state),
  onCalibrationSaved: (cal) => {
    app.state.calibration = cal;
    app.save();
  },
});
app.board = createBoard(app);
app.keyboard = createKeyboard(app);
app.editor = createEditor(app);
app.board.render();
Storage.requestPersistence();

// "Tap to start" unlocks speech on iPad (Safari needs one real tap first).
$('start-button').addEventListener('click', () => {
  Speech.unlock();
  $('start-screen').hidden = true;
  if (app.state.settings.gazeEnabled) startCamera();
});

// Offline support (see sw.js).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker failed', err));
  });
}
