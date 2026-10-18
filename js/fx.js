/* Effects: comic POW! starbursts for spikes, flying stars, sand puffs, glowing rings for saves and sets, floating
   words, and the confetti for the winner. Textures are painted once on canvases. Kit candidate: the starburst. */
(function () {
  'use strict';
  const T = THREE;
  const G = window.Kit.gfx;
  let scene;
  const live = [];
  const burstCache = {};

  // Burst colours per word: [outer, inner, text]
  const STYLE = {
    'POW!': ['#ffd400', '#ff8a1f', '#e8203a'],
    'WHAM!': ['#ff8a1f', '#ffd400', '#7a1fd1'],
    'KAPOW!': ['#ff3d3d', '#ffd400', '#ffffff'],
    'SMASH!': ['#18d4ff', '#ffffff', '#ff3d7f'],
    'BOOM!': ['#ff5aa0', '#ffd400', '#ffffff'],
    'SAVED!': ['#7dff5a', '#ffffff', '#1f6fe0'],
    'SET!': ['#ffe14d', '#ffffff', '#1f6fe0'],
    'DIG!': ['#ffe14d', '#ffffff', '#c2410c'],
    'POINT!': ['#ffffff', '#fff2a8', '#ff3d7f'],
  };

  function burstTexture(word) {
    if (burstCache[word]) return burstCache[word];
    const [c, g] = G.makeCanvas(256, 256);
    const [outer, inner, text] = STYLE[word] || STYLE['POW!'];
    const star = (r1, r2, n, fill) => {
      g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? r2 * (0.85 + ((i * 37) % 7) / 30) : r1 * (0.88 + ((i * 53) % 5) / 25);
        g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    g.lineJoin = 'round';
    star(124, 70, 12, '#14121f');
    star(114, 62, 12, outer);
    star(84, 52, 10, inner);
    g.translate(128, 132);
    g.rotate(-0.12);
    const size = word.length > 5 ? 46 : 58;
    g.font = `${size}px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#14121f';
    g.strokeText(word, 0, 0);
    g.fillStyle = text;
    g.fillText(word, 0, 0);
    return (burstCache[word] = G.toTexture(c));
  }

  const wordCache = {};
  function wordTexture(text, color) {
    const key = text + color;
    if (wordCache[key]) return wordCache[key];
    const [c, g] = G.makeCanvas(512, 128);
    g.font = `64px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 14;
    g.strokeStyle = '#14121f';
    g.strokeText(text, 256, 68);
    g.fillStyle = color;
    g.fillText(text, 256, 68);
    return (wordCache[key] = G.toTexture(c));
  }

  function sprite(tex, size, x, y, z, o = {}) {
    const m = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !o.onTop, color: o.color || '#ffffff' });
    if (o.add) m.blending = T.AdditiveBlending;
    const s = new T.Sprite(m);
    s.scale.set(size, size * (o.aspect || 1), 1);
    s.position.set(x, y, z);
    s.renderOrder = o.onTop ? 20 : 5;
    scene.add(s);
    return s;
  }

  function add(s, fx) {
    live.push(Object.assign({ s, t: 0, life: 0.6, vx: 0, vy: 0, vz: 0, g: 0, spin: 0, size: s.scale.x, aspect: s.scale.y / s.scale.x }, fx));
  }

  function pow(x, y, word, big) {
    const s = sprite(burstTexture(word), 0.1, x, y, 1.2, { onTop: true });
    s.material.rotation = (Math.random() - 0.5) * 0.5;
    add(s, { kind: 'burst', life: big ? 0.8 : 0.55, size: big ? 2.3 : 1.5 });
    stars(x, y, big ? 9 : 5);
  }

  function stars(x, y, n) {
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 4;
      const s = sprite(tex, 0.45 + Math.random() * 0.3, x, y, 1, { onTop: true });
      add(s, { kind: 'star', life: 0.7 + Math.random() * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 2, g: 9, spin: (Math.random() - 0.5) * 10 });
    }
  }

  function dust(x, n = 8, y = 0.15, color = '#f6e2b6') {
    const tex = G.dotTexture();
    for (let i = 0; i < n; i++) {
      const s = sprite(tex, 0.4 + Math.random() * 0.4, x + (Math.random() - 0.5) * 0.6, y, (Math.random() - 0.5) * 0.8, { color });
      add(s, { kind: 'dust', life: 0.5 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 5, vy: 1.5 + Math.random() * 3, g: 7, grow: 1.6 });
    }
  }

  function ring(x, y, color = '#ffffff', size = 2.4) {
    const s = sprite(G.glowTexture(), 0.2, x, y, 0.8, { color, add: true });
    add(s, { kind: 'ring', life: 0.45, size });
  }

  function word(x, y, text, color = '#ffd400', size = 2.2) {
    const s = sprite(wordTexture(text, color), size, x, y, 1.3, { onTop: true, aspect: 0.25 });
    add(s, { kind: 'word', life: 1.1, vy: 1.2, size });
  }

  function sparkle(x, y, n = 10, emoji = '✨') {
    const tex = G.emojiTexture(emoji);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = sprite(tex, 0.5, x, y, 1, { onTop: true });
      add(s, { kind: 'star', life: 0.6, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, g: 0, spin: 4 });
    }
  }

  function confetti(x0, x1, n = 60) {
    const colors = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ffffff', '#ff8a1f'];
    const tex = G.dotTexture();
    for (let i = 0; i < n; i++) {
      const s = sprite(tex, 0.25, x0 + Math.random() * (x1 - x0), 9 + Math.random() * 3, (Math.random() - 0.5) * 2, { color: colors[i % colors.length] });
      add(s, { kind: 'confetti', life: 3 + Math.random() * 1.5, vx: (Math.random() - 0.5) * 1.5, vy: -2 - Math.random() * 2, g: 0, wob: Math.random() * 6 });
    }
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      f.t += dt;
      const u = f.t / f.life;
      if (u >= 1) {
        scene.remove(f.s);
        f.s.material.dispose();
        live.splice(i, 1);
        continue;
      }
      f.vy -= f.g * dt;
      f.s.position.x += f.vx * dt;
      f.s.position.y += f.vy * dt;
      f.s.material.rotation += f.spin * dt;
      if (f.kind === 'burst') {
        const k = u < 0.2 ? f.size * (u / 0.2) * 1.15 : f.size * (1.15 - 0.15 * Math.min(1, (u - 0.2) / 0.2));
        f.s.scale.set(k, k, 1);
        f.s.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      } else if (f.kind === 'ring') {
        const k = f.size * (0.2 + u);
        f.s.scale.set(k, k, 1);
        f.s.material.opacity = 1 - u;
      } else if (f.kind === 'word') {
        const k = f.size * (u < 0.15 ? 0.6 + (u / 0.15) * 0.5 : 1.1 - Math.min(0.1, u - 0.15));
        f.s.scale.set(k, k * f.aspect, 1);
        f.s.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      } else if (f.kind === 'dust') {
        const k = f.size * (1 + u * (f.grow - 1));
        f.s.scale.set(k, k, 1);
        f.s.material.opacity = 0.8 * (1 - u);
      } else if (f.kind === 'confetti') {
        f.s.position.x += Math.sin(f.t * 4 + f.wob) * dt * 1.5;
        f.s.material.opacity = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
      } else {
        f.s.material.opacity = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      }
    }
  }

  function clear() {
    for (const f of live) {
      scene.remove(f.s);
      f.s.material.dispose();
    }
    live.length = 0;
  }

  window.VBFx = {
    init(s) { scene = s; },
    pow, stars, dust, ring, word, sparkle, confetti, update, clear,
    count: () => live.length,
  };
})();
