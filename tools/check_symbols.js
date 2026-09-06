/* check_symbols.js — รูปสัญลักษณ์ของเราไปบังตัวหนังสือที่ *แผ่นพิมพ์ไว้* ตรงไหนบ้าง
 *
 *   node tools\check_symbols.js
 *   node tools\check_symbols.js --vb 700        ดูที่ระยะซูมอื่น
 *
 * ที่มา (เจ้าของทัก 2026-09-06): *"สัญลักษณ์มันทับชื่อเมืองบนแผนที่ ... ที่แคปให้คือ
 *  แค่ตัวอย่าง มันมีอีกหลายจุดมาก เราต้องมาคิดว่าเราจะแก้ยังไง"*
 *
 * ★ วิธีคิด: ชื่อเมืองบนแผ่นเป็น **หมึกดำ** ซึ่งเราถอดไว้แล้วตั้งแต่ตอนทำแผ่นเอง
 *   (`tools/_plate_dark.rle` — ดู DECISIONS §14) แม้โครงการแผ่นเองจะปิดไปแล้ว
 *   หน้ากากนั้นยังมีค่าอยู่: มันคือ "ที่ที่มีตัวหนังสือ" ของแผ่นต้นฉบับ
 *   → วัดได้ตรง ๆ ว่ารูปของเราทับหมึกดำไปกี่พิกเซล **ไม่ต้องเดา ไม่ต้องไล่ดูทั้งแผ่น**
 *
 * ⚠ ไม่ใช่ผู้ตัดสิน — ทับนิดหน่อยเป็นเรื่องปกติและอ่านออกอยู่ (รูปเป็นพื้นขาวขอบเข้ม
 *   มันบังแบบ *อ่านรู้ว่าถูกบัง* ไม่ใช่กลืนหาย) · หน้าที่มันคือเรียงลำดับว่าจุดไหนหนักสุด
 *
 * แก้ยังไงเมื่อเจอ: ใส่ `sdx` / `sdy` (หน่วยแผนที่) ลงในสถานที่นั้นใน data/places.js
 *   รูปจะเลื่อนไปจากจุดหมุดตามค่านั้น ส่วนจุดกลมกับป้ายยังอยู่ที่เดิม
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));

const TK = window.TK, PL = TK.places;
const RLE = path.join(__dirname, '_plate_dark.rle');
if (!fs.existsSync(RLE)){
  console.log('⚠ ไม่เจอ tools/_plate_dark.rle — รัน tools\\plate_ink.ps1 ก่อน');
  console.log('  (ไฟล์นี้ถูก .gitignore ไว้เพราะเป็นหมึกที่ถอดจากแผ่นของ William L)');
  process.exit(0);
}
/* ── อ่านหน้ากาก — ใช้ readRle ตัวเดียวกับที่เขียนไฟล์นี้ขึ้นมา ห้ามเขียนเอง
   (รูปแบบเป็น start:length ต่อแถว ไม่ใช่ run สลับ — เขียนใหม่แล้วพลาดทันที) */
const { readRle } = require(path.join(__dirname, "build_plate_water.js"));
const { W, H, m: dark } = readRle(RLE);

/* ── ขนาดรูปตามกฎจริงของแอป (strategic.js §3) ─────────────────────────── */
const GLYPH_PX = { capital:34, city:30, town:30, pass:30, fort:30, camp:30, farm:30,
                   depot:30, ford:30, valley_mouth:30, mountain:30 };
const VB_REF = 900, SIZE_ALPHA = 0.7;
const gi = process.argv.indexOf('--vb');
const VBW = gi > -1 ? +process.argv[gi+1] : 900;      /* ยิ่งซูมออก รูปยิ่งกินพื้นที่แผนที่มาก */
const SCREEN_W = 1500;                                 /* กว้างจอที่ใช้จริงตอนถ่ายภาพตรวจงาน */
const zoomF = Math.min(1.6, Math.max(1, Math.pow(VB_REF / VBW, 1 - SIZE_ALPHA)));
const mu = VBW / SCREEN_W;                             /* หน่วยแผนที่ต่อ 1 พิกเซลจอ */

