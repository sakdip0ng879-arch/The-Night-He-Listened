/* check_camera.js — ตรวจว่ากล้องของแต่ละฉาก "เห็นสิ่งที่ฉากนั้นชี้ให้ดู" จริงไหม
 *
 *   node tools\check_camera.js          เฉพาะที่มีปัญหา
 *   node tools\check_camera.js --all    ทุกฉากพร้อมระยะขอบที่เหลือ
 *
 * ปัญหาที่ตัวนี้จับ: ฉากปักหมุดไว้ แต่หมุดอยู่นอกกรอบกล้อง คนอ่านเลยเห็นแผนที่ซูมเข้า
 * ไปที่อะไรก็ไม่รู้ และป้ายทองไปเกาะขอบจอ (เช่น c5-02 บอกเองในคอมเมนต์ว่า "เฉิงตูกับ
 * เตียงอานต้องอยู่ในเฟรมพร้อมกัน" แต่กรอบที่เขียนไว้สูงถึง y=878 ส่วนเฉิงตูอยู่ y=987)
 *
 * สองระดับ เพราะ fitBox ขยายกรอบให้พอดีสัดส่วนจอ ซึ่งแปลว่าบางหมุดจะ "ติดขอบมาได้"
 * เฉพาะบนจอบางขนาด:
 *   ✖ error — อยู่นอกกรอบแม้หลัง fitBox ที่สัดส่วนจอปกติ = มองไม่เห็นแน่นอน
 *   ⚠ warn  — อยู่ในกรอบหลัง fit แต่นอกกรอบที่เขียนไว้ = เห็นเพราะโชคของขนาดหน้าต่าง
 *              ย่อหน้าต่างเมื่อไหร่ก็หาย (บทเรียนเดียวกับ c4-01 ใน PROGRESS)
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'roads.js'));   /* ★ roads.js สร้าง TK.routes ให้ในรูปแบบเดิม (DECISIONS §4) */
require(path.join(ROOT, 'data', 'timeline.js'));

const TK = window.TK, T = TK.timeline;
const W = 1650, H = 1950;

/* สัดส่วนกล่องแผนที่บนจอเดสก์ท็อปปกติ — หน้าต่าง 1904x980 หักคอลัมน์นิยาย 400
   และแถบเวลาราว 86 → 1504 x 894 (ค่าเดียวกับที่ tools\shot.ps1 ใช้ถ่ายภาพ) */
const AR = 894 / 1504;

/* ต้องเหมือน strategic.js fitBox() ทุกบรรทัด */
function fitBox(x0, y0, w0, h0){
  h0 = h0 || w0 * AR;
  const cx = x0 + w0/2, cy = y0 + h0/2;
  let w, h;
  if (h0 / w0 > AR) { h = h0; w = h0 / AR; }
  else              { w = w0; h = w0 * AR; }
  if (w > W){ w = W; h = w * AR; }
  if (h > H){ h = H; w = h / AR; }
  return { w, h,
    x: Math.max(0, Math.min(W - w, cx - w/2)),
    y: Math.max(0, Math.min(H - h, cy - h/2)) };
}

const outside = (p, b) =>
  Math.max(b.x - p[0], p[0] - (b.x + b.w), b.y - p[1], p[1] - (b.y + b.h));

/* ★ พื้นความกว้างของกล้อง — เพิ่ม 2026-08-22
   เจ้าของชี้ว่าเส้นทางในโปรเจกต์พี่น้อง (เรื่องกวนอู) อ่านดีกว่า และวัดแล้วสาเหตุไม่ได้อยู่
   ที่โค้ด: ไฟล์ strategic.js ของสองเล่มวาดเส้นด้วยบรรทัดเดียวกัน (หนา 4 พิกเซลจอคงที่)
   ต่างกันที่ "วินัยของกล้อง" ล้วน ๆ —
     เรื่องกวนอู  130 ฉาก · แคบสุด 560 · มัธยฐาน 601
     เรื่องบุกเหนือ 101 ฉาก · แคบสุด 340 · มัธยฐาน 572 · 46 ฉากแคบกว่า 560
   ยิ่งซูมเข้า ภาพแผนที่พื้นยิ่งถูกขยายตาม ตัวหนังสือของมันโตขึ้น แต่เส้น 4px ไม่โต
   เส้นจึงดูบางลงเรื่อย ๆ เทียบกับทุกอย่างรอบตัว และคนอ่านก็เสียบริบทรอบข้างไปด้วย
   เตือนอย่างเดียว ไม่ error — ฉากแคบบางอันตั้งใจ (สมรภูมิที่เกิดในพื้นที่แปดสิบลี้)
   แต่ควรเป็นการตัดสินใจ ไม่ใช่ความบังเอิญ */
const CAM_FLOOR = 560;

