// dwell.js
// ---------------------------------------------------------------------------
// "Dwell" = keep looking (or hovering) at something until it is picked.
//
// Any element with the attribute  data-dwell  can be picked this way.
// When the fill ring completes, we simply call element.click(), so a dwell
// pick and a finger tap run exactly the same code.
//
// Two sources feed hover information in here:
//   'pointer' - mouse / trackpad / iPadOS built-in Eye Tracking pointer
//   'gaze'    - our own camera tracker (gaze.js)
// ---------------------------------------------------------------------------

let dwellMs = 1500;
let pointerDwellEnabled = true;

const hoverBySource = { pointer: null, gaze: null };
let target = null;        // element currently being dwelled on
let startTime = 0;        // when dwelling on target started
let locked = null;        // element just picked; must look away before it can be picked again
let rafId = 0;

// Ignore a second click on the same element within this many ms.
// This stops double picks when both our dwell AND iPad's own Dwell Control tap.
const REPEAT_GUARD_MS = 900;
let lastClick = { el: null, t: 0 };

let ring, ringCircle, CIRC;

export function setDwellTime(ms) {
  dwellMs = Math.min(4000, Math.max(500, ms));
}

export function setPointerDwell(on) {
  pointerDwellEnabled = on;
  if (!on) setHover('pointer', null);
}

export function init() {
  // One shared fill ring, moved over whatever is being looked at.
  ring = document.getElementById('dwell-ring');
  ringCircle = ring.querySelector('.ring-fill');
  CIRC = 2 * Math.PI * Number(ringCircle.getAttribute('r'));
  ringCircle.style.strokeDasharray = String(CIRC);

  // Pointer hover (mouse, trackpad, iPadOS Eye Tracking). Touch is ignored
  // here because a finger tap is handled as a normal click.
  const onPointer = (e) => {
    if (e.pointerType === 'touch' || !pointerDwellEnabled) return;
    setHover('pointer', findDwellable(e.target));
  };
  document.addEventListener('pointerover', onPointer);
  document.addEventListener('pointermove', onPointer);
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    if (!e.relatedTarget) setHover('pointer', null); // pointer left the window
  });

  // Guard against double picks (see REPEAT_GUARD_MS). Runs before any other click handler.
  document.addEventListener('click', (e) => {
    const el = findDwellable(e.target);
    if (!el) return;
    const now = performance.now();
    const guard = Number(el.dataset.repeatGuard || REPEAT_GUARD_MS);
    if (lastClick.el === el && now - lastClick.t < guard) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    lastClick = { el, t: now };
    // A tap also counts as a pick, so the dwell ring won't fire again on top of it.
    locked = el;
    if (target === el) hideRing();
    flash(el);
  }, true);
}

export function findDwellable(node) {
  if (!node || !node.closest) return null;
  const el = node.closest('[data-dwell]');
  if (!el || el.getAttribute('aria-disabled') === 'true' || el.disabled) return null;
  return el;
}

// Called by the pointer listeners above and by gaze.js.
export function setHover(source, el) {
  if (hoverBySource[source] === el) return;
  hoverBySource[source] = el;
  // If this source stopped pointing at anything, fall back to the other source.
  const other = source === 'pointer' ? hoverBySource.gaze : hoverBySource.pointer;
  setTarget(el || other);
}

function setTarget(el) {
  if (el === target) return;
  if (target) target.classList.remove('dwell-hover');
  target = el;
  if (locked && locked !== el) locked = null; // looked away, so the last pick can be picked again
  if (!el) {
    hideRing();
    return;
  }
  el.classList.add('dwell-hover');
  startTime = performance.now();
  if (!rafId) rafId = requestAnimationFrame(tick);
}

function tick(now) {
  rafId = 0;
  // Target removed from the page (e.g. the page of tiles changed).
  if (target && !target.isConnected) {
    target = null;
    hideRing();
    return;
  }
  if (!target) return hideRing();
  if (target === locked) {
    hideRing();
    rafId = requestAnimationFrame(tick);
    return;
  }

  const progress = Math.min(1, (now - startTime) / dwellMs);
  drawRing(target, progress);

  if (progress >= 1) {
    const el = target;
    hideRing();
    el.click(); // the click guard above locks it until the eyes move away
    locked = el;
  }
  rafId = requestAnimationFrame(tick);
}

function drawRing(el, progress) {
  const r = el.getBoundingClientRect();
  // Ring size: big on tiles, smaller on keys/buttons.
  const size = Math.max(56, Math.min(240, Math.min(r.width, r.height) * 0.8));
  ring.style.width = ring.style.height = `${size}px`;
  ring.style.left = `${r.left + r.width / 2 - size / 2}px`;
  ring.style.top = `${r.top + r.height / 2 - size / 2}px`;
  ringCircle.style.strokeDashoffset = String(CIRC * (1 - progress));
  ring.hidden = false;
}

function hideRing() {
  if (ring) ring.hidden = true;
}

function flash(el) {
  el.classList.remove('picked');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('picked');
  setTimeout(() => el.classList.remove('picked'), 450);
}
