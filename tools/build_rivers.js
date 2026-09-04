/* build_rivers.js — แม่น้ำจริงจาก Natural Earth → data/rivers.js (พิกัดของแผ่นเรา)
 *
 *   node tools/build_rivers.js            ทำจริง
 *   node tools/build_rivers.js --list     ดูรายชื่อแม่น้ำที่อยู่ในกรอบ (ยังไม่เขียนไฟล์)
 *
 * วัตถุดิบ (สาธารณสมบัติ · ไม่ผูกสิทธิ์ใคร):
 *   vendor/naturalearth/ne_10m_rivers_lake_centerlines.geojson
 *   github.com/nvkelso/natural-earth-vector  โฟลเดอร์ geojson/
 *
 * ⚠ ไฟล์วัตถุดิบ **ห้ามอยู่ใน data/** — มันหลายเมกะไบต์ และ data/ ถูกโหลดเข้าเบราว์เซอร์
 *   ทั้งโฟลเดอร์ · ที่นี่คือขั้นตอน build เท่านั้น ผลลัพธ์ที่ส่งให้เบราว์เซอร์คือ data/rivers.js
 *   ซึ่งมีเฉพาะเส้นในกรอบแผ่นและลดจุดแล้ว (แบบเดียวกับ tools/build_wall.js)
 *
 * ★★ การแปลงพิกัด: TPS จากหมุดยึด 20 เมือง — สูตรเดียวกับ tools/tps_river.js
 *   ที่พิสูจน์แล้วว่าเส้นที่ดัดมาห่างจากแม่น้ำของแผ่นเฉลี่ย 15.6 หน่วย (≈19 กม.)
 *   **นอกกรอบหมุดยึด TPS จะเพี้ยนเร็วมาก** — จึงตัดทิ้งทุกอย่างที่ออกนอกกรอบแผ่น
 */
const path = require('path'), fs = require('fs');
global.window = global;
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));

const SRC = path.join(ROOT, 'vendor', 'naturalearth', 'ne_10m_rivers_lake_centerlines.geojson');
if (!fs.existsSync(SRC)){
  console.error('ไม่เจอไฟล์วัตถุดิบ:\n  ' + SRC +
    '\n\nโหลดจาก github.com/nvkelso/natural-earth-vector โฟลเดอร์ geojson/' +
    '\nแล้ววางไว้ที่ vendor/naturalearth/ (สร้างโฟลเดอร์เอง)');
  process.exit(1);
}

/* ── หมุดยึด: ชุดเดียวกับ fit_plate.js / tps_river.js ── */
const REAL = {
  changan:[34.27,108.93], luoyang:[34.62,112.45], chengdu:[30.66,104.07],
  jianye:[32.06,118.80],  wancheng:[33.00,112.53], xiangyang:[32.01,112.12],
  jiangling:[30.35,112.19], shouchun:[32.58,116.79], hefei:[31.82,117.23],
  tianshui:[34.58,105.72], jincheng:[36.06,103.83], hanzhong:[33.07,107.02],
  wuchang:[30.40,114.89], jinyang:[37.87,112.55], chencang:[34.36,107.14],
  anding:[35.54,106.68],  wuwei:[37.93,102.64],  zhangye:[38.93,100.45],
  xiakou:[30.58,114.30],  yecheng:[36.33,114.62]
};
const P = window.TK.places, C = [];
for (const id in REAL){ const p = P[id]; if (p) C.push({lon:REAL[id][1], lat:REAL[id][0], x:p.x, y:p.y}); }

