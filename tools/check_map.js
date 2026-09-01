/* check_map.js — ตรวจว่าเจ้าของพื้นที่ในแต่ละฉากขัดกับสิ่งที่ฉากนั้นเล่าไหม
 *
 *   node tools\check_map.js
 *
 * ที่มา: ผู้ใช้ทักว่า "ทำไม Wei เคลื่อนที่ไปตีตัวเอง" ที่ศึกสือถิง
 * สาเหตุคือหมุดสือถิงตกอยู่ในภูมิภาคที่ยังเป็นของวุ่ยตอนปี 228
 * ฉากจึงวาดลูกศรวุ่ยบุกเข้าไปปะทะในแผ่นดินของวุ่ยเอง
 *
 * ตรวจสามอย่างที่ตาคนมองข้ามง่ายแต่คนอ่านจับได้ทันที:
 *   1. ปะทะในแผ่นดินตัวเอง — ทุกลูกศรที่เข้าฉากเป็นฝ่ายเดียวกับเจ้าของพื้นที่
 *   2. ปะทะในแผ่นดินฝ่ายที่สาม — เจ้าของไม่ใช่คู่กรณีสักฝ่าย
 *   3. หมุดปะทะที่ไม่ตกอยู่ในภูมิภาคใดเลย — ไม่มีใครเป็นเจ้าของ บอกอะไรคนอ่านไม่ได้
 *
 * ใช้รูปเดียวกับที่วาดจริง (geo_fill ถ้ามี) ไม่ใช่รูปที่ลากด้วยมือ
 * เพราะสิ่งที่คนอ่านเห็นคือรูปที่วาด ไม่ใช่รูปที่ตั้งใจ
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'geo.js'));
require(path.join(ROOT, 'data', 'roads.js'));   /* ★ roads.js สร้าง TK.routes ให้ · needed by check 4 (arrow destinations) */
try { require(path.join(ROOT, 'data', 'geo_fill.js')); } catch { /* ไม่มีก็ใช้รูปที่ลากมือ */ }
require(path.join(ROOT, 'data', 'timeline.js'));

const TK = window.TK;
const REG = TK.regions;

/* แปลง path เป็นโพลิกอนย่อย — geo_fill มีหลายวงต่อภูมิภาค (เกาะ อ่าว) */
function loops(d) {
  const out = [];
  for (const chunk of d.split('M').slice(1)) {
    const pts = [];
    const re = /(-?[\d.]+)\s*,\s*(-?[\d.]+)/g; let m;
    while ((m = re.exec(chunk))) pts.push([+m[1], +m[2]]);
    if (pts.length > 2) out.push(pts);
  }
  return out;
}
const shape = {};
for (const id in REG) shape[id] = loops(REG[id].fill || REG[id].d);

