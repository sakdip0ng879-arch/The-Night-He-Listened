/* build_plate_water.js — เฟส 1 ของโครงการ "วาดแผ่นใหม่" (DECISIONS §14 · เปิดใหม่ 2026-09-05)
 *
 *   node tools\build_plate_water.js --measure    วัดอย่างเดียว ไม่เขียนไฟล์
 *   node tools\build_plate_water.js              สร้าง data/plate_water.js
 *
 * รับ  : tools/_plate_water.rle   (สร้างโดย tools\plate_ink.ps1 — หมึกน้ำของแผ่นเอง)
 * ส่ง  : data/plate_water.js      พิกัดแผ่น 1650×1950 ชุดเดิม · **กฎ 4 ไม่ถูกละเมิด**
 * ตรวจ : node tools\check_water.js          เทียบกับ data/landmask.js (สกัดคนละครั้ง คนละเครื่องมือ)
 *        tools/water_check.html             ดูด้วยตา — เส้นของเราทับต้นฉบับ + โหมดแผ่นใหม่
 *
 * ★★ หลักที่ต่างจากรอบที่ล้ม: **ต้นแบบคือแผ่นเอง ไม่ใช่ Natural Earth**
 *    ความคลาดจากถนน 98 เส้นและหมุด 73 จุดที่ปักไว้แล้ว = **ศูนย์โดยนิยาม** ไม่ใช่ 15.6 หน่วย
 *
 * ── สามขั้นที่ต้องทำตามลำดับนี้เท่านั้น ──────────────────────────────────
 *   1. ลบกรอบตัวอักษร `WEI` (แผ่นพิมพ์ด้วยหมึกน้ำเงิน · กรอบของ §3)
 *   2. แยก "น้ำเปิด" ออกจาก "สายน้ำ" ด้วย **ความหนา** (opening ที่ FAT=6)
 *      ⚠ ห้ามแยกด้วยชิ้นส่วน — แม่น้ำที่ไหลลงทะเลต่อกับทะเลจริง ๆ (ดูหมายเหตุที่ splitOpen)
 *   3. น้ำเปิด → รูปปิด · สายน้ำ → thinning → กราฟ → ตัดหนวด → ลดจุด
 *
 * ── เกณฑ์ทุกข้อมาจากการวัด ไม่ได้เดา (ดู --measure) ────────────────────────
 *   ทะเล      น้ำเปิดที่แตะขอบแผ่นและใหญ่กว่า 10,000 px
 *   ทะเลสาบ   น้ำเปิดก้อนอื่นที่ใหญ่กว่า 150 px (วังน้ำกว้างก็วาดเป็นรูปปิดเหมือนกัน)
 *   ตัวอักษร  หนาสุด < 5 · เต็มกล่อง >= 0.35 · ด้านยาว <= 60 (ชื่อแม่น้ำ italic ของแผ่น)
 *   สายน้ำ    ที่เหลือ
 *
 * ⚠ ตัวอักษรกับแม่น้ำสายเล็กมีขนาดพอกัน **แยกด้วยความทึบ ไม่ใช่ด้วยขนาด**
 *   ตัวอักษรเต็มกล่อง 0.37–0.66 · แม่น้ำที่เล็กที่สุดเต็มกล่อง 0.22 — ช่องว่างกว้างพอ
 *
 * ผลที่วัดได้ (2026-09-05): ทะเล 4 · เกาะ 2 · ทะเลสาบ 13 · สายน้ำ 255 เส้น 1,950 จุด · 34.4 KB
 *   check_water: ครอบคลุม 89.3% · ไม่เกินตัว 85.9% · หลุมใหญ่สุดทั้งแปดคือป้ายที่เราตั้งใจลบ
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── อ่าน mask แบบ run-length ─────────────────────────────────────────── */
function readRle(file){
  const txt = fs.readFileSync(file, 'utf8').split('\n');
  const [W, H] = txt[0].trim().split(/\s+/).map(Number);
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++){
    const line = txt[y + 1];
    if (!line) continue;
    for (const run of line.trim().split(' ')){
      if (!run) continue;
      const i = run.indexOf(':');
      const st = +run.slice(0, i), len = +run.slice(i + 1);
      m.fill(1, y * W + st, y * W + st + len);
    }
  }
  return { W, H, m };
}

