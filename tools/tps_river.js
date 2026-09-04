/* tps_river.js — prototype: ดัดแม่น้ำเว่ยของจริงเข้ากรอบของแผ่นด้วย TPS
 *
 *   node tools/tps_river.js        → เขียน tools/tps_preview.html
 *
 * คำถามที่ไฟล์นี้ตอบ (ต่อจากเฟส 0): **ถ้าเอาเส้นภูมิศาสตร์จริงมา warp เข้ากรอบ
 * ของแผ่นด้วยหมุดยึด 20 เมือง มันจะลงตรงกับแม่น้ำที่แผ่นวาดไว้ไหม**
 * ถ้าตรง → ทางที่แนะนำใช้ได้ · ถ้าไม่ตรง → ต้องวาดเองในกรอบของแผ่น
 *
 * ⚠⚠ **พิกัดแม่น้ำในไฟล์นี้เป็นการเข้ารหัสเส้นทางที่รู้กันของแม่น้ำเว่ยด้วยมือ
 *     ไม่ใช่ข้อมูลรังวัด** (เซสชันนี้ไม่มีเน็ต) — มันดีพอสำหรับตอบคำถาม "ทรงมันตรงกันไหม"
 *     แต่ห้ามเอาไปใช้เป็นข้อมูลจริงในโปรดักต์ ถ้าจะทำจริงต้องดึง Natural Earth มา
 *
 * ⚠ ไม่แตะไฟล์ข้อมูลไหนทั้งสิ้น เขียนแค่ไฟล์ preview
 */
const path = require('path'), fs = require('fs');
global.window = global;
require(path.join(__dirname, '..', 'data', 'names.js'));
require(path.join(__dirname, '..', 'data', 'places.js'));
require(path.join(__dirname, '..', 'data', 'landmask.js'));

/* ── หมุดยึด: ชุดเดียวกับ fit_plate.js ── */
const REAL = {
  changan:[34.27,108.93], luoyang:[34.62,112.45], chengdu:[30.66,104.07],
  jianye:[32.06,118.80],  wancheng:[33.00,112.53], xiangyang:[32.01,112.12],
  jiangling:[30.35,112.19], shouchun:[32.58,116.79], hefei:[31.82,117.23],
  tianshui:[34.58,105.72], jincheng:[36.06,103.83], hanzhong:[33.07,107.02],
  wuchang:[30.40,114.89], jinyang:[37.87,112.55], chencang:[34.36,107.14],
  anding:[35.54,106.68],  wuwei:[37.93,102.64],  zhangye:[38.93,100.45],
  xiakou:[30.58,114.30],  yecheng:[36.33,114.62]
};
const P = window.TK.places;
const C = [];
for (const id in REAL){ const p = P[id]; if (p) C.push({lon:REAL[id][1], lat:REAL[id][0], x:p.x, y:p.y}); }

/* ── Thin-plate spline ─────────────────────────────────────────────────────
   f(p) = a0 + a1·lon + a2·lat + Σ wi·U(|p − pi|) ,  U(r) = r²·ln(r²)
   แก้ระบบ (n+3)×(n+3) ด้วย Gaussian elimination พร้อม partial pivoting
   λ = regularisation เล็ก ๆ กันหมุดที่อยู่ใกล้กันทำให้เมทริกซ์เกือบเอกฐาน       */
