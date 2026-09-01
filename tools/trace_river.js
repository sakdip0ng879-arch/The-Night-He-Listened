/* trace_river.js — ลากเส้นทางน้ำจาก **landmask จริง** ไม่ใช่จากการมองภาพครอป
 *
 *   node tools\trace_river.js jiangling xiakou
 *   node tools\trace_river.js shouchun jianye --land      (หาทางเลี่ยงน้ำแทน)
 *   node tools\trace_river.js --all                        (ตรวจ edge terrain:"river" ทุกเส้น)
 *
 * ── ทำไมต้องมี (เจ้าของทัก 2026-09-01) ──────────────────────────────────────
 * *"เส้นทางดูไม่ตามแม่น้ำ และมีการใช้เส้นตรงมาก ยิ่งที่เจียนเย่ มันตรงเข้าไปได้เลยเหรอ"*
 * วัดแล้วพบว่าถูกทุกข้อ:
 *   chaisang–jianye  ประกาศเป็น river แต่**แห้งติดต่อกัน 254 หน่วย**
 *   jianye–shouchun  ประกาศเป็น ford  แต่**ไม่แตะน้ำเลยสักหน่วย** (0%)
 * สาเหตุเดียวกันทั้งหมด: **ผมลาก d ด้วยตาจากภาพครอป** ส่วนถนนฝั่งตะวันตกของบทที่ 1–9
 * ถูกลากสะสมมาหลายเซสชันโดยเทียบของจริง — ความต่างจึงไม่ใช่ความบังเอิญ
 *
 * เครื่องมือนี้ไม่เดา มันเดินกริดของ `landmask.js` ด้วย Dijkstra โดยให้
 *   ช่องน้ำ = ถูก · ช่องบก = แพง  (กลับค่าได้ด้วย --land)
 * แล้วลดจุดด้วย Douglas–Peucker ก่อนพิมพ์ออกมาเป็น `d`
 *
 * ⚠ มันไม่ได้ตัดสินว่าเส้นทางนั้น "ถูกประวัติศาสตร์" — มันตัดสินแค่ว่าเส้นที่วาด
 *   **อยู่ในร่องน้ำจริงบนแผ่นหรือเปล่า** ส่วนเรื่องว่าแม่น้ำสายไหนคือสายที่ทัพใช้
 *   ยังเป็นงานของคน
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'roads.js'));
require(path.join(ROOT, 'data', 'landmask.js'));

const TK = window.TK, M = TK.landmask, C = M.cell, ROWS = M.rows;
const GW = ROWS[0].length, GH = ROWS.length;
const isWet = (cx, cy) =>
  cx >= 0 && cy >= 0 && cx < GW && cy < GH && ROWS[cy][cx] !== '1';

/* ── Dijkstra บนกริด 8 ทิศ ────────────────────────────────────────────────
   ค่าผ่านช่อง: น้ำ 1 · บก LAND_COST · ทแยงคูณ √2
   LAND_COST สูงพอให้เลี่ยงบก แต่ไม่ห้าม เพราะเมืองอยู่บนบกเสมอ และแม่น้ำบนแผ่น
   ขาดเป็นช่วง ๆ ตรงที่ป้ายชื่อทับ                                             */
