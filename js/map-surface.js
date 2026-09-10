/* map-surface.js — ชั้นพื้นนิ่ง (กระดาษ + ป่า + สีเขต + เงาเขา) วาดลง canvas ครั้งเดียว
   แล้วให้ GPU เลื่อน/ย่อขยายแทนการวาด SVG ใหม่ทุกเฟรม
   แหล่งเจ้าของพื้นที่ยังเป็น `#L-regions` เดิม; ใช้ `?renderer=svg` เพื่อเทียบ/สำรอง

   ═══ ★★★ ทำไม canvas อยู่ **นอก** SVG (แก้ 2026-09-10) ═══════════════════════
   เจ้าของทัก: *"บางฉากมันให้ตัวหนังสือเบลอ ๆ เหมือนขึ้นกับการซูม อันนี้ขัดใจมาก"*

   ★ ของเดิมห่อ canvas ไว้ใน `<foreignObject>` ที่อยู่ *ข้างใน* `#tkmap`
     **พอมี `foreignObject` อยู่ในซับทรี Chrome เลิกวาด SVG ทั้งก้อนแบบเวกเตอร์**
     มันแรสเตอร์ทั้งชั้นที่ความละเอียดหนึ่งแล้วค่อยสเกล → *ทุกอย่าง* ในนั้นเบลอตามซูม
     ไม่ใช่แค่ภาพพื้น แต่รวม **ตัวหนังสือกับไอคอนเมือง** ด้วย

   ★ พิสูจน์ด้วยการคุมตัวแปร (2026-09-10): ตรึง `viewBox` ไว้ที่ `456.8 600 626.4 190`
     แล้วถอด `foreignObject` ออกอย่างเดียว ไม่แตะอย่างอื่นเลย
     → ชื่อ "ฉางอาน · หงหนง · หลานเถียน · โจวจื่อ · ฝูเฟิง · หัวยิน" **คมขึ้นทันที**
     พร้อมไอคอนเมืองทั้งชุด · ใส่กลับ → เบลอเหมือนเดิม

   ⚠⚠ **ห้ามแก้ด้วยการปิด canvas ทิ้ง** — ตัวเลขของฝั่ง Codex บอกว่ามันคือของจริง:
     ลากแผนที่ median **116–150 ms/เฟรม (≈7 fps) → 16.7 ms (60 fps)** · `over50` 29–31 → 0
     (`docs/ui-review-2026-09-09/performance-baseline.json` เทียบ `performance-final.json`)
   ⇒ ที่ถูกคือ **เอา canvas ออกไปเป็น DOM ธรรมดาใต้ SVG** แล้วขยับด้วย CSS transform
     ได้ทั้งความเร็วของ raster และความคมของเวกเตอร์ — ไม่ต้องเลือกอย่างใดอย่างหนึ่ง

   ⚠ `#L-map-surface` **ยังเป็น id เดิม** และยังมี canvas สองใบเรียงเหมือนเดิม
     (ใบแรก = ภาพปัจจุบัน · ใบสอง = ภาพเก่าไว้เฟด) เพราะ `tools/audit_ui.js` เล็ง
     `#L-map-surface canvas` กับ `[1]` อยู่ · เปลี่ยนโครงเมื่อไหร่ต้องแก้ตัวตรวจด้วย

   ⚠ CSS ที่คู่กัน: `#stage.art-on.map-surface-ready` ซ่อน `#L-plate`/`#L-relief`/environment
     และตั้ง `#L-regions{opacity:0}` (คงไว้ใน DOM เพราะที่นี่อ่านสีจากมัน และ `isPointInFill`
     ยังต้องใช้) · `#stage:not(.art-on) #L-map-surface{display:none}` = สลับกลับแผ่นต้นฉบับได้ */
