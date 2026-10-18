/* The computer players, the test bots and the headless match runner. Pure JavaScript like the engine, so it runs
   in the browser (window.game.soak) and in node (tools/soak.js).

   The CPU thinks every `react` seconds: it predicts the ball's flight with VB.predict, then either lines up a spike
   (jump timed so the ball meets it at the top), stands just behind where the ball will come down so the bounce sends
   it over the net, or dives for a ball it can't reach in time. Its mistakes come from aiming a little off (`err`),
   reacting late, and getting sloppier in very long rallies, so every rally ends. */
(function (root) {
  'use strict';
  const VB = root.VB;
  const C = VB.C;

  const LEVELS = {
    // for little players like Tommy (5): slow to react, often a step off, rarely spikes, slower legs
    easy: { react: 0.4, err: 1.3, spike: 0.08, dive: 0.25, speed: 0.75, standOff: 0.75, surprise: 0.25, buddy: false },
    // for big kids like Teddy (8): reads the ball well, spikes most chances, dives for far balls
    normal: { react: 0.19, err: 0.6, spike: 0.55, dive: 0.75, speed: 1, standOff: 0.6, surprise: 0.14, buddy: true },
    // test bots that play like kids (full-speed legs, slow and sloppy reading of the ball), for tuning the levels
    kid: { react: 0.45, err: 1.1, spike: 0.25, dive: 0.2, speed: 1, standOff: 0.6, surprise: 0.2, buddy: false, test: true },
    bigkid: { react: 0.25, err: 0.6, spike: 0.5, dive: 0.5, speed: 1, standOff: 0.6, surprise: 0.15, buddy: false, test: true },
  };

  function create(level = 'normal', seed) {
    const L = LEVELS[level] || LEVELS.normal;
    return {
      level, L, since: 1, plan: null, key: '', rng: VB.rngFrom(seed != null ? seed : Math.floor(Math.random() * 1e9)),
      callT: 0,
    };
  }

  // Feet height h after leaving the sand: how long the climb takes.
  function riseTime(hf) {
    const d = C.JUMP * C.JUMP - 2 * C.G * hf;
    return d < 0 ? null : (C.JUMP - Math.sqrt(d)) / C.G;
  }

  function plan(br, m, i) {
    const p = m.players[i], b = m.ball, side = p.side, toNet = -side, L = br.L;
    const home = { x: side * 3.4, jumpAt: null, hitAt: null, diveDir: 0, diveBy: null, aim: 0 };
    if (m.phase === 'point' || m.phase === 'over' || b.dead) return (br.plan = home);
    // a new "possession" each time someone touches the ball: decide once whether to try a spike, and how far off
    // to be, so the plan doesn't flicker between thinks
    const key = m.rallyHits + ':' + b.last + ':' + m.score.join('-');
    if (key !== br.key) {
      br.key = key;
      const tired = 1 + Math.max(0, m.rallyHits - 10) * 0.15 + Math.max(0, m.rallyT - 25) * 0.05;
      br.err = (br.rng() * 2 - 1) * L.err * tired * (1 + Math.abs(b.vx) / 12);
      br.trySpike = br.rng() < L.spike;
      br.aimRoll = br.rng();
    }
    const delay = m.phase === 'serve' ? Math.max(0, C.SERVE_WAIT - m.phaseT) : 0;
    let spike = null, land = null;
    VB.predict(b, 3.2, (x, y, vx, vy, t) => {
      if (x * side <= 0) return false;
      if (!spike && br.trySpike && Math.abs(x) < 3.8 && y > 4.4 && y < 6.1 && vy < 3) {
        const hf = y - 1.85, tr = riseTime(hf);
        if (hf > 0.6 && tr != null) {
          const sx = x - toNet * 0.3;
          const run = Math.abs(sx - p.x) / (C.RUN * p.speedMul);
          if (run + br.L.react * 0.5 < t - tr && t - tr > 0.02) spike = { x: sx, t, tr, y };
        }
      }
      if (vy < 0 && y < 2.1) {
        land = { x, t };
        return true;
      }
      return false;
    }, delay);
    if (spike && p.state === 'ground') {
      const aim = Math.abs(spike.x) < 2.6 ? (br.aimRoll < 0.7 ? -1 : 0) : br.aimRoll < 0.25 ? 1 : 0;
      return (br.plan = { x: spike.x + br.err * 0.4, jumpAt: m.time + spike.t - spike.tr, hitAt: m.time + spike.t - 0.1, aim, fast: br.aimRoll > 0.3, diveDir: 0 });
    }
    if (br.plan && br.plan.hitAt && (p.state === 'air' || p.state === 'spike')) return br.plan; // mid-spike: carry on
    if (land) {
      const ownServe = m.server === i && m.rallyHits === 0; // nobody wants to miss their own serve
      const x = land.x - toNet * (ownServe ? 0.45 : L.standOff) + br.err * (ownServe ? 0.25 : 1);
      const need = Math.abs(x - p.x) / (C.RUN * p.speedMul);
      let diveDir = 0, diveBy = null;
      if (need > land.t + 0.05 && br.rng() < L.dive) {
        diveDir = Math.sign(land.x - p.x);
        diveBy = m.time + Math.max(0, land.t - 0.42);
      }
      return (br.plan = { x, jumpAt: null, hitAt: null, diveDir, diveBy, landT: m.time + land.t, landX: land.x });
    }
    return (br.plan = home);
  }

  // One tick of input for player i.
  function think(br, m, i, dt = 1 / 60) {
    const p = m.players[i], b = m.ball, out = { left: false, right: false, up: false, down: false, hit: false, call: false };
    if (m.phase === 'over') return out;
    p.speedMul = br.L.speed;
    br.since += dt * m.speed;
    br.callT += dt * m.speed;
    // a spike from the other side takes a moment to read
    if (b.spiker === 1 - i && b.power > 1.1 && br.seenSpike !== m.rallyHits) {
      br.seenSpike = m.rallyHits;
      br.since = -br.L.surprise;
    }
    if (br.since >= br.L.react) {
      br.since = 0;
      plan(br, m, i);
    }
    const pl = br.plan;
    if (!pl) return out;
    const dx = pl.x - p.x;
    if (Math.abs(dx) > 0.12) {
      out.left = dx < 0;
      out.right = dx > 0;
    }
    if (pl.jumpAt != null && p.state === 'ground' && m.time >= pl.jumpAt - 0.01 && m.time < pl.jumpAt + 0.25) out.up = true;
    if (pl.hitAt != null && p.state === 'air' && !p.spikeUsed && m.time >= pl.hitAt) {
      out.hit = true;
      out.down = pl.aim < 0;
      out.up = pl.aim > 0;
      if (pl.fast) {
        out.left = p.side > 0;
        out.right = p.side < 0;
      }
    }
    if (pl.diveBy != null && p.state === 'ground' && m.time >= pl.diveBy && b.x * p.side > 0) {
      const gap = Math.abs(pl.landX - p.x);
      if (gap > 0.8 && gap < 3.6) {
        out.hit = true;
        out.left = pl.diveDir < 0;
        out.right = pl.diveDir > 0;
      }
      pl.diveBy = null;
    }
    // Normal calls its companion now and then when it's behind
    if (br.L.buddy && br.callT > 30 && m.phase === 'play' && m.score[i] + 3 <= m.score[1 - i] && !m.buddies[i].on && !m.buddies[i].cool) {
      out.call = true;
      br.callT = 0;
    }
    return out;
  }

  // ---------------------------------------------------------------- test bots

  // A button masher: random direction, jumps and hits every 0.1-0.4 s, calls its companion now and then.
  function masher(seed) {
    const rng = VB.rngFrom(seed);
    let hold = { left: false, right: false, up: false, down: false }, t = 0;
    return (m, i, dt = 1 / 60) => {
      t -= dt;
      const out = Object.assign({ hit: false, call: false }, hold);
      if (t <= 0) {
        t = 0.1 + rng() * 0.3;
        const r = rng();
        hold = { left: r < 0.35, right: r > 0.65, up: rng() < 0.4, down: rng() < 0.2 };
        out.hit = rng() < 0.5;
        out.call = rng() < 0.03;
      }
      return out;
    };
  }

  // ---------------------------------------------------------------- headless matches

  // Plays one match with no rendering. a/b: 'easy' | 'normal' | 'masher'. Returns the result plus any problems.
  function sim(o = {}) {
    const seed = o.seed != null ? o.seed : Math.floor(Math.random() * 1e9);
    const m = VB.create({ target: o.target || 15, seed, speed: o.speed || 1, buddyCool: o.buddyCool || [5, 5] });
    const brain = (kind, k) => (kind === 'masher' ? masher(seed + k) : ((br) => (mm, i, dt) => think(br, mm, i, dt))(create(kind, seed + k)));
    const bots = [brain(o.a || 'normal', 1), brain(o.b || 'normal', 2)];
    const maxTime = o.maxTime || 60 * 40; // simulated seconds
    const maxRally = o.maxRally || 90;
    const problems = [];
    const dt = 1 / 60;
    const half = C.W / 2;
    let win = { t: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    let ticks = 0, rallies = 0, maxRallySeen = 0, spikes = 0, saves = 0, sets = 0;
    while (m.phase !== 'over' && m.time < maxTime) {
      if (o.calls && ticks % 600 === 0) VB.callBuddy(m, (ticks / 600) % 2);
      const evs = VB.tick(m, [bots[0](m, 0, dt), bots[1](m, 1, dt)], dt);
      ticks++;
      for (const e of evs) {
        if (e.type === 'point') rallies++;
        else if (e.type === 'spike') spikes++;
        else if (e.type === 'save') saves++;
        else if (e.type === 'set') sets++;
      }
      const b = m.ball;
      // sanity: finite, inside the court, players on their own side
      if (!(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy))) problems.push(`t=${m.time.toFixed(1)} ball not finite`);
      if (Math.abs(b.x) > half || b.y < -0.05 || b.y > C.CEIL + 0.01) problems.push(`t=${m.time.toFixed(1)} ball out of the court (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`);
      for (const p of m.players) {
        if (!Number.isFinite(p.x) || p.x * p.side < 0 || Math.abs(p.x) > half || p.y < -0.01) problems.push(`t=${m.time.toFixed(1)} player ${p.i} out of bounds (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
      }
      if (m.phase === 'play') {
        maxRallySeen = Math.max(maxRallySeen, m.rallyT);
        if (m.rallyT > maxRally) {
          problems.push(`rally longer than ${maxRally} s at ${m.score.join('-')}`);
          break;
        }
        // stuck: the ball barely moves for 4 s
        win.x0 = Math.min(win.x0, b.x); win.x1 = Math.max(win.x1, b.x);
        win.y0 = Math.min(win.y0, b.y); win.y1 = Math.max(win.y1, b.y);
        win.t += dt * m.speed;
        if (win.t >= 4) {
          if (win.x1 - win.x0 < 0.3 && win.y1 - win.y0 < 0.3) problems.push(`ball stuck near (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`);
          win = { t: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
        }
      }
      if (problems.length > 5) break;
    }
    if (m.phase !== 'over') problems.push(`match didn't finish in ${maxTime} s (score ${m.score.join('-')})`);
    return {
      seed, a: o.a || 'normal', b: o.b || 'normal', finished: m.phase === 'over', winner: m.winner, score: m.score.slice(),
      time: m.time, rallies, longestRally: Math.max(m.longestRally, maxRallySeen), spikes, saves, sets, problems,
    };
  }

  // Many matches. Every one must finish, with no stuck ball and nothing out of bounds.
  function soak(n = 50, o = {}) {
    const kinds = ['easy', 'normal'];
    const rows = [];
    for (let k = 0; k < n; k++) {
      const a = o.a || kinds[k % 2], b = o.b || kinds[(k >> 1) % 2];
      rows.push(sim(Object.assign({}, o, { a, b, seed: (o.seed || 1000) + k, target: o.target || (k % 3 === 0 ? 7 : 15), calls: o.calls != null ? o.calls : k % 4 === 0 })));
    }
    const bad = rows.filter((r) => !r.finished || r.problems.length);
    const avg = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
    return {
      matches: n,
      finished: rows.filter((r) => r.finished).length,
      withProblems: bad.length,
      problems: bad.slice(0, 5).map((r) => ({ seed: r.seed, a: r.a, b: r.b, score: r.score, problems: r.problems.slice(0, 3) })),
      avgMatchSeconds: +avg((r) => r.time).toFixed(1),
      avgRallySeconds: +avg((r) => r.time / Math.max(1, r.rallies)).toFixed(2),
      longestRally: +Math.max(...rows.map((r) => r.longestRally)).toFixed(1),
      spikesPerMatch: +avg((r) => r.spikes).toFixed(1),
      setsPerMatch: +avg((r) => r.sets).toFixed(1),
      savesPerMatch: +avg((r) => r.saves).toFixed(2),
    };
  }

  // Win counts for one kind against another.
  function versus(a, b, n = 50, o = {}) {
    let wa = 0, wb = 0, unfinished = 0;
    for (let k = 0; k < n; k++) {
      const r = sim(Object.assign({}, o, { a, b, seed: (o.seed || 5000) + k }));
      if (!r.finished) unfinished++;
      else if (r.winner === 0) wa++;
      else wb++;
    }
    return { [a + ' (left)']: wa, [b + ' (right)']: wb, unfinished };
  }

  VB.cpu = { LEVELS, create, think, masher, sim, soak, versus };
})(typeof window !== 'undefined' ? window : globalThis);
