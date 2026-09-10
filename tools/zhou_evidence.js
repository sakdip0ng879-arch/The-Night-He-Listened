/* zhou_evidence.js — **แจกแจงหลักฐานของเส้นแบ่งมณฑลทีละเส้น**
 *
 *   node tools/zhou_evidence.js            ตารางสรุป + คิวงานที่ยังไม่มีอะไรยึด
 *   node tools/zhou_evidence.js --detail   รายละเอียดรายเส้น (เมืองที่ค้ำ · ความเสี่ยง)
 *   node tools/zhou_evidence.js --md       พิมพ์เป็นตาราง markdown สำหรับแปะลง docs/
 *   เงียบพอ = ผ่าน · exit 1 = คำอธิบายเดินคนละทางกับข้อมูล
 *
 * ═══ ★★★ ทำไมต้องมีไฟล์นี้ · ปัญหาที่มันแก้ ═══
 *
 * `check_zhou.js` ตรวจได้ว่า **เมือง 120 จุดตกถูกฝั่ง** ซึ่งเป็น *การตรวจความสอดคล้อง*
 * ไม่ใช่ *การพิสูจน์ความแม่นตามประวัติศาสตร์* — และในเซสชันก่อนหน้าผมเองเขียนสรุปสั้น
 * ใน LOG จน **อ่านได้ว่าเป็นการรับรองความแม่น** ทั้งที่หัวไฟล์ `zhou_lines.js` เขียนไว้เองว่า
 * เส้นชุดนี้เป็น *แนวโดยประมาณ* (LOG §5.20 ข้อ 3 · §5.22 ข้อ ①)
 *
 * ★★★ **บทเรียนที่ไฟล์นี้ทำให้ทำผิดซ้ำไม่ได้: สรุปสั้นต้องไม่แข็งกว่าตัวข้อมูล**
 * วิธีบังคับคือ **ไม่เขียนสรุปเป็นร้อยแก้วอีก** แต่ให้เครื่องพิมพ์ตัวเลขออกมาเอง
 * แล้วใครก็เถียงกับตัวเลขได้โดยไม่ต้องเชื่อใคร
 *
 * ═══ สามคอลัมน์ที่ตอบว่า "เส้นนี้มีอะไรค้ำอยู่" ═══
 *
 * ① **น้ำ** — ท่อนที่ **ลอกพิกัดจากหมึกของแผ่นเอง** (`assets/map-art/water.json`)
 *    เกณฑ์: จุดบนเส้นห่างสายน้ำ ≤ 1 หน่วย · ★ ตัวเลขจริงเป็น **สองก้อนแยกขาด** —
 *    ไม่ 0.0 ก็เกิน 20 · เกณฑ์ 1 หน่วยจึงไม่ใช่เส้นแบ่งที่เลือกเอาเอง แต่เป็นร่องว่างในข้อมูล
 *    (วัดแล้ว: ที่ ≤1 กับที่ ≤8 ให้ผลต่างกัน **0–1 จุดจาก 476 จุด** ทั้งชุด)
 *    ⇒ ท่อนนี้ **ไม่ได้วาดด้วยมือ** ใครขยับต้องขยับแม่น้ำของแผ่นตาม
 *
 * ② **เมืองค้ำ** — ท่อนที่มีเมืองซึ่ง `places.js` ระบุสังกัดไว้ **อยู่ครบทั้งสองฝั่ง**
 *    ในระยะ 150 หน่วย ⇒ ขยับเส้นแรง ๆ แล้ว `check_zhou` จะฟ้องทันที
 *    ⚠ "ค้ำ" ไม่เท่ากับ "ถูก" — มันแปลว่า *เส้นถูกล็อกไว้ด้วยอย่างอื่นในโปรเจกต์*
 *
 * ③ **ไม่มีอะไรยึด** — ที่เหลือ · ★★ ท่อนนี้ขยับได้ทั้งท่อนโดยไม่มีตัวตรวจตัวไหนร้อง
 *    **นี่คือตัวเลขที่ต้องอ่านก่อนเพื่อน** และคือคิวงานของข้อ ② ใน LOG §5.22
 *
 * ⚠⚠ **"หลักฐานวน" — กับดักที่ไฟล์นี้ตั้งใจกันไว้**
 *   ค่ายในเรื่อง (`hanying` ค่ายหน้าเฉินชาง · `weizhai` ค่ายรั้ววุ่ย) **เราเป็นคนวางเอง**
 *   เอามานับเป็นเมืองค้ำก็เท่ากับเอาคำตอบมาตรวจตัวเอง → ทั้งคู่ไม่มีช่อง `province`
 *   และอยู่ใน SOFT ของ `check_zhou.js` · เช่นเดียวกับด่าน/ปากหุบที่ *ตั้งอยู่บนเส้น* เอง
 *
 * ⛔ สิ่งที่ไฟล์นี้ **ยังพิสูจน์ไม่ได้** และจะไม่อ้างว่าได้:
 *   เส้นตรงกับแผนที่ประวัติศาสตร์ฉบับไหนไหม · แผ่นต้นแบบเป็นผังราวปี 262 และพิมพ์ชื่อ
 *   หลายยุคปนกัน (ดู `TK.zhou.risks['plate-era']`) — มันให้ *ตำแหน่ง* ไม่ได้ให้ *ปี*
 */
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
global.window = global;
for (const f of ['names.js','places.js','geo.js','landmask.js','provinces.js','zhou_lines.js'])
  require(path.join(ROOT, 'data', f));

