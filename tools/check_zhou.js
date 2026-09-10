/* check_zhou.js — ตรวจ "เส้นแบ่งมณฑล" ว่าเป็นผนังที่ปิดจริง และแบ่งเมืองถูกฝั่งจริง
 *
 *   node tools/check_zhou.js            เงียบ = ผ่าน · exit 1 = มีข้อผิดพลาด
 *   node tools/check_zhou.js --dump     พิมพ์ผลทุกจุดที่ตรวจ ไม่ใช่เฉพาะที่ผิด
 *
 * ═══ ทำไมต้องมี ═══
 * เส้นชุดนี้เป็น **แนวโดยประมาณ** ที่ลากด้วยมือ (ดูหัวไฟล์ `data/zhou_lines.js`)
 * สิ่งที่พิสูจน์ไม่ได้คือ "เส้นตรงกับแผนที่ประวัติศาสตร์ฉบับไหนไหม"
 * แต่สิ่งที่ **พิสูจน์ได้ด้วยเครื่อง** คือสามข้อ และไฟล์นี้ตรวจทั้งสามข้อทุกครั้ง:
 *
 *   1. **ผนังไม่รั่ว** — ท่วมสีจากเมืองเอกของแต่ละมณฑลแล้ว สองมณฑลต้องไม่ไหลมาชนกันเอง
 *      โดยไม่มีเส้นคั่น (ถ้ารั่ว = มีช่องว่างระหว่างเส้นสองเส้น ซึ่งบนจอจะเห็นเป็นเส้นขาด)
 *   2. **ไม่มีแผ่นดินที่ไม่มีเจ้าของ** — ช่องบกที่ท่วมไม่ถึง = ถูกล้อมด้วยเส้นจนไม่มีเมล็ด
 *   3. **เมืองตกถูกฝั่ง** — ตารางข้างล่างนี้คือสิ่งที่ `note` ของแต่ละเส้นอ้างไว้
 *      ถ้าวันหนึ่งมีคนขยับเส้น แล้วเมืองข้ามฝั่ง ตัวนี้จะฟ้องชื่อเมืองนั้นออกมา
 *
 * ⚠ ข้อ 3 ใช้ **พิกัดหมุดจริงใน `data/places.js`** ไม่ใช่พิกัดที่พิมพ์ไว้ในคอมเมนต์
 *   จะได้ไม่มีทางที่คอมเมนต์กับข้อมูลเดินคนละทาง
 */
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
global.window = global;
for (const f of ['names.js','places.js','geo.js','landmask.js','provinces.js','zhou_lines.js'])
  require(path.join(ROOT, 'data', f));

const P = TK.places, Z = TK.zhou, LM = TK.landmask;
const W = 1650, H = 1950, CELL = 3;
const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
const DUMP = process.argv.includes('--dump');

/* ── ที่คาดว่าเมืองไหนอยู่มณฑลไหน ─────────────────────────────────────────
   ★★ **ตารางนี้ไม่มีอยู่ในไฟล์นี้อีกแล้ว** — สังกัดอยู่ในช่อง `province` ของ
   `data/places.js` จุดเดียว (ย้ายมา 2026-09-10) · ก่อนหน้านี้มีสองที่: ตาราง
   94 ชื่อในไฟล์นี้ กับช่อง `province` ของ 24 จุดที่เพิ่งสอบเทียบ — สองที่แปลว่า
   คนเพิ่มหมุดใหม่ไม่รู้ว่าต้องไปเพิ่มที่ไหน และตัวตรวจก็โตไม่ทันข้อมูล
   ที่มาของสังกัด: บัญชีกุ๋นของฮั่นตะวันออก ปรับตามผังวุยปี 220–221 (ดู data/provinces.js)
   ⚠ จุดที่ตั้งอยู่ *บนแนวแบ่ง* จริง ๆ (เช่น ผูปั่นอยู่ริมลำน้ำเหลืองพอดี) อยู่ใน SOFT
     และ **ต้องไม่มีช่อง `province`** ในข้อมูล — ตัวตรวจข้อ 5 บังคับข้อนี้ */
