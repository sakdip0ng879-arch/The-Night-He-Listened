/* check_forces.js — ★★ ตัวตรวจ **ข้ามฉาก** (หนี้จากเซสชันที่ 9 · ทำ 2026-09-01)
 *
 *   node tools\check_forces.js            เฉพาะที่มีปัญหา
 *   node tools\check_forces.js --all      + สมุดเดินทางของทุกกองที่มีชื่อ
 *
 * ── ทำไมต้องมี ────────────────────────────────────────────────────────────
 * ตัวตรวจทั้งห้าตัวที่มีอยู่เป็น **รายฉาก** ทุกตัว · ไม่มีตัวไหนเปิดสองฉากพร้อมกัน
 * หนี้ก้อนนี้ถูกจดไว้ตั้งแต่เซสชันที่ 9 เป็นสามข้อ:
 *   (ก) จุดตั้งต้นของ route เป็นแดนฝ่ายตัวเอง ณ เวลานั้น
 *       → **ทำแล้ว** ใน `check_map` ข้อ 5 (เอกสารจดว่ายังไม่ทำ — ค้าง แก้แล้ว)
 *   (ข) route ไม่ทะลุ node ของศัตรู เว้นแต่เป็นการถอย        → ไฟล์นี้ ข้อ 1
 *   (ค) กองที่มีชื่อ โผล่ฉากใหม่ต่อจากจุดที่เห็นครั้งสุดท้าย   → ไฟล์นี้ ข้อ 2 + 3
 *
 * ⚠⚠ **ข้อจำกัดที่ต้องพูดให้ชัด** — ข้อ (ค) ฉบับนี้ **จะไม่จับเคส c11-05 ที่เจ้าของ
 *    จับได้เอง** (ลูกศรกองล่อจบที่เจี้ยนเย่ปี 270 ทั้งที่ร้อยแก้วบอกว่านั่งฝั่งเหนือ
 *    สี่ปีครึ่ง) เพราะสองฉากนั้นห่างกันสี่ปีและใช้คนละ route คนละชื่อ — ไม่มีอะไร
 *    ให้เครื่องเชื่อมสองก้อนนั้นเข้าด้วยกัน · สิ่งที่ทำได้แทนคือ **ข้อ 3: สมุดเดินทาง**
 *    ซึ่งพิมพ์เส้นทางของทุกกองที่มีชื่อออกมาเรียงกัน ให้*คน*กวาดตาแล้วเห็นรอยต่อที่แปลก
 *    (แบบเดียวกับที่ `check_hud` พิมพ์เส้นทาง `front` แทนที่จะฟ้องเป็น error)
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'geo.js'));
require(path.join(ROOT, 'data', 'roads.js'));
try { require(path.join(ROOT, 'data', 'geo_fill.js')); } catch { /* ใช้รูปที่ลากมือ */ }
require(path.join(ROOT, 'data', 'timeline.js'));

const TK = window.TK, T = TK.timeline, REG = TK.regions, P = TK.places;
const LBL = s => (TK.factions[s] || {}).label || s;
const NAME = w => (TK.people[w] || {}).label || w;

