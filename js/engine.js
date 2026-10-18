/* The volleyball engine: court, ball physics, players, companions and scoring.
   No Three.js and no DOM, so the same code runs the browser game, the CPU's predictions and the headless match
   runner (node tools/soak.js). Units are metres and seconds. x runs left to right with the net at x = 0, y is up
   from the sand. Player 0 plays on the left (side -1), player 1 on the right (side +1).

   The rules follow the classic 1997 two-player volleyball game:
   - the ball bounces off heads, the side walls, the ceiling and the top of the net; there are no "outs"
   - whoever lets it touch the sand on their side loses the point, and the scorer serves next
   - a hit off your body sends the ball up, and sideways by how far off-centre it hit you
   - a spike (hit button in the air) fires it at the other side: hold left/right to hit it harder,
     down to smash it down, up to lob it
   - the hit button on the ground dives (a dig) to save low balls
   - first to 15 (or 7) wins */
(function (root) {
  'use strict';

  const C = {
    W: 14, // wall to wall
    NW: 0.12, // half-thickness of the net post
    NET_H: 2.6, // top of the net tape
    CEIL: 8.4, // the highest the ball's centre goes
    R: 0.62, // ball radius: a big bouncy beach ball
    G: 19.5, // gravity, for ball and players alike
    SUB: 2, // physics substeps per 1/60 s tick

    RUN: 4.8, // running speed
    JUMP: 12.5, // take-off speed: the feet rise about 4 m
    START_X: 5.6, // distance from the net where players line up
    BODY_X: 0.85, // the ball's centre counts as touching a standing player inside this half-width...
    BODY_Y0: 0.1, // ...and between these heights above the feet
    BODY_Y1: 2.45,
    DIVE_VX: 7.2, // a dive: a low flying lunge
    DIVE_VY: 4.6,
    DIVE_X: 1.15, // body stretched out, so a longer, lower hitbox
    DIVE_Y1: 1.25,
    LIE: 0.35, // time on the sand after a dive

    SPIKE_WIN: 0.3, // how long a spike swing can connect
    SPIKE_SLOW: 9.5, // spike speed with no left/right held...
    SPIKE_FAST: 15.5, // ...and with left or right held
    SPIKE_DOWN: 8, // the least downward speed of a smash
    HIT_VY: 11.7, // a normal hit sends the ball up at least this fast
    HIT_KX: 8.3, // and sideways this fast per metre off-centre
    HIT_VX_MAX: 10,

    SERVE_Y: 6.8, // the serve floats here above the server...
    SERVE_DX: 0.6, // ...just in front of him
    SERVE_WAIT: 0.9, // before it drops
    POINT_TIME: 2.0, // pause after a point

    BUDDY_TIME: 10, // a companion's visit
    BUDDY_ARRIVE: 0.7, // he's on court and helping after this
    BUDDY_IDLE: 2.3, // where he waits, from the net
    BUDDY_RUN: 10, // he's quick
    BUDDY_REACH: 0.95, // he bumps the ball when its centre passes this close...
    SET_Y: 3.2, // ...on its way down through this height
    SET_APEX: 6.1, // his set peaks here: right at the top of your jump
  };

  const NONE = { left: false, right: false, up: false, down: false, hit: false, call: false };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // A small seeded random generator (mulberry32), so a match can be replayed from its seed.
  function rngFrom(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newPlayer(i) {
    const side = i === 0 ? -1 : 1;
    return {
      i, side, x: side * C.START_X, y: 0, vx: 0, vy: 0,
      state: 'ground', // ground, air, spike, dive, lie, win, lose
      t: 0, // time in this state
      spikeUsed: false, // one swing per jump
      swingT: -1, // time since the spike swing started (for the pose), -1 when not swinging
      aim: 0, // the spike's aim: -1 down, 0 flat, 1 up
      lock: false, // touching the ball right now (one hit per touch)
      speedMul: 1,
      dir: 0, // last horizontal input, for the run pose
      stats: { hits: 0, spikes: 0, digs: 0, points: 0, saves: 0, calls: 0 },
    };
  }

  function newBuddy(i) {
    return {
      i, side: i === 0 ? -1 : 1,
      on: false, t: 0, x: 0, vx: 0,
      helping: false,
      saved: false, // he saves one ball from the sand per visit
      cool: 0, // rest time left before he can come again
      treatT: -1, // time since the last treat
      hopT: -1, hopY: 0, // a set or a save: time since, and the ball's height then (the renderer animates a leap)
      sets: 0,
    };
  }

  function create(o = {}) {
    const m = {
      cfg: C,
      target: o.target || 15,
      speed: o.speed || 1,
      seed: o.seed != null ? o.seed : Math.floor(Math.random() * 1e9),
      players: [newPlayer(0), newPlayer(1)],
      buddies: [newBuddy(0), newBuddy(1)],
      buddyCool: o.buddyCool || [0, 0], // rest after a visit, per side (2P mode uses a short one)
      ball: { x: 0, y: C.SERVE_Y, vx: 0, vy: 0, rot: 0, spin: 0, power: 0, last: -1, spiker: -1, dead: false },
      score: [0, 0],
      phase: 'serve', // serve, play, point, over
      phaseT: 0,
      server: o.server != null ? o.server : 0,
      winner: -1,
      lastPoint: null, // { to, spike, final }
      time: 0,
      rallyT: 0,
      rallyHits: 0,
      longestRally: 0,
      events: [],
    };
    m.rng = rngFrom(m.seed);
    resetRally(m);
    return m;
  }

  function ev(m, type, o) {
    m.events.push(Object.assign({ type }, o));
  }

  function resetRally(m) {
    for (const p of m.players) {
      Object.assign(p, { x: p.side * C.START_X, y: 0, vx: 0, vy: 0, state: 'ground', t: 0, spikeUsed: false, swingT: -1, lock: false });
    }
    const s = m.players[m.server];
    Object.assign(m.ball, { x: s.x - s.side * C.SERVE_DX, y: C.SERVE_Y, vx: 0, vy: 0, spin: 0, power: 0, last: -1, spiker: -1, dead: false });
    m.phase = 'serve';
    m.phaseT = 0;
    m.rallyT = 0;
    m.rallyHits = 0;
    ev(m, 'serve', { i: m.server });
  }

  // ---------------------------------------------------------------- the ball

  // Moves a ball for h seconds and bounces it off the walls, the ceiling and the net (not players or the sand).
  // `m` is null when the CPU is predicting: then there are no events and no randomness.
  function moveBall(b, h, m) {
    const half = C.W / 2 - C.R;
    b.vy -= C.G * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.x < -half || b.x > half) {
      b.x = clamp(b.x, -half, half);
      b.vx = b.x < 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
      if (m && Math.abs(b.vx) > 1.5) ev(m, 'wall', { x: b.x, y: b.y, v: Math.abs(b.vx) });
    }
    if (b.y > C.CEIL) {
      b.y = C.CEIL;
      b.vy = -Math.min(Math.abs(b.vy), 0.8); // it bumps the ceiling and drops gently, like the original
    }
    // The net: a post from the sand to NET_H. Ball against box, so the tape's corners deflect it naturally.
    const cx = clamp(b.x, -C.NW, C.NW), cy = clamp(b.y, 0, C.NET_H);
    const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
    if (d2 < C.R * C.R) {
      if (b.y > C.NET_H) {
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= 2 * vn * nx;
          b.vy -= 2 * vn * ny;
          if (m) ev(m, 'net', { x: b.x, y: b.y, top: true });
        }
        b.x = cx + nx * C.R;
        b.y = cy + ny * C.R;
        // never balance on the tape: roll off to the side the ball is on
        if (Math.abs(b.vx) < 0.8) {
          const s = b.x > 0 ? 1 : b.x < 0 ? -1 : m && m.rng() < 0.5 ? -1 : 1;
          b.vx = s * (0.8 + (m ? m.rng() * 0.8 : 0.4));
        }
      } else {
        const s = b.x > 0 ? 1 : b.x < 0 ? -1 : b.vx > 0 ? -1 : 1;
        if (m && Math.abs(b.vx) > 1) ev(m, 'net', { x: b.x, y: b.y, top: false });
        b.vx = s * Math.abs(b.vx);
        b.x = s * (C.NW + C.R);
      }
    }
    // spin: the ball rolls the way it's flying, and spins fast after a spike
    b.spin += (-b.vx / C.R - b.spin) * Math.min(1, h * 2);
    b.rot += b.spin * h;
    b.power = Math.max(0, b.power - h);
  }

  // Follows the ball's flight (walls, ceiling and net, no players) and calls fn(x, y, vx, vy, t) every 1/60 s
  // until fn returns true, the ball reaches the sand, or maxT runs out. Returns the stopping sample or null.
  function predict(ball, maxT, fn, delay = 0) {
    const b = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, spin: 0, rot: 0, power: 0 };
    const h = 1 / 120;
    for (let t = 0, n = 0; t < maxT; n++) {
      if (t >= delay) {
        moveBall(b, h, null);
      }
      t += h;
      if (n % 2 === 1) {
        if (fn && fn(b.x, b.y, b.vx, b.vy, t)) return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, t };
      }
      if (b.y - C.R <= 0) return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, t, floor: true };
    }
    return null;
  }

  // ---------------------------------------------------------------- players

  function sideBounds(side) {
    const lo = C.NW + 0.42, hi = C.W / 2 - 0.45;
    return side < 0 ? [-hi, -lo] : [lo, hi];
  }

  function startDive(m, p, dir) {
    p.state = 'dive';
    p.t = 0;
    p.vx = dir * C.DIVE_VX;
    p.vy = C.DIVE_VY;
    p.diveDir = dir;
    ev(m, 'dive', { i: p.i, dir });
  }

  function updatePlayer(m, p, inp, h, first) {
    p.t += h;
    if (p.swingT >= 0) p.swingT += h;
    const live = m.phase !== 'over';
    const dir = live ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0;
    const press = first && inp.hit && live;
    p.dir = dir;
    switch (p.state) {
      case 'ground':
        p.vx = dir * C.RUN * p.speedMul;
        if (press) {
          // a dive: the way you're holding, or toward the ball when you're not holding anything
          let d = dir;
          if (!d) {
            const dx = m.ball.x - p.x;
            d = Math.abs(dx) > 0.3 && m.ball.x * p.side > 0 ? Math.sign(dx) : -p.side;
          }
          startDive(m, p, d);
        } else if (inp.up && live) {
          p.state = 'air';
          p.t = 0;
          p.vy = C.JUMP;
          p.spikeUsed = false;
          ev(m, 'jump', { i: p.i });
        }
        break;
      case 'air':
      case 'spike':
        p.vx = dir * C.RUN * p.speedMul;
        if (press && !p.spikeUsed) {
          p.state = 'spike';
          p.t = 0;
          p.swingT = 0;
          p.spikeUsed = true;
          ev(m, 'swing', { i: p.i });
        }
        if (p.state === 'spike') {
          p.aim = inp.down ? -1 : inp.up ? 1 : 0;
          p.fast = !!(inp.left || inp.right);
          if (p.t > C.SPIKE_WIN) {
            p.state = 'air';
            p.t = 0;
          }
        }
        break;
      case 'dive':
        break; // committed: flies on
      case 'lie':
        p.vx = 0;
        if (p.t > C.LIE) {
          p.state = 'ground';
          p.t = 0;
        }
        break;
      default: // win, lose
        p.vx = 0;
    }
    const airborne = p.state === 'air' || p.state === 'spike' || p.state === 'dive' || p.y > 0;
    if (airborne) {
      p.vy -= C.G * h;
      p.y += p.vy * h;
    }
    p.x += p.vx * h;
    const [lo, hi] = sideBounds(p.side);
    if (p.x < lo || p.x > hi) {
      p.x = clamp(p.x, lo, hi);
      if (p.state === 'dive') p.vx = 0;
    }
    if (p.y <= 0 && airborne) {
      p.y = 0;
      p.vy = 0;
      if (p.state === 'dive') {
        p.state = 'lie';
        p.t = 0;
        p.vx = 0;
      } else if (p.state === 'air' || p.state === 'spike') {
        p.state = 'ground';
        p.t = 0;
      }
      ev(m, 'land', { i: p.i, x: p.x });
    }
  }

  function touching(p, b) {
    const dx = b.x - p.x, dy = b.y - p.y;
    if (p.state === 'dive' || p.state === 'lie') return Math.abs(dx) <= C.DIVE_X && dy >= -0.2 && dy <= C.DIVE_Y1;
    return Math.abs(dx) <= C.BODY_X && dy >= C.BODY_Y0 && dy <= C.BODY_Y1;
  }

  function hitBall(m, p, b) {
    const toward = -p.side;
    // jumping into your companion's set spikes it for you, even without the button: smashed down near the net
    const assisted = p.state === 'air' && b.last === 2 + p.i && m.buddies[p.i].on;
    if (p.state === 'spike' || assisted) {
      const ay = Math.abs(b.vy);
      const aim = assisted ? (Math.abs(p.x) < 3.2 ? -1 : 0) : p.aim, fast = assisted || p.fast;
      b.vx = toward * (fast ? C.SPIKE_FAST : C.SPIKE_SLOW);
      b.vy = aim < 0 ? -clamp(2 * ay, C.SPIKE_DOWN, 22) : aim > 0 ? clamp(2 * ay, 6, 16) : 0;
      b.power = 1.2;
      b.spiker = p.i;
      b.spin = toward * -40;
      if (assisted) p.swingT = 0;
      p.stats.spikes++;
      ev(m, 'spike', { i: p.i, x: b.x, y: b.y, aim, fast, assisted });
    } else {
      let vx = C.HIT_KX * (b.x - p.x);
      if (Math.abs(vx) < 0.4) vx = (m.rng() < 0.5 ? -1 : 1) * (0.4 + m.rng() * 0.6); // never straight up and down forever
      b.vx = clamp(vx, -C.HIT_VX_MAX, C.HIT_VX_MAX);
      b.vy = Math.max(Math.abs(b.vy), C.HIT_VY);
      b.spiker = -1;
      const dig = p.state === 'dive' || p.state === 'lie';
      if (dig) p.stats.digs++;
      ev(m, dig ? 'dig' : 'hit', { i: p.i, x: b.x, y: b.y });
    }
    p.stats.hits++;
    b.last = p.i;
    m.rallyHits++;
  }

  // ---------------------------------------------------------------- companions

  // Where the companion bumps the ball to: peaking just in front of his player, at the top of a jump.
  function setTo(m, bd, apex) {
    const b = m.ball, p = m.players[bd.i], toward = -bd.side;
    const [lo, hi] = sideBounds(bd.side);
    const xt = clamp(p.x + toward * 0.55, Math.max(lo, -C.W / 2 + 1.2), Math.min(hi, C.W / 2 - 1.2));
    const vy = Math.sqrt(2 * C.G * Math.max(1, apex - b.y));
    b.vx = clamp((xt - b.x) / (vy / C.G), -7, 7);
    b.vy = vy;
    b.spiker = -1;
    b.power = 0;
    b.last = 2 + bd.i;
    bd.hopT = 0;
    bd.hopY = b.y;
  }

  function callBuddy(m, i) {
    const bd = m.buddies[i];
    if (m.phase === 'over') return;
    if (bd.on) {
      // already here: another treat (not too fast) while he's not saying goodbye
      if (bd.t > C.BUDDY_ARRIVE && bd.t < C.BUDDY_TIME - 1 && (bd.treatT < 0 || bd.treatT > 1)) {
        bd.treatT = 0;
        ev(m, 'treat', { i, again: true });
      }
      return;
    }
    if (bd.cool > 0) return ev(m, 'buddyNo', { i });
    Object.assign(bd, { on: true, t: 0, x: bd.side * (C.W / 2 + 1), vx: 0, helping: false, saved: false, treatT: -1, hopT: -1 });
    m.players[i].stats.calls++;
    ev(m, 'buddyIn', { i });
  }

  function updateBuddy(m, bd, h) {
    if (!bd.on) {
      if (bd.cool > 0) bd.cool = Math.max(0, bd.cool - h);
      return;
    }
    bd.t += h;
    if (bd.treatT >= 0) bd.treatT += h;
    if (bd.hopT >= 0) bd.hopT += h;
    const b = m.ball, side = bd.side, i = bd.i;
    if (bd.t >= 1.3 && bd.treatT < 0) {
      bd.treatT = 0;
      ev(m, 'treat', { i });
    }
    bd.helping = bd.t >= C.BUDDY_ARRIVE && bd.t < C.BUDDY_TIME;
    const inPlay = m.phase === 'play';
    let tx = side * C.BUDDY_IDLE;
    if (bd.t < C.BUDDY_ARRIVE) tx = side * C.BUDDY_IDLE;
    else if (bd.t >= C.BUDDY_TIME) tx = side * (C.W / 2 + 1.6); // off he goes
    else if (inPlay && b.x * side > 0 && b.last !== 2 + i) {
      // run under the ball: where it'll come down through his reach on our side
      const at = predict(b, 2.5, (x, y, vx, vy) => vy < 0 && y < C.SET_Y && x * side > 0);
      if (at && at.x * side > 0) tx = at.x;
    }
    const [lo, hi] = sideBounds(side);
    if (bd.t >= C.BUDDY_ARRIVE && bd.t < C.BUDDY_TIME) tx = clamp(tx, lo, hi);
    const step = C.BUDDY_RUN * h, dx = tx - bd.x;
    bd.vx = Math.abs(dx) > step ? Math.sign(dx) * C.BUDDY_RUN : dx / h;
    bd.x += clamp(dx, -step, step);
    // the set
    if (bd.helping && inPlay && !b.dead && b.vy < 0 && b.x * side > 0 && b.last !== 2 + i &&
        Math.abs(b.x - bd.x) < C.BUDDY_REACH && b.y < C.SET_Y + 0.35 && b.y > 0.9) {
      setTo(m, bd, C.SET_APEX);
      bd.sets++;
      ev(m, 'set', { i, x: b.x, y: b.y });
    }
    if (bd.t >= C.BUDDY_TIME + 1.3) {
      bd.on = false;
      bd.helping = false;
      bd.cool = m.buddyCool[i] || 0;
      ev(m, 'buddyOut', { i });
    }
  }

  // ---------------------------------------------------------------- the rally

  function pointTo(m, w) {
    const b = m.ball;
    m.score[w]++;
    m.players[w].stats.points++;
    const final = m.score[w] >= m.target;
    m.lastPoint = { to: w, spike: b.spiker === w, final, rallyT: m.rallyT, x: b.x };
    m.longestRally = Math.max(m.longestRally, m.rallyT);
    m.phase = 'point';
    m.phaseT = 0;
    b.dead = true;
    ev(m, 'point', Object.assign({ x: b.x, y: b.y }, m.lastPoint));
  }

  function step(m, inputs, h, first) {
    m.time += h;
    m.phaseT += h;
    if (m.phase === 'play') m.rallyT += h;
    const b = m.ball;
    for (const p of m.players) updatePlayer(m, p, inputs[p.i] || NONE, h, first);
    if (first) for (let i = 0; i < 2; i++) if (inputs[i] && inputs[i].call) callBuddy(m, i);
    for (const bd of m.buddies) updateBuddy(m, bd, h);

    if (m.phase === 'serve') {
      if (m.phaseT >= C.SERVE_WAIT) m.phase = 'play';
      else return; // the serve floats, waiting
    }
    moveBall(b, h, m);
    if (!b.dead) {
      for (const p of m.players) {
        if (touching(p, b)) {
          if (!p.lock) hitBall(m, p, b);
          p.lock = true;
        } else p.lock = false;
      }
    }
    if (b.y - C.R <= 0) {
      if (!b.dead) {
        const loser = b.x < 0 ? 0 : 1, bd = m.buddies[loser];
        if (bd.on && bd.helping && !bd.saved) {
          // the companion's one save per visit
          b.y = C.R + 0.02;
          bd.saved = true;
          bd.x = clamp(b.x, ...sideBounds(bd.side));
          setTo(m, bd, 5.6);
          m.players[loser].stats.saves++;
          ev(m, 'save', { i: loser, x: b.x });
        } else {
          ev(m, 'floor', { x: b.x, v: Math.abs(b.vy) });
          pointTo(m, 1 - loser);
        }
      }
      if (b.dead && b.y - C.R < 0) {
        // a dead ball bounces lower and lower, then rolls
        b.y = C.R;
        b.vy = Math.abs(b.vy) > 1.5 ? Math.abs(b.vy) * 0.5 : 0;
        b.vx *= 0.7;
      }
    }
    if (b.dead && b.y <= C.R + 0.01) b.vx *= 1 - Math.min(1, 2 * h);

    if (m.phase === 'point' && m.phaseT >= C.POINT_TIME) {
      const w = m.lastPoint.to;
      if (m.lastPoint.final) {
        m.phase = 'over';
        m.phaseT = 0;
        m.winner = w;
        m.players[w].state = 'win';
        m.players[1 - w].state = 'lose';
        for (const p of m.players) p.t = 0;
        for (const bd of m.buddies) if (bd.on && bd.t < C.BUDDY_TIME) bd.t = C.BUDDY_TIME; // say bye
        ev(m, 'over', { winner: w });
      } else {
        m.server = w;
        resetRally(m);
      }
    }
  }

  // Advance the match by one 1/60 s tick. inputs[i] = { left, right, up, down, hit, call } (hit and call are
  // presses, read once per tick). Returns this tick's events.
  function tick(m, inputs, dt = 1 / 60) {
    m.events = [];
    const h = (dt * m.speed) / C.SUB;
    for (let s = 0; s < C.SUB; s++) step(m, inputs, h, s === 0);
    return m.events;
  }

  root.VB = Object.assign(root.VB || {}, { C, NONE, create, tick, predict, sideBounds, callBuddy, touching, rngFrom, clamp });
})(typeof window !== 'undefined' ? window : globalThis);
