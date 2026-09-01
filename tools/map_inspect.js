/* map_inspect.js — ซูมดูแผ่นแผนที่ตรงพิกัดที่ระบุ พร้อมเส้นตารางพิกัดจริง
 *
 *   node tools\map_inspect.js 560 455 205 95        ดูกรอบนั้นพร้อมขอบเขต
 *   node tools\map_inspect.js 520 420 300 180 --grid 20
 *
 * ทำไมต้องมี: เวลาต้องวางอะไรทับแผ่น (เช่นกรอบปิดตัวอักษร WEI/SHU/WU) การเดาพิกัด
 * จากภาพย่อทั้งแผ่นไม่มีทางแม่นพอ · เครื่องมือนี้ครอปเฉพาะบริเวณนั้นแล้วขยาย
 * พร้อมตีเส้นตารางพิกัดของ map.jpg จริง ๆ ทับลงไป จะได้อ่านค่าออกมาตรง ๆ
 *
 * ⚠ มันไม่ได้วาดแผนที่ขึ้นมาใหม่ — มันใช้ <image> ชิ้นเดิมกับที่ strategic.js ใช้
 *   แล้วเลื่อน viewBox เท่านั้น (DECISIONS §13)
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const a = process.argv.slice(2).filter(s => !s.startsWith('--'));
const gi = process.argv.indexOf('--grid');
const GRID = gi > -1 ? Number(process.argv[gi+1]) : 25;
const [X, Y, W, H] = a.length >= 4 ? a.map(Number) : [560, 455, 205, 95];
const PAD = Math.round(Math.max(W, H) * 0.45);
const vx = X - PAD, vy = Y - PAD, vw = W + PAD*2, vh = H + PAD*2;

const img = fs.readFileSync(path.join(ROOT, 'assets', 'map.jpg')).toString('base64');

let g = '';
for (let x = Math.ceil(vx/GRID)*GRID; x < vx+vw; x += GRID){
  const major = x % (GRID*4) === 0;
  g += `<line x1="${x}" y1="${vy}" x2="${x}" y2="${vy+vh}" stroke="${major?'#e0245e':'#e0245e55'}" stroke-width="${major?1:0.5}"/>`;
  if (major) g += `<text x="${x+2}" y="${vy+13}" font-size="10" fill="#e0245e">${x}</text>`;
}
for (let y = Math.ceil(vy/GRID)*GRID; y < vy+vh; y += GRID){
  const major = y % (GRID*4) === 0;
  g += `<line x1="${vx}" y1="${y}" x2="${vx+vw}" y2="${y}" stroke="${major?'#e0245e':'#e0245e55'}" stroke-width="${major?1:0.5}"/>`;
  if (major) g += `<text x="${vx+2}" y="${y-2}" font-size="10" fill="#e0245e">${y}</text>`;
}
/* กรอบที่ถูกถาม — เส้นน้ำเงินหนา ไม่ทึบ จะได้เห็นสิ่งที่อยู่ข้างใต้ */
g += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="none" stroke="#1e6fff" stroke-width="2.5"/>`;

fs.writeFileSync(path.join(ROOT, 'tools', '_inspect.html'),
`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>map inspect ${X},${Y} ${W}×${H}</title>
<style>body{margin:0;background:#12151a;color:#dfe4ea;font:13px ui-monospace,monospace}
 .bar{padding:8px 14px;border-bottom:1px solid #2c333d}
 svg{width:100%;height:auto;display:block;image-rendering:pixelated}</style></head><body>
<div class="bar">กรอบน้ำเงิน = <b>${X},${Y}</b> กว้าง ${W} สูง ${H} · เส้นตาราง ${GRID} หน่วย (เส้นหนา = ทุก ${GRID*4})</div>
<svg viewBox="${vx} ${vy} ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">
<image href="data:image/jpeg;base64,${img}" x="0" y="0" width="1650" height="1950"/>
${g}</svg></body></html>`);
console.log(`✔ tools/_inspect.html — กรอบ ${X},${Y} ${W}×${H} · มองเห็น ${vx},${vy} ถึง ${vx+vw},${vy+vh}`);