const inPoly = (pts, x, y) => {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
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
function ownersAt(n) {
  const o = {};
  for (const id in REG) o[id] = REG[id].owner;
  for (let i = 0; i <= n; i++) Object.assign(o, TK.timeline[i].mapDelta || {});
  return o;
}

const LBL = s => (TK.factions[s] || {}).label || s;
const bad = [];

TK.timeline.forEach((b, n) => {
  const clashes = (b.markers || []).filter(m => m.type === 'clash');
  if (!clashes.length) return;
  const own = ownersAt(n);
  /* ⚠⚠ **หมุดที่มี `side` นับเป็นฝ่ายที่อยู่ในสมรภูมิด้วย** — ไม่ใช่แค่ลูกศร
     ข้อนี้เคยนับเฉพาะ `type === 'arrow'` ซึ่งขัดกับหลักที่ตัวตรวจข้อล่าง (SOLO) เขียนไว้เอง
     ว่า "ฝ่ายตั้งรับไม่ต้องมีลูกศร — คนที่ยืนอยู่บนกำแพงไม่ได้เดินไปไหน · หมุดที่มี side ก็นับ"
     ผลของความไม่ตรงกัน: ฉากที่ถูกต้องทุกอย่าง (ผู้บุกมีลูกศร ผู้ตั้งรับมีหมุดพร้อมกำลังพล)
     ถูกฟ้องว่า "ตีตัวเอง" ถ้าสมรภูมิบังเอิญอยู่ในเขตของผู้บุกเอง — ซึ่งเป็นเรื่องปกติมาก
     เวลาข้าศึกบุกเข้ามาในบ้านเรา (เจอ 2026-08-26 ที่ c6-02 · c6-06 · c6-09 พร้อมกันสามฉาก)
     ตัวเลขที่นับตอนนี้จึงเป็น "ฝ่ายที่ปรากฏบนแผนที่ในฉากนี้" ตรงกับข้อล่างแล้ว */
  const sides = [...new Set((b.markers || [])
    .filter(m => (m.type === 'arrow' || m.type === 'pin') && m.side && m.side !== 'none')
    .map(m => m.side))];

  for (const c of clashes) {
    const p = TK.places[c.place];
    if (!p) { bad.push([b, `clash pin "${c.place}" is not in places.js`]); continue; }
    const rid = regionAt(p.x, p.y);
    if (!rid) { bad.push([b, `clash at ${p.label} but the point falls in no region at all`]); continue; }
    const holder = own[rid];

    if (sides.length && sides.every(s => s === holder))
      bad.push([b, `clash at ${p.label}, inside "${REG[rid].label}" already held by ${LBL(holder)}, ` +
                   `but every arrow in the scene is ${LBL(holder)}'s → reads as attacking itself`]);
    /* holder === 'none' is land belonging to nobody (revolt/secession) — anyone may
       clash there. E.g. Shouchun under Zhuge Dan's banner: Wei besieging, Wu relieving. */
    else if (sides.length > 1 && holder !== 'none' && !sides.includes(holder))
      bad.push([b, `clash at ${p.label}, inside "${REG[rid].label}" held by ${LBL(holder)}, ` +
                   `who is not a party to it (${sides.map(LBL).join(' vs ')})`]);
  }
});

/* ── 4. ★ ลูกศรไปจบที่เมืองที่ฉากไม่ได้พูดถึงเลย ─────────────────────────────
   เพิ่ม 2026-08-19 หลังเจ้าของถามว่า "ทำไม Xu Huang ไป Xinye? มันดูไม่สอดคล้องคำบรรยายเลย"
   ตอนนั้นลูกศรจบที่ซินเย่เพราะเหตุผลด้าน**การวาด** ล้วน ๆ (อยากให้รูปหน่วยพ้นวงปะทะ)
   แต่ร้อยแก้วบอกว่าซูฮุยลงมาถึงวงล้อม ผลคือแผนที่พูดคนละเรื่องกับตัวหนังสือข้าง ๆ กัน
   — และไม่มีตัวตรวจไหนเห็น เพราะทุกตัวตรวจเดิมมองแค่ "เรขาคณิตถูกไหม" ไม่เคยมองว่า
   "ภาพกับคำบรรยายพูดตรงกันไหม"

   กฎ: ปลายทางของลูกศรต้องเป็นเมืองที่ฉากนั้น "เอ่ยถึง" อย่างใดอย่างหนึ่ง —
   ชื่อโผล่ใน text · หรือมี marker อื่นในฉากเดียวกันปักอยู่ที่นั่น
   ถ้าไม่เข้าเงื่อนไข แปลว่าลูกศรกำลังพาคนอ่านไปที่ที่เรื่องไม่ได้พูดถึง */
const routeEndPlace = (routeId, back) => {
  const rt = TK.routes[routeId]; if (!rt) return null;
  const n = rt.d.match(/-?[\d.]+/g).map(Number);
  const pt = back ? [n[0], n[1]] : [n[n.length-2], n[n.length-1]];
  let best = null, bd = 1e9;
  for (const id in TK.places){
    const p = TK.places[id], d = Math.hypot(p.x - pt[0], p.y - pt[1]);
    if (d < bd){ bd = d; best = id; }
  }
  return bd <= 25 ? best : null;
};

TK.timeline.forEach(b => {
  const named = new Set();
  for (const m of (b.markers || [])) if (m.place) named.add(m.place);
  const text = (b.text || '') + ' ' + (b.title || '');
  for (const m of (b.markers || [])){
    if (m.type !== 'arrow' || !m.route) continue;
    const dest = routeEndPlace(m.route, !!m.reverse);
    if (!dest) continue;                       /* ปลายทางไม่ใช่เมืองที่มีหมุด — ปล่อย */
    if (named.has(dest)) continue;
    const label = TK.places[dest].label;
    /* ชื่อโผล่ในเนื้อเรื่องไหม (Gong'an / Chang'an มี ' อยู่ในชื่อ เทียบตรง ๆ ได้) */
    if (text.includes(label)) continue;
    /* ทัพเดินไปถึง "ที่ที่กำลังรบ" ก็นับว่าสอดคล้อง แม้ชื่อเมืองปลายทางจะไม่ถูกเอ่ย —
       ซูฮุยลงมาถึงวงล้อมที่ฟานเฉิง แล้วตีเข้าที่ Sizhong ซึ่งห่างกัน 24 หน่วย
       ถ้าไม่ผ่อนข้อนี้ ตัวตรวจจะบังคับให้ทุกฉากท่องชื่อเมืองปลายทาง ซึ่งทำให้ร้อยแก้วแข็ง */
    const nearMarked = [...named].some(id => {
      const a = TK.places[id], c = TK.places[dest];
      return a && c && Math.hypot(a.x - c.x, a.y - c.y) <= 40;
    });
    if (nearMarked) continue;
    bad.push([b, `arrow "${m.route}" ends at ${label}, which this scene never mentions — ` +
                 `not in the text and not pinned. Either the route is wrong for the scene, ` +
                 `or the scene should say why the army stops there.`]);
  }
});

/* ── 5. ★★ ลูกศรออกจากแผ่นดินของฝ่ายอื่น ────────────────────────────────────
   SCHEMA ข้อ 2 เขียนไว้ตั้งแต่ต้นว่า "ลูกศรต้องออกจากที่ที่ฝ่ายนั้นอยู่จริง"
   แต่**ไม่เคยมีตัวตรวจไหนตรวจข้อนี้เลย** ทั้งที่มันคือชนิดของบั๊กที่คนอ่านจับได้ทันที

   เจอครั้งแรก 2026-08-19 ที่ c1-11: ขบวนเชลยออกเดินจาก "ฟานเฉิง" ทั้งที่ฟานเฉิงถูกทิ้ง
   ให้ซูฮุยไปตั้งแต่ฤดูหนาว 219 (c1-09) และเป็นของวุ่ยตลอดกาลนับจากนั้น
   ทัพฮั่นออกจากเมืองข้าศึกไม่ได้ — เจ้าของทักว่า "ทำไมมันเริ่มที่ Fan Cheng"

   เป็น "warning" ไม่ใช่ error เพราะมีเคสที่ถูกต้อง: กองทัพที่กำลังล้อมเมืองอยู่ ย่อมยืน
   อยู่บนแผ่นดินข้าศึกจริง ๆ (กวนอูล้อมฟานเฉิงคือยืนบนดินของโจโฉ) ตัวตรวจจึงเงียบให้
   เมื่อฉากนั้นมีการปะทะอยู่ด้วย — ถ้าไม่มีการรบเลยแต่ทัพโผล่จากเมืองข้าศึก นั่นแหละที่ผิด */
/* ★★ 2026-08-27 — ข้อยกเว้น "ฉากนี้มี clash" เคยเป็นแบบ **รายฉาก** ซึ่งหลวมเกินไป
   เจ้าของจับได้จาก c7-11: ลูกศรสามพัน `weiyan_wuguan_234` ออกตัวกลางดินวุ่ยที่หลานเถียน
   ไปจบที่ด่านอู่ โดยไม่มีการรบที่ปลายทั้งสองข้าง — แต่มันรอดเพราะ "ฉากนี้มี clash"
   ซึ่งคือศึกสันด่านถงที่อยู่ห่างออกไป 100 หน่วย คนละเรื่องกันสิ้นเชิง
   ตอนนี้ข้อยกเว้นเป็น **รายลูกศร** สามทางเท่านั้น:
     ก) `retreat:true` — ถอยย่อมเริ่มจากที่ที่เพิ่งรบมา (เหมือนเดิม)
     ข) มี clash ในฉากอยู่ห่างจาก **ปลายลูกศรอันนี้** ไม่เกิน R — ทัพล้อมเมืองยืนบนดิน
        ข้าศึกได้ ก็ต่อเมื่อสิ่งที่มันล้อมคือสิ่งที่มันชี้ไปหา
     ค) จุดออกตัวของมันทับ **เส้นทางของลูกศรฝ่ายเดียวกันอีกอันในฉากเดียวกัน** ไม่เกิน R
        = กองแยกที่ผ่าออกจากขบวนซึ่งฉากนี้วาดไว้แล้ว (เคสของ c7-11 หลังแก้)
   R = 45 หน่วย · เท่ากับระยะที่ §7 บอกว่าวงปะทะสองวงเริ่มพันกันเป็นก้อนเดียว
   นอกจากสามข้อนี้ = error เหมือนเดิม */
const NEAR = 45;
const warn = [];
const routePoints = routeId => {
  const rt = TK.routes[routeId]; if (!rt) return null;
  const n = rt.d.match(/-?[\d.]+/g).map(Number);
  const pts = []; for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i+1]]);
  return pts.length ? pts : null;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearAny = (pt, pts) => pts.some(q => dist(pt, q) <= NEAR);

