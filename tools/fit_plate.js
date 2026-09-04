/* ⛔⛔ เครื่องมือที่ **เลิกใช้แล้ว** — เจ้าของสั่งตัดเฟสแม่น้ำทิ้ง 2026-09-05
 *   "ค่อนข้างเละมากเลย ... ถ้าทำต่อแบบนี้มันแก้บานเลย เพราะมันทับบนแผนที่ไม่ลงตัว
 *    งานเราตัดเฟสแม่น้ำออกดีไหม ... ไม่งั้นมันจะแก้ยาวไม่จบสิ้นแน่"
 *
 * ไฟล์นี้ยังอยู่เพราะมันคือ *หลักฐานว่าลองแล้ว* ไม่ใช่เพราะจะกลับมาใช้
 * ★ สิ่งที่พิสูจน์ได้: TPS จากหมุดยึด 20 เมืองดัดข้อมูลจริงเข้ากรอบได้จริง
 *   (วัดกับแม่น้ำเว่ยได้เฉลี่ย 15.6 หน่วย ≈19 กม.)
 * ★ สิ่งที่ล้มเหลว: **15.6 หน่วยยังเยอะเกินไปเมื่อวางทับแผ่นที่มีแม่น้ำวาดไว้แล้ว**
 *   สองเส้นที่ไม่ทับกันสนิทอ่านเป็นความผิดพลาด ไม่ใช่เป็นความแม่นยำ
 *   — ปัญหาไม่ได้อยู่ที่ตัวเลข มันอยู่ที่ "ทับ" เป็นโหมดที่เปิดเผยความคลาดทุกจุดพร้อมกัน
 * ถ้าจะรื้อฟื้น ต้องรื้อพร้อมการลบชั้นพิมพ์ของแผ่นเท่านั้น (ไม่มีของให้เทียบ = ไม่มีความคลาดให้เห็น)
 *   และนั่นแปลว่าต้องทำภูเขากับชายฝั่งให้ครบก่อน ซึ่งเป็นงานที่เจ้าของตัดสินใจไม่ทำ
 */
/* fit_plate.js — เฟส 0 · วัดว่าแผ่น map.jpg เบี้ยวจากภูมิศาสตร์จริงแค่ไหน
 *
 *   node tools/fit_plate.js
 *
 * ทำไมต้องวัด: แผนใหญ่ "วาดแผนที่พื้นเอง" มีสามทางเดิน และผลของไฟล์นี้เป็นตัวเลือกทาง
 *   คลาดน้อย      → ดึงข้อมูลภูมิศาสตร์เปิด (Natural Earth · SRTM) มาใส่กรอบได้เลย
 *   คลาดปานกลาง   → ต้อง warp ข้อมูลจริงเข้ากรอบ (thin-plate spline จากจุดยึด)
 *   คลาดมั่ว      → แผ่นเป็นภาพวาด ไม่ใช่แผนที่ · ต้องวาดเองในกรอบของแผ่น
 *
 * ⚠ ไม่แตะไฟล์ไหนทั้งสิ้น อ่านอย่างเดียว
 *
 * ★ พิกัดจริงเป็นของ **เมืองปัจจุบันที่ตั้งอยู่ที่เดิม** — ใช้เป็นหมุดยึดเพื่อวัด
 *   *รูปทรงการฉาย* ของแผ่น ไม่ได้อ้างว่าเมืองโบราณอยู่ตรงนั้นเป๊ะทุกเมตร
 *   (คลาดจากเรื่องนี้อยู่ในหลักสิบกิโลเมตร ซึ่งเล็กกว่าความเบี้ยวที่กำลังวัดมาก)
 */
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'data', 'names.js'));
require(path.join(__dirname, '..', 'data', 'places.js'));