const U = r2 => (r2 <= 1e-12 ? 0 : r2 * Math.log(r2));
function solve(A, b){
  const n = b.length, M = A.map((r,i) => r.concat([b[i]]));
  for (let i = 0; i < n; i++){
    let piv = i;
    for (let r = i+1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let r = 0; r < n; r++){
      if (r === i) continue;
      const k = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= k * M[i][c];
    }
  }
  return M.map((r,i) => r[n] / r[i]);
}
function buildTPS(target){
  const n = C.length, S = n + 3;
  const A = Array.from({length:S}, () => new Array(S).fill(0)), b = new Array(S).fill(0);
  for (let i = 0; i < n; i++){
    for (let j = 0; j < n; j++){
      const dx = C[i].lon - C[j].lon, dy = C[i].lat - C[j].lat;
      A[i][j] = U(dx*dx + dy*dy);
    }
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
let worst = 0;
for (const c of C) worst = Math.max(worst, Math.hypot(FX(c.lon,c.lat)-c.x, FY(c.lon,c.lat)-c.y));
console.log(`TPS ผ่านหมุดยึด ${C.length} จุด · คลาดมากสุด ${worst.toFixed(3)} หน่วย`);

/* ── กรอบ: ตัดด้วย lon/lat ก่อน (เร็ว) แล้วค่อยตัดด้วยพิกัดแผ่นอีกที ──
   ★ กรอบ lon/lat เผื่อไว้กว้างกว่ากรอบหมุดยึดเล็กน้อยเท่านั้น — **นอกกรอบหมุดยึด
     TPS ระเบิด** (ธรรมชาติของ radial basis) ถ้าไม่ตัดจะได้เส้นพุ่งออกนอกจักรวาล   */
const LON0 = 98, LON1 = 122, LAT0 = 27, LAT1 = 42;
const W = 1650, H = 1950, MARGIN = 40;

const gj = JSON.parse(fs.readFileSync(SRC, 'utf8'));
console.log(`อ่าน geojson: ${gj.features.length} feature`);

/* Douglas–Peucker (หน่วยแผนที่) */
function dp(pts, eps){
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length-1]];
  let idx = -1, max = -1;
  const dx = b[0]-a[0], dy = b[1]-a[1], len = Math.hypot(dx,dy) || 1;
  for (let i = 1; i < pts.length-1; i++){
    const p = pts[i];
    const d = Math.abs(dy*p[0] - dx*p[1] + b[0]*a[1] - b[1]*a[0]) / len;
    if (d > max){ max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  return dp(pts.slice(0, idx+1), eps).slice(0, -1).concat(dp(pts.slice(idx), eps));
}

const out = [], names = new Map();
let kept = 0, dropped = 0;
for (const f of gj.features){
  const g = f.geometry; if (!g) continue;
  const parts = g.type === 'LineString' ? [g.coordinates]
              : g.type === 'MultiLineString' ? g.coordinates : [];
  const pr = f.properties || {};
  const name = pr.name_en || pr.name || null;
  const rank = pr.scalerank != null ? pr.scalerank : 99;

  for (const coords of parts){
    /* ตัดเป็นท่อน ๆ ตามช่วงที่อยู่ในกรอบ — เส้นเดียวอาจเข้า-ออกกรอบหลายครั้ง */
    let run = [];
    const flush = () => {
      if (run.length >= 2){
        const simple = dp(run, 2.2);
        out.push({ n:name, r:rank, p:simple });
        kept++;
        if (name) names.set(name, (names.get(name)||0) + 1);
      } else if (run.length) dropped++;
      run = [];
    };
    for (const [lon, lat] of coords){
      if (lon < LON0 || lon > LON1 || lat < LAT0 || lat > LAT1){ flush(); continue; }
      const x = FX(lon, lat), y = FY(lon, lat);
      if (x < -MARGIN || x > W+MARGIN || y < -MARGIN || y > H+MARGIN){ flush(); continue; }
      run.push([+x.toFixed(1), +y.toFixed(1)]);
    }
    flush();
  }
}
const pts = out.reduce((s,l) => s + l.p.length, 0);
console.log(`ในกรอบ: ${kept} ท่อน · ${pts} จุดหลังลดจุด · ท่อนสั้นเกินที่ทิ้ง ${dropped}`);

console.log('\nแม่น้ำที่มีชื่อในกรอบ (ท่อน):');
[...names.entries()].sort((a,b) => b[1]-a[1]).slice(0, 200)
  .forEach(([n,c]) => console.log('  ' + String(c).padStart(3) + '  ' + n));

if (process.argv.includes('--list')){ console.log('\n(--list · ไม่เขียนไฟล์)'); process.exit(0); }

const body = out.map(l =>
  `  {n:${l.n ? JSON.stringify(l.n) : 'null'},r:${l.r},p:[` +
  l.p.map(p => `[${p[0]},${p[1]}]`).join(',') + ']}').join(',\n');

fs.writeFileSync(path.join(ROOT, 'data', 'rivers.js'),
`/* rivers.js — สร้างโดย tools/build_rivers.js ห้ามแก้ด้วยมือ
 * แม่น้ำจาก Natural Earth 10m (สาธารณสมบัติ) ดัดเข้าพิกัดแผ่นด้วย TPS หมุดยึด 20 เมือง
 * พิกัดพิกเซลบน assets/map.jpg (1650x1950) เหมือนทุกอย่างในโปรเจกต์
 *
 * ช่อง: n = ชื่อ (อาจเป็น null) · r = scalerank ยิ่งน้อยยิ่งเป็นสายใหญ่ · p = จุด
 *
 * ⚠ ความแม่น: prototype วัดกับแม่น้ำเว่ยได้ห่างจากที่แผ่นวาดไว้เฉลี่ย 15.6 หน่วย
 *   (≈19 กม.) — **ใต้ระดับนั้นเส้นนี้เป็นการประมาณ ไม่ใช่ข้อมูลรังวัด**
 *   ตรงไหนที่ขัดกับแผ่นชัด ๆ ให้เชื่อแผ่น เพราะหมุดกับถนนทั้งโปรเจกต์ยึดแผ่นอยู่
 */
window.TK = window.TK || {};
window.TK.rivers = [
${body}
];
`, 'utf8');
console.log('\nเขียน data/rivers.js แล้ว');