/* ── distance transform chamfer 3-4 · คืนระยะถึงฝั่ง หน่วยพิกเซล ────────── */
function dt(W, H, m){
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = m[i] ? INF : 0;
  const D1 = 3, D2 = 4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const i = y * W + x; if (d[i] === 0) continue;
    let v = d[i];
    if (y > 0){
      if (x > 0)     v = Math.min(v, d[i-W-1] + D2);
                     v = Math.min(v, d[i-W]   + D1);
      if (x < W-1)   v = Math.min(v, d[i-W+1] + D2);
    }
    if (x > 0)       v = Math.min(v, d[i-1]   + D1);
    d[i] = v;
  }
  for (let y = H-1; y >= 0; y--) for (let x = W-1; x >= 0; x--){
    const i = y * W + x; if (d[i] === 0) continue;
    let v = d[i];
    if (y < H-1){
      if (x < W-1)   v = Math.min(v, d[i+W+1] + D2);
                     v = Math.min(v, d[i+W]   + D1);
      if (x > 0)     v = Math.min(v, d[i+W-1] + D2);
    }
    if (x < W-1)     v = Math.min(v, d[i+1]   + D1);
    d[i] = v;
  }
  for (let i = 0; i < W * H; i++) d[i] /= 3;
  return d;
}

/* ── ชิ้นส่วนต่อเนื่อง 8 ทิศ ───────────────────────────────────────────── */
function components(W, H, m){
  const lab = new Int32Array(W * H), stack = new Int32Array(W * H), comps = [];
  for (let p = 0; p < W * H; p++){
    if (!m[p] || lab[p]) continue;
    const id = comps.length + 1;
    let sp = 0; stack[sp++] = p; lab[p] = id;
    let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    const px = [];
    while (sp > 0){
      const q = stack[--sp]; n++; px.push(q);
      const qx = q % W, qy = (q / W) | 0;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
        if (!dx && !dy) continue;
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (m[np] && !lab[np]){ lab[np] = id; stack[sp++] = np; }
      }
    }
    comps.push({ id, n, x0, y0, x1, y1, px });
  }
  return { lab, comps };
}

/* ── ★★ แยก "น้ำเปิด" (ทะเล+ทะเลสาบ) ออกจาก "สายน้ำ" ────────────────────
   ⚠⚠ **ห้ามแยกด้วยชิ้นส่วน** — ฮวงโหตอนล่างกับแยงซีตอนล่าง *ต่อกับทะเลจริง ๆ*
   ชิ้นส่วนของทะเลจึงลากหนวดขึ้นไปตามแม่น้ำหลายร้อยหน่วย · เห็นชัดตอนตรวจภาพรอบแรก:
   ขอบทะเลวิ่งขึ้นไปถึงลั่วหยางทางเหนือ และลงไปถึงกว่างโจวทางใต้ ทั้งที่นั่นคือแม่น้ำ

   วิธีที่ถูกคือแยกด้วย **ความหนา** ด้วยการเปิดทางสัณฐาน (opening):
     แกนน้ำเปิด = พิกเซลที่หนา >= FAT  →  ขยายกลับ FAT
   → ปากแม่น้ำถูกตัดตรงจุดที่ลำน้ำกว้างเกิน 2×FAT พอดี ซึ่งเป็นที่ที่ควรตัดจริง ๆ

   FAT = 6 มาจากการวัด: แม่น้ำสายหลักหนา 2.7–5.3 (เว่ย 2.7 · แยงซี 4.0 · ฮวงโห 5.3)
   ส่วนทะเลสาบต้งถิง 11.0 · ทะเล 14.3–142.3 — 6 อยู่กลางช่องว่างที่กว้างที่สุด        */
const FAT = 6, MARGIN = 8, SEA_MIN = 10000;
function splitOpen(W, H, m, D){
  const N = W * H;
  const notCore = new Uint8Array(N);
  for (let i = 0; i < N; i++) notCore[i] = (m[i] && D[i] >= FAT) ? 0 : 1;
  const dCore = dt(W, H, notCore);              /* ระยะจากทุกจุดถึงแกนน้ำเปิดที่ใกล้สุด */
  /* กัดเข้า FAT แล้วขยายกลับ FAT เท่ากันเป๊ะ = morphological opening ตามนิยาม
     ⚠ เคยลองขยายกลับมากกว่า (FAT+3) เพราะนึกว่า "เส้นคู่" ที่ปากฮวงโหเป็นริมที่เหลือ
       จากการเปิด — **เข้าใจผิด** เปิดภาพซูมดูแล้วพบว่าแผ่นวาดฮวงโหกับ Qi River
       ขนานกันจริงตรงนั้น เราลอกถูกทั้งสองสาย · จึงถอนออก ไม่มีริมให้กลืน       */
  const open = new Uint8Array(N), thin_ = new Uint8Array(N);
  for (let i = 0; i < N; i++){
    if (!m[i]) continue;
    if (dCore[i] <= FAT) open[i] = 1; else thin_[i] = 1;
  }
  return { open, thin: thin_ };
}

