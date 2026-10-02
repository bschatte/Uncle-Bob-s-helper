// gaze.js
// ---------------------------------------------------------------------------
// Camera eye tracking with MediaPipe Face Landmarker.
//
// How it works, in plain terms:
//  1. The front camera video is analysed ON THE IPAD. No video or images are
//     ever uploaded or saved. (The MediaPipe library and face model are stored
//     inside this app, in /vendor/mediapipe, so it even works offline.)
//  2. For each frame we find the eye corners and the centre of each iris.
//     Where the iris sits between the eye corners tells us roughly where the
//     person is looking (left/right and up/down).
//  3. A 5-point calibration (look at 5 dots) teaches us how those iris
//     positions match points on the screen.
//  4. The estimated gaze point is smoothed and passed to dwell.js, which
//     runs the same fill ring used for pointer hover.
//
// Camera tracking is approximate. It works best with good light on the face,
// the iPad held still (a stand helps), and the face 30-60 cm from the screen.
// ---------------------------------------------------------------------------

import * as Dwell from './dwell.js';

const VENDOR = new URL('../vendor/mediapipe/', import.meta.url).href;

// Face landmark numbers (from the MediaPipe face mesh).
// "Right eye" = the person's right eye, which is on the LEFT of the camera image.
const EYES = [
  { cornerA: 33, cornerB: 133, top: 159, bottom: 145, iris: 468 },   // person's right eye
  { cornerA: 362, cornerB: 263, top: 386, bottom: 374, iris: 473 },  // person's left eye
];

// Where the 5 calibration dots appear, as fractions of the screen.
const CALIBRATION_POINTS = [
  [0.5, 0.5], [0.1, 0.12], [0.9, 0.12], [0.9, 0.88], [0.1, 0.88],
];

const SMOOTHING = 0.25;        // 0-1. Lower = steadier but slower dot.
const GRACE_MS = 350;          // keep the current tile this long if the gaze briefly slips off it
const STICKY_MARGIN = 0.12;    // stay on a tile if the gaze is within 12% of its size outside its edge
const NO_FACE_MS = 600;        // after this long without a face, stop dwelling
const BLINK_RATIO = 0.12;      // eye openness below this = blink, frame ignored

let landmarker = null;
let video = null;
let stream = null;
let running = false;
let rafId = 0;
let lastVideoTime = -1;
let calibration = null;        // { cx: [3 numbers], cy: [3 numbers], norm: {...} }
let smoothed = null;           // smoothed gaze point {x, y} in px
let lastFaceTime = 0;
let gazeEl = null;
let leftElAt = 0;
let showDot = true;
let dot = null;
let sampleListener = null;     // used during calibration
let onStatus = () => {};
let onCalibrationSaved = () => {};

export function init(opts) {
  onStatus = opts.onStatus || onStatus;
  onCalibrationSaved = opts.onCalibrationSaved || onCalibrationSaved;
  calibration = opts.calibration || null;
  showDot = opts.showDot !== false;
  video = document.getElementById('camera-video');
  dot = document.getElementById('gaze-dot');

  // Turn the camera off while the app is in the background, back on when it returns.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) {
      stopCamera();
      running = 'paused';
    } else if (!document.hidden && running === 'paused') {
      start().catch(() => {});
    }
  });
}

export function setShowDot(on) {
  showDot = on;
  if (!on && dot) dot.hidden = true;
}

export function setCalibration(cal) {
  calibration = cal || null;
  smoothed = null;
}

// True if there is a calibration that fits how the iPad is held right now.
export function hasCalibration() {
  return !!calibration && (calibration.wide === undefined || calibration.wide === isWide());
}

export function isRunning() {
  return running === true;
}

// Load MediaPipe (only the first time) and start the camera.
// Throws an Error with .code = 'blocked' | 'nocamera' | 'unsupported' | 'load'.
export async function start() {
  if (running === true) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw codedError('unsupported', 'This browser cannot use the camera. Camera access needs HTTPS (see README).');
  }
  onStatus('loading', 'Starting camera…');

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
  } catch (err) {
    running = false;
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      throw codedError('blocked', 'Camera is blocked.');
    }
    throw codedError('nocamera', 'No camera could be started.');
  }

  video.srcObject = stream;
  await video.play().catch(() => {});

  if (!landmarker) {
    onStatus('loading', 'Loading eye tracker…');
    try {
      landmarker = await createLandmarker('GPU');
    } catch (gpuErr) {
      console.warn('GPU mode failed, trying CPU', gpuErr);
      try {
        landmarker = await createLandmarker('CPU');
      } catch (err) {
        console.error('Eye tracker failed to load', err);
        stopCamera();
        throw codedError('load', 'The eye tracker could not load.');
      }
    }
  }

  running = true;
  lastFaceTime = performance.now();
  onStatus('loading', 'Starting camera…');
  loop();
}