const rows = [];
for (const id in PL){
  const p = PL[id];
  const px = GLYPH_PX[p.type];
  if (!px) continue;                                   /* ชนิดที่ไม่มีรูป */
  const size = px * zoomF * mu;                        /* ด้านของรูป (หน่วยแผนที่) */
  /* รูปยืนบนจุด: ล่างสุดอยู่ที่ p.y · กึ่งกลางแนวนอนที่ p.x (ตรงกับ scalePins) */
  const x0 = Math.round(p.x - size/2 + (p.sdx || 0)), y0 = Math.round(p.y - size + (p.sdy || 0));
  const x1 = Math.round(x0 + size),  y1 = Math.round(y0 + size);
  let ink = 0, tot = 0;
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++){ tot++; if (dark[y*W+x]) ink++; }
  if (!tot) continue;
  rows.push({ id, label:p.label, map:p.map || '—', type:p.type,
              ink, pct: ink / tot * 100, box:[x0, y0, x1, y1] });
}
rows.sort((a, b) => b.ink - a.ink);

const HEAVY = rows.filter(r => r.pct >= 12);
console.log(`หน้ากากหมึกดำของแผ่น ${W}×${H} · รูปที่มีทั้งหมด ${rows.length} จุด`);
console.log(`คิดที่ระยะซูม viewBox ${VBW} (รูปกว้าง ${(GLYPH_PX.city*zoomF*mu).toFixed(1)} หน่วยแผนที่)\n`);
console.log(`■ ทับหมึกดำของแผ่นตั้งแต่ 12% ขึ้นไป — ${HEAVY.length} จุด`);
for (const r of HEAVY.slice(0, 24))
  console.log(`   ${String(Math.round(r.pct)).padStart(3)}%  ${String(r.ink).padStart(5)} px  `
    + `${r.label.padEnd(14)} ${r.type.padEnd(7)} แผ่นพิมพ์ว่า "${r.map}"`);
if (HEAVY.length > 24) console.log(`   … อีก ${HEAVY.length - 24} จุด`);

/* ══ ★★ หาที่วางใหม่ให้อัตโนมัติ — ไม่ต้องนั่งเลื่อนทีละจุด ═══════════════
   ลองเลื่อนรูปไปรอบ ๆ จุดหมุดเล็กน้อย แล้วเลือกที่ที่ทับหมึกดำน้อยที่สุด
   ⚠ **ห้ามเลื่อนลง** — บนแผ่นนี้ชื่อเมืองอยู่ใต้หรือข้างจุดเสมอ เลื่อนลงคือเดินเข้าหาชื่อ
   ⚠ ต้องมีค่าปรับตามระยะ ไม่งั้นมันจะลากรูปหนีไปไกลจนไม่รู้ว่าหมายถึงเมืองไหน
      (สัญลักษณ์ที่ลอยห่างจากจุด = สัญลักษณ์ที่ชี้ผิดที่ ซึ่งแย่กว่าบังชื่อ)
   ★ **ค่าปรับแนวนอนแพงกว่าแนวตั้งสามเท่า** — รูปที่ขยับขึ้นตรง ๆ ยังอยู่บนแกนเดียวกับจุด
     ตายังลากเส้นกลับไปหาเมืองได้เอง แต่รูปที่ขยับข้างจะไปนั่งใกล้เมืองอื่นแทน */
