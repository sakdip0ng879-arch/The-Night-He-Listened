/* check_water.js — ตรวจชั้นน้ำที่ลอกมาจากแผ่น (data/plate_water.js · เฟส 1 ของ §14 รอบใหม่)
 *
 *   node tools\check_water.js
 *   node tools\check_water.js --holes 20     ดูหลุมที่ใหญ่ที่สุด 20 อันดับ
 *
 * ★ ทำไมตัวตรวจนี้ *ตรวจได้จริง* ไม่ใช่ตรวจตัวเอง
 *   `plate_water.js` สร้างจาก `tools/_plate_ink` (สกัดที่ความละเอียดเต็ม 1650×1950)
 *   ส่วน `data/landmask.js` สกัดคนละครั้ง คนละเครื่องมือ (PowerShell · ย่อภาพ bicubic
 *   ลงเหลือช่องละ 5 หน่วยก่อนอ่านสี) — **สองชุดนี้ไม่ได้มาจากการคำนวณเดียวกัน**
 *   ถ้ารูปน้ำที่เราลากออกมาไม่ตรงกับ landmask แปลว่าตัวแปลงทำหาย ไม่ใช่แผ่นเปลี่ยน
 *
 * ⚠ ความต่างที่ **ตั้งใจให้ต่าง** และไม่ถือเป็นข้อผิดพลาด
 *   1. ตัวอักษรสีน้ำเงินที่แผ่นพิมพ์ไว้ (ชื่อแม่น้ำ · คำว่า WEI) — เราตัดทิ้ง landmask ไม่ตัด
 *   2. ขอบชายฝั่งคลาดกันได้ ±1 ช่อง เพราะ landmask ย่อภาพก่อนอ่านสี
 *   จึงตั้งเกณฑ์ผ่านไว้ที่ "ครอบคลุม" ไม่ใช่ "เท่ากันเป๊ะ"
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'landmask.js'));
require(path.join(ROOT, 'data', 'plate_water.js'));

const TK = window.TK, LM = TK.landmask, PW = TK.plateWater;
const CELL = LM.cell, GW = LM.w, GH = LM.h;
const bad = [], warn = [];
const HOLES = (() => { const i = process.argv.indexOf('--holes'); return i < 0 ? 8 : +process.argv[i+1] || 8; })();

/* ══ 1 · โครงสร้างข้อมูล ══════════════════════════════════════════════════ */
const finite = v => typeof v === 'number' && isFinite(v);
const inBox  = (x, y) => x >= 0 && y >= 0 && x <= PW.W && y <= PW.H;

for (const [name, rings] of [['sea', PW.sea], ['islands', PW.islands], ['lakes', PW.lakes]]){
  rings.forEach((r, i) => {
    if (r.length < 8)            bad.push(`${name}[${i}] มีน้อยกว่า 4 จุด — ไม่เป็นรูปปิด`);
    if (r.length % 2)            bad.push(`${name}[${i}] จำนวนตัวเลขเป็นเลขคี่ — พิกัดขาดครึ่งคู่`);
    for (let k = 0; k < r.length; k += 2){
      if (!finite(r[k]) || !finite(r[k+1])) { bad.push(`${name}[${i}] มีพิกัดที่ไม่ใช่ตัวเลขที่ ${k}`); break; }
      if (!inBox(r[k], r[k+1]))             { bad.push(`${name}[${i}] จุดหลุดกรอบแผ่นที่ ${r[k]},${r[k+1]}`); break; }
    }
    const n = r.length;
    if (n >= 4 && (r[0] !== r[n-2] || r[1] !== r[n-1]))
      bad.push(`${name}[${i}] วงไม่ปิด — จุดแรก ${r[0]},${r[1]} ≠ จุดสุดท้าย ${r[n-2]},${r[n-1]}`);
  });
}
PW.rivers.forEach((r, i) => {
  if (r.p.length / 2 !== r.w.length)
    bad.push(`rivers[${i}] จำนวนจุด ${r.p.length/2} ไม่เท่ากับจำนวนความกว้าง ${r.w.length}`);
  if (r.p.length < 4) bad.push(`rivers[${i}] มีจุดเดียว — ไม่เป็นเส้น`);
  for (let k = 0; k < r.p.length; k += 2)
    if (!inBox(r.p[k], r.p[k+1])){ bad.push(`rivers[${i}] จุดหลุดกรอบที่ ${r.p[k]},${r.p[k+1]}`); break; }
  for (const w of r.w)
    if (!finite(w) || w <= 0 || w > 60){ bad.push(`rivers[${i}] ความกว้างผิดวิสัย ${w}`); break; }
});

