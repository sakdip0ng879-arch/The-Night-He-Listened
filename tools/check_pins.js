/* check_pins.js — หมุดแต่ละอันอยู่ถูก "เวลา" ของเรื่องหรือยัง
 *
 *   node tools\check_pins.js
 *
 * ที่มา (เจ้าของสั่ง 2026-09-06): *"เชคด้วยว่าหมุดแต่ละที่ถูกต้องตามเวลาตามเนื้อเรื่อง
 *  ของมันหรือยัง ... ไม่ใช่แค่วาดมันลงไปให้จบ ๆ"*
 *
 * ⚠ ตัวนี้ **ไม่ใช่ผู้ตัดสิน** เหมือน check_fact — มันลดทั้งเรื่องให้เหลือรายการสั้น ๆ
 *   ที่ต้องเอาตาไปดู · หลายข้อที่มันฟ้องเป็นเรื่องถูกต้อง (กองทัพเดินอยู่ในแดนข้าศึก
 *   ย่อมอยู่ในแผ่นดินของอีกฝ่ายเป็นปกติ) หน้าที่มันคือทำให้ "ต้องดูกี่จุด" เป็นคำถามที่ตอบได้
 *
 * ต่างจาก check_map.js ตรงไหน: check_map ดู **ฉากปะทะ** ว่าลูกศรขัดกับเจ้าของพื้นที่ไหม
 * ตัวนี้ดู **เส้นเวลา** — สิ่งเดียวกันเมื่อเวลาต่างกัน ต้องเปลี่ยนตามเรื่องที่เล่าไปแล้ว
 *
 * ตรวจห้าอย่าง
 *   1. ฉากเดินถอยหลังในเวลา (ยกเว้นฉาก mirror ที่ตั้งใจย้อน)
 *   2. หมุดติดธงฝ่ายหนึ่ง แต่ยืนอยู่ในแผ่นดินของอีกฝ่าย โดยฉากนั้นไม่มีลูกศรของฝ่ายนั้นเข้ามา
 *      → ถ้าไม่ใช่กองทัพที่กำลังเดิน ก็แปลว่าหมุดค้างจากยุคก่อน
 *   3. ★ ธงของ "สถานที่เดียวกัน" พลิกข้างโดยไม่มี mapDelta คั่นระหว่างสองฉากนั้น
 *      → เมืองเปลี่ยนมือโดยที่แผนที่ไม่เคยเล่าว่ามันเปลี่ยน = คนอ่านจับได้ทันที
 *   4. หมุดที่ไม่ตกอยู่ในภูมิภาคใดเลย — บอกเจ้าของพื้นที่ไม่ได้
 *   5. คนที่ note บอกว่าสิ้นไปแล้ว ยังถูกอ้างชื่อในฉากปีหลังจากนั้น
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'geo.js'));
try { require(path.join(ROOT, 'data', 'geo_fill.js')); } catch { /* ไม่มีก็ใช้รูปที่ลากมือ */ }
require(path.join(ROOT, 'data', 'timeline.js'));

const TK  = window.TK;
const REG = TK.regions;
const PL  = TK.places;
const B   = TK.timeline;