/* ── รูปเขต + จุดอยู่ในเขตไหน (ยกมาจาก check_map ให้เหมือนกันทุกบรรทัด) ──── */
function loops(d){
  const out = [];
  for (const chunk of (d || '').split('M').slice(1)){
    const pts = []; const re = /(-?[\d.]+)\s*,\s*(-?[\d.]+)/g; let m;
    while ((m = re.exec(chunk))) pts.push([+m[1], +m[2]]);
    if (pts.length > 2) out.push(pts);
  }
  return out;
}
const shape = {};
for (const id in REG) shape[id] = loops(REG[id].fill || REG[id].d);
const inPoly = (pts, x, y) => {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const regionAt = (x, y) => {
  for (const id in shape) for (const ring of shape[id]) if (inPoly(ring, x, y)) return id;
  return null;
};
function ownersAt(n){
  const o = {};
  for (const id in REG) o[id] = REG[id].owner;
  for (let i = 0; i <= n; i++) Object.assign(o, T[i].mapDelta || {});
  return o;
}

const err = [], warn = [], note = [];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ═══ 1 · (ข) การเดินทัพทะลุ node ที่ศัตรูถืออยู่ ══════════════════════════
   กองทัพเดินผ่านเมืองของข้าศึกเฉย ๆ ไม่ได้ — ต้องตี ต้องล้อม หรือต้องเลี่ยง
   ยกเว้นสามกรณี:
     · `retreat` — การถอยผ่านดินที่เพิ่งเสียไปเป็นเรื่องปกติ
     · node ปลายทาง — ปลายทางเป็นของศัตรูได้ นั่นคือประเด็นของการเดินทัพ
     · ฉากนั้นมี `clash` ที่ node นั้นพอดี — แปลว่าเรื่องเล่าการตีมันอยู่แล้ว   */
{
  for (let n = 0; n < T.length; n++){
    const b = T[n], own = ownersAt(n);
    const clashAt = new Set((b.markers || [])
      .filter(m => m.type === 'clash' && m.place).map(m => m.place));
    /* หมุดที่จุดนั้นก็นับว่า "ฉากพูดถึงมันแล้ว" — ผู้ตั้งรับไม่ต้องมีลูกศร (check_map ข้อ 6) */
    const pinAt = new Set((b.markers || [])
      .filter(m => m.type === 'pin' && m.place).map(m => m.place));
    for (const m of (b.markers || [])){
      if (m.type !== 'arrow' || !m.route || m.retreat || !m.side || m.side === 'none') continue;
      const mr = TK.marches[m.route]; if (!mr || !mr.path) continue;
      /* ข้ามจุดแรกกับจุดสุดท้าย — ต้นทางมี check_map ข้อ 5 คุมอยู่ ปลายทางเป็นของศัตรูได้ */
      const hits = [];
      for (const nid of mr.path.slice(1, -1)){
        const p = P[nid]; if (!p || p.x == null) continue;
        if (clashAt.has(nid) || pinAt.has(nid)) continue;
        const rid = regionAt(p.x, p.y); if (!rid) continue;
        const holder = own[rid];
        if (!holder || holder === m.side || holder === 'none') continue;
        hits.push((p.label || nid) + '(' + LBL(holder) + ')');
      }
      if (hits.length)
        warn.push(`${b.id} ${b.year}: "${m.route}" ผ่าน ${hits.join(' · ')} ` +
                  `โดยไม่มีทั้งวงปะทะและหมุดที่จุดนั้น`);
    }
  }
}

/* ═══ 2 · (ค1) กองที่มีชื่อ "วาร์ป" — ปรากฏใหม่ไกลจากที่เห็นครั้งสุดท้าย ═══
   แม่ทัพย้ายที่ยืนระหว่างฉากได้เป็นปกติ (กลับเมืองหลวง ถูกส่งไปแนวอื่น) กฎนี้จึง
   **ไม่ห้ามการย้าย** มันห้ามการย้ายที่ *เวลาไม่พอ* เท่านั้น:
     ปีเดียวกัน + ห่างเกิน JUMP หน่วย + ไม่มีลูกศรของตัวเองพามา = วาร์ป
   ⚠ ปีต่างกัน = ผ่านไปหลายเดือน เดินได้ทั้งแผ่นดิน — รายงานในสมุดเดินทางแทน  */
const JUMP = 120;
const track = {};                                   /* who → [{beat, year, from, to}] */
{
  const last = {};
  for (let n = 0; n < T.length; n++){
    const b = T[n];
    for (const m of (b.markers || [])){
      if (m.type !== 'arrow' || !m.who || !m.route) continue;
      const mr = TK.marches[m.route]; if (!mr || !mr.path) continue;
      /* who ใช้กับ Avatar ของบุคคลด้วย การควบม้าเข้าท้องพระโรงไม่ใช่การย้ายกองทัพ
         แยกจากสายตรวจที่ตั้งทัพ โดยข้ามเฉพาะ rider ที่ไม่มีกำลังทั้งสองแหล่ง */
      if ((m.rider || mr.rider) && !m.strength && !mr.troops){
        note.push(`${b.id}: ${NAME(m.who)} เดินทางส่วนบุคคล — ไม่เปลี่ยนที่ตั้งกองทัพ`);
        continue;
      }
      const from = mr.path[0], to = mr.path[mr.path.length - 1];
      (track[m.who] = track[m.who] || []).push({ beat:b.id, year:b.year, from, to });
      const prev = last[m.who];
      /* ★ การเดินทัพเดียวกันถูกวาดซ้ำในฉากถัดไปเป็นแบบแผนปกติของเล่มนี้ —
         ฉากหลังลากทั้งเส้นใหม่ตั้งแต่ต้นทางเพื่อให้เห็นว่าทัพมาจากไหน
         (c7-05→c7-06 เว่ยเหยียน · c8-12→c8-13 ซือหม่าอี้ ทั้งคู่เป็นเคสนี้)
         ถ้าเส้นใหม่ **มีจุดที่เห็นครั้งสุดท้ายอยู่ในเส้นทางของมัน** = เล่าต่อ ไม่ใช่วาร์ป */
      const continues = prev && (m.route === prev.route || mr.path.includes(prev.to));
      if (prev && !continues && prev.to !== from && prev.year === b.year){
        const a = P[prev.to], c = P[from];
        if (a && c && a.x != null && c.x != null){
          const d = dist(a, c);
          if (d > JUMP)
            err.push(`${b.id} ${b.year}: ${NAME(m.who)} เห็นครั้งสุดท้ายที่ ` +
                     `${a.label || prev.to} (${prev.beat}) แล้วโผล่ที่ ${c.label || from} ` +
                     `ห่าง ${Math.round(d)} หน่วย **ในปีเดียวกัน** โดยไม่มีลูกศรพามา`);
        }
      }
      last[m.who] = { to, beat:b.id, year:b.year, route:m.route };
    }
  }
}

/* ═══ 3 · (ค2) สมุดเดินทางของทุกกองที่มีชื่อ — พิมพ์ให้คนอ่าน ไม่ใช่ให้เครื่องตัดสิน ═══
   นี่คือสิ่งที่ทำแทนข้อ (ค) ฉบับเต็มได้จริง · รอยต่อที่ **ปลายทางเดิม ≠ ต้นทางใหม่**
   ถูกทำเครื่องหมาย ⇢ ไว้ให้กวาดตา — ส่วนใหญ่ถูกต้อง (เขาเดินกลับไปเอง) แต่ตัวที่
   ผิดจะอยู่ในรายการนี้เสมอ · แบบเดียวกับที่ check_hud พิมพ์เส้นทาง `front`         */
{
  const rows = [];
  for (const w of Object.keys(track).sort((a,b)=>track[b].length-track[a].length)){
    const seq = track[w];
    if (seq.length < 2) continue;
    let line = `  ${NAME(w).padEnd(12)}`;
    const bits = [];
    for (let i = 0; i < seq.length; i++){
      const s = seq[i];
      const gap = i > 0 && seq[i-1].to !== s.from;
      bits.push((gap ? '⇢ ' : '') + `${s.year}:${(P[s.from]||{}).label || s.from}→${(P[s.to]||{}).label || s.to}`);
    }
    rows.push(line + bits.join('  '));
  }
  note.push(...rows);
}

/* ── รายงาน ── */
console.log('check_forces — ตัวตรวจข้ามฉาก (ข) + (ค)\n');
if (process.argv.includes('--all')){
  console.log(`สมุดเดินทางของกองที่มีชื่อ (⇢ = ต้นทางใหม่ไม่ตรงปลายทางเดิม):`);
  console.log(note.join('\n') + '\n');
}
if (warn.length){
  console.log('การเดินทัพที่ผ่าน node ของศัตรูโดยฉากไม่ได้พูดถึงจุดนั้น (' + warn.length + ' เส้น):');
  console.log('  ⚠ ในเล่มนี้ "เดินผ่านป้อมที่เลือกจะไม่ตี" เป็น **กลไกหลักของเรื่อง** ไม่ใช่บั๊ก');
  console.log('    (ค่าผ่านทางเฉินชาง · โซ่ป้อม · "คราวนี้เขาไม่ตี เขาเดินผ่าน") —');
  console.log('    รายการนี้จึงเป็น**บัญชีไว้ทบทวน** ว่าทุกเส้นตั้งใจ ไม่ใช่รายการของที่พัง\n');
  for (const w of warn) console.log('  · ' + w);
  console.log();
}
for (const e of err)  console.log('✖ ' + e);
const jumps = note.reduce((s, r) => s + (r.match(/⇢/g) || []).length, 0);
console.log(`\n${T.length} ฉาก · ${Object.keys(track).length} กองที่มีชื่อ · ` +
            `รอยต่อที่ต้นทางไม่ตรงปลายทางเดิม ${jumps} จุด (ดูด้วย --all) · ` +
            `${err.length} ข้อผิดพลาด`);
process.exit(err.length ? 1 : 0);