const EXPECT = {};
for (const [id, p] of Object.entries(P)) if (p.province) (EXPECT[p.province] ||= []).push(id);
/* จุดที่ *ตั้งอยู่บนเส้น* โดยธรรมชาติ — ผิดไม่ได้แต่ก็ไม่ควรบังคับให้ตกฝั่งใดฝั่งหนึ่ง
   ผูปั่น/ผูโจว = ท่าข้ามลำน้ำเหลืองซึ่ง *คือ* เส้นแบ่งยง/ซือเอง
   ค่ายในเรื่อง (hanying · weizhai) **จงใจไม่ใส่สังกัด** — เราเป็นคนวางเองทั้งคู่
   เอามาตรวจเส้นก็เท่ากับเอาคำตอบมาตรวจตัวเอง (ดู zhou_evidence.js หัวข้อ "หลักฐานวน") */
const SOFT = new Set(['puban','puzhou','lueyang','xiegu','xiegupass','luogu','ziwugu','wuguan',
                      'yangxi','hanying','weizhai']);

/* ── ผนัง ─────────────────────────────────────────────────────────────── */
const wall = new Uint8Array(GW * GH);
const idx = (cx, cy) => cy * GW + cx;
function mark(x, y){
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) wall[idx(cx, cy)] = 1;
}
/* ★ เดินทีละ 1 หน่วยแผ่น = ละเอียดกว่าช่อง (3 หน่วย) เสมอ ผนังจึงต่อเนื่องแบบ 8-ทิศ
   ซึ่งกันการท่วมแบบ 4-ทิศได้สนิท (ท่วม 4 ทิศลอดมุมทแยงของผนัง 8 ทิศไม่ได้) */
for (const e of Z.edges){
  /* ★ `close` = จุดต่อปลายเส้นให้ชนขอบแผ่น — **ไม่ได้วาดบนจอ** มีไว้ให้ผนังปิดสนิท
     เท่านั้น (เส้นที่จบกลางทะเลทำให้สองมณฑลไหลอ้อมชายฝั่งมาเจอกัน) */
  const line = e.close ? e.pts.concat(e.close) : e.pts;
  for (let i = 1; i < line.length; i++){
    const [x0, y0] = line[i-1], [x1, y1] = line[i];
    const n = Math.max(2, Math.ceil(Math.hypot(x1-x0, y1-y0)));
    for (let k = 0; k <= n; k++) mark(x0 + (x1-x0)*k/n, y0 + (y1-y0)*k/n);
  }
}
/* ⛔ **ห้ามเอา `landmask` มาเป็นผนัง** — ลองแล้วรอบแรกและมันผิด: หน้ากากนั้นนับ
   *แม่น้ำกับทะเลสาบ* เป็นน้ำด้วย แยงซี/ต้งถิง/ลำน้ำเหลืองจึงกลายเป็นกำแพงผ่ามณฑล
   ที่คร่อมสองฝั่งน้ำออกเป็นสองซีก (จิงโจวโดนผ่าที่แยงซี · เหลียงโจวโดนผ่าที่ลำน้ำเหลือง)
   ตัวตรวจฟ้อง "แผ่นดินไม่มีเจ้าของ 42,488 ช่อง" ทั้งที่เส้นไม่ได้ผิดสักเส้น
   → ที่ถูกคือ **ให้เส้นแบ่งปิดสี่เหลี่ยมทั้งใบเอง** (ด้วย `close`) แล้วไม่ต้องใช้หน้ากากเลย */
const sea = new Uint8Array(GW * GH);

/* ── ท่วมสีจากเมล็ดของแต่ละมณฑล ────────────────────────────────────────── */
const keys = Object.keys(Z.list);
const lab = new Int8Array(GW * GH).fill(-1);
const queue = [];
keys.forEach((k, i) => {
  const [x, y] = Z.list[k].at;
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), p = idx(cx, cy);
  if (wall[p] || sea[p]){ console.error('⛔ เมล็ดของ ' + k + ' ตกบนผนัง/ทะเล ที่ ' + x + ',' + y); process.exit(1); }
  lab[p] = i; queue.push(p);
});
for (let h = 0; h < queue.length; h++){
  const p = queue[h], cx = p % GW, cy = (p - cx) / GW, me = lab[p];
  const step = (nx, ny) => {
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) return;
    const q = idx(nx, ny);
    if (lab[q] !== -1 || wall[q] || sea[q]) return;
    lab[q] = me; queue.push(q);
  };
  step(cx+1, cy); step(cx-1, cy); step(cx, cy+1); step(cx, cy-1);
}