/* ══ 2 · แปลงรูปของเรากลับเป็นตาราง แล้วเทียบกับ landmask ═════════════════ */
const ours = new Uint8Array(GW * GH);
const put = (cx, cy) => { if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) ours[cy*GW + cx] = 1; };

/* รูปปิด — สแกนไลน์แบบ even-odd ที่กึ่งกลางช่อง */
function fillRing(r, val){
  let y0 = Infinity, y1 = -Infinity;
  for (let k = 1; k < r.length; k += 2){ if (r[k] < y0) y0 = r[k]; if (r[k] > y1) y1 = r[k]; }
  const cy0 = Math.max(0, Math.floor(y0/CELL)), cy1 = Math.min(GH-1, Math.ceil(y1/CELL));
  for (let cy = cy0; cy <= cy1; cy++){
    const yy = cy*CELL + CELL/2, xs = [];
    for (let k = 0; k + 3 < r.length; k += 2){
      const ax = r[k], ay = r[k+1], bx = r[k+2], by = r[k+3];
      if ((ay <= yy && by > yy) || (by <= yy && ay > yy))
        xs.push(ax + (yy - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2){
      const c0 = Math.max(0, Math.floor(xs[i]/CELL)), c1 = Math.min(GW-1, Math.floor(xs[i+1]/CELL));
      for (let cx = c0; cx <= c1; cx++) ours[cy*GW + cx] = val;
    }
  }
}
for (const r of PW.sea)   fillRing(r, 1);
for (const r of PW.lakes) fillRing(r, 1);
for (const r of PW.islands) fillRing(r, 0);      /* เกาะคือแผ่นดินที่ถูกเจาะกลับ */

/* สายน้ำ — ระบายช่องที่ห่างจากท่อนไม่เกินครึ่งความกว้าง (+ครึ่งช่องกันปัดเศษ) */
for (const r of PW.rivers){
  for (let k = 0; k + 3 < r.p.length; k += 2){
    const ax = r.p[k], ay = r.p[k+1], bx = r.p[k+2], by = r.p[k+3];
    const hw = Math.max(r.w[k/2], r.w[k/2 + 1]) + CELL/2;
    const x0 = Math.floor((Math.min(ax,bx) - hw)/CELL), x1 = Math.ceil((Math.max(ax,bx) + hw)/CELL);
    const y0 = Math.floor((Math.min(ay,by) - hw)/CELL), y1 = Math.ceil((Math.max(ay,by) + hw)/CELL);
    const dx = bx-ax, dy = by-ay, len2 = dx*dx + dy*dy || 1;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++){
      const px = cx*CELL + CELL/2, py = cy*CELL + CELL/2;
      let t = ((px-ax)*dx + (py-ay)*dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      if (Math.hypot(px - (ax+t*dx), py - (ay+t*dy)) <= hw) put(cx, cy);
    }
  }
}

/* landmask: '0' = น้ำ */
const theirs = new Uint8Array(GW * GH);
for (let cy = 0; cy < GH; cy++){
  const row = LM.rows[cy];
  for (let cx = 0; cx < GW; cx++) if (row[cx] === '0') theirs[cy*GW + cx] = 1;
}

let nOurs = 0, nTheirs = 0, both = 0, onlyOurs = 0, onlyTheirs = 0;
for (let i = 0; i < GW*GH; i++){
  if (ours[i]) nOurs++;
  if (theirs[i]) nTheirs++;
  if (ours[i] && theirs[i]) both++;
  else if (ours[i]) onlyOurs++;
  else if (theirs[i]) onlyTheirs++;
}
const recall = both / nTheirs * 100, precision = both / nOurs * 100;

/* ══ 3 · หลุมที่ใหญ่ที่สุด — ที่ landmask บอกว่าเป็นน้ำ แต่เราไม่ได้วาด ══════ */
const miss = new Uint8Array(GW*GH);
for (let i = 0; i < GW*GH; i++) miss[i] = (theirs[i] && !ours[i]) ? 1 : 0;
const seen = new Uint8Array(GW*GH), holes = [];
const st = new Int32Array(GW*GH);
for (let p = 0; p < GW*GH; p++){
  if (!miss[p] || seen[p]) continue;
  let sp = 0; st[sp++] = p; seen[p] = 1;
  let n = 0, sx = 0, sy = 0;
  while (sp > 0){
    const q = st[--sp]; n++;
    const qx = q % GW, qy = (q / GW) | 0; sx += qx; sy += qy;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
      const nx = qx+dx, ny = qy+dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const np = ny*GW + nx;
      if (miss[np] && !seen[np]){ seen[np] = 1; st[sp++] = np; }
    }
  }
  holes.push({ n, x: Math.round(sx/n*CELL), y: Math.round(sy/n*CELL) });
}
holes.sort((a, b) => b.n - a.n);

/* ══ 4 · ★★ ปลายห้อยที่ "ยังไปต่อได้" — ตัวจับแม่น้ำขาด ═══════════════════
   เจ้าของทักสองรอบว่ายังมีแม่น้ำขาดเพราะไอคอน/ป้ายชื่อเมืองบัง และถามว่า
   *"มันมีวิธีที่น่าจะเช็คได้ไหม ไม่งั้นมันจะแก้แบบไม่รู้จบ"*

   ★ วิธีเช็ค: ที่ปลายห้อยทุกอัน มองต่อไปตามทิศของลำน้ำอีก 6–30 หน่วย
     ถ้า **landmask บอกว่าตรงนั้นยังเป็นน้ำ** แต่เราไม่ได้ลากไปถึง = เราหยุดก่อนเวลา
   → ได้ตัวเลขที่นับได้ ไม่ใช่ความรู้สึก · ตัวเลขนี้ลดลงได้และห้ามเพิ่มขึ้นเงียบ ๆ

   ⚠ ใช้ landmask ซึ่ง commit อยู่ในรีโปแล้ว จึงรันได้ทุกเครื่อง ไม่ต้องมี .rle
     (mask หมึกที่ build ใช้เป็น gitignore เพราะมันคือสำเนาแผ่นทั้งใบ)          */
const wetLM = (x, y) => {
  const cx = Math.round(x / CELL), cy = Math.round(y / CELL);
  return cx >= 0 && cy >= 0 && cx < GW && cy < GH && theirs[cy*GW + cx];
};
const drawn = (x, y) => {
  const cx = Math.round(x / CELL), cy = Math.round(y / CELL);
  return cx >= 0 && cy >= 0 && cx < GW && cy < GH && ours[cy*GW + cx];
};
const kEnd = (x, y) => x + ',' + y;
const endDeg = new Map();
for (const r of PW.rivers){
  const n = r.p.length;
  for (const k of [kEnd(r.p[0], r.p[1]), kEnd(r.p[n-2], r.p[n-1])])
    endDeg.set(k, (endDeg.get(k) || 0) + 1);
}
let nEnds = 0;
const cut = [];
for (const r of PW.rivers){
  const n = r.p.length;
  const cand = [
    { x:r.p[0],   y:r.p[1],   px:r.p[2],   py:r.p[3] },
    { x:r.p[n-2], y:r.p[n-1], px:r.p[n-4], py:r.p[n-3] }
  ];
  for (const e of cand){
    if (endDeg.get(kEnd(e.x, e.y)) !== 1) continue;
    nEnds++;
    const L = Math.hypot(e.x - e.px, e.y - e.py) || 1;
    const ux = (e.x - e.px) / L, uy = (e.y - e.py) / L;
    /* มองต่อไปข้างหน้า — ต้องเจอน้ำของ landmask ที่เรายังไม่ได้วาด ติดกันอย่างน้อยสองช่วง */
    let run = 0, hit = 0;
    for (let s = 6; s <= 30; s += 3){
      const x = e.x + ux*s, y = e.y + uy*s;
      if (wetLM(x, y) && !drawn(x, y)) { run++; if (run > hit) hit = run; }
      else run = 0;
    }
    if (hit >= 2) cut.push({ x:e.x, y:e.y, ahead:hit });
  }
}
console.log(`ปลายห้อย ${nEnds} จุด · **ยังไปต่อได้ ${cut.length} จุด** (มองไปข้างหน้าแล้วยังเจอน้ำที่เราไม่ได้วาด)`);
for (const c of cut.sort((a, b) => b.ahead - a.ahead).slice(0, 12))
  console.log(`   ที่ ${String(c.x).padStart(4)},${String(c.y).padStart(4)}  ยังมีน้ำต่อไปอีก ~${c.ahead*3} หน่วย`);
console.log('');

/* เพดานตั้งจากที่วัดได้จริงหลังเย็บรอบล่าสุด — **ห้ามให้เพิ่มขึ้นเงียบ ๆ**
   ถ้าลดลงได้ ให้ลดเพดานตามด้วย เพื่อไม่ให้มันไหลกลับ */
const CUT_MAX = 12;   /* วัดได้ 11 หลังเย็บรอบสอง (2026-09-05) — เผื่อไว้หนึ่ง */
if (cut.length > CUT_MAX)
  bad.push(`แม่น้ำขาดค้างอยู่ ${cut.length} จุด — เกินเพดาน ${CUT_MAX} · ดูรายการข้างบนแล้วไล่ทีละจุด`);

/* ══ รายงาน ══════════════════════════════════════════════════════════════ */
console.log(`ชั้นน้ำ: ทะเล ${PW.sea.length} · เกาะ ${PW.islands.length} · ทะเลสาบ ${PW.lakes.length} · ` +
            `สายน้ำ ${PW.rivers.length} เส้น (${PW.rivers.reduce((s,r)=>s+r.w.length,0)} จุด)`);
console.log(`ตาราง ${GW}×${GH} ช่องละ ${CELL} หน่วย\n`);
console.log(`  landmask บอกว่าเป็นน้ำ  ${nTheirs.toLocaleString().padStart(7)} ช่อง`);
console.log(`  เราวาดเป็นน้ำ          ${nOurs.toLocaleString().padStart(7)} ช่อง`);
console.log(`  ตรงกัน                ${both.toLocaleString().padStart(7)} ช่อง`);
console.log(`  ★ ครอบคลุม (recall)    ${recall.toFixed(1).padStart(7)} %   ← เราลากน้ำของแผ่นได้ครบแค่ไหน`);
console.log(`  ★ ไม่เกินตัว (precision)${precision.toFixed(1).padStart(7)} %   ← ที่เราวาด เป็นน้ำจริงแค่ไหน`);
console.log(`  เราวาดเกิน ${onlyOurs.toLocaleString()} ช่อง · เราวาดขาด ${onlyTheirs.toLocaleString()} ช่อง\n`);

console.log(`หลุมที่ใหญ่ที่สุด ${Math.min(HOLES, holes.length)} อันดับ (ช่องที่แผ่นมีน้ำแต่เราไม่ได้วาด)`);
for (const h of holes.slice(0, HOLES))
  console.log(`   ${String(h.n).padStart(4)} ช่อง  ราว ๆ ${h.x},${h.y}`);
console.log(`   (ทั้งหมด ${holes.length} หลุม · ${holes.filter(h => h.n >= 20).length} หลุมที่ใหญ่กว่า 20 ช่อง)\n`);

/* เกณฑ์ผ่าน — ตั้งจากที่วัดได้จริง ไม่ได้ตั้งลอย ๆ */
if (recall < 88)    bad.push(`ครอบคลุมแค่ ${recall.toFixed(1)}% — ต่ำกว่า 88% แปลว่าตัวแปลงทำน้ำหาย`);
if (precision < 80) bad.push(`ไม่เกินตัวแค่ ${precision.toFixed(1)}% — ต่ำกว่า 80% แปลว่าเราวาดน้ำในที่ที่แผ่นไม่มีน้ำ`);
for (const h of holes.slice(0, HOLES))
  if (h.n >= 120) warn.push(`หลุมใหญ่ ${h.n} ช่อง ที่ ${h.x},${h.y} — เปิด tools/water_check.html ดูว่าหายอะไรไป`);

for (const w of warn) console.log('⚠ ' + w);
for (const b of bad)  console.log('✖ ' + b);
console.log(bad.length ? `\n${bad.length} ข้อผิดพลาด` : '\nชั้นน้ำผ่านทุกข้อ');
process.exit(bad.length ? 1 : 0);
