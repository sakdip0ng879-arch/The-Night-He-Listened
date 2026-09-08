/* check_routes.js — ตรวจกราฟถนนและการเดินทัพ (DECISIONS §4)
 *
 *   node tools\check_routes.js
 *
 * ★ เขียนใหม่ทั้งไฟล์สำหรับโปรเจกต์ 3 · ของเดิมอยู่ที่ check_routes_OLD_reference.js
 *
 * สิ่งที่ตัวตรวจตัวเดิมทำแล้วตัวนี้ไม่ต้องทำอีก เพราะโครงสร้างข้อมูลกันไว้ให้แล้ว:
 *   · "ความคด ≥ 3%"        → ยกเลิก · รูปเส้นมาจาก edge ที่ลากตามภูมิประเทศจริง
 *   · flips / maxTurn      → ยกเลิก · เหตุผลเดียวกัน
 *   · ตาราง STRAIGHT_OK    → ยกเลิก · เป็นการยกเว้นด้วยมือ = กฎผิดตั้งแต่ต้น
 *   · ตาราง SHAPE_OK       → ยกเลิก
 *   · ★ ตาราง ENDS         → ยกเลิก · หัวท้ายของเส้นคือ "ชื่อ node" อยู่แล้ว
 *                             ไม่มีอะไรให้กรอกด้วยมือ จึงไม่มีอะไรให้กรอกผิด
 *
 * ตรวจข้อ 1–15 (ข้อ 5 มีสองด้าน) ทั้งหมดอ่านจากของจริง ไม่ได้จำลองการเรนเดอร์ (DECISIONS §13)
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
/* ⚠ ลำดับสำคัญ — roads.js ดึงพิกัดจาก places.js ตอนโหลด (DECISIONS กฎ 4)
   ถ้าโหลดสลับกัน มันจะ throw ทันทีพร้อมรายชื่อ node ที่หาไม่เจอ ซึ่งถูกแล้ว
   index.html ก็เรียงลำดับเดียวกันนี้ */
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'roads.js'));
require(path.join(ROOT, 'data', 'works.js'));   /* ข้อ 14 — โซ่ป้อม/แนวรั้ว */
require(path.join(ROOT, 'data', 'landmask.js'));

const TK = window.TK;
const N = TK.nodes, E = TK.edges, MR = TK.marches, META = TK.routeMeta, IDX = TK.edgeIndex;
const M = TK.landmask, C = M.cell, W = M.w, H = M.h, rows = M.rows;

let errs = 0, warns = 0, notes = 0;
const bad  = m => { console.log('  ✖ ' + m); errs++; };
const warn = m => { console.log('  ⚠ ' + m); warns++; };
const note = m => { console.log('  · ' + m); notes++; };
const ok   = m => console.log('  ✔ ' + m);
const head = t => console.log('\n' + t);

const key = (a,b) => a + ' ' + b;

/* ── landmask ────────────────────────────────────────────────────────────
   ตาราง 330×390 · 1 ช่อง = 5 หน่วยบนแผนที่ · '1' = บก '0' = น้ำ

   ⚠⚠ **แม่น้ำถูกทำเครื่องหมายเป็นน้ำด้วย และเมืองโบราณตั้งอยู่ริมแม่น้ำแทบทุกเมือง**
   วัดจริงแล้ว: Langzhong · Jieting · Xiegu · Jicheng · Wu Gong ตกลงบนช่อง "น้ำ" ทั้งหมด
   ทั้งที่พิกัดถูกต้องและสอบเทียบมาแล้วสองโปรเจกต์ — แม้แต่ Chang'an ก็ยังมีช่องน้ำ
   อยู่ข้าง ๆ 2 ช่องจาก 49

   ดังนั้น "อยู่บนช่องน้ำ" ไม่ใช่ความผิด สิ่งที่เป็นความผิดคือ **อยู่กลางผืนน้ำ**
   กับ **เส้นทางที่ลุยข้ามผืนน้ำ** ซึ่งวัดจากความยาวของช่วงที่เปียกติดต่อกัน
   ไม่ใช่จากการมีช่องเปียกอยู่บ้าง (ดู BUGS_SEEN §A5)                            */
const wet = (x,y) => {
  const c = Math.floor(x / C), r = Math.floor(y / C);
  if (r < 0 || r >= H || c < 0 || c >= W) return false;   /* นอกกรอบ = ให้ข้อ 4 จับแทน */
  return rows[r].charCodeAt(c) !== 49;
};

/* กลางผืนน้ำจริง = ตัวเองเปียก และรอบตัวรัศมี 15 หน่วยเปียกเกือบหมด
   ท่าข้ามกับเมืองริมน้ำจะไม่เข้าเงื่อนไขนี้ เพราะอีกฝั่งเป็นบก */
function inOpenWater(x,y){
  if (!wet(x,y)) return false;
  let n = 0, t = 0;
  for (let a = 0; a < 8; a++){
    const th = a * Math.PI / 4;
    t++; if (wet(x + Math.cos(th)*15, y + Math.sin(th)*15)) n++;
  }
  return n / t >= 0.875;      /* ยอมให้แห้งได้หนึ่งทิศจากแปด */
}

/* ── สุ่มจุดตามเส้น (M · L · C · Q แบบสัมบูรณ์) โดยไม่ง้อ DOM ── */
function samplePath(d, step){
  const t = d.match(/[MLCQ]|[-+]?[0-9]*\.?[0-9]+/gi); if (!t) return [];
  const out = []; let i = 0, cur = null, cmd = null;
  const lerp = (a,b,u) => a + (b-a)*u;
  const push = p => { if (!out.length || Math.hypot(p[0]-out[out.length-1][0], p[1]-out[out.length-1][1]) > 0.01) out.push(p); };
  while (i < t.length){
    if (/[MLCQ]/i.test(t[i])) { cmd = t[i].toUpperCase(); i++; continue; }
    if (cmd === 'M'){ cur = [ +t[i], +t[i+1] ]; i += 2; push(cur); continue; }
    if (cmd === 'L'){ const q = [ +t[i], +t[i+1] ]; i += 2;
      const n = Math.max(2, Math.ceil(Math.hypot(q[0]-cur[0], q[1]-cur[1]) / step));
      for (let k = 1; k <= n; k++) push([lerp(cur[0],q[0],k/n), lerp(cur[1],q[1],k/n)]);
      cur = q; continue; }
    if (cmd === 'Q'){ const c1=[+t[i],+t[i+1]], q=[+t[i+2],+t[i+3]]; i += 4;
      const n = Math.max(8, Math.ceil((Math.hypot(c1[0]-cur[0],c1[1]-cur[1]) + Math.hypot(q[0]-c1[0],q[1]-c1[1])) / step));
      for (let k = 1; k <= n; k++){ const u = k/n, v = 1-u;
        push([ v*v*cur[0] + 2*v*u*c1[0] + u*u*q[0], v*v*cur[1] + 2*v*u*c1[1] + u*u*q[1] ]); }
      cur = q; continue; }
    if (cmd === 'C'){ const c1=[+t[i],+t[i+1]], c2=[+t[i+2],+t[i+3]], q=[+t[i+4],+t[i+5]]; i += 6;
      const n = Math.max(10, Math.ceil((Math.hypot(c1[0]-cur[0],c1[1]-cur[1]) + Math.hypot(c2[0]-c1[0],c2[1]-c1[1]) + Math.hypot(q[0]-c2[0],q[1]-c2[1])) / step));
      for (let k = 1; k <= n; k++){ const u = k/n, v = 1-u;
        push([ v*v*v*cur[0] + 3*v*v*u*c1[0] + 3*v*u*u*c2[0] + u*u*u*q[0],
               v*v*v*cur[1] + 3*v*v*u*c1[1] + 3*v*u*u*c2[1] + u*u*u*q[1] ]); }
      cur = q; continue; }
    i++;
  }
  return out;
}

