/* build_geo.js — สร้างรูปพื้นที่ยึดครองที่ "ไม่มีรูโหว่ ไม่มีรอยต่อ และหยุดที่ชายฝั่งจริง"
 *
 *   tools\landmask.ps1        (รันครั้งเดียว ได้ data\landmask.js)
 *   node tools\build_geo.js   (ได้ data\geo_fill.js)
 *
 * ปัญหาที่แก้ (รอบแรก 2026-08-25): โพลิกอนใน geo.js ลากด้วยมือ ภูมิภาคละ 12–18 จุด
 * ไม่ได้ปูเต็มแผ่นดิน — วัดจริงแล้วพื้นดิน 46% ไม่มีสีเลย → ใช้โพลิกอนเดิมเป็น "เมล็ด"
 * แล้วให้โตออกไปหากันบนตาราง landmask (ขั้น 1–3 ข้างล่าง ไม่เปลี่ยน)
 *
 * ★★ ปัญหาที่แก้ (รอบสอง 2026-08-25 — เจ้าของทักว่า "สีไม่คม ไม่ seamless"):
 * ของเดิมลากเส้นขอบของแต่ละเขตแยกกัน แล้วลดจุด (Douglas–Peucker) **เขตใครเขตมัน**
 * ผลคือพรมแดนเดียวกันถูกลดจุดออกมาเป็นเส้นสองเส้นที่ไม่ทับกันสนิท → มีเสี้ยวขาวรั่ว
 * ระหว่างเขต แล้ว CSS ต้องใช้ stroke หนา 10 หน่วยทากลบ → ขอบเลอะซึมข้ามเขต
 *
 * วิธีใหม่ — **เส้นขอบร่วม (shared arcs)** แบบเดียวกับ TopoJSON:
 *   4.1 ลากเส้นขอบจากตารางเหมือนเดิม แต่จดไว้ด้วยว่าแต่ละช่วงติดกับ "ใคร" อีกฝั่ง
 *   4.2 หั่นเส้นขอบเป็น arc ตามเพื่อนบ้าน — พรมแดนคู่ k–j เป็น arc เดียว ใช้ร่วมกันสองเขต
 *   4.3 ลดจุด + ลบมุมฉาก **ครั้งเดียวต่อ arc** (ปลาย arc ตรึงไว้ที่จุดสามแยกเสมอ)
 *   4.4 ประกอบรูปแต่ละเขตกลับจาก arc → พรมแดนสองฝั่งเป็นพิกัดชุดเดียวกันเป๊ะ ๆ
 *       ไม่มีรอยรั่วให้ stroke ต้องกลบอีก (CSS ลดเหลือ 1.5 แค่กัน anti-alias)
 *
 * ผลพลอยได้ที่ตั้งใจ: TK.regionArcs — รายการ arc พร้อมชื่อเขตสองฝั่ง
 * ให้ strategic.js ใช้ตีกรอบเน้นแบบ "เส้นขอบรวมของกลุ่มเขต" (DECISIONS §17)
 * โดยไม่ต้อง union รูปตอนรันจริง
 *
 * ผลลัพธ์ไปอยู่ที่ TK.regions[id].fill — strategic.js ใช้ fill ถ้ามี ไม่มีก็ใช้ d เดิม
 * ลบ data\geo_fill.js ทิ้งเมื่อไหร่ ทุกอย่างกลับไปเป็นแบบเดิมทันที
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'geo.js'));
require(path.join(ROOT, 'data', 'landmask.js'));

const R    = window.TK.regions;
const MASK = window.TK.landmask;
const { cell: CELL, w: W, h: H, rows } = MASK;

/* ระยะโตสูงสุด (ช่อง) · 110 ช่อง = 550 หน่วยแผนที่
   เคยตั้งไว้ 45 เพราะกลัวว่าจะไปอ้างสิทธิ์ทุ่งหญ้าเหนือ แต่วัดแล้วที่ 45 มันก็อ้างไปแล้ว
   ระยะสั้นจึงไม่ได้ช่วยอะไรนอกจากทิ้งหลุมขาวไว้ตามชายฝั่ง — ที่ฝูเจี้ยน (13k ตร.หน่วย)
   ที่หนานจง (141k) และที่เกาจิ๋วใต้ (20k) ซึ่งทั้งสามที่ล้วนเป็นดินแดนของสามก๊กจริง ๆ
   ที่ 110 เหลือหลุม 0.9% เป็นมุมใต้สุดที่อยู่นอกขอบเรื่องไปแล้ว */
/* 110 → 150 (2026-08-26): พอมีกำแพงกับเส้นพิมพ์เป็นแนวกั้นจริงแล้ว ระยะโตไม่ใช่ตัวคุม
   ทิศเหนือ/ตะวันตกอีกต่อไป — ขยายให้ฝั่งจ๊กถมแถบตะวันตกเฉียงใต้ที่เจ้าของทัก
   ("มุมซ้ายสีแต้มไม่ครบ ต้องมีสีของจ๊กก๊ก") ได้ถึงเส้นแดงพอดี */
