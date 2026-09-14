/* georef.js — assets/map.jpg มี projection ที่สม่ำเสมอพอจะวาร์ปภูมิประเทศจริงลงไปไหม
 *
 *   node tools/georef.js
 *
 * ★ นี่คือการทดลองที่ปิดคำถามเรื่อง "แผนที่ 3 มิติ / relief จริง" เมื่อ 2026-08-22
 *   คำถามคือ: ถ้าเอา DEM จริง (SRTM) มาวาร์ปลงบนแผ่นนี้ ภูเขาจะไปตกตรงที่แผ่นวาดไว้ไหม
 *   วิธี: หยิบเมืองที่ระบุตำแหน่งสมัยใหม่ได้แน่นอน 28 แห่ง เทียบ lon/lat จริงกับพิกัดพิกเซล
 *        แล้ว fit สองแบบ ดู residual — และกันไว้สี่จุดไม่ให้เข้า fit เพื่อวัดการทำนาย
 *   ผล: RMS 48px ทั้งแผ่น = ~60 กม. · quadratic ทำให้ fit ดีขึ้นแต่ทำนายแย่ลง (overfit)
 *        แม้แยก fit เป็นโซนก็ยังเหลือ 30-34px = 38-43 กม. ซึ่งกว้างกว่าหุบเขาที่เรื่องนี้เล่าถึง
 *   สรุป: **ไม่ได้** แผ่นนี้วาดด้วยมือ ไม่มี projection ที่คงเส้นคงวาให้ยึด
 *        ถ้าวาร์ปลงไป ภูเขาจะไปอยู่ผิดหุบ ซึ่งคือความผิดพลาดชนิดเดียวกับที่ฆ่าโหมดสมรภูมิ
 *   รันซ้ำได้ถ้าวันหนึ่งเปลี่ยนแผนที่ฐาน — ตัวเลขจะบอกเองว่าแผ่นใหม่ใช้ได้หรือไม่
 */

/* พาธในรีโปนี้ — เดิมเป็นพาธเต็มบนเครื่องเจ้าของ (ชี้ places.js ของโปรเจกต์ 1)
   ⚠ repo เป็น public + GitHub Pages เสิร์ฟทุกไฟล์ ห้ามใส่พาธเครื่องลงไฟล์ที่ track (LOG §5.39) */
const path=require('path').join(__dirname,'..','data','places.js');
global.window=global; require(path);
const P=window.TK.places;

/* id -> [lon, lat] of the modern city on the Han-era site.
   Only sites whose identification is not in dispute. Frontier posts are held out. */
const GT = {
  chengdu:[104.06,30.66], changan:[108.93,34.27], luoyang:[112.45,34.62],
  xuchang:[113.85,34.03], jianye:[118.80,32.06],  yecheng:[114.62,36.33],
  wuchang:[114.89,30.40], hanzhong:[107.02,33.07], baidi:[109.53,31.05],
  jiangling:[112.19,30.35], xiangyang:[112.12,32.01], fancheng:[112.14,32.05],
  wancheng:[112.53,33.00], shouchun:[116.79,32.58], hefei:[117.23,31.82],
  chencang:[107.14,34.36], wuwei:[102.64,37.93],  zhangye:[100.45,38.93],
  xiangping:[123.17,41.27], fanyang:[115.97,39.49], guandu:[114.02,34.72],
  chenliu:[114.31,34.80], jiangxia:[114.30,30.60], xiling:[111.29,30.69],
  jiangzhou:[106.55,29.56], puban:[110.45,34.87], tongguan:[110.25,34.55],
  shangbang:[105.72,34.58]
};
const HOLDOUT = ['tongguan','shangbang','jiangzhou','fanyang'];  /* ไม่เอาเข้า fit */

const rows=[];
for(const [id,[lon,lat]] of Object.entries(GT)){
  const p=P[id]; if(!p){ console.log('!! no place '+id); continue; }
  rows.push({id, lon, lat, u:lon-110, v:lat-33, x:p.x, y:p.y, hold:HOLDOUT.includes(id)});
}
const fitRows = rows.filter(r=>!r.hold);

/* ── least squares via normal equations + gaussian elimination ── */
function solve(A,b){
  const n=A.length, M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){
    let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    [M[c],M[p]]=[M[p],M[c]];
    if(Math.abs(M[c][c])<1e-12) return null;
    for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]/M[c][c];
      for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; }
  }
  return M.map((r,i)=>r[n]/r[i]);
}
function lsq(basis, target){
  const B=fitRows.map(basis), m=B[0].length;
  const A=Array.from({length:m},()=>Array(m).fill(0)), v=Array(m).fill(0);
  B.forEach((bi,i)=>{ const t=target(fitRows[i]);
    for(let a=0;a<m;a++){ v[a]+=bi[a]*t; for(let c=0;c<m;c++) A[a][c]+=bi[a]*bi[c]; } });
  return solve(A,v);
}
const dot=(c,b)=>c.reduce((s,ci,i)=>s+ci*b[i],0);