/* id ในโปรเจกต์ → [lat, lon] ของที่ตั้งจริง · ชื่อเมืองปัจจุบันในวงเล็บ */
const REAL = {
  changan:  [34.27, 108.93, 'ซีอาน'],
  luoyang:  [34.62, 112.45, 'ลั่วหยาง'],
  chengdu:  [30.66, 104.07, 'เฉิงตู'],
  jianye:   [32.06, 118.80, 'หนานจิง'],
  wancheng: [33.00, 112.53, 'หนานหยาง'],
  xiangyang:[32.01, 112.12, 'เซียงหยาง'],
  jiangling:[30.35, 112.19, 'จิงโจว/เจียงหลิง'],
  shouchun: [32.58, 116.79, 'โช่วเซี่ยน'],
  hefei:    [31.82, 117.23, 'เหอเฝย'],
  tianshui: [34.58, 105.72, 'เทียนสุ่ย'],
  jincheng: [36.06, 103.83, 'หลานโจว'],
  hanzhong: [33.07, 107.02, 'ฮั่นจง'],
  wuchang:  [30.40, 114.89, 'เอ้อโจว'],
  jinyang:  [37.87, 112.55, 'ไท่หยวน'],
  chencang: [34.36, 107.14, 'เป่าจี'],
  anding:   [35.54, 106.68, 'ผิงเหลียง'],
  wuwei:    [37.93, 102.64, 'อู่เวย'],
  zhangye:  [38.93, 100.45, 'จางเย่'],
  xiakou:   [30.58, 114.30, 'อู่ฮั่น'],
  yecheng:  [36.33, 114.62, 'หลินจาง/เย่']
};

const P = window.TK.places;
const pts = [];
const missing = [];
for (const id in REAL){
  const p = P[id];
  if (!p){ missing.push(id); continue; }
  pts.push({ id, name: REAL[id][2], lat: REAL[id][0], lon: REAL[id][1], x: p.x, y: p.y });
}
console.log(`หมุดยึดที่ใช้ได้ ${pts.length} จุด` + (missing.length ? ` · ไม่มีใน places: ${missing.join(', ')}` : ''));
if (pts.length < 6){ console.log('น้อยเกินกว่าจะ fit'); process.exit(1); }

/* ── least squares affine: x = a·lon + b·lat + c · y = d·lon + e·lat + f ──
   แก้ด้วย normal equations 3x3 (Gaussian elimination) — ไม่ต้องพึ่งไลบรารี */
function solve3(A, rhs){
  const M = A.map((r,i) => r.concat([rhs[i]]));
  for (let i = 0; i < 3; i++){
    let piv = i;
    for (let r = i+1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let r = 0; r < 3; r++){
      if (r === i) continue;
      const k = M[r][i] / M[i][i];
      for (let c = i; c < 4; c++) M[r][c] -= k * M[i][c];
    }
  }
  return [M[0][3]/M[0][0], M[1][3]/M[1][1], M[2][3]/M[2][2]];
}
function fit(target){
  const A = [[0,0,0],[0,0,0],[0,0,0]], b = [0,0,0];
  for (const p of pts){
    const v = [p.lon, p.lat, 1], t = target(p);
    for (let i = 0; i < 3; i++){
      for (let j = 0; j < 3; j++) A[i][j] += v[i]*v[j];
      b[i] += v[i]*t;
    }
  }
  return solve3(A, b);
}
const CX = fit(p => p.x), CY = fit(p => p.y);
const px = p => CX[0]*p.lon + CX[1]*p.lat + CX[2];
const py = p => CY[0]*p.lon + CY[1]*p.lat + CY[2];

const rows = pts.map(p => {
  const dx = p.x - px(p), dy = p.y - py(p);
  return { ...p, dx, dy, d: Math.hypot(dx, dy) };
}).sort((a,b) => b.d - a.d);

const rms = Math.sqrt(rows.reduce((s,r) => s + r.d*r.d, 0) / rows.length);
const max = rows[0].d, med = rows[Math.floor(rows.length/2)].d;