const GROW = Number(process.argv[2] || 150);
/* ความคลาดเคลื่อนตอนลดจุด (หน่วยแผนที่)
   เดิม 4 และต้องเผื่อ stroke กลบรอยรั่ว — ตอนนี้พรมแดนเป็นเส้นร่วม รั่วไม่ได้อีกแล้ว
   ลดเหลือ 3 เพื่อเก็บรูปทรงจริงมากขึ้น (ตาราง 1 ช่อง = 5 หน่วย ขั้นบันไดสูงสุด ~2.5) */
const DPTOL = 3;

/* ── พื้นดิน ─────────────────────────────────────────────────────────────── */
const land = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    land[y * W + x] = rows[y].charCodeAt(x) === 49 ? 1 : 0;

/* ปิดร่องน้ำแคบก่อน — แม่น้ำไม่ใช่เส้นแบ่งที่ทำให้สีพื้นที่ขาดออกจากกัน
   ถ้าไม่ทำ แยงซีกับฮวงโหจะกลายเป็นร่องขาวผ่ากลางแคว้น และเมืองท่าริมน้ำ
   จะตกอยู่นอกทุกภูมิภาค — วัดแล้วหลุด 16 แห่ง

   วิธี: ขยายพื้นดินออก CLOSE ช่องแล้วหดกลับเท่าเดิม (morphological closing)
   ร่องที่แคบกว่า 2xCLOSE จะถูกเชื่อมปิด ส่วนทะเลกับทะเลสาบใหญ่ (ต้งถิง ผัวหยาง ไท่)
   กว้างกว่านั้นมาก จึงรอดมาเป็นน้ำเหมือนเดิม */
const CLOSE = 4;
function morph(src, grow) {
  let cur = src;
  for (let s = 0; s < Math.abs(grow); s++) {
    const next = new Uint8Array(cur);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (grow > 0 ? cur[i] : !cur[i]) continue;
      let touch = false;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (grow > 0 ? cur[ny * W + nx] : !cur[ny * W + nx]) { touch = true; break; }
      }
      if (touch) next[i] = grow > 0 ? 1 : 0;
    }
    cur = next;
  }
  return cur;
}
const rawLand = land.reduce((n, v) => n + v, 0);
const closed = morph(morph(land, CLOSE), -CLOSE);
closed.forEach((v, i) => { land[i] = v; });
console.log(`closed narrow channels (${CLOSE} cells = ${CLOSE * CELL} units): ` +
            `land ${rawLand} → ${land.reduce((n, v) => n + v, 0)} cells`);

/* ── กำแพงจากเส้นประเขตแดนที่พิมพ์บนแผ่น (DECISIONS §16 · เจ้าของสั่ง 2026-08-25) ──
   แผ่นพิมพ์พรมแดนสามรัฐปี 221 เป็นเส้นประหมึกแดง (tools\bordermask.ps1 สกัดมาให้)
   ใช้เป็นกำแพงตอน BFS: สีเติบโตไปชนเส้นพิมพ์แล้วหยุด → เขตแดนบนจอทาบเส้นบนแผ่นพอดี
   "มันจะได้แสดงพื้นที่ตามต้นฉบับแผนที่ก่อน และมันจะเป็น Base ของทั้งเรื่อง" — เจ้าของ
   ไม่มีไฟล์ bordermask = ทำงานแบบเดิมทุกประการ (ไม่พัง แค่ไม่ทาบ) */
let wall = new Uint8Array(W * H);
/* ★★ outside — ทุ่งหญ้าเหนือกำแพง (2026-08-26 เจ้าของทัก "สี/เขตยังทะลุกำแพง")
   ช่องที่เดินบนบกจากขอบบนแผ่นมาถึงได้โดยไม่ข้ามกำแพง = นอกจักรวรรดิ ห้ามมีสี
   ถ้าไม่มี bordermask จะเป็นศูนย์ทั้งตาราง (ทำงานแบบเดิม) */
const outside = new Uint8Array(W * H);
/* เขตที่ labelAt อยู่นอกกำแพง (มีเหลียวตงเขตเดียว) = เขตนอกโดยชอบธรรม
   seed ไม่โดนตัด แต่การโตในทุ่งหญ้าถูกจำกัดที่ EXEMPT_GROW ช่อง กันสีลามไปตามชายฝั่ง */