/* น้ำเปิด: ทะเล = แตะขอบแผ่นและใหญ่ · ที่เหลือ = ทะเลสาบ/วังน้ำ (วาดเป็นรูปปิดเหมือนกัน) */
function classifyOpen(W, H, comps){
  for (const c of comps){
    c.w = c.x1-c.x0+1; c.h = c.y1-c.y0+1;
    c.edge = c.x0 <= MARGIN || c.y0 <= MARGIN || c.x1 >= W-1-MARGIN || c.y1 >= H-1-MARGIN;
    c.kind = (c.edge && c.n > SEA_MIN) ? 'sea' : (c.n >= 150 ? 'lake' : 'noise');
  }
  return comps;
}

/* สายน้ำ: ต้องคัด **ตัวอักษรสีน้ำเงินที่แผ่นพิมพ์ไว้** ออก (ชื่อแม่น้ำ italic)
   ⚠ ตัวอักษรกับแม่น้ำสายเล็กขนาดพอกัน — แยกด้วย *ความทึบ* ไม่ใช่ด้วย *ขนาด*
     ตัวอักษรเต็มกล่อง 0.37–0.66 · แม่น้ำที่เล็กที่สุดเต็มกล่อง 0.22 — ช่องว่างกว้างพอ  */
function classifyThin(W, H, comps, D){
  for (const c of comps){
    let mx = 0;
    for (const p of c.px) if (D[p] > mx) mx = D[p];
    c.maxD = mx;
    c.w = c.x1-c.x0+1; c.h = c.y1-c.y0+1;
    c.fill = c.n / (c.w * c.h);
    if (c.n < 40)                                                      c.kind = 'noise';
    else if (c.maxD < 5 && c.fill >= 0.35 && Math.max(c.w, c.h) <= 60) c.kind = 'text';
    else                                                               c.kind = 'river';
  }
  return comps;
}

