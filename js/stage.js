/* The beach court: sky, sea, sand, the net, the two bouncy side walls (the ball bounces off them, like the screen
   edges in the original), palm trees, umbrellas, a sandcastle, clouds and a little boat. Everything is boxes,
   cylinders and canvas textures. VBStage.build(scene) returns { update(dt, t), flashWall(side, y) }. */
(function () {
  'use strict';
  const T = THREE;
  const { makeCanvas, toTexture, std, mesh, shade, glowTexture } = window.Kit.gfx;

  function skyTexture() {
    const [c, g] = makeCanvas(16, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#2f8fe8');
    gr.addColorStop(0.55, '#7cc8ff');
    gr.addColorStop(0.8, '#c6ecff');
    gr.addColorStop(1, '#fff3d6');
    g.fillStyle = gr;
    g.fillRect(0, 0, 16, 512);
    return toTexture(c);
  }

  function sandTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#f2d59c';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? 'rgba(190,150,90,0.22)' : v < 0.85 ? 'rgba(255,245,215,0.5)' : 'rgba(150,110,70,0.25)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const t = toTexture(c, true);
    t.repeat.set(10, 6);
    return t;
  }

  function seaTexture() {
    const [c, g] = makeCanvas(256, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#1d8fd6');
    gr.addColorStop(1, '#3fd0e0');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    for (let y = 12; y < 256; y += 22) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 4 + y) * 3);
      g.stroke();
    }
    const t = toTexture(c, true);
    t.repeat.set(8, 2);
    return t;
  }

  // a net: white cords on transparent
  function netTexture(cell, line, color = 'rgba(255,255,255,0.95)') {
    const [c, g] = makeCanvas(64, 64);
    g.strokeStyle = color;
    g.lineWidth = line;
    for (let i = 0; i <= 64; i += cell) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
    }
    return toTexture(c, true);
  }

  function stripeTexture(a, b) {
    const [c, g] = makeCanvas(32, 128);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.fillRect(0, i * 16, 32, 16);
    }
    return toTexture(c, true);
  }

  function cloudTexture() {
    const [c, g] = makeCanvas(256, 128);
    g.fillStyle = '#ffffff';
    for (const [x, y, r] of [[70, 80, 38], [120, 60, 50], [175, 78, 40], [105, 92, 34], [150, 95, 30]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return toTexture(c);
  }

  function palm(scene, x, z, s, lean) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    scene.add(g);
    const bark = std('#9c6b3c'), bark2 = std('#b5824e'), leaf = std('#2fae4f'), leaf2 = std('#23913f'), nut = std('#6b4a2a');
    let px = 0, py = 0;
    for (let i = 0; i < 9; i++) {
      const seg = mesh(new T.CylinderGeometry(0.2 - i * 0.008, 0.24 - i * 0.008, 0.62, 7), i % 2 ? bark : bark2, px, py + 0.31, 0, g);
      seg.rotation.z = -lean * (i / 9);
      px += Math.sin(lean * (i / 9)) * 0.62;
      py += Math.cos(lean * (i / 9)) * 0.6;
    }
    const top = new T.Group();
    top.position.set(px, py, 0);
    g.add(top);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const fr = new T.Group();
      fr.rotation.y = a;
      top.add(fr);
      const l = mesh(new T.BoxGeometry(2.2, 0.06, 0.55), i % 2 ? leaf : leaf2, 1.0, -0.15, 0, fr);
      l.rotation.z = -0.45;
    }
    for (let i = 0; i < 3; i++) mesh(new T.SphereGeometry(0.16, 8, 6), nut, Math.cos(i * 2.1) * 0.22, -0.2, Math.sin(i * 2.1) * 0.22, top);
    return g;
  }

  function umbrella(scene, x, z, colA, colB) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    mesh(new T.CylinderGeometry(0.05, 0.05, 2.6, 6), std('#f4f4f4'), 0, 1.3, 0, g);
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const geo = new T.ConeGeometry(1.6, 0.6, segs, 1, true, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs);
      const m = mesh(geo, std(i % 2 ? colA : colB, { side: T.DoubleSide }), 0, 2.75, 0, g);
      m.castShadow = true;
    }
    // a towel
    const towel = mesh(new T.BoxGeometry(1.0, 0.03, 1.9), std(colB), 0.9, 0.02, 0.4, g, false);
    towel.rotation.y = 0.3;
    return g;
  }

  function sandcastle(scene, x, z) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    const sand = std('#e3bf7c'), dark = std('#c99f5c');
    mesh(new T.BoxGeometry(1.1, 0.4, 0.7), sand, 0, 0.2, 0, g);
    for (const [dx, h] of [[-0.45, 0.75], [0.45, 0.75], [0, 0.95]]) {
      mesh(new T.CylinderGeometry(0.18, 0.2, h, 8), sand, dx, h / 2, 0, g);
      mesh(new T.ConeGeometry(0.22, 0.25, 8), dark, dx, h + 0.12, 0, g);
    }
    mesh(new T.BoxGeometry(0.02, 0.3, 0.02), std('#666'), 0, 1.25, 0, g);
    mesh(new T.BoxGeometry(0.22, 0.13, 0.01), std('#ff3d7f'), 0.11, 1.33, 0, g);
    // a bucket
    mesh(new T.CylinderGeometry(0.17, 0.13, 0.3, 10), std('#18b4ff'), 0.85, 0.15, 0.25, g);
    return g;
  }

  function boat(scene) {
    const g = new T.Group();
    g.position.set(-14, 0.05, -40);
    scene.add(g);
    mesh(new T.BoxGeometry(2.4, 0.5, 0.8), std('#ffffff'), 0, 0.25, 0, g, false);
    mesh(new T.BoxGeometry(0.06, 2.0, 0.06), std('#8a6a4a'), 0, 1.4, 0, g, false);
    const sail = new T.Mesh(new T.BufferGeometry().setFromPoints([new T.Vector3(0.05, 0.6, 0), new T.Vector3(0.05, 2.3, 0), new T.Vector3(1.0, 0.6, 0)]), std('#ff5a5a', { side: T.DoubleSide }));
    sail.geometry.computeVertexNormals();
    g.add(sail);
    return g;
  }

  function build(scene, C) {
    scene.background = skyTexture();
    scene.fog = new T.Fog('#cfefff', 40, 120);
    const half = C.W / 2;

    // sand and sea
    const sand = mesh(new T.PlaneGeometry(120, 34), std('#ffffff', { map: sandTexture(), roughness: 1 }), 0, 0, -6, scene, false);
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    const seaTex = seaTexture();
    const sea = mesh(new T.PlaneGeometry(260, 120), new T.MeshBasicMaterial({ map: seaTex }), 0, -0.05, -82, scene, false);
    sea.rotation.x = -Math.PI / 2;
    // foam where the sea meets the sand
    const foam = mesh(new T.PlaneGeometry(260, 1.2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }), 0, 0.01, -22.6, scene, false);
    foam.rotation.x = -Math.PI / 2;

    // court lines
    const lineMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
    const line = (w, d, x, z) => {
      const l = mesh(new T.PlaneGeometry(w, d), lineMat, x, 0.012, z, scene, false);
      l.rotation.x = -Math.PI / 2;
    };
    line(C.W, 0.1, 0, 1.6);
    line(C.W, 0.1, 0, -1.6);
    line(0.1, 3.2, 0, 0);

    // the net: striped posts, a mesh panel down to the sand, a white tape on top
    const postMat = std('#ffffff', { map: stripeTexture('#ff4b5c', '#ffffff') });
    // only the far post: a near one would stand right in front of the net strip below
    mesh(new T.CylinderGeometry(0.09, 0.11, C.NET_H + 0.5, 10), postMat, 0, (C.NET_H + 0.5) / 2, -1.75, scene);
    const netTex = netTexture(8, 2);
    netTex.repeat.set(14, 11);
    const net = mesh(new T.PlaneGeometry(3.5, C.NET_H - 0.12), new T.MeshBasicMaterial({ map: netTex, transparent: true, side: T.DoubleSide, depthWrite: false }), 0, (C.NET_H - 0.12) / 2, 0, scene, false);
    net.rotation.y = Math.PI / 2;
    mesh(new T.BoxGeometry(0.1, 0.16, 3.5), std('#ffffff', { roughness: 0.5 }), 0, C.NET_H - 0.08, 0, scene);
    mesh(new T.BoxGeometry(0.08, 0.5, 3.5), std('#ffd400'), 0, 0.25, 0, scene);
    // the camera sees that net edge-on, so the game's net is also drawn as a narrow strip facing us, like the
    // pole in the original: a mesh panel the width of the post the ball bounces off, with a white tape cap
    const sideTex = netTexture(8, 3);
    sideTex.repeat.set(1.5, 11);
    const strip = mesh(new T.PlaneGeometry(C.NW * 2 + 0.24, C.NET_H - 0.14), new T.MeshBasicMaterial({ map: sideTex, color: '#ffffff', transparent: true, side: T.DoubleSide, depthWrite: false }), 0, (C.NET_H - 0.14) / 2, 0.02, scene, false);
    const back = mesh(new T.PlaneGeometry(C.NW * 2 + 0.24, C.NET_H - 0.14), new T.MeshBasicMaterial({ color: '#1d3557', transparent: true, opacity: 0.35, depthWrite: false }), 0, (C.NET_H - 0.14) / 2, -0.02, scene, false);
    back.renderOrder = 1;
    strip.renderOrder = 2;
    const edge = std('#e8e8e8', { roughness: 0.6 });
    for (const sx of [-1, 1]) mesh(new T.BoxGeometry(0.05, C.NET_H, 0.05), edge, sx * (C.NW + 0.12), C.NET_H / 2, 0, scene);
    mesh(new T.BoxGeometry(C.NW * 2 + 0.36, 0.2, 0.3), std('#ffffff', { roughness: 0.4 }), 0, C.NET_H - 0.06, 0, scene);
    mesh(new T.BoxGeometry(C.NW * 2 + 0.3, 0.35, 0.26), std('#ffd400'), 0, 0.17, 0, scene);
    // a little shadow line under the net
    const ns = mesh(new T.PlaneGeometry(0.5, 3.6), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.12 }), 0.15, 0.011, 0, scene, false);
    ns.rotation.x = -Math.PI / 2;

    // the side walls: tall inflatable posts with a see-through net between them
    const wallH = C.CEIL + C.R + 0.4;
    const walls = [];
    for (const side of [-1, 1]) {
      const col = side < 0 ? '#3d8bff' : '#ff4b5c';
      const pm = std('#ffffff', { map: stripeTexture(col, '#ffffff'), roughness: 0.45 });
      pm.map.repeat.set(1, 4);
      for (const z of [-1.75, 1.75]) {
        mesh(new T.CylinderGeometry(0.22, 0.26, wallH, 12), pm, side * (half + 0.24), wallH / 2, z, scene);
        mesh(new T.SphereGeometry(0.3, 12, 8), std('#ffd400', { roughness: 0.4 }), side * (half + 0.24), wallH + 0.1, z, scene);
      }
      const wt = netTexture(16, 2, 'rgba(255,255,255,0.7)');
      wt.repeat.set(3.5, 8);
      const panel = mesh(new T.PlaneGeometry(3.5, wallH), new T.MeshBasicMaterial({ map: wt, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }), side * (half + 0.24), wallH / 2, 0, scene, false);
      panel.rotation.y = Math.PI / 2;
      // a glow that flashes where the ball hits
      const flash = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: col, transparent: true, depthWrite: false, opacity: 0, blending: T.AdditiveBlending }));
      flash.position.set(side * (half + 0.2), 3, 0.3);
      flash.scale.set(2.4, 2.4, 1);
      scene.add(flash);
      walls.push({ panel, flash, t: 9 });
      // a soft bumper rail along the bottom
      mesh(new T.BoxGeometry(0.3, 0.45, 3.5), std(col, { roughness: 0.5 }), side * (half + 0.24), 0.22, 0, scene);
    }

    // scenery
    palm(scene, -10.6, -3.2, 1.25, 0.35);
    palm(scene, 10.8, -2.6, 1.15, -0.4);
    palm(scene, -13.5, -8, 1.4, -0.25);
    palm(scene, 14, -9, 1.5, 0.3);
    umbrella(scene, -5.2, -7.5, '#ff3d7f', '#ffffff');
    umbrella(scene, 6.3, -8.5, '#18b4ff', '#ffd400');
    sandcastle(scene, -9.4, 2.2);
    const bt = boat(scene);

    // sun and clouds
    const sun = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: '#fff2b0', transparent: true, depthWrite: false, fog: false }));
    sun.position.set(-26, 26, -70);
    sun.scale.set(22, 22, 1);
    scene.add(sun);
    const sunCore = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, depthWrite: false, fog: false }));
    sunCore.position.copy(sun.position);
    sunCore.scale.set(9, 9, 1);
    scene.add(sunCore);
    const cloudTex = cloudTexture();
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.92, fog: false }));
      s.position.set(-40 + i * 16 + Math.random() * 6, 14 + Math.random() * 10, -60 - Math.random() * 15);
      const k = 8 + Math.random() * 6;
      s.scale.set(k, k / 2, 1);
      scene.add(s);
      clouds.push(s);
    }

    function update(dt, t) {
      seaTex.offset.x = (t * 0.01) % 1;
      seaTex.offset.y = Math.sin(t * 0.5) * 0.02;
      foam.material.opacity = 0.6 + Math.sin(t * 1.3) * 0.25;
      for (const c of clouds) {
        c.position.x += dt * 0.6;
        if (c.position.x > 50) c.position.x = -50;
      }
      bt.position.x = -14 + Math.sin(t * 0.05) * 10;
      bt.rotation.z = Math.sin(t * 1.2) * 0.04;
      for (const w of walls) {
        w.t += dt;
        w.flash.material.opacity = Math.max(0, 0.9 - w.t * 2.5);
      }
    }

    function flashWall(side, y) {
      const w = walls[side < 0 ? 0 : 1];
      w.t = 0;
      w.flash.position.y = y;
    }

    return { update, flashWall };
  }

  window.VBStage = { build };
})();
