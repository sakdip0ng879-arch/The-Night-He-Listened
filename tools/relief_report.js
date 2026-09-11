/* relief_report.js — ถนนเส้นไหนพาดข้ามเขา? วัดทุก edge ที่ลากแล้วกับ **หมึกเขาของแผ่นเอง**
 *
 *   node tools/relief_report.js           ทุก edge ที่มี d · เรียงจากเป็นเขามากสุด
 *   node tools/relief_report.js --used    เฉพาะ edge ที่มีการเดินทัพใช้อยู่
 *
 * ★ **รายงานเฉย ๆ ไม่ใช่ตัวตรวจ** — exit 0 เสมอ · ต้นแบบของข้อเสนอใน LOG §5.28
 *
 * ═══ ที่มา ═══
 * LOG §5.27 — ผมลากถนนหลางจง–ฝูเฉิงด้วยตาแล้วอ้างว่า *"เลาะช่องหุบ"* แต่วัดแล้วมันทับ
 * ขีดเขา 11 px เท่ากับเส้นตรงเป๊ะ · เจ้าของจับได้จากภาพ (*"จางเฟยวิ่งข้ามเขาชัดเจน"*)
 * ⇒ ความผิดแบบนี้ **เกิดซ้ำได้กับทุก edge ที่เคยลากด้วยตา** ไฟล์นี้คือวิธีหามันให้เจอ
 *
 * ═══ ค่าที่วัด ═══
 *   ขีดเขา  = จำนวนช่อง 1 หน่วยบนเส้นที่ตรงกับหมึกเขา (`tools/_plate_relief.rle`)
 *   เป็นเขา = ค่าเฉลี่ยของสัดส่วนหมึกเขาในรัศมี 4 หน่วยรอบแต่ละจุดบนเส้น
 *             ★★ **ตัวนี้สำคัญกว่าขีดเขา** — แผ่นวาดเขาเป็นขีดรูปบั้ง (^) เว้นช่องกัน
 *             เส้นที่ลอดช่องระหว่างบั้งได้ "ขีดเขา 0" ทั้งที่อยู่กลางเทือกเขา
 *             (นี่คือกับดักที่หลอกตาผมใน §5.27 — และมันหลอกตัวเลขตัวแรกได้เหมือนกัน)
 *   ลุยน้ำ  = ช่วงต่อเนื่องยาวสุดบนหน้ากากน้ำ (`tools/_plate_water.rle`) · check_routes
 *             ฟ้องเมื่อ ≥ 20 หน่วยโดยไม่มีท่า — ที่นี่แค่แสดงให้เห็นคู่กัน
 *
 * ═══ ค่าอ้างอิงที่วัดไว้ใน §5.27 (ใช้ตั้งเกณฑ์) ═══
 *   langzhong–jiange (A* ตามหุบเจียหลิง)   ขีดเขา  0 · เป็นเขา  0.8%   ← ตามหุบจริง
 *   jiange–baishui (ถนนจินหนิว)            ขีดเขา  1 · เป็นเขา  2.3%
 *   zitong–jiange  (ถนนจินหนิว)            ขีดเขา  1 · เป็นเขา  4.0%
 *   langzhong–fucheng (ถอดแล้ว)            ขีดเขา 11 · เป็นเขา  9.0–10.8%  ← ข้ามเขา
 *   ⚠ fucheng–zitong (ถนนจินหนิวที่ยังใช้อยู่) วัดได้ ขีดเขา 7 · เป็นเขา 11.7% —
 *     **สูงกว่าถนนที่ถอดทิ้ง** · ยังไม่รู้ว่าลากผิดหรือถนนปีนเขาจริง → ดูเป็นอันดับแรก
 *
 * ⚠⚠ **ถนนผ่านช่องเขา *ข้ามสัน* โดยนิยาม** — ค่าสูงไม่ได้แปลว่าผิดเสมอ
 *    ใช้เป็น "คิวให้คนเปิดดู" ไม่ใช่ "คำตัดสิน" · ถ้าจะทำเป็นกฎใน check_routes ให้เริ่มจาก note
 * ⚠ ไฟล์ `.rle` ทั้งสองถูก gitignore (tools/_*.rle) — ถ้าไม่มี ให้รัน `tools/plate_ink.ps1`
 *    ตัวนี้จะบอกแล้วออกเฉย ๆ ไม่พัง
 *
 * วิธีลากเส้นทางใหม่ที่ใช้ใน §5.27 (ไว้ทำซ้ำ): A* บนตาราง 1 หน่วย ต้นทุนต่อช่อง
 *   1 + 60·เป็นเขา(รัศมี 4) + 150·ขีดเขา + 6·น้ำ → Douglas–Peucker ε≈1.6 → Catmull–Rom เป็น C
 *   แล้ววัดผลซ้ำด้วยไฟล์นี้ก่อนใส่ลง roads.js ทุกครั้ง
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const RELIEF = path.join(__dirname, '_plate_relief.rle'), WATER = path.join(__dirname, '_plate_water.rle');
if (!fs.existsSync(RELIEF) || !fs.existsSync(WATER)){
  console.log('· ไม่มี tools/_plate_relief.rle หรือ _plate_water.rle — รัน tools/plate_ink.ps1 ก่อน (ข้ามรายงาน)');
  process.exit(0);
}
global.window = global;
for (const f of ['names.js', 'places.js', 'geo.js', 'roads.js']) require(path.join(ROOT, 'data', f));
const { readRle } = require(path.join(__dirname, 'build_plate_water.js'));
const R = readRle(RELIEF), Wt = readRle(WATER), W = R.W, H = R.H;
const USED = process.argv.includes('--used');

const rel = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? R.m[y * W + x] : 1;
const wat = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? Wt.m[y * W + x] : 0;
const dens = (x, y) => {
  let n = 0, t = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
    if (dx * dx + dy * dy > 16) continue; t++; if (rel(x + dx, y + dy)) n++;
  }
  return n / t;
};

/* เดินตาม d (M/L/Q/C แบบตัวใหญ่เท่านั้น — ถนนทุกเส้นใน roads.js เขียนแบบนี้)
   เจอคำสั่งอื่นให้คืน null แล้วรายงานว่าข้าม ดีกว่าอ่านเลขผิดตำแหน่งแล้วได้ตัวเลขมั่ว */
