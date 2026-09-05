const B = require('./tools/build_plate_water.js');
const { W, H, m } = B.readRle('tools/_plate_wall.rle');
const water = B.readRle('tools/_plate_water.rle');
const D = B.dt(W, H, water.m);
const { open, thin } = B.splitOpen(W, H, water.m, D);
const O = B.components(W, H, open);   B.classifyOpen(W, H, O.comps);
const T = B.components(W, H, thin);   B.classifyThin(W, H, T.comps, D);
const kO = new Map(), kT = new Map();
for (const c of O.comps) for (const p of c.px) kO.set(p, c);
for (const c of T.comps) for (const p of c.px) kT.set(p, c);

/* ไล่ไปตามแยงซีจากไป๋ตี้ไปทางตะวันออก */
console.log('ไล่ตามแยงซีจากไป๋ตี้ไปทางออก (หาพิกเซลน้ำที่ใกล้ที่สุดในแนวตั้ง ±25)');
for (let x = 700; x <= 1050; x += 25){
  let best = null;
  for (let dy = -25; dy <= 25; dy++){
    const y = 990 + dy, i = y*W + x;
    if (!water.m[i]) continue;
    if (!best || Math.abs(dy) < Math.abs(best.dy)) best = { dy, i, y };
  }
  if (!best){ console.log(`  x=${x}  ไม่มีหมึกน้ำ`); continue; }
  const co = kO.get(best.i), ct = kT.get(best.i);
  const where = co ? `open/${co.kind} [${co.n}px]` : (ct ? `thin/${ct.kind} [${ct.n}px ${ct.w}x${ct.h} fill ${ct.fill.toFixed(2)}]` : '?');
  console.log(`  x=${x} y=${best.y}  หนา ${D[best.i].toFixed(1)}  → ${where}`);
}