TK.timeline.forEach((b, n) => {
  const own = ownersAt(n);
  const clashPts = (b.markers || [])
    .filter(m => m.type === 'clash' && TK.places[m.place])
    .map(m => [TK.places[m.place].x, TK.places[m.place].y]);
  for (const m of (b.markers || [])){
    if (m.type !== 'arrow' || !m.route || !m.side) continue;
    const pts = routePoints(m.route); if (!pts) continue;
    const head = m.reverse ? pts[0] : pts[pts.length - 1];
    const tail = m.reverse ? pts[pts.length - 1] : pts[0];
    const rid = regionAt(tail[0], tail[1]); if (!rid) continue;
    const holder = own[rid];
    if (holder === m.side || holder === 'none') continue;
    const line = `arrow "${m.route}" sets out from inside "${REG[rid].label}", which is ` +
                 `${LBL(holder)}'s in this scene, but the arrow flies ${LBL(m.side)} ` +
                 `(SCHEMA rule 2 — an arrow leaves from where that side actually is)`;

    /* ข) การรบที่ปลายลูกศรอันนี้เอง */
    const besieging = clashPts.some(c => dist(c, head) <= NEAR);
    /* ค) ผ่าออกจากขบวนของฝ่ายเดียวกันที่ฉากนี้วาดไว้แล้ว */
    const parent = (b.markers || []).find(o => o !== m && o.type === 'arrow' &&
                     o.side === m.side && o.route && routePoints(o.route) &&
                     nearAny(tail, routePoints(o.route)));

    if (m.retreat)
      warn.push([b, line + ' · it is a retreat, which starts where the fighting was — check it']);
    else if (besieging)
      warn.push([b, line + ' · a clash sits at this arrow\'s own head, so a besieging force ' +
                       'standing on enemy ground may be correct — check it']);
    else if (parent)
      warn.push([b, line + ` · it splits off "${parent.route}", which this scene draws — ` +
                       'a detachment leaving a column already on the board is fine']);
    else bad.push([b, line]);
  }
});

