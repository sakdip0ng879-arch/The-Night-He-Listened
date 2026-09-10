/* ขอบที่ติดกรอบแผนที่ต้องไม่ถูกการเกลามุมตัดเป็นลิ่มว่าง */
const assert=require('node:assert/strict');
global.window=global;
require('../data/geo.js');
require('../data/geo_fill.js');
let checked=0;
for(const arc of TK.regionArcs.filter(a=>a.t==='edge')){
  const pts=[...arc.d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m=>[+m[1],+m[2]]);
  for(let i=1;i<pts.length;i++){
    const [a,b]=[pts[i-1],pts[i]];
    assert((a[0]===b[0]&&(a[0]===0||a[0]===1650))||(a[1]===b[1]&&(a[1]===0||a[1]===1950)),`${arc.a}: edge cuts into map at ${a} → ${b}`);
    checked++;
  }
}
assert(checked>0);
assert(Object.values(TK.regionsFill).some(d=>d.includes('0,1950')),'southwest corner lost');
console.log(`Map frame: ${checked} segments stay on frame; southwest corner preserved.`);