const U = r2 => (r2 <= 1e-12 ? 0 : r2 * Math.log(r2));
function solve(A, b){
  const n = b.length, M = A.map((r,i) => r.concat([b[i]]));
  for (let i = 0; i < n; i++){
    let piv = i;
    for (let r = i+1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) throw new Error('เมทริกซ์เอกฐาน — หมุดยึดซ้ำกันหรือเปล่า');
    for (let r = 0; r < n; r++){
      if (r === i) continue;
      const k = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= k * M[i][c];
    }
  }
  return M.map((r,i) => r[n] / r[i]);   /* r[i] คือตัวบนเส้นทแยง ไม่ใช่ r[i][i] */
}
function buildTPS(target, lambda = 0.0){
  const n = C.length, S = n + 3;
  const A = Array.from({length:S}, () => new Array(S).fill(0));
  const b = new Array(S).fill(0);
  for (let i = 0; i < n; i++){
    for (let j = 0; j < n; j++){
      const dx = C[i].lon - C[j].lon, dy = C[i].lat - C[j].lat;
      A[i][j] = U(dx*dx + dy*dy);
    }
    A[i][i] += lambda;
    A[i][n] = 1; A[i][n+1] = C[i].lon; A[i][n+2] = C[i].lat;
    A[n][i] = 1; A[n+1][i] = C[i].lon; A[n+2][i] = C[i].lat;
    b[i] = target(C[i]);
  }
  const s = solve(A, b);
  return (lon, lat) => {
    let v = s[n] + s[n+1]*lon + s[n+2]*lat;
    for (let i = 0; i < n; i++){
      const dx = lon - C[i].lon, dy = lat - C[i].lat;
      v += s[i] * U(dx*dx + dy*dy);
    }
    return v;
  };
}
const FX = buildTPS(p => p.x), FY = buildTPS(p => p.y);

/* ตรวจว่า TPS ผ่านหมุดยึดจริง (λ=0 ต้องผ่านเป๊ะ — ถ้าไม่ผ่านแปลว่าโค้ดผิด) */
let worst = 0;
for (const c of C) worst = Math.max(worst, Math.hypot(FX(c.lon,c.lat)-c.x, FY(c.lon,c.lat)-c.y));
console.log(`TPS ผ่านหมุดยึด 20 จุด · คลาดมากสุด ${worst.toFixed(3)} หน่วย (ต้องเกือบ 0)`);

/* ── แม่น้ำเว่ยของจริง (เข้ารหัสด้วยมือ · ต้นน้ำเว่ยหยวน → ปากน้ำที่ด่านถง) ── */
const WEI = [
  [35.00,104.22],[34.90,104.55],[34.78,104.90],[34.66,105.30],[34.60,105.72],
  [34.63,106.15],[34.58,106.62],[34.44,107.14],[34.36,107.62],[34.32,108.14],
  [34.33,108.71],[34.31,109.16],[34.42,109.62],[34.52,110.00],[34.58,110.28]
];
const warped = WEI.map(([lat,lon]) => [FX(lon,lat), FY(lon,lat)]);

/* ── แม่น้ำเว่ยตามที่ *แผ่น* วาดไว้ — สกัดจาก landmask ในระเบียงเดียวกัน ──
   ช่องน้ำ ('0') ในกรอบ x 250–760 · y 545–690 แล้วเอามัธยฐาน y ของแต่ละคอลัมน์
   ⚠ หยาบ ๆ พอสำหรับเทียบทรง ไม่ใช่การสกัดแม่น้ำที่ถูกต้อง                     */
const LM = window.TK.landmask, CELL = LM.cell;
const water = (gx, gy) => LM.rows[gy] && LM.rows[gy][gx] === '0';

/* ★ รอบแรกใช้ "มัธยฐาน y ของทุกช่องน้ำในคอลัมน์" แล้วได้เส้นหยึกหยัก เพราะมันเอา
   ลำน้ำสาขากับฮวงโหมาเฉลี่ยรวมกับเว่ย — **เทียบทรงกับเส้นที่ปนกันแบบนั้นไม่มีความหมาย**
   รอบนี้ *ตามรอย* แทน: ทีละคอลัมน์ หาช่วงน้ำต่อเนื่อง แล้วเลือกช่วงที่ใกล้คอลัมน์ก่อนหน้า
   ที่สุด — ได้แม่น้ำสายเดียวจริง ๆ (วิธีมาตรฐานของการ trace เส้นจาก raster) */
const gx0 = Math.round(250/CELL), gx1 = Math.round(760/CELL);
const gy0 = Math.round(545/CELL), gy1 = Math.round(690/CELL);