/* ── ลากเส้นขอบรูปปิด (Moore boundary tracing) ─────────────────────────── */
const N8 = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
function contour(W, H, isIn, start){
  const out = [];
  let cx = start % W, cy = (start / W) | 0, dir = 0;
  const sx = cx, sy = cy;
  let guard = 0;
  do {
    out.push([cx, cy]);
    let found = false;
    for (let k = 0; k < 8; k++){
      const d = (dir + 6 + k) % 8;            /* เริ่มมองจากทางซ้ายของทิศที่เพิ่งเดินมา */
      const nx = cx + N8[d][0], ny = cy + N8[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (isIn(ny * W + nx)){ cx = nx; cy = ny; dir = d; found = true; break; }
    }
    if (!found) break;
  } while ((cx !== sx || cy !== sy) && ++guard < 3000000);
  return out;
}

/* ── Zhang–Suen thinning → เส้นแกนกลางหนา 1 พิกเซล ────────────────────── */
function thin(W, H, src){
  const m = Uint8Array.from(src);
  const idx = [];
  for (let i = 0; i < W*H; i++) if (m[i]) idx.push(i);
  let changed = true, pass = 0;
  while (changed && pass < 80){
    changed = false;
    for (let sub = 0; sub < 2; sub++){
      const kill = [];
      for (const i of idx){
        if (!m[i]) continue;
        const x = i % W, y = (i / W) | 0;
        if (x < 1 || y < 1 || x >= W-1 || y >= H-1) continue;
        const P0 = m[i-W], P1 = m[i-W+1], P2 = m[i+1],   P3 = m[i+W+1],
              P4 = m[i+W], P5 = m[i+W-1], P6 = m[i-1],   P7 = m[i-W-1];
        const P = [P0,P1,P2,P3,P4,P5,P6,P7];        /* N NE E SE S SW W NW */
        let B = 0; for (let k = 0; k < 8; k++) B += P[k];
        if (B < 2 || B > 6) continue;
        let A = 0;
        for (let k = 0; k < 8; k++) if (!P[k] && P[(k+1) % 8]) A++;
        if (A !== 1) continue;
        const ok = sub === 0
          ? (P0*P2*P4 === 0 && P2*P4*P6 === 0)
          : (P0*P2*P6 === 0 && P0*P4*P6 === 0);
        if (ok) kill.push(i);
      }
      if (kill.length){ for (const i of kill) m[i] = 0; changed = true; }
    }
    pass++;
  }
  /* ⚠ Zhang–Suen ทิ้งบล็อก 2×2 ไว้ตามมุมเลี้ยว — ถ้าไม่เก็บ บล็อกพวกนี้จะกลายเป็น
     "จุดแยก" ปลอมตอนสร้างกราฟ แล้วเส้นเดียวจะแตกเป็นท่อนละสองจุด (เจอจริงรอบแรก:
     แกนกลาง 15,664 px กลายเป็น 8,992 เส้น) */
  for (let y = 0; y < H-1; y++) for (let x = 0; x < W-1; x++){
    const i = y*W + x;
    if (m[i] && m[i+1] && m[i+W] && m[i+W+1]) m[i+W+1] = 0;
  }
  return m;
}

/* ── โครงกระดูก → เส้น polyline ─────────────────────────────────────────
   จุดต่อ (deg != 2) เป็นหัวเส้น · เดินตามช่วง deg=2 จนถึงจุดต่อถัดไป
   วงปิดที่ไม่มีจุดต่อเลยเก็บทีหลัง                                        */
function skeletonLines(W, H, sk){
  /* ★★ นับเพื่อนบ้านแบบ "ตัดเส้นทแยงที่ซ้ำซ้อน"
     บนเส้นที่วิ่งเป็นบันได พิกเซลกลางเส้นมีเพื่อนบ้านดิบ 3 ตัว (ตรงสองทแยงหนึ่ง)
     ถ้านับตรง ๆ มันจะถูกอ่านเป็นจุดแยกทุกก้าว → เส้นแตกละเอียด
     กติกา: เส้นทแยงจะนับก็ต่อเมื่อ **ไปถึงกันทางช่องตรงไม่ได้** */
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : sk[y*W + x];
  const nb = i => {
    const x = i % W, y = (i / W) | 0, out = [];
    for (const d of [[1,0],[0,1],[-1,0],[0,-1]]){
      const nx = x + d[0], ny = y + d[1];
      if (at(nx, ny)) out.push(ny * W + nx);
    }
    for (const d of [[1,1],[-1,1],[-1,-1],[1,-1]]){
      const nx = x + d[0], ny = y + d[1];
      if (!at(nx, ny)) continue;
      if (at(nx, y) || at(x, ny)) continue;         /* อ้อมทางช่องตรงได้อยู่แล้ว */
      out.push(ny * W + nx);
    }
    return out;
  };
  const deg = new Map(), pts = [];
  for (let i = 0; i < W*H; i++) if (sk[i]){ pts.push(i); deg.set(i, nb(i).length); }

  const used = new Set();
  const key = (a, b) => a < b ? a + '_' + b : b + '_' + a;
  const lines = [];

  for (const s of pts){
    if (deg.get(s) === 2) continue;               /* เริ่มจากปลายหรือจุดแยกเท่านั้น */
    for (const first of nb(s)){
      if (used.has(key(s, first))) continue;
      const line = [s];
      let prev = s, cur = first;
      used.add(key(prev, cur)); line.push(cur);
      while (deg.get(cur) === 2){
        const nx = nb(cur).find(j => j !== prev);
        if (nx === undefined) break;
        used.add(key(cur, nx));
        prev = cur; cur = nx; line.push(cur);
      }
      lines.push(line);
    }
  }
  for (const s of pts){                            /* วงปิดล้วน */
    if (deg.get(s) !== 2) continue;
    const n0 = nb(s);
    if (n0.some(j => used.has(key(s, j)))) continue;
    const line = [s];
    let prev = s, cur = n0[0];
    used.add(key(prev, cur)); line.push(cur);
    while (cur !== s){
      const nx = nb(cur).find(j => j !== prev);
      if (nx === undefined) break;
      used.add(key(cur, nx));
      prev = cur; cur = nx; line.push(cur);
    }
    if (line.length > 8) lines.push(line);
  }
  return lines;
}

/* ── ตัดหนวด: ช่วงที่ปลายข้างหนึ่งเป็นปลายตาย และสั้นกว่า MIN ──────────
   หนวดเกิดจากรอยหยักของหมึกพิมพ์ ไม่ใช่ลำน้ำสาขา — ยาว 3–8 px ทั้งนั้น    */
function prune(lines, MIN){
  let out = lines;
  for (let round = 0; round < 4; round++){
    const d = new Map();
    const bump = p => d.set(p, (d.get(p) || 0) + 1);
    for (const L of out){ bump(L[0]); bump(L[L.length-1]); }
    const keep = out.filter(L =>
      !((d.get(L[0]) === 1 || d.get(L[L.length-1]) === 1) && L.length < MIN));
    if (keep.length === out.length) return keep;
    out = keep;
  }
  return out;
}

/* ── Douglas–Peucker ── */
function dp(pts, eps){
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length-1];
  let idx = -1, max = -1;
  const dx = b[0]-a[0], dy = b[1]-a[1], len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length-1; i++){
    const p = pts[i];
    const d = Math.abs(dy*p[0] - dx*p[1] + b[0]*a[1] - b[1]*a[0]) / len;
    if (d > max){ max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  return dp(pts.slice(0, idx+1), eps).slice(0, -1).concat(dp(pts.slice(idx), eps));
}

module.exports = { readRle, dt, components, splitOpen, classifyOpen, classifyThin,
                   thin, skeletonLines, prune, dp, contour };

/* ══════════════════════════════════════════════════════════════════════════ */
if (require.main === module){
  const MEASURE = process.argv.includes('--measure');
  const SRC = path.join(__dirname, '_plate_water.rle');
  if (!fs.existsSync(SRC)){
    console.error('ไม่เจอ ' + SRC + '\nรัน  powershell -File tools\\plate_ink.ps1  ก่อน');
    process.exit(1);
  }
  const t0 = Date.now();
  const { W, H, m } = readRle(SRC);

  /* ── ★ ลบตัวอักษร `WEI` ที่แผ่นพิมพ์ไว้ด้วย **หมึกสีน้ำเงิน** ──────────────
     ตัวหนังสือชื่อฝ่ายบนแผ่นมีสามคำ: SHU แดง · WU เขียว · **WEI น้ำเงิน**
     สองคำแรกไม่เข้า mask น้ำเลย แต่ WEI เข้า และตัวอักษรมันใหญ่เกินเกณฑ์
     "ตัวอักษร" (ด้านยาว <= 60) → หลุดมาเป็นแม่น้ำ 11 เส้นกลางที่ราบกวานจง

     กรอบนี้ **ไม่ใช่ค่าที่เดาใหม่** — เป็นกรอบเดียวกับที่ §3 วัดด้วย map_inspect
     แล้วยืนยันว่าขอบขวา 725 < 727 ที่แม่น้ำเหลืองเริ่ม และขอบซ้าย 560 > 552
     ที่แม่น้ำสายเล็กจบ → ลบได้โดยไม่กินน้ำจริงสักหน่วย
     ⚠ ใครจะขยับกรอบนี้ ให้รัน `node tools\map_inspect.js 560 470 165 82 --grid 10` ก่อนเสมอ */
  const LABEL_BOXES = [[560, 470, 165, 82]];
  let erased = 0;
  for (const [bx, by, bw, bh] of LABEL_BOXES)
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++){
      const i = y * W + x; if (m[i]){ m[i] = 0; erased++; }
    }
  if (erased) console.log(`ลบหมึกตัวอักษร WEI ออก ${erased.toLocaleString()} px (กรอบของ §3)`);

  let wet = 0; for (let i = 0; i < W*H; i++) if (m[i]) wet++;
  console.log(`mask ${W}×${H} · พิกเซลน้ำ ${wet.toLocaleString()}`);

  const D = dt(W, H, m);
  const { open, thin: thinMask } = splitOpen(W, H, m, D);
  let nOpen = 0, nThin = 0;
  for (let i = 0; i < W*H; i++){ if (open[i]) nOpen++; if (thinMask[i]) nThin++; }
  console.log(`แยกด้วยความหนา FAT=${FAT} → น้ำเปิด ${nOpen.toLocaleString()} px · สายน้ำ ${nThin.toLocaleString()} px`);

  const O = components(W, H, open);   classifyOpen(W, H, O.comps);
  const T = components(W, H, thinMask); classifyThin(W, H, T.comps, D);
  const pick = (S, k) => S.comps.filter(c => c.kind === k);
  const sum  = a => a.reduce((s, c) => s + c.n, 0);

  console.log('\nจำแนกชิ้นส่วน');
  for (const [k, S] of [['sea',O],['lake',O],['river',T],['text',T],['noise',T]])
    console.log(`  ${k.padEnd(6)} ${String(pick(S,k).length).padStart(5)} ชิ้น · ${sum(pick(S,k)).toLocaleString().padStart(9)} px`);

  const texts = pick(T, 'text');
  console.log(`\n  ตัวอักษรสีน้ำเงินที่ตัดออก ${texts.length} ชิ้น (ชื่อแม่น้ำที่แผ่นพิมพ์ไว้)`);
  console.log('  ที่ใหญ่สุดห้าชิ้น: ' + texts.sort((a,b)=>b.n-a.n).slice(0,5)
      .map(c => `${c.n}px ${c.w}×${c.h} ที่ ${c.x0},${c.y0}`).join(' · '));

  if (MEASURE){ console.log('\n--measure : ไม่เขียนไฟล์'); process.exit(0); }

  /* ── รูปปิด ──────────────────────────────────────────────────────────── */
  const topLeft = c => {
    let best = c.px[0];
    for (const p of c.px){
      const py = (p/W)|0, qy = (best/W)|0;
      if (py < qy || (py === qy && p % W < best % W)) best = p;
    }
    return best;
  };
  const ringOf = (S, c, eps) => {
    const r = dp(contour(W, H, i => S.lab[i] === c.id, topLeft(c)), eps);
    if (r.length > 2){
      const a = r[0], b = r[r.length-1];
      if (a[0] !== b[0] || a[1] !== b[1]) r.push(a);
    }
    return r;
  };
  const sea   = pick(O, 'sea').map(c => ringOf(O, c, 1.6));
  const lakes = pick(O, 'lake').map(c => ringOf(O, c, 1.0));

  /* เกาะ = ผืนดินที่ถูกน้ำเปิดล้อมสนิท (ไม่แตะขอบแผ่น) */
  const notSea = new Uint8Array(W*H);
  for (let i = 0; i < W*H; i++) notSea[i] = 1;
  for (const c of pick(O, 'sea')) for (const p of c.px) notSea[p] = 0;
  const L = components(W, H, notSea);
  const islands = [];
  for (const c of L.comps){
    if (c.n < 60) continue;
    if (c.x0 <= 1 || c.y0 <= 1 || c.x1 >= W-2 || c.y1 >= H-2) continue;   /* แตะขอบ = แผ่นดินใหญ่ */
    const r = ringOf(L, c, 1.0);
    if (r.length > 4) islands.push(r);
  }

  /* ── สายน้ำ → เส้นแกนกลาง ────────────────────────────────────────────── */
  const riv = new Uint8Array(W*H);
  for (const c of pick(T, 'river')) for (const p of c.px) riv[p] = 1;

  const sk = thin(W, H, riv);
  let skn = 0; for (let i = 0; i < W*H; i++) if (sk[i]) skn++;
  const raw = skeletonLines(W, H, sk);
  const kept = prune(raw, 20);
  console.log(`\nแกนกลาง ${skn.toLocaleString()} px · ช่วงดิบ ${raw.length} · ตัดหนวดแล้ว ${kept.length}`);

  /* ⚠ ช่วงที่สั้นกว่า 3 หน่วยคือ **ตัวเชื่อมระหว่างพิกเซลจุดแยกสองตัวที่ติดกัน**
     ไม่ใช่ลำน้ำ · ทิ้งได้เพราะช่องว่าง 1–2 หน่วยเล็กกว่าความกว้างของเส้นที่วาด (4–10) มาก
     — ถ้าไม่ทิ้ง จะมีเส้นสองจุดยาว 0 หน่วยปนอยู่ในข้อมูลนับร้อย                        */
  /* ⚠ เศษเดี่ยว: ช่วงที่ปลายทั้งสองข้างไม่ต่อกับช่วงอื่นเลย และสั้นกว่า 20 หน่วย
     20 หน่วย ≈ 24 กม. — ลำน้ำที่ยาวเท่านั้นและไม่ต่อกับอะไรเลย ไม่มีในธรรมชาติ
     มันคือเศษหมึกของป้าย/ไอคอนที่แผ่นพิมพ์ไว้ (วัดแล้วมี 12 ชิ้น ยาว 2–13 หน่วย)
     ★ แต่ **เส้นเดี่ยวที่ยาว** ห้ามทิ้ง — 10 เส้นในนั้นยาว 80–441 หน่วย และเป็นลำน้ำจริง
       ที่ขาดจากเครือข่ายเพราะป้ายของแผ่นพาดทับ                                       */
  /* ⚠⚠ ลำดับสำคัญ — **ต้องคัดตัวเชื่อมทิ้งก่อน แล้วค่อยนับว่าใครโดดเดี่ยว**
     รอบแรกนับความโดดเดี่ยวจาก `kept` ทั้งกอง ผลคือ 0 ชิ้น ทั้งที่ตรวจข้อมูลออกมา
     แล้วเจอเศษเดี่ยว 12 ชิ้น — เพราะเศษพวกนั้น *เกาะอยู่กับตัวเชื่อมที่กำลังจะถูกทิ้ง*
     มันจึงยังไม่โดดเดี่ยว ณ ตอนนับ · และต้องวนซ้ำด้วย เพราะการทิ้งรอบหนึ่งทำให้
     ชิ้นถัดไปโดดเดี่ยวตามกันเป็นทอด ๆ                                                */
  const arcOf = L2 => {
    let a = 0;
    for (let i = 1; i < L2.length; i++)
      a += Math.hypot(L2[i]%W - L2[i-1]%W, ((L2[i]/W)|0) - ((L2[i-1]/W)|0));
    return a;
  };
  let pool = kept.map(L2 => ({ L2, arc: arcOf(L2) })).filter(o => o.arc >= 3);
  const stub = kept.length - pool.length;
  let orphan = 0;
  for (let round = 0; round < 5; round++){
    const d = new Map();
    for (const o of pool)
      for (const e of [o.L2[0], o.L2[o.L2.length-1]]) d.set(e, (d.get(e) || 0) + 1);
    const next = pool.filter(o =>
      !(o.arc < 20 && d.get(o.L2[0]) === 1 && d.get(o.L2[o.L2.length-1]) === 1));
    if (next.length === pool.length) break;
    orphan += pool.length - next.length;
    pool = next;
  }
  const rivers = [];
  for (const { L2 } of pool){
    const s = dp(L2.map(i => [i % W, (i / W) | 0]), 1.2);
    const p = [], w = [];
    for (const [x, y] of s){ p.push(x, y); w.push(+(D[y*W+x]).toFixed(1)); }
    rivers.push({ p, w });
  }
  console.log(`  ทิ้งตัวเชื่อมจุดแยกที่สั้นกว่า 3 หน่วย ${stub} ชิ้น · เศษเดี่ยวสั้น ${orphan} ชิ้น`);

  /* ── ★★★ ต่อแม่น้ำที่ขาด (เจ้าของทัก 2026-09-05 "ระวังพวกแม่น้ำขาดด้วยนะ") ────
     แม่น้ำบนแผ่นขาดเพราะ **ป้ายชื่อที่พิมพ์ทับมัน** — ตรงที่ป้ายพาด หมึกเป็นสีดำ
     ไม่ใช่สีน้ำเงิน mask น้ำจึงมีรู · ไม่ใช่เพราะแม่น้ำมันจบตรงนั้นจริง

     ⚠ **ห้ามเดาว่าคู่ไหนควรต่อ** — ให้แผ่นเป็นคนตอบ: เชื่อมได้ก็ต่อเมื่อ
     **ช่องว่างนั้นถูกหมึกดำของแผ่นทับอยู่จริง** (คือมีป้ายพาดตรงนั้นให้เห็น)
     นี่คือการทดสอบ *สาเหตุ* ไม่ใช่การทดสอบ *ระยะ* — ปลายสองอันที่บังเอิญอยู่ใกล้กัน
     แต่ไม่มีป้ายคั่น แปลว่ามันคนละสาย ห้ามต่อ

     ช่องว่างที่สั้นกว่า 6 หน่วยยกเว้นให้ — นั่นคือรอยที่ thinning/ตัดหนวดทำเอง ไม่ใช่ป้าย */
  const DARK_SRC = path.join(__dirname, '_plate_dark.rle');
  let dark = null;
  if (fs.existsSync(DARK_SRC)) dark = readRle(DARK_SRC).m;
  else console.log('  ⚠ ไม่เจอ _plate_dark.rle — ข้ามการต่อแม่น้ำ (รัน plate_ink.ps1 ใหม่)');

  const bridges = [];
  if (dark){
    const key = (x, y) => x + ',' + y;
    const deg = new Map();
    for (const r of rivers){
      const n = r.p.length;
      for (const k of [key(r.p[0], r.p[1]), key(r.p[n-2], r.p[n-1])])
        deg.set(k, (deg.get(k) || 0) + 1);
    }
    const ends = [];
    rivers.forEach((r, i) => {
      const n = r.p.length;
      const mkEnd = (x, y, px, py, w) => {
        const L = Math.hypot(x - px, y - py) || 1;
        return { i, x, y, ux:(x - px) / L, uy:(y - py) / L, w };
      };
      const cands = [ mkEnd(r.p[0], r.p[1], r.p[2], r.p[3], r.w[0]),
                      mkEnd(r.p[n-2], r.p[n-1], r.p[n-4], r.p[n-3], r.w[r.w.length-1]) ];
      for (const e of cands) if (deg.get(key(e.x, e.y)) === 1) ends.push(e);
    });

    /* สัดส่วนของช่องว่างที่ถูกหมึกดำ (หรือน้ำ) ทับอยู่ */
    const covered = (A, B) => {
      const steps = Math.max(4, Math.ceil(Math.hypot(B.x-A.x, B.y-A.y)));
      let hitN = 0, tot = 0;
      for (let s = 1; s < steps; s++){
        const t = s / steps;
        const x = Math.round(A.x + (B.x-A.x)*t), y = Math.round(A.y + (B.y-A.y)*t);
        let near = 0;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++){
          const nx = x+dx, ny = y+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (dark[ny*W+nx] || m[ny*W+nx]) near = 1;
        }
        hitN += near; tot++;
      }
      return tot ? hitN / tot : 0;
    };

    const used = new Set();
    const pairs = [];
    for (let a = 0; a < ends.length; a++) for (let b = a+1; b < ends.length; b++){
      const A = ends[a], B = ends[b];
      if (A.i === B.i) continue;
      const dx = B.x-A.x, dy = B.y-A.y, d = Math.hypot(dx, dy);
      if (d > 45 || d < 0.5) continue;
      const nx = dx/d, ny = dy/d;
      if (A.ux*nx + A.uy*ny < 0.5) continue;          /* A ต้องชี้ไปหา B */
      if (B.ux*-nx + B.uy*-ny < 0.5) continue;        /* และ B ต้องชี้กลับมาหา A */
      const wr = Math.max(A.w, B.w) / Math.max(0.1, Math.min(A.w, B.w));
      if (wr > 3) continue;                            /* สายใหญ่ไม่ต่อกับสายจิ๋ว */
      pairs.push({ a, b, d, A, B });
    }
    pairs.sort((p, q) => p.d - q.d);                   /* ใกล้ที่สุดได้จับคู่ก่อน */
    for (const p of pairs){
      if (used.has(p.a) || used.has(p.b)) continue;
      let why = 'ช่องสั้นกว่า 6 หน่วย';
      if (p.d >= 6){
        const cov = covered(p.A, p.B);
        if (cov < 0.55) continue;                      /* ไม่มีป้ายคั่น = คนละสาย */
        why = `หมึกดำคลุม ${(cov*100).toFixed(0)}%`;
      }
      used.add(p.a); used.add(p.b);
      const w = +((p.A.w + p.B.w) / 2).toFixed(1);
      rivers.push({ p:[p.A.x, p.A.y, p.B.x, p.B.y], w:[w, w] });
      bridges.push({ d:p.d, x:p.A.x, y:p.A.y, x2:p.B.x, y2:p.B.y, why });
    }
    console.log(`  ★ ต่อแม่น้ำที่ขาด ${bridges.length} จุด (จากคู่ที่เข้าเกณฑ์ทิศ+ความกว้าง ${pairs.length} คู่)`);
    for (const b of bridges.sort((x, y) => y.d - x.d).slice(0, 12))
      console.log(`      ${b.d.toFixed(0).padStart(3)} หน่วย  ${b.x},${b.y} → ${b.x2},${b.y2}   ${b.why}`);
  }

  /* ── เขียนไฟล์ ──────────────────────────────────────────────────────── */
  const flat = r => '[' + r.map(([x,y]) => x + ',' + y).join(',') + ']';
  const vtx  = rivers.reduce((s, r) => s + r.w.length, 0);
  const out = [];
  out.push('/* plate_water.js — สร้างโดย tools\\build_plate_water.js **ห้ามแก้ด้วยมือ**');
  out.push(' *');
  out.push(' * ชั้นน้ำของ "แผ่นที่เราวาดเอง" (DECISIONS §14 · เปิดใหม่ 2026-09-05)');
  out.push(' * ที่มา: **หมึกน้ำบน assets/map.jpg เอง** ไม่ใช่ Natural Earth');
  out.push(' *   → ความคลาดจากถนน 98 เส้นและหมุด 73 จุดที่ปักไว้แล้ว = ศูนย์โดยนิยาม');
  out.push(' *     (รอบที่ล้มใช้ Natural Earth + TPS แล้วคลาด 15.6 หน่วย — ดู §14)');
  out.push(' *');
  out.push(' * พิกัด = พิกเซลบนกรอบ 1650×1950 ชุดเดียวกับทั้งโปรเจกต์ (กฎ 4)');
  out.push(' *   sea / lakes / islands : รูปปิด [x,y,x,y,...] ปิดวงแล้ว (จุดแรก = จุดสุดท้าย)');
  out.push(' *   rivers                : { p:[x,y,...] แกนกลาง · w:[...] ครึ่งความกว้างที่จุดนั้น }');
  out.push(' *   ★ w มาจากความหนาของหมึกจริงบนแผ่น — ทำเส้นเรียวปลายได้โดยไม่ต้องเดา');
  out.push(' *');
  out.push(` * ${sea.length} ทะเล · ${islands.length} เกาะ · ${lakes.length} ทะเลสาบ · ${rivers.length} สายน้ำ (${vtx} จุด)`);
  out.push(' */');
  out.push('window.TK = window.TK || {};');
  out.push('window.TK.plateWater = {');
  out.push(`  W:${W}, H:${H},`);
  out.push('  sea: [\n' + sea.map(r => '    ' + flat(r)).join(',\n') + '\n  ],');
  out.push('  islands: [\n' + islands.map(r => '    ' + flat(r)).join(',\n') + '\n  ],');
  out.push('  lakes: [\n' + lakes.map(r => '    ' + flat(r)).join(',\n') + '\n  ],');
  out.push('  rivers: [\n' + rivers.map(r =>
    `    {p:[${r.p.join(',')}],w:[${r.w.join(',')}]}`).join(',\n') + '\n  ]');
  out.push('};');
  const js = out.join('\n') + '\n';
  fs.writeFileSync(path.join(ROOT, 'data', 'plate_water.js'), js);

  console.log('\nเขียน data/plate_water.js  ' + (js.length/1024).toFixed(1) + ' KB');
  console.log(`  ทะเล ${sea.length} รูป · เกาะ ${islands.length} รูป · ทะเลสาบ ${lakes.length} รูป`);
  console.log(`  แม่น้ำ ${rivers.length} เส้น · ${vtx.toLocaleString()} จุด`);
  console.log(`  ใช้เวลา ${((Date.now()-t0)/1000).toFixed(1)} วินาที`);
}
