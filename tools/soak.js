#!/usr/bin/env node
/* Headless CPU-vs-CPU match runner: plays many full matches with the real engine and CPU code (no browser) and
   checks that every match finishes and the ball never gets stuck or leaves the court.

   node tools/soak.js [matches=200]          random Easy/Normal pairings, first to 15 or 7, companions called now and then
   node tools/soak.js 20 --maxRally 0.5       proves the check can fail: every rally longer than 0.5 s is reported
   node tools/soak.js 100 --versus masher,easy   win counts: a button-masher bot against the Easy CPU
   Exits with status 1 if any match had a problem. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'js');
for (const f of ['engine.js', 'cpu.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
const VB = globalThis.VB;

const args = process.argv.slice(2);
const n = parseInt(args.find((a) => /^\d+$/.test(a)) || '200', 10);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const o = {};
if (opt('maxRally')) o.maxRally = parseFloat(opt('maxRally'));
if (opt('speed')) o.speed = parseFloat(opt('speed'));

const t0 = Date.now();
if (opt('versus')) {
  const [a, b] = opt('versus').split(',');
  console.log(VB.cpu.versus(a, b, n, o));
  console.log(VB.cpu.versus(b, a, n, o));
} else {
  const r = VB.cpu.soak(n, o);
  console.log(JSON.stringify(r, null, 2));
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s wall time`);
  process.exit(r.withProblems ? 1 : 0);
}