/* ปลายทางของลูกศร = จุดที่ token ไปหยุด — เหมือน routeEnd() ใน strategic.js
   mid = จุดกลางเส้นทางโดยประมาณ ซึ่งเป็นที่ที่ป้ายธง (mk-chip) ไปเกาะ
   ประมาณจากจุดกลางของรายการพิกัดใน d — ไม่ต้องคำนวณเบซิเยร์จริงก็พอจับได้ว่า
   เส้นทั้งเส้นวิ่งออกนอกกรอบไหม (เจอมาแล้วที่ c4-04: หัวลูกศรอยู่ในกรอบ แต่ตัวเส้น
   โค้งขึ้นเหนือจนป้าย "Guo Huai's tribal horse" ไปอยู่นอกจอ = ลูกศรมีชื่อที่อ่านไม่ได้) */
function routeEnds(name){
  const rt = TK.routes[name]; if (!rt) return null;
  const n = rt.d.match(/-?[\d.]+/g).map(Number);
  const pairs = [];
  for (let i = 0; i + 1 < n.length; i += 2) pairs.push([n[i], n[i+1]]);
  return { start:pairs[0], end:pairs[pairs.length-1],
           mid: pairs[Math.floor(pairs.length / 2)] };
}

const errs = [], warns = [], tight = [], lines = [];