let exempt = null;
try { require(path.join(ROOT, 'data', 'bordermask.js')); } catch (e) {}
const BM = window.TK.bordermask;
if (BM && BM.w === W && BM.h === H) {
  /* '1' เส้นประแดง (พรมแดนสามรัฐ) · '2' กำแพงเมืองจีน (ชายแดนเหนือ) — กั้นทั้งคู่ */
  const ink1 = new Uint8Array(W * H), ink2 = new Uint8Array(W * H);
  let raw = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++){
      const ch = BM.rows[y].charCodeAt(x);
      if (ch === 49) { ink1[y * W + x] = 1; raw++; }
      if (ch === 50) { ink2[y * W + x] = 1; raw++; }
    }

  /* ── ★★ เย็บกำแพงเมืองจีนให้เป็นแนวตันก่อนใช้ (2026-08-26) ─────────────────
     หมึกเทาที่สแกนมาขาดเป็นช่วงตรงที่แม่น้ำ/ตัวหนังสือผ่าแนว — BFS ไหลอ้อมรูพวกนี้
     ขึ้นไปถมทุ่งหญ้าจนถึงขอบแผ่น (คือ "สีทะลุกำแพง" ที่เจ้าของเห็น แม้กำแพงส่วนใหญ่จะจับได้)
     เย็บสามชั้น แล้ว log ทุกเข็ม:
       1. ก้อนกำแพงแถบเหนือที่ห่างกัน ≤ BRIDGE ช่อง — ลากเส้นตรงเชื่อม
       2. ปลายก้อนที่จ่อขอบซ้าย/ขอบบน/ทะเล — ลากปิดให้ถึง
       3. ช่องขาด "ภายในก้อนเดียวกัน" ที่การจับคู่ข้ามก้อนมองไม่เห็น — ระบุพิกัดตรง ๆ
          (มีจุดเดียว: ป้าย Shang Gu ผ่ากำแพงนอก) */
  const BRIDGE = 20;          // ช่อง (100 หน่วย) — รูที่กว้างกว่านี้ถือว่าตั้งใจเปิด
  const WALL_Y = 100;         // ก้อนกำแพงจริงมี centroid เหนือ cell y=100 (map 500) —
                              // เศษลายเทาอื่น ๆ บนแผ่น (ศาลา/ตัวหนังสือใต้แผ่น) ไม่เข้าเกณฑ์
  function components(mask, minSize) {
    const comp = new Int32Array(W * H).fill(-1);
    const out = [];
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || comp[i] >= 0) continue;
      const cells = [i]; comp[i] = out.length;
      for (let q = 0; q < cells.length; q++) {
        const c = cells[q], x = c % W, y = (c / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (mask[j] && comp[j] < 0) { comp[j] = out.length; cells.push(j); }
        }
      }
      out.push(cells);
    }
    return out.filter(c => c.length >= (minSize || 1));
  }
  const isNorth = c => {
    let sy = 0;
    for (const cc of c) sy += (cc / W) | 0;
    return sy / c.length < WALL_Y;
  };
  function bresenham(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      ink2[y0 * W + x0] = 1;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
  }
  let merged = true;
  while (merged) {
    merged = false;
    const comps = components(ink2, 8).filter(isNorth);
    outer:
    for (let a = 0; a < comps.length; a++) for (let b = a + 1; b < comps.length; b++) {
      let best = null, bd = BRIDGE + 1;
      for (const ca of comps[a]) {
        const ax = ca % W, ay = (ca / W) | 0;
        for (const cb of comps[b]) {
          const bx = cb % W, by = (cb / W) | 0;
          const d = Math.hypot(ax - bx, ay - by);
          if (d < bd) { bd = d; best = [ax, ay, bx, by]; }
        }
      }
      if (best) {
        bresenham(best[0], best[1], best[2], best[3]);
        console.log(`  เย็บกำแพง: (${best[0]*CELL},${best[1]*CELL})–(${best[2]*CELL},${best[3]*CELL}) ยาว ${(bd*CELL).toFixed(0)} หน่วย`);
        merged = true; break outer;
      }
    }
  }
  for (const c of components(ink2, 25).filter(isNorth)) {
    let wBest = null, tBest = null, sBest = null, sD = BRIDGE + 1;
    for (const cc of c) {
      const x = cc % W, y = (cc / W) | 0;
      if (!wBest || x < wBest[0]) wBest = [x, y];
      if (!tBest || y < tBest[1]) tBest = [x, y];
      for (let r = 1; r <= BRIDGE; r++) {
        let hit = null;
        for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (!land[ny * W + nx]) { hit = [nx, ny]; break; }
        }
        if (hit) { if (r < sD) { sD = r; sBest = [x, y, hit[0], hit[1]]; } break; }
      }
    }
    if (wBest && wBest[0] > 0 && wBest[0] <= BRIDGE) {
      bresenham(wBest[0], wBest[1], 0, wBest[1]);
      console.log(`  ปิดปลายกำแพง→ขอบตะวันตก จาก (${wBest[0]*CELL},${wBest[1]*CELL})`);
    }
    if (tBest && tBest[1] > 0 && tBest[1] <= BRIDGE) {
      bresenham(tBest[0], tBest[1], tBest[0], 0);
      console.log(`  ปิดปลายกำแพง→ขอบบน จาก (${tBest[0]*CELL},${tBest[1]*CELL})`);
    }
    if (sBest && sD > 1) {
      bresenham(sBest[0], sBest[1], sBest[2], sBest[3]);
      console.log(`  ปิดปลายกำแพง→ทะเล (${sBest[0]*CELL},${sBest[1]*CELL})–(${sBest[2]*CELL},${sBest[3]*CELL})`);
    }
  }
  /* ช่องขาดภายในก้อนเดียวกัน — การจับคู่ข้ามก้อนข้างบนมองไม่เห็น (สองฝั่งของรู
     เชื่อมถึงกันอ้อมวงกำแพงคู่แถบ Dai) ต้องชี้พิกัดตรง ๆ · ตรวจแล้วมีจุดเดียวทั้งแผ่น:
     ตัวหนังสือ "Shang Gu" บนแผ่นผ่าแนวกำแพงนอก (map 1100,20 → 1155,5) */
  bresenham(220, 4, 231, 1);
  console.log('  เย็บกำแพงนอกช่วงป้าย Shang Gu: (1100,20)–(1155,5)');

  for (let i = 0; i < wall.length; i++) if (ink1[i] || ink2[i]) wall[i] = 1;
  /* ขีดของเส้นประมีช่องไฟระหว่างกัน — พองออก 1 ช่องแบบ 8 ทิศ ให้เป็นแนวต่อเนื่อง
     (BFS เดิน 4 ทิศ กำแพงที่แตะกันแค่มุมทแยงยังรั่วได้ พองแล้วตัน) */
  const fat = new Uint8Array(wall);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (fat[y * W + x]) continue;
    scan: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (wall[ny * W + nx]) { fat[y * W + x] = 1; break scan; }
    }
  }
  wall = fat;
  console.log(`printed-border wall: ${raw} ink cells → ${wall.reduce((n, v) => n + v, 0)} wall cells after sealing`);

  /* ── ★★ ท่วมหาทุ่งหญ้า: จากขอบบนแผ่น เดินบนบก 4 ทิศ ห้ามข้ามกำแพง
     จำกัดในแถบเหนือ y ≤ BAND — กันการไหลอ้อมแถบขอบแผ่นตะวันออก (เหลียวตง/ชายฝั่ง)
     ลงมาโผล่ในที่ราบจากทิศใต้ ซึ่งไม่ใช่ทุ่งหญ้าเหนือกำแพง ────────────────── */
  const BAND = 72;   // 360 หน่วยแผนที่ — กำแพงทั้งแนวอยู่เหนือเส้นนี้
  {
    /* ห้ามเดินสองคอลัมน์ขวาสุด — เส้นกรอบแผ่นถูก landmask อ่านเป็นแผ่นดินแถบยาว
       ถ้าปล่อยให้เดิน flood จะไหลลงกรอบมาโผล่ที่สันดอนกลางอ่าวแล้วกัดสีชิงโจว */
    const XMAX = W - 2;
    const q = [];
    for (let x = 0; x < XMAX; x++)
      if (land[x] && !wall[x]) { outside[x] = 1; q.push(x); }
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= XMAX || ny >= H || ny > BAND) continue;
        const j = ny * W + nx;
        if (outside[j] || !land[j] || wall[j]) continue;
        outside[j] = 1; q.push(j);
      }
    }
  }
  console.log(`ทุ่งหญ้าเหนือกำแพง (นอกจักรวรรดิ ไม่ระบายสี): ${outside.reduce((n, v) => n + v, 0)} ช่อง`);
} else if (BM) {
  console.log('⚠ bordermask grid mismatch — ignored');
} else {
  console.log('⚠ no data/bordermask.js — fills will not snap to the printed borders (run tools\\bordermask.ps1)');
}
/* แถบข้างกำแพง (±2 ช่อง) — คลื่นสองข้างล่างถมได้เฉพาะแถบนี้ กัน "การถม" กลายเป็น
   "การโตต่อ" ออกไปกินทุ่งหญ้าเกินโควตา GROW */
