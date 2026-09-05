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
    else if (c.maxD < 5 && c.fill >= 0.30 && Math.max(c.w, c.h) <= 90) c.kind = 'text';
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

  /* ── ★ สำเนาหมึกดิบไว้ให้ "ตัวตรวจกิ่งขาด" ────────────────────────────────
     m จะถูกลบทีหลังอีกหลายชั้น (กล่องคำ · ตัวอักษร · กรอบป้าย · กติกาเครือข่าย)
     ตัวตรวจท้ายไฟล์ต้องเทียบกับ **หมึกที่แผ่นมีจริง** ไม่ใช่ของที่เรากรองแล้ว
     เก็บหลังลบกรอบ WEI เพราะกรอบนั้น §3 วัดแล้วว่าไม่กินน้ำจริงสักหน่วย */
  const m0 = Uint8Array.from(m);

  /* ══ ★★★ ห้ามลบหมึกที่อยู่ *ลึกในผืนน้ำ* ═══════════════════════════════
     เจ้าของชี้ด้วยวงเขียว (2026-09-05): ทะเลสาบหลายลูกแหว่งเป็นรูสี่เหลี่ยม
     — ต้นตอคือแผ่นเขียนชื่อทะเลสาบ (Lake Kun Ba · Lake Dong Ting · Lake Tai Hu)
     **ทับลงบนตัวทะเลสาบเอง** พอเราลบกล่องคำ ก็ลบเนื้อทะเลสาบไปด้วยเป็นสี่เหลี่ยม

     ★ กติกา: ตัวอักษรเป็นเส้นบาง (หนา 2–3 px) · เนื้อผืนน้ำหนา
       ถ้าพิกเซลอยู่ห่างจากขอบน้ำเกิน 4 px แปลว่ามันอยู่ *กลางผืนน้ำ* — ลบไม่ได้
       และไม่จำเป็นต้องลบด้วย เพราะตัวอักษรบนทะเลสาบมีสีเดียวกับทะเลสาบอยู่แล้ว
       ลบหรือไม่ลบก็เห็นเหมือนกัน แต่ลบแล้ว **เจาะรู** */
  const D0 = dt(W, H, m0);
  /* ★ ผืนน้ำเปิดของแผ่น คิดจาก m0 **ก่อน** ตัวกรองตัวหนังสือทุกตัว
     ทะเลสาบคือน้ำ จบ — ห้ามตัวกรองไหนแตะ ไม่ว่ารูปร่างหลังโดนป้ายทับจะออกมาเป็นอะไร */
  const { open: OPEN0 } = splitOpen(W, H, m0, D0);
  const DEEP = 4;

  /* ══ ★★★ "แขนของทะเลสาบ" — น้ำที่งอกออกจากผืนน้ำเปิด ═══════════════════
     เจ้าของชี้ด้วยวงเขียว (2026-09-05): ทะเลสาบคุนหมิง/หงเจ๋อ เหลือแต่ก้อนกลาง
     แขนที่ยื่นออกมาหายหมด เพราะแขนกว้างราว 10 px → นับเป็น "น้ำบาง" → เป็นสายน้ำ
     แล้วกติกาเครือข่ายตัดมันทิ้งในฐานะ "หนวดสั้นกว่า 30"

     ★ เดินจากผืนน้ำเปิดออกไปตามหมึกน้ำจริง 25 px — ได้เท่าไรคือเนื้อของแหล่งน้ำนั้น
       **ห้ามตัวกรองไหนตัดทิ้ง** · ตัวอักษรที่วางข้าง ๆ ไม่ติดกันจึงเดินไปไม่ถึง */
  const NEARLAKE = new Uint8Array(W*H);
  {
    const dist = new Int16Array(W*H).fill(-1);
    let q = [];
    for (let i = 0; i < W*H; i++) if (OPEN0[i]){ dist[i] = 0; NEARLAKE[i] = 1; q.push(i); }
    const LIM = 25;
    while (q.length){
      const nq = [];
      for (const i of q){
        if (dist[i] >= LIM) continue;
        const x = i % W, y = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
          const nx = x+dx, ny = y+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny*W + nx;
          if (dist[j] >= 0 || !m0[j]) continue;
          dist[j] = dist[i] + 1; NEARLAKE[j] = 1; nq.push(j);
        }
      }
      q = nq;
    }
  }

  /* รายงานสำหรับ tools\cut_sheet.html — แผ่นตรวจด้วยตา (ดู DECISIONS §14 เฟส 4.5) */
  const REPORT = { cut: [], orphan: [] };
  let BRIDGES = [];   /* สะพานที่เย็บไว้ตอนต่อเส้น — กติกาเครือข่ายข้างล่างต้องเห็นด้วย */

  /* ★ ป้าย "ทิ้งเพราะอะไร" รายพิกเซล — ทุกตัวกรองต้องมาลงชื่อไว้ที่นี่
     ถ้ามีตัวกรองไหนไม่ลงชื่อ รายงานท้ายไฟล์จะขึ้นว่า "ไม่ทราบ" = สัญญาณอันตราย */
  const WHY = new Uint8Array(W*H);
  const WHYNAME = ['ไม่ทราบ','กล่องคำ','กติกาเครือข่าย','ตัวอักษร','กรอบป้าย','เศษเล็ก','น้ำเปิด'];

  /* ══ ★★★ ทะเบียน "หมึกที่เราประดิษฐ์เอง" ═══════════════════════════════
     เจ้าของ (รอบหก): *"อย่างที่สองคือการเชื่อมที่เฟค แค่กดย้อมดูแผนที่อันเดิม
      ก็เห็นชัดแล้ว ... เราต้องเอาให้ถูกที่ควรก่อน เพราะถ้าเราจะทำให้ทางน้ำสวยขึ้น
      ภายหลัง เราต้องมีทางที่ถูกก่อนจริงไหม"* — **ถูก และสำคัญกว่าตัวเลขทุกตัว**

     ทุกพิกเซลที่ไม่ได้อยู่บนแผ่นเดิมต้องลงทะเบียนที่นี่ พร้อมบอกว่าใครวาด
     แล้ว build เขียน tools/_invented.png ออกมาให้ดูด้วยตาได้ทุกครั้ง
     ★ กติกา: **ถ้ามองแล้วเส้นไหนไม่มีในแผ่น เส้นนั้นผิด ไม่ว่าตัวตรวจจะผ่านหรือไม่** */
  const INV = new Uint8Array(W*H);
  const INVNAME = ['', 'ลอดใต้ป้าย', 'สะพานต่อลำน้ำ', 'เย็บก้อนน้ำไม่มีทางออก'];
  const invMark = (i, code) => { if (!m0[i] && !INV[i]) INV[i] = code; };
  const MADE = [];    /* ทุกเส้นที่เราลากเอง — ให้ invented_sheet.html เอาไปวางเทียบทีละเส้น */
  let sten2 = null;   /* สำเนาลายฉลุ ไว้ให้รายงานท้ายไฟล์ใช้ */

  /* ⚠⚠ **ทางที่ลองแล้วไม่ได้ผล — อย่าลองซ้ำ** (2026-09-05)
     เจ้าของทักว่ายังมีแม่น้ำขาดเพราะไอคอน/ป้ายชื่อเมืองบัง ผมลองอุดที่ *ระดับ mask*
     ก่อน thinning สองแบบ คิดว่าจะได้เส้นที่ไหลต่อเองและ smooth กว่าเอาท่อนไปปะ:
       (ก) closing R=9 รับทุกพิกเซลที่มีหมึกอื่นทับ → เติมคืน 30,167 px · ช่วงดิบ 387 → 1,773
       (ข) เพิ่มเงื่อนไข "ต้องอยู่ระหว่างน้ำสองฝั่ง" (ยิงรังสีสี่แกน) → 12,911 px · ช่วงดิบ 1,253
     **ทั้งสองแบบแย่กว่าไม่ทำ** เพราะป้ายเป็นก้อนทึบ พอถูกดูดเข้ามาเป็นน้ำ โครงกระดูก
     ของก้อนทึบคือใยแมงมุม ไม่ใช่เส้นเดียว · ยิ่งอุดยิ่งได้หนวดเพิ่ม
     ★ บทเรียน: **การเติมพื้นที่ให้ของที่เป็นเส้น ไม่ได้ทำให้เส้นยาวขึ้น มันทำให้เส้นแตก**
     จึงกลับมาต่อที่ระดับ *เส้น* เหมือนเดิม แต่ทำให้สะพานโค้งตามทิศของลำน้ำ (ดูข้างล่าง) */
  let wet = 0; for (let i = 0; i < W*H; i++) if (m[i]) wet++;
  console.log(`mask ${W}×${H} · พิกเซลน้ำ ${wet.toLocaleString()}`);

  /* ══ ★★★ ลบ "คำ" ไม่ใช่ "ตัวอักษร" ══════════════════════════════════════
     เจ้าของ (รอบสี่): *"สิ่งที่สแกนมาพวกตัวหนังสือ หรือไอคอนสี่เหลี่ยม
      มันคิดว่ามันเป็นแม่น้ำหมดเลย"*

     ★ ทำไมตัวกรองทุกแบบก่อนหน้านี้แพ้: **ตัวอักษรที่แตะแม่น้ำจะกลายเป็นชิ้นเดียวกับ
       แม่น้ำ** → กรองระดับชิ้นส่วนไม่เห็น · ระดับเครือข่ายก็ไม่เห็น (มันอยู่บนเครือข่าย)
       · ตัดหนวดก็ไม่ได้ เพราะคำยาว 50–90 หน่วย พอ ๆ กับลำน้ำสาขาจริง

     ★★ ทางออก: **ตัวอักษรมาเป็นคำเสมอ** ในคำหนึ่งมีหลายตัว และส่วนใหญ่
        *ไม่* แตะแม่น้ำ — จับตัวที่แยกอยู่ได้ก่อน แล้วรวมเป็น "คำ" แล้วลบทั้งกล่องคำ
        ตัวที่แตะแม่น้ำอยู่ในกล่องเดียวกัน จึงหายไปด้วย
     ⚠ ลำน้ำที่พาดผ่านกล่องคำจะถูกตัดขาดตรงนั้น — **กติกาทางออกจะเย็บกลับให้เอง**
        (นี่คือเหตุผลที่ต้องมีกติกานั้นก่อน จึงจะกล้าลบแบบนี้ได้)               */
  {
    const D0 = dt(W, H, m);
    const { thin: t0 } = splitOpen(W, H, m, D0);
    const C0 = components(W, H, t0);
    classifyThin(W, H, C0.comps, D0);
    /* ══ ★★★ ชิ้นน้ำบาง ๆ ที่ **ติดผืนน้ำเปิด** ไม่ใช่ตัวอักษร ═══════════════
       เจ้าของชี้ด้วยวงเขียว (2026-09-05): ทะเลสาบคุนหมิง/หงเจ๋อ หายไปเกือบทั้งลูก
       แขนบนของทะเลสาบกว้างราว 10 px → splitOpen เรียกว่า "น้ำบาง"
       แล้วรูปร่างมันสั้นป้อม เข้าเกณฑ์ "ตัวอักษร" พอดี (maxD<5 · fill>=.30 · ด้าน<=90)
       → เราลบแขนของทะเลสาบทิ้ง แล้วเหลือแต่ก้อนกลาง
       ★ ตัวอักษรไม่เคย *ต่อเนื่อง* กับผืนน้ำเปิด (ป้ายวางข้าง ๆ ไม่ได้งอกออกมา)
         อะไรที่งอกจากทะเลสาบ คือทะเลสาบ */
    {
      let saved = 0;
      for (const c of C0.comps){
        if (c.kind !== 'text' && c.kind !== 'labelbox') continue;
        let touch = 0;
        for (const q of c.px){
          const x = q % W, y = (q / W) | 0;
          for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1 && !touch; dx++){
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (OPEN0[ny*W+nx]) touch = 1;
          }
          if (touch) break;
        }
        if (touch){ c.kind = 'river'; saved++; }
      }
      if (saved) console.log(`  ★ ชิ้นที่ติดผืนน้ำเปิด ไม่นับเป็นตัวอักษร ${saved} ชิ้น (แขนของทะเลสาบ)`);
    }
    const letters = C0.comps.filter(c => c.kind === 'text');
    /* รวมตัวอักษรที่อยู่ใกล้กันเป็นคำ (ระยะกล่องถึงกล่อง <= GAP) */
    const GAP = 10;
    const near = (a, b) =>
      a.x0 - GAP <= b.x1 && b.x0 - GAP <= a.x1 && a.y0 - GAP <= b.y1 && b.y0 - GAP <= a.y1;
    const grp = letters.map(() => -1);
    let ng = 0;
    for (let i = 0; i < letters.length; i++){
      if (grp[i] >= 0) continue;
      const q = [i]; grp[i] = ng;
      while (q.length){
        const a = q.pop();
        for (let j = 0; j < letters.length; j++)
          if (grp[j] < 0 && near(letters[a], letters[j])){ grp[j] = ng; q.push(j); }
      }
      ng++;
    }
    const words = [];
    for (let g = 0; g < ng; g++){
      const mem = letters.filter((_, i) => grp[i] === g);
      if (mem.length < 2) continue;                       /* ตัวเดียวไม่ใช่คำ */
      const x0 = Math.min(...mem.map(c => c.x0)) - 2, x1 = Math.max(...mem.map(c => c.x1)) + 2;
      const y0 = Math.min(...mem.map(c => c.y0)) - 2, y1 = Math.max(...mem.map(c => c.y1)) + 2;
      if (Math.max(x1-x0, y1-y0) > 190) continue;         /* กว้างเกินคำ */
      words.push([x0, y0, x1, y1, mem.length, mem]);
    }
    /* ══ ★★★ ลบ **ตัวอักษรจริง ๆ** ไม่ใช่ลบทั้งกล่อง ═════════════════════
       เจ้าของ: *"ลบเกินได้ แต่ใส่เส้นแม่น้ำกลับไป มันแค่นี้เอง"*
       การลบทั้งกล่องสี่เหลี่ยมคือการลบเกินแบบที่ *ไม่รู้ว่าลบอะไรไปบ้าง*
       — ทะเลสาบคุนหมิงโดนเจาะเป็นสี่เหลี่ยมเพราะแบบนี้
       ★ ลบเฉพาะพิกเซลของตัวอักษรเอง (พองออก 1 px กันขอบหยัก)
         สิ่งที่อยู่ในกล่องแต่ไม่ใช่ตัวอักษร = ของคนอื่น ห้ามแตะ */
    let wiped = 0;
    for (const w of words)
      for (const c of w[5])
        for (const q of c.px){
          const x = q % W, y = (q / W) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const i = ny*W + nx;
            if (m[i] && !OPEN0[i] && D0[i] < DEEP){ m[i] = 0; WHY[i] = 1; wiped++; }
          }
        }

    /* ══ ★★★ ลำน้ำ "ลอดใต้ป้าย" — ต่อคืนหลังลบกล่องคำ ═════════════════════
       ⚠ **บั๊กที่ตัวตรวจกิ่งขาดจับได้ตัวที่สอง** (2026-09-05)
       แผ่นพิมพ์ชื่อแม่น้ำ (Wei River · Si River · Yellow River) เป็นหมึกน้ำเงิน
       **ทับลงบนลำน้ำที่มันเรียกชื่อ** — พอเราลบกล่องคำ ลำน้ำใต้ป้ายก็หายไปด้วย
       (เว่ยหนาน/ผู่ปั้นที่เจ้าของบอกว่าหาย คือแม่น้ำเว่ยใต้ป้ายคำว่า "Wei River")

       ★ กติกา: ที่ขอบกล่อง ถ้าหมึกน้ำ **เข้าฝั่งหนึ่งแล้วออกอีกฝั่ง** แปลว่าลำน้ำลอดใต้ป้าย
         → วาดริบบิ้นกว้างเท่าปากทางเข้าเชื่อมสองปากนั้น
         ถ้าเจอปากเดียว = ป้ายวางอยู่ปลายลำน้ำ ไม่ต่อ (การประดิษฐ์ไม่ปลอดภัย) */
    let sewn = 0, sewnPx = 0;
    for (const [x0, y0, x1, y1] of words){
      const ports = [];                                   /* ปากทางที่ขอบกล่อง */
      const scan = (pts, side) => {
        let run = [];
        const flush = () => {
          if (run.length >= 2){
            const cx = run.reduce((s2,p)=>s2+p[0],0)/run.length;
            const cy = run.reduce((s2,p)=>s2+p[1],0)/run.length;
            ports.push({ x:cx, y:cy, w:run.length, side });
          }
          run = [];
        };
        /* วงแหวนต้องหนา 3 px — ลำน้ำที่วิ่งเฉียงตัดคอลัมน์เดียวได้แค่จุดเดียว
           (เจอจริงที่ป้าย "Wei River" x=359 มีหมึกแค่ y=593 แถวเดียว) */
        for (const [px, py, dx, dy] of pts){
          let hit = 0, hx = px, hy = py;
          for (let k = 0; k < 3 && !hit; k++){
            const qx = px + dx*k, qy = py + dy*k;
            if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
            if (m0[qy*W+qx]){ hit = 1; hx = qx; hy = qy; }
          }
          if (hit) run.push([hx, hy]); else flush();
        }
        flush();
      };
      const L = [], R = [], Tp = [], B = [];
      for (let y = y0; y <= y1; y++){ L.push([x0-2, y, -1, 0]); R.push([x1+2, y, 1, 0]); }
      for (let x = x0; x <= x1; x++){ Tp.push([x, y0-2, 0, -1]); B.push([x, y1+2, 0, 1]); }
      scan(L, 'L'); scan(R, 'R'); scan(Tp, 'T'); scan(B, 'B');
      const OPP = { L:'R', R:'L', T:'B', B:'T' };
      /* ★ หลักฐานว่าลำน้ำลอดใต้ป้ายจริง = **หมึกเดิมยังอยู่ใต้เส้นที่จะลาก**
         (ตัวอักษรกับลำน้ำหลอมกันอยู่ใน m0 — ลำน้ำจึงยังทิ้งรอยไว้ให้เห็น)
         ⚠ อย่าใช้ "ความกว้างปากทางต้องใกล้เคียงกัน" เป็นเกณฑ์ — ลำน้ำที่วิ่งเฉียง
           เฉือนวงแหวนได้แค่ 2 px ทั้งที่เป็นสายเดียวกัน (ป้าย "Wei River" w9 ↔ w2) */
      const evidence = (p, q) => {
        const d = Math.hypot(p.x-q.x, p.y-q.y), n = Math.max(4, Math.ceil(d));
        let hit = 0;
        for (let t = 1; t < n; t++){
          const cx = Math.round(p.x + (q.x-p.x)*t/n), cy = Math.round(p.y + (q.y-p.y)*t/n);
          let near = 0;
          for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++){
            const nx = cx+dx, ny = cy+dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (m0[ny*W+nx]) near = 1;
          }
          hit += near;
        }
        return hit / (n-1);
      };
      let best = null;
      for (let i2 = 0; i2 < ports.length; i2++) for (let j2 = i2+1; j2 < ports.length; j2++){
        const a = ports[i2], b = ports[j2];
        /* ★ ข้ามมุมได้ด้วย ไม่ใช่แค่ฝั่งตรงข้าม — ป้ายมักวางคร่อม *ทางโค้ง* ของลำน้ำ
           (ป้าย "Si River" ลำน้ำเข้าด้านบน ออกด้านซ้าย — คู่ฝั่งตรงข้ามจึงไม่มีวันเจอ)
           กันคู่ปลอมด้วยหลักฐานหมึกอย่างเดียว ไม่ใช่ด้วยรูปทรงของกล่อง */
        if (a.side === b.side) continue;
        if (Math.hypot(a.x-b.x, a.y-b.y) < 10) continue;
        const ev = evidence(a, b);
        if (ev < 0.80) continue;                           /* ไม่มีรอยลำน้ำใต้ป้าย */
        const d = Math.hypot(a.x-b.x, a.y-b.y);
        const score = ev + d/2000;                         /* หลักฐานแน่นสุด แล้วค่อยยาวสุด */
        if (!best || score > best.score) best = { a, b, score };
      }
      /* WORDDBG=1 node toolsuild_plate_water.js — ดูปากทางรอบกล่องคำทีละกล่อง */
      if (process.env.WORDDBG) console.log(`    กล่อง ${x0},${y0}-${x1},${y1}  ปาก ` + (ports.map(p=>p.side+Math.round(p.x)+","+Math.round(p.y)+"w"+p.w).join(" ")||"-") + (best?"  → ต่อ":""));
      if (!best) continue;
      const hw = Math.max(1.5, Math.min(5, (best.a.w + best.b.w) / 4));
      const { a, b } = best, dd = Math.hypot(a.x-b.x, a.y-b.y);
      const steps = Math.max(2, Math.ceil(dd*2)), r = Math.ceil(hw);
      for (let t = 0; t <= steps; t++){
        const cx = a.x + (b.x-a.x)*t/steps, cy = a.y + (b.y-a.y)*t/steps;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
          if (dx*dx + dy*dy > hw*hw) continue;
          const nx = Math.round(cx)+dx, ny = Math.round(cy)+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const i = ny*W + nx;
          if (!m[i]){ m[i] = 1; WHY[i] = 0; sewnPx++; } invMark(i, 1);
        }
      }
      MADE.push({ kind:'ลอดใต้ป้าย', x:Math.round(a.x), y:Math.round(a.y),
        x2:Math.round(b.x), y2:Math.round(b.y), why:`หมึกใต้เส้น ${Math.round(best.score*100)}%` });
      sewn++;
    }

    console.log(`ลบกล่องคำที่แผ่นพิมพ์ไว้ ${words.length} คำ (จากตัวอักษร ${letters.length} ตัว) · ${wiped.toLocaleString()} px`);
    if (sewn) console.log(`  ★ ต่อลำน้ำที่ลอดใต้ป้าย ${sewn} ป้าย · ${sewnPx.toLocaleString()} px`);
  }

  const D = dt(W, H, m);
  const { open, thin: thinMask } = splitOpen(W, H, m, D);
  let nOpen = 0, nThin = 0;
  for (let i = 0; i < W*H; i++){ if (open[i]) nOpen++; if (thinMask[i]) nThin++; }
  console.log(`แยกด้วยความหนา FAT=${FAT} → น้ำเปิด ${nOpen.toLocaleString()} px · สายน้ำ ${nThin.toLocaleString()} px`);

  const O = components(W, H, open);   classifyOpen(W, H, O.comps);
  const T = components(W, H, thinMask); classifyThin(W, H, T.comps, D);

  /* ── ★★ คัด **กรอบป้ายสี่เหลี่ยมสีน้ำเงิน** ของแผ่นออกจากชั้นแม่น้ำ ──────────
     แผ่นใส่ชื่อหุบเขาไว้ในกล่องเส้นน้ำเงิน ("Xie Gu" · "Luo Gu" · "Zi Wi Gu" ฯลฯ)
     เส้นกรอบเป็นหมึกน้ำเงินเหมือนแม่น้ำเป๊ะ · ตัวกรอง "ตัวอักษร" จับไม่ได้เพราะมันเป็น
     *เส้น* ไม่ใช่ก้อนทึบ → หลุดมาเป็นขีดหักมุมลอย ๆ กลางที่ราบกวานจง
     (เจ้าของเห็นเป็น "ส่วนที่ลอย" — ครอปแผ่นดูแล้วเป็นกรอบป้ายทั้งหมด)

     ★ ลายเซ็นที่ชี้ขาด: **กล่องเล็ก + กลวง + มีตัวหนังสือดำอยู่ข้างใน**
       ข้อสุดท้ายสำคัญที่สุด — กรอบมีไว้ล้อมชื่อ ถ้าไม่มีชื่ออยู่ข้างในก็ไม่ใช่กรอบ  */
  if (fs.existsSync(path.join(__dirname, '_plate_dark.rle'))){
    const dk = readRle(path.join(__dirname, '_plate_dark.rle')).m;
    let nBox = 0;
    for (const c of T.comps){
      if (c.kind !== 'river') continue;
      if (c.w > 115 || c.h > 115) continue;
      if (c.n / (c.w * c.h) > 0.34) continue;                 /* ต้องกลวง */
      /* ⚠⚠ **เงื่อนไขที่ขาดไม่ได้: หมึกต้องเกาะขอบกล่อง** —
         กรอบป้ายคือสี่เหลี่ยม พิกเซลเกือบทั้งหมดจึงอยู่ริมกล่อง
         ส่วนแม่น้ำที่บังเอิญพาดผ่านกล่องเล็ก ๆ จะมีพิกเซลอยู่กลางกล่องเป็นส่วนใหญ่
         ★ ขาดข้อนี้ไปรอบแรก แล้ว **ตัวกรองกินแยงซีช่วงไป๋ตี้–เจียงหลิงทิ้งทั้งท่อน**
           (ชิ้น 923px 104×67 fill 0.13 · รอบตัวมีชื่อเมืองเยอะ เลยเข้าเกณฑ์ทุกข้อ)
           เจ้าของจับได้จากกติกาที่เครื่องไม่เคยรู้: **แม่น้ำต้องมีต้นน้ำ ลอยไม่ได้** */
      const RIM = 3;
      let rim = 0;
      for (const q of c.px){
        const qx = q % W, qy = (q / W) | 0;
        if (qx - c.x0 < RIM || c.x1 - qx < RIM || qy - c.y0 < RIM || c.y1 - qy < RIM) rim++;
      }
      if (rim / c.n < 0.85) continue;                         /* ต้องเป็นกรอบ ไม่ใช่ของที่พาดผ่าน */
      let dark = 0;
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++)
        if (dk[y*W + x]) dark++;
      if (dark < 80) continue;                                /* ต้องมีชื่ออยู่ข้างใน */
      c.kind = 'labelbox'; nBox++;
    }
    if (nBox) console.log(`  ทิ้งกรอบป้ายสี่เหลี่ยมของแผ่น ${nBox} ชิ้น (กรอบชื่อหุบเขา ฯลฯ)`);
  }
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

  /* ★ จำไว้ว่าพิกเซลไหนคือ "ตัวอักษร" ที่เราคัดทิ้งไป — ตอนยืดปลายห้ามเดินเข้าไป
     ไม่งั้นเส้นจะงอกเข้าไปในชื่อแม่น้ำที่แผ่นพิมพ์ไว้ แล้วได้ขีดสั้น ๆ เป็นรูปตัวอักษร
     (เจอจริงแถบฉินหลิ่งตอนไล่ห้าจุดสุดท้าย — เป็นขีดหักมุมสามสี่ขีดกลางที่ราบ) */
  const textPx = new Uint8Array(W*H);
  for (const c of pick(T, 'text')) for (const p of c.px) textPx[p] = 1;

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
  /* ── ★★ ทิ้ง **กรอบป้ายสี่เหลี่ยมสีน้ำเงิน** ที่แผ่นพิมพ์ไว้ ──────────────
     แผ่นใส่ชื่อหุบเขาไว้ในกล่องสี่เหลี่ยมเส้นน้ำเงิน ("Xie Gu" · "Luo Gu" · "Zi Wi Gu" ฯลฯ)
     เส้นกรอบพวกนี้เป็นหมึกน้ำเงินเหมือนแม่น้ำเป๊ะ ตัวกรอง "ตัวอักษร" จับไม่ได้เพราะ
     มันเป็น *เส้น* ไม่ใช่ก้อนทึบ → โผล่มาเป็นขีดหักมุมลอย ๆ กลางที่ราบกวานจง
     (เจ้าของเห็นเป็น "ส่วนที่ลอย" ในภาพ — ครอปแผ่นดูแล้วเป็นกรอบป้ายทั้งหมด)

     ลายเซ็นของมันชัด: **วงปิดเล็ก ๆ** — แม่น้ำไม่วนกลับมาบรรจบตัวเองในกล่อง 100×100 */
  const BOXMAX = 105;
  const isLabelBox = L2 => {
    if (L2.length < 6) return false;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const i of L2){
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (Math.max(x1-x0, y1-y0) > BOXMAX) return false;
    if (L2[0] === L2[L2.length-1]) return true;         /* วงปิด = กรอบเต็มใบ */
    /* ⚠ กรอบส่วนใหญ่ **ไม่ปิด** — ตัวหนังสือข้างในกินเส้นไปด้านหนึ่งสองด้าน
       เหลือเป็นรูปตัว L หรือสามเหลี่ยม · ลายเซ็นที่แน่กว่าคือ
       **มุมหักเกิน 65° ระหว่างท่อนตรงที่ยาวเกิน 12 หน่วยทั้งคู่**
       ลำน้ำในกล่อง 105 หน่วยไม่หักมุมแบบนั้น มันคดเป็นท่อนสั้น ๆ ต่อกัน */
    const q = dp(L2.map(i => [i % W, (i / W) | 0]), 1.5);
    for (let k = 1; k + 1 < q.length; k++){
      const ax = q[k][0]-q[k-1][0], ay = q[k][1]-q[k-1][1];
      const bx = q[k+1][0]-q[k][0], by = q[k+1][1]-q[k][1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 12 || lb < 12) continue;
      if ((ax*bx + ay*by) / (la*lb) < 0.42) return true;
    }
    return false;
  };
  const boxes = kept.filter(isLabelBox).length;
  if (boxes) console.log(`  ทิ้งกรอบป้ายสี่เหลี่ยมของแผ่น ${boxes} ชิ้น (กรอบชื่อหุบเขา ฯลฯ)`);

  let pool = kept.filter(L2 => !isLabelBox(L2))
                 .map(L2 => ({ L2, arc: arcOf(L2) })).filter(o => o.arc >= 3);
  const stub = kept.length - boxes - pool.length;
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

  /* ══ ★★★ ต่อแม่น้ำที่ป้าย/ไอคอนของแผ่นตัดขาด ════════════════════════════
     เจ้าของทักสองรอบ · รอบสอง: *"ตรงที่สแกนมามันไม่ติดลายแม่น้ำ เพราะมันมี icon
     หรือป้ายชื่อเมืองบัง ... มันจะมีส่วนที่ลอย มันไม่ smooth แบบรูปต้นฉบับ"*

     ⚠ **ห้ามเดาว่าคู่ไหนควรต่อ** — ให้แผ่นเป็นคนตอบ: ต่อก็ต่อเมื่อ **ช่องว่างนั้น
     ถูกหมึกอื่นของแผ่นทับอยู่จริง** (ป้าย ไอคอน หรือหมึกภูเขา) คือมีของมาบังให้เห็น
     นี่คือการทดสอบ *สาเหตุ* ไม่ใช่ *ระยะ* — ปลายสองอันที่บังเอิญอยู่ใกล้กันบนกระดาษเปล่า
     แปลว่ามันคนละสาย ห้ามต่อ

     สามอย่างที่ทำให้มันไม่ "ลอย" และไม่ "ไม่ smooth":
       1. **สะพานโค้ง ไม่ใช่ท่อนตรง** — Bezier ที่ออกจากปลายตามทิศของลำน้ำทั้งสองข้าง
          (รอบแรกใช้ท่อนตรงสองจุด อ่านออกทันทีว่าเป็นของปะ)
       2. **วนซ้ำ** — ป้ายใหญ่ตัดลำน้ำเป็นสามสี่ท่อน ต้องเย็บทีละช่องจนหมด
       3. ความกว้างที่จุดต่อไล่จากปลายหนึ่งไปอีกปลาย ไม่ใช่ค่าเฉลี่ยค่าเดียวทั้งสะพาน

     ⚠⚠ ทางที่ลองแล้วไม่ได้ผลอยู่ในหมายเหตุด้านบน (อุดที่ระดับ mask) — อย่าลองซ้ำ */
  /* ⚠ **หลักฐานว่าลำน้ำถูกบัง = หมึกดำ (ป้าย/ไอคอน/ตัวหนังสือ) เท่านั้น**
     เคยรวม _plate_relief (ภูเขา) ไว้ด้วย → สะพานลากผ่านทิวเขาได้โดยอ้างว่า "มีหมึกทับ"
     แต่แผ่นวาดภูเขา *ข้าง* ลำน้ำ ไม่ได้วาดทับจนลำน้ำหาย */
  const inkPaths = ['_plate_dark.rle']
    .map(f => path.join(__dirname, f)).filter(fs.existsSync);
  let ink = null;
  if (inkPaths.length){
    ink = new Uint8Array(W*H);
    for (const f of inkPaths){ const k = readRle(f).m; for (let i = 0; i < W*H; i++) if (k[i]) ink[i] = 1; }
  } else console.log('  ⚠ ไม่เจอ _plate_dark.rle — ข้ามการต่อแม่น้ำ (รัน plate_ink.ps1 ใหม่)');

  /* ══ ★★★ เกณฑ์ของสะพาน — เข้มขึ้นรอบที่หก (2026-09-05) ═════════════════
     เจ้าของ: *"การเชื่อมที่เฟค แค่กดย้อมดูแผนที่อันเดิมก็เห็นชัดแล้ว
      ... เราต้องเอาให้ถูกที่ควรก่อน"*  — เส้นปลอมแย่กว่าเส้นขาด เพราะเส้นขาด
     คนดูรู้ว่าขาด แต่เส้นปลอมคนดูเชื่อว่ามีจริง

     ของเดิม MAXGAP=70 · COVER=0.6 → ได้สะพานยาว 65 หน่วยที่มีหมึกทับแค่ 60%
     ลากผ่านที่โล่งจากเจียงหลิงขึ้นไปจิงโจว **ซึ่งแผ่นไม่ได้วาดไว้เลย**
     ★ ป้าย/ไอคอนที่บังลำน้ำจริงกว้างราว 20–35 หน่วย ไม่ใช่ 65
       → 40 หน่วย · หมึกทับ 85% · ทิศต่างกันไม่เกิน ~53° */
  /* ══ ★★★ บั๊กที่ทำให้ "ลบเกินแล้วไม่ใส่กลับ" (เจ้าของชี้ด้วยวงเขียว 2026-09-05) ═══
     เจ้าของ: *"ลบเกินได้ แต่ใส่เส้นแม่น้ำกลับไป มันแค่นี้เอง"*

     ต้นตอ: ตัวตรวจว่า "ช่องนี้เคยมีอะไรทับอยู่ไหม" อ่านจาก `m` ซึ่งเป็น **สำเนาที่ลบ
     ตัวหนังสือไปแล้ว** · ป้ายชื่อบนแผ่นเป็นหมึก *น้ำเงิน* (เข้า mask น้ำ ไม่เข้า _plate_dark)
     พอเราลบกล่องคำ หลักฐานว่าเคยมีลำน้ำตรงนั้นก็หายไปพร้อมกัน
     → สะพานไม่ผ่านเกณฑ์ → แม่น้ำขาดตรงที่เราลบพอดี ทุกจุดที่เจ้าของวงเขียว

     ★ กติกา: **หลักฐานต้องมาจากแผ่น (m0) ไม่ใช่จากสำเนาที่เราแก้แล้ว (m)**
       ตัวกรองของเราลบอะไรไป ไม่ใช่ธุระของตัวตรวจหลักฐาน */
  const MAXGAP = 40, COS = 0.6, WRATIO = 3.2, COVER = 0.85;
  const bridges = [];
  if (ink){
    const kk = (x, y) => x + ',' + y;
    /* สัดส่วนของช่องว่างที่มีหมึกอื่น (หรือน้ำ) ทับอยู่ */
    const covered = (A, B) => {
      const steps = Math.max(4, Math.ceil(Math.hypot(B.x-A.x, B.y-A.y)));
      let hit = 0, tot = 0;
      for (let s = 1; s < steps; s++){
        const t = s / steps;
        const x = Math.round(A.x + (B.x-A.x)*t), y = Math.round(A.y + (B.y-A.y)*t);
        let near = 0;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++){
          const nx = x+dx, ny = y+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (ink[ny*W+nx] || m0[ny*W+nx]) near = 1;   /* ★ m0 = หมึกของแผ่นจริง ไม่ใช่ m ที่เราลบแล้ว */
        }
        hit += near; tot++;
      }
      return tot ? hit / tot : 0;
    };
    /* สะพานโค้ง — ออกจาก A ตามทิศของ A และเข้า B ตามทิศของ B */
    const curve = (A, B, d) => {
      const k = d / 3;
      const P0 = [A.x, A.y], P1 = [A.x + A.ux*k, A.y + A.uy*k];
      const P2 = [B.x + B.ux*k, B.y + B.uy*k], P3 = [B.x, B.y];
      const out = [];
      const N = Math.max(4, Math.min(9, Math.round(d / 7)));
      for (let s = 1; s < N; s++){
        const t = s / N, u = 1 - t;
        out.push([
          +(u*u*u*P0[0] + 3*u*u*t*P1[0] + 3*u*t*t*P2[0] + t*t*t*P3[0]).toFixed(1),
          +(u*u*u*P0[1] + 3*u*u*t*P1[1] + 3*u*t*t*P2[1] + t*t*t*P3[1]).toFixed(1)
        ]);
      }
      return out;
    };

    for (let round = 0; round < 4; round++){
      const deg = new Map();
      for (const r of rivers){
        const n = r.p.length;
        for (const k of [kk(r.p[0], r.p[1]), kk(r.p[n-2], r.p[n-1])]) deg.set(k, (deg.get(k) || 0) + 1);
      }
      const ends = [];
      rivers.forEach((r, i) => {
        const n = r.p.length;
        const mkEnd = (x, y, px, py, w) => {
          const Ln = Math.hypot(x - px, y - py) || 1;
          return { i, x, y, ux:(x - px) / Ln, uy:(y - py) / Ln, w };
        };
        for (const e of [ mkEnd(r.p[0], r.p[1], r.p[2], r.p[3], r.w[0]),
                          mkEnd(r.p[n-2], r.p[n-1], r.p[n-4], r.p[n-3], r.w[r.w.length-1]) ])
          if (deg.get(kk(e.x, e.y)) === 1) ends.push(e);
      });

      const pairs = [];
      for (let x1 = 0; x1 < ends.length; x1++) for (let x2 = x1+1; x2 < ends.length; x2++){
        const A = ends[x1], B = ends[x2];
        if (A.i === B.i) continue;
        const dx = B.x-A.x, dy = B.y-A.y, d = Math.hypot(dx, dy);
        if (d > MAXGAP || d < 0.5) continue;
        const nx = dx/d, ny = dy/d;
        if (A.ux*nx + A.uy*ny < COS) continue;
        if (B.ux*-nx + B.uy*-ny < COS) continue;
        if (Math.max(A.w, B.w) / Math.max(0.1, Math.min(A.w, B.w)) > WRATIO) continue;
        pairs.push({ a:x1, b:x2, d, A, B });
      }
      pairs.sort((u, v) => u.d - v.d);
      const used = new Set();
      let made = 0;
      for (const q of pairs){
        if (used.has(q.a) || used.has(q.b)) continue;
        let why = 'ช่องสั้นกว่า 6 หน่วย';
        if (q.d >= 6){
          const cov = covered(q.A, q.B);
          if (cov < COVER) continue;
          why = `หมึกทับ ${(cov*100).toFixed(0)}%`;
        }
        used.add(q.a); used.add(q.b);
        const mid = curve(q.A, q.B, q.d);
        const pts = [[q.A.x, q.A.y], ...mid, [q.B.x, q.B.y]];
        const ws = pts.map((_, k) => +(q.A.w + (q.B.w - q.A.w) * (k / (pts.length-1))).toFixed(1));
        rivers.push({ p:pts.flat(), w:ws });
        bridges.push({ d:q.d, x:q.A.x, y:q.A.y, x2:q.B.x, y2:q.B.y, why, round:round+1 });
        made++;
      }
      if (!made) break;
    }
    /* ── ★ สะพานแบบที่สอง: ปลายห้อย → **กลางลำ** ของอีกสาย (จุดบรรจบรูปตัว T) ──
       ลำน้ำสาขาที่ไหลมาบรรจบสายหลักตรงที่มีป้ายพาด จะไม่มี "ปลายคู่" ให้จับ
       เพราะสายหลักวิ่งผ่านไปเฉย ๆ · ต้องหาจุดที่ใกล้ที่สุดบนเส้นอื่นแทน
       เงื่อนไขหลักฐานเหมือนกันทุกข้อ: ต้องมีหมึกของแผ่นทับช่องว่างนั้นอยู่จริง        */
    {
      const kk2 = (x, y) => x + ',' + y;
      const deg = new Map();
      for (const r of rivers){
        const n = r.p.length;
        for (const k of [kk2(r.p[0], r.p[1]), kk2(r.p[n-2], r.p[n-1])]) deg.set(k, (deg.get(k) || 0) + 1);
      }
      const segs = [];
      rivers.forEach((r, i) => {
        for (let k = 0; k + 3 < r.p.length; k += 2)
          segs.push({ i, ax:r.p[k], ay:r.p[k+1], bx:r.p[k+2], by:r.p[k+3], w:r.w[k/2] });
      });
      const tips = [];
      rivers.forEach((r, i) => {
        const n = r.p.length;
        const mkT = (x, y, px, py, w) => {
          const Ln = Math.hypot(x - px, y - py) || 1;
          return { i, x, y, ux:(x - px) / Ln, uy:(y - py) / Ln, w };
        };
        for (const e of [ mkT(r.p[0], r.p[1], r.p[2], r.p[3], r.w[0]),
                          mkT(r.p[n-2], r.p[n-1], r.p[n-4], r.p[n-3], r.w[r.w.length-1]) ])
          if (deg.get(kk2(e.x, e.y)) === 1) tips.push(e);
      });
      let made = 0;
      const done = new Set();                     /* กันเย็บคู่เดิมสองรอบ (ไป-กลับ) */
      for (const A of tips){
        if (done.has(kk2(A.x, A.y))) continue;
        let best = null;
        for (const s of segs){
          if (s.i === A.i) continue;
          const dx = s.bx - s.ax, dy = s.by - s.ay, len2 = dx*dx + dy*dy || 1;
          let t = ((A.x - s.ax)*dx + (A.y - s.ay)*dy) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const px = s.ax + t*dx, py = s.ay + t*dy;
          const d = Math.hypot(px - A.x, py - A.y);
          if (d < 3 || d > MAXGAP) continue;
          if (!best || d < best.d) best = { d, px, py, w:s.w };
        }
        if (!best) continue;
        const nx = (best.px - A.x) / best.d, ny = (best.py - A.y) / best.d;
        /* ⚠ สาขาที่ไหลมาชนสายหลัก **ไม่จำเป็นต้องชี้ตรงเข้าหาจุดที่ใกล้ที่สุด**
           เกณฑ์ทิศจึงผ่อนกว่าการต่อปลายชนปลาย แต่หลักฐานหมึกยังเข้มเท่าเดิม */
        if (A.ux*nx + A.uy*ny < 0.15) continue;
        if (Math.max(A.w, best.w) / Math.max(0.1, Math.min(A.w, best.w)) > WRATIO) continue;
        const cov = covered(A, { x:best.px, y:best.py });
        if (cov < COVER) continue;
        const B = { x:best.px, y:best.py, ux:-nx, uy:-ny, w:best.w };
        const mid = curve(A, B, best.d);
        const pts = [[A.x, A.y], ...mid, [+best.px.toFixed(1), +best.py.toFixed(1)]];
        const ws = pts.map((_, k) => +(A.w + (best.w - A.w) * (k / (pts.length-1))).toFixed(1));
        rivers.push({ p:pts.flat(), w:ws });
        bridges.push({ d:best.d, x:A.x, y:A.y, x2:Math.round(best.px), y2:Math.round(best.py),
                       why:`บรรจบกลางลำ · หมึกทับ ${(cov*100).toFixed(0)}%`, round:9 });
        done.add(kk2(A.x, A.y));
        done.add(kk2(Math.round(best.px), Math.round(best.py)));
        made++;
      }
      if (made) console.log(`  ★ ต่อแบบบรรจบกลางลำอีก ${made} จุด`);
    }

    /* ── ★ รอบสุดท้าย: **ยืดปลายเข้าไปกินน้ำที่ยังเหลือข้างหน้า** ───────────────
       ปลายที่เหลือหลังเย็บสองแบบแล้ว มักเป็นปลายที่ *มีน้ำอยู่ข้างหน้าจริง* แต่ก้อนน้ำนั้น
       ถูกตัวกรอง "ตัวอักษร/เศษ" ตัดทิ้งไป จึงไม่มีเส้นให้ไปบรรจบ
       → เดินหน้าไปตามทิศของลำน้ำทีละหน่วย ตราบใดที่ **mask ของแผ่นยังบอกว่าเป็นน้ำ**
       นี่ไม่ใช่การเดา มันคือการไปเก็บน้ำที่เราทิ้งไว้เองกลับมา                        */
    {
      const kk3 = (x, y) => x + ',' + y;
      const deg = new Map();
      for (const r of rivers){
        const n = r.p.length;
        for (const k of [kk3(r.p[0], r.p[1]), kk3(r.p[n-2], r.p[n-1])]) deg.set(k, (deg.get(k) || 0) + 1);
      }
      /* ⚠ รัศมีต้องเทียบเท่ากับความหยาบของ landmask (ช่องละ 5 หน่วย) ที่ตัวตรวจใช้
         ถ้าแคบกว่านั้น จะมีจุดที่ *ตัวตรวจ* บอกว่ายังมีน้ำ แต่ *ตัวสร้าง* มองไม่เห็น
         แล้วสองฝั่งจะเถียงกันไม่จบ — เจอจริงตอนไล่ห้าจุดสุดท้าย */
      const wetNear = (x, y) => {
        const xi = Math.round(x), yi = Math.round(y);
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
          const nx = xi+dx, ny = yi+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (m[ny*W+nx] && !textPx[ny*W+nx]) return true;
        }
        return false;
      };
      let grown = 0, unit = 0;
      rivers.slice().forEach(r => {
        const n = r.p.length;
        const tipOf = (x, y, px, py, w) => {
          const Ln = Math.hypot(x - px, y - py) || 1;
          return { x, y, ux:(x - px) / Ln, uy:(y - py) / Ln, w };
        };
        for (const A of [ tipOf(r.p[0], r.p[1], r.p[2], r.p[3], r.w[0]),
                          tipOf(r.p[n-2], r.p[n-1], r.p[n-4], r.p[n-3], r.w[r.w.length-1]) ]){
          if (deg.get(kk3(A.x, A.y)) !== 1) continue;
          /* ★★ **เดินตามน้ำ ไม่ใช่พุ่งตรง**
             ⚠ รอบแรกยิงเส้นตรงตามแนวเดิมไปเลย 30 หน่วย ผลคือได้ **ขีดตรงยาว 30 หน่วย**
               งอกออกมาจากปลายเป็นรูปตัว L กับสามเหลี่ยมกลางที่ราบ (เจ้าของเห็นว่า "ลอย")
               เพราะมันพุ่งข้ามไปเกาะกรอบป้ายสีน้ำเงินที่อยู่ใกล้ ๆ
             ที่ถูกคือเดินทีละสองหน่วย แล้ว**ให้น้ำเป็นคนบอกทิศ**: ลองเบนซ้าย/ตรง/ขวา
             เลือกทางที่เปียก แล้วอัปเดตทิศตาม · หมดน้ำเมื่อไหร่หยุดทันที
             และห้ามเลี้ยวสะสมเกิน 75° — ลำน้ำไม่วนกลับ แต่กรอบป้ายวน                */
          const STEP = 2, MAXGROW = 40;
          let dirx = A.ux, diry = A.uy, turned = 0;
          let cx2 = A.x, cy2 = A.y;
          const walk = [];
          for (let step = 0; step * STEP < MAXGROW; step++){
            let picked = null;
            for (const ang of [0, -0.30, 0.30, -0.60, 0.60]){
              const ca = Math.cos(ang), sa = Math.sin(ang);
              const ux2 = dirx*ca - diry*sa, uy2 = dirx*sa + diry*ca;
              const nx2 = cx2 + ux2*STEP, ny2 = cy2 + uy2*STEP;
              if (wetNear(nx2, ny2)){ picked = { ux2, uy2, nx2, ny2, ang }; break; }
            }
            if (!picked) break;
            turned += Math.abs(picked.ang);
            if (turned > 1.31) break;                      /* 75° */
            dirx = picked.ux2; diry = picked.uy2;
            cx2 = picked.nx2; cy2 = picked.ny2;
            walk.push([+cx2.toFixed(1), +cy2.toFixed(1)]);
          }
          const bestPath = walk.length >= 3 ? walk : null;   /* ต้องเดินได้อย่างน้อย 6 หน่วย */
          if (!bestPath) continue;
          const pts = [[A.x, A.y], ...bestPath];
          rivers.push({ p:pts.flat(), w:pts.map(() => A.w) });
          grown++; unit += bestPath.length * 2;
        }
      });
      if (grown) console.log(`  ★ ยืดปลายเข้าไปกินน้ำที่เหลือ ${grown} ปลาย (รวม ~${unit} หน่วย)`);
    }

    BRIDGES = bridges;
    for (const b of bridges) MADE.push({ kind:'สะพาน', x:b.x, y:b.y, x2:b.x2, y2:b.y2, why:b.why });
    const rounds = bridges.length ? Math.max(...bridges.map(b => b.round)) : 0;
    console.log(`  ★ ต่อแม่น้ำที่ขาด ${bridges.length} จุด (เย็บ ${rounds} รอบ · สะพานโค้งตามทิศของลำน้ำ)`);
    for (const b of [...bridges].sort((x, y) => y.d - x.d).slice(0, 10))
      console.log(`      ${b.d.toFixed(0).padStart(3)} หน่วย  ${b.x},${b.y} → ${b.x2},${b.y2}   ${b.why}`);
  }

  /* ══ ★★★ ลายฉลุน้ำ — สำเนาหมึกของแผ่นแบบไม่แปลงรูปเลย ═══════════════════
     เจ้าของทักรอบสาม: *"ไล่ยังไงก็ไล่ไม่หมดหรอก ... มันเพี้ยนจากเดิมมหาศาลเลย
      ถ้ามันเพี้ยน มันกดดูแผนที่เดิมมันก็ดีกว่าอะ"* — **ถูกทุกคำ**

     ★ ต้นตอไม่ใช่ตัวกรองไหนตัวหนึ่ง มันคือ **ตัวท่อเอง**:
       การถอดเป็นแกนกลางแล้ววาดใหม่ด้วยความกว้างสม่ำเสมอ **เปลี่ยนรูปทุกจุด**
       ต่อให้ลากถูกที่ เส้นที่วาดออกมาก็ไม่ใช่เส้นเดิม (ปลายมน มุมเรียบ ความกว้างเฉลี่ย)
       บวกกับขยะที่หลุดตัวกรอง = "เพี้ยนจากเดิม" ซึ่งไล่เท่าไรก็ไม่จบ

     → ทางออกคือ **ไม่แปลงรูปมันเลย** ส่งหมึกของแผ่นไปทั้งอย่างนั้นเป็นลายฉลุ 1 บิต
       แล้วให้ SVG เอาไปเป็น mask ระบายสีของเรา · **ความเพี้ยน = ศูนย์โดยนิยาม**
       สิ่งที่เรายังทำได้คือ *ลบ* ของที่รู้แน่ว่าไม่ใช่น้ำ (ตัวอักษร กรอบป้าย WEI)
       — **การลบปลอดภัย การประดิษฐ์ไม่ปลอดภัย**

     ⚠ เวกเตอร์แม่น้ำยังเขียนไว้เหมือนเดิม เพราะ `w` ของมันคือแหล่งความกว้างจริง
       และตัวตรวจกับเครื่องมืออื่นยังใช้อยู่ — แต่ **ชั้นที่วาดจริงคือลายฉลุ** */
  {
    const { writePng1 } = require('./png1.js');
    const sten = new Uint8Array(W*H);
    /* ⚠ ลายฉลุเก็บ **เฉพาะสายน้ำ** — ทะเลกับทะเลสาบยังเป็นรูปปิดเวกเตอร์เหมือนเดิม
       เพราะมันเป็นรูปใหญ่เรียบ ไม่มีปัญหาเรื่องเศษ และวาดเป็นเวกเตอร์แล้วคมทุกระดับซูม
       ส่วนสายน้ำต้องเป็นลายฉลุ เพราะมันคือส่วนที่การถอดเป็นแกนกลางทำให้เพี้ยน */
    /* ══ ★★★ กติกาเดียวที่ฆ่าตัวหนังสือกับไอคอนพร้อมกัน ═══════════════════
       เจ้าของ (รอบสี่): *"สิ่งที่สแกนมาพวกตัวหนังสือ หรือไอคอนสี่เหลี่ยม
        มันคิดว่ามันเป็นแม่น้ำหมดเลย แม่น้ำเลยแปลกๆ"*

       ไล่กรองทีละแบบ (ขนาด · ความทึบ · กรอบ · หมึกดำข้างใน) **ไม่มีวันจบ**
       เพราะแต่ละแบบคือการเดาว่า "หมึกก้อนนี้แปลว่าอะไร"

       ★ กติกาที่ใช้แทนทั้งหมด: **หมึกเป็นน้ำก็ต่อเมื่อมันอยู่บน *เครือข่ายลำน้ำ***
         1. หาแกนกลางของหมึกน้ำทั้งหมด
         2. **ตัดหนวด** — ตัวอักษรกับไอคอนที่ติดกับแม่น้ำเป็นหนวดสั้น ๆ เสมอ
            (ตัวอักษรไม่ยาว 25 หน่วยในทิศเดียว · ลำน้ำสาขาที่สั้นกว่านั้นไม่มี)
         3. ทิ้งเครือข่ายที่สั้นเกินทั้งก้อน — ตัวอักษรที่ไม่ติดใครเลย
         4. **ระบายหมึกเดิมกลับ** เฉพาะในระยะครึ่งความกว้างจากแกนที่เหลือ
       → รูปที่ได้ยังเป็นหมึกของแผ่นเป๊ะ (ข้อ 4) แต่เฉพาะส่วนที่เป็นลำน้ำจริง

       ⚠ ตัวอักษรที่ *เชื่อมติด* กับแม่น้ำก็หายด้วย เพราะมันเป็นหนวดของแกน
         — อันนี้คือสิ่งที่ตัวกรองระดับชิ้นส่วนทำไม่ได้โดยหลักการ */
    {
      const SPUR = 30, MINNET = 110;
      const riv = new Uint8Array(W*H);
      for (const c of pick(T, 'river')) for (const q of c.px) riv[q] = 1;

      /* ══ ★★★ สะพานต้องอยู่ในภาพก่อนกรอง ไม่ใช่หลังกรอง ═══════════════════
         ⚠ **บั๊กที่ตัวตรวจกิ่งขาดจับได้ตัวแรก** (2026-09-05)
         ก่อนหน้านี้บล็อกนี้สร้าง riv ใหม่จากชิ้นส่วนดิบ → **สะพาน 42 จุดหายไปหมด**
         ผลคือกติกาเครือข่ายมองเห็นแม่น้ำที่ถูกป้ายชื่อเมืองตัดเป็นท่อน ๆ
         แต่ละท่อนสั้นกว่า MINNET → **ทิ้งทั้งสาย**
         → ตัวกรองที่ตั้งใจฆ่าตัวหนังสือ กลับฆ่าแม่น้ำ *เพราะ* ตัวหนังสือตัดมันขาด
         (เจอที่ลั่วหยาง 493 px · ที่ติงเฉิง 382 px · ใต้เจียงหลิง 393 px)
         ★ บทเรียน: **เชื่อมให้ครบก่อน แล้วค่อยกรอง** ลำดับสองอย่างนี้สลับกันไม่ได้ */
      for (const b of BRIDGES){
        const hw = Math.max(1.5, D[b.y*W + b.x] || 1.5);
        const steps = Math.max(2, Math.ceil(b.d*2));
        for (let t = 0; t <= steps; t++){
          const x = Math.round(b.x + (b.x2-b.x)*t/steps), y = Math.round(b.y + (b.y2-b.y)*t/steps);
          const r = Math.ceil(hw);
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
            if (dx*dx + dy*dy > hw*hw) continue;
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            riv[ny*W+nx] = 1; invMark(ny*W+nx, 2);
          }
        }
      }

      const sk = thin(W, H, riv);
      const kept = prune(skeletonLines(W, H, sk), SPUR);

      /* ทิ้งเครือข่ายย่อยที่สั้นเกินทั้งก้อน */
      const skKeep = new Uint8Array(W*H);
      for (const L2 of kept) for (const q of L2) skKeep[q] = 1;
      const NET = components(W, H, skKeep);
      let dropNet = 0;
      for (const c of NET.comps) if (c.n < MINNET){ dropNet++; for (const q of c.px) skKeep[q] = 0; }

      /* ระบายหมึกเดิมกลับ เฉพาะในระยะครึ่งความกว้างจากแกน */
      for (let i = 0; i < W*H; i++){
        if (!skKeep[i]) continue;
        const x = i % W, y = (i / W) | 0;
        const r = Math.ceil(D[i]) + 1;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
          if (dx*dx + dy*dy > (D[i]+1)*(D[i]+1)) continue;
          const nx = x+dx, ny = y+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny*W + nx;
          if (riv[j]) sten[j] = 1;
        }
      }
      /* ★ แขนของทะเลสาบใส่กลับเสมอ — กติกาเครือข่ายไม่มีสิทธิ์ตัดเนื้อของแหล่งน้ำ */
      let armed = 0;
      for (let i = 0; i < W*H; i++)
        /* เฉพาะ *แขน* (น้ำบาง) — ตัวผืนน้ำเปิดเองยังเป็นรูปปิดเวกเตอร์เหมือนเดิม */
        if (m0[i] && NEARLAKE[i] && !OPEN0[i] && !sten[i]){ sten[i] = 1; armed++; }
      if (armed) console.log(`  ★ ใส่แขนของแหล่งน้ำกลับ ${armed.toLocaleString()} px`);

      for (let i = 0; i < W*H; i++) if (riv[i] && !sten[i]) WHY[i] = 2;

      /* ══ ★★★ เศษของลำน้ำที่ถูกป้ายสับเป็นท่อน — ใส่กลับ ═════════════════
         เจ้าของ (รอบเจ็ด): *"ลบเกินได้ แต่ใส่เส้นแม่น้ำกลับไป มันแค่นี้เอง"*
         และชี้สี่จุด: เหนือฉางอาน · เหนือโซ่วชุน · เหนือเจี้ยนเย่ · ไป๋ตี้

         ส่องแล้วพบว่าเหตุผลที่หายไม่ใช่ตัวอักษร แต่เป็น **ตัวกรองของเราเองสองตัว**
           · "เศษเล็ก" (ชิ้นเล็กกว่า 40 px)  · "กติกาเครือข่าย" (หนวดสั้นกว่า 30)
         ป้ายชื่อเมือง/ไอคอน/กรอบดำ สับลำน้ำเป็นท่อนสั้น ๆ หลายท่อน
         แต่ละท่อนเล็กเกินเกณฑ์ → ทิ้งหมด → **ลำน้ำขาดเป็นช่วง ๆ ตลอดสาย**

         ★ กติกา: เศษน้ำเล็ก ๆ ที่ **อยู่ชิดกับลำน้ำที่เราวาดแล้ว (<=6 px)** ไม่ใช่ขยะ
           มันคือท่อนของลำน้ำเส้นนั้นเอง — ใส่กลับ
           แต่ถ้าตัวกรองบอกว่าเป็น *ตัวอักษร* หรือ *กล่องคำ* ไม่ใส่กลับ (นั่นระบุตัวได้แล้ว) */
      /* ★ ทำซ้ำหลายรอบ — ท่อนที่ใส่กลับกลายเป็นลำน้ำให้ท่อนถัดไปเกาะต่อ
         ลำน้ำที่ถูกสับยับ ๆ จึงต่อคืนได้ทั้งสาย ไม่ใช่แค่ท่อนที่บังเอิญติดของเดิม */
      for (let round = 0; round < 8; round++){
        const inv = new Uint8Array(W*H);
        for (let i = 0; i < W*H; i++) inv[i] = sten[i] ? 0 : 1;
        const dS = dt(W, H, inv);
        const lost = new Uint8Array(W*H);
        for (let i = 0; i < W*H; i++) if (m0[i] && !sten[i] && !OPEN0[i]) lost[i] = 1;
        const LC = components(W, H, lost);
        let back = 0, blobs = 0;
        for (const c of LC.comps){
          if (c.n > 200) continue;                       /* ท่อนต้องเล็ก */
          let near = false;
          for (const q of c.px) if (dS[q] <= 6){ near = true; break; }
          if (!near) continue;                           /* ต้องชิดลำน้ำที่วาดแล้ว */
          const t = {};
          for (const q of c.px){ const k = WHY[q]; t[k] = (t[k]||0) + 1; }
          const top = Object.entries(t).sort((p,q2)=>q2[1]-p[1])[0][0] | 0;
          if (top === 1 || top === 3 || top === 4) continue;   /* กล่องคำ/ตัวอักษร/กรอบป้าย */
          for (const q of c.px){ sten[q] = 1; back++; }
          blobs++;
        }
        if (blobs) console.log(`  ★ ใส่ท่อนลำน้ำที่ถูกสับกลับ (รอบ ${round+1}) ${blobs} ท่อน · ${back.toLocaleString()} px`);
        if (!blobs) break;
      }

      let a = 0, b = 0;
      for (let i = 0; i < W*H; i++){ if (riv[i]) a++; if (sten[i]) b++; }
      console.log(`  ★ กรองด้วยเครือข่าย: หมึกสายน้ำ ${a.toLocaleString()} → ${b.toLocaleString()} px (ตัดหนวด <${SPUR} · ทิ้งเครือข่ายสั้น ${dropNet} ก้อน)`);
    }
    let on = 0; for (let i = 0; i < W*H; i++) if (sten[i]) on++;
    /* ══ ★★★ เย็บก้อนน้ำที่ไม่มีทางออกเข้ากับเครือข่าย ══════════════════════
       กติกาที่เจ้าของให้มา (2026-09-05): *"แม่น้ำไม่สามารถลอยได้ ... นายรู้ว่ามันอยู่
       ตรงไหน เท่ากับนายเชคได้ว่า source มีไหม ถ้ามันไม่มีเท่ากับแม่น้ำมันขาด"*

       ★★ นี่คือกติกาที่ **หยุดได้** ต่างจากการไล่ดูด้วยตา:
          ก้อนน้ำทุกก้อนต้องไปถึงทะเล ทะเลสาบ หรือขอบแผ่น · ก้อนที่ไปไม่ถึง = ขาด
          เย็บจนเหลือศูนย์ = จบ · ไม่ใช่ "ไล่จนตาย"

       เย็บที่ **ตัวลายฉลุ** ไม่ใช่ที่เวกเตอร์ เพราะลายฉลุคือสิ่งที่วาดจริง
       และเย็บด้วยริบบิ้นกว้างเท่าลำน้ำตรงนั้น ไม่ใช่เส้นบาง — จะได้กลืนกับของเดิม
       ⚠ ยังต้องมีหลักฐานเหมือนเดิม: ช่องว่างต้องมีหมึกอื่นของแผ่นทับอยู่ (ป้าย/ไอคอน) */
    {
      const reach = new Uint8Array(W*H);
      for (const k of ['sea', 'lake']) for (const c of pick(O, k)) for (const q of c.px) reach[q] = 1;
      const inkAll = new Uint8Array(W*H);
      for (const f of ['_plate_dark.rle', '_plate_relief.rle']){
        const fp = path.join(__dirname, f);
        if (!fs.existsSync(fp)) continue;
        const k = readRle(fp).m;
        for (let i = 0; i < W*H; i++) if (k[i]) inkAll[i] = 1;
      }
      const MAXW = 75;
      let welded = 0, rounds = 0;
      for (; rounds < 12; rounds++){
        const both = new Uint8Array(W*H);
        for (let i = 0; i < W*H; i++) if (sten[i] || reach[i]) both[i] = 1;
        const R = components(W, H, both);
        const ok = new Uint8Array(W*H);
        const orphans = [];
        for (const c of R.comps){
          const edge = c.x0 <= 8 || c.y0 <= 8 || c.x1 >= W-9 || c.y1 >= H-9;
          let touches = edge;
          if (!touches) for (const q of c.px) if (reach[q]){ touches = true; break; }
          if (touches){ for (const q of c.px) ok[q] = 1; }
          else if (c.n >= 120) orphans.push(c);
        }
        if (!orphans.length) break;
        /* ระยะจากทุกจุดถึงเครือข่ายที่มีทางออก */
        const inv = new Uint8Array(W*H);
        for (let i = 0; i < W*H; i++) inv[i] = ok[i] ? 0 : 1;
        const dOk = dt(W, H, inv);
        let made = 0;
        for (const c of orphans){
          let best = null;
          for (const q of c.px) if (!best || dOk[q] < dOk[best]) best = q;
          /* ★ ระบบน้ำใหญ่ยอมข้ามช่องกว้างกว่าปกติ — ยิ่งใหญ่ยิ่งเป็นไปไม่ได้ที่จะลอย
             (แม่น้ำเว่ยทั้งลุ่มกวานจง 3,016 px ขาดจากแม่น้ำเหลือง เพราะตัวอักษร WEI
              ของแผ่นเองกินหมึกช่วงนั้นไปหมด — แผ่นไม่ได้วาดไว้ให้ต่อ)
             ⚔ นี่คือ *การประดิษฐ์* ไม่ใช่การลอก จึงจำกัดไว้เฉพาะก้อนใหญ่จริง */
          const cap = c.n >= 1500 ? 130 : MAXW;
          if (best == null || dOk[best] > cap) continue;
          const bx = best % W, by = (best / W) | 0;
          /* หาจุดของเครือข่ายที่ใกล้ที่สุดจริง ๆ */
          let tx = -1, ty = -1, td = 1e9;
          const rr = Math.ceil(dOk[best]) + 3;
          for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++){
            const nx = bx+dx, ny = by+dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (!ok[ny*W+nx]) continue;
            const d2 = dx*dx + dy*dy;
            if (d2 < td){ td = d2; tx = nx; ty = ny; }
          }
          if (tx < 0) continue;
          const gap = Math.sqrt(td);
          /* หลักฐาน: ช่องว่างต้องมีหมึกอื่นทับ (ป้าย/ไอคอน) หรือสั้นมาก */
          /* ⚠ ข้อยกเว้น: ก้อนใหญ่ที่ห่างไม่มาก **เย็บโดยไม่ต้องมีหมึกคั่น**
             เพราะ *กติกาทางออกเองคือหลักฐาน* — ระบบน้ำ 500+ px ที่ไม่มีทางออกเป็นไปไม่ได้
             (เจอจริงที่เฉินหลิว: แผ่นเว้นช่องไว้ตรงที่ป้าย "Ding Tao" วางอยู่บนกระดาษเปล่า
              หลักฐานหมึกจึงไม่ผ่าน ทั้งที่สายน้ำต่อกันแน่นอน) */
          /* ⚠ เคยมีทางลัด "ก้อนใหญ่เย็บข้ามที่ว่างได้โดยไม่ต้องมีหลักฐาน"
             — **ถอดออกแล้ว** เจ้าของทักว่าเส้นแบบนั้นคือเส้นปลอม
             กติกาทางออกใช้ *ตั้งคำถาม* ได้ แต่ใช้ *ตอบ* แทนหลักฐานไม่ได้
             ถ้าไม่มีหมึกให้เชื่อ ให้ไปขึ้นรายงาน "ก้อนน้ำไม่มีทางออก" ตามตรง */
          if (gap >= 6){
            let hit = 0, tot = 0;
            const steps = Math.max(3, Math.ceil(gap));
            for (let t = 1; t < steps; t++){
              const x = Math.round(bx + (tx-bx)*t/steps), y = Math.round(by + (ty-by)*t/steps);
              let near = 0;
              for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++){
                const nx = x+dx, ny = y+dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                if (inkAll[ny*W+nx] || m0[ny*W+nx]) near = 1;   /* ★ เหมือนกัน — ดูจากแผ่นจริง */
              }
              hit += near; tot++;
            }
            if (tot && hit/tot < 0.80) continue;
          }
          /* วาดริบบิ้นกว้างเท่าลำน้ำตรงนั้น */
          const hw = Math.max(1.5, D[best]);
          const steps = Math.max(2, Math.ceil(gap*2));
          for (let t = 0; t <= steps; t++){
            const x = bx + (tx-bx)*t/steps, y = by + (ty-by)*t/steps;
            const r = Math.ceil(hw);
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
              if (dx*dx + dy*dy > hw*hw) continue;
              const nx = Math.round(x)+dx, ny = Math.round(y)+dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              sten[ny*W+nx] = 1; invMark(ny*W+nx, 3);
            }
          }
          MADE.push({ kind:'เย็บก้อนน้ำ', x:bx, y:by, x2:tx, y2:ty,
            why:`ก้อน ${c.n} px · ช่อง ${gap.toFixed(0)}` });
          welded++; made++;
        }
        if (!made) break;
      }
      let on2 = 0; for (let i = 0; i < W*H; i++) if (sten[i]) on2++;
      console.log(`  ★ เย็บก้อนน้ำที่ไม่มีทางออกเข้ากับเครือข่าย ${welded} จุด (${rounds} รอบ) · หมึกเพิ่ม ${(on2-on).toLocaleString()} px`);
      on = on2;
    }

    sten2 = sten;
    const png = writePng1(W, H, sten);
    fs.writeFileSync(path.join(ROOT, 'assets', 'water_stencil.png'), png);
    console.log(`
ลายฉลุน้ำ assets/water_stencil.png  ${(png.length/1024).toFixed(1)} KB · หมึก ${on.toLocaleString()} px`);

    /* ══ ★★★ รายงาน "หมึกของแผ่นที่เราทิ้ง" — ตอบกติกาของเจ้าของ ═══════════
       *"แม่น้ำไม่สามารถลอยได้ ... ถ้าเราต้องตรวจสอบแม่น้ำ นายรู้ว่ามันอยู่ตรงไหน
        เท่ากับนายเชคได้ว่า source มีไหม ถ้ามันไม่มีเท่ากับแม่น้ำมันขาด"*

       ★ นี่คือตัวตรวจที่ `check_water` ทำไม่ได้ — มันเทียบกับ landmask ซึ่งมีขยะ
         ชุดเดียวกัน · ส่วนอันนี้เทียบ **สิ่งที่วาดจริง** กับ **หมึกของแผ่นเอง**
         ทุกก้อนที่เราทิ้ง ต้องบอกได้ว่าทิ้งเพราะอะไร ไม่งั้นคือทิ้งแม่น้ำ

       ⚠ ตัวกรอง "กรอบป้าย" รอบแรก **กินแยงซีช่วงไป๋ตี้–เจียงหลิงทิ้งทั้งท่อน**
         และไม่มีตัวตรวจไหนฟ้อง — เจ้าของจับได้ด้วยตาจากกติกาที่เครื่องไม่รู้
         รายงานนี้มีไว้ให้เครื่องรู้ */
    {
      const lost = new Uint8Array(W*H);
      for (let i = 0; i < W*H; i++) if (m[i] && !sten[i]) lost[i] = 1;
      const why = new Map();
      for (const k of ['text', 'labelbox', 'noise'])
        for (const c of T.comps.filter(x => x.kind === k)) for (const q of c.px) why.set(q, k);
      for (const k of ['sea', 'lake', 'noise'])
        for (const c of O.comps.filter(x => x.kind === k)) for (const q of c.px) why.set(q, k === "noise" ? "เศษน้ำเปิด" : "น้ำเปิด");
      const L = components(W, H, lost);
      const big = L.comps.filter(c => c.n >= 120).sort((a, b) => b.n - a.n);
      console.log(`  ★ หมึกของแผ่นที่ไม่ได้เข้าลายฉลุ: ${L.comps.length} ก้อน · ที่ใหญ่กว่า 120 px: ${big.length} ก้อน`);
      for (const c of big.slice(0, 44)){
        const tally = {};
        for (const q of c.px){ const k = why.get(q) || 'ไม่ทราบ'; tally[k] = (tally[k] || 0) + 1; }
        const top = Object.entries(tally).sort((a, b) => b[1]-a[1])
          .map(([k, n]) => k + ' ' + Math.round(n/c.n*100) + '%').slice(0, 2).join(' · ');
        console.log(`      ${String(c.n).padStart(5)} px  ที่ ${c.x0},${c.y0}–${c.x1},${c.y1}   ${top}`);
      }
    }

    /* ── ★ กติกา "แม่น้ำต้องมีทางออก" — ก้อนน้ำที่ไม่ต่อกับทะเล/ทะเลสาบ/ขอบแผ่น ── */
    {
      const reach = new Uint8Array(W*H);
      for (const k of ['sea', 'lake']) for (const c of pick(O, k)) for (const q of c.px) reach[q] = 1;
      const both = new Uint8Array(W*H);
      for (let i = 0; i < W*H; i++) if (sten[i] || reach[i]) both[i] = 1;
      const R = components(W, H, both);
      const orphan = R.comps.filter(c => {
        if (c.n < 150) return false;
        if (c.x0 <= 8 || c.y0 <= 8 || c.x1 >= W-9 || c.y1 >= H-9) return false;   /* ออกขอบแผ่นได้ */
        for (const q of c.px) if (reach[q]) return false;                          /* ถึงทะเล/ทะเลสาบ */
        return true;
      }).sort((a, b) => b.n - a.n);
      REPORT.orphan = orphan.map(c => ({ n:c.n, x0:c.x0, y0:c.y0, x1:c.x1, y1:c.y1 }));
      console.log(`  ★ ก้อนน้ำที่ไม่มีทางออก (ไม่ถึงทะเล/ทะเลสาบ/ขอบแผ่น): ${orphan.length} ก้อน`);
      if (orphan.length){
        /* บอกด้วยว่าห่างจากเครือข่ายที่มีทางออกเท่าไร — ไม่งั้นไม่รู้ว่าควรเย็บหรือควรปล่อย */
        const okm = new Uint8Array(W*H);
        for (const c of R.comps){
          const edge = c.x0 <= 8 || c.y0 <= 8 || c.x1 >= W-9 || c.y1 >= H-9;
          let t = edge; if (!t) for (const q of c.px) if (reach[q]){ t = true; break; }
          if (t) for (const q of c.px) okm[q] = 1;
        }
        const inv = new Uint8Array(W*H); for (let i = 0; i < W*H; i++) inv[i] = okm[i] ? 0 : 1;
        const dOk = dt(W, H, inv);
        for (const c of orphan.slice(0, 10)){
          let b2 = c.px[0]; for (const q of c.px) if (dOk[q] < dOk[b2]) b2 = q;
          console.log(`      ${String(c.n).padStart(5)} px  ที่ ${c.x0},${c.y0}–${c.x1},${c.y1}`
            + `   ใกล้เครือข่ายสุดที่ ${b2%W},${(b2/W)|0} ห่าง ${dOk[b2].toFixed(0)}`);
        }
      }
    }

    /* ══ ★★★ ตัวตรวจ "กิ่งขาด" — จุดบอดที่เจ้าของหาเจอเอง ═══════════════════
       เจ้าของ (รอบห้า): *"วิธีที่เชค Source เจอจุดบอดคือ ถ้ามันไหลแล้วมีจุด
        กลับมาที่เดิม แบบถ้ามันไหลลงทะเล หรือมีจุดที่วน มันจะเชคแล้วพลาดได้
        ทำให้ขาดไป 1 สายที่มันไหลไป"*

       ถูกทั้งหมด · กติกาทางออกข้างบนตรวจ **ทั้งก้อน** ถ้าก้อนนั้นถึงทะเลแล้ว
       กิ่งที่หายอยู่ข้างในก้อนเดียวกันจะไม่มีใครฟ้อง — และถ้าระบบมีวง (loop)
       ก็ยิ่งถึงทะเลง่ายขึ้นอีก · แยงซีช่วงไป๋ตี้ที่ผมทำหายไปทั้งท่อน
       ก็รอดตัวตรวจทุกตัวด้วยเหตุนี้

       ★ ตัวตรวจนี้เลื่อนลงมาอีกชั้น: ตรวจ **ปลายเส้นทีละปลาย** ไม่ใช่ทีละก้อน
         ปลายของแม่น้ำจริงจบได้สามแบบเท่านั้น — ต้นน้ำ · ปากน้ำ · ขอบแผ่น
         ถ้าปลายไหน "ชี้ตรงเข้าไปในหมึกน้ำของแผ่นที่เราไม่ได้วาด" แปลว่าเราตัดกิ่งทิ้ง
         ไม่ว่าก้อนนั้นจะถึงทะเลอยู่แล้วหรือจะมีวงกี่วงก็ตาม */
    {
      const CODE = { text:3, labelbox:4, noise:5 };
      for (const c of T.comps) if (CODE[c.kind]) for (const q of c.px) if (!WHY[q]) WHY[q] = CODE[c.kind];
      for (const c of O.comps) for (const q of c.px) if (!WHY[q]) WHY[q] = 6;

      const CONE = 0.62, LOOK = 44, BACK = 12, MINLOST = 60;
      const sk2 = thin(W, H, sten);
      const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : sk2[y*W + x];
      /* หมึกที่แผ่นมี แต่เราไม่ได้วาด + ก้อนของมัน (ไว้บอกขนาดกิ่งที่หาย) */
      const lost = new Uint8Array(W*H);
      for (let i = 0; i < W*H; i++) if (m0[i] && !sten[i]) lost[i] = 1;
      const LC = components(W, H, lost);
      const lostId = new Int32Array(W*H).fill(-1);
      LC.comps.forEach((c, k) => { for (const q of c.px) lostId[q] = k; });
      /* ปากน้ำที่ถูกกติกา: ติดทะเล/ทะเลสาบ/ขอบแผ่น */
      const open = new Uint8Array(W*H);
      for (const k of ['sea', 'lake']) for (const c of pick(O, k)) for (const q of c.px) open[q] = 1;
      const nearOpen = (x, y) => {
        for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++){
          const nx = x+dx, ny = y+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (open[ny*W+nx]) return 1;
        }
        return 0;
      };
      /* เดินถอยหลังตามแกนกลางเพื่อหาทิศของลำน้ำตรงปลายนั้น */
      const walkBack = i => {
        let cur = i, prev = -1;
        for (let s = 0; s < BACK; s++){
          const x = cur % W, y = (cur / W) | 0;
          let nxt = -1;
          for (const d of N8){
            const j = (y+d[1])*W + (x+d[0]);
            if (at(x+d[0], y+d[1]) && j !== prev && j !== cur){ nxt = j; break; }
          }
          if (nxt < 0) break;
          prev = cur; cur = nxt;
        }
        return cur;
      };
      const cuts = new Map();
      for (let i = 0; i < W*H; i++){
        if (!sk2[i]) continue;
        const x = i % W, y = (i / W) | 0;
        let deg = 0; for (const d of N8) if (at(x+d[0], y+d[1])) deg++;
        if (deg !== 1) continue;                                   /* เอาเฉพาะปลายอิสระ */
        if (x <= 10 || y <= 10 || x >= W-11 || y >= H-11) continue; /* ออกขอบแผ่นได้ */
        if (nearOpen(x, y)) continue;                               /* ปากน้ำ */
        const b = walkBack(i), bxx = b % W, byy = (b / W) | 0;
        let ux = x - bxx, uy = y - byy;
        const len = Math.hypot(ux, uy); if (len < 3) continue;
        ux /= len; uy /= len;
        /* ยิงกรวยไปข้างหน้า — เจอหมึกที่เราไม่ได้วาดเมื่อไหร่คือกิ่งขาด */
        let bestK = -1, bestD = 1e9;
        for (let t = 3; t <= LOOK && bestK < 0; t++){
          for (let a = -1; a <= 1; a++){
            const px = Math.round(x + ux*t - uy*a*t*CONE*0.5);
            const py = Math.round(y + uy*t + ux*a*t*CONE*0.5);
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const k = lostId[py*W+px];
            if (k >= 0 && LC.comps[k].n >= MINLOST && t < bestD){ bestK = k; bestD = t; }
          }
        }
        if (bestK < 0) continue;
        const rec = cuts.get(bestK) || { k: bestK, ends: [], d: 1e9 };
        rec.ends.push([x, y]); rec.d = Math.min(rec.d, bestD);
        cuts.set(bestK, rec);
      }
      const list = [...cuts.values()]
        .map(r => {
          const c = LC.comps[r.k], t = {};
          for (const q of c.px){ const w = WHYNAME[WHY[q]]; t[w] = (t[w]||0) + 1; }
          const why = Object.entries(t).sort((a,b)=>b[1]-a[1])
            .map(([k,n]) => k + ' ' + Math.round(n/c.n*100) + '%').slice(0,2).join(' · ');
          return { ...r, c, why };
        })
        .sort((a, b) => b.c.n - a.c.n);
      const ends = list.reduce((s, r) => s + r.ends.length, 0);
      REPORT.cut = list.map(r => ({ n:r.c.n, x0:r.c.x0, y0:r.c.y0, x1:r.c.x1, y1:r.c.y1,
        ex:r.ends[0][0], ey:r.ends[0][1], d:r.d, ends:r.ends.length, why:r.why }));
      console.log(`  ★ กิ่งขาด (ปลายเส้นที่ชี้เข้าหมึกน้ำของแผ่นที่เราไม่ได้วาด): ${list.length} กิ่ง · ${ends} ปลาย`);
      for (const r of list.slice(0, 20)){
        const [ex, ey] = r.ends[0];
        console.log(`      ${String(r.c.n).padStart(5)} px  ${r.c.x0},${r.c.y0}–${r.c.x1},${r.c.y1}`
          + `  ปลาย ${ex},${ey} ห่าง ${String(r.d).padStart(2)}   ${r.why}`);
      }
    }
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
  /* ══ ★★★ ภาพ "น้ำของแผ่นที่เราไม่ได้วาด" ═══════════════════════════════
     เจ้าของ: *"จริง ๆ แค่นายเทียบภาพระหว่างแผนที่ต้นแบบกับที่ทำมาก็น่าจะรู้แล้วไม่ใช่เหรอ"*
     — ถูก · ที่ผ่านมาผมรายงานเป็น *ตัวเลข* ("ก้อนที่ใหญ่กว่า 120 px: 24 ก้อน")
     ซึ่งอ่านแล้วไม่มีทางรู้ว่ามันคือทะเลสาบทั้งลูกหรือเศษตัวอักษร
     ตอนนี้เขียนออกมาเป็น **ภาพ** ให้ดูทั้งแผ่นทีเดียว */
  {
    const covered = new Uint8Array(W*H);
    for (let i = 0; i < W*H; i++) if (sten2[i]) covered[i] = 1;
    for (const k of ['sea', 'lake']) for (const c of pick(O, k)) for (const q of c.px) covered[q] = 1;
    const missing = new Uint8Array(W*H);
    let nm = 0;
    for (let i = 0; i < W*H; i++) if (m0[i] && !covered[i]){ missing[i] = 1; nm++; }
    const { writePng1 } = require('./png1.js');
    fs.writeFileSync(path.join(__dirname, '_missing.png'), writePng1(W, H, missing));
    let tot0 = 0; for (let i = 0; i < W*H; i++) if (m0[i]) tot0++;
    console.log(`
★ น้ำของแผ่นที่เราไม่ได้วาด ${nm.toLocaleString()} px (${(nm/tot0*100).toFixed(1)}% ของหมึกน้ำทั้งแผ่น)`);
    console.log('      → ดูเป็นภาพที่ tools/_missing.png · หน้าเทียบ tools/side_by_side.html');
    { const MC = components(W, H, missing);
      const big2 = MC.comps.filter(c => c.n >= 100).sort((x,y)=>y.n-x.n);
      console.log('      ก้อนที่ใหญ่ที่สุด (>=100 px): ' + big2.length + ' ก้อน');
      REPORT.miss = big2.slice(0, 40).map(c => {
        const t = {};
        for (const q of c.px){ const w = WHYNAME[WHY[q]]; t[w] = (t[w]||0)+1; }
        const why = Object.entries(t).sort((a2,b2)=>b2[1]-a2[1])
          .map(([k,n])=>k+' '+Math.round(n/c.n*100)+'%').slice(0,2).join(' · ');
        return { n:c.n, x0:c.x0, y0:c.y0, x1:c.x1, y1:c.y1, why };
      });
      for (const c of big2.slice(0, 22)){
        const t = {};
        for (const q of c.px){ const w = WHYNAME[WHY[q]]; t[w] = (t[w]||0)+1; }
        const top = Object.entries(t).sort((a2,b2)=>b2[1]-a2[1])
          .map(([k,n])=>k+' '+Math.round(n/c.n*100)+'%').slice(0,2).join(' · ');
        console.log('        ' + String(c.n).padStart(5) + ' px  ' + c.x0+','+c.y0+'-'+c.x1+','+c.y1 + '   ' + top);
      } }
    REPORT.missing = nm;
    /* PROBE="x,y,w,h;..." node tools\build_plate_water.js — ส่องว่าตรงนั้นหายเพราะใคร */
    if (process.env.PROBE) for (const spec of process.env.PROBE.split(';')){
      const [bx, by, bw, bh] = spec.split(',').map(Number);
      const t = {}; let tot = 0, drawn = 0;
      for (let y = by; y < by+bh; y++) for (let x = bx; x < bx+bw; x++){
        const i = y*W + x; if (!m0[i]) continue;
        tot++;
        if (covered[i]) { drawn++; continue; }
        const k = WHYNAME[WHY[i]]; t[k] = (t[k]||0) + 1;
      }
      console.log(`  PROBE ${spec}: หมึกน้ำของแผ่น ${tot} px · วาดแล้ว ${drawn} · หาย ${tot-drawn}`);
      for (const [k, n] of Object.entries(t).sort((p,q)=>q[1]-p[1]))
        console.log(`      ${k.padEnd(18)} ${n}`);
    }
  }

  {
    const shown = new Uint8Array(W*H);
    const tally = [0,0,0,0];
    for (let i = 0; i < W*H; i++) if (INV[i]){ shown[i] = 1; tally[INV[i]]++; }
    const { writePng1 } = require('./png1.js');
    fs.writeFileSync(path.join(__dirname, '_invented.png'), writePng1(W, H, shown));
    const tot = tally.reduce((a, b) => a + b, 0);
    console.log(`
★ หมึกที่เราประดิษฐ์เอง (ไม่มีบนแผ่น) ${tot.toLocaleString()} px`);
    for (let k = 1; k < 4; k++) if (tally[k])
      console.log(`      ${INVNAME[k].padEnd(24)} ${tally[k].toLocaleString().padStart(6)} px`);
    console.log('      → ดูด้วยตาที่ tools/_invented.png (เทียบกับแผ่นใน cut_sheet.html)');
    REPORT.invented = tally;
    REPORT.made = MADE;
  }
  fs.writeFileSync(path.join(__dirname, '_cuts.json'), JSON.stringify(REPORT));
  console.log(`  ใช้เวลา ${((Date.now()-t0)/1000).toFixed(1)} วินาที`);
}