function inkAt(p, size, dx, dy){
  const x0 = Math.round(p.x - size/2 + dx), y0 = Math.round(p.y - size + dy);
  let ink = 0;
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + size); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + size); x++) if (dark[y*W+x]) ink++;
  return ink;
}
const MOVE = [];
for (const r of HEAVY){
  const p = PL[r.id], size = Math.round(GLYPH_PX[p.type] * zoomF * mu);
  let best = { dx:0, dy:0, ink:r.ink, score:r.ink };
  for (let dy = -16; dy <= 0; dy += 4)
    for (let dx = -8; dx <= 8; dx += 4){
      if (!dx && !dy) continue;
      const ink = inkAt(p, size, dx, dy);
      const score = ink + Math.abs(dx) * 3.2 + Math.abs(dy) * 1.1;   /* เลื่อนขึ้นถูกกว่าเลื่อนข้าง */
      if (score < best.score) best = { dx, dy, ink, score };
    }
  if (best.ink <= r.ink * 0.55 && (best.dx || best.dy))
    MOVE.push({ ...r, dx:best.dx, dy:best.dy, after:best.ink });
}
console.log(`
■ ที่ขยับแล้วดีขึ้นเกินครึ่ง — ${MOVE.length} จุด (พร้อมวางลง data/places.js)`);
for (const m of MOVE)
  console.log(`   ${m.label.padEnd(14)} sdx:${String(m.dx).padStart(3)}, sdy:${String(m.dy).padStart(3)}`
    + `   ${String(m.ink).padStart(4)} → ${String(m.after).padStart(4)} px`
    + `   (${Math.round(m.pct)}% → ${Math.round(m.after / m.ink * m.pct)}%)`);

/* ── --apply : เขียนค่าลง data/places.js ให้เลย ─────────────────────────
   เขียนทับ sdx/sdy เดิมเสมอ (ค่าที่หาได้เป็นค่าสัมบูรณ์จากจุดหมุดจริง ไม่ใช่ค่าสะสม)
   รันซ้ำได้เรื่อย ๆ ผลลัพธ์เท่าเดิม */
if (process.argv.includes('--apply')){
  const PF = path.join(ROOT, 'data', 'places.js');
  const L = fs.readFileSync(PF, 'utf8').split('\n');
  let n = 0;
  for (const m of MOVE){
    const i = L.findIndex(l => l.startsWith('  ' + m.id + ':'));
    if (i < 0){ console.log('  ⚠ หาไม่เจอใน places.js: ' + m.id); continue; }
    L[i] = L[i].replace(/,\s*sdx:-?\d+/, '').replace(/,\s*sdy:-?\d+/, '');
    /* รายการบรรทัดเดียว: แทรกก่อนปีกกาปิด · รายการหลายบรรทัด: แทรกท้ายช่อง type:"…"
       (type: อยู่บรรทัดแรกเสมอในไฟล์นี้ — เป็นช่องสุดท้ายก่อนขึ้นบรรทัด note) */
    const close = L[i].lastIndexOf('}');
    if (close >= 0){
      L[i] = L[i].slice(0, close) + `, sdx:${m.dx}, sdy:${m.dy} ` + L[i].slice(close);
    } else {
      const t = L[i].match(/type:"[a-z_]+"/);
      if (!t){ console.log('  ⚠ ไม่มีช่อง type ในบรรทัดแรก ใส่มือเอง: ' + m.id); continue; }
      L[i] = L[i].replace(t[0], t[0] + `, sdx:${m.dx}, sdy:${m.dy}`);
    }
    n++;
  }
  fs.writeFileSync(PF, L.join('\n'));
  console.log(`
✔ เขียน sdx/sdy ลง data/places.js แล้ว ${n} จุด — รัน check_symbols ซ้ำเพื่อดูผล`);
}

const avg = rows.reduce((s, r) => s + r.pct, 0) / rows.length;
console.log(`\nค่าเฉลี่ยทั้งแผ่น ${avg.toFixed(1)}% · จุดที่แทบไม่ทับเลย (<3%) `
  + `${rows.filter(r => r.pct < 3).length} จุด`);
console.log('\nแก้: ใส่ sdx/sdy (หน่วยแผนที่) ในสถานที่นั้นที่ data/places.js — รูปเลื่อน จุดกลมกับป้ายอยู่ที่เดิม');
