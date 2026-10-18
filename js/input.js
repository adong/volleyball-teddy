/* Controls: the keyboard for one or two players, and big on-screen buttons for touch (1 player).
   Presses (spike/dive, companion) are latched until the engine's next tick reads them, so a quick tap still counts.
   P1: A D move, W jump, S aim down, F spike / dive, T companion.
   P2: arrows move, up jumps, down aims down, L spike / dive, Enter companion.
   In 1-player mode both sets drive player 1. */
(function () {
  'use strict';

  const KEYS = {
    KeyA: [0, 'left'], KeyD: [0, 'right'], KeyW: [0, 'up'], KeyS: [0, 'down'], KeyF: [0, 'hit'], KeyT: [0, 'call'],
    ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], ArrowUp: [1, 'up'], ArrowDown: [1, 'down'],
    KeyL: [1, 'hit'], Enter: [1, 'call'], NumpadEnter: [1, 'call'], Numpad0: [1, 'hit'],
  };
  const PRESS = { hit: 1, call: 1 };
  const HOLD = ['left', 'right', 'up', 'down'];

  const held = [{}, {}]; // [player]['act:code'] so releasing one key doesn't cancel the same action held on another
  const latched = [{}, {}];
  const touch = { left: false, right: false, up: false, down: false };
  const touchLatched = {};
  let twoPlayer = false;
  let lastTouch = -1e9;

  function setKey(code, down, repeat) {
    const m = KEYS[code];
    if (!m) return false;
    const [side, act] = m;
    if (PRESS[act]) {
      if (down && !repeat) latched[side][act] = true;
    } else held[side][act + ':' + code] = down;
    return true;
  }

  function heldAct(side, act) {
    for (const k in held[side]) if (held[side][k] && k.startsWith(act + ':')) return true;
    return false;
  }

  // The input for one engine tick. Clears the presses it reports.
  function snapshot(side) {
    const srcs = side === 0 && !twoPlayer ? [0, 1] : [side];
    const out = { left: false, right: false, up: false, down: false, hit: false, call: false, touch: false };
    for (const s of srcs) {
      for (const a of HOLD) if (heldAct(s, a)) out[a] = true;
      for (const a in PRESS) {
        if (latched[s][a]) out[a] = true;
        latched[s][a] = false;
      }
    }
    if (side === 0) {
      for (const a of HOLD) if (touch[a]) out[a] = true;
      for (const a in PRESS) {
        if (touchLatched[a]) {
          out[a] = true;
          out.touch = true;
        }
        touchLatched[a] = false;
      }
    }
    return out;
  }

  function clear() {
    for (const s of [0, 1]) {
      for (const k in held[s]) held[s][k] = false;
      for (const k in latched[s]) latched[s][k] = false;
    }
    for (const k in touch) touch[k] = false;
    for (const k in touchLatched) touchLatched[k] = false;
    document.querySelectorAll('.tb.down').forEach((b) => b.classList.remove('down'));
  }

  // Touch buttons: data-act = left | right | up (jump) | hit | call. Pointer events cover mouse, pen and touch.
  function bindTouch(root, onPress) {
    root.querySelectorAll('[data-act]').forEach((btn) => {
      const act = btn.dataset.act;
      const down = (e) => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no pointer to capture */ }
        btn.classList.add('down');
        lastTouch = performance.now();
        if (PRESS[act]) touchLatched[act] = true;
        else touch[act] = true;
        if (onPress) onPress(act);
      };
      const up = (e) => {
        if (e) e.preventDefault();
        btn.classList.remove('down');
        if (!PRESS[act]) touch[act] = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', () => up());
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  window.VBInput = {
    setKey, snapshot, clear, bindTouch,
    setTwoPlayer(v) { twoPlayer = v; },
    usingTouch: () => performance.now() - lastTouch < 15000,
    press(side, act) { latched[side][act] = true; }, // for tests
  };
})();