const P = TK.places, Z = TK.zhou;
const W = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-art/water.json'), 'utf8'));
const DETAIL = process.argv.includes('--detail');
const MD     = process.argv.includes('--md');

/* เกณฑ์ — เปลี่ยนได้ แต่เปลี่ยนแล้วต้องเปลี่ยนคำอธิบายหัวไฟล์ด้วย */
const TOL   = 1;    /* ห่างสายน้ำเท่านี้ = ถือว่าลอกมาตรง ๆ */
const STEP  = 2;    /* ระยะสุ่มเดินตามเส้น */
const R     = 150;  /* เมืองไกลกว่านี้ ไม่ถือว่าค้ำเส้น */
const MIN_TRACE = 20; /* ลอกสั้นกว่านี้ = เส้น *ข้าม* แม่น้ำ ไม่ใช่ *เดินตาม* แม่น้ำ */

/* ── สายน้ำทั้งแผ่น ─────────────────────────────────────────────────────── */
const polys = [], waterIds = new Set();
for (const g of ['rivers','lakes','coasts'])
  for (const r of W[g]) if (r.points && r.points.length > 1){
    polys.push({ id:r.id, pts:r.points }); waterIds.add(r.id);
  }
const label = {};
for (const r of W.rivers) label[r.id] = r.label || r.id;

const d2seg = (px, py, x0, y0, x1, y1) => {
  const dx = x1-x0, dy = y1-y0, L = dx*dx + dy*dy;
  let t = L ? ((px-x0)*dx + (py-y0)*dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t*dx), py - (y0 + t*dy));
};
const nearWater = (px, py) => {
  let best = 1e9, id = null;
  for (const p of polys){ const a = p.pts;
    for (let i = 1; i < a.length; i++){
      const d = d2seg(px, py, a[i-1][0], a[i-1][1], a[i][0], a[i][1]);
      if (d < best){ best = d; id = p.id; }
    } }
  return [best, id];
};

/* ── เมืองที่ระบุสังกัดไว้ ─────────────────────────────────────────────────
   ★ แหล่งเดียว: ช่อง `province` ใน places.js (ย้ายมาจากตารางใน check_zhou.js 2026-09-10) */
const byZ = {};
for (const id in P) if (P[id].province) (byZ[P[id].province] ||= []).push(id);