const MODELS = {
  affine:    r=>[r.u, r.v, 1],
  quadratic: r=>[r.u, r.v, r.u*r.u, r.v*r.v, r.u*r.v, 1]
};

for(const [name,basis] of Object.entries(MODELS)){
  const cx=lsq(basis,r=>r.x), cy=lsq(basis,r=>r.y);
  if(!cx||!cy){ console.log(name+': singular'); continue; }
  const res=rows.map(r=>{
    const b=basis(r);
    const dx=dot(cx,b)-r.x, dy=dot(cy,b)-r.y;
    return {id:r.id, hold:r.hold, d:Math.hypot(dx,dy), dx, dy};
  });
  const inFit=res.filter(r=>!r.hold), held=res.filter(r=>r.hold);
  const rms=a=>Math.sqrt(a.reduce((s,r)=>s+r.d*r.d,0)/a.length);
  console.log('\n══ '+name.toUpperCase()+' ══');
  console.log('  fit points  n='+inFit.length+'  RMS '+rms(inFit).toFixed(1)+'px  max '+
              Math.max(...inFit.map(r=>r.d)).toFixed(1)+'px');
  console.log('  held out    n='+held.length+'  RMS '+rms(held).toFixed(1)+'px  max '+
              Math.max(...held.map(r=>r.d)).toFixed(1)+'px');
  console.log('  worst offenders:');
  res.sort((a,b)=>b.d-a.d).slice(0,7).forEach(r=>
    console.log('    '+(r.hold?'(held) ':'       ')+r.id.padEnd(11)+r.d.toFixed(1).padStart(6)+'px  '+
                'dx '+r.dx.toFixed(0).padStart(5)+'  dy '+r.dy.toFixed(0).padStart(5)));
}

/* สเกลของแผ่น: กี่พิกเซลต่อองศา — ใช้แปลง residual เป็นกิโลเมตร */
const cx=lsq(MODELS.affine,r=>r.x), cy=lsq(MODELS.affine,r=>r.y);
console.log('\nscale from the affine fit:');
console.log('  '+Math.abs(cx[0]).toFixed(1)+' px per degree of longitude');
console.log('  '+Math.abs(cy[1]).toFixed(1)+' px per degree of latitude');
console.log('  1 px ≈ '+(111*Math.cos(33*Math.PI/180)/Math.abs(cx[0])).toFixed(1)+' km east-west, '+
            (111/Math.abs(cy[1])).toFixed(1)+' km north-south');
console.log('  shear/rotation terms: dx/dlat '+cx[1].toFixed(2)+'  dy/dlon '+cy[0].toFixed(2));

/* ── ทดสอบเพิ่ม: fit เฉพาะโซน แทนที่จะ fit ทั้งแผ่น ──
   ถ้าแผ่นนี้ "ผิดแบบสม่ำเสมอในแต่ละพื้นที่" การวาร์ปแยกโซนก็ยังพอไหว */
console.log('\n══ LOCAL AFFINE FITS (fit each zone only to its own points) ══');
const ZONES = {
  'core (Guanzhong–Luoyang–Xuchang)': r=>r.lon>=105&&r.lon<=115&&r.lat>=32&&r.lat<=37,
  'Han river + Jing':                 r=>r.lon>=106&&r.lon<=116&&r.lat>=29&&r.lat<=34,
  'east (Huai–Yangzi)':               r=>r.lon>=113&&r.lat>=29&&r.lat<=36
};
function localFit(pred){
  const pts=rows.filter(pred);
  if(pts.length<4) return null;
  const basis=r=>[r.u,r.v,1];
  const B=pts.map(basis), m=3;
  const mk=(t)=>{ const A=Array.from({length:m},()=>Array(m).fill(0)), v=Array(m).fill(0);
    B.forEach((bi,i)=>{ const tv=t(pts[i]);
      for(let a=0;a<m;a++){ v[a]+=bi[a]*tv; for(let c=0;c<m;c++) A[a][c]+=bi[a]*bi[c]; } });
    return solve(A,v); };
  const cx=mk(r=>r.x), cy=mk(r=>r.y);
  if(!cx||!cy) return null;
  const res=pts.map(r=>{const b=basis(r);
    return {id:r.id, d:Math.hypot(dot(cx,b)-r.x, dot(cy,b)-r.y)};});
  return {n:pts.length, rms:Math.sqrt(res.reduce((s,r)=>s+r.d*r.d,0)/res.length),
          max:Math.max(...res.map(r=>r.d)),
          worst:res.sort((a,b)=>b.d-a.d)[0]};
}
for(const [name,pred] of Object.entries(ZONES)){
  const f=localFit(pred);
  console.log('  '+name.padEnd(34)+(f? 'n='+String(f.n).padStart(2)+'  RMS '+f.rms.toFixed(1).padStart(5)+
    'px ('+(f.rms*1.25).toFixed(0).padStart(3)+' km)  max '+f.max.toFixed(0).padStart(3)+'px  worst='+f.worst.id
    : 'too few points'));
}
