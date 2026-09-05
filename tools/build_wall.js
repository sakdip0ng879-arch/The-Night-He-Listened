/* build_wall.js — กำแพงเมืองจีนจากหมึกของแผ่นเอง → data/wall.js
 *
 *   powershell -File toolsplate_ink.ps1     (สกัด _plate_wall.rle)
 *   node tools/build_wall.js                 (แปลงเป็นเส้น)
 *
 * ส่ง : data/wall.js  พิกัดแผ่น 1650×1950 ชุดเดิม (กฎ 4)
 *
 * ── ⚠⚠ สามอย่างที่เข้าใจผิดก่อนจะได้กำแพงที่ใช้ได้ (2026-09-05) ──────────────
 * เจ้าของ: *"กำแพงเมืองจีนมันเละมากเลย"* — และมันเละด้วยเหตุผลคนละชั้นกันสามเรื่อง
 *
 * **1 · แหล่งข้อมูลหยาบเกิน** รอบแรกอ่านจาก `data/bordermask.js` ซึ่งเป็นตาราง
 *   ช่องละ 5 หน่วย แล้วเรียงจุดด้วย "เพื่อนบ้านใกล้สุด" → ได้ขั้นบันได 5 หน่วย
 *   วกไปวกมาตรงที่กำแพงหนาสองช่อง และแตกเป็น 28 ท่อน
 *   ★ **ความละเอียดของแหล่งข้อมูลเป็นเพดานของความเนียน** ไม่มีการเกลี่ยแบบไหน
 *     กู้รายละเอียดที่ถูกทิ้งตอนย่อกลับมาได้
 *
 * **2 · สีผิดตัว** ยกเกณฑ์ "เทาอมน้ำตาล" มาจาก `bordermask.ps1` ตรง ๆ
 *   แล้วได้ **เส้นประเขตแดน** มาแทน (เส้นน้ำตาลที่ลากรอบแดนฮั่น/วุ่ย/ง่อ ยาวลงไปถึง y 1726)
 *   ครอปแผ่นดูของจริงถึงรู้ว่ากำแพงเป็น **เทากลาง R≈G≈B ราว 125–195**
 *   ★ `bordermask` รอดมาได้เพราะมันมี `Y_MAX = 420` ตัดทุกอย่างใต้แถบเหนือทิ้ง
 *     — ตัวกรองที่บังเอิญถูก ไม่ใช่เกณฑ์ที่ถูก
 *
 * **3 · กรองด้วยความหนาไม่ได้** กำแพงวาดเป็น *เส้นขอบ* ของริบบิ้นใบเสมา ข้างในขาว
 *   หมึกจึงหนาแค่ 2–3 px เท่ากับขอบฟันของตัวหนังสือเป๊ะ · ลองกรองที่ความหนา >= 2.5
 *   แล้วเหลือ **5 px ทั้งแผ่น** ฆ่ากำแพงเกลี้ยง
 *   ★ ที่ใช้ได้คือ **ขนาดก้อน**: ก้อนกำแพง 6 ก้อน 1,109–5,284 px · เศษถัดไป 275 px
 *
 * ── ท่อที่ใช้จริง (ชุดเดียวกับชั้นน้ำ) ──────────────────────────────────────
 *   คัดก้อนใหญ่ → ถมข้างในริบบิ้นให้ทึบ → thinning → กราฟ → ตัดหนวด
 *   → ลดเหลี่ยมด้วย Chaikin → ลดจุด → เย็บท่อนที่ต่อกันได้
 *
 * ★ ไม่มีข้อมูลใหม่แม้แต่จุดเดียว — ทุกจุดมาจากหมึกที่แผ่นพิมพ์ไว้เอง */
const path = require('path'), fs = require('fs');
const B = require('./build_plate_water.js');

const SRC = path.join(__dirname, '_plate_wall.rle');
if (!fs.existsSync(SRC)){
  console.error('ไม่เจอ ' + SRC + '\nรัน  powershell -File tools\\plate_ink.ps1  ก่อน');
  process.exit(1);
}

const MIN_BLOB = 800;    /* ★ วัดแล้ว: ก้อนกำแพง 1,109–5,284 px · เศษถัดไป 275 px — ช่องว่างกว้างพอ */
const PRUNE    = 18;     /* หนวดสั้นกว่านี้คือรอยหยักของหมึก */
const CHAIKIN  = 2;      /* รอบการลดเหลี่ยม — 2 พอ ถ้ามากกว่านี้มุมจริงของกำแพงจะมน */
const EPS      = 2.2;    /* Douglas–Peucker หน่วยแผ่น */
const JOIN_MAX = 22;     /* ปลายสองอันห่างไม่เกินนี้และหันเข้าหากัน → เย็บเป็นเส้นเดียว */
const MIN_LEN  = 45;     /* เส้นสั้นกว่านี้ทิ้ง — กำแพงไม่มีท่อนยาว 45 หน่วยที่ลอยเดี่ยว */

