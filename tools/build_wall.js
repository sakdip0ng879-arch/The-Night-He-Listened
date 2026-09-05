/* ✅ **กลับมาใช้แล้ว 2026-09-05** — ไฟล์นี้เคยถูกติดป้าย ⛔ ตอนปิดโครงการรอบแรก
 *   แต่ **ติดผิดตัว**: มันไม่เคยพึ่ง Natural Earth หรือ TPS เลยสักบรรทัด
 *   มันลอก **หมึกเทาของแผ่นเอง** (bordermask ค่า '2') ซึ่งเป็นวิธีเดียวกับที่
 *   โครงการรอบใหม่ใช้กับชั้นน้ำทุกประการ · ตอนนั้นมันโดนกวาดไปพร้อมกันเพราะ
 *   อยู่ในกองเดียวกัน ไม่ใช่เพราะเหตุผลของมันเอง
 *
 * ★ บทเรียน: **ตอนปิดโครงการ ให้ปิดทีละเหตุผล ไม่ใช่ทีละกอง**
 *   ของที่ถูกกวาดไปด้วยจะกลับมายากกว่าที่ควร เพราะป้ายบอกเหตุผลผิด
 *
 * เจ้าของสั่งทำ: *"กำแพงเมืองจีน ในเมื่อวาดใหม่เองแล้ว คิดว่านายต้องวาดกำแพงนั่นด้วยแล้วล่ะ"*
 */
/* build_wall.js — กำแพงเมืองจีนจากหมึกเทาของแผ่น → data/wall.js
 *
 *   node tools/build_wall.js
 *
 * ★ ไม่มีข้อมูลใหม่แม้แต่จุดเดียว — `bordermask.js` เก็บช่องหมึกเทาไว้แล้ว 1,526 ช่อง
 *   ในค่า '2' (สกัดโดย tools/bordermask.ps1 ตั้งแต่ 2026-08-26) และ `build_geo.js`
 *   ใช้มันเป็นกำแพงกั้นการระบายสีมาตลอด · ไฟล์นี้แค่แปลง "ช่อง" เป็น "เส้น" เพื่อวาด
 *   (DECISIONS §15 "ห้ามสร้างข้อมูลใหม่ ต้องคำนวณจากสิ่งที่ตัวตรวจคุมอยู่แล้ว")
 *
 * วิธี: ก้อนต่อเนื่อง 8 ทิศ → หาปลายสองข้างด้วยระยะไกลสุดสองรอบ (double sweep)
 *       → เดินจากปลายหนึ่งไปอีกปลายแบบเพื่อนบ้านใกล้สุด → ลดจุดด้วย Douglas–Peucker
 *
 * ⚠ ก้อนเล็กกว่า MIN_CELLS ทิ้ง — หมึกเทามีเศษกระจายจากตัวหนังสือกับกรอบแผ่น
 */
const path = require('path'), fs = require('fs');
global.window = global;
require(path.join(__dirname, '..', 'data', 'bordermask.js'));

const BM = window.TK.bordermask;
const CELL = BM.cell, W = BM.w, H = BM.h;
const Y_MAX = 420;             /* กำแพงอยู่แถบเหนือเท่านั้น — ดูคอมเมนต์ตอนอ่านช่อง */
const MIN_CELLS = 12;          /* ก้อนสั้นกว่านี้คือเศษหมึก ไม่ใช่กำแพง */
const EPS = 3.2;               /* Douglas–Peucker เป็นหน่วยแผนที่ */

/* ── อ่านช่องหมึกเทา ── */
const grid = new Set();
for (let y = 0; y < H; y++){
  const row = BM.rows[y];
  /* ⚠ หมึกเทาไม่ได้มีแต่กำแพง — วัดแล้วมีเศษที่ y 500–899 (127 ช่อง) และ
     y 1700–1799 (57 ช่อง) ซึ่งเป็นกรอบแผ่นกับหมึกเทาอื่น ไม่ใช่ชายแดนเหนือ
     `build_geo.js` เจอเรื่องเดียวกันและจำกัดแถบ y ไว้เหมือนกัน (DECISIONS §16) */
  if (y * CELL >= Y_MAX) continue;
  for (let x = 0; x < W; x++) if (row[x] === '2') grid.add(y * W + x);
}
console.log(`ช่องหมึกเทา ${grid.size} ช่อง`);