/* ── 6. ★★ วงปะทะที่มีฝ่ายเดียวอยู่ในฉาก — เพิ่ม 2026-08-21 ────────────────────
   ที่มา: เจ้าของอ่านบทที่ 8 แล้วถามว่า *"เว่ยมีทหารสามแสน แต่ไม่ขัดขืนเลย ทหารเว่ยหายไปไหนหมด"*
   ไล่ตัวเลขแล้วพบว่าคำถามใหญ่กว่าบทที่ 8 มาก: **12 จาก 16 ฉากรบของทั้งเล่ม วาดกองทัพไว้ฝ่ายเดียว**
   คนอ่านเห็นลูกศรหนึ่งอัน วงปะทะหนึ่งวง แล้ว**ไม่เห็นสิ่งที่มันชนด้วยเลย** — ฝ่ายตั้งรับไม่เคยถูกวาด
   เทียบกับโปรเจกต์แรก (Three_Kingdoms_Project) ซึ่งวาดสองฝ่าย 11 จาก 19 ฉากรบ

   ⚠ **และกฎข้อนี้เขียนอยู่ใน SCHEMA มาตั้งแต่ต้น ไม่เคยมีตัวตรวจ**
   SCHEMA §รายการตรวจ ข้อ 4: *"ฉากที่มีปะทะ ต้องเห็นทั้งสองฝ่ายเดินเข้าหากัน
   ไม่ใช่เห็นฝ่ายเดียวแล้วมีวงปะทะลอย ๆ"* — ตระกูลเดียวกับกฎ "ห้ามเส้นตรง" ที่เงียบมาสองโปรเจกต์
   จนกระทั่ง check_routes ถูกเขียน

   **ฝ่ายตั้งรับไม่ต้องมีลูกศร** — คนที่ยืนอยู่บนกำแพงไม่ได้เดินไปไหน (§2.11 กลับด้าน)
   สิ่งที่นับคือ "ฝ่ายนั้นปรากฏบนแผนที่ในฉากนี้ไหม" ซึ่งหมุดที่มี `side` ก็นับ
   ตั้งแต่ 2026-08-21 หมุดรับ `strength` ได้แล้ว กองรักษาการณ์จึงมีน้ำหนักได้เหมือนกองที่เดิน */
