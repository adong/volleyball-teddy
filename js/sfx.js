/* Volleyball sounds, synthesised with the kit's Kit.sound.tone / hiss so mute and volume are shared.
   Kit.sound already has jump, land, bump, punch, swish, powerup, coin and click; the rest are here. */
(function () {
  'use strict';
  const S = () => window.Kit.sound;

  window.VBSfx = {
    // a bounce off a head or arms: a rubbery "boing" plus a soft thump
    hit(v = 1) {
      S().tone({ type: 'triangle', f: 260 + v * 40, to: 520 + v * 60, dur: 0.12, vol: 0.16 });
      S().tone({ f: 140, to: 70, dur: 0.1, vol: 0.22 });
    },
    // the spike: a smack, a whoosh and a little zing
    spike() {
      S().punch();
      S().hiss({ f: 1800, to: 500, q: 1.2, dur: 0.28, vol: 0.2 });
      S().tone({ type: 'square', f: 1400, to: 500, dur: 0.16, vol: 0.05, lp: 3000, at: 0.02 });
    },
    swing() { S().hiss({ f: 2400, to: 1200, q: 1.5, dur: 0.1, vol: 0.06 }); },
    set() {
      S().tone({ type: 'sine', f: 520, to: 880, dur: 0.1, vol: 0.12 });
      S().tone({ f: 160, to: 90, dur: 0.08, vol: 0.15 });
    },
    dig() {
      S().hiss({ filter: 'lowpass', f: 2000, to: 400, dur: 0.18, vol: 0.18 });
      this.hit(0.6);
    },
    dive() { S().hiss({ filter: 'bandpass', f: 1200, to: 500, q: 0.8, dur: 0.3, vol: 0.18 }); },
    jump() { S().jump(); },
    land() { S().tone({ f: 120, to: 60, dur: 0.07, vol: 0.12 }); },
    // the ball lands in the sand: a soft thud and a spray of sand
    floor(v = 10) {
      S().tone({ f: 110, to: 45, dur: 0.22, vol: Math.min(0.45, 0.15 + v / 50) });
      S().hiss({ filter: 'lowpass', f: 1600, to: 300, dur: 0.3, vol: 0.18 });
    },
    // the net tape twangs
    net() {
      S().tone({ type: 'sawtooth', f: 180, to: 140, dur: 0.18, vol: 0.05, lp: 900 });
      S().tone({ type: 'triangle', f: 360, to: 300, dur: 0.15, vol: 0.08 });
    },
    wall() { S().tone({ type: 'triangle', f: 200, to: 120, dur: 0.1, vol: 0.12 }); },
    // the referee's whistle before a serve
    whistle() {
      S().tone({ type: 'sine', f: 2300, dur: 0.12, vol: 0.06 });
      S().tone({ type: 'sine', f: 2500, dur: 0.18, vol: 0.06, at: 0.14 });
    },
    point(mine) {
      const notes = mine ? [523, 659, 784] : [392, 523];
      notes.forEach((f, i) => S().tone({ type: 'square', f, dur: 0.12, vol: 0.05, lp: 2400, at: i * 0.08 }));
    },
    fanfare() {
      [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.65], [1047, 0.8]].forEach(([f, at]) => {
        S().tone({ type: 'square', f, dur: 0.22, vol: 0.06, lp: 2600, at });
        S().tone({ type: 'triangle', f: f / 2, dur: 0.25, vol: 0.1, at });
      });
    },
    cheer() {
      S().hiss({ f: 1400, to: 1800, q: 0.6, dur: 1.4, vol: 0.1, attack: 0.15 });
    },
    // the companion runs in
    buddy() {
      [659, 784, 988].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.14, vol: 0.12, at: i * 0.07 }));
      S().hiss({ f: 1200, to: 3000, dur: 0.25, vol: 0.06 });
    },
    save() { S().powerup(); },
    treat() { S().coin(3); },
    nope() { S().tone({ type: 'square', f: 220, to: 180, dur: 0.12, vol: 0.05, lp: 1200 }); },
    swish() { S().swish(); },
    click() { S().click(); },
    whoosh() { S().hiss({ f: 900, to: 300, q: 1.4, dur: 0.3, vol: 0.12 }); },
  };
})();