const { W, H, m } = B.readRle(SRC);
let ink = 0; for (let i = 0; i < W*H; i++) if (m[i]) ink++;
console.log(`หมึกกำแพง ${ink.toLocaleString()} px`);

/* ── ★★ เชื่อมรอยฟันเสมาก่อน แล้วค่อยหาแกน ─────────────────────────────
   ⚠ แผ่นวาดกำแพงเป็น **รอยขาด ๆ** (ฟันเสมาเรียงกัน) ไม่ใช่เส้นทึบเส้นเดียว
     หมึกกำแพง 9,401 px จึงแตกเป็น **423 ก้อน** และมีแค่ 3 ก้อนที่ใหญ่กว่า 150 px
     — กรองด้วยขนาดก้อนตรง ๆ จึงได้กำแพงมาแค่ 2 ท่อน ยาวรวม 200 หน่วย จากของจริง ~1,500
   ที่ถูกคือ **ขยายให้ฟันติดกันเป็นแถบก่อน** แล้วค่อยหาแกนกลางของแถบนั้น
   (นี่คือเหตุผลที่ bordermask ตารางช่องละ 5 หน่วย "ได้กำแพง" มาตั้งแต่แรก —
    การหยาบของมันไปเชื่อมฟันให้เองโดยบังเอิญ แต่แลกมาด้วยขั้นบันได)          */
/* ★ ขั้นที่ 1 — คัดก้อนของกำแพงออกจากเศษหมึก
   ⚠ **ห้ามคัดด้วยความหนา** — กำแพงบนแผ่นวาดเป็น *เส้นขอบ* ของริบบิ้นใบเสมา
     ข้างในเป็นสีขาว หมึกจึงหนาแค่ 2–3 px เท่ากับขอบฟันของตัวหนังสือเป๊ะ
     (ลองกรองที่ความหนา >= 2.5 แล้วเหลือ **5 px ทั้งแผ่น** — ฆ่ากำแพงเกลี้ยง)
   ที่ใช้ได้คือ **ขนาดก้อน** — วัดแล้วแยกกันขาด:
     ก้อนของกำแพง 6 ก้อน  1,109–5,284 px  ด้านยาว 108–643 หน่วย  (อยู่ในแถบเหนือทั้งหมด)
     เศษถัดไป              275 px และเล็กลงเรื่อย ๆ                                    */
const raw0 = B.components(W, H, m);
const core = new Uint8Array(W*H);
let nBlob = 0, dropped = 0;
for (const c of raw0.comps){
  if (c.n < MIN_BLOB){ dropped++; continue; }
  nBlob++;
  for (const p of c.px) core[p] = 1;
}
console.log(`ก้อนของกำแพง ${nBlob} ก้อน · ทิ้งเศษหมึก ${dropped} ก้อน`);

/* ★ ขั้นที่ 2 — ถมข้างในริบบิ้นให้ทึบ แล้วค่อยหาแกน
   ขอบสองข้างห่างกัน ~6 หน่วย · ขยาย 4 หน่วยก็ชนกันตรงกลางพอดี กลายเป็นแถบทึบ
   แกนของแถบทึบคือแนวกำแพง — ส่วนแกนของ *เส้นขอบ* จะเป็นบันไดสองราง ใช้ไม่ได้   */
const DILATE = 4;
const inv = new Uint8Array(W*H);
for (let i = 0; i < W*H; i++) inv[i] = core[i] ? 0 : 1;
const dW = B.dt(W, H, inv);
const keep = new Uint8Array(W*H);
for (let i = 0; i < W*H; i++) if (core[i] || dW[i] <= DILATE) keep[i] = 1;

/* ── โครงกระดูก → เส้น ───────────────────────────────────────────────── */
const sk = B.thin(W, H, keep);
const raw = B.skeletonLines(W, H, sk);
const kept = B.prune(raw, PRUNE);
console.log(`ช่วงดิบ ${raw.length} · ตัดหนวดแล้ว ${kept.length}`);

/* ── Chaikin: ลดเหลี่ยมโดยไม่ขยับเส้นออกจากที่ของมัน ────────────────────
   ทุกท่อนถูกแทนด้วยจุด 1/4 กับ 3/4 ของมัน — มุมฉากกลายเป็นมุมมน
   ⚠ ปลายทั้งสองข้างต้องอยู่กับที่ ไม่งั้นรอยต่อระหว่างท่อนจะหลุดจากกัน     */
