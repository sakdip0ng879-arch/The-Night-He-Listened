/* build_water.js — ชั้นน้ำจริงจาก Natural Earth → data/water.js (พิกัดของแผ่นเรา)
 *
 *   node tools/build_water.js            ทำจริง
 *   node tools/build_water.js --list     ดูรายชื่อแม่น้ำที่อยู่ในกรอบ (ยังไม่เขียนไฟล์)
 *
 * วัตถุดิบ (สาธารณสมบัติ · ไม่ผูกสิทธิ์ใคร):
 *   vendor/naturalearth/ne_10m_rivers_lake_centerlines.geojson   (แม่น้ำ)
 *   vendor/naturalearth/ne_10m_coastline.geojson                 (ชายฝั่ง)
 *   vendor/naturalearth/ne_10m_lakes.geojson                     (ทะเลสาบ)
 *   github.com/nvkelso/natural-earth-vector  โฟลเดอร์ geojson/
 *
 * ⚠ ไฟล์วัตถุดิบ **ห้ามอยู่ใน data/** — มันหลายเมกะไบต์ และ data/ ถูกโหลดเข้าเบราว์เซอร์
 *   ทั้งโฟลเดอร์ · ที่นี่คือขั้นตอน build เท่านั้น ผลลัพธ์ที่ส่งให้เบราว์เซอร์คือ data/water.js
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

const SRC = path.join(ROOT, 'vendor', 'naturalearth', 'ne_10m_rivers_lake_centerlines.geojson');   /* ชั้นบังคับ — อีกสองชั้นขาดได้ read() จะเตือนเอง */
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
/* ★★ DP สำหรับ **วงปิด** — ห้ามเรียก dp() ตรง ๆ
   วงปิดมีจุดแรกเท่าจุดสุดท้าย → เส้นฐาน a→b ยาวศูนย์ → อัลกอริทึมยุบทั้งวงเหลือสองจุด
   (เจอจริง 2026-09-05: ทะเลสาบ **53 จาก 54 วงหายเกลี้ยง** รวมต้งถิงกับโพหยาง
    โดยไม่มี error สักบรรทัด — ตัวเลข "0 วง" คือสิ่งเดียวที่ฟ้อง)
   วิธีที่ถูก: หาจุดที่ไกลจากจุดแรกที่สุด ผ่าวงเป็นสองครึ่ง ลดจุดทีละครึ่ง แล้วต่อกลับ */
function dpRing(ring, eps){
  const r = ring.slice(0, -1);                 /* ตัดจุดซ้ำท้ายวงออกก่อน */
  if (r.length < 4) return ring;
  let k = 1, best = -1;
  for (let i = 1; i < r.length; i++){
    const d = (r[i][0]-r[0][0])**2 + (r[i][1]-r[0][1])**2;
    if (d > best){ best = d; k = i; }
  }
  const a = dp(r.slice(0, k+1), eps);
  const b = dp(r.slice(k).concat([r[0]]), eps);
  const out = a.concat(b.slice(1));
  if (out[0][0] !== out[out.length-1][0] || out[0][1] !== out[out.length-1][1]) out.push(out[0]);
  return out;
}
const inBoxLL = (lon,lat) => lon >= LON0 && lon <= LON1 && lat >= LAT0 && lat <= LAT1;
const inBoxXY = (x,y) => x >= -MARGIN && x <= W+MARGIN && y >= -MARGIN && y <= H+MARGIN;
const toXY = (lon,lat) => [+FX(lon,lat).toFixed(1), +FY(lon,lat).toFixed(1)];

function read(file){
  const p = path.join(ROOT, 'vendor', 'naturalearth', file);
  if (!fs.existsSync(p)){ console.log(`  ⚠ ไม่เจอ ${file} — ข้ามชั้นนี้`); return null; }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/* ── ชั้นเส้น (แม่น้ำ · ชายฝั่ง) — ตัดเป็นท่อนตามช่วงที่อยู่ในกรอบ ──
   เส้นเดียวเข้า-ออกกรอบได้หลายครั้ง จึง flush ทุกครั้งที่หลุดกรอบ           */
function lineLayer(gj, eps, keepName){
  const out = [], names = new Map();
  if (!gj) return { out, names };
  for (const f of gj.features){
    const g = f.geometry; if (!g) continue;
    const parts = g.type === 'LineString' ? [g.coordinates]
                : g.type === 'MultiLineString' ? g.coordinates : [];
    const pr = f.properties || {};
    const name = keepName ? (pr.name_en || pr.name || null) : null;
    const rank = pr.scalerank != null ? pr.scalerank : 99;
    for (const coords of parts){
      let run = [];
      const flush = () => {
        if (run.length >= 2){
          out.push({ n:name, r:rank, p:dp(run, eps) });
          if (name) names.set(name, (names.get(name)||0) + 1);
        }
        run = [];
      };
      for (const [lon, lat] of coords){
        if (!inBoxLL(lon, lat)){ flush(); continue; }
        const xy = toXY(lon, lat);
        if (!inBoxXY(xy[0], xy[1])){ flush(); continue; }
        run.push(xy);
      }
      flush();
    }
  }
  return { out, names };
}

/* ── ชั้นรูปปิด (ทะเลสาบ) ──
   ⚠ ตัดแบบเส้นไม่ได้ — วงที่ถูกตัดจะกลายเป็นรูปเปิดแล้วระบายสีเละ
     จึงใช้กติกา "เอาทั้งวงหรือไม่เอาเลย": ทุกจุดต้องอยู่ในกรอบ           */
function polyLayer(gj, eps){
  const out = [], names = new Map();
  if (!gj) return { out, names };
  for (const f of gj.features){
    const g = f.geometry; if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates]
                : g.type === 'MultiPolygon' ? g.coordinates : [];
    const pr = f.properties || {};
    const name = pr.name_en || pr.name || null;
    const rank = pr.scalerank != null ? pr.scalerank : 99;
    for (const rings of polys){
      const ring = rings[0];                      /* วงนอกพอ — ทะเลสาบในเรื่องไม่มีเกาะกลาง */
      if (!ring || ring.length < 4) continue;
      if (!ring.every(([lon,lat]) => inBoxLL(lon,lat))) continue;
      const xy = ring.map(([lon,lat]) => toXY(lon,lat));
      if (!xy.every(p => inBoxXY(p[0], p[1]))) continue;
      const simple = dpRing(xy, eps);
      if (simple.length < 4) continue;
      out.push({ n:name, r:rank, p:simple });
      if (name) names.set(name, (names.get(name)||0) + 1);
    }
  }
  return { out, names };
}