window.TKMapSurface={

 /* เรียกจาก strategic.js ทุกครั้งที่กล้องขยับ (ทั้งช่วง preview และตอน commit)
    ★ คำนวณแบบเดียวกับที่ SVG แปลง `viewBox` → จอ ด้วย `preserveAspectRatio="xMidYMid meet"`
      s  = min(กว้างจอ/vb.w , สูงจอ/vb.h)
      tx = (กว้างจอ − vb.w·s)/2 − vb.x·s      (พจน์แรกคือการจัดกึ่งกลางของ meet)
    ⚠ ต้องใช้ `vb` ที่ *อยากเห็น* ไม่ใช่ค่าที่เขียนอยู่บน `<svg>` — ระหว่างลาก สองอันนี้
      ต่างกัน (strategic.js ขยับ `#L-cam` ด้วย transform ก่อน แล้วค่อย commit ทีหลัง) */
 sync(vb){
  const host=this._host; if(!host||!vb)return;
  const stage=document.getElementById('stage');
  const Wpx=stage.clientWidth, Hpx=stage.clientHeight;
  if(!Wpx||!Hpx)return;
  const s=Math.min(Wpx/vb.w, Hpx/vb.h);
  const tx=(Wpx-vb.w*s)/2 - vb.x*s, ty=(Hpx-vb.h*s)/2 - vb.y*s;
  /* ★ `translate3d` ไม่ใช่ `translate` — บังคับให้ compositor ยกเป็นชั้น GPU
     ไม่งั้นการขยับ canvas 1650×1950 กลายเป็นการ repaint ทุกเฟรม (วัดแล้วต่างกันจริง) */
  host.style.transform=`translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${s.toFixed(5)})`;
 },

 mount:async function(cam,layers){
 const W=1650,H=1950;
 const load=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(Error('Cannot load '+src));im.src=src;});
 const [env,relief]=await Promise.all(['environment','relief'].map(n=>load('assets/map-art/cache/'+n+'.png')));
 const stage=document.getElementById('stage');
 /* ★ กล่องนอกอยู่ใน `#stage` **ก่อน** `#tkmap` → วาดอยู่ใต้ SVG โดยไม่ต้องใช้ z-index
    ขนาดเป็นหน่วยแผ่นตรง ๆ (1650×1950 px) แล้วให้ transform เป็นตัวย่อขยาย */
 const stack=document.createElement('div');
 stack.id='L-map-surface';
 stack.style.cssText='position:absolute;left:0;top:0;width:1650px;height:1950px;'+
                     'transform-origin:0 0;pointer-events:none';
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 canvas.style.cssText='position:absolute;inset:0;width:1650px;height:1950px;display:block';
 stack.append(canvas);
 const previous=document.createElement('canvas');previous.width=W;previous.height=H;
 previous.style.cssText='position:absolute;inset:0;width:1650px;height:1950px;pointer-events:none;opacity:0;will-change:opacity';
 stack.append(previous);const pc=previous.getContext('2d');let fading=null;
 const ctx=canvas.getContext('2d'),regions=document.createElement('canvas');regions.width=W;regions.height=H;const rc=regions.getContext('2d');
 if(!ctx||!rc)throw Error('Canvas unavailable');
 const paths=[...layers.regions.querySelectorAll('path.region')].map(el=>({el,path:new Path2D(el.getAttribute('d'))}));
 /* ⚠ ต้องอ่าน **ก่อน** ติดคลาส `map-surface-ready` — พอติดแล้ว CSS ตั้ง `#L-regions{opacity:0}`
    (ชั้นนั้นถูกเก็บไว้ให้ `isPointInFill` กับที่นี่อ่านสี ไม่ได้ให้มองเห็น)
    ถ้าอ่านทีหลังจะได้ 0 แล้วสีเขตหายทั้งแผ่นเงียบ ๆ — ลำดับสองบรรทัดนี้ห้ามสลับ */
 const opacity=Number(getComputedStyle(layers.regions).opacity);
 const grain=document.createElement('canvas');grain.width=7;grain.height=9;
 const gc=grain.getContext('2d');gc.fillStyle='rgba(128,108,68,.08)';gc.beginPath();gc.arc(1,2,.4,0,Math.PI*2);gc.fill();gc.strokeStyle='rgba(255,248,230,.28)';gc.lineWidth=.6;gc.beginPath();gc.moveTo(4,5);gc.lineTo(5,5);gc.stroke();
 const paper=ctx.createPattern(grain,'repeat');
 const draw=()=>{
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#f0e9d6';ctx.fillRect(0,0,W,H);
   ctx.fillStyle=paper;ctx.fillRect(0,0,W,H);ctx.globalAlpha=.82;ctx.drawImage(env,0,0,W,H);ctx.globalAlpha=1;
   rc.clearRect(0,0,W,H);rc.lineJoin='round';rc.lineWidth=1.5;
   for(const {el,path} of paths){rc.fillStyle=el.getAttribute('fill');rc.strokeStyle=el.getAttribute('stroke');rc.fill(path);rc.stroke(path);}
   // opacity ทั้งกลุ่ม ปิดรอยต่อด้วย stroke เดิม ไม่ทา alpha ซ้ำรายเขต
   ctx.globalAlpha=opacity;ctx.drawImage(regions,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='multiply';ctx.drawImage(relief,0,0,W,H);ctx.globalCompositeOperation='source-over';
   canvas.dataset.owners=JSON.stringify(paths.map(({el})=>[el.dataset.id,el.getAttribute('fill')]));
 };
 draw();
 this._host=stack;
 stage.insertBefore(stack,document.getElementById('tkmap'));
 stage.classList.add('map-surface-ready');
 // วาดภาพสีใหม่ครั้งเดียวหลัง engine ปล่อยเจ้าของพื้นที่ แล้วเฟดภาพเก่าบน compositor
 // Observer รวมการแก้หลายเขตในคำสั่งเดียวอยู่แล้ว; วาดก่อนเฟรมถัดไป ป้องกันสีค้างเมื่อ scrub เร็ว
 const finish=()=>{if(fading)fading.cancel();fading=null;previous.style.opacity='0';};
 layers.regions.addEventListener('ownershipreset',finish);
 const update=()=>{
   const fade=layers.regions.dataset.fade!=='false'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(fade){
     // หากเปลี่ยนฉากกลางเฟด เก็บภาพที่ตาเห็นจริงเป็นจุดเริ่ม ไม่กระโดดกลับสีเก่า
     if(fading){const mix=document.createElement('canvas');mix.width=W;mix.height=H;const mc=mix.getContext('2d');mc.drawImage(canvas,0,0);mc.globalAlpha=Number(getComputedStyle(previous).opacity);mc.drawImage(previous,0,0);pc.clearRect(0,0,W,H);pc.drawImage(mix,0,0);}
     else{pc.clearRect(0,0,W,H);pc.drawImage(canvas,0,0);}
   }
   finish();draw();
   if(fade){fading=previous.animate([{opacity:1},{opacity:0}],{duration:700,easing:'ease-in-out'});const current=fading;current.onfinish=()=>{if(fading===current)finish();};}
 };
 new MutationObserver(update).observe(layers.regions,{subtree:true,attributes:true,attributeFilter:['fill','stroke']});
}};
