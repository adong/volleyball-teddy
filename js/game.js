/* The game: scene, camera, menus, HUD, companions and treats, the slow-motion replay, the main loop and the
   window.game test hooks. The engine (js/engine.js) owns the rules: this file reads its state, turns its events
   into effects, sounds, banners and toasts, and draws. Behind the title screen two CPUs play a quiet demo match. */
(function () {
  'use strict';
  const T = THREE;
  const Kit = window.Kit, VB = window.VB, C = VB.C;
  const People = Kit.people, Roster = Kit.roster;
  const pose = window.VBPose.pose, sfx = window.VBSfx, Fx = window.VBFx, Input = window.VBInput;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI;
  const TICK = 1 / 60;
  const damp = (r, dt) => 1 - Math.exp(-r * dt);
  const clamp = VB.clamp;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const SPIKE_WORDS = ['POW!', 'WHAM!', 'KAPOW!', 'SMASH!', 'BOOM!'];
  const SIDE_COL = ['#8cc2ff', '#ffb0b0'];
  // events the replay re-plays as effects
  const VISUAL = { spike: 1, hit: 1, dig: 1, dive: 1, net: 1, wall: 1, floor: 1, set: 1, save: 1 };

  // ---------------------------------------------------------------- settings (remembered on this device)
  const S = { p0: 'teddy', p1: 'tommy', level: 'easy', target: 15, speed: 1, replay: 1 };
  try { Object.assign(S, JSON.parse(localStorage.getItem('volleyTeddy.settings') || '{}')); } catch (e) { /* storage blocked */ }
  if (!Roster.get(S.p0)) S.p0 = 'teddy';
  if (!Roster.get(S.p1)) S.p1 = 'tommy';
  const saveSettings = () => {
    try { localStorage.setItem('volleyTeddy.settings', JSON.stringify(S)); } catch (e) { /* storage blocked */ }
  };

  const G = {
    mode: 'loading', // title, play, paused, replay, celebrate, results
    twoP: false, demo: true, m: null, brains: [null, null],
    acc: 0, t: 0, shake: 0, test: false,
    rec: [], tick: 0, finalTick: -1, finalSpike: false,
    replay: null, celebrateT: 0,
    forced: [null, null], // test hook: inputs held every tick
    built: '', // which characters the figures were built for
  };

  let renderer, scene, camera, sun, stage, ballG, shadow;
  const cam = { x: 0, y: 4.5, z: 20 };
  let portraits = {};
  const figs = [null, null], buds = [null, null], treats = [null, null];
  const trail = [], trailPos = [];
  const hoops = []; // Teddy's goodbye 🏀 shots
  const tmpV = new T.Vector3();

  // facing: toward the net and a little toward the camera, so we see faces and shirt prints
  const faceNet = (side) => (side < 0 ? -(PI / 2 + 0.35) : PI / 2 + 0.35);
  const faceDir = (dir) => (dir > 0 ? -(PI / 2 + 0.25) : PI / 2 + 0.25);
  const FACE_CAM = PI;
  function easeAngle(cur, to, k) {
    let d = to - cur;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    return cur + d * k;
  }
  const nameOf = (i) => (figs[i] ? figs[i].entry.name : i ? 'P2' : 'P1');
  const nice = (n) => n[0] + n.slice(1).toLowerCase();

  // ---------------------------------------------------------------- characters

  function disposeObj(o) {
    o.traverse((x) => {
      if (x.geometry) x.geometry.dispose();
      if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach((mt) => {
        if (x.isSprite && mt.map) mt.map.dispose();
        mt.dispose();
      });
    });
  }

  function lookFor(id, alt) {
    const e = Roster.get(id);
    if (!alt) return e.look;
    // the same character on both sides: the second one gets a different shirt and shoes
    return Object.assign({}, e.look, { top: Kit.gfx.shade(e.look.top, -0.4), shoes: '#ffd400' });
  }

  function buildFigures() {
    const ids = [S.p0, S.p1];
    const key = ids.join('/');
    if (G.built === key) return;
    G.built = key;
    for (let i = 0; i < 2; i++) {
      if (figs[i]) {
        scene.remove(figs[i].p.root);
        disposeObj(figs[i].p.root);
      }
      if (buds[i]) {
        scene.remove(buds[i].p.root);
        disposeObj(buds[i].p.root);
      }
      const entry = Roster.get(ids[i]);
      const p = People.build(lookFor(ids[i], i === 1 && ids[0] === ids[1]));
      p.root.rotation.y = faceNet(i ? 1 : -1);
      scene.add(p.root);
      figs[i] = { entry, p, ph: 0, cheerT: 0, cheerMode: 'wave', spikeMode: entry.id === 'teddy' ? 'jumpshot' : 'spike' };
      const bentry = Roster.get(Roster.buddyFor(ids[i]));
      const bp = People.build(bentry.look);
      bp.root.scale.setScalar(bentry.buddyScale || 0.8);
      const tag = Kit.gfx.nameTag(bentry.name, SIDE_COL[i]);
      tag.position.y = 2.75;
      bp.root.add(tag);
      bp.root.visible = false;
      scene.add(bp.root);
      buds[i] = { entry: bentry, p: bp, x: (i ? 1 : -1) * 9, ph: 0, dash: 0, shot: false, rot: faceNet(i ? 1 : -1) };
    }
    refreshHudNames();
  }

  // ---------------------------------------------------------------- scene

  function beachBallTexture() {
    const [c, g] = Kit.gfx.makeCanvas(512, 256);
    const cols = ['#ff3d3d', '#ffffff', '#ffd400', '#2f7bff', '#ffffff', '#2fbf5a'];
    cols.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect((i * 512) / 6, 0, 512 / 6 + 1, 256);
    });
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 26);
    g.fillRect(0, 230, 512, 26);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 6; i++) g.fillRect((i * 512) / 6 - 1, 26, 2, 204);
    return Kit.gfx.toTexture(c);
  }

  function buildScene() {
    const canvas = $('game');
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(32, 1, 0.1, 400);
    scene.add(new T.HemisphereLight('#e6f6ff', '#d9b77a', 0.85));
    sun = new T.DirectionalLight('#fff3dc', 1.15);
    sun.position.set(-6, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 1024);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -3, near: 1, far: 50 });
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);
    stage = window.VBStage.build(scene, C);
    Fx.init(scene);

    // the ball: a beach ball, tilted so its pole faces us and its stripes spin like a pinwheel
    ballG = new T.Group();
    const ball = new T.Mesh(new T.SphereGeometry(C.R, 32, 20), Kit.gfx.std('#ffffff', { map: beachBallTexture(), roughness: 0.35 }));
    ball.rotation.x = PI / 2 - 0.5;
    ball.castShadow = true;
    ballG.add(ball);
    scene.add(ballG);
    // a soft round shadow right under it, so little players can see where it's coming down
    const [sc, sg] = Kit.gfx.makeCanvas(64, 64);
    const gr = sg.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(60,40,20,0.75)');
    gr.addColorStop(1, 'rgba(60,40,20,0)');
    sg.fillStyle = gr;
    sg.fillRect(0, 0, 64, 64);
    shadow = new T.Mesh(new T.PlaneGeometry(1.6, 1.6), new T.MeshBasicMaterial({ map: Kit.gfx.toTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -PI / 2;
    shadow.position.y = 0.02;
    scene.add(shadow);
    // ghost balls behind a spiked ball
    for (let i = 0; i < 6; i++) {
      const g = new T.Mesh(new T.SphereGeometry(C.R * (1 - i * 0.1), 16, 10), new T.MeshBasicMaterial({ color: '#fff6b0', transparent: true, opacity: 0, depthWrite: false }));
      scene.add(g);
      trail.push(g);
    }
    for (let i = 0; i < 2; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ depthWrite: false }));
      s.visible = false;
      s.renderOrder = 6;
      scene.add(s);
      treats[i] = { s, flyT: -1, holdT: 0, from: new T.Vector3() };
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- UI helpers

  let bannerTimer = 0;
  function banner(text, cls = '', ms = 1200) {
    if (G.demo) return;
    const el = $('banner');
    el.className = 'banner ' + cls;
    el.textContent = text;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function toast(text, cls) {
    if (G.demo) return;
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1900);
    while (box.children.length > 3) box.firstChild.remove();
  }

  const SCREENS = ['title', 'pause', 'results'];
  function showScreen(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  }

  function refreshHudNames() {
    for (let i = 0; i < 2; i++) {
      const box = $('pl' + i);
      box.querySelector('.face img').src = portraits[figs[i].entry.id] || '';
      box.querySelector('.nm').textContent = figs[i].entry.name;
      box.querySelector('.who').textContent = i === 0 ? (G.twoP ? '1P' : 'YOU') : G.twoP ? '2P' : 'CPU';
      const bud = box.querySelector('.bud');
      bud.querySelector('img').src = portraits[buds[i].entry.id] || '';
      bud.querySelector('.k').textContent = i === 0 ? 'T' : G.twoP ? 'Enter' : 'CPU';
      bud.title = `Call ${nice(buds[i].entry.name)}`;
    }
    $('budBtn').querySelector('img').src = portraits[buds[0].entry.id] || '';
    $('budBtn').querySelector('small').textContent = buds[0].entry.name;
    $('toWin').textContent = `FIRST TO ${G.m ? G.m.target : S.target}`;
  }

  const hudCache = {};
  function updateHud() {
    const m = G.m;
    if (!m || G.demo) return;
    for (let i = 0; i < 2; i++) {
      const v = String(m.score[i]);
      if (hudCache['s' + i] !== v) {
        hudCache['s' + i] = v;
        const el = $('sc' + i);
        el.textContent = v;
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
      const bd = m.buddies[i];
      const state = bd.on ? 'on' : bd.cool > 0 ? 'rest' : '';
      const fill = bd.on ? clamp(1 - bd.t / C.BUDDY_TIME, 0, 1) : bd.cool > 0 ? 1 - bd.cool / (m.buddyCool[i] || 1) : 1;
      const key = state + fill.toFixed(2);
      if (hudCache['b' + i] !== key) {
        hudCache['b' + i] = key;
        const el = document.querySelector(`.bud[data-side="${i}"]`);
        el.classList.toggle('on', state === 'on');
        el.classList.toggle('rest', state === 'rest');
        el.querySelector('i').style.setProperty('--fill', fill.toFixed(3));
        if (i === 0) {
          const b = $('budBtn');
          b.classList.toggle('on', state === 'on');
          b.classList.toggle('rest', state === 'rest');
          b.style.setProperty('--fill', fill.toFixed(3));
        }
      }
    }
  }

  function updateMuteIcons() {
    document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
  }

  const touchDevice = () => window.matchMedia('(hover: none), (pointer: coarse)').matches || G.sawTouch;

  // ---------------------------------------------------------------- matches

  function newMatch(o) {
    G.m = VB.create(o);
    G.rec = [];
    G.tick = 0;
    G.finalTick = -1;
    G.finalSpike = false;
    G.replay = null;
    G.acc = 0;
    for (const k in hudCache) delete hudCache[k];
    for (let i = 0; i < 2; i++) {
      if (figs[i]) figs[i].cheerT = 0;
      if (buds[i]) buds[i].x = (i ? 1 : -1) * 9;
      treats[i].flyT = -1;
      treats[i].holdT = 0;
      treats[i].s.visible = false;
    }
    Fx.clear();
  }

  function startDemo() {
    G.demo = true;
    G.twoP = false;
    buildFigures();
    newMatch({ target: 7, speed: 1, buddyCool: [5, 5] });
    G.brains = [VB.cpu.create('normal'), VB.cpu.create('easy')];
  }

  function startMatch(twoP) {
    Kit.sound.init();
    G.twoP = !!twoP;
    G.demo = false;
    Input.setTwoPlayer(G.twoP);
    Input.clear();
    buildFigures();
    // 1 player: call your brother as often as you like; the CPU's rests 5 s. 2 players: both rest 5 s.
    newMatch({ target: +S.target, speed: +S.speed, buddyCool: G.twoP ? [5, 5] : [0, 5], server: 0 });
    G.brains = G.twoP ? [null, null] : [null, VB.cpu.create(S.level)];
    refreshHudNames();
    showScreen(null);
    $('hud').classList.remove('hidden', 'replaying');
    $('replayTag').classList.add('hidden');
    $('touch').classList.toggle('hidden', G.twoP || !touchDevice());
    G.mode = 'play';
    banner('READY?', 'small', 850);
    Kit.sound.music('play');
  }

  function goTitle() {
    G.mode = 'title';
    showScreen('title');
    $('hud').classList.add('hidden');
    $('touch').classList.add('hidden');
    $('banner').classList.remove('show');
    startDemo();
    refreshTitle();
    Kit.sound.music('title');
  }

  function pauseGame() {
    if (G.mode !== 'play') return;
    G.mode = 'paused';
    showScreen('pause');
    Input.clear();
    Kit.sound.music('pause');
  }

  function resumeGame() {
    if (G.mode !== 'paused') return;
    G.mode = 'play';
    showScreen(null);
    G.acc = 0;
    Kit.sound.music('play');
  }

  function callBuddy(i) {
    if (!G.m || G.demo || (G.mode !== 'play' && G.mode !== 'paused')) return;
    if (i === 1 && !G.twoP) return;
    VB.callBuddy(G.m, i);
    G.m.events.forEach((e) => onEvent(e, true));
  }

  // ---------------------------------------------------------------- the companion's treat

  function giveTreat(i) {
    const [emoji, label] = pick(TREATS);
    const tr = treats[i], bv = buds[i];
    tr.s.material.map = Kit.gfx.emojiTexture(emoji);
    tr.s.material.needsUpdate = true;
    bv.p.root.updateMatrixWorld(true);
    People.handWorld(bv.p, 1, tr.from);
    tr.s.position.copy(tr.from);
    tr.s.scale.setScalar(0.6);
    tr.s.visible = true;
    tr.flyT = 0;
    tr.holdT = 0;
    toast(`${emoji} ${label} FROM ${bv.entry.name}!`);
    if (!G.demo) sfx.treat();
  }

  function updateTreat(i, dt) {
    const tr = treats[i], f = figs[i];
    if (tr.flyT < 0 && tr.holdT <= 0) return;
    f.p.root.updateMatrixWorld(true);
    const side = i ? 1 : -1;
    People.handWorld(f.p, side < 0 ? 1 : -1, tmpV); // the hand on the camera side
    tmpV.z += 0.35;
    if (tr.flyT >= 0) {
      tr.flyT += dt / 0.6;
      const k = Math.min(1, tr.flyT);
      tr.s.position.lerpVectors(tr.from, tmpV, k);
      tr.s.position.y += Math.sin(k * PI) * 1.4;
      if (k >= 1) {
        tr.flyT = -1;
        tr.holdT = 3;
        Fx.sparkle(tmpV.x, tmpV.y, 6);
      }
    } else {
      tr.holdT -= dt;
      tr.s.position.copy(tmpV);
      tr.s.scale.setScalar(0.62 + Math.sin(G.t * 8) * 0.03);
      if (tr.holdT <= 0) {
        tr.s.visible = false;
        Fx.sparkle(tmpV.x, tmpV.y, 8, '💖');
      }
    }
  }

  // Teddy's goodbye: a 🏀 jump shot that arcs up out of the court
  function shootHoop(i) {
    const bv = buds[i];
    bv.p.root.updateMatrixWorld(true);
    const from = People.handWorld(bv.p, 1, new T.Vector3());
    const s = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture('🏀'), depthWrite: false }));
    s.scale.setScalar(0.55);
    s.position.copy(from);
    scene.add(s);
    hoops.push({ s, t: 0, from, to: new T.Vector3((i ? 1 : -1) * 9.5, 11, -2) });
    if (!G.demo) sfx.swish();
  }

  function updateHoops(dt) {
    for (let k = hoops.length - 1; k >= 0; k--) {
      const h = hoops[k];
      h.t += dt / 1.1;
      const u = Math.min(1, h.t);
      h.s.position.lerpVectors(h.from, h.to, u);
      h.s.position.y += Math.sin(u * PI) * 2.5;
      h.s.material.rotation = -h.t * 9;
      if (u >= 1) {
        scene.remove(h.s);
        h.s.material.dispose();
        hoops.splice(k, 1);
      }
    }
  }

  // ---------------------------------------------------------------- events -> effects, sounds, words

  function onEvent(e, live) {
    const m = G.m;
    const quiet = G.demo || !live;
    switch (e.type) {
      case 'spike':
        Fx.pow(e.x + (e.i ? -1.0 : 1.0), e.y + 0.5, pick(SPIKE_WORDS), true);
        G.shake = Math.max(G.shake, 0.35);
        if (!quiet) sfx.spike();
        break;
      case 'hit':
        Fx.ring(e.x, e.y, '#ffffff', 1.4);
        if (!quiet) sfx.hit();
        break;
      case 'dig':
        Fx.pow(e.x, e.y + 0.4, 'DIG!', false);
        Fx.dust(e.x, 8);
        if (!quiet) sfx.dig();
        break;
      case 'dive':
        Fx.dust(m ? m.players[e.i].x : 0, 6);
        if (!quiet) sfx.dive();
        break;
      case 'jump':
        if (m) Fx.dust(m.players[e.i].x, 4, 0.1);
        if (!quiet) sfx.jump();
        break;
      case 'land':
        Fx.dust(e.x, 3, 0.1);
        if (!quiet) sfx.land();
        break;
      case 'swing':
        if (!quiet) sfx.swing();
        break;
      case 'net':
        Fx.stars(e.x, e.y, 2);
        if (!quiet) sfx.net();
        break;
      case 'wall':
        stage.flashWall(Math.sign(e.x), e.y);
        if (!quiet) sfx.wall();
        break;
      case 'floor':
        Fx.dust(e.x, 18, 0.2);
        Fx.stars(e.x, 0.7, 4);
        G.shake = Math.max(G.shake, 0.22);
        if (!quiet) sfx.floor(e.v);
        break;
      case 'set':
        Fx.word(e.x, e.y + 1.1, 'SET!', '#ffe14d', 1.6);
        Fx.ring(e.x, e.y, '#ffe14d', 1.8);
        if (!quiet) sfx.set();
        break;
      case 'save': {
        Fx.pow(e.x, 1.3, 'SAVED!', true);
        Fx.sparkle(e.x, 1.2, 10);
        if (buds[e.i]) buds[e.i].dash = 0.35;
        if (live) {
          toast(`${buds[e.i].entry.name} SAVED IT!`, 'save');
          if (!quiet) sfx.save();
        }
        break;
      }
      case 'point':
        if (!live) break;
        if (e.final) {
          G.finalTick = G.tick;
          G.finalSpike = e.spike;
          banner('GAME!', e.to ? 'right' : '', 1700);
        } else {
          const n = nameOf(e.to);
          banner(e.spike ? `${n} SPIKES IT!` : `POINT ${n}!`, 'small' + (e.to ? ' right' : ''), 1100);
        }
        if (figs[e.to]) {
          figs[e.to].cheerT = 1.5;
          figs[e.to].cheerMode = Roster.signature(figs[e.to].entry, 'hello');
        }
        if (!quiet) sfx.point(G.twoP || e.to === 0);
        break;
      case 'serve':
        if (!live) break;
        if (m && m.score[0] + m.score[1] > 0) {
          if (!quiet) sfx.whistle();
          if (Math.max(m.score[0], m.score[1]) === m.target - 1) setTimeout(() => banner('MATCH POINT!', 'mp', 1000), 250);
        }
        break;
      case 'over':
        if (live) onOver();
        break;
      case 'buddyIn': {
        if (!live) break;
        const b = buds[e.i];
        b.x = (e.i ? 1 : -1) * (C.W / 2 + 1);
        b.shot = false;
        toast(`${b.entry.name}'S HERE TO HELP!`);
        if (!quiet) sfx.buddy();
        break;
      }
      case 'buddyNo': {
        if (!live) break;
        const el = document.querySelector(`.bud[data-side="${e.i}"]`);
        for (const x of [el, e.i === 0 ? $('budBtn') : null]) {
          if (!x) continue;
          x.classList.remove('no');
          void x.offsetWidth;
          x.classList.add('no');
        }
        if (!quiet) sfx.nope();
        break;
      }
      case 'treat':
        if (live) giveTreat(e.i);
        break;
    }
  }

  // ---------------------------------------------------------------- the end of a match: replay, celebrate, results

  function onOver() {
    if (G.demo) return;
    if (+S.replay && G.finalTick >= 0) startReplay('celebrate');
    else startCelebrate();
  }

  function startReplay(after) {
    const fi = G.rec.findIndex((f) => f.tick >= G.finalTick);
    if (fi < 0) return after === 'results' ? showResults() : startCelebrate();
    // start a little before the last spike of the rally (or 2.5 s before the ball landed)
    let si = -1;
    for (let k = fi; k >= Math.max(0, fi - 240); k--) {
      if (G.rec[k].evs.some((e) => e.type === 'spike')) {
        si = k;
        break;
      }
    }
    const start = si >= 0 ? Math.max(0, si - 80) : Math.max(0, fi - 150);
    const frames = G.rec.slice(start, Math.min(G.rec.length, fi + 50));
    G.replay = { frames, pos: 0, done: -1, slowFrom: (si >= 0 ? si : fi - 40) - start - 20, slowTo: fi - start + 12, after, frame: frames[0] };
    G.mode = 'replay';
    showScreen(null);
    Fx.clear();
    $('hud').classList.remove('hidden');
    $('hud').classList.add('replaying');
    $('touch').classList.add('hidden');
    $('banner').classList.remove('show');
    $('replaySub').textContent = (G.finalSpike ? 'the winning spike' : 'the winning point') + ' · tap to skip';
    $('replayTag').classList.remove('hidden');
    Kit.sound.music('over');
  }

  function stepReplay(dt) {
    const r = G.replay;
    const slow = r.pos >= r.slowFrom && r.pos <= r.slowTo;
    r.pos += dt * 60 * (slow ? 0.28 : 0.9);
    const i = Math.floor(r.pos);
    for (let k = r.done + 1; k <= Math.min(i, r.frames.length - 1); k++) {
      for (const e of r.frames[k].evs) {
        onEvent(e, false);
        if (e.type === 'spike') sfx.spike();
        if (e.type === 'floor') sfx.floor(e.v);
      }
      r.done = k;
    }
    if (i >= r.frames.length) return endReplay();
    r.frame = r.frames[i];
  }

  function endReplay() {
    const after = G.replay ? G.replay.after : 'celebrate';
    G.replay = null;
    $('hud').classList.remove('replaying');
    $('replayTag').classList.add('hidden');
    if (after === 'results') showResults();
    else startCelebrate();
  }

  function startCelebrate() {
    G.mode = 'celebrate';
    G.celebrateT = 0;
    showScreen(null);
    $('hud').classList.remove('hidden', 'replaying');
    $('replayTag').classList.add('hidden');
    const w = G.m.winner;
    banner(`${nameOf(w)} WINS!`, 'win', 3200);
    Fx.confetti(-7, 7, 80);
    sfx.fanfare();
    sfx.cheer();
    Kit.sound.music('over');
  }

  function showResults() {
    const m = G.m, w = m.winner;
    G.mode = 'results';
    $('touch').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('resFace').src = portraits[figs[w].entry.id] || '';
    $('resTitle').textContent = `${nameOf(w)} WINS!`;
    const vsCpu = !G.twoP && w === 1;
    $('resSub').textContent = vsCpu ? 'So close! Call your brother in and try again!' : `${m.score[w]} to ${m.score[1 - w]}. What a match!`;
    const P = m.players;
    const row = (label, a, b) => `<span class="l">${label}</span><b>${a}</b><b>${b}</b>`;
    $('resStats').innerHTML =
      `<span></span><span class="h" style="color:${SIDE_COL[0]}">${nameOf(0)}</span><span class="h" style="color:${SIDE_COL[1]}">${nameOf(1)}</span>` +
      row('points', m.score[0], m.score[1]) +
      row('spikes', P[0].stats.spikes, P[1].stats.spikes) +
      row('diving saves', P[0].stats.digs, P[1].stats.digs) +
      row('brother saves', P[0].stats.saves, P[1].stats.saves) +
      `<span class="l">longest rally</span><b style="grid-column: span 2">${m.longestRally.toFixed(1)} s</b>`;
    $('replayBtn').classList.toggle('hidden', G.finalTick < 0);
    showScreen('results');
  }

  // ---------------------------------------------------------------- the loop

  function gatherInputs() {
    const m = G.m, out = [];
    for (let i = 0; i < 2; i++) {
      if (G.forced[i]) out.push(Object.assign({}, VB.NONE, G.forced[i]));
      else if (G.brains[i]) out.push(VB.cpu.think(G.brains[i], m, i, TICK));
      else if (G.mode === 'play') out.push(Input.snapshot(i));
      else out.push(VB.NONE);
    }
    // a spike from the touch button close to the net smashes down (there's no "down" button on touch)
    const a = out[0];
    if (a.touch && a.hit && m.players[0].state === 'air' && Math.abs(m.players[0].x) < 3.2) a.down = true;
    return out;
  }

  function snap(m, evs) {
    const b = m.ball;
    return {
      tick: G.tick, phase: m.phase, phaseT: m.phaseT,
      ball: { x: b.x, y: b.y, rot: b.rot, power: b.power, dead: b.dead },
      players: m.players.map((p) => ({ i: p.i, side: p.side, x: p.x, y: p.y, vx: p.vx, state: p.state, t: p.t, swingT: p.swingT, diveDir: p.diveDir })),
      buddies: m.buddies.map((d) => ({ i: d.i, side: d.side, on: d.on, t: d.t, x: d.x, vx: d.vx, hopT: d.hopT, hopY: d.hopY, treatT: d.treatT })),
      evs: evs.filter((e) => VISUAL[e.type]),
    };
  }

  function tickOnce() {
    const m = G.m;
    const before = m.phase;
    const evs = VB.tick(m, gatherInputs(), TICK);
    G.tick++;
    if (!G.demo && m.phase !== 'over') {
      G.rec.push(snap(m, evs));
      if (G.rec.length > 600) G.rec.shift();
    }
    for (const e of evs) onEvent(e, true);
    if (!G.demo && before === 'serve' && m.phase === 'play' && m.score[0] + m.score[1] === 0) banner('GO!', '', 700);
  }

  function advance(dt, noDraw) {
    G.t += dt;
    const running = G.m && (G.mode === 'title' || G.mode === 'play' || G.mode === 'celebrate' || G.mode === 'results');
    if (running) {
      G.acc += dt;
      let n = 0;
      while (G.acc >= TICK - 1e-9 && n < 8) {
        tickOnce();
        G.acc -= TICK;
        n++;
      }
      if (n >= 8) G.acc = 0;
    }
    if (G.mode === 'replay' && G.replay) stepReplay(dt);
    if (G.mode === 'celebrate') {
      G.celebrateT += dt;
      if (G.celebrateT > 3.4) showResults();
    }
    if (G.demo && G.m && G.m.phase === 'over' && G.m.phaseT > 3) startDemo();
    if (!noDraw) draw(dt);
    else {
      Fx.update(dt); // effects still age when a test fast-forwards without drawing
      updateHoops(dt);
    }
  }

  // ---------------------------------------------------------------- drawing

  function drawPlayer(i, pl, view, dt) {
    const f = figs[i], p = f.p, k = damp(18, dt);
    f.ph += dt * 12;
    f.cheerT = Math.max(0, f.cheerT - dt);
    let mode = 'ready', rot = faceNet(pl.side), y = pl.y, ph = f.ph;
    const o = { arm: pl.side < 0 ? 1 : -1, t: 0 };
    switch (pl.state) {
      case 'ground':
        mode = Math.abs(pl.vx) > 0.3 ? 'run' : 'ready';
        break;
      case 'air':
      case 'spike':
        if (pl.swingT >= 0 && pl.swingT < 0.45) {
          mode = f.spikeMode;
          o.t = pl.swingT;
        } else mode = 'jump';
        break;
      case 'dive':
      case 'lie':
        mode = pl.state;
        rot = faceDir(pl.diveDir || -pl.side);
        break;
      case 'win': {
        // the winner's signature: Teddy shadow-boxes Tyson-style, Tommy hops in his Y pose
        const sig = Roster.signature(f.entry, 'hello');
        mode = sig;
        rot = FACE_CAM;
        ph = sig === 'boxing' ? pl.t * 6 : f.ph * 0.6;
        y += sig === 'boxing' ? Math.abs(Math.sin(pl.t * 6)) * 0.08 : Math.abs(Math.sin(pl.t * 4.5)) * 0.55;
        break;
      }
      case 'lose':
        mode = 'aww';
        rot = (faceNet(pl.side) + FACE_CAM * Math.sign(faceNet(pl.side))) / 2;
        break;
    }
    if (f.cheerT > 0 && pl.state === 'ground' && view.phase === 'point') {
      // a little celebration for the point: his signature move, facing us
      mode = f.cheerMode;
      rot = FACE_CAM;
      ph = mode === 'boxing' ? (1.5 - f.cheerT) * 6 : f.ph * 0.6;
      if (mode !== 'boxing') y += Math.abs(Math.sin((1.5 - f.cheerT) * 5)) * 0.4;
    }
    pose(p, mode, ph, mode === 'spike' || mode === 'jumpshot' ? Math.max(k, 0.5) : k, o);
    p.root.position.set(pl.x, y, 0);
    p.root.rotation.y = easeAngle(p.root.rotation.y, rot, damp(14, dt));
  }

  function drawBuddy(i, bd, view, dt) {
    const v = buds[i], p = v.p, sc = v.entry.buddyScale || 0.8;
    p.root.visible = bd.on;
    if (!bd.on) return;
    const k = damp(18, dt);
    v.x += (bd.x - v.x) * damp(v.dash > 0 ? 40 : 16, dt);
    v.dash = Math.max(0, v.dash - dt);
    v.ph += dt * 12;
    const t = bd.t, TIME = C.BUDDY_TIME;
    let y = 0, mode = 'ready', rot = faceNet(bd.side), ph = v.ph;
    const o = { t: 0 };
    const hop = bd.hopT >= 0 && bd.hopT < 0.55;
    if (hop) {
      // a set (a leap, arms out) or a save (a dive in the sand)
      if (bd.hopY < 1.4) mode = 'dive';
      else {
        mode = 'bump';
        y = clamp(bd.hopY - 1.75 * sc, 0.15, 2.4) * Math.sin(PI * Math.min(1, bd.hopT / 0.55));
      }
      if (mode === 'dive') rot = faceDir(-bd.side);
    } else if (t < C.BUDDY_ARRIVE || t >= TIME) {
      mode = 'run';
      rot = faceDir(Math.sign(bd.vx) || -bd.side);
    } else if (bd.treatT >= 0 && bd.treatT < 0.5) {
      mode = 'give';
    } else if (t < C.BUDDY_ARRIVE + 0.9) {
      // hello: his signature move
      mode = Roster.signature(v.entry, 'hello');
      rot = FACE_CAM;
      if (mode === 'boxing') ph = t * 6;
    } else if (t > TIME - 1) {
      // goodbye: his signature (Teddy's jump shot with a 🏀, Tommy's Y)
      mode = Roster.signature(v.entry, 'goodbye');
      rot = FACE_CAM;
      if (mode === 'jumpshot') {
        const u = (t - (TIME - 1)) / 0.7;
        if (u < 1) y = Math.sin(u * PI) * 0.9;
        if (u > 0.45 && !v.shot) {
          v.shot = true;
          shootHoop(i);
        }
      } else if (mode === 'boxing') ph = t * 6;
    } else if (Math.abs(bd.vx) > 0.8) {
      mode = 'run';
      rot = faceDir(Math.sign(bd.vx));
    }
    pose(p, mode, ph, k, o);
    p.root.position.set(v.x, y, -0.9);
    p.root.rotation.y = easeAngle(p.root.rotation.y, rot, damp(12, dt));
  }

  function drawBall(b, view, dt) {
    let y = b.y;
    if (view.phase === 'serve') y += Math.sin(G.t * 4) * 0.08;
    ballG.position.set(b.x, y, 0);
    ballG.rotation.z = b.rot;
    const h = Math.max(0, y - C.R);
    const s = 1.6 / (1 + h * 0.15);
    shadow.position.x = b.x;
    shadow.scale.set(s, s, 1);
    shadow.material.opacity = 0.9 / (1 + h * 0.25);
    // the ghost trail of a spike
    trailPos.unshift(b.x, y);
    trailPos.length = Math.min(trailPos.length, 24);
    for (let k = 0; k < trail.length; k++) {
      const g = trail[k], j = (k + 1) * 4;
      if (b.power > 0 && trailPos.length > j + 1) {
        g.position.set(trailPos[j], trailPos[j + 1], -0.05);
        g.material.opacity = Math.min(1, b.power) * 0.45 * (1 - k / trail.length);
      } else g.material.opacity = 0;
      g.visible = g.material.opacity > 0.01;
    }
  }

  function frameCamera(dt, view) {
    const aspect = camera.aspect;
    const touchOn = !$('touch').classList.contains('hidden');
    // with touch buttons along the bottom, show more sand below the court so they don't cover the players
    const y0 = touchOn ? (window.innerHeight < 500 ? -3.0 : -2.2) : -0.7, y1 = 10.5, xw = 8.7;
    const tan = Math.tan((camera.fov * PI) / 360);
    const D = Math.max((y1 - y0) / (2 * tan), xw / (tan * aspect));
    let tx = 0, ty = (y0 + y1) / 2, tz = D, rate = 4;
    if (G.mode === 'replay' && view) {
      // follow the ball, closer in
      tx = clamp(view.ball.x * 0.5, -3.5, 3.5);
      ty = clamp(view.ball.y * 0.35 + 2.4, 3.4, 5.2);
      tz = D * 0.76;
      rate = 2.5;
    } else if ((G.mode === 'celebrate' || G.mode === 'results') && G.m && G.m.winner >= 0) {
      // swing in on the winner
      tx = clamp(G.m.players[G.m.winner].x * 0.75, -4.5, 4.5);
      ty = 2.6;
      tz = D * 0.58;
      rate = 1.5;
    }
    cam.x += (tx - cam.x) * damp(rate, dt);
    cam.y += (ty - cam.y) * damp(rate, dt);
    cam.z += (tz - cam.z) * damp(rate, dt);
    G.shake = Math.max(0, G.shake - dt * 1.6);
    const sx = (Math.random() - 0.5) * G.shake * 0.6, sy = (Math.random() - 0.5) * G.shake * 0.6;
    camera.position.set(cam.x + sx, cam.y + 2.2 + sy, cam.z);
    camera.lookAt(cam.x, cam.y - 0.3, 0);
    camera.updateMatrixWorld();
  }

  function draw(dt) {
    if (!G.m) return;
    const view = G.mode === 'replay' && G.replay ? G.replay.frame : G.m;
    stage.update(dt, G.t);
    for (let i = 0; i < 2; i++) {
      drawPlayer(i, view.players[i], view, dt);
      drawBuddy(i, view.buddies[i], view, dt);
    }
    // treats follow the hands, which need the poses above
    for (let i = 0; i < 2; i++) {
      if (G.mode === 'replay') treats[i].s.visible = false;
      else updateTreat(i, dt);
    }
    drawBall(view.ball, view, dt);
    updateHoops(dt);
    Fx.update(dt);
    frameCamera(dt, view);
    updateHud();
    renderer.render(scene, camera);
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : TICK;
    last = now;
    if (!G.frozen) advance(dt);
  }

  // ---------------------------------------------------------------- title screen

  const IDS = Roster.list.map((e) => e.id);

  function refreshTitle() {
    for (let i = 0; i < 2; i++) {
      const id = S['p' + i], e = Roster.get(id), b = Roster.get(Roster.buddyFor(id));
      const box = $('pick' + i);
      box.querySelector(':scope > img').src = portraits[id] || '';
      box.querySelector(':scope > .nm').textContent = e.name;
      box.querySelector('.pal img').src = portraits[b.id] || '';
      box.querySelector('.pal b').textContent = b.name;
    }
    $('pick1').querySelector('.who').textContent = 'CPU · 2P';
    document.querySelectorAll('.opt').forEach((o) => {
      const key = o.dataset.opt;
      o.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(String(S[key]) === b.dataset.v)));
    });
  }

  function cycle(i, d) {
    const k = (IDS.indexOf(S['p' + i]) + d + IDS.length) % IDS.length;
    S['p' + i] = IDS[k];
    saveSettings();
    refreshTitle();
    if (G.mode === 'title') startDemo();
    sfx.click();
  }

  function bindUi() {
    $('logo').innerHTML = window.VB_TITLE_HTML;
    $('play1').onclick = () => startMatch(false);
    $('play2').onclick = () => startMatch(true);
    for (let i = 0; i < 2; i++) $('pick' + i).querySelectorAll('.arr').forEach((b) => (b.onclick = () => cycle(i, +b.dataset.d)));
    document.querySelectorAll('.opt').forEach((o) => {
      o.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          const v = b.dataset.v;
          S[o.dataset.opt] = o.dataset.opt === 'level' ? v : +v;
          saveSettings();
          refreshTitle();
          sfx.click();
        };
      });
    });
    $('pauseBtn').onclick = () => pauseGame();
    $('resumeBtn').onclick = () => resumeGame();
    $('quitBtn').onclick = () => goTitle();
    $('againBtn').onclick = () => startMatch(G.twoP);
    $('menuBtn').onclick = () => goTitle();
    $('replayBtn').onclick = () => startReplay('results');
    document.querySelectorAll('.muteBtn').forEach((b) => (b.onclick = () => {
      Kit.sound.init();
      Kit.sound.toggleMute();
      updateMuteIcons();
    }));
    document.querySelectorAll('.bud').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      callBuddy(+b.dataset.side);
    }));
    Input.bindTouch($('touch'));
    // skip the replay with a tap
    $('game').addEventListener('pointerdown', () => {
      if (G.mode === 'replay') endReplay();
    });
    $('hud').addEventListener('pointerdown', (e) => {
      if (G.mode === 'replay' && !e.target.closest('button')) endReplay();
    });

    // the first gesture unlocks sound
    const unlock = () => Kit.sound.init();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', () => (G.sawTouch = true), { passive: true });

    window.addEventListener('keydown', (e) => {
      unlock();
      const code = e.code;
      if (G.mode === 'replay') {
        e.preventDefault();
        return endReplay();
      }
      if (G.mode === 'play' && Input.setKey(code, true, e.repeat)) {
        e.preventDefault();
        return;
      }
      if (code === 'KeyM') {
        Kit.sound.toggleMute();
        return updateMuteIcons();
      }
      if (G.mode === 'title') {
        if (code === 'Enter' || code === 'Space' || code === 'Digit1') startMatch(false);
        else if (code === 'Digit2') startMatch(true);
        else if (code === 'KeyA') cycle(0, -1);
        else if (code === 'KeyD') cycle(0, 1);
        else if (code === 'ArrowLeft') cycle(1, -1);
        else if (code === 'ArrowRight') cycle(1, 1);
        else return;
        e.preventDefault();
      } else if (G.mode === 'play') {
        if (code === 'KeyP' || code === 'Escape') pauseGame();
      } else if (G.mode === 'paused') {
        if (code === 'KeyP' || code === 'Escape' || code === 'Space' || code === 'Enter') resumeGame();
        else if (code === 'KeyQ') goTitle();
        else if (code === 'KeyT') callBuddy(0);
      } else if (G.mode === 'results') {
        if (code === 'Enter' || code === 'Space') startMatch(G.twoP);
        else if (code === 'KeyR' && G.finalTick >= 0) startReplay('results');
        else if (code === 'Escape' || code === 'KeyQ') goTitle();
      } else if (G.mode === 'celebrate') {
        if (code === 'Enter' || code === 'Space' || code === 'Escape') showResults();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (Input.setKey(e.code, false, false)) e.preventDefault();
    });
    window.addEventListener('blur', () => Input.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (!G.test) pauseGame();
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
    window.addEventListener('resize', resize);
  }

  // ---------------------------------------------------------------- start

  function init() {
    buildScene();
    const entries = Roster.list.map((e) => Object.assign({}, e));
    portraits = Kit.portraits(entries, { size: 160 });
    bindUi();
    updateMuteIcons();
    resize();
    goTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance s seconds synchronously and draw (the hidden Browser pane throttles requestAnimationFrame)
    step(s = 1) {
      G.test = true;
      const n = Math.max(1, Math.round(s * 60));
      for (let k = 0; k < n; k++) advance(TICK);
      return this.state();
    },
    // the same without drawing, except the last few frames (fast in a software-rendered test browser);
    // until(m) can stop it early
    ff(s = 1, until) {
      G.test = true;
      const n = Math.max(1, Math.round(s * 60));
      for (let k = 0; k < n; k++) {
        advance(TICK, true);
        if (until && until(G.m)) break;
      }
      for (let k = 0; k < 6; k++) advance(TICK / 6);
      return this.state();
    },
    state() {
      const m = G.m;
      if (!m) return null;
      return {
        mode: G.mode, demo: G.demo, phase: m.phase, score: m.score.slice(), target: m.target,
        ball: { x: +m.ball.x.toFixed(2), y: +m.ball.y.toFixed(2), vx: +m.ball.vx.toFixed(2), vy: +m.ball.vy.toFixed(2) },
        players: m.players.map((p) => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), state: p.state })),
        buddies: m.buddies.map((b) => ({ on: b.on, t: +b.t.toFixed(2), x: +b.x.toFixed(2), saved: b.saved, cool: +b.cool.toFixed(2), sets: b.sets })),
        fx: Fx.count(),
      };
    },
    start(o = {}) {
      G.test = true;
      Object.assign(S, o.p0 ? { p0: o.p0 } : {}, o.p1 ? { p1: o.p1 } : {}, o.level ? { level: o.level } : {}, o.target ? { target: o.target } : {}, o.speed ? { speed: o.speed } : {});
      if (o.replay != null) S.replay = o.replay;
      startMatch(!!o.twoP);
      return this.state();
    },
    title: () => goTitle(),
    // stop the real-time loop (step / ff still work), for screenshots of an exact moment
    freeze(on = true) { G.frozen = on; },
    buddy: (i = 0) => {
      VB.callBuddy(G.m, i);
      G.m.events.forEach((e) => onEvent(e, true));
      return game.state().buddies[i];
    },
    // hold inputs for a player every tick ({ left, right, up, down, hit }), or null to hand back control
    hold(i, inp) { G.forced[i] = inp; },
    press: (i, act) => Input.press(i, act),
    // stage a moment for a screenshot: place the ball and players directly
    set(o = {}) {
      const m = G.m;
      if (o.ball) Object.assign(m.ball, o.ball);
      if (o.p0) Object.assign(m.players[0], o.p0);
      if (o.p1) Object.assign(m.players[1], o.p1);
      if (o.phase) m.phase = o.phase;
      if (o.score) m.score = o.score.slice();
      return this.state();
    },
    m: () => G.m,
    G,
    three: () => ({ scene, camera, renderer }),
    soak: (n, o) => VB.cpu.soak(n, o),
    sim: (o) => VB.cpu.sim(o),
    versus: (a, b, n, o) => VB.cpu.versus(a, b, n, o),
    replay: () => startReplay('results'),
    results: () => showResults(),
  };

  try {
    init();
  } catch (err) {
    $('loading').textContent = 'Oops, this browser could not start the game (' + err.message + ')';
    throw err;
  }
})();
