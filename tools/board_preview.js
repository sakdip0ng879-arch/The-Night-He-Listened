/* board_preview.js — ส่องกระดานด้วยตา (DECISIONS §13)
 *
 *   node tools\board_preview.js            ปีเปิดเรื่อง 221
 *
 * สร้างไฟล์ HTML ก้อนเดียวที่ฝังทุกอย่างไว้ในตัว (แผนที่พื้นเป็น base64) เพื่อให้เปิดดูได้
 * ทุกที่โดยไม่ต้องรัน server และไม่ติดข้อจำกัดเรื่องสคริปต์ภายนอกของ preview pane
 *
 * ★ มันวาดจาก `fill` ที่ build_geo สร้าง ไม่ได้วาดจากเมล็ดใน geo.js
 *   คือของจริงที่คนอ่านจะเห็น ไม่ใช่ของที่เราตั้งใจให้เป็น
 *   (DECISIONS §13 — ห้ามเขียนเครื่องมือตรวจที่จำลองการเรนเดอร์ขึ้นมาใหม่ · อันนี้ไม่จำลอง
 *    มันอ่าน path เดียวกับที่ strategic.js จะเอาไปวาด)
 *
 * ไม่ใช่ของทดแทน `shot.ps1` — อันนั้นถ่ายแอปจริงพร้อมฉากจริง อันนี้ดูแค่กระดานเปล่า
 * มีไว้ใช้ตอนที่ยังไม่มี timeline.js ให้แอปเดิน
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'geo.js'));
require(path.join(ROOT, 'data', 'geo_fill.js'));

const TK = window.TK, R = TK.regions, P = TK.places, F = TK.factions;
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ★ ฝังแผนที่พื้นเป็น base64 เฉพาะเมื่อสั่ง --embed
   ปกติอ้างแบบ relative ซึ่งเปิดตรง ๆ ในเบราว์เซอร์ได้ปกติและไฟล์เล็กกว่า 15 เท่า
   (ฝังแล้วได้ 787 KB ซึ่งใหญ่เกินกว่าที่ preview pane บางตัวจะเปิดให้) */
const EMBED = process.argv.includes('--embed');
const imgSrc = EMBED
  ? 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'map.jpg')).toString('base64')
  : '../assets/map.jpg';

let g = '';

/* ชั้นเขต — ระบายตามเจ้าของปี 221 */
for (const k in R){
  const r = R[k];
  g += `<path d="${r.fill || r.d}" fill="${F[r.owner].color}" fill-opacity=".46" `
     + `stroke="${F[r.owner].color}" stroke-width="2"><title>${esc(r.label)} — ${esc(F[r.owner].label)} `
     + `· pop ${r.pop} · troops ${r.troops}</title></path>`;
}

/* ชั้นปิดทับตัวอักษร WEI / SHU / WU ที่พิมพ์มากับแผ่น (DECISIONS §3) */
g += '<rect x="560" y="455" width="205" height="95" fill="#eef1f4" opacity=".92"/>'
   + '<rect x="262" y="1195" width="215" height="95" fill="#eef1f4" opacity=".92"/>'
   + '<rect x="1175" y="1450" width="180" height="95" fill="#eef1f4" opacity=".92"/>';

/* ชั้นหมุด — เหลือง = พิกัดยังไม่สอบเทียบ (chk:true) */
for (const k in P){
  const p = P[k];
  g += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${p.chk ? '#f0c674' : '#111'}" `
     + `stroke="#fff" stroke-width="1.5"><title>${esc(k)} (${p.x},${p.y})${p.chk ? ' · ยังไม่สอบเทียบ' : ''}</title></circle>`
     + `<text x="${p.x + 8}" y="${p.y - 6}" font-size="12" fill="#fff" stroke="#000" `
     + `stroke-width="3" paint-order="stroke">${esc(p.label)}</text>`;
}

/* ชั้นชื่อเขต — วาดท้ายสุดเพื่อให้อยู่บนสุด */
for (const k in R){
  const r = R[k]; if (!r.labelAt) continue;
  g += `<text x="${r.labelAt[0]}" y="${r.labelAt[1]}" font-size="21" font-weight="700" `
     + `fill="#fff" stroke="#000" stroke-width="4.5" paint-order="stroke" text-anchor="middle">${esc(r.label)}</text>`;
}

const tally = {};
for (const k in R){ const r = R[k];
  (tally[r.owner] = tally[r.owner] || {n:0,pop:0,tr:0});
  tally[r.owner].n++; tally[r.owner].pop += r.pop; tally[r.owner].tr += r.troops; }
const legend = ['han','wei','wu'].map(s =>
  `<span style="color:${F[s].text}">■ ${F[s].label} — ${tally[s].n} เขต · `
  + `${tally[s].pop.toFixed(2)} ล้านคน · ${tally[s].tr.toFixed(1)} หมื่นทหาร</span>`).join('　');

const chk = Object.keys(P).filter(k => P[k].chk);

fs.writeFileSync(path.join(ROOT, 'tools', '_board221.html'),
`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>กระดานปี 221</title>
<style>body{margin:0;background:#12151a;color:#dfe4ea;font:14px/1.7 system-ui,sans-serif}
 .bar{padding:10px 16px;border-bottom:1px solid #2c333d}
 .note{padding:8px 16px;color:#f0c674;font-size:13px}
 svg{width:100%;height:auto;display:block}</style></head><body>
<div class="bar">${legend}</div>
<div class="note">● จุดเหลือง = พิกัดยังไม่สอบเทียบ ${chk.length} จุด: ${chk.join(', ')}</div>
<svg viewBox="0 0 1650 1950" xmlns="http://www.w3.org/2000/svg">
<image href="${imgSrc}" width="1650" height="1950"
       style="filter:saturate(.3) brightness(1.12) contrast(.92)"/>
${g}</svg></body></html>`);

console.log('✔ เขียน tools/_board221.html ' + (EMBED ? '(ฝังแผนที่)' : '(อ้างแผนที่แบบ relative — ใส่ --embed ถ้าอยากได้ไฟล์เดี่ยว)') + ' — ' + Object.keys(R).length + ' เขต · ' +
            Object.keys(P).length + ' หมุด · ยังไม่สอบเทียบ ' + chk.length + ' จุด');