const nearWall = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  scan2: for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (wall[ny * W + nx]) { nearWall[y * W + x] = 1; break scan2; }
  }
}

/* ── โพลิกอนเมล็ด ───────────────────────────────────────────────────────── */
const ids = Object.keys(R);
const polys = ids.map(id => {
  const pts = [];
  const re = /([ML])\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g;
  let m;
  while ((m = re.exec(R[id].d))) pts.push([+m[2], +m[3]]);
  return pts;
});

function inPoly(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* ── 1. แปะช่องที่อยู่ในโพลิกอนเดิม ─────────────────────────────────────── */
const own = new Int16Array(W * H).fill(-1);
let seeded = 0;
for (let y = 0; y < H; y++) {
  const my = y * CELL + CELL / 2;
  for (let x = 0; x < W; x++) {
    if (!land[y * W + x]) continue;
    const mx = x * CELL + CELL / 2;
    for (let k = 0; k < polys.length; k++) {
      if (inPoly(polys[k], mx, my)) { own[y * W + x] = k; seeded++; break; }
    }
  }
}

/* ── 1.5 ★★ seed ห้ามคร่อมกำแพง (เจ้าของทัก 2026-08-25 รอบสอง: "สียัง fit ไม่หมด") ──
   โพลิกอนใน geo.js ลากมือมาก่อนยุคกำแพง หลายเขตจึงลากเผื่อคร่อมเส้นพิมพ์
   (อี้โจวล้ำตะวันออกข้ามแนวอี้-จิง · ฮั่นจงล้ำเหนือข้ามแนวฉินหลิ่ง ·
    จินเฉิง/จางเย่ล้ำตะวันตกเฉียงใต้ลงที่ราบสูงเชียง) — ช่องที่ seed ทับไว้ฝั่งโน้น
   ไม่ได้มาจากการโต กำแพงจึงหยุดมันไม่ได้ = สามรอยรั่วที่เจ้าของชี้พอดี

   กฎ: ช่องกำแพงไม่เป็นของใคร แล้วเขตหนึ่งเก็บเฉพาะ "ก้อนที่เชื่อมถึงจุด labelAt
   ของตัวเอง" (จุดวางป้ายอยู่กลางใจเขตเสมอ) · ก้อนที่หลุดไปอีกฝั่งของกำแพง = ตัดทิ้ง
   ให้เขตฝั่งนั้นถมแทนตอนคลื่นหนึ่ง/สอง · ถ้าหา labelAt ไม่เจอ ให้เก็บก้อนใหญ่สุดแทน
   (การคร่อมที่ "ตั้งใจ" แบบปีกไป๋ตี้ของอี้โจวไม่โดนตัด — มันอยู่ฝั่งเดียวกับ labelAt) */
exempt = ids.map(id => {
  const la = R[id].labelAt;
  if (!la) return false;
  const cx = Math.floor(la[0] / CELL), cy = Math.floor(la[1] / CELL);
  return !!outside[cy * W + cx];
});
if (exempt.some(Boolean))
  console.log('เขตนอกกำแพงโดยชอบธรรม (labelAt อยู่ในทุ่งหญ้า): ' +
              ids.filter((_, k) => exempt[k]).join(', '));
{
  for (let i = 0; i < own.length; i++) if (wall[i]) own[i] = -1;
  /* ★ seed ของเขตในที่ตกในทุ่งหญ้า = ลากเผื่อไว้ก่อนยุคกำแพง ตัดทิ้งตรง ๆ
     (เขต exempt ไม่โดน — บ้านของมันอยู่นอกกำแพงจริง) */
  let cutOut = 0;
  for (let i = 0; i < own.length; i++)
    if (own[i] >= 0 && outside[i] && !exempt[own[i]]) { own[i] = -1; cutOut++; }
  if (cutOut) console.log(`  seed clip: ตัด seed ในทุ่งหญ้า ${cutOut} ช่อง`);
  const compId = new Int32Array(W * H).fill(-1);
  for (let k = 0; k < ids.length; k++){
    /* ก้อน 4 ทิศของช่องที่ seed เป็นเขต k (กำแพงตัดขาด) */
    const comps = [];
    for (let i = 0; i < own.length; i++){
      if (own[i] !== k || compId[i] >= 0) continue;
      const cells = [i]; compId[i] = comps.length;
      for (let q = 0; q < cells.length; q++){
        const c = cells[q], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (own[j] === k && compId[j] < 0){ compId[j] = comps.length; cells.push(j); }
        }
      }
      comps.push(cells);
    }
    if (comps.length < 2) continue;
    /* ก้อนที่ถือ labelAt (หาช่องใกล้สุดในรัศมี 4 ช่อง) — ไม่เจอค่อยถอยไปก้อนใหญ่สุด */
    const la = R[ids[k]].labelAt;
    let keep = -1;
    if (la){
      const cx = Math.floor(la[0] / CELL), cy = Math.floor(la[1] / CELL);
      outer: for (let rr = 0; rr <= 4 && keep < 0; rr++)
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (own[j] === k){ keep = compId[j]; break outer; }
        }
    }
    if (keep < 0){
      let best = 0;
      comps.forEach((c, ci) => { if (c.length > comps[best].length) best = ci; });
      keep = best;
    }
    let cut = 0;
    comps.forEach((c, ci) => { if (ci !== keep){ cut += c.length; for (const j of c) own[j] = -1; } });
    if (cut) console.log(`  seed clip: ${ids[k]} ตัดก้อนคร่อมกำแพงทิ้ง ${comps.length - 1} ก้อน (${cut} ช่อง)`);
  }
}