function sample(d){
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || []; let i = 0, cx = 0, cy = 0, cmd = null; const pts = [];
  const num = () => +t[i++];
  while (i < t.length){
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    if (cmd === 'M'){ cx = num(); cy = num(); pts.push([cx, cy]); cmd = 'L'; }
    else if (cmd === 'L'){ const x = num(), y = num(); const n = Math.max(1, Math.ceil(Math.hypot(x - cx, y - cy) / 0.5));
      for (let k = 1; k <= n; k++) pts.push([cx + (x - cx) * k / n, cy + (y - cy) * k / n]); cx = x; cy = y; }
    else if (cmd === 'Q'){ const x1 = num(), y1 = num(), x = num(), y = num();
      for (let k = 1; k <= 60; k++){ const s = k / 60, u = 1 - s; pts.push([u*u*cx + 2*u*s*x1 + s*s*x, u*u*cy + 2*u*s*y1 + s*s*y]); } cx = x; cy = y; }
    else if (cmd === 'C'){ const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
      for (let k = 1; k <= 200; k++){ const s = k / 200, u = 1 - s;
        pts.push([u*u*u*cx + 3*u*u*s*x1 + 3*u*s*s*x2 + s*s*s*x, u*u*u*cy + 3*u*u*s*y1 + 3*u*s*s*y2 + s*s*s*y]); } cx = x; cy = y; }
    else return null;
  }
  return pts;
}
function measure(pts){
  const seen = new Set(); let hit = 0, ds = 0, n = 0, run = 0, maxRun = 0, L = 0, prev = null;
  for (const p of pts){
    const X = Math.round(p[0]), Y = Math.round(p[1]);
    if (prev){ const s = Math.hypot(p[0] - prev[0], p[1] - prev[1]); L += s; if (wat(X, Y)) { run += s; maxRun = Math.max(maxRun, run); } else run = 0; }
    prev = p;
    const k = X + ',' + Y; if (seen.has(k)) continue; seen.add(k); n++;
    if (rel(X, Y)) hit++; ds += dens(X, Y);
  }
  return { L, hit, dens: 100 * ds / Math.max(1, n), wet: maxRun };
}

const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const used = new Set();
for (const m of Object.values(TK.marches || {}))
  for (let i = 1; i < (m.path || []).length; i++) used.add(key(m.path[i-1], m.path[i]));

const rows = [], skipped = [];
for (const e of TK.edges || []){
  if (!e.d) continue;
  const u = used.has(key(e.a, e.b));
  if (USED && !u) continue;
  const pts = sample(e.d);
  if (!pts){ skipped.push(e.a + '–' + e.b); continue; }
  rows.push({ e, u, ...measure(pts) });
}
rows.sort((a, b) => b.dens - a.dens);

console.log('ถนนที่ลากแล้ว ' + rows.length + ' เส้น' + (USED ? ' (เฉพาะที่มีการเดินทัพใช้)' : '') +
            ' — เรียงจากเป็นเขามากสุด · * = มีการเดินทัพใช้');
console.log('  ' + 'edge'.padEnd(26) + 'ภูมิประเทศ'.padEnd(10) + 'ยาว'.padStart(5) + '  ขีดเขา  เป็นเขา  ลุยน้ำ');
for (const r of rows)
  console.log('  ' + ((r.u ? '* ' : '  ') + r.e.a + '–' + r.e.b).padEnd(26) + String(r.e.terrain || '').padEnd(10) +
              r.L.toFixed(0).padStart(5) + String(r.hit).padStart(8) + (r.dens.toFixed(1) + '%').padStart(9) +
              r.wet.toFixed(0).padStart(7));
const band = t => rows.filter(r => r.dens >= t).length;
console.log('\n· เป็นเขา ≥ 8%: ' + band(8) + ' เส้น · ≥ 5%: ' + band(5) + ' เส้น · (อ้างอิง: ถนนที่ถอดทิ้งใน §5.27 = 9.0–10.8%)');
if (skipped.length) console.log('· ข้าม (d มีคำสั่งที่ไม่รองรับ): ' + skipped.join(' '));
process.exit(0);