for (const b of T){
  if (!b.camera) continue;
  const [cx, cy, cw, ch] = b.camera;
  const req = { x:cx, y:cy, w:cw, h:ch || cw * AR };
  const fit = fitBox(cx, cy, cw, ch);
  /* ทั้งแผ่นดินไม่ต้องตรวจ อะไรก็อยู่ในกรอบ */
  if (cw >= W * 0.95) continue;

  if (fit.w < CAM_FLOOR)
    tight.push(`${b.id} ${b.year}: camera frames ${Math.round(fit.w)} units wide, ` +
               `under the ${CAM_FLOOR} floor — routes read thin and the reader loses the ground around them`);

  const pts = [];
  const tails = [];
  const caps = [];
  for (const m of (b.markers || [])){
    if (m.place && TK.places[m.place])
      pts.push([[TK.places[m.place].x, TK.places[m.place].y], `${m.type} ${m.place}`]);
    /* ★ คำบรรยายหมุด (mk-cap) — เพิ่ม 2026-08-22
       หมุดอยู่ในกรอบไม่ได้แปลว่าข้อความของมันอยู่ด้วย ข้อความวางกึ่งกลางบนหมุด
       และ layoutAnnotations() ไม่ได้บีบให้อยู่ในกรอบ มันหลบแค่หมุด/วง/หน่วยอื่น
       หมุดที่ห่างขอบ 14 หน่วยกับคำบรรยายกว้าง 60 หน่วย = ครึ่งประโยคหลุดจอ
       เจอสามฉากรวดตอนเขียนรอบ story-v4 (c5-01b, c5-02d, c5-02f) โดยที่ตัวตรวจนี้
       บอกว่าผ่านหมด — หมุดอยู่ในกรอบทั้งสามอันจริง ๆ */
    if (m.type === 'pin' && m.label && TK.places[m.place])
      caps.push([TK.places[m.place], m.label, m.place]);
    if (m.route){
      const r = routeEnds(m.route); if (!r) continue;
      /* หัวลูกศรคือปลายที่ token ไปหยุด — reverse สลับหัวกับหาง */
      pts.push([m.reverse ? r.start : r.end, `arrow head ${m.route}`]);
      /* ★★ หางลูกศร — เพิ่ม 2026-08-31 (เจ้าของทักว่าบทที่ 10 สามฉาก "เห็นไม่หมด")
         ตัวตรวจนี้ดูแต่ *หัว* กับ *กลาง* มาตลอด จึงรายงานเขียวทั้งที่ c10-04/06/08
         ตัดต้นทางทิ้งหมด: ลูกศรโผล่จากมุมจอโดยไม่มีเมืองต้นทางให้เห็น คนอ่านจึง
         อ่านไม่ได้ว่า "สองหมื่นห้าเดินจากตะวันตกมาตะวันออก" นั้นออกมาจากที่ไหน
         หางคือครึ่งหนึ่งของประโยค "จาก A ไป B" — ตัดหางทิ้งคือตัดคำว่า "จาก" ทิ้ง */
      tails.push([m.reverse ? r.end : r.start, `arrow tail ${m.route}`]);
      /* ลูกศรที่มีชื่อต้องเห็นชื่อด้วย ไม่ใช่เห็นแค่หัว */
      if (m.who || m.name)
        pts.push([r.mid, `banner chip on ${m.route}`]);
    }
  }
  /* ประมาณความกว้างข้อความจาก .mk-label (16px หนา) โดยไม่มี canvas ให้วัด —
     0.56 เท่าของขนาดตัวอักษรต่อหนึ่งอักขระ วัดจากคำบรรยายจริงในเล่มแล้วเผื่อไว้ทางแคบ
     ระยะยก 47px = รัศมีหมุด 15 + ระยะห่าง 14 + ครึ่งความสูงป้าย 10 + ขอบ 3
     (ช่องแรกใน SLOTS ของ layoutAnnotations คือ [0,-1] เหนือหมุดพอดี)

     แนวนอนกับแนวตั้งไม่เท่ากัน และนี่คือเหตุผลที่แยกระดับ:
       · ล้นด้านข้าง = แก้ไม่ได้ ข้อความวางกึ่งกลางหมุดเสมอ และช่อง [±1,0] ยิ่งดันออกไปอีก
       · ล้นบน/ล่าง = ยังพลิกไปอีกฝั่งของหมุดได้ ถ้าฝั่งนั้นว่าง จึงเป็นแค่คำเตือน */
  const CAP_PX_PER_CHAR = 16 * 0.56, CAP_LIFT_PX = 47;
  for (const [p, label, id] of caps){
    const mu = fit.w / 1504;                       // หน่วยแผนที่ต่อ 1 พิกเซลจอ
    const halfW = (label.length * CAP_PX_PER_CHAR / 2) * mu;
    const lift  = CAP_LIFT_PX * mu;
    const side  = Math.max(fit.x - (p.x - halfW), (p.x + halfW) - (fit.x + fit.w));
    const updn  = Math.max(fit.y - (p.y - lift),  (p.y + lift) - (fit.y + fit.h));
    if (side > 0)
      errs.push(`${b.id} ${b.year}: caption "${label}" on pin ${id} runs ${Math.round(side)} ` +
                `units off the side of the frame — the pin is inside, the words are not`);
    else if (updn > 0)
      warns.push(`${b.id} ${b.year}: caption "${label}" on pin ${id} reaches ${Math.round(updn)} ` +
                 `units past the top/bottom edge — it fits only if it can flip to the other side`);
  }

  /* หางลูกศรที่หลุดกรอบเป็น **คำเตือน** ไม่ใช่ error — มีฉากที่ต้นทางอยู่นอกจอ
     ได้จริง (ทัพที่เดินมาจากอีกฟากแผ่นดิน และฉากนั้นเล่าเรื่องปลายทางล้วน ๆ)
     แต่ต้องเป็นการตัดสินใจ ไม่ใช่ความบังเอิญ — ตระกูลเดียวกับกล้องแคบกว่าพื้น */
  for (const [p, what] of tails){
    const dFit = outside(p, fit);
    if (dFit > 0)
      warns.push(`${b.id} ${b.year}: ${what} at (${p[0]},${p[1]}) is ${Math.round(dFit)} units ` +
                 `outside the camera — the arrow walks in from off-screen with no origin to read`);
  }

  if (!pts.length) continue;

  let worst = -1e9;
  for (const [p, what] of pts){
    const dFit = outside(p, fit), dReq = outside(p, req);
    worst = Math.max(worst, dFit);
    if (dFit > 0)
      errs.push(`${b.id} ${b.year}: ${what} at (${p[0]},${p[1]}) is ${Math.round(dFit)} units ` +
                `outside the camera even after fitting — invisible`);
    else if (dReq > 0)
      warns.push(`${b.id} ${b.year}: ${what} at (${p[0]},${p[1]}) is ${Math.round(dReq)} units ` +
                 `outside the written camera — only on screen because fitBox grew the box`);
  }
  lines.push(`  ${b.id.padEnd(9)} ${b.year}  camera[${b.camera.join(',')}]  ` +
             `closest edge ${Math.round(-worst)} units`);
}

if (process.argv.includes('--all')) console.log(lines.join('\n') + '\n');
/* กล้องแคบรายงานแยกกอง และไม่ทำให้ตัวตรวจล้มเหลว — มันเป็นเรื่องบริบทกับรสนิยม
   ไม่ใช่ของที่มองไม่เห็น รายการนี้มีไว้ให้เจ้าของกวาดเมื่อพร้อม ไม่ใช่ให้แก้ทุกอันทันที */
if (tight.length){
  console.log(`cameras tighter than the ${CAM_FLOOR}-unit floor (${tight.length}):`);
  for (const t of tight) console.log('  · ' + t);
  console.log();
}
for (const w of warns) console.log('⚠ ' + w);
for (const e of errs)  console.log('✖ ' + e);
console.log(`\n${T.length} scenes checked · ${errs.length} invisible · ${warns.length} fragile · ` +
            `${tight.length} tighter than the ${CAM_FLOOR}-unit floor`);
process.exit(errs.length ? 1 : 0);