function route(ax, ay, bx, by, opts){
  const LAND = opts.land ? 1 : 60, WATER = opts.land ? 60 : 1;
  const cost = (cx, cy) => (isWet(cx, cy) ? WATER : LAND);
  const s = [Math.round(ax / C), Math.round(ay / C)];
  const t = [Math.round(bx / C), Math.round(by / C)];
  const key = (x, y) => y * GW + x;
  const dist = new Float64Array(GW * GH).fill(Infinity);
  const prev = new Int32Array(GW * GH).fill(-1);
  /* คิวแบบ bucket หยาบ ๆ พอสำหรับกริดขนาดนี้ — ไม่ต้องมี heap ให้ผิดพลาด */
  let frontier = [[s[0], s[1]]];
  dist[key(s[0], s[1])] = 0;
  const D = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while (frontier.length){
    /* หา node ที่ dist ต่ำสุดใน frontier */
    let bi = 0;
    for (let i = 1; i < frontier.length; i++)
      if (dist[key(frontier[i][0], frontier[i][1])] < dist[key(frontier[bi][0], frontier[bi][1])]) bi = i;
    const [cx, cy] = frontier.splice(bi, 1)[0];
    if (cx === t[0] && cy === t[1]) break;
    const dc = dist[key(cx, cy)];
    for (const [dx, dy] of D){
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const w = cost(nx, ny) * (dx && dy ? 1.4142 : 1);
      const nd = dc + w;
      if (nd < dist[key(nx, ny)]){
        dist[key(nx, ny)] = nd; prev[key(nx, ny)] = key(cx, cy);
        frontier.push([nx, ny]);
      }
    }
  }
  const out = [];
  let cur = key(t[0], t[1]);
  if (dist[cur] === Infinity) return null;
  while (cur !== -1){ out.push([(cur % GW) * C + C/2, Math.floor(cur / GW) * C + C/2]); cur = prev[cur]; }
  out.reverse();
  return out;
}

/* ── Douglas–Peucker ─────────────────────────────────────────────────────── */
function simplify(pts, tol){
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => {
    const dx = b[0]-a[0], dy = b[1]-a[1];
    if (!dx && !dy) return Math.hypot(p[0]-a[0], p[1]-a[1]);
    const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / (dx*dx+dy*dy)));
    return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
  };
  let worst = 0, idx = 0;
  for (let i = 1; i < pts.length-1; i++){
    const d = d2(pts[i], pts[0], pts[pts.length-1]);
    if (d > worst){ worst = d; idx = i; }
  }
  if (worst <= tol) return [pts[0], pts[pts.length-1]];
  return simplify(pts.slice(0, idx+1), tol).slice(0, -1).concat(simplify(pts.slice(idx), tol));
}

/* ── รายงานความเปียกของเส้น ─────────────────────────────────────────────── */
function wetness(pts){
  let wet = 0, total = 0, run = 0, worstDry = 0;
  for (let i = 0; i + 1 < pts.length; i++){
    const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
    const L = Math.hypot(x2-x1, y2-y1), k = Math.max(1, Math.ceil(L/2));
    for (let j = 0; j < k; j++){
      const x = x1 + (x2-x1)*j/k, y = y1 + (y2-y1)*j/k;
      total += L/k;
      if (isWet(Math.floor(x/C), Math.floor(y/C))){ wet += L/k; run = 0; }
      else { run += L/k; if (run > worstDry) worstDry = run; }
    }
  }
  return { pct: Math.round(wet/total*100), dry: Math.round(worstDry), len: Math.round(total) };
}

function toD(pts){
  return 'M ' + pts.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' L ');
}

/* ★ เส้นหักศอกอ่านเป็น "เส้นที่คนลาก" ไม่ใช่ "แม่น้ำ" — มนมุมด้วย Q ที่จุดกึ่งกลาง
   (เทคนิคเดียวกับที่ builder ใช้มนรอยต่อ node · R_JUNC=12 ใน roads.js)
   ⚠ การมนมุมตัดโค้ง = เส้นอาจหลุดร่องน้ำ จึงต้อง**วัดความเปียกของเส้นที่มนแล้ว**
     ไม่ใช่ของเส้นดิบ (ตัวเลขที่พิมพ์ออกมาคือของเส้นที่มนแล้ว) */