/* ── รูปภูมิภาค (ใช้รูปที่วาดจริง เหมือน check_map) ─────────────────────── */
function loops(d){
  const out = [];
  for (const chunk of String(d).split('M').slice(1)){
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
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const regionAt = (x, y) => {
  for (const id in shape) if (shape[id].some(l => inPoly(l, x, y))) return id;
  return null;
};

/* เจ้าของ ณ ฉากที่ n — เริ่มจาก geo.js แล้วสะสม mapDelta (เหมือน engine ทำ) */
function ownersAt(n){
  const o = {};
  for (const id in REG) o[id] = REG[id].owner;
  for (let i = 0; i <= n; i++) Object.assign(o, B[i].mapDelta || {});
  return o;
}
const LBL  = s => (TK.factions[s] || {}).label || s;
const PLBL = p => (PL[p] || {}).label || p;
const SEASON = { spring:1, summer:2, autumn:3, winter:4, '':0 };

const out = [];
const add = (kind, beat, msg) => out.push({ kind, id: beat.id, year: beat.year, msg });

/* ── 1 · เวลาเดินถอยหลัง ─────────────────────────────────────────────── */
{
  /* ⚠ ฉากที่ไม่ได้ระบุฤดู (season: '') **ไม่ใช่ฤดูที่ศูนย์** และก็ไม่ใช่ "ฤดูเดิม" ด้วย
     มันคือ *ไม่ได้บอก* → เทียบฤดูกับมันไม่ได้เลย เทียบได้แต่ปี
     (ลองนับเป็นศูนย์ได้ 9 จุดปลอม · ลองให้สืบทอดฤดูก่อนหน้าได้ 2 จุดปลอม) */
  let prev = null;
  B.forEach((b, n) => {
    /* ฉาก mirror (เอกภพคู่ขนาน) และฉากเสียงผู้เฝ้ามอง ย้อนเวลาได้โดยตั้งใจ
       — ผู้เฝ้ามองเปิดภาคด้วยการมองย้อนกลับไปทั้งสามภาคก่อนหน้า (เช่น c4-01) */
    /* ★ ฉากผู้เฝ้ามองมีสองแบบ และต้องแยกกัน — ในเรื่องมีถึง 29 ฉาก
       · แบบ **ย้อนทั้งภาค** (c4-01 เปิดภาค 4 ด้วยการกลับไปปี 224 เล่าฝั่งวุ่ย)
         → ต้อง **รีเซ็ตเข็มเวลา** ไม่งั้นฉากถัดไปทั้งภาคถูกฟ้องหมด
       · แบบ **แทรกความเห็น** (ส่วนใหญ่) ปีเดินหน้าตามปกติ
         → แค่ **ข้ามตัวเอง** ห้ามรีเซ็ต ไม่งั้นตัวตรวจจะตาบอดไปทั้งเรื่อง
       แยกด้วยสิ่งที่มันทำจริง: ถ้ามันพาปีถอยหลัง = ย้อนภาค · ถ้าไม่ = แทรกความเห็น
       ⚠ เคยรีเซ็ตทุกฉาก watcher แล้วตัวตรวจเงียบสนิท — ทดสอบด้วยการใส่ความผิดพลาด
         ที่รู้คำตอบแล้วถึงจับได้ว่ามันไม่ได้มองเห็นอะไรเลย */
    if (b.mirror){ prev = null; return; }
    if (b.voice === 'watcher'){ if (prev && b.year < prev.year) prev = null; return; }
    if (prev){
      const back = b.year < prev.year
        || (b.year === prev.year && b.season && prev.season
            && SEASON[b.season] < SEASON[prev.season]);
      if (back)
        add('เวลาถอยหลัง', b,
          `${prev.id} อยู่ที่ ${prev.year} ${prev.season || '-'} แต่ฉากนี้ ${b.year} ${b.season || '-'}`);
    }
    /* ฉากที่ไม่บอกฤดู ไม่อัปเดตฤดูอ้างอิง แต่ยังอัปเดตปี */
    prev = { id: b.id, year: b.year, season: b.season || (prev && prev.year === b.year ? prev.season : '') };
  });
}

/* ── 2 · หมุดติดธง แต่ยืนในแผ่นดินของอีกฝ่าย และไม่มีลูกศรของฝ่ายนั้นเข้ามา ── */
B.forEach((b, n) => {
  const own = ownersAt(n);
  /* ★ ค่ายที่ตั้งไว้ตั้งแต่ฉากก่อน ยังอยู่ในฉากนี้ — ลูกศรที่พามันมาอยู่ข้างหลังแล้ว
     (ค่ายหลวงที่อู่จ้างหยวนตั้งใน c7-07 ซึ่งมีลูกศรฮั่น · c7-08 เล่าต่อจากค่ายนั้น)
     จึงต้องมองย้อนสองฉาก ไม่ใช่ดูแค่ฉากตัวเอง */
  const marching = new Set();
  for (let i = Math.max(0, n - 2); i <= n; i++)
    for (const k of B[i].markers || []) if (k.type === 'arrow' && k.side) marching.add(k.side);
  for (const m of b.markers || []){
    if (m.type !== 'pin' || !m.side || m.side === 'none') continue;
    const p = PL[m.place]; if (!p) continue;
    const r = regionAt(p.x, p.y);
    if (!r){ add('หมุดนอกภูมิภาค', b, `${PLBL(m.place)} (${p.x},${p.y}) ไม่ตกในภูมิภาคใดเลย`); continue; }
    if (own[r] === m.side) continue;
    if (marching.has(m.side)) continue;         /* กองทัพที่กำลังเดิน อยู่แดนข้าศึกได้ */
    /* ฉากนี้หรือฉากติดกันพูดถึงภูมิภาคนี้อยู่แล้ว = กำลังเล่าเรื่องมันอยู่ ไม่ใช่หมุดค้าง */
    let live = (b.markers || []).some(k => k.type === 'clash');
    for (let i = Math.max(0, n-1); i <= Math.min(B.length-1, n+1) && !live; i++)
      if ((B[i].mapDelta || {})[r] !== undefined) live = true;
    if (live) continue;
    add('ธงหมุดขัดกับเจ้าของพื้นที่', b,
      `${PLBL(m.place)} ปักธง${LBL(m.side)} แต่ ${r} เป็นของ${LBL(own[r])} และฉากนี้ไม่มีลูกศร${LBL(m.side)}`);
  }
});

/* ── 3 · ★ ธงของสถานที่เดียวกันพลิกข้าง โดยที่แผนที่ไม่เคยแตะภูมิภาคนั้นเลย ────
   ⚠⚠ **สองบทเรียนจากตัวตรวจนี้เอง** (2026-09-06) — ทั้งคู่มาจากการเดาความหมายของข้อมูล
   1. `m.side` ของหมุด **ไม่ใช่ "ใครเป็นเจ้าของ"** มันคือ "ธงของใครอยู่ตรงนี้ในฉากนี้"
      ซึ่งรวมกองรักษาการณ์ที่กำลังยอมแพ้ (c8-10 ปักธงวุ่ยบนเมืองที่ฮั่นเพิ่งยึดคืน — ถูก)
      เกณฑ์จึงเป็น "แผนที่เคยเล่าเรื่องภูมิภาคนี้ในช่วงนั้นไหม" ไม่ใช่ "เล่าตรงทิศไหม"
   2. ที่เดียวกันมีหมุดหลายฝ่ายในฉากเดียวได้ = **สมรภูมิ/การล้อม** ไม่ใช่การเปลี่ยนมือ
      (โช่วชุน c10-08 มีทั้งทัพล้อมของวุ่ย และสามหมื่นของง่อในกำแพงเดียวกัน — ถูกทั้งคู่)
      จึงต้องจำเป็น **เซตของฝ่ายที่เห็นในฉากนั้น** ไม่ใช่ฝ่ายล่าสุดตัวเดียว */
{
  const seen = {};                              /* place -> {sides:Set, n, id} */
  B.forEach((b, n) => {
    const here = {};                            /* ฝ่ายที่ปรากฏบนที่นั้น *ในฉากนี้* */
    for (const m of b.markers || []){
      if (!m.place || !m.side || m.side === 'none' || m.type === 'arrow') continue;
      (here[m.place] = here[m.place] || new Set()).add(m.side);
    }
    for (const place in here){
      const prev = seen[place];
      if (!prev) continue;
      const fresh = [...here[place]].filter(s => !prev.sides.has(s));
      if (!fresh.length) continue;
      const p = PL[place];
      const r = p ? regionAt(p.x, p.y) : null;
      /* แผนที่เคยแตะภูมิภาคนี้ในช่วงนั้นไหม */
      let told = false;
      for (let i = prev.n; i <= n && !told; i++)
        if (r && (B[i].mapDelta || {})[r] !== undefined) told = true;
      if (told) continue;
      /* ★★ กองทัพที่ *ผ่านมา* กับเมืองที่ *เปลี่ยนมือ* แยกกันด้วย **ความคงทน**
         ธงที่โผล่ฉากเดียวแล้วหายไป คือกองทัพที่ยกมาแล้วยกกลับ (ง่อที่โช่วชุน c10-08
         ถูกล้อมอยู่ในกำแพงฉากเดียว ฉากถัดไปเป็นของวุ่ยอีก — ถูกต้อง)
         ธงที่ยังอยู่ในฉากหลัง ๆ ทั้งที่แผ่นดินยังไม่เปลี่ยนสี คือ **แผนที่ตามเรื่องไม่ทัน** */
      const lasting = fresh.filter(side => {
        for (let i = n + 1; i < B.length; i++){
          if (r && (B[i].mapDelta || {})[r] !== undefined) return false;   /* แผนที่ตามทันแล้ว */
          for (const m2 of B[i].markers || [])
            if (m2.place === place && m2.type !== 'arrow' && m2.side === side) return true;
        }
        return false;
      });
      if (!lasting.length) continue;
      add('แผนที่ตามเรื่องไม่ทัน', b,
        `${PLBL(place)}: ${prev.id} ธง${[...prev.sides].map(LBL).join('/')}`
        + ` → ${b.id} ธง${lasting.map(LBL).join('/')} และยังเป็นแบบนั้นในฉากถัด ๆ ไป`
        + ` แต่ ${r || '(ไม่รู้ภูมิภาค)'} ยังไม่เคยเปลี่ยนสีเลย`);
    }
    for (const place in here) seen[place] = { sides: here[place], n, id: b.id };
  });
}

/* ── 5 · คนที่สิ้นไปแล้ว ยังถูกอ้างในฉากปีหลังจากนั้น ────────────────────── */
{
  /* note เป็นร้อยแก้ว ไม่ใช่ข้อมูลมีโครงสร้าง — อ่านด้วย regex เท่านั้น
     เจอ "สิ้น...ปี NNN" หรือ "ตาย...ปี NNN" ก็ถือว่าเป็นปีตายคร่าว ๆ ไว้ให้เอาตาดูต่อ */
  const died = {};
  for (const id in TK.people){
    const s = String(TK.people[id].note || '').replace(/\s+/g, ' ');
    const m = s.match(/(?:สิ้น|ตาย|ถูกประหาร|สิ้นใจ|สิ้นพระชนม์)[^0-9]{0,40}ปี\s*(\d{3})/);
    if (m) died[id] = +m[1];
  }
  B.forEach(b => {
    for (const m of b.markers || []){
      const w = m.who; if (!w) continue;
      for (const id of (Array.isArray(w) ? w : [w])){
        if (died[id] && b.year > died[id])
          add('อ้างคนที่สิ้นไปแล้ว', b,
            `${(TK.people[id] || {}).label || id} — note บอกว่าสิ้นปี ${died[id]} แต่ฉากนี้ปี ${b.year}`);
      }
    }
  });
  const n = Object.keys(died).length;
  console.log(`อ่านปีสิ้นจาก note ได้ ${n} คน (จาก ${Object.keys(TK.people).length})`);
}

/* ── รายงาน ─────────────────────────────────────────────────────────── */
const byKind = {};
for (const o of out) (byKind[o.kind] = byKind[o.kind] || []).push(o);

console.log(`\nฉาก ${B.length} · หมุด/ลูกศร/ปะทะ ${B.reduce((s,b)=>s+(b.markers||[]).length,0)} อัน\n`);
for (const kind of Object.keys(byKind)){
  const list = byKind[kind];
  console.log(`■ ${kind} — ${list.length} จุด`);
  for (const o of list.slice(0, 20)) console.log(`    ${o.id} (${o.year})  ${o.msg}`);
  if (list.length > 20) console.log(`    … อีก ${list.length - 20} จุด`);
  console.log('');
}
if (!out.length) console.log('ไม่พบจุดที่ต้องเอาตาไปดู');
else console.log(`รวม ${out.length} จุดที่ต้องเอาตาไปดู`
  + ' — ตัวนี้ไม่ใช่ผู้ตัดสิน หลายข้ออาจถูกต้องอยู่แล้ว');