/* ★★ เมล็ดต้องมาจากข้อมูลของโปรเจกต์เอง ไม่ใช่จากการเดา
   รอบก่อนเริ่มที่ "ช่วงน้ำกว้างสุดของคอลัมน์ซ้ายสุด" แล้ว **มันไปเกาะลำน้ำจิงแทนเว่ย**
   (เห็นชัดในภาพ: เส้นวิ่งขึ้นเหนือไปทางฉินชวง ซึ่งไม่ใช่ทางของเว่ย)
   → ใช้ node `xianyang` เป็นเมล็ด เพราะ roads.js ประกาศไว้เองว่ามันคือ **ท่าข้ามแม่น้ำเว่ย**
     ("ฉางอานอยู่ฝั่งใต้ เซียนหยางอยู่ฝั่งเหนือตรงข้ามพอดี") = จุดที่อยู่บนเว่ยแน่นอน   */
const seed = window.TK.places.xianyang;
const runsAt = gx => {
  const out = []; let s = null;
  for (let gy = gy0; gy <= gy1; gy++){
    if (water(gx, gy)){ if (s === null) s = gy; }
    else if (s !== null){ out.push([s, gy-1]); s = null; }
  }
  if (s !== null) out.push([s, gy1]);
  return out;
};
const mid = r => (r[0] + r[1]) / 2;
const seedGX = Math.round(seed.x / CELL), seedGY = seed.y / CELL;
const seedRuns = runsAt(seedGX);
if (!seedRuns.length) throw new Error('ไม่เจอน้ำที่คอลัมน์ของเซียนหยาง');
let seedTrack = seedRuns.reduce((a,b) => Math.abs(mid(b)-seedGY) < Math.abs(mid(a)-seedGY) ? b : a);

function walk(dir){
  const out = []; let track = mid(seedTrack);
  for (let gx = seedGX + dir; dir < 0 ? gx >= gx0 : gx <= gx1; gx += dir){
    const runs = runsAt(gx);
    if (!runs.length) break;
    const pick = runs.reduce((a,b) => Math.abs(mid(b)-track) < Math.abs(mid(a)-track) ? b : a);
    if (Math.abs(mid(pick) - track) > 6) break;   /* กระโดด = คนละสาย หยุดตามเลย */
    track = mid(pick);
    out.push([gx*CELL + CELL/2, track*CELL + CELL/2]);
  }
  return out;
}
const plate = walk(-1).reverse()
  .concat([[seedGX*CELL + CELL/2, mid(seedTrack)*CELL + CELL/2]])
  .concat(walk(+1));
console.log(`แม่น้ำของแผ่น: เก็บได้ ${plate.length} คอลัมน์ในระเบียง x 250–760`);

/* ── ระยะห่างระหว่างสองเส้น: ที่แต่ละคอลัมน์ของแผ่น หา y ของเส้น warp ── */
function yAt(line, x){
  for (let i = 0; i < line.length-1; i++){
    const [x0,y0] = line[i], [x1,y1] = line[i+1];
    if ((x - x0) * (x - x1) <= 0 && x0 !== x1)
      return y0 + (y1-y0) * (x-x0)/(x1-x0);
  }
  return null;
}
const diffs = [];
for (const [x,y] of plate){ const yw = yAt(warped, x); if (yw !== null) diffs.push({x, dy: y - yw}); }
diffs.sort((a,b) => Math.abs(a.dy) - Math.abs(b.dy));
const absd = diffs.map(d => Math.abs(d.dy));
const mean = absd.reduce((s,v)=>s+v,0) / (absd.length||1);
const med  = absd[Math.floor(absd.length/2)] || 0;
const mx   = absd[absd.length-1] || 0;
console.log(`\nระยะห่างแนวตั้ง แผ่น ↔ เส้นที่ warp มา (${diffs.length} จุดเทียบ):`);
console.log(`  เฉลี่ย ${mean.toFixed(1)} · มัธยฐาน ${med.toFixed(1)} · มากสุด ${mx.toFixed(1)} หน่วย`);
console.log(`  ≈ เฉลี่ย ${(mean*1.2).toFixed(0)} กม. บนพื้นจริง (1 หน่วย ≈ 1.2 กม.)`);
console.log(mean < 25 ? '  ★ ทรงตรงกันดี — warp ใช้ได้'
          : mean < 55 ? '  ★ ทรงตามกันแต่เหลื่อม — ใช้ได้ถ้ายอมดัดด้วยมือเพิ่ม'
          :             '  ★ คนละเส้น — warp ไม่ช่วย ต้องวาดเองในกรอบของแผ่น');