export function stop() {
  running = false;
  stopCamera();
  onStatus('off', 'Camera off');
}

function stopCamera() {
  cancelAnimationFrame(rafId);
  rafId = 0;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  if (video) video.srcObject = null;
  Dwell.setHover('gaze', null);
  if (dot) dot.hidden = true;
}

export function getStream() {
  return stream;
}

async function createLandmarker(delegate) {
  const { FaceLandmarker, FilesetResolver } = await import(`${VENDOR}vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${VENDOR}wasm`);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${VENDOR}face_landmarker.task`, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
}

function codedError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// ---------- Per-frame processing ----------

function loop() {
  if (running !== true) return;
  rafId = requestAnimationFrame(loop);
  if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  let result;
  try {
    result = landmarker.detectForVideo(video, performance.now());
  } catch (err) {
    console.error(err);
    return;
  }
  const now = performance.now();
  const face = result && result.faceLandmarks && result.faceLandmarks[0];
  const features = face ? eyeFeatures(face) : null;

  if (!features) {
    if (now - lastFaceTime > NO_FACE_MS) {
      Dwell.setHover('gaze', null);
      gazeEl = null;
      if (dot) dot.hidden = true;
      onStatus('no-face', "Can't see face");
    }
    return;
  }
  if (features.blink) return; // ignore blinks, keep last position
  lastFaceTime = now;

  if (sampleListener) {
    sampleListener(features);
    return; // don't move the dwell while calibrating
  }
  // Calibration only fits the way the iPad was held when it was made.
  if (!calibration || (calibration.wide !== undefined && calibration.wide !== isWide())) {
    Dwell.setHover('gaze', null);
    if (dot) dot.hidden = true;
    onStatus('uncalibrated', 'Needs calibration');
    return;
  }
  onStatus('tracking', 'Eye tracking on');

  const raw = predict(features);
  if (!smoothed) smoothed = raw;
  smoothed = {
    x: smoothed.x + SMOOTHING * (raw.x - smoothed.x),
    y: smoothed.y + SMOOTHING * (raw.y - smoothed.y),
  };
  // Keep the point on screen.
  const x = Math.min(window.innerWidth - 2, Math.max(1, smoothed.x));
  const y = Math.min(window.innerHeight - 2, Math.max(1, smoothed.y));

  if (dot && showDot) {
    dot.hidden = false;
    dot.style.transform = `translate(${x}px, ${y}px)`;
  }
  updateGazeTarget(x, y, now);
}

// Decide which tile the gaze is on. Includes a little "stickiness" so a
// slightly wobbly gaze doesn't keep restarting the fill ring.
function updateGazeTarget(x, y, now) {
  if (gazeEl && gazeEl.isConnected) {
    const r = gazeEl.getBoundingClientRect();
    const mx = r.width * STICKY_MARGIN;
    const my = r.height * STICKY_MARGIN;
    if (x >= r.left - mx && x <= r.right + mx && y >= r.top - my && y <= r.bottom + my) {
      leftElAt = 0;
      Dwell.setHover('gaze', gazeEl);
      return;
    }
  }
  const el = Dwell.findDwellable(document.elementFromPoint(x, y));
  if (el) {
    gazeEl = el;
    leftElAt = 0;
    Dwell.setHover('gaze', el);
    return;
  }
  // Gaze is in a gap between tiles. Wait a moment before letting go.
  if (gazeEl) {
    if (!leftElAt) leftElAt = now;
    if (now - leftElAt < GRACE_MS) return;
  }
  gazeEl = null;
  Dwell.setHover('gaze', null);
}

// Turn face landmarks into two numbers: horizontal (fx) and vertical (fy)
// position of the irises inside the eyes, averaged over both eyes.
function eyeFeatures(lm) {
  if (lm.length < 478) return null; // iris points missing
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h }); // to pixels so x and y use the same scale

  let fx = 0, fy = 0, open = 0;
  for (const eye of EYES) {
    const a = P(eye.cornerA), b = P(eye.cornerB), iris = P(eye.iris);
    const width = Math.hypot(b.x - a.x, b.y - a.y);
    if (width < 1) return null;
    // Unit vector along the eye (handles a tilted head) and one at right angles to it.
    const ux = (b.x - a.x) / width, uy = (b.y - a.y) / width;
    const vx = -uy, vy = ux;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = iris.x - mx, dy = iris.y - my;
    fx += (dx * ux + dy * uy) / width;
    fy += (dx * vx + dy * vy) / width;
    const t = P(eye.top), btm = P(eye.bottom);
    open += Math.hypot(t.x - btm.x, t.y - btm.y) / width;
  }
  return { fx: fx / 2, fy: fy / 2, blink: open / 2 < BLINK_RATIO };
}

// Map eye features to a screen point using the calibration.
function predict(f, cal = calibration) {
  const n = cal.norm;
  const a = (f.fx - n.mx) / n.sx;
  const b = (f.fy - n.my) / n.sy;
  const cx = cal.cx, cy = cal.cy;
  return {
    x: (cx[0] + cx[1] * a + cx[2] * b) * window.innerWidth,
    y: (cy[0] + cy[1] * a + cy[2] * b) * window.innerHeight,
  };
}

// ---------- Calibration ----------

// Shows 5 dots one at a time and records where the eyes are for each.
// Returns { ok, message }.
export async function calibrate(overlay) {
  const dotEl = overlay.querySelector('.calib-dot');
  const msg = overlay.querySelector('.calib-msg');
  const points = [];
  let cancelled = false;
  overlay.cancel = () => { cancelled = true; };

  for (const [px, py] of CALIBRATION_POINTS) {
    if (cancelled) break;
    dotEl.style.left = `${px * 100}%`;
    dotEl.style.top = `${py * 100}%`;
    dotEl.hidden = false;
    dotEl.classList.remove('collecting');
    msg.textContent = 'Look at the dot';

    await wait(900); // give the eyes time to move to the dot
    dotEl.classList.add('collecting');

    const samples = await collectSamples(1200, 5000, () => {
      msg.textContent = "Can't see your face. Look at the iPad.";
    });
    if (samples.length < 5) {
      dotEl.hidden = true;
      sampleListener = null;
      return { ok: false, message: "Couldn't see the eyes clearly. Check the light and try again." };
    }
    msg.textContent = 'Look at the dot';
    points.push({ tx: px, ty: py, fx: median(samples.map((s) => s.fx)), fy: median(samples.map((s) => s.fy)) });
  }
  dotEl.hidden = true;
  if (cancelled) return { ok: false, message: 'Calibration cancelled.' };

  const fit = fitCalibration(points);
  if (!fit) return { ok: false, message: 'Eye movement was too small to measure. Try again a little closer to the iPad.' };

  calibration = fit;
  smoothed = null;
  onCalibrationSaved(calibration);
  const errPct = Math.round(fit.error * 100);
  return {
    ok: true,
    message: errPct > 12
      ? 'Done, but it may not be very accurate. Try again if tiles are hard to pick.'
      : 'Calibration done.',
  };
}

// Collect feature samples for `durationMs` once a face is visible.
function collectSamples(durationMs, timeoutMs, onNoFace) {
  return new Promise((resolve) => {
    const samples = [];
    const startedAt = performance.now();
    let firstSampleAt = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      if (!samples.length && now - startedAt > 1500) onNoFace();
      if ((firstSampleAt && now - firstSampleAt >= durationMs) || now - startedAt > timeoutMs) {
        clearInterval(timer);
        sampleListener = null;
        resolve(samples);
      }
    }, 50);
    sampleListener = (f) => {
      if (!firstSampleAt) firstSampleAt = performance.now();
      samples.push(f);
    };
  });
}

// Least-squares fit of  screen = c0 + c1*fx + c2*fy  for x and y separately.
// Features are normalised first; a tiny "ridge" term keeps it stable.
export function fitCalibration(points) { // exported so it can be tested
  const fxs = points.map((p) => p.fx), fys = points.map((p) => p.fy);
  const norm = { mx: mean(fxs), my: mean(fys), sx: std(fxs), sy: std(fys) };
  if (norm.sx < 1e-4 || norm.sy < 1e-4) return null;

  const rows = points.map((p) => [1, (p.fx - norm.mx) / norm.sx, (p.fy - norm.my) / norm.sy]);
  const cx = ridgeSolve(rows, points.map((p) => p.tx), 0.01);
  const cy = ridgeSolve(rows, points.map((p) => p.ty), 0.01);
  if (!cx || !cy) return null;

  // Average distance between the dots and where we'd now predict them (as a fraction of the screen).
  const error = mean(points.map((p, i) => {
    const r = rows[i];
    const x = cx[0] + cx[1] * r[1] + cx[2] * r[2];
    const y = cy[0] + cy[1] * r[1] + cy[2] * r[2];
    return Math.hypot(x - p.tx, y - p.ty);
  }));
  return { cx, cy, norm, error, wide: isWide(), savedAt: Date.now() };
}

// Solve (XᵀX + λI) w = Xᵀy for a 3-column X (no penalty on the constant term).
function ridgeSolve(X, y, lambda) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const b = [0, 0, 0];
  X.forEach((row, n) => {
    for (let i = 0; i < 3; i++) {
      b[i] += row[i] * y[n];
      for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j];
    }
  });
  A[1][1] += lambda;
  A[2][2] += lambda;
  return solve3(A, b);
}

// Gaussian elimination for a 3x3 system.
function solve3(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let pivot = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-12) return null;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

const isWide = () => typeof window !== 'undefined' && window.innerWidth >= window.innerHeight;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const median = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