/* ── 2–3. BFS ออกไปหาพื้นดินที่ยังว่าง เดินผ่านพื้นดินเท่านั้น ──────────────
   ★ ห้ามข้าม "กำแพงเส้นพิมพ์" — ห้ามทั้งโตเข้าไปในกำแพง และห้ามโตออกจากช่องกำแพง
   ★★ ห้ามโตเข้าทุ่งหญ้าเหนือกำแพง — ยกเว้นเขต exempt (เหลียวตง) ที่ให้โตในบ้านตัวเอง
      ได้แค่ EXEMPT_GROW ช่อง กันสีเลื้อยไปตามชายฝั่งถึง Bai Tan */
const EXEMPT_GROW = 10;
let frontier = [];
for (let i = 0; i < own.length; i++) if (own[i] >= 0 && !wall[i]) frontier.push(i);
let grown = 0;
for (let step = 0; step < GROW && frontier.length; step++) {
  const next = [];
  for (const i of frontier) {
    const x = i % W, y = (i / W) | 0, k = own[i];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (own[j] >= 0 || !land[j] || wall[j]) continue;
      if (outside[j] && (!exempt[k] || step >= EXEMPT_GROW)) continue;
      own[j] = k; grown++; next.push(j);
    }
  }
  frontier = next;
}

/* ── 3.5 ถมแนวกำแพงให้สองฝั่งบรรจบกลางเส้นพิมพ์พอดี ─────────────────────────
   กำแพงหนา ~3 ช่องเป็นดินไร้เจ้าของอยู่ ถ้าปล่อยไว้จะเป็นร่องขาวคาแนวเส้น
   คลื่นสองนี้ให้สองฝั่งงอกเข้าหากันเฉพาะ "แถบข้างกำแพง" (nearWall) —
   จุดที่มาเจอกันคือกึ่งกลางแนวหมึกโดยธรรมชาติ */