console.log('\n── แม่น้ำ ──');
const R = lineLayer(read('ne_10m_rivers_lake_centerlines.geojson'), 2.2, true);
console.log(`  ${R.out.length} ท่อน · ${R.out.reduce((s,l)=>s+l.p.length,0)} จุด · ${R.names.size} สายที่มีชื่อ`);

console.log('── ชายฝั่ง ──');
/* eps หยาบกว่าแม่น้ำ: ชายฝั่งมีรายละเอียดระดับอ่าวเล็ก ๆ ที่ไม่มีความหมายในสเกลนี้ */
const S = lineLayer(read('ne_10m_coastline.geojson'), 3.4, false);
console.log(`  ${S.out.length} ท่อน · ${S.out.reduce((s,l)=>s+l.p.length,0)} จุด`);

console.log('── ทะเลสาบ ──');
const K = polyLayer(read('ne_10m_lakes.geojson'), 2.6);
console.log(`  ${K.out.length} วง · ${K.out.reduce((s,l)=>s+l.p.length,0)} จุด`);
if (K.names.size)
  console.log('  ที่มีชื่อ: ' + [...K.names.keys()].slice(0,14).join(' · '));

if (process.argv.includes('--list')){
  console.log('\nแม่น้ำที่มีชื่อในกรอบ (ท่อน):');
  [...R.names.entries()].sort((a,b) => b[1]-a[1])
    .forEach(([n,c]) => console.log('  ' + String(c).padStart(3) + '  ' + n));
  console.log('\n(--list · ไม่เขียนไฟล์)');
  process.exit(0);
}

const dump = arr => arr.map(l =>
  `  {n:${l.n ? JSON.stringify(l.n) : 'null'},r:${l.r},p:[` +
  l.p.map(p => `[${p[0]},${p[1]}]`).join(',') + ']}').join(',\n');

fs.writeFileSync(path.join(ROOT, 'data', 'water.js'),
`/* water.js — สร้างโดย tools/build_water.js ห้ามแก้ด้วยมือ
 * ชั้นน้ำจาก Natural Earth 10m (สาธารณสมบัติ) ดัดเข้าพิกัดแผ่นด้วย TPS หมุดยึด 20 เมือง
 * พิกัดพิกเซลบน assets/map.jpg (1650x1950) เหมือนทุกอย่างในโปรเจกต์
 *
 * ช่อง: n = ชื่อ (อาจ null) · r = scalerank ยิ่งน้อยยิ่งเด่น · p = จุด
 *       lakes เป็น **วงปิด** (จุดสุดท้ายเท่าจุดแรก) ที่เหลือเป็นเส้นเปิด
 *
 * ⚠⚠ **ข้อมูลนี้เป็นภูมิศาสตร์ *ปัจจุบัน* ไม่ใช่ของคริสต์ศตวรรษที่ 3**
 *   สามอย่างที่รู้ว่าต่างและต้องดัดด้วยมือก่อนใช้จริง:
 *     · **แม่น้ำเหลือง** เปลี่ยนทางครั้งใหญ่หลายรอบหลังยุคสามก๊ก — ท่อนล่างคนละทาง
 *     · **ชายฝั่งอ่าวโป๋ไห่/ปากแม่น้ำเหลือง** งอกออกไปมากตั้งแต่นั้น
 *     · **ทะเลสาบ** ต่างมากที่สุด — ต้งถิงเคยใหญ่กว่านี้มาก ส่วนโพหยางยังไม่เป็นรูปนี้
 *   (บทเรียน §E16 ฉบับกลับด้าน: ข้อมูลจริงสมัยใหม่ก็ "ผิดยุค" ได้เหมือนกัน)
 *
 * ⚠ ความแม่นของการดัด: วัดกับแม่น้ำเว่ยได้ห่างจากที่แผ่นวาดไว้เฉลี่ย 15.6 หน่วย (≈19 กม.)
 *   ตรงไหนที่ขัดกับแผ่นชัด ๆ **ให้เชื่อแผ่น** เพราะหมุดกับถนนทั้งโปรเจกต์ยึดแผ่นอยู่
 */
window.TK = window.TK || {};
window.TK.water = {
 rivers: [
${dump(R.out)}
 ],
 coast: [
${dump(S.out)}
 ],
 lakes: [
${dump(K.out)}
 ]
};
`, 'utf8');
const total = R.out.length + S.out.length + K.out.length;
console.log(`\nเขียน data/water.js แล้ว — รวม ${total} ชิ้น`);