/* ── 1 · รั่วไหม ───────────────────────────────────────────────────────── */
const leaks = [];
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW - 1; cx++){
  const a = lab[idx(cx, cy)], b = lab[idx(cx+1, cy)];
  if (a !== -1 && b !== -1 && a !== b) leaks.push([cx*CELL, cy*CELL, keys[a], keys[b]]);
}
for (let cy = 0; cy < GH - 1; cy++) for (let cx = 0; cx < GW; cx++){
  const a = lab[idx(cx, cy)], b = lab[idx(cx, cy+1)];
  if (a !== -1 && b !== -1 && a !== b) leaks.push([cx*CELL, cy*CELL, keys[a], keys[b]]);
}

/* ── 2 · แผ่นดินที่ไม่มีเจ้าของ ───────────────────────────────────────────
   นับเป็น **ก้อน** ไม่ใช่ช่อง — ก้อนจิ๋ว (< MIN_ORPHAN ช่อง) ที่โผล่ตรงจุดสามมณฑล
   เป็น *ผลของการแปลงเส้นเป็นตาราง* ไม่ใช่ช่องว่างจริงบนแผ่น: ตรงที่เส้นสามเส้นมาชนกัน
   ผนังกว้าง 1 ช่องสองอันวิ่งเฉียดกัน แล้วปิดเศษ 2–3 ช่องไว้ข้างใน
   → รายงานเป็นหมายเหตุ ไม่ใช่ข้อผิดพลาด · ก้อนใหญ่กว่านั้นคือของจริงและต้องแก้ */
const MIN_ORPHAN = 12;
const oc = new Int32Array(GW * GH).fill(-1);
const orphans = [];
for (let s0 = 0; s0 < GW * GH; s0++){
  if (oc[s0] >= 0 || wall[s0] || sea[s0] || lab[s0] !== -1) continue;
  const id = orphans.length, q = [s0]; oc[s0] = id; let n = 0;
  for (let h = 0; h < q.length; h++){
    const p = q[h], cx = p % GW, cy = (p - cx) / GW; n++;
    const st = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) return;
      const t = idx(nx, ny);
      if (oc[t] >= 0 || wall[t] || sea[t] || lab[t] !== -1) return;
      oc[t] = id; q.push(t);
    };
    st(cx+1, cy); st(cx-1, cy); st(cx, cy+1); st(cx, cy-1);
  }
  orphans.push({ n, at:[(s0 % GW)*CELL, Math.floor(s0 / GW)*CELL] });
}
const bigOrphans = orphans.filter(o => o.n >= MIN_ORPHAN).sort((a, b) => b.n - a.n);
const tinyOrphans = orphans.filter(o => o.n < MIN_ORPHAN);
const orphan = bigOrphans.reduce((s0, o) => s0 + o.n, 0);
const orphanAt = bigOrphans[0] ? bigOrphans[0].at : null;

/* ── 3 · เมืองตกถูกฝั่งไหม ─────────────────────────────────────────────── */
const at = (x, y) => {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  const p = idx(cx, cy);
  if (lab[p] !== -1) return keys[lab[p]];
  /* ตกบนผนังพอดี — มองรอบ ๆ ว่ามีมณฑลไหนบ้าง (ใช้บอกว่า "ติดเส้น") */
  const near = new Set();
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++){
    const q = idx(Math.max(0, Math.min(GW-1, cx+dx)), Math.max(0, Math.min(GH-1, cy+dy)));
    if (lab[q] !== -1) near.add(keys[lab[q]]);
  }
  return '~' + [...near].join('/');
};
const bad = [], onLine = [];
for (const zone in EXPECT) for (const id of EXPECT[zone]){
  const p = P[id];
  if (!p){ bad.push([id, zone, '(ไม่มีจุดนี้ใน places.js)']); continue; }
  const got = at(p.x, p.y);
  if (got === zone) { if (DUMP) console.log('  ok   ' + id.padEnd(12) + zone); continue; }
  if (got[0] === '~' && got.includes(zone)) onLine.push([id, zone, p.x + ',' + p.y]);
  else bad.push([id, zone, got + '  @' + p.x + ',' + p.y]);
}
/* จุด SOFT — รายงานเฉย ๆ ว่ามันตกที่ไหน ไม่ตัดสินถูกผิด */
if (DUMP) for (const id of SOFT) if (P[id]) console.log('  soft ' + id.padEnd(12) + at(P[id].x, P[id].y));

/* ── 4 · จุดวางชื่อของเขตทั้ง 33 (คำเตือน ไม่ใช่ error) ─────────────────── */
const regionWarn = [];
for (const rid in TK.regions){
  const want = Z.of[rid];
  if (!want) { regionWarn.push([rid, '(ไม่มีในตารางสังกัด)', '']); continue; }
  const la = TK.regions[rid].labelAt; if (!la) continue;
  const got = at(la[0], la[1]);
  if (got !== want) regionWarn.push([rid, want, got + '  @' + la.join(',')]);
}