/* ── วัดทีละเส้น ─────────────────────────────────────────────────────────── */
const rows = [];
for (const e of Z.edges){
  const A = byZ[e.a] || [], B = byZ[e.b] || [];
  const byRiver = {};
  let len = 0, wLen = 0, cLen = 0, nLen = 0;
  const gaps = [];            /* ท่อนที่ไม่มีอะไรยึด — เก็บเป็นช่วงต่อเนื่อง */
  let run = null;

  for (let i = 1; i < e.pts.length; i++){
    const [x0, y0] = e.pts[i-1], [x1, y1] = e.pts[i];
    const L = Math.hypot(x1-x0, y1-y0); len += L;
    const n = Math.max(1, Math.ceil(L / STEP));
    for (let k = 0; k < n; k++){
      const t = (k + 0.5) / n, mx = x0 + (x1-x0)*t, my = y0 + (y1-y0)*t, seg = L / n;
      const [wd, wid] = nearWater(mx, my);
      const onW = wd <= TOL;
      const dA = Math.min(...A.map(id => Math.hypot(P[id].x - mx, P[id].y - my)), 1e9);
      const dB = Math.min(...B.map(id => Math.hypot(P[id].x - mx, P[id].y - my)), 1e9);
      const braced = Math.max(dA, dB) <= R;

      if (onW){ wLen += seg; byRiver[wid] = (byRiver[wid] || 0) + seg; }
      else if (braced) cLen += seg;
      else nLen += seg;

      if (!onW && !braced){
        if (run) { run.to = [mx, my]; run.len += seg; }
        else run = { from:[mx, my], to:[mx, my], len:seg };
      } else if (run){ gaps.push(run); run = null; }
    }
  }
  if (run) gaps.push(run);

  /* เมืองที่อยู่ใกล้เส้นที่สุดของแต่ละฝั่ง — ตัวที่ "ค้ำ" จริง ๆ */
  const nearestOf = (ids) => ids.map(id => {
      let best = 1e9;
      for (let i = 1; i < e.pts.length; i++)
        best = Math.min(best, d2seg(P[id].x, P[id].y, e.pts[i-1][0], e.pts[i-1][1], e.pts[i][0], e.pts[i][1]));
      return { id, d:best };
    }).sort((u, v) => u.d - v.d);

  rows.push({ e, len, wLen, cLen, nLen, byRiver,
              gaps: gaps.filter(g => g.len >= 20).sort((u, v) => v.len - u.len),
              nearA: nearestOf(A).slice(0, 3), nearB: nearestOf(B).slice(0, 3) });
}

/* ── ตรวจว่าคำอธิบายกับข้อมูลเดินทางเดียวกัน ─────────────────────────────── */
const errs = [];
for (const r of rows){
  const { e } = r, name = e.a + '|' + e.b;
  if (!e.basis)                errs.push(name + ' ไม่มีช่อง basis — ต้องบอกว่าเส้นยืนอยู่บนผังปีไหน');
  else if (!Z.basis[e.basis])  errs.push(name + ' basis:"' + e.basis + '" ไม่มีในตาราง TK.zhou.basis');
  for (const k of e.risk || [])
    if (!Z.risks[k])           errs.push(name + ' risk:"' + k + '" ไม่มีในตาราง TK.zhou.risks');

  /* อ้างว่าลอก → ต้องลอกจริง */
  for (const t of e.traces || []){
    if (!waterIds.has(t))            errs.push(name + ' traces:"' + t + '" ไม่มีสายน้ำชื่อนี้ใน water.json');
    else if ((r.byRiver[t] || 0) < MIN_TRACE)
      errs.push(name + ' อ้างว่าลอก `' + t + '` แต่วัดได้แค่ ' + (r.byRiver[t] || 0).toFixed(0) +
                ' หน่วย (ต้อง ≥ ' + MIN_TRACE + ') — คำอธิบายแข็งกว่าข้อมูล');
  }
  /* ลอกจริง → ต้องอ้าง */
  for (const [id, L] of Object.entries(r.byRiver))
    if (L >= MIN_TRACE && !(e.traces || []).includes(id))
      errs.push(name + ' เดินตาม `' + id + '` อยู่ ' + L.toFixed(0) +
                ' หน่วย แต่ไม่ได้ประกาศไว้ในช่อง traces — หลักฐานที่มีอยู่แต่ไม่ได้อ้าง');
}
for (const k of Z.riskAll || []) if (!Z.risks[k]) errs.push('riskAll:"' + k + '" ไม่มีในตาราง TK.zhou.risks');

/* ── พิมพ์ ───────────────────────────────────────────────────────────────── */
const pc  = (a, b) => (100 * a / b).toFixed(0).padStart(3) + '%';
const tot = rows.reduce((s, r) => ({ len:s.len + r.len, w:s.w + r.wLen, c:s.c + r.cLen, n:s.n + r.nLen }),
                        { len:0, w:0, c:0, n:0 });