function chaikin(pts, rounds){
  let out = pts;
  for (let r = 0; r < rounds; r++){
    if (out.length < 3) break;
    const next = [out[0]];
    for (let i = 0; i + 1 < out.length; i++){
      const [ax, ay] = out[i], [bx, by] = out[i+1];
      next.push([ax*0.75 + bx*0.25, ay*0.75 + by*0.25]);
      next.push([ax*0.25 + bx*0.75, ay*0.25 + by*0.75]);
    }
    next.push(out[out.length-1]);
    out = next;
  }
  return out;
}

let lines = kept
  .map(chain => B.dp(chaikin(chain.map(i => [i % W, (i / W) | 0]), CHAIKIN), EPS))
  .filter(l => l.length >= 2);

/* ── เย็บท่อนที่ต่อกันได้ ─────────────────────────────────────────────── */
const arc = l => { let a = 0; for (let i = 1; i < l.length; i++) a += Math.hypot(l[i][0]-l[i-1][0], l[i][1]-l[i-1][1]); return a; };
const tan = (l, atEnd) => {
  const [p, q] = atEnd ? [l[l.length-1], l[l.length-2]] : [l[0], l[1]];
  const d = Math.hypot(p[0]-q[0], p[1]-q[1]) || 1;
  return [(p[0]-q[0])/d, (p[1]-q[1])/d];
};
let joined = 0;
for (let pass = 0; pass < 6; pass++){
  let best = null;
  for (let i = 0; i < lines.length; i++) for (let j = i+1; j < lines.length; j++){
    for (const ei of [0, 1]) for (const ej of [0, 1]){
      const A = ei ? lines[i][lines[i].length-1] : lines[i][0];
      const Bp = ej ? lines[j][lines[j].length-1] : lines[j][0];
      const dx = Bp[0]-A[0], dy = Bp[1]-A[1], d = Math.hypot(dx, dy);
      if (d > JOIN_MAX || d < 0.01) continue;
      const ua = tan(lines[i], ei), ub = tan(lines[j], ej);
      const nx = dx/d, ny = dy/d;
      /* ปลาย i ต้องชี้ไปหา j และปลาย j ต้องชี้กลับมาหา i */
      if (ua[0]*nx + ua[1]*ny < 0.25) continue;
      if (ub[0]*-nx + ub[1]*-ny < 0.25) continue;
      if (!best || d < best.d) best = { i, j, ei, ej, d };
    }
  }
  if (!best) break;
  const a = best.ei ? lines[best.i] : [...lines[best.i]].reverse();
  const b = best.ej ? [...lines[best.j]].reverse() : lines[best.j];
  lines[best.i] = a.concat(b);
  lines.splice(best.j, 1);
  joined++;
}
lines = lines.filter(l => arc(l) >= MIN_LEN);
lines.sort((a, b) => arc(b) - arc(a));

const pts = lines.reduce((s, l) => s + l.length, 0);
console.log(`เย็บท่อนเข้าด้วยกัน ${joined} ครั้ง → เหลือ ${lines.length} เส้น · ${pts} จุด`);
lines.slice(0, 6).forEach((l, i) =>
  console.log(`  #${i+1} ยาว ${arc(l).toFixed(0)} หน่วย · ${l.length} จุด · x ${Math.min(...l.map(p=>p[0])).toFixed(0)}–${Math.max(...l.map(p=>p[0])).toFixed(0)}`));

const body = lines.map(l =>
  '  [' + l.map(p => `[${p[0].toFixed(1)},${p[1].toFixed(1)}]`).join(',') + ']').join(',\n');

fs.writeFileSync(path.join(__dirname, '..', 'data', 'wall.js'),
`/* wall.js — สร้างโดย tools/build_wall.js **ห้ามแก้ด้วยมือ**
 * กำแพงเมืองจีน · พิกัดพิกเซลบนกรอบ 1650×1950 ชุดเดียวกับทั้งโปรเจกต์ (กฎ 4)
 *
 * ★ ที่มา: หมึกเทาอมน้ำตาลของแผ่นเอง สกัดที่ความละเอียดเต็มโดย tools/plate_ink.ps1
 *   เกณฑ์สียกมาจาก tools/bordermask.ps1 ซึ่งวัดไว้ตั้งแต่ 2026-08-26 — ไม่ใช่ข้อมูลใหม่
 *
 * ${lines.length} เส้น · ${pts} จุด · เส้นที่ยาวที่สุด ${arc(lines[0] || [[0,0]]).toFixed(0)} หน่วย
 */
window.TK = window.TK || {};
window.TK.wall = [
${body}
];
`, 'utf8');
console.log('เขียน data/wall.js แล้ว');