/* ── 5 · ข้อมูลสังกัดเองถูกรูปแบบไหม ────────────────────────────────────
   ★ ตั้งแต่ย้ายตารางเข้า `places.js` ไฟล์ข้อมูลกลายเป็นแหล่งเดียว → ต้องมีตัวตรวจ
   ที่เฝ้า *ตัวข้อมูล* ไม่ใช่เฝ้าแค่ผลลัพธ์ ไม่งั้นพิมพ์ `province:"yng"` ผิดตัวเดียว
   จุดนั้นจะเงียบหายออกจากการตรวจโดยไม่มีใครรู้ */
const dataBad = [];
for (const [id, p] of Object.entries(P)){
  if (p.province && !Z.list[p.province]) dataBad.push(id + ' มี province:"' + p.province + '" ซึ่งไม่ใช่มณฑลใน provinces.js');
  if (p.province && SOFT.has(id))        dataBad.push(id + ' อยู่ใน SOFT (ตั้งอยู่บนเส้น) จึงต้องไม่มีช่อง province');
}

/* ── รายงาน ───────────────────────────────────────────────────────────── */
let fail = 0;
if (dataBad.length){
  fail++;
  console.log('⛔ ช่อง province ในข้อมูลผิดรูป ' + dataBad.length + ' จุด');
  for (const s of dataBad) console.log('   ' + s);
}
if (leaks.length){
  fail++;
  /* จับกลุ่มตามคู่มณฑล จะได้อ่านออกว่ารั่วระหว่างใครกับใคร ไม่ใช่พิมพ์หมื่นบรรทัด */
  const byPair = new Map();
  for (const [x, y, a, b] of leaks){
    const k = [a, b].sort().join('|');
    if (!byPair.has(k)) byPair.set(k, { n:0, at:[x, y] });
    byPair.get(k).n++;
  }
  console.log('⛔ ผนังรั่ว ' + byPair.size + ' คู่ (' + leaks.length + ' ช่อง) — มีช่องว่างระหว่างเส้น');
  for (const [k, v] of byPair) console.log('   ' + k.padEnd(14) + v.n + ' ช่อง · เริ่มเห็นที่ ' + v.at.join(','));
}
if (orphan){
  fail++;
  console.log('⛔ แผ่นดินไม่มีเจ้าของ ' + bigOrphans.length + ' ก้อน รวม ' + orphan + ' ช่อง (~' +
              (orphan*CELL*CELL/1000).toFixed(0) + 'k หน่วย²) · ก้อนใหญ่สุดที่ ' + orphanAt.join(','));
}
if (tinyOrphans.length)
  console.log('· เศษจิ๋วตรงจุดสามมณฑล ' + tinyOrphans.length + ' ก้อน (รวม ' +
              tinyOrphans.reduce((s0, o) => s0 + o.n, 0) + ' ช่อง) — ผลของการแปลงเส้นเป็นตาราง ไม่ใช่รอยรั่ว');
if (bad.length){
  fail++;
  console.log('⛔ เมืองตกผิดฝั่ง ' + bad.length + ' จุด');
  for (const [id, want, got] of bad) console.log('   ' + id.padEnd(12) + 'ควรเป็น ' + want.padEnd(6) + 'แต่ได้ ' + got);
}
if (onLine.length)
  console.log('⚠ ติดเส้นพอดี ' + onLine.length + ' จุด (ไม่นับเป็นข้อผิดพลาด): ' +
              onLine.map(o => o[0]).join(' '));
if (regionWarn.length)
  console.log('⚠ จุดวางชื่อเขตที่ตกคนละมณฑลกับตารางสังกัด ' + regionWarn.length + ' เขต ' +
              '(เป็นจุดวาง *ตัวหนังสือ* ไม่ใช่ใจกลางเขต — เตือนไว้เฉย ๆ)\n   ' +
              regionWarn.map(r => r[0] + ':' + r[1] + '→' + r[2].split('  ')[0]).join(' · '));

if (!fail) console.log('✅ เส้นแบ่งมณฑล: ผนังปิดสนิท · แผ่นดินมีเจ้าของครบ · เมือง ' +
                       Object.values(EXPECT).reduce((s, a) => s + a.length, 0) + ' จุดตกถูกฝั่งทุกจุด');
process.exit(fail ? 1 : 0);
