/* zhou_preview.js — วาดรูปทรงมณฑลของเราออกมาเป็นภาพเดียว เพื่อ **เอาไปเทียบกับแผนที่อ้างอิง**
 *
 *   node tools/zhou_preview.js            เขียน tools/_zhou_preview.html
 *   node tools/zhou_preview.js --plate    ซ้อนบน assets/map.jpg ด้วย (ดูว่าเส้นตกตรงไหนของแผ่น)
 *
 * ═══ ทำไมต้องมี ═══
 * เจ้าของทัก 2026-09-10: *"เราสังเกตเห็นตรงแหลมๆ น่ะ มันแปลกๆ ... บริเวณอื่นมันก็แปลกด้วย"*
 * แล้วส่งแผนที่อ้างอิง (Eagle Eye Maps · The Three States) มาให้ใช้เทียบ
 *
 * ★ ปัญหาของการเทียบด้วยตาบนแอปจริง: เส้นมณฑลเป็น**เส้นประบาง ๆ** ทับอยู่บนภูมิประเทศ
 *   สีฝ่าย และชื่อเมืองอีกร้อยกว่าจุด — **รูปทรงของมณฑลจึงมองไม่ออก** ทั้งที่นั่นคือสิ่งเดียว
 *   ที่ต้องเทียบ · ไฟล์นี้ถอดทุกอย่างออกเหลือแค่ *รูปทรง* แล้วทาสีทึบให้เห็นเป็นก้อน
 *
 * ⛔ **ไม่ได้วาร์ปแผนที่อ้างอิงลงแผ่น และจะไม่ทำ** — `tools/georef.js` วัดไว้ 2026-08-22 ว่า
 *   แผ่นนี้ไม่มี projection ที่คงเส้นคงวา (RMS 48px ≈ 60 กม.) การลากพิกัดจากแผนที่ระบบอื่น
 *   มาทับจึงผิดตั้งแต่วิธี (ดูหัวไฟล์ `data/zhou_lines.js`)
 *   ⇒ แผนที่อ้างอิงใช้ตอบได้แค่ **"ฝั่งไหน" กับ "ติดกับใคร"** ไม่ใช่ "พิกัดเท่าไร"
 *
 * ★ วิธีระบายสี: ท่วมสีจากเมล็ดของแต่ละมณฑลด้วยกติกาเดียวกับ `check_zhou.js` เป๊ะ
 *   (ผนัง = เส้น + `close`) ⇒ ถ้าภาพนี้ดูแปลก แปลว่า *ข้อมูลแปลก* ไม่ใช่ตัววาดแปลก
 */
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
global.window = global;
for (const f of ['names.js','places.js','geo.js','landmask.js','provinces.js','zhou_lines.js'])
  require(path.join(ROOT, 'data', f));

const P = TK.places, Z = TK.zhou;
const W = 1650, H = 1950, CELL = 3;
const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
const PLATE = process.argv.includes('--plate');

/* ── ผนัง + ท่วมสี (กติกาเดียวกับ check_zhou.js) ─────────────────────────── */
const wall = new Uint8Array(GW * GH);
const idx = (cx, cy) => cy * GW + cx;
const mark = (x, y) => { const cx = Math.floor(x/CELL), cy = Math.floor(y/CELL);
  if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) wall[idx(cx, cy)] = 1; };
for (const e of Z.edges){
  const line = e.close ? e.pts.concat(e.close) : e.pts;
  for (let i = 1; i < line.length; i++){
    const [x0,y0] = line[i-1], [x1,y1] = line[i];
    const n = Math.max(2, Math.ceil(Math.hypot(x1-x0, y1-y0)));
    for (let k = 0; k <= n; k++) mark(x0 + (x1-x0)*k/n, y0 + (y1-y0)*k/n);
  }
}
const keys = Object.keys(Z.list);
const lab = new Int8Array(GW * GH).fill(-1);
const queue = [];
keys.forEach((k, i) => { const [x,y] = Z.list[k].at;
  const p = idx(Math.floor(x/CELL), Math.floor(y/CELL)); lab[p] = i; queue.push(p); });