/* ── ก้อนต่อเนื่อง 8 ทิศ ── */
const N8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const seen = new Set(), blobs = [];
for (const key of grid){
  if (seen.has(key)) continue;
  const stack = [key], cells = [];
  seen.add(key);
  while (stack.length){
    const k = stack.pop(); cells.push(k);
    const x = k % W, y = (k - x) / W;
    for (const [dx,dy] of N8){
      const nx = x+dx, ny = y+dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      const nk = ny*W+nx;
      if (grid.has(nk) && !seen.has(nk)){ seen.add(nk); stack.push(nk); }
    }
  }
  if (cells.length >= MIN_CELLS) blobs.push(cells);
}
console.log(`ก้อนที่ยาวพอ ${blobs.length} ก้อน (ทิ้งเศษ ${blobs.length ? '' : ''}...)`);

/* ── เดินจากปลายหนึ่งไปอีกปลาย ── */
const pt = k => { const x = k % W, y = (k - x) / W; return [x*CELL + CELL/2, y*CELL + CELL/2]; };
const d2 = (a,b) => (a[0]-b[0])**2 + (a[1]-b[1])**2;

function farthest(cells, from){
  let best = cells[0], bd = -1;
  for (const c of cells){ const dd = d2(pt(c), pt(from)); if (dd > bd){ bd = dd; best = c; } }
  return best;
}
function order(cells){
  const a = farthest(cells, cells[0]);          /* double sweep หาปลายจริง */
  const start = farthest(cells, a);
  const left = new Set(cells);
  let cur = start; left.delete(cur);
  const out = [cur];
  while (left.size){
    let best = null, bd = Infinity;
    for (const c of left){ const dd = d2(pt(c), pt(cur)); if (dd < bd){ bd = dd; best = c; } }
    /* กระโดดไกลเกินสามช่อง = คนละแขน ตัดจบตรงนี้ ปล่อยที่เหลือเป็นก้อนใหม่ */
    if (bd > (CELL*3.2)**2) break;
    out.push(best); left.delete(best); cur = best;
  }
  return { line: out.map(pt), rest: [...left] };
}

/* ── Douglas–Peucker ── */
function dp(pts, eps){
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length-1]];
  let idx = -1, max = -1;
  const dx = b[0]-a[0], dy = b[1]-a[1], len = Math.hypot(dx,dy) || 1;
  for (let i = 1; i < pts.length-1; i++){
    const p = pts[i];
    const dist = Math.abs(dy*p[0] - dx*p[1] + b[0]*a[1] - b[1]*a[0]) / len;
    if (dist > max){ max = dist; idx = i; }
  }
  if (max <= eps) return [a, b];
  return dp(pts.slice(0, idx+1), eps).slice(0, -1).concat(dp(pts.slice(idx), eps));
}

const lines = [];
for (const blob of blobs){
  let queue = [blob];
  while (queue.length){
    const cells = queue.pop();
    if (cells.length < MIN_CELLS) continue;
    const { line, rest } = order(cells);
    if (line.length >= 4) lines.push(dp(line, EPS));
    if (rest.length >= MIN_CELLS) queue.push(rest);
  }
}
lines.sort((a,b) => b.length - a.length);
const pts = lines.reduce((s,l) => s + l.length, 0);
console.log(`เส้นกำแพง ${lines.length} เส้น · ${pts} จุดหลังลดจุด`);
lines.slice(0,6).forEach((l,i) =>
  console.log(`  #${i+1} ${l.length} จุด · x ${Math.min(...l.map(p=>p[0])).toFixed(0)}–${Math.max(...l.map(p=>p[0])).toFixed(0)}`));

const body = lines.map(l =>
  '  [' + l.map(p => `[${p[0].toFixed(0)},${p[1].toFixed(0)}]`).join(',') + ']').join(',\n');

fs.writeFileSync(path.join(__dirname, '..', 'data', 'wall.js'),
`/* wall.js — สร้างโดย tools/build_wall.js ห้ามแก้ด้วยมือ
 * กำแพงเมืองจีน · พิกัดพิกเซลบน assets/map.jpg (1650x1950) เหมือนทุกอย่างในโปรเจกต์
 * ★ ที่มา: หมึกเทาค่า '2' ใน data/bordermask.js — **ไม่ใช่ข้อมูลใหม่**
 *   มันคือชุดเดียวกับที่ build_geo.js ใช้เป็นกำแพงกั้นสีมาตั้งแต่ 2026-08-26
 */
window.TK = window.TK || {};
window.TK.wall = [
${body}
];
`, 'utf8');
console.log('เขียน data/wall.js แล้ว');