const SOLO_OK = {
  /* ตัวอย่างรูปแบบ — ใส่ id พร้อมเหตุผลถ้ามีฉากที่ "ฝ่ายเดียว" ถูกต้องจริง ๆ */
};
TK.timeline.forEach(b => {
  const clashes = (b.markers || []).filter(m => m.type === 'clash');
  if (!clashes.length) return;
  const sides = new Set();
  for (const m of (b.markers || [])){
    if (!m.side || m.side === 'none') continue;
    if (m.type === 'arrow' || m.type === 'pin') sides.add(m.side);
  }
  if (sides.size >= 2) return;
  const line = `clash at ${clashes.map(c => (TK.places[c.place]||{}).label || c.place).join(', ')} ` +
               `but only ${sides.size ? LBL([...sides][0]) + ' is on the map' : 'nobody is on the map'} — ` +
               `SCHEMA checklist 4 wants both sides visible. The defender does not need an arrow; ` +
               `a pin with \`side\` (and now \`strength\`) is what a garrison looks like.`;
  if (SOLO_OK[b.id]) warn.push([b, line + ' — allowed: ' + SOLO_OK[b.id]]);
  else bad.push([b, line]);
});

console.log(`checked ${TK.timeline.length} scenes · ` +
            `using ${REG.yizhou.fill ? 'rendered shapes (geo_fill)' : 'hand-drawn shapes (geo)'}\n`);
for (const [b, why] of warn) console.log(`⚠ ${b.id} ${b.year} — ${b.title}\n   ${why}\n`);
for (const [b, why] of bad) console.log(`✖ ${b.id} ${b.year} — ${b.title}\n   ${why}\n`);
console.log(bad.length ? `${bad.length} conflict(s) found` : 'no conflicts between territory owners and what the scenes tell');
process.exit(bad.length ? 1 : 0);