if (MD){
  console.log('| เส้น | ผัง | ยาว | น้ำ | เมืองค้ำ | ไม่มีอะไรยึด | ความเสี่ยง |');
  console.log('|---|---|---:|---:|---:|---:|---|');
  for (const r of rows) console.log('| `' + r.e.a + '|' + r.e.b + '`' + (r.e.coarse ? ' ⌁' : '') +
    ' | ' + r.e.basis + ' | ' + Math.round(r.len) + ' | ' + pc(r.wLen, r.len).trim() +
    ' | ' + pc(r.cLen, r.len).trim() + ' | ' + pc(r.nLen, r.len).trim() +
    ' | ' + ((r.e.risk || []).join(' · ') || '—') + ' |');
  console.log('| **รวม** | | **' + Math.round(tot.len) + '** | **' + pc(tot.w, tot.len).trim() +
              '** | **' + pc(tot.c, tot.len).trim() + '** | **' + pc(tot.n, tot.len).trim() + '** | |');
} else {
  console.log('เส้นแบ่งมณฑล ' + rows.length + ' เส้น — อะไรค้ำเส้นไหนอยู่');
  console.log('  น้ำ = ลอกหมึกของแผ่นตรง ๆ (≤' + TOL + ' หน่วย) · ค้ำ = มีเมืองระบุสังกัดครบสองฝั่งใน ' +
              R + ' หน่วย · ⌁ = ติดธง coarse');
  console.log('');
  console.log('  เส้น          ผัง      ยาว   น้ำ  ค้ำ  ไม่มี   สายน้ำที่เดินตาม');
  console.log('  ' + '─'.repeat(84));
  for (const r of rows){
    const rivers = Object.entries(r.byRiver).filter(([, L]) => L >= MIN_TRACE)
      .sort((a, b) => b[1] - a[1]).map(([id, L]) => id + ' ' + Math.round(L)).join(', ');
    console.log('  ' + (r.e.a + '|' + r.e.b + (r.e.coarse ? ' ⌁' : '')).padEnd(15) +
      r.e.basis.padEnd(8) + String(Math.round(r.len)).padStart(5) + ' ' +
      pc(r.wLen, r.len) + ' ' + pc(r.cLen, r.len) + ' ' + pc(r.nLen, r.len) +
      (r.nLen / r.len > 0.6 ? ' ⚠ ' : '   ') + rivers);
  }
  console.log('  ' + '─'.repeat(84));
  console.log('  ' + 'รวม'.padEnd(23) + String(Math.round(tot.len)).padStart(5) + ' ' +
    pc(tot.w, tot.len) + ' ' + pc(tot.c, tot.len) + ' ' + pc(tot.n, tot.len));
  console.log('');
  console.log('★ อ่านบรรทัดรวมอย่างเดียวก็พอ: ความยาวพรมแดนทั้งชุด ' + Math.round(tot.len) + ' หน่วย · ' +
              'ลอกจากหมึกของแผ่นจริง ' + pc(tot.w, tot.len).trim() + ' · ' +
              'ที่เหลือเป็นเส้นที่เราลากเอง');
  console.log('  โดยมี ' + pc(tot.n, tot.len).trim() + ' (' + Math.round(tot.n) + ' หน่วย) ที่ ' +
              '**ไม่มีทั้งน้ำและเมืองค้ำ** — ขยับได้โดยไม่มีตัวตรวจตัวไหนร้อง');

  /* คิวงาน — ท่อนยาวที่สุดที่ไม่มีอะไรยึด */
  const q = [];
  for (const r of rows) for (const g of r.gaps) q.push({ n:r.e.a + '|' + r.e.b, g, coarse:!!r.e.coarse });
  q.sort((a, b) => b.g.len - a.g.len);
  console.log('');
  console.log('⚠ ท่อนที่ไม่มีอะไรยึด เรียงตามความยาว (10 อันดับแรกจาก ' + q.length + ' ท่อน)');
  console.log('  ★ นี่คือคิวของ LOG §5.22 ข้อ ② — เติมสังกัดให้เมืองแถบนี้ = ท่อนนั้นหายจากรายการ');
  for (const it of q.slice(0, 10))
    console.log('   ' + (it.n + (it.coarse ? ' ⌁' : '')).padEnd(15) + String(Math.round(it.g.len)).padStart(4) +
      ' หน่วย  (' + it.g.from.map(Math.round).join(',') + ') → (' + it.g.to.map(Math.round).join(',') + ')');

  /* มณฑลที่มีเมืองระบุสังกัดน้อย = สาเหตุต้นทางของท่อนที่ไม่มีอะไรยึด */
  const thin = Object.keys(Z.list).map(k => [k, (byZ[k] || []).length]).sort((a, b) => a[1] - b[1]);
  console.log('');
  console.log('· เมืองที่ระบุสังกัดแล้ว รายมณฑล (' + Object.values(byZ).reduce((s, a) => s + a.length, 0) +
              ' จุด จาก ' + Object.keys(P).length + ')');
  console.log('   ' + thin.map(([k, n]) => k + ':' + n).join('  '));

  if (DETAIL){
    /* ★ คำอธิบายของ basis กับความเสี่ยงที่ทุกเส้นแบกร่วมกัน พิมพ์ **ครั้งเดียว**
       ไม่ใช่ซ้ำ 29 รอบ — ย่อหน้าที่ซ้ำทุกบรรทัดคือย่อหน้าที่ไม่มีใครอ่าน */
    const wrap = s => s.replace(/\s+/g, ' ').replace(/(.{1,84})(\s|$)/g, '$1\n     ').trimEnd();
    console.log('\n' + '═'.repeat(86));
    console.log('ผังปกครองที่เส้นยืนอยู่บน');
    for (const k in Z.basis) console.log('  ' + k.padEnd(8) + ' ' + wrap(Z.basis[k]));
    console.log('\nความเสี่ยงที่ **ทุกเส้น** แบกร่วมกัน');
    for (const k of Z.riskAll || []) console.log('  ⚠ ' + k.padEnd(12) + ' ' + wrap(Z.risks[k].why));

    for (const r of rows){
      const e = r.e;
      console.log('\n' + '═'.repeat(86));
      console.log(e.a + '|' + e.b + '   ' + (Z.list[e.a].label) + ' ↔ ' + (Z.list[e.b].label) +
                  '   [' + e.basis + ']' + (e.coarse ? '   ⌁ coarse' : ''));
      console.log('  ยาว ' + Math.round(r.len) + ' หน่วย · น้ำ ' + Math.round(r.wLen) +
                  ' · เมืองค้ำ ' + Math.round(r.cLen) + ' · ไม่มีอะไรยึด ' + Math.round(r.nLen));
      const rv = Object.entries(r.byRiver).filter(([, L]) => L >= MIN_TRACE).sort((a, b) => b[1] - a[1]);
      if (rv.length) console.log('  เดินตามสายน้ำ: ' + rv.map(([id, L]) =>
        '`' + id + '`' + (label[id] && label[id] !== id ? ' (' + label[id] + ')' : '') + ' ' + Math.round(L)).join(' · '));
      const side = (k, near) => '  ค้ำฝั่ง ' + k.padEnd(6) + ': ' +
        (near.map(u => u.id + ' ' + Math.round(u.d)).join(', ') || '(ไม่มีเมืองที่ระบุสังกัดเลย)');
      console.log(side(e.a, r.nearA));
      console.log(side(e.b, r.nearB));
      for (const k of e.risk || []) console.log('  ⚠ ' + k.padEnd(12) + ' ' + wrap(Z.risks[k].why));
      for (const g of r.gaps.slice(0, 3))
        console.log('  · ท่อนที่ไม่มีอะไรยึด ' + Math.round(g.len) + ' หน่วย (' +
                    g.from.map(Math.round).join(',') + ') → (' + g.to.map(Math.round).join(',') + ')');
    }
  } else {
    console.log('\n(ดูรายเส้นพร้อมความเสี่ยงและเมืองที่ค้ำ: node tools/zhou_evidence.js --detail)');
  }
}

if (errs.length){
  console.log('\n⛔ คำอธิบายเดินคนละทางกับข้อมูล ' + errs.length + ' ข้อ');
  for (const s of errs) console.log('   ' + s);
  process.exit(1);
}
process.exit(0);