let frontier2 = [];
for (let i = 0; i < own.length; i++) if (own[i] >= 0) frontier2.push(i);
let healed = 0;
for (let step = 0; step < 8 && frontier2.length; step++) {
  const next = [];
  for (const i of frontier2) {
    const x = i % W, y = (i / W) | 0, k = own[i];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (own[j] >= 0 || !land[j] || !nearWall[j]) continue;
      if (outside[j] && !exempt[k]) continue;   // สีหยุดที่ขอบเหนือของแนวหมึก ไม่ล้นขึ้นทุ่ง
      own[j] = k; healed++; next.push(j);
    }
  }
  frontier2 = next;
}
if (healed) console.log(`sealed the wall strip: +${healed} cells now owned`);

/* ── 3.6 ★★ เติมหลุมใน (2026-08-26 — เจ้าของทัก "มีบริเวณที่สีแต้มไม่ถึง") ──────
   แอ่งที่กำแพงสองชั้นล้อมไว้ (Dai Jun / Bai Deng / Ma Yi) เป็นดินจักรวรรดิจริง
   แต่ BFS เข้าไม่ถึงเพราะกำแพงกั้นรอบด้าน — คลื่นนี้เดิน "ข้ามช่องกำแพงได้"
   เฉพาะดินในที่ยังไร้เจ้าของ (ไม่ใช่ทุ่งหญ้า) จนเต็ม
   ข้ามกำแพงได้แต่ออกนอกไม่ได้: ช่องทุ่งหญ้าโดน outside บล็อกอยู่แล้ว */
let frontier3 = [];
for (let i = 0; i < own.length; i++) if (own[i] >= 0) frontier3.push(i);
let pocketFill = 0;
while (frontier3.length) {
  const next = [];
  for (const i of frontier3) {
    const x = i % W, y = (i / W) | 0, k = own[i];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (own[j] >= 0 || !land[j] || outside[j]) continue;
      own[j] = k; pocketFill++; next.push(j);
    }
  }
  frontier3 = next;
}
if (pocketFill) console.log(`เติมหลุมในกำแพง (แอ่ง Dai/Shanggu ฯลฯ): +${pocketFill} ช่อง`);

/* ── 4.1 ลากเส้นขอบจากตาราง พร้อมจดเพื่อนบ้านของแต่ละช่วง ───────────────
   เก็บด้านของช่องที่ติดกับ "ไม่ใช่ภูมิภาคนี้" แล้วร้อยเป็นวงปิด
   ทิศทางของแต่ละด้านตั้งไว้ให้วงต่อกันได้เอง · แต่ละก้าวรู้ว่าอีกฝั่งคือเขตไหน
   (เขตอื่น = ดัชนีเขต · น้ำ/นอกแผ่น/ดินไร้เจ้าของ = -1)                       */
