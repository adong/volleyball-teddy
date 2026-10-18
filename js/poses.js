/* Volleyball poses on top of the kit's Kit.people.pose: the ready crouch, the spike swing, the dive, lying on the
   sand after a dive, a bump for the companion's sets, the "aww" after losing, and a hop for cheering.
   Kit.people.pose only drives the arms, legs, lean and head; these also tip the whole body (rig.rotation.x) and
   lower it (rig.position.y), so every call eases those back too. Kit candidates: ready, spike, dive, lie, bump, aww. */
(function () {
  'use strict';
  const People = window.Kit.people;
  const RIG_Y = 0.55; // where Kit.people.build puts the rig

  const ease = (o, prop, v, k) => { o[prop] += (v - o[prop]) * k; };

  // pose(p, mode, ph, k, o): mode is one of the kit's modes or one of ours; ph drives cycles; k in 0..1 eases.
  // o.arm: which arm swings for a spike (1 right, -1 left), o.t: time in this pose (for swings).
  function pose(p, mode, ph, k, o = {}) {
    let rigRot = 0, rigY = RIG_Y;
    const arm = o.arm || 1;
    const A = arm > 0 ? p.armR : p.armL, B = arm > 0 ? p.armL : p.armR;
    switch (mode) {
      case 'ready': {
        // knees bent, arms forward and low, ready to bump
        People.pose(p, ph, 'idle', k);
        ease(p.legL.rotation, 'x', 0.42, k);
        ease(p.legR.rotation, 'x', -0.12, k);
        for (const a of [p.armL, p.armR]) {
          ease(a.rotation, 'x', 0.75 + Math.sin(ph) * 0.05, k);
          ease(a.rotation, 'z', 0, k);
        }
        p.armL.rotation.z += (0.12 - p.armL.rotation.z) * k;
        p.armR.rotation.z += (-0.12 - p.armR.rotation.z) * k;
        ease(p.hips.rotation, 'x', -0.3, k);
        rigY = RIG_Y - 0.07 + Math.sin(ph * 2) * 0.015;
        break;
      }
      case 'spike': {
        // the hitting arm cocks back over the head, then whips forward; the other arm points at the ball
        People.pose(p, ph, 'jump', k);
        const t = o.t || 0;
        const swing = t < 0.07 ? 3.7 : t < 0.2 ? 3.7 - ((t - 0.07) / 0.13) * 2.6 : 1.1;
        A.rotation.x += (swing - A.rotation.x) * Math.max(k, 0.6);
        A.rotation.z += (0 - A.rotation.z) * k;
        ease(B.rotation, 'x', 2.4, k);
        ease(p.hips.rotation, 'x', t < 0.07 ? 0.25 : -0.45, Math.max(k, 0.5));
        ease(p.legL.rotation, 'x', 0.5, k);
        ease(p.legR.rotation, 'x', -0.6, k);
        break;
      }
      case 'jumpshot':
        // Teddy's spike is his basketball jump shot: both hands up, then a flick
        People.pose(p, ph, 'jumpshot', k);
        if ((o.t || 0) > 0.12) {
          ease(p.armL.rotation, 'x', 2.0, 0.5);
          ease(p.armR.rotation, 'x', 2.1, 0.5);
        }
        break;
      case 'dive':
      case 'lie': {
        // flying flat, arms out in front; then on the sand
        People.pose(p, ph, 'idle', k);
        for (const a of [p.armL, p.armR]) ease(a.rotation, 'x', 2.95, k);
        ease(p.armL.rotation, 'z', -0.15, k);
        ease(p.armR.rotation, 'z', 0.15, k);
        ease(p.legL.rotation, 'x', mode === 'dive' ? -0.25 : 0.05, k);
        ease(p.legR.rotation, 'x', mode === 'dive' ? 0.15 : -0.05, k);
        ease(p.head.rotation, 'x', -0.6, k);
        ease(p.hips.rotation, 'x', 0, k);
        rigRot = -1.4;
        rigY = mode === 'dive' ? 0.42 : 0.3;
        break;
      }
      case 'bump':
        // the companion's set: arms together, straight out in front, knees springing
        People.pose(p, ph, 'idle', k);
        for (const a of [p.armL, p.armR]) ease(a.rotation, 'x', 1.25, k);
        ease(p.armL.rotation, 'z', -0.2, k);
        ease(p.armR.rotation, 'z', 0.2, k);
        ease(p.hips.rotation, 'x', -0.15, k);
        break;
      case 'cheer':
        // both fists up
        People.pose(p, ph, 'jump', k);
        ease(p.armL.rotation, 'x', 2.9, k);
        ease(p.armR.rotation, 'x', 2.9, k);
        ease(p.armL.rotation, 'z', -0.45, k);
        ease(p.armR.rotation, 'z', 0.45, k);
        ease(p.legL.rotation, 'x', 0.3, k);
        ease(p.legR.rotation, 'x', -0.1, k);
        break;
      case 'aww':
        // a gentle "aww": head down, arms hanging
        People.pose(p, ph, 'idle', k);
        ease(p.head.rotation, 'x', 0.55, k);
        ease(p.hips.rotation, 'x', -0.22, k);
        for (const a of [p.armL, p.armR]) ease(a.rotation, 'x', 0.1, k);
        rigY = RIG_Y - 0.03;
        break;
      default:
        People.pose(p, ph, mode, k);
    }
    ease(p.rig.rotation, 'x', rigRot, Math.max(k, 0.25));
    ease(p.rig.position, 'y', rigY, Math.max(k, 0.25));
  }

  window.VBPose = { pose };
})();