console.log('\n── ค่าคลาดหลัง fit affine (หน่วยแผนที่ · แผ่นกว้าง 1650) ─────────────');
console.log('  เมือง                 ที่ควรอยู่        ที่อยู่จริงบนแผ่น    คลาด');
for (const r of rows)
  console.log('  ' + (r.id + ' (' + r.name + ')').padEnd(24) +
              (px(r).toFixed(0) + ',' + py(r).toFixed(0)).padStart(10) + '   ' +
              (r.x + ',' + r.y).padStart(10) + '   ' +
              r.d.toFixed(0).padStart(4) + '  (' +
              (r.dx >= 0 ? '+' : '') + r.dx.toFixed(0) + ',' +
              (r.dy >= 0 ? '+' : '') + r.dy.toFixed(0) + ')');

console.log('\n── สรุป ──────────────────────────────────────────────────────');
console.log(`  RMS ${rms.toFixed(1)} · มัธยฐาน ${med.toFixed(1)} · มากสุด ${max.toFixed(1)} หน่วย`);
/* สเกลจริงของแผ่น: 1 องศาลองจิจูดที่ละติจูด 34 ≈ 92 กม. */
const uPerDegLon = Math.hypot(CX[0], CY[0]);
const kmPerUnit = 92 / uPerDegLon;
console.log(`  สเกลเฉลี่ย ≈ ${uPerDegLon.toFixed(1)} หน่วย/องศาลองจิจูด ≈ ${kmPerUnit.toFixed(1)} กม./หน่วย`);
console.log(`  → RMS ${rms.toFixed(0)} หน่วย ≈ ${(rms*kmPerUnit).toFixed(0)} กม. บนพื้นจริง`);

const verdict = rms < 20 ? 'ทางที่ 1 — แผ่นเป็นแผนที่จริง ดึงข้อมูลเปิดมาใส่กรอบได้เลย'
              : rms < 80 ? 'ทางที่ 2 — เบี้ยวเป็นย่าน ๆ ต้อง warp ข้อมูลจริงเข้ากรอบ (TPS)'
              :            'ทางที่ 3 — แผ่นเป็นภาพวาด ไม่ใช่แผนที่ · ต้องวาดเองในกรอบของแผ่น';
console.log(`\n  ★ ${verdict}`);

/* ── ความเบี้ยวเป็น "ย่าน" หรือ "มั่ว" — ดูว่าเพื่อนบ้านเบี้ยวไปทางเดียวกันไหม ──
   ถ้าเบี้ยวเป็นย่าน เวกเตอร์คลาดของจุดที่อยู่ใกล้กันจะชี้ทางเดียวกัน (TPS แก้ได้)
   ถ้ามั่ว เวกเตอร์จะชี้คนละทางแม้อยู่ติดกัน (warp ไม่ช่วย) */
let sameDir = 0, pairs = 0;
for (let i = 0; i < rows.length; i++)
  for (let j = i+1; j < rows.length; j++){
    const near = Math.hypot(rows[i].x-rows[j].x, rows[i].y-rows[j].y) < 260;
    if (!near) continue;
    pairs++;
    const dot = rows[i].dx*rows[j].dx + rows[i].dy*rows[j].dy;
    const m = Math.hypot(rows[i].dx,rows[i].dy) * Math.hypot(rows[j].dx,rows[j].dy);
    if (m > 0 && dot/m > 0.3) sameDir++;
  }
console.log(`  เพื่อนบ้าน (ห่าง < 260 หน่วย) ${pairs} คู่ · เบี้ยวไปทางเดียวกัน ${sameDir} คู่` +
            ` = ${(100*sameDir/Math.max(1,pairs)).toFixed(0)}%`);
console.log('  → เกิน ~60% แปลว่าเบี้ยวเป็นย่าน (warp แก้ได้) · ต่ำกว่านั้นแปลว่ามั่ว');