function smoothD(pts){
  if (pts.length < 3) return toD(pts);
  const r = v => Math.round(v);
  let d = `M ${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++){
    const mx = (pts[i][0] + pts[i+1][0]) / 2, my = (pts[i][1] + pts[i+1][1]) / 2;
    d += ` Q ${r(pts[i][0])},${r(pts[i][1])} ${r(mx)},${r(my)}`;
  }
  const last = pts[pts.length-1];
  d += ` L ${r(last[0])},${r(last[1])}`;
  return d;
}

/* สุ่มจุดตาม d ที่มี Q เพื่อวัดความเปียกของเส้นจริงที่จะถูกวาด */
function sampleD(d, step){
  const out = []; const re = /([MLQ])([^MLQ]*)/g; let m, cur = null;
  while ((m = re.exec(d))){
    const n = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'M'){ cur = [n[0], n[1]]; out.push(cur); }
    else if (m[1] === 'L'){
      const p2 = [n[0], n[1]], L = Math.hypot(p2[0]-cur[0], p2[1]-cur[1]);
      const k = Math.max(1, Math.ceil(L/step));
      for (let j = 1; j <= k; j++) out.push([cur[0]+(p2[0]-cur[0])*j/k, cur[1]+(p2[1]-cur[1])*j/k]);
      cur = p2;
    } else {
      const c = [n[0], n[1]], p2 = [n[2], n[3]];
      const k = Math.max(2, Math.ceil(Math.hypot(p2[0]-cur[0], p2[1]-cur[1])/step));
      for (let j = 1; j <= k; j++){
        const t = j/k, u = 1-t;
        out.push([u*u*cur[0] + 2*u*t*c[0] + t*t*p2[0], u*u*cur[1] + 2*u*t*c[1] + t*t*p2[1]]);
      }
      cur = p2;
    }
  }
  return out;
}

/* ── main ────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const land = argv.includes('--land');
const args = argv.filter(a => !a.startsWith('--'));

if (argv.includes('--all')){
  console.log('ตรวจทุก edge ที่ประกาศ terrain:"river" — เทียบเส้นที่วาดไว้กับร่องน้ำจริง\n');
  console.log('edge'.padEnd(24) + 'ที่วาดไว้'.padEnd(22) + 'ที่ trace ได้');
  for (const e of TK.edges){
    if (e.terrain !== 'river' || !e.d) continue;
    const n = e.d.match(/-?[\d.]+/g).map(Number); const cur = [];
    for (let i = 0; i + 1 < n.length; i += 2) cur.push([n[i], n[i+1]]);
    const a = TK.places[e.a], b = TK.places[e.b];
    const p = route(a.x, a.y, b.x, b.y, { land:false });
    const w0 = wetness(cur), w1 = p ? wetness(simplify(p, 5)) : null;
    console.log((e.a+'–'+e.b).padEnd(24) +
      `เปียก ${String(w0.pct).padStart(3)}% แห้งสุด ${String(w0.dry).padStart(3)}u`.padEnd(22) +
      (w1 ? `เปียก ${String(w1.pct).padStart(3)}% แห้งสุด ${String(w1.dry).padStart(3)}u` : 'หาไม่เจอ'));
  }
  process.exit(0);
}

if (args.length < 2){ console.error('ใช้: node tools/trace_river.js <nodeA> <nodeB> [--land]'); process.exit(1); }
const [ka, kb] = args;
const A = TK.places[ka], B = TK.places[kb];
if (!A || !B){ console.error('ไม่พบหมุด ' + (A?kb:ka)); process.exit(1); }

const raw = route(A.x, A.y, B.x, B.y, { land });
if (!raw){ console.error('หาเส้นทางไม่เจอ'); process.exit(1); }
const pts = simplify(raw, 5);
pts[0] = [A.x, A.y]; pts[pts.length-1] = [B.x, B.y];
/* ★ วัดจาก **เส้นที่มนมุมแล้ว** ไม่ใช่เส้นดิบ — การมนมุมตัดโค้ง เส้นจึงอาจหลุด
   ร่องน้ำได้ ถ้าวัดจากเส้นดิบจะได้ตัวเลขที่สวยกว่าของจริง (บทเรียน §E15 อีกรอบ) */
const d = smoothD(pts);
const w = wetness(sampleD(d, 2));
console.log(`${ka} → ${kb}  (${land ? 'เลี่ยงน้ำ' : 'ตามน้ำ'})`);
console.log(`  ยาว ${w.len}u · เปียก ${w.pct}% · ช่วงแห้งยาวสุด ${w.dry}u · จุด ${pts.length}`);
console.log('\n    d:"' + d + '",\n');