/* ช่วงที่เปียกติดต่อกันยาวที่สุด เป็นหน่วยแผนที่ */
function longestWetRun(pts){
  let best = 0, run = 0;
  for (let k = 0; k < pts.length; k++){
    if (wet(pts[k][0], pts[k][1])){
      run += k ? Math.hypot(pts[k][0]-pts[k-1][0], pts[k][1]-pts[k-1][1]) : 0;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

/* ── ดึงพิกัดหัว-ท้ายออกจาก path string โดยไม่ง้อ DOM ─────────────────────
   ใช้แทน getTotalLength()/getPointAtLength() ซึ่งเป็นของเบราว์เซอร์
   พอเป็นการอ่านตัวเลขจาก d ตรง ๆ มันเลยตรวจได้ลึกกว่าเดิมด้วยซ้ำ:
   ยืนยันว่า "เส้นที่ลากไว้" ตรงกับ "จุดที่ประกาศไว้ในกราฟ" จริงหรือเปล่า */
function ends(d){
  const t = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!t || t.length < 4) return null;
  const n = t.map(Number);
  return { x0:n[0], y0:n[1], x1:n[n.length-2], y1:n[n.length-1] };
}
function allPts(d){
  const t = (d.match(/[-+]?[0-9]*\.?[0-9]+/g) || []).map(Number);
  const p = []; for (let i = 0; i + 1 < t.length; i += 2) p.push([t[i], t[i+1]]);
  return p;
}
const near = (ax,ay,bx,by,tol) => Math.hypot(ax-bx, ay-by) <= (tol || 2);

console.log('กราฟถนน: node ' + Object.keys(N).length +
            ' · edge ' + E.length + ' · การเดินทัพ ' + Object.keys(MR).length);

/* ═══ 1 · edge ชี้ไป node ที่มีจริง ═══ */
head('1 · edge ชี้ไป node ที่มีจริง');
E.forEach((e,i) => {
  if (!N[e.a]) bad('edge[' + i + '] ไม่รู้จัก node "' + e.a + '"');
  if (!N[e.b]) bad('edge[' + i + '] ไม่รู้จัก node "' + e.b + '"');
  if (e.a === e.b) bad('edge[' + i + '] ต้นทางเท่ากับปลายทาง: ' + e.a);
});
if (!errs) ok('ผ่านทั้ง ' + E.length + ' เส้น');

/* ═══ 2 · edge ซ้ำคู่เดิม — อนุญาตได้ แต่ต้องเป็นถนนคนละแบบจริง ═══
   เรื่องนี้มีของจริงอยู่หนึ่งคู่: Tianshui→Chencang มีทั้งถนนสันเขาผ่าน Jie Ting
   และหุบเขาแม่น้ำ Wei ซึ่งเป็นคนละถนนกันจริง ๆ และเป็นแกนของศึกปี 231 ทั้งศึก
   แต่ถ้าซ้ำโดยที่ terrain เหมือนกัน แปลว่าเผลอประกาศสองรอบ                     */
head('2 · edge ซ้ำคู่เดิม');
{
  const seen = {};
  E.forEach((e,i) => {
    const k = [e.a, e.b].sort().join('|');
    (seen[k] = seen[k] || []).push({ e, i });
  });
  let dup = 0;
  for (const k in seen){
    const g = seen[k]; if (g.length < 2) continue;
    dup++;
    const terr = new Set(g.map(x => x.e.terrain));
    if (terr.size < g.length)
      bad('ถนนซ้ำคู่ ' + k.replace('|',' ↔ ') + ' โดย terrain ไม่ต่างกัน — เผลอประกาศสองรอบหรือเปล่า');
    else
      note('ถนนสองสายระหว่าง ' + k.replace('|',' ↔ ') + ': ' +
           g.map(x => x.e.terrain + (x.e.wagons ? '(เกวียนได้)' : '(เกวียนไม่ได้)')).join(' · '));
  }
  if (!dup) ok('ไม่มีคู่ซ้ำ');
}

/* ═══ 3 · d ที่ลากไว้ ต้องเริ่มและจบตรงกับ node ที่ประกาศ ═══ */
head('3 · เส้นที่ลากแล้ว ตรงกับจุดในกราฟ');
{
  let traced = 0, untraced = 0;
  E.forEach((e,i) => {
    if (!e.d){ untraced++; return; }
    traced++;
    const p = N[e.a], q = N[e.b], en = ends(e.d);
    if (!en){ bad('edge[' + i + '] ' + e.a + '→' + e.b + ' อ่าน d ไม่ออก'); return; }
    if (!near(en.x0, en.y0, p.x, p.y, 6))
      bad(e.a + '→' + e.b + ' หัวเส้นห่างจุด ' + e.a + ' ' +
          Math.hypot(en.x0-p.x, en.y0-p.y).toFixed(1) + 'px');
    if (!near(en.x1, en.y1, q.x, q.y, 6))
      bad(e.a + '→' + e.b + ' ท้ายเส้นห่างจุด ' + e.b + ' ' +
          Math.hypot(en.x1-q.x, en.y1-q.y).toFixed(1) + 'px');
  });
  ok('ลากแล้ว ' + traced + ' เส้น · ยังไม่ลาก ' + untraced + ' เส้น');
  if (untraced) warn('ยังไม่ลาก ' + untraced + ' เส้น — builder ใส่เส้นโค้งชั่วคราวให้ ' +
                     'ดูรายการที่ข้อ 9 · **นี่คืองานค้าง ไม่ใช่ error**');
}

/* ═══ 4 · จุดไม่ได้อยู่กลางผืนน้ำ และอยู่ในกรอบภาพ ═══
   **ไม่ใช่ "อยู่บนบก"** — เมืองริมแม่น้ำตกบนช่องน้ำเป็นเรื่องปกติที่ความละเอียด 5 หน่วย
   สิ่งที่ผิดจริงคือจุดที่ลอยอยู่กลางผืนน้ำ ซึ่งแปลว่าพิกัดหลุด                        */
head('4 · จุดไม่ได้ลอยอยู่กลางผืนน้ำ และอยู่ในกรอบ 1650×1950');
{
  let n = 0, riverside = [];
  for (const id in N){
    const p = N[id];
    if (p.x < 0 || p.x > 1650 || p.y < 0 || p.y > 1950){ bad(id + ' หลุดกรอบภาพ'); n++; continue; }
    if (p.type === 'ford') continue;                    /* ford อยู่บนน้ำโดยนิยาม */
    if (inOpenWater(p.x, p.y)){
      if (p.chk) warn(id + ' ลอยอยู่กลางผืนน้ำ — chk:true อยู่แล้ว ต้องสอบเทียบก่อนใช้');
      else { bad(id + ' ลอยอยู่กลางผืนน้ำ พิกัดน่าจะหลุด'); n++; }
    } else if (wet(p.x, p.y)) riverside.push(id);
  }
  if (!n) ok('ผ่านทั้ง ' + Object.keys(N).length + ' จุด');
  if (riverside.length)
    note('อยู่บนช่องน้ำแต่ติดฝั่ง ' + riverside.length + ' จุด: ' + riverside.join(', ') +
         '\n      → ปกติ เมืองโบราณตั้งริมแม่น้ำ และ 1 ช่อง = 5 หน่วย (BUGS_SEEN §A5)');
}

/* ═══ 5 · เส้นที่ลากแล้ว ต้องไม่ลุยข้ามผืนน้ำ ═══
   วัดจาก **ความยาวของช่วงที่เปียกติดต่อกัน** ไม่ใช่จากจำนวนจุดที่เปียก
   ถนนที่เลาะหุบเขาแม่น้ำจะแตะน้ำเป็นระยะ ซึ่งถูกต้อง · ถนนที่ตัดข้ามทะเลสาบจะเปียกยาว
   เพดาน 30 หน่วย ≈ 6 ช่อง ≈ กว้างกว่าแม่น้ำสายไหนบนแผ่นนี้                        */
head('5 · เส้นทางไม่ลุยข้ามผืนน้ำ');
{
  const LIMIT = 30;
  let n = 0, grazed = [];
  E.forEach(e => {
    if (!e.d) return;
    const pts = samplePath(e.d, 3);
    const run = longestWetRun(pts);
    if (run <= 0) return;
    if (e.terrain === 'ford'){ note(e.a + '→' + e.b + ' ข้ามน้ำ ' + run.toFixed(0) + ' หน่วย (เป็น ford ถูกต้อง)'); return; }
    /* ★★ `river` — เพิ่ม 2026-09-01 สำหรับการทัพปี 269 (บทที่ 11)
       กองเรือไม่ได้เดินเลาะฝั่ง มันอยู่ *บน* น้ำ · กติกาข้อนี้ถูกเขียนไว้ตอนที่ทุก
       การเดินทัพในเล่มเป็นทัพบก ซึ่งจริงมาตลอดสิบบท แล้วบทที่สิบเอ็ดก็มาถึง
       ⚠ ยกเว้นให้เฉพาะเส้นที่เป็น**แม่น้ำจริงบนแผ่น** ไม่ใช่ทางลัดข้ามทะเลสาบ —
         ค่า wet run ยังพิมพ์ออกมาเสมอ ถ้าวันไหนมีคนลาก "แม่น้ำ" ตัดทุ่ง ตัวเลข
         จะเตี้ยผิดปกติให้เห็นเอง (แม่น้ำที่ลากถูกจะเปียกเกือบทั้งเส้น) */
    if (e.terrain === 'river'){
      /* ★ กลับด้านของกฎข้อนี้: แม่น้ำที่ **แห้ง** คือแม่น้ำที่ลากผิด
         ถ้า wet run ต่ำกว่าครึ่งหนึ่งของเพดาน แปลว่าเส้นวิ่งอยู่บนตลิ่งไม่ใช่ในร่องน้ำ
         (เจอกับตัวเองทันทีที่เพิ่มคำนี้: xiakou→wuchang ได้ 0 หน่วย = ลากพาดบกล้วน)
         ตระกูลเดียวกับ §E15 — ค่าที่คำนวณไว้แล้วแต่ไม่มีใครเอาไปเทียบ คือจุดบอด */
      if (run < LIMIT / 2)
        warn(e.a + '→' + e.b + ' ประกาศเป็น river แต่เปียกแค่ ' + run.toFixed(0) +
             ' หน่วย — เส้นวิ่งบนตลิ่ง ไม่ได้อยู่ในร่องน้ำ · ลาก d ใหม่ให้ตามลำน้ำจริง');
      else note(e.a + '→' + e.b + ' อยู่บนน้ำ ' + run.toFixed(0) + ' หน่วย (เป็น river ถูกต้อง)');
      return;
    }
    if (run > LIMIT){
      const msg = e.a + '→' + e.b + ' เปียกติดต่อกัน ' + run.toFixed(0) +
                  ' หน่วย (เพดาน ' + LIMIT + ') — ลุยข้ามผืนน้ำ ไม่ใช่เลาะฝั่ง';
      if (N[e.a].chk || N[e.b].chk) warn(msg + ' · ปลายทางยัง chk:true');
      else { bad(msg); n++; }
    } else grazed.push(e.a + '–' + e.b + ' ' + run.toFixed(0) + 'u');
  });
  if (!n) ok('ไม่มีเส้นไหนลุยข้ามผืนน้ำ');
  if (grazed.length) note('แตะน้ำแต่ไม่เกินเพดาน: ' + grazed.join(' · '));
}

/* ═══ 5.1 · ★★ ห้ามข้ามแม่น้ำนอกท่า — กฎที่ **มีมาตั้งแต่ต้นแต่ไม่เคยมีตัวตรวจ** ═══
   DECISIONS §4 กฎข้อ 3 เขียนไว้ตั้งแต่วันแรกว่า *"ห้ามข้ามแม่น้ำนอกท่า — edge ที่ข้ามน้ำ
   มีเฉพาะที่ปลายเป็น type:'ford'"* · ข้อ 5 ข้างบนคุมแค่ "ลุยข้ามผืนน้ำกว้างเกิน 30
   หน่วย" ซึ่งปล่อยให้ถนนพาดข้ามแม่น้ำกว้าง 10–25 หน่วยผ่านไปเงียบ ๆ ได้ทั้งเล่ม

   ที่มา (เจ้าของทัก 2026-09-01): *"ยิ่งที่เจียนเย่ มันตรงเข้าไปได้เลยเหรอ"*
   → วัดแล้วพบว่า `shouchun–jianye` **เปียก 0%** คือเส้นตรงแห้งพาดข้ามแยงซี
     โดยไม่มีท่า และไม่มีตัวตรวจตัวไหนเห็น เพราะมัน "ไม่เปียก" จึงไม่เข้าข้อ 5 เลย
   ⚠ ตระกูลเดียวกับ §E12/§E15: **กฎที่เขียนไว้แต่ไม่มีใครไปเทียบ**            */
head('5.1 · ท่าข้ามต้องข้ามน้ำจริง · และแม่น้ำใหญ่ต้องมีท่า');
{
  /* ── ครึ่งแรก · **ท่าข้ามที่ไม่เปียก = ถนนที่แกล้งข้ามแม่น้ำแต่ลากพลาดไปคนละที่**
     นี่คือครึ่งที่จับบั๊กจริงได้ · `jianye–shouchun` ประกาศ terrain:"ford" มาตลอด
     แต่เส้นที่วาดเปียก **0 หน่วย** — มันเลี่ยงแยงซีทั้งสายโดยบังเอิญ จึงไม่เข้าข้อ 5
     (ซึ่งจับเฉพาะเส้นที่เปียก*เกิน*เพดาน) และไม่มีตัวตรวจตัวไหนเห็นเลยทั้งเล่ม     */
  let bad1 = 0;
  E.forEach(e => {
    if (!e.d) return;
    /* ⚠ ต้องดูที่ **edge** ไม่ใช่ที่ node — node ที่เป็น `type:"ford"` แปลว่า
       "ตรงนี้มีท่าข้าม" ไม่ได้แปลว่าถนน*ทุกเส้น*ที่มาบรรจบต้องข้ามน้ำ
       (ลองใช้เงื่อนไข node แล้วมันฟ้อง baohan→jincheng ซึ่งเข้าจินเฉิงจากทางใต้
        โดยไม่ต้องข้ามฮวงโห — ส่วนเส้นที่ข้ามจริงคือ jincheng→wuwei ที่เปียก 10 หน่วย) */
    if (e.terrain !== 'ford') return;
    const run = longestWetRun(samplePath(e.d, 3));
    if (run >= 4) return;
    bad(e.a + '→' + e.b + ' เป็นท่าข้าม แต่เส้นที่วาดเปียกแค่ ' + run.toFixed(0) +
        ' หน่วย — มันไม่ได้ข้ามแม่น้ำอะไรเลย · ลาก d ใหม่ให้พาดข้ามร่องน้ำจริง ' +
        '(ใช้ tools/trace_river.js)');
    bad1++;
  });
  if (!bad1) ok('ท่าข้ามทุกแห่งพาดข้ามร่องน้ำจริง');

  /* ── ครึ่งหลัง · แม่น้ำ**ใหญ่**ที่ถูกข้ามโดยไม่มีท่า — รายงานเป็นงานค้าง
     เพดาน 20 เพราะต่ำกว่านั้นคือลำน้ำเว่ยกับสาขาของมันในกวานจง ซึ่งถนนบทที่ 1–9
     ข้ามกันเป็นปกติและถูกต้อง · ที่เกิน 20 คือของที่ควรมีท่าจริง ๆ            */
  const CROSS = 20;
  let n = 0;
  E.forEach(e => {
    if (!e.d || e.terrain === 'ford' || e.terrain === 'river') return;
    if ((N[e.a] && N[e.a].type === 'ford') || (N[e.b] && N[e.b].type === 'ford')) return;
    const run = longestWetRun(samplePath(e.d, 3));
    if (run < CROSS) return;
    warn(e.a + '→' + e.b + ' ข้ามน้ำติดต่อกัน ' + run.toFixed(0) +
         ' หน่วยโดยไม่มีท่าข้าม (DECISIONS §4 ข้อ 3) — ให้ปลายข้างหนึ่งเป็น type:"ford" ' +
         'หรือลาก d ให้เลี่ยงน้ำ');
    n++;
  });
  if (!n) ok('ไม่มีถนนไหนข้ามแม่น้ำใหญ่โดยไม่มีท่า');
}

/* ═══ 6 · การเดินทัพต่อ edge ได้ครบ ═══ */
head('6 · การเดินทัพต่อ edge ได้ครบทุกช่วง');
{
  let n = 0;
  for (const id in META){
    const m = META[id];
    if (m.missing.length){ bad(id + ' ขาดถนน: ' + m.missing.join(', ')); n++; }
    if (!m.path || m.path.length < 2){ bad(id + ' path สั้นเกินไป'); n++; }
    m.path.forEach(k => { if (!N[k]) { bad(id + ' อ้าง node ที่ไม่มี: ' + k); n++; } });
  }
  if (!n) ok('ผ่านทั้ง ' + Object.keys(META).length + ' เส้น');
}

/* ═══ 7 · ★ ของใครยกไปเท่าไหร่ (DECISIONS §4) ═══
   `side` บังคับทุกเส้น · `troops` บังคับเฉพาะเส้นที่มีการรบ
   ถ้าต้นฉบับแค่บรรยายว่าเดินไปตรงนั้นโดยไม่ได้รบ เว้น troops ได้ — ดูตามความเหมาะสม */
head('7 · ทุกเส้นบอกว่าเป็นของใคร ยกไปเท่าไหร่');
{
  let n = 0, noTroops = [];
  for (const id in MR){
    const m = MR[id];
    if (!m.side){ bad(id + ' ไม่มี side — บังคับทุกเส้น'); n++; }
    else if (!['han','wei','wu','none'].includes(m.side)){ bad(id + ' side ไม่รู้จัก: ' + m.side); n++; }
    if (m.troops == null) noTroops.push(id);
    else if (!(m.troops > 0)) { bad(id + ' troops ต้องเป็นจำนวนบวก'); n++; }
  }
  if (!n) ok('ทุกเส้นมี side ถูกต้อง');
  if (noTroops.length)
    note('ไม่ได้ระบุ troops ' + noTroops.length + ' เส้น: ' + noTroops.join(', ') +
         '\n      → ถูกต้องถ้าฉากนั้นไม่มีการรบ · ถ้ามีรบ ต้องใส่');
}

/* ═══ 8 · ขบวนเสบียงต้องเดินบนถนนที่เกวียนผ่านได้ ═══
   ★ นี่คือข้อที่โปรเจกต์นี้ต้องการมากที่สุด เพราะทั้งเรื่องเป็นเรื่องเสบียง        */
head('8 · ขบวนเสบียงเดินบนถนนที่เกวียนผ่านได้');
{
  let n = 0, any = false;
  for (const id in MR){
    const m = MR[id]; if (!m.supply) continue;
    any = true;
    /* ⚠⚠ เดิมบรรทัดนี้เขียน `IDX[key(a,b)]` ซึ่ง **หาไม่เจอตลอดกาล** —
       `TK.edgeIndex` คั่นคีย์ด้วย NUL (`a\0b`) ส่วน `key()` ของไฟล์นี้คั่นด้วยช่องว่าง
       ผลคือ `e` เป็น undefined ทุกท่อน `blocked` ว่างเสมอ และข้อ 8 รายงาน ✔ ทุกครั้ง
       โดยไม่ได้ตรวจอะไรเลย — ข้อที่โปรเจกต์บอกเองว่า "ต้องการมากที่สุด"
       (เจอ 2026-08-26 ตอนเขียนข้อ 11 แล้วเจอกับดักเดียวกัน · BUGS_SEEN §E11) */
    const blocked = [];
    for (let i = 0; i < m.path.length - 1; i++){
      const e = E.find(x => (x.a === m.path[i]   && x.b === m.path[i+1]) ||
                            (x.b === m.path[i]   && x.a === m.path[i+1]));
      if (!e) bad(id + ' อ้างช่วง ' + m.path[i] + '–' + m.path[i+1] + ' ที่ไม่มี edge');
      else if (e.wagons === false) blocked.push(m.path[i] + '–' + m.path[i+1]);
    }
    if (blocked.length){
      bad(id + ' เป็นขบวนเสบียง แต่ผ่านถนนที่เกวียนไปไม่ได้: ' + blocked.join(', '));
      n++;
    }
  }
  if (!any) note('ยังไม่มีเส้นไหนประกาศ supply:true');
  else if (!n) ok('ขบวนเสบียงทุกขบวนเดินบนถนนเกวียน');
}

/* ═══ 9 · งานค้าง — ถนนที่ยังไม่ได้ลาก ═══
   ตั้งใจให้เป็น warning ไม่ใช่ error: โปรเจกต์เดินได้ทั้งเส้นตั้งแต่วันแรก
   และ "ถนนที่ยังไม่ได้ลาก" เป็นรายการที่มองเห็นได้ ไม่ใช่ของที่ลืม              */
head('9 · ถนนที่ยังไม่ได้ลากตามภูมิประเทศจริง');
{
  const list = E.filter(e => !e.d);
  if (!list.length) ok('ลากครบทุกเส้นแล้ว');
  else {
    warn('ยังเหลือ ' + list.length + ' เส้น (builder ใส่เส้นโค้งชั่วคราวให้ไปก่อน):');
    list.forEach(e => console.log('      ' + e.a + ' – ' + e.b +
      '  [' + e.terrain + ' · ' + (e.li || '?') + ' ลี้]'));
  }
}

/* ═══ 10 · ของที่ไม่มีใครใช้ ═══ */
head('10 · node และ edge ที่ยังไม่มีการเดินทัพเส้นไหนใช้');
{
  const usedN = new Set(), usedE = new Set();
  for (const id in MR){
    const p = MR[id].path;
    p.forEach(k => usedN.add(k));
    for (let i = 0; i < p.length - 1; i++) usedE.add([p[i], p[i+1]].sort().join('|'));
  }
  const idleN = Object.keys(N).filter(k => !usedN.has(k));
  const idleE = E.filter(e => !usedE.has([e.a, e.b].sort().join('|')));
  note('node ยังไม่ถูกใช้ ' + idleN.length + '/' + Object.keys(N).length +
       ' · edge ยังไม่ถูกใช้ ' + idleE.length + '/' + E.length);
  note('ปกติในช่วงต้นโปรเจกต์ — กราฟถูกวางล่วงหน้า ฉากค่อยทยอยมาใช้ (DECISIONS §12)');
}

/* ═══ 11 · ★★ edge ที่ "ฉากใช้จริง" ต้องลาก d แล้ว (DECISIONS §4 ข้อ 3) ═══
   ทำไมต้องมี: กติกาข้อนี้ล็อกไว้ตั้งแต่ 2026-08-26 แต่ **ไม่มีอะไรบังคับมัน** —
   ข้อ 9 ข้างบนรายงาน "ถนนที่ยังไม่ลาก" รวม ๆ โดยไม่แยกว่าเส้นไหนมีฉากเหยียบอยู่
   ผลคือบทที่ 1 กับบทที่ 2 ปิดไปทั้งที่ลูกศรของ c1-06/c2-02/c2-05 ยังเป็นเส้นตรง
   ห้าท่อน และไม่มีใครรู้จนเจ้าของเปิดภาพดูเอง (LOG §5 เซสชันที่ 5)
   ตรงนี้คือช่องโหว่นั้น อุดด้วยการไล่จาก *ฉาก* ไม่ใช่จาก *กราฟ*                */
head('11 · edge ที่ฉากใช้จริง ต้องลากตามภูมิประเทศแล้ว');
{
  const fs = require('fs');
  /* ★ 2026-08-26 — ของเดิม hardcode ['_part1'..'_part4'] แล้วลืมเติมตอนบทที่ 5–6
     เกิดขึ้น: ข้อนี้ไม่เคยตรวจฉากบทที่ 5–6 เลย และผ่านเงียบ ๆ ทั้งที่เส้นปี 231
     เหยียบ edge ที่ยังไม่ลากอยู่ห้าท่อน (จับได้ตอนแตกบทที่ 6 เป็น 15 ฉาก)
     → สแกนไฟล์จริงจากดิสก์ ไม่ hardcode อีก — บทใหม่โผล่มาก็ถูกตรวจเอง */
  const parts = fs.readdirSync(path.join(ROOT,'data'))
    .filter(f => /^_part\d+\.js$/.test(f)).sort();
  parts.forEach(f => require(path.join(ROOT,'data',f)));
  const beats = parts.reduce((a,f) => a.concat(TK['_' + f.slice(1).replace('.js','')] || []), []);

  if (!beats.length){
    note('ยังไม่มีไฟล์ฉาก — ข้ามการตรวจนี้');
  } else {
    const usedBy = {};                       // routeId -> [scene ids]
    for (const b of beats)
      for (const m of (b.markers || []))
        if (m.type === 'arrow' && m.route) (usedBy[m.route] = usedBy[m.route] || []).push(b.id);

    /* ⚠ ห้ามใช้ TK.edgeIndex ตรง ๆ — คีย์ของมันคั่นด้วย NUL (`a\0b`) ไม่ใช่ช่องว่าง
       ส่วน key() ของไฟล์นี้คั่นด้วยช่องว่าง · เอาสองอันมาปนกันแล้วมันจะ **หาไม่เจอเงียบ ๆ**
       แล้วการตรวจก็ผ่านทุกอย่างโดยไม่ได้ตรวจอะไรเลย (เจอจริงตอนทดสอบยัดบั๊ก 2026-08-26) */
    const byPair = {};
    E.forEach(e => { byPair[key(e.a,e.b)] = e; byPair[key(e.b,e.a)] = e; });

    let holes = 0, legs = 0;
    for (const rid in usedBy){
      const mr = MR[rid];
      if (!mr){ bad(`ฉาก ${usedBy[rid].join(', ')} อ้าง route "${rid}" ที่ไม่มีในกราฟ`); continue; }
      for (let i = 0; i < mr.path.length - 1; i++){
        const e = byPair[key(mr.path[i], mr.path[i+1])];
        legs++;
        if (!e){ bad(`${mr.path[i]} – ${mr.path[i+1]} ไม่มี edge แต่ฉาก ${usedBy[rid].join(', ')} เดินผ่าน`); continue; }
        if (e && !e.d){
          holes++;
          bad(`${mr.path[i]} – ${mr.path[i+1]} ยังไม่ได้ลาก แต่ฉาก ${usedBy[rid].join(', ')} ` +
              `เดินทัพผ่าน (${rid}) — เส้นตรงบนจอจะอ่านเป็น "ส่งสาส์น" ไม่ใช่การเดินทัพ`);
        }
      }
    }
    if (!holes) ok(`ลากครบทุกท่อนที่ฉากเหยียบ (${legs} ท่อน จาก ${Object.keys(usedBy).length} การเดินทัพ)`);

    /* หมุดที่ฉากชี้แต่พิกัดยังไม่สอบเทียบ — ไม่ใช่ error แต่ต้องเห็นหัว ไม่ใช่ซ่อนอยู่ใน places.js */
    const chk = new Set();
    for (const b of beats)
      for (const m of (b.markers || []))
        if (m.place && TK.places[m.place] && TK.places[m.place].chk) chk.add(m.place);
    if (chk.size)
      note('หมุดที่ฉากชี้แต่ยังติดธง chk:true — ' + [...chk].map(k =>
        `${k}(${TK.places[k].x},${TK.places[k].y})${TK.places[k].map ? '' : ' ·แผ่นไม่มี dot'}`).join(' · '));
  }
}

/* ═══ 12 · ★★ เส้นเดินทัพที่คดหรือหักกลับ ต้องมีเหตุผลเขียนไว้ ═══════════════
   เพิ่ม 2026-08-27 · ที่มา: เจ้าของอ่านบทที่ 6–7 แล้วทักว่า *"มันยังมีทางคดๆ อยู่อย่าง
   Yicheng → Tian Shui"* และ *"น่าจะต้องจัดลำดับเส้นดีๆ"* — ไล่ดูแล้วพบว่าตัวตรวจทั้งห้าตัว
   **ไม่มีตัวไหนดูรูปร่างของเส้นเลย** มันตรวจว่าเส้นมีจริง ลากแล้ว ต่อกันติด อยู่บนบก
   แต่ไม่เคยถามว่า "เส้นนี้พาคนอ่านเดินอ้อมโลกหรือเปล่า"
   ที่เจอรอบนั้นสี่เส้น ทุกเส้นเป็น **ผลข้างเคียงของ edge ที่ขาด** ไม่ใช่การตัดสินใจ:
     · han_tianshui_227/232  คด 2.06 · หัก 93°  — ไม่มี edge jicheng–tianshui
     · han_weihe_233         คด 2.39 · หัก 118° — ไม่มี edge chencang–wuzhang
     · han_winter_234        คด 2.39 · หัก 118° — เส้นเดียวกัน จุดเดียวกัน
     · han_beiyuan_233       คด 1.75 · หัก 122° — หัวเส้นเผลอเริ่มที่ค่ายแทนที่ท่าข้าม

   ★★ สิ่งที่วัด ไม่ใช่ "คดแค่ไหน" แต่คือ **"มีท่อนไหนเดินถอยหลังออกจากปลายทางไหม"**
   ลองใช้ detour ratio กับมุมหักมาก่อนแล้ว — มันฟ้องถนนที่ถูกต้องเกือบทุกเส้น
   (ถนนสันเขาหลงหัก 135° · การวนทุ่งหญ้าหัก 145° · ถนนกู้เต้าหัก 102° ทั้งสามเส้นถูกทั้งหมด)
   เพราะภูเขาบังคับให้ถนน**หัก**เป็นเรื่องปกติ สิ่งที่ไม่ปกติคือถนน**ถอย**
   วิธีวัด: ฉายเวกเตอร์ของแต่ละท่อนลงบนทิศ "ต้นทาง → ปลายทาง" ของทั้งเส้น
   ท่อนไหนได้ค่าติดลบ = ท่อนนั้นพาทัพเดินห่างจากปลายทาง = หัวลูกศรชี้สวนทางการทัพ
   เตือนเมื่อค่าติดลบเกิน 8% ของระยะต้น-ปลาย และเกิน 8 หน่วยบนกระดาน
   ทดสอบกับของจริงแล้วแยกได้สะอาด — ทั้งสี่บั๊กที่เจอรอบนี้ถอย 21–25%
   ส่วนถนนกู้เต้าเส้นใหม่ (หัก 102°) ไม่มีท่อนไหนติดลบเลยสักท่อน
   ★ เส้นที่ **ตั้งใจ** ถอยก็มีจริง — ถนนสันเขาหลงต้องขึ้นเหนือก่อนลงเฉินชาง ·
     เส้นวนทุ่งหญ้าของเว่ยเหยียนต้องวกลงใต้หลังแนววุ่ย — ตัวตรวจจึงเงียบให้เมื่อ
     **edge ของท่อนที่ถอยนั้นเอง** มี `note` (ไม่ใช่ note ของเพื่อนบ้าน ไม่ใช่ note ของ march
     — สองอย่างนั้นหลวมจนยกโทษให้ทุกเส้น ลองมาแล้ว) = มีคนเขียนไว้แล้วว่าทำไมต้องถอยตรงนี้

   ⚠ **สิ่งที่ข้อนี้จับไม่ได้ และรู้ตัวว่าจับไม่ได้** — ทดสอบด้วยการยัดบั๊กเก่ากลับเข้าไปแล้ว
     (สคริปต์ regress อยู่ใน LOG §5 เซสชันที่ 12) จับได้ 4 จาก 6:
       ✔ han_tianshui_227/232 · han_weihe_233 · han_winter_234
       ✘ han_beiyuan_233 เดิม — ถอยแค่ 0.9 หน่วย ต่ำกว่าเกณฑ์จริง ๆ ไม่ใช่ความผิดพลาด
       ✘ **hanzhong–sanpass เดิม — เพราะมันไม่ได้ถอย มันเดินตรงขึ้นเหนือทับภูเขา**
         ถนนที่ลากทับภูมิประเทศที่แผ่นพิมพ์ไว้เป็นบั๊กคนละชนิด ต้องอ่านพิกเซลของ
         `assets/map.jpg` ถึงจะจับได้ (วิธีที่ใช้จับรอบนี้: สุ่มสีกึ่งกลางเส้น — เส้นเดิมได้
         RGB 187,223,209 = โซนเขียว) · ยังไม่ได้ทำเป็นตัวตรวจ = งานค้างที่รู้ตัว */
head('12 · ท่อนเดินทัพที่พาทัพถอยห่างจากปลายทาง ต้องมีเหตุผลเขียนไว้');
{
  const BACK_FRAC = 0.08, BACK_ABS = 4;
  const xy = id => {
    const n = N[id] || {};
    if (n.x != null) return [n.x, n.y];
    const p = TK.places[id];
    return p ? [p.x, p.y] : null;
  };
  const byPair = {};
  E.forEach(e => { byPair[key(e.a,e.b)] = e; byPair[key(e.b,e.a)] = e; });

  let flagged = 0, seen = 0;
  for (const rid in MR){
    const mr = MR[rid];
    const pts = mr.path.map(xy);
    if (pts.some(p => !p) || pts.length < 3) continue;
    seen++;
    const span = Math.hypot(pts[pts.length-1][0]-pts[0][0], pts[pts.length-1][1]-pts[0][1]);
    if (span < 1) continue;
    const ux = (pts[pts.length-1][0]-pts[0][0]) / span, uy = (pts[pts.length-1][1]-pts[0][1]) / span;

    for (let i = 1; i < pts.length; i++){
      const proj = (pts[i][0]-pts[i-1][0]) * ux + (pts[i][1]-pts[i-1][1]) * uy;
      if (proj >= 0) continue;
      const back = -proj;
      if (back < BACK_ABS || back / span < BACK_FRAC) continue;
      const e = byPair[key(mr.path[i-1], mr.path[i])];
      const desc = `${rid} — ท่อน ${mr.path[i-1]} → ${mr.path[i]} ถอยห่างปลายทาง ` +
                   `${back.toFixed(0)} หน่วย (${(100*back/span).toFixed(0)}% ของระยะต้น-ปลาย)`;
      if (e && e.note) note(desc + ' — edge มี note อธิบายไว้แล้ว');
      else { flagged++;
        warn(desc + ' — **edge ท่อนนี้ไม่มี note** · ถ้าภูมิประเทศบังคับให้ถอยจริง ' +
             'ให้เขียนเหตุผลลง edge · ถ้าไม่ใช่ แปลว่ากราฟขาด edge แล้ว builder อ้อมให้เอง'); }
    }
  }
  if (!flagged) ok(`ไล่ ${seen} การเดินทัพ — ไม่มีท่อนไหนพาทัพถอยโดยไม่มีคนอธิบายไว้`);
}

/* ═══ 13 · ★★ ความเร็วเดินทัพ — Σ li เทียบกับเวลาที่ต้นฉบับบอก ══════════════
   เพิ่ม 2026-09-02 · เกณฑ์ข้อนี้อยู่ในตาราง DECISIONS §4 มาตั้งแต่วันแรก
   ("Σ `li` เทียบกับเวลาที่ต้นฉบับบอก · เตือนถ้าเร็วเกิน 100 ลี้/วัน")
   แต่ **ไม่เคยมีโค้ด** — ก่อนวันนี้ `li` ถูกอ่านที่เดียวในไฟล์นี้คือข้อ 9
   และอ่านไปเพื่อ *พิมพ์* เฉย ๆ ทั้งที่ `roads.js` เขียนเหตุผลของ `li:1200`
   ไว้เองว่า "มีไว้ตรวจความเร็วเดินทัพกับโหมดเสบียง จึงต้องเป็นระยะจริง"
   → ตระกูล §E17 เป๊ะ: เอกสารจดว่ามีกฎ แต่ไม่มีตัวตรวจตัวไหนอ่านเอกสาร

   ★ ของที่ต้องมีก่อน: `days` บน march = **เวลาที่การ *เดินทาง* ใช้**
     ไม่ใช่เวลาที่การทัพทั้งการทัพใช้ · beat มีแค่ `year`/`season` เครื่องอ่านเองไม่ได้
     เวลาอยู่ในร้อยแก้ว ต้องมีคนยกมาใส่ทีละเส้น จึงใส่เฉพาะเส้นที่ต้นฉบับบอกวันไว้ชัด
     ⚠ **51 วันของศึกชิงเทียนสุ่ยไม่ใช่ `days`** — นั่นคือเวลาไล่ยึดป้อมทีละป้อม
       ไม่ใช่เวลาเดิน (ใส่ลงไปจะได้ 3 ลี้/วัน ซึ่งด้านช้าข้างล่างจะฟ้องให้เอง)

   ★★ เขียนสองด้านตามบทเรียน §E16 ("กฎที่ตรวจได้ทางเดียว = กฎที่มีรูอยู่อีกทาง"):
     เร็วเกิน → ⚠ เตือน · เว้นแต่ประกาศ `forced:"เหตุผล"` = ตั้งใจ มีคนเขียนไว้แล้ว
                (กติกาเดียวกับข้อ 12 — ยกโทษให้เมื่อมีคน *เขียนเหตุผล* ไว้ ไม่ใช่ยกโทษเปล่า)
     ช้าเกิน  → · รายการทบทวน · เกือบทุกครั้งแปลว่า `days` ที่ใส่มาเป็นเวลาของ
                *การทัพ* ไม่ใช่เวลาเดินทาง = ใส่ผิดช่อง ไม่ใช่แผนที่ผิด

   ⚠ SUPPLY_MAX ยังไม่มีเส้นไหนปลุกมัน (ขบวนเสบียงทั้งสามขบวนบอกเวลาเป็น *เดือน*
     ไม่ใช่วัน) — วันไหนมันฟ้องขึ้นมาครั้งแรก **ให้เจ้าของเคาะตัวเลขก่อน** อย่าเชื่อ 40
     ลอย ๆ · เลข 100 ของทัพเดินเท้าเป็นของที่ล็อกไว้แล้วใน §4 ไม่ใช่ของที่ตั้งเอง       */
head('13 · ความเร็วเดินทัพเทียบกับเวลาที่ต้นฉบับบอก');
{
  const MARCH_MAX = 100, SUPPLY_MAX = 40, SLOW_MIN = 10;
  const byPair2 = {};
  E.forEach(e => { byPair2[key(e.a,e.b)] = e; byPair2[key(e.b,e.a)] = e; });

  let seen = 0, flagged = 0;
  const lines = [];
  for (const id in MR){
    const m = MR[id];
    if (m.days == null) continue;
    if (!(m.days > 0)){ bad(id + ' days ต้องเป็นจำนวนบวก (ได้ ' + m.days + ')'); continue; }

    let sum = 0; const noLi = [];
    for (let i = 0; i < m.path.length - 1; i++){
      const e = byPair2[key(m.path[i], m.path[i+1])];
      if (!e || e.li == null) noLi.push(m.path[i] + '–' + m.path[i+1]);
      else sum += e.li;
    }
    if (noLi.length){
      warn(id + ' ประกาศ days แต่ช่วงเหล่านี้ไม่มี li: ' + noLi.join(', ') +
           ' — คิดความเร็วไม่ได้');
      continue;
    }

    seen++;
    const v   = sum / m.days;
    const cap = m.supply ? SUPPLY_MAX : MARCH_MAX;
    const row = `${id} — ${sum} ลี้ / ${m.days} วัน = **${v.toFixed(0)} ลี้/วัน**` +
                (m.supply ? ' [ขบวนเสบียง]' : '');
    lines.push('      ' + row);

    if (v > cap){
      if (m.forced) note(row + ` — เกิน ${cap} แต่ประกาศไว้แล้ว: ${m.forced}`);
      else { flagged++;
        warn(row + ` — เกินเพดาน ${cap} ลี้/วัน (DECISIONS §4) · ถ้าตั้งใจให้เป็น` +
             'การเร่งทัพจริง ให้เขียน `forced:"เหตุผล + ¶"` ลง march · ถ้าไม่ใช่ ' +
             'แปลว่า li ของถนนเส้นใดเส้นหนึ่งผิด หรือ path พาอ้อม'); }
    } else if (v < SLOW_MIN){
      note(row + ` — ช้ากว่า ${SLOW_MIN} ลี้/วัน · `+
           '`days` ที่ใส่มาน่าจะเป็นเวลาของ *การทัพ* ไม่ใช่เวลาเดินทาง (ดูหัวข้อข้อนี้)');
    }
  }

  if (!seen) note('ยังไม่มีการเดินทัพเส้นไหนประกาศ days');
  else {
    if (!flagged) ok(`ไล่ ${seen} เส้นที่บอกเวลาไว้ — ไม่มีเส้นไหนเร็วเกินโดยไม่มีคนอธิบาย`);
    console.log(lines.join('\n'));
  }
  note('เส้นที่ยังไม่ประกาศ days ' + (Object.keys(MR).length - seen) + '/' +
       Object.keys(MR).length + ' — ถูกต้องถ้าต้นฉบับไม่ได้บอกเวลาไว้ (§4)');
}

/* ═══ 14 · ★★ สิ่งก่อสร้างที่ปิดทาง ต้องอยู่บนทางที่มีคนเดินจริง ═══════════════
   เพิ่ม 2026-09-05 · เจ้าของอนุญาตให้สร้างชั้น `works` โดยมีเงื่อนไขว่าต้องมีตัวตรวจ
   มาพร้อมกัน — เพราะมันกลับคำตัดสินเดิมที่ `_part7.js:107` เขียนไว้ว่า
   *"ไม่สร้างระบบป้อมเป็นข้อมูลใหม่ (§14)"*

   ★ สิ่งที่ทำให้มันไม่เป็น "แหล่งความจริงที่สอง": **works ไม่มีพิกัดของตัวเอง**
     มันประกาศแค่ว่าเกาะอยู่บน edge ไหน ช่วงไหน · ข้อนี้จึงตรวจได้ว่า
     "ที่มันอ้างว่าปิด" กับ "ถนนที่มีอยู่จริง" เป็นเส้นเดียวกันหรือเปล่า

   ★★ สองด้านตามบทเรียน §E16:
     ด้านหนึ่ง → edge ที่อ้างถึงต้องมีจริง มี `d` แล้ว และช่วง from–to ต้องสมเหตุผล
     ด้านกลับ → **สิ่งก่อสร้างที่ปิดถนนซึ่งไม่มีการเดินทัพเส้นไหนใช้เลย = ของประดับ**
                (ปิดประตูที่ไม่มีใครเดินผ่าน ไม่มีความหมายในเรื่อง) → รายการทบทวน   */
head('14 · โซ่ป้อม/แนวรั้ว เกาะอยู่บนถนนที่มีคนเดินจริง');
{
  const WK = TK.works || [];
  if (!WK.length) note('ยังไม่มี works ประกาศไว้');
  else {
    const byPair3 = {};
    E.forEach(e => { byPair3[key(e.a,e.b)] = e; byPair3[key(e.b,e.a)] = e; });
    /* edge ที่มีการเดินทัพเหยียบจริง */
    const walked = new Set();
    for (const rid in MR){
      const p = MR[rid].path;
      for (let i = 0; i < p.length - 1; i++) walked.add(key(p[i], p[i+1]));
    }
    let bad14 = 0, ok14 = 0;
    for (const w of WK){
      const tag = w.id + ' (' + (w.label || w.kind) + ')';
      if (!Array.isArray(w.on) || w.on.length !== 2){
        bad(tag + ' ช่อง `on` ต้องเป็น [nodeA,nodeB]'); bad14++; continue; }
      if (!N[w.on[0]] || !N[w.on[1]]){
        bad(tag + ' อ้าง node ที่ไม่มี: ' + w.on.join(' / ')); bad14++; continue; }
      const e = byPair3[key(w.on[0], w.on[1])];
      if (!e){
        bad(tag + ' อ้าง edge ที่ไม่มีในกราฟ: ' + w.on.join('–') +
            ' — **สิ่งก่อสร้างต้องปิดถนนที่มีอยู่จริง ห้ามลอยกลางแผ่นดิน**'); bad14++; continue; }
      if (!e.d){
        bad(tag + ' edge ' + w.on.join('–') + ' ยังไม่ได้ลาก `d` — วางตำแหน่งไม่ได้'); bad14++; continue; }
      const f0 = w.from, f1 = w.to;
      if (!(f0 >= 0 && f1 <= 1 && f0 < f1)){
        bad(tag + ' ช่วง from/to ผิด (' + f0 + '–' + f1 + ') ต้อง 0 ≤ from < to ≤ 1'); bad14++; continue; }
      ok14++;
      if (!walked.has(key(w.on[0], w.on[1])))
        note(tag + ' อยู่บน edge ' + w.on.join('–') + ' ที่ **ไม่มีการเดินทัพเส้นไหนใช้เลย**' +
             ' — ปิดถนนที่ไม่มีใครเดิน · ตั้งใจหรือเปล่า');
    }
    if (!bad14) ok('ผ่านทั้ง ' + ok14 + ' ชิ้น — ทุกชิ้นเกาะ edge จริงที่ลากแล้ว');
  }
}

/* ═══ 15 · ★★ ปีของสิ่งที่ถูกสร้างทีหลัง ═══════════════════════════════════
   เพิ่ม 2026-09-05 · เจ้าของทัก: *"พวกค่าย โซ่ป้อม ที่นา มันถูกสร้างมาทีหลังนี่"*
   ทั้งเล่มสร้างบนกติกา "ห้ามแสดงสิ่งที่ยังไม่มี" แต่ **ชั้นสัญลักษณ์ไม่เคารพกติกานั้น**
   จนถึงวันนั้น — ค่ายนาอู่จ้างหยวนตั้งปี 234 แต่วาดตั้งแต่ฉากปี 221 = โกหกอยู่ 13 ปี

   ⚠⚠ **ข้อนี้ไม่ใช่ error โดยตั้งใจ** — "ฉากปี 233 อ้างถึงอู่จ้างหยวน ทั้งที่ค่ายนา
     ตั้งปี 234" **ไม่ผิด** เพราะที่ราบสูงมีอยู่ก่อนค่ายนา · ฉากนั้นชี้ *ที่ตั้ง* ไม่ใช่ชี้ *ค่ายนา*
     สิ่งที่ข้อนี้ทำคือ **กางตารางให้คนดู** ว่าอะไรถูกซ่อนในปีไหนบ้าง จะได้เห็นด้วยตา
     ว่าปีที่ตั้งไว้สมเหตุผลไหม — ตรวจอัตโนมัติแทนไม่ได้ เพราะมันเป็นคำถามเรื่องเรื่อง       */
head('15 · ปีของสิ่งที่ถูกสร้างทีหลัง (ค่าย · ค่ายนา · ยุ้ง · โซ่ป้อม · แนวรั้ว)');
{
  /* ★ ใช้วิธีเดียวกับข้อ 11 เป๊ะ ๆ — สแกนไฟล์จริงจากดิสก์ แล้วอ่านผ่านชื่อ TK._partN
     (รอบแรกผมเดาว่ามันอยู่ใน TK.parts แล้วได้ตารางที่ 'ฉากแรก' ว่างทุกแถว
      ซึ่งดูเหมือนข้อมูลไม่มี ทั้งที่จริงคืออ่านผิดที่ — §E20 อีกครั้ง) */
  const fs = require('fs');            /* ข้อ 11 ก็ require ในบล็อกตัวเองเหมือนกัน */
  const pfiles = fs.readdirSync(path.join(ROOT,'data'))
    .filter(f => /^_part\d+\.js$/.test(f)).sort();
  pfiles.forEach(f => require(path.join(ROOT,'data',f)));
  const beats = pfiles.reduce((a,f) => a.concat(TK['_' + f.slice(1).replace('.js','')] || []), []);

  /* ฉากแรกที่แต่ละ node ถูกอ้างถึง (ทั้งหมุดและท่อนของเส้นทาง) */
  const firstUse = {};
  for (const b of beats)
    for (const m of (b.markers || [])){
      const ids = [];
      if (m.place) ids.push(m.place);
      const r = m.route && MR[m.route];
      if (r) r.path.forEach(k => ids.push(k));
      for (const k of ids)
        if (firstUse[k] === undefined || b.year < firstUse[k].year) firstUse[k] = {year:b.year, id:b.id};
    }

  const Y0 = beats.length ? Math.min(...beats.map(b => b.year)) : 221;
  const Y1 = beats.length ? Math.max(...beats.map(b => b.year)) : 285;
  const rows = [];
  let n15 = 0;

  const check = (label, year, key) => {
    if (year == null) return;
    if (!(year >= Y0 && year <= Y1)){
      bad(`${label} ปี ${year} อยู่นอกช่วงของเล่ม (${Y0}–${Y1})`); n15++; return;
    }
    const f = key && firstUse[key];
    rows.push([label, year, f ? `${f.year} (${f.id})` : '—']);
  };
  for (const id in TK.places){
    const p = TK.places[id];
    if (p.year != null)     check(`${p.label} [${p.type}]`, p.year, id);
    if (p.roleYear != null) check(`${p.label} ป้าย ${p.role}`, p.roleYear, id);
  }
  for (const w of (TK.works || [])) check(`${w.label} [${w.kind}]`, w.year, null);

  if (!n15) ok(`ปีทุกค่าอยู่ในช่วงของเล่ม (${rows.length} รายการ)`);
  console.log('      สิ่งที่ถูกสร้าง'.padEnd(34) + 'สร้างปี   ฉากแรกที่อ้างถึงจุดนี้');
  rows.sort((a,b) => a[1] - b[1]).forEach(r =>
    console.log('      ' + String(r[0]).padEnd(30) + String(r[1]).padStart(5) + '     ' + r[2]));
  note('ฉากที่ปีน้อยกว่า "สร้างปี" จะเห็นจุดกลมแทนสัญลักษณ์ — ตั้งใจ ไม่ใช่บั๊ก');
}

/* ═══ 16 · ★★ สิ่งก่อสร้างยืนอยู่บนแผ่นดินของใคร ═══════════════════════════════
   เพิ่ม 2026-09-06 · เจ้าของจับได้เองว่า **โซ่ป้อมของฮั่นถูกวาดคร่อมแดนวุ่ยอยู่สองปี**
   (`jieting_chain` side:han year:232 บน `tianshui–jieting` ซึ่งวุ่ยยึดไว้ตั้งแต่ c6-12 ปี 231
    จนฮั่นชิงคืนที่ c7-05 ปี 233)

   ★ ทำไมไม่มีตัวตรวจตัวไหนเห็น: ข้อ 14 ถามว่า "เกาะถนนจริงไหม" · ข้อ 15 ถามว่า
     "ปีอยู่ในช่วงของเล่มไหม" — **ไม่มีใครถามว่าแผ่นดินใต้มันเป็นของใคร ณ ปีนั้น**
     ข้อนี้ถามคำถามนั้น และถามทุกปีที่ชิ้นนั้นยังโผล่อยู่บนจอ ไม่ใช่แค่ปีที่สร้าง

   ★ วิธี: สุ่มจุดตามช่วง from–to ของ edge แล้วหาเจ้าของเขต ณ **ปลายปีนั้น**
     (สะสม mapDelta ของทุกฉากที่ year ≤ ปีนั้น เหมือนที่ engine ทำ)
     ผิด = **ทุกจุดที่สุ่ม** ตกอยู่ในเขตของฝ่ายตรงข้าม · จุดที่คร่อมเส้นแบ่งไม่ถูกฟ้อง
   ⚠ `frontline:true` = เจ้าของประกาศว่าตั้งใจ (แนวรั้วกัวหวย 229 ตั้ง "เหนือเส้นเมือง
     ของฮั่น" บนเส้นที่แผนที่ราชการไม่มีชื่อ — เขตหนึ่งเขตหนึ่งเจ้าของแสดงไม่ได้)     */
head('16 · โซ่ป้อม/แนวรั้ว/ค่าย ยืนอยู่บนแผ่นดินของฝ่ายตัวเองไหม');
{
  const WK = TK.works || [];
  let REGN = null;
  try {
    require(path.join(ROOT, 'data', 'geo.js'));
    try { require(path.join(ROOT, 'data', 'geo_fill.js')); } catch { /* ใช้รูปที่ลากมือ */ }
    require(path.join(ROOT, 'data', 'timeline.js'));
    REGN = TK.regions;
  } catch (e) { REGN = null; }

  if (!WK.length)      note('ยังไม่มี works ประกาศไว้');
  else if (!REGN)      warn('โหลด geo/timeline ไม่ได้ — ข้ามข้อนี้ (ไม่ใช่ผลตรวจ)');
  else {
    /* รูปเดียวกับที่วาดจริง (geo_fill ถ้ามี) — วิธีเดียวกับ check_map.js เป๊ะ ๆ */
    const loops = d => {
      const out = [];
      for (const chunk of d.split('M').slice(1)){
        const pts = []; const re = /(-?[\d.]+)\s*,\s*(-?[\d.]+)/g; let m;
        while ((m = re.exec(chunk))) pts.push([+m[1], +m[2]]);
        if (pts.length > 2) out.push(pts);
      }
      return out;
    };
    const shp = {};
    for (const id in REGN) shp[id] = loops(REGN[id].fill || REGN[id].d);
    const inPoly = (pts, x, y) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const regionAt = (x, y) => {
      for (const id in shp) if (shp[id].some(l => inPoly(l, x, y))) return id;
      return null;
    };
    const TL = TK.timeline || [];
    const Y1 = TL.length ? Math.max(...TL.map(b => b.year)) : 285;
    const ownCache = {};
    const ownersAtEndOf = y => {
      if (ownCache[y]) return ownCache[y];
      const o = {};
      for (const id in REGN) o[id] = REGN[id].owner;
      for (const b of TL) if (b.year <= y) Object.assign(o, b.mapDelta || {});
      return (ownCache[y] = o);
    };
    const LBL = s => (TK.factions[s] || {}).label || s;

    const byPair4 = {};
    E.forEach(e => { byPair4[key(e.a,e.b)] = e; byPair4[key(e.b,e.a)] = e; });

    let bad16 = 0, ok16 = 0;
    for (const w of WK){
      if (!w.side || w.side === 'none' || w.year == null) continue;
      const e = byPair4[key(w.on[0], w.on[1])]; if (!e || !e.d) continue;
      /* จุดตัวอย่างตามช่วง from–to · ทิศ from→to เดินจาก on[0] ไป on[1] */
      const pts = samplePath(e.d, 2);
      if (pts.length < 2) continue;
      const fwd = near(pts[0][0], pts[0][1], N[w.on[0]].x, N[w.on[0]].y, 3);
      const seq = fwd ? pts : pts.slice().reverse();
      const samples = [];
      for (let k = 0; k <= 6; k++){
        const u = w.from + (w.to - w.from) * (k / 6);
        samples.push(seq[Math.min(seq.length - 1, Math.round(u * (seq.length - 1)))]);
      }
      const yEnd = (w.gone != null ? w.gone - 1 : Y1);
      const wrong = [];
      for (let y = w.year; y <= yEnd; y++){
        const own = ownersAtEndOf(y);
        const holders = new Set();
        for (const s of samples){ const r = regionAt(s[0], s[1]); if (r) holders.add(own[r]); }
        if (!holders.size) continue;                       /* ไม่ตกในเขตไหนเลย — ข้อ 14 ดูแล */
        if ([...holders].every(h => h && h !== 'none' && h !== w.side))
          wrong.push(y + ':' + [...holders].map(LBL).join('/'));
      }
      const tag = w.id + ' (' + (w.label || w.kind) + ' · ' + LBL(w.side) + ')';
      /* รายการปีอาจยาวหลายสิบปีถ้าชิ้นนั้นไม่มี `gone` — ตัดให้อ่านออก แล้วบอกยอดจริง */
      const yl = wrong.length > 6
        ? wrong.slice(0,3).join(' · ') + ' … ' + wrong[wrong.length-1] +
          ' (รวม ' + wrong.length + ' ปี)'
        : wrong.join(' · ');
      if (!wrong.length) ok16++;
      else if (w.frontline){
        note(tag + ' ยืนในแดนอีกฝ่ายปี ' + yl +
             ' — **ประกาศ `frontline:true` ไว้แล้ว** (แนวคร่อมเส้นแบ่งที่เขตแสดงไม่ได้)');
        ok16++;
      } else {
        bad(tag + ' ยืนอยู่บนแผ่นดินของอีกฝ่ายเต็มเส้น: ' + yl +
            ' — ถ้าตั้งใจให้ใส่ `frontline:true` พร้อมเหตุผล ถ้าไม่ตั้งใจให้แก้ `year` หรือ `on`');
        bad16++;
      }
    }
    if (!bad16) ok('ผ่านทั้ง ' + ok16 + ' ชิ้น — ไม่มีชิ้นไหนยืนคร่อมแดนศัตรูโดยไม่ได้ประกาศ');
  }
}

/* ═══ สรุป ═══ */
console.log('\n' + '─'.repeat(58));
console.log(errs ? '✖ ผิด ' + errs + ' รายการ' : '✔ ไม่มีข้อผิดพลาด');
if (warns) console.log('⚠ เตือน ' + warns + ' รายการ (งานค้าง ไม่ใช่บั๊ก)');
process.exit(errs ? 1 : 0);
