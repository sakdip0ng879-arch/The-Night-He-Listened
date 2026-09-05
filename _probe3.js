/* ตรวจสามจุดที่เจ้าของทัก: หมึกของแผ่นมีน้ำไหม · เราเก็บไว้หรือทิ้ง · ทิ้งเพราะอะไร */
const B = require('./tools/build_plate_water.js');
const path = require('path');
const { W, H, m } = B.readRle('tools/_plate_water.rle');
const D = B.dt(W, H, m);
const { open, thin } = B.splitOpen(W, H, m, D);
const O = B.components(W, H, open);   B.classifyOpen(W, H, O.comps);
const T = B.components(W, H, thin);   B.classifyThin(W, H, T.comps, D);

const spots = [['ไป๋ตี้ (Bai Di)',721,976], ['ผูปั้น (Puban)',740,559], ['เว่ยหนาน (Weinan)',686,622],
               ['เฉิงตู',267,987], ['เจียงโจว',416,1121]];
const label = new Int32Array(W*H).fill(0);
const kindOf = new Map();
for (const c of O.comps) { for (const p of c.px) label[p] = c.id; kindOf.set('O'+c.id, c.kind); }
const label2 = new Int32Array(W*H).fill(0);
for (const c of T.comps) { for (const p of c.px) label2[p] = c.id; kindOf.set('T'+c.id, c.kind); }
const byId = new Map(); for (const c of T.comps) byId.set(c.id, c);

for (const [name, x, y] of spots){
  const found = new Map();
  for (let dy=-40; dy<=40; dy++) for (let dx=-40; dx<=40; dx++){
    const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue;
    const i=ny*W+nx; if(!m[i]) continue;
    const k = label[i] ? 'O'+label[i] : (label2[i] ? 'T'+label2[i] : '?');
    found.set(k, (found.get(k)||0)+1);
  }
  const parts = [...found.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,n])=>{
    const kind = kindOf.get(k) || '?';
    let extra = '';
    if (k[0]==='T'){ const c = byId.get(+k.slice(1)); if (c) extra = ` [${c.n}px ${c.w}x${c.h} fill ${c.fill.toFixed(2)} maxD ${c.maxD.toFixed(1)}]`; }
    return `${kind}(${n}px)${extra}`;
  });
  console.log(name.padEnd(18)+' รอบ 40 หน่วย: '+(parts.length?parts.join(' · '):'ไม่มีหมึกน้ำเลย'));
}