/* ── หน้าเทียบ ── */
const poly = pts => pts.map(p => p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
const anchors = C.map(c => `<circle cx="${c.x}" cy="${c.y}" r="5" class="anc"/>`).join('');
const anchorNames = Object.keys(REAL).filter(id => P[id])
  .map(id => `<text x="${P[id].x+7}" y="${P[id].y-6}" class="anct">${P[id].label}</text>`).join('');

fs.writeFileSync(path.join(__dirname, 'tps_preview.html'),
`<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>TPS prototype — แม่น้ำเว่ย</title>
<style>
body{margin:0;padding:16px 20px 40px;background:#f2efe6;color:#14181f;
     font:13px/1.5 "Segoe UI","Leelawadee UI",Tahoma,sans-serif}
h1{font-size:16px;margin:0 0 3px} p.sub{margin:0 0 10px;color:#6b6555;font-size:12px}
svg{background:#efeadd;border:1px solid #c9c3b4;display:block;width:100%;max-width:1200px;height:auto}
.k{background:#fffdf5;border-left:3px solid #14181f;padding:9px 13px;margin:12px 0;
   max-width:1200px;font-size:12.5px}
.lg{display:flex;gap:20px;flex-wrap:wrap;font-size:12.5px;color:#4a4536;margin:8px 0 0}
.lg i{display:inline-block;width:22px;height:3px;margin-right:6px;vertical-align:middle}
.anc{fill:#d9b169;stroke:#5a4a20;stroke-width:1.4}
.anct{font-size:11px;fill:#5a4a20}
.plate{fill:none;stroke:#2563A8;stroke-width:3.2;stroke-opacity:.75}
.warp{fill:none;stroke:#C2413A;stroke-width:3.2;stroke-dasharray:9 5}
</style></head><body>
<h1>TPS prototype — แม่น้ำเว่ย (เทียบทรง)</h1>
<p class="sub">หมุดยึด 20 เมือง (จุดทอง) · เส้นน้ำเงิน = แม่น้ำที่ <b>แผ่นวาดไว้</b> (สกัดจาก landmask)
· เส้นแดงประ = <b>เส้นทางจริงที่ดัดเข้ากรอบด้วย TPS</b></p>
<svg viewBox="120 380 780 420">
  <image href="../assets/map.jpg" x="0" y="0" width="1650" height="1950" opacity=".55"/>
  <polyline class="plate" points="${poly(plate)}"/>
  <polyline class="warp"  points="${poly(warped)}"/>
  ${anchors}${anchorNames}
</svg>
<div class="lg"><span><i style="background:#2563A8"></i>แม่น้ำของแผ่น</span>
<span><i style="background:#C2413A"></i>ของจริงที่ดัดเข้ากรอบ</span>
<span>● หมุดยึด 20 เมือง</span></div>
<div class="k"><b>ตัวเลข</b><br>
ระยะห่างแนวตั้ง เฉลี่ย <b>${mean.toFixed(1)}</b> · มัธยฐาน ${med.toFixed(1)} · มากสุด ${mx.toFixed(1)} หน่วย
(≈ ${(mean*1.2).toFixed(0)} กม.)<br>
TPS ผ่านหมุดยึดทั้ง 20 จุดคลาด ${worst.toFixed(3)} หน่วย = สูตรถูก<br>
⚠ พิกัดแม่น้ำเข้ารหัสด้วยมือจากเส้นทางที่รู้กัน <b>ไม่ใช่ข้อมูลรังวัด</b> —
ใช้ตอบได้แค่ว่า "ทรงมันตรงกันไหม" เท่านั้น</div>
</body></html>`, 'utf8');
console.log('\nเขียน tools/tps_preview.html แล้ว');