function traceWithNeighbors(k) {
  const edges = new Map();                       // "x,y" ต้นทาง → [[ปลายทาง, เพื่อนบ้าน]...]
  const key = (x, y) => x + ',' + y;
  /* เพื่อนบ้าน: ดัชนีเขต ≥0 · -1 ชายฝั่ง/น้ำ · -2 ขอบแผ่น · -3 ดินไร้เจ้าของ
     (§17 ใช้แยกว่าเส้นขอบท่อนไหนควรวาดเป็นวงเน้น ท่อนไหนไม่มีความหมาย) */
  const add = (ax, ay, bx, by, nx, ny) => {
    const a = key(ax, ay);
    if (!edges.has(a)) edges.set(a, []);
    const j = ny * W + nx;
    const nb = (nx < 0 || ny < 0 || nx >= W || ny >= H) ? -2
             : (own[j] >= 0 ? own[j] : (!land[j] ? -1 : -3));
    edges.get(a).push([bx, by, nb]);
  };
  const is = (x, y) => x >= 0 && y >= 0 && x < W && y < H && own[y * W + x] === k;

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (own[y * W + x] !== k) continue;
    if (!is(x, y - 1)) add(x,     y,     x + 1, y,     x, y - 1);
    if (!is(x + 1, y)) add(x + 1, y,     x + 1, y + 1, x + 1, y);
    if (!is(x, y + 1)) add(x + 1, y + 1, x,     y + 1, x, y + 1);
    if (!is(x - 1, y)) add(x,     y + 1, x,     y,     x - 1, y);
  }

  const loops = [];
  while (edges.size) {
    const startKey = edges.keys().next().value;
    let [cx, cy] = startKey.split(',').map(Number);
    const loop = [];                             // [{pt:[x,y], nb}] — nb ของก้าวที่ออกจาก pt
    while (true) {
      const list = edges.get(key(cx, cy));
      if (!list || !list.length) break;
      const [nx, ny, nb] = list.pop();
      if (!list.length) edges.delete(key(cx, cy));
      loop.push({ pt: [cx * CELL, cy * CELL], nb });
      cx = nx; cy = ny;
      if (key(cx, cy) === startKey) break;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

/* ── เครื่องมือลดจุด/ลบมุม — เวอร์ชัน "ปลายตรึง" ใช้กับ arc เปิด ─────────
   ตารางให้ขอบเป็นฟันปลามุมฉาก ถ้าไม่ทำจะเห็นขั้นบันไดชัดตอนซูม
   จุดปลาย arc คือจุดสามแยกระหว่างเขต ต้องอยู่กับที่เสมอ ไม่งั้นเขตสองฝั่งแยกจากกัน */
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, fd = tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function chaikinOpen(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    out.push([ax + (bx - ax) * 0.25, ay + (by - ay) * 0.25]);
    out.push([ax + (bx - ax) * 0.75, ay + (by - ay) * 0.75]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const rnd = p => [Math.round(p[0]), Math.round(p[1])];
const smoothOpen = pts => {
  const s = chaikinOpen(dp(pts, DPTOL)).map(rnd);
  /* จุดซ้ำติดกันหลังปัดเศษ ตัดทิ้ง — กัน L ซ้ำจุดใน path */
  return s.filter((p, i) => !i || p[0] !== s[i-1][0] || p[1] !== s[i-1][1]);
};

/* ── 4.2–4.3 หั่นเป็น arc ตามเพื่อนบ้าน แล้วลดจุดครั้งเดียวต่อ arc ────────
   arc ระหว่างคู่เขต (k,j) ถูกสร้างตอนประมวลเขตที่ดัชนีน้อยกว่า แล้วเขตที่มากกว่า
   มาหยิบตัวเดียวกันไปใช้กลับทิศ — จับคู่ด้วยกุญแจจากรูปดิบ (ปลายสองข้าง + ความยาว
   + จุดกลาง) ซึ่งสมมาตรต่อการกลับทิศ                                            */
const arcs = [];                 // {pts:[[x,y]…] (เกลาแล้ว), a:kIdx, b:jIdx|-1}
const arcByKey = new Map();
const perRegion = ids.map(() => []);   // ต่อเขต: [loop…] · loop = [{arc, rev}…]

const midOf = pts => {
  const n = pts.length;
  if (n % 2) { const p = pts[(n - 1) / 2]; return p[0] + ',' + p[1]; }
  const a = pts[n / 2 - 1], b = pts[n / 2];
  return ((a[0] + b[0]) / 2) + ',' + ((a[1] + b[1]) / 2);
};
const rawKey = (k, j, pts) => {
  const e = [pts[0].join(','), pts[pts.length - 1].join(',')].sort();
  return `${Math.min(k, j)}|${Math.max(k, j)}|${e[0]}|${e[1]}|${pts.length}|${midOf(pts)}`;
};
/* วงปิดที่ไม่มีสามแยก (เขตล้อมกันสนิท) — เริ่มวงที่จุดเล็กสุดเพื่อให้สองฝั่งตรงกัน */
function normalizeRing(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++)
    if (pts[i][0] < pts[s][0] || (pts[i][0] === pts[s][0] && pts[i][1] < pts[s][1])) s = i;
  return pts.slice(s).concat(pts.slice(0, s));
}

let sharedHits = 0;
ids.forEach((id, k) => {
  for (const loop of traceWithNeighbors(k)) {
    /* หมุนให้วงเริ่มที่รอยต่อระหว่าง run — run แรกกับ run ท้ายจะได้ไม่ถูกผ่ากลาง */
    let s = 0;
    while (s < loop.length && loop[s].nb === loop[(s - 1 + loop.length) % loop.length].nb) s++;
    const L = s === loop.length ? loop : loop.slice(s).concat(loop.slice(0, s));
    const closedRing = s === loop.length;        // เพื่อนบ้านเดียวทั้งวง

    /* แบ่งเป็น run ต่อเพื่อนบ้าน · pts ของ run = มุมตั้งแต่ต้นถึงปลาย (ปลาย = ต้นของ run ถัดไป) */
    const runs = [];
    let cur = null;
    for (let i = 0; i < L.length; i++) {
      const e = L[i];
      if (!cur || cur.nb !== e.nb) { cur = { nb: e.nb, pts: [e.pt] }; runs.push(cur); }
      else cur.pts.push(e.pt);
      /* จุดปลายของก้าวนี้ = จุดต้นของก้าวถัดไป (หรือจุดแรกของวงเมื่อครบรอบ) */
      const nxt = L[(i + 1) % L.length].pt;
      cur.pts.push(nxt);
      /* กันจุดซ้ำ: ก้าวถัดไปใน run เดิมจะ push จุดต้นของมันซ้ำ — ลบทิ้งตอนก้าวหน้า */
      if (i + 1 < L.length && L[i + 1].nb === e.nb) cur.pts.pop();
    }

    const loopArcs = [];
    for (const run of runs) {
      let pts = run.pts;
      if (closedRing) pts = normalizeRing(pts.slice(0, -1)).concat([]);   // ตัดจุดปิดวงซ้ำ
      const j = run.nb;
      if (j >= 0) {
        const key = rawKey(k, j, closedRing ? pts.concat([pts[0]]) : pts);
        const hit = arcByKey.get(key);
        if (hit !== undefined) {                 // อีกฝั่งสร้างไว้แล้ว — ใช้ตัวเดียวกันกลับทิศ
          loopArcs.push({ arc: hit, rev: true });
          sharedHits++;
          continue;
        }
        const sm = closedRing
          ? smoothOpen(pts.concat([pts[0]]))     // วงปิด: เกลาแบบตรึงจุดเริ่ม (= จุดเล็กสุด)
          : smoothOpen(pts);
        const idx = arcs.push({ pts: sm, a: k, b: j }) - 1;
        arcByKey.set(key, idx);
        loopArcs.push({ arc: idx, rev: false });
      } else {
        const sm = closedRing ? smoothOpen(pts.concat([pts[0]])) : smoothOpen(pts);
        loopArcs.push({ arc: arcs.push({ pts: sm, a: k, b: j }) - 1, rev: false });
      }
    }
    if (loopArcs.length) perRegion[k].push(loopArcs);
  }
});

/* ── 4.4 ประกอบรูปแต่ละเขตกลับจาก arc ───────────────────────────────────── */
const lines = [];
let totalPts = 0, kept = 0;
ids.forEach((id, k) => {
  const loops = perRegion[k];
  if (!loops.length) return;
  kept++;
  const d = loops.map(loopArcs => {
    const seq = [];
    for (const { arc, rev } of loopArcs) {
      const p = rev ? arcs[arc].pts.slice().reverse() : arcs[arc].pts;
      /* จุดแรกของ arc นี้ = จุดท้ายของ arc ก่อนหน้า — ตัดตัวซ้ำทิ้ง */
      for (let i = seq.length ? 1 : 0; i < p.length; i++) seq.push(p[i]);
    }
    /* จุดท้ายวง = จุดแรกวง (Z ปิดให้) — ถ้าซ้ำอยู่ตัดทิ้ง */
    if (seq.length > 1 && seq[0][0] === seq[seq.length-1][0] && seq[0][1] === seq[seq.length-1][1])
      seq.pop();
    totalPts += seq.length;
    return 'M ' + seq.map(p => `${p[0]},${p[1]}`).join(' L ') + ' Z';
  }).join(' ');
  lines.push(`  ${id}: ${JSON.stringify(d)},`);
});

/* ── arc สำหรับกรอบเน้นเขต (DECISIONS §17) ───────────────────────────────
   ขอบที่ไม่ใช่เขตต่อเขต ติดชนิดไว้ให้ผู้วาดเลือกปฏิบัติ:
     coast = ชายฝั่ง/ริมน้ำ · edge = ขอบแผ่น · line = สุดเขตที่เกาะแนวเส้นพิมพ์
     open = สุดเขตการโตเฉย ๆ (ไม่มีเส้นจริงรองรับ — วงเน้นไม่ควรวาด)              */
function arcType(a){
  if (a.b >= 0) return null;
  if (a.b === -1) return 'coast';
  if (a.b === -2) return 'edge';
  let near = 0;
  for (const p of a.pts){
    const cx = Math.min(W - 1, Math.max(0, Math.floor(p[0] / CELL)));
    const cy = Math.min(H - 1, Math.max(0, Math.floor(p[1] / CELL)));
    if (nearWall[cy * W + cx]) near++;
  }
  return near / a.pts.length >= 0.6 ? 'line' : 'open';
}
const arcLines = arcs.map(a => {
  const t = arcType(a);
  return `  { a:${JSON.stringify(ids[a.a])}, b:${a.b >= 0 ? JSON.stringify(ids[a.b]) : 'null'}, ` +
    (t ? `t:${JSON.stringify(t)}, ` : '') +
    `d:${JSON.stringify('M ' + a.pts.map(p => `${p[0]},${p[1]}`).join(' L '))} },`;
});

const out =
`/* geo_fill.js — GENERATED by tools\\build_geo.js · never edit by hand
 * Change the shapes in data\\geo.js, then run:  node tools\\build_geo.js
 *
 * These are geo.js's hand-drawn polygons grown outward until they meet each other and the
 * real coastline. The borders that were drawn on purpose do not move — what is added is
 * only the white space that used to sit between them.
 * Grown at most ${GROW} cells (${GROW * CELL} map units) · simplified at ${DPTOL} units.
 *
 * ★ Borders are SHARED ARCS: the line between two regions is simplified once and used by
 *   both sides, so adjacent fills meet exactly — no slivers, no fat stroke needed (§17).
 *   TK.regionArcs lists every arc with the region on each side (b:null = coast/outside);
 *   strategic.js uses it to outline any group of regions without drawing inner borders.
 *
 * Delete this file and the map falls straight back to geo.js's own shapes — no code change.
 */
window.TK = window.TK || {};
window.TK.regionsFill = {
${lines.join('\n')}
};
window.TK.regionArcs = [
${arcLines.join('\n')}
];
for (const id in window.TK.regionsFill)
  if (window.TK.regions[id]) window.TK.regions[id].fill = window.TK.regionsFill[id];
`;

fs.writeFileSync(path.join(ROOT, 'data', 'geo_fill.js'), out, 'utf8');

const landCells = land.reduce((n, v) => n + v, 0);
const ownedCells = own.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
console.log(`grid ${W}x${H} · ${landCells} land cells`);
console.log(`inside the original polygons: ${seeded} cells (${(seeded/landCells*100).toFixed(1)}% of land)`);
console.log(`grown by ${grown} cells → ${(ownedCells/landCells*100).toFixed(1)}% of land now filled`);
console.log(`arcs: ${arcs.length} total · ${sharedHits} reused by the second side ` +
            `(ทุกพรมแดนใน ต้องถูก reuse — ถ้า 0 แปลว่ากุญแจจับคู่พัง)`);
console.log(`✔ wrote data/geo_fill.js — ${kept}/${ids.length} regions · ${totalPts} points`);