for (let h = 0; h < queue.length; h++){
  const p = queue[h], cx = p % GW, cy = (p - cx) / GW, me = lab[p];
  const step = (nx, ny) => { if (nx<0||ny<0||nx>=GW||ny>=GH) return;
    const q = idx(nx, ny); if (lab[q] !== -1 || wall[q]) return; lab[q] = me; queue.push(q); };
  step(cx+1,cy); step(cx-1,cy); step(cx,cy+1); step(cx,cy-1);
}

/* ── สีประจำมณฑล — ต่างกันพอให้แยกก้อนออก ไม่ใช่สีฝ่าย ─────────────────── */
const COLOR = { si:'#c9a227', yong:'#d2691e', liang:'#c46b6b', bing:'#8f9fd4', ji:'#6fa8dc',
  you:'#7fbfa0', qing:'#9fd48f', yan:'#d4c48f', xu:'#b58fd4', yu:'#d48fb5',
  jing:'#7fc4c4', yang:'#e0a06a', yi:'#8fd4a8', jiao:'#a89f8f' };

/* ── แปลงตารางเป็นสี่เหลี่ยมแถวยาว (run-length) — ไฟล์เล็กกว่า 1 rect ต่อช่องมาก ─ */
let rects = '';
for (let cy = 0; cy < GH; cy++){
  let run = -1, x0 = 0;
  for (let cx = 0; cx <= GW; cx++){
    const v = cx < GW ? lab[idx(cx, cy)] : -2;
    if (v !== run){
      if (run >= 0) rects += `<rect x="${x0*CELL}" y="${cy*CELL}" width="${(cx-x0)*CELL}" height="${CELL}" fill="${COLOR[keys[run]]||'#999'}"/>`;
      run = v; x0 = cx;
    }
  }
}

const lines = Z.edges.map(e =>
  `<path d="${e.pts.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' ')}" fill="none" stroke="#101418" ` +
  `stroke-width="4" stroke-linejoin="round" stroke-linecap="round"${e.coarse?' stroke-dasharray="14 10"':''}>` +
  `<title>${e.a}|${e.b}${e.coarse?' (แนวหยาบ)':''}</title></path>`).join('');

const names = keys.map(k => { const z = Z.list[k];
  return `<text x="${z.at[0]}" y="${z.at[1]}" text-anchor="middle" font-size="46" font-weight="700" ` +
         `fill="#11151a" stroke="#fff" stroke-width="7" paint-order="stroke" ` +
         `font-family="Leelawadee UI,Segoe UI,Tahoma,sans-serif">${z.label}</text>`; }).join('');

/* เมืองที่ระบุสังกัดแล้ว — จุดที่ *ค้ำ* เส้นอยู่จริง (ไม่เอา chk) */
const dots = Object.entries(P).filter(([,p]) => p.province && !p.chk).map(([id,p]) =>
  `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#11151a" stroke="#fff" stroke-width="2.5">` +
  `<title>${p.label} · ${p.province}</title></circle>`).join('');

const plate = PLATE ? `<image href="../assets/map.jpg" x="0" y="0" width="${W}" height="${H}" opacity=".45"/>` : '';
const html = `<!doctype html><meta charset="utf-8"><title>รูปทรงมณฑลของเรา</title>
<style>body{margin:0;background:#f4f1ea;font:14px/1.5 "Leelawadee UI",system-ui,sans-serif}
h1{font-size:16px;margin:10px 14px 4px}p{margin:0 14px 10px;color:#555}svg{display:block;margin:0 auto;max-width:100%;height:auto}</style>
<h1>รูปทรงมณฑล 14 มณฑล จาก <code>data/zhou_lines.js</code> (${Z.edges.length} เส้น)</h1>
<p>ท่วมสีด้วยกติกาเดียวกับ <code>check_zhou.js</code> · เส้นประ = ติดธง <code>coarse</code> ·
จุดดำ = เมืองที่ระบุสังกัดแล้ว (ไม่นับจุดที่ยัง <code>chk</code>) · <b>ไม่ใช่สีฝ่าย</b> — นี่คือเขตปกครอง</p>
<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
${plate}<g opacity="${PLATE?'.55':'1'}">${rects}</g>${lines}${dots}${names}</svg>`;

const out = path.join(ROOT, 'tools', PLATE ? '_zhou_preview_plate.html' : '_zhou_preview.html');
fs.writeFileSync(out, html);
console.log('เขียนแล้ว: ' + path.relative(ROOT, out) + '  (เปิดผ่าน node tools/serve.js)');
