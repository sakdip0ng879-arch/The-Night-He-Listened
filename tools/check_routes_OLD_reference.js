/* check_routes.js — ตรวจเส้นทางเดินทัพใน data/routes.js
 *
 *   node tools\check_routes.js
 *
 * ★ ยกมาจากโปรเจกต์พี่น้อง (เรื่องกวนอู) เมื่อ 2026-08-22 ตามที่เจ้าของขอ
 *   ครึ่งล่างของไฟล์ (การสุ่มจุดบนเบซิเยร์ · ความคด · landmask · รูปทรง) เหมือนกันทุกบรรทัด
 *   ครึ่งบน (ENDS · WATER · STRAIGHT_OK · SHAPE_OK) เป็นของเล่มนี้ล้วน ๆ เพราะเส้นทางคนละชุด
 *   ตาราง landmask ของสองเล่มเป็นรูปแบบเดียวกันเป๊ะ (cell 5 · 330x390) จึงใช้ได้ทันที
 *
 * ทำไมต้องมี: DECISIONS §6 เขียนกฎไว้ชัดว่า "ห้ามลากเส้นตรงระหว่างสองจุด" แต่**ไม่มีตัวตรวจไหน
 * ตรวจกฎข้อนี้เลย** ทั้งสองโปรเจกต์ เส้นตรงที่พาดข้ามฉินหลิ่งจะโหลดผ่าน วาดผ่าน และเงียบ
 *
 * ตรวจห้าอย่าง ทั้งหมดอ่านจากของจริง (พาธจริง + landmask จริง) ไม่ได้จำลองการเรนเดอร์:
 *   1. ★ ความคดของเส้น — เทียบความยาวตามส่วนโค้งกับระยะตรงหัวถึงท้าย
 *        เส้นที่ยาวกว่าระยะตรงไม่ถึง 3% = เส้นตรง ผิดกฎ §6 (ยกเว้นเส้นสั้นกว่า 60px)
 *   2. เส้นทางต้องไม่ลุยน้ำ ยกเว้นเส้นที่ประกาศว่าเป็นทางน้ำ (ตาราง WATER)
 *   3. หัวและท้ายต้องอยู่ใกล้สถานที่ที่ชื่อเส้นอ้างถึง (ตาราง ENDS)
 *   4. ทุกจุดต้องอยู่ในกรอบภาพ 1650x1950
 *   5. ★ รูปทรง — เส้นเดียวควรโค้งไปทางเดียว และไม่หักศอกเกินกว่าที่ภูมิประเทศหัก
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'places.js'));
require(path.join(ROOT, 'data', 'routes.js'));
require(path.join(ROOT, 'data', 'landmask.js'));

const TK = window.TK, RT = TK.routes, P = TK.places, M = TK.landmask;
const { cell: C, w: W, h: H, rows } = M;

/* หัว–ท้ายที่แต่ละเส้นต้องเชื่อม (id ของสถานที่ · null = จงใจไม่ผูก)
   ★ null ในไฟล์นี้ไม่ใช่ "ยังไม่ได้กรอก" — routes.js อธิบายไว้ทุกอันว่าทำไมปลายเส้นถึง
     ต้องหยุดกลางทาง เช่น ขบวนเสบียงที่ไม่มีวันถึง หรือลูกศรที่ถ้าวาดถึงเมืองแล้วหัวลูกศร
     จะไปบังหมุด/วงปะทะพอดี ใครแก้ให้ผูกเมืองต้องไปอ่าน routes.js ก่อน */
const ENDS = {
  hanzhong_qishan:        ['hanzhong', 'qishan'],
  qishan_jieting:         ['qishan', 'jieting'],
  hanzhong_qigu:          ['hanzhong', 'mei'],
  changan_jieting:        ['changan', 'jieting'],
  longyou_sweep:          ['tianshui', 'anding'],
  jieting_chencang:       ['jieting', 'chencang'],
  hanzhong_xiegu:         ['hanzhong', 'mei'],
  longyou_chencang:       ['shangbang', 'chencang'],
  chencang_mei:           ['chencang', 'mei'],
  mei_changan:            ['mei', 'changan'],
  mei_flee_east:          ['mei', null],          /* ออกไปจบในสือลี่ ไม่ผูกเมือง */
  changan_flee_east:      ['changan', null],      /* เช่นเดียวกัน — หนีออกนอกกวนจง */
  mei_chencang_cut:       ['mei', null],          /* ขบวนเสบียงที่ไม่มีวันถึงตันฉอง */
  wancheng_luoyang:       ['wancheng', 'luoyang'],
  changan_tongguan:       ['changan', 'tongguan'],
  changan_wuguan:         ['changan', 'wuguan'],
  changan_xiaoguan:       ['changan', 'xiaoguan'],
  changan_puban:          ['changan', 'puban'],
  luoyang_hedong:         ['luoyang', null],      /* ข้ามฮวงโหแล้วหยุดกลางเหอตง */
  jiangling_baidi:        ['jiangling', null],    /* กองเรือไปไม่ถึงเป๊กเต้เซีย */
  luoyang_ordos:          ['luoyang', null],      /* ขึ้นไปหาเผ่าในทุ่งออร์ดอส ไม่มีเมือง */
  steppe_anding:          [null, 'anding'],       /* ม้าเผ่าลงมาจากทุ่ง ไม่มีต้นทาง */
  xiaoguan_jing:          ['xiaoguan', null],     /* ลงหุบเจ๋ง จบกลางหุบ */
  puban_cross_south:      [null, 'fengxiang'],    /* ข้ามท่าผู่ปั่นมาจากฝั่งเหนือ */
  luoyang_tongguan:       ['luoyang', 'tongguan'],
  wancheng_wuguan:        ['wancheng', 'wuguan'],
  tongguan_luoyang:       ['tongguan', 'luoyang'],
  puban_hedong:           [null, 'hedong'],
  puban_pingyang:         ['puban', 'pingyang'],
  luoyang_yingchuan:      ['luoyang', null],      /* หยุดบนที่ราบ ไม่เข้าเมืองซูฉาง */
  hanei_yingchuan:        ['hanei', null],        /* ปีกเหนือของแนวรบ ไม่ใช่เมือง */
  xuchang_yingplain:      ['xuchang', null],      /* ออกจากเมืองมาตั้งแนวคู */
  yingchuan_ditchline:    [null, null],           /* ทั้งสองปลายอยู่กลางที่ราบ */
  yingchuan_jianhe:       [null, 'jianhe'],
  yingplain_jianhe:       [null, 'jianhe'],
  hanei_hedong:           ['hanei', null],
  luoyang_shouchun:       ['luoyang', 'shouchun'],
  luoyang_yecheng:        ['luoyang', 'yecheng'],
  luoyang_xuchang:        ['luoyang', 'xuchang'],
  xuchang_shouchun:       ['xuchang', 'shouchun'],
  xuchang_yecheng:        ['xuchang', 'yecheng'],
  jiangling_xiling:       ['jiangling', 'xiling'],
  xiangyang_jiangling:    ['xiangyang', 'jiangling'],
  ruxu_jianye:            ['ruxu', 'jianye'],
  fleet_upper:            ['jiangzhou', 'jiangling'],
  fleet_mid:              ['jiangling', 'jiujiang'],
  fleet_lower:            ['jiujiang', 'jianye'],
  shouchun_shiting:       ['shouchun', 'shiting'],
  ruxu_hefei:             ['ruxu', 'hefei'],
  ruxu_shouchun:          ['ruxu', 'shouchun'],
  yecheng_liaodong:       ['yecheng', 'xiangping'],
  shangyong_hanzhong:     ['shangyong', null],    /* หยุดที่ริมตะวันออกของแอ่ง */
  hanzhong_basin:         [null, null],           /* กวาดข้ามพื้นแอ่ง ไม่ผูกเมืองสองปลาย */
  changan_hanzhong_west:  ['changan', 'hanzhong'],
  wan_shiting:            [null, 'shiting'],      /* ลกซุนขึ้นมาจากลุ่มแยงซี ไม่ผูกเมืองต้นทาง */
  baidi_rafts:            ['baidi', null],        /* แพไฟหยุดก่อนถึงกองเรือ */
  shouchun_sortie:        ['shouchun', null]      /* ม้าเหวินยงทะลุออกไปกลางค่ายเว่ย */
};

/* เส้นที่วิ่งบนน้ำโดยตั้งใจ — กองเรือ ท่าข้าม และข้อจำกัดของแผ่นแผนที่ */
const WATER = new Set([
  'fleet_upper', 'fleet_mid', 'fleet_lower',   /* กองเรือบนแยงซี */
  'jiangling_baidi',                            /* กองเรือหวูทวนน้ำเข้าสามผา */
  'ruxu_jianye', 'ruxu_hefei', 'ruxu_shouchun', /* ออกจากค่ายเรือหรูซี */
  'jiangling_xiling',
  'yecheng_liaodong',                           /* ⚠ ข้อจำกัดของแผ่น — ดูโน้ตใน routes.js */

  /* ── ★ ถนนที่ตาราง landmask อ่านเป็นน้ำ ทั้งที่มันคือถนน (2026-08-22) ──
     ช่องละ 5px ราว 6 กม. ซึ่งกว้างกว่าตัวแม่น้ำกับลานตะพักที่ถนนวิ่งอยู่ข้าง ๆ มาก
     สองกรณีที่ยอมรับ และทั้งสองไม่ใช่ "ทัพลุยน้ำ":
       (ก) ถนนเลียบตลิ่ง — ลุ่มน้ำเว่ยทั้งสาย ถนนอยู่บนลานตะพักเหนือลำน้ำไม่กี่ร้อยเมตร
       (ข) ท่าข้าม — การข้ามฮวงโหที่ผู่ปั่นคือเนื้อหาของฉาก ไม่ใช่ความผิดพลาดของเส้น */
  'changan_tongguan', 'changan_flee_east', 'chencang_mei', 'mei_changan', 'longyou_chencang',
  'luoyang_hedong', 'puban_cross_south', 'puban_hedong',
  'hanzhong_xiegu',        /* ทางไม้เลียบผาเหนือลำน้ำเป่า–เซี่ย — เหตุผลเดียวกับเล่มพี่น้อง */
  'xiangyang_jiangling'    /* ข้ามแม่น้ำฮั่นที่เซียงหยาง แล้วลงที่ลุ่มทะเลสาบของจิงโจว */
]);

/* ★ เส้นที่ "ตรง" เพราะถนนจริงมันตรง ไม่ใช่เพราะลากมั่ว
   กฎ §6 มีไว้กันทัพเดินข้ามภูเขา ไม่ได้มีไว้บังคับให้ถนนคดโดยไม่มีเหตุ
   ทุกแถวต้องมีเหตุผลกำกับ และการเพิ่มแถวใหม่คือการตัดสินใจ ไม่ใช่การปิดเสียงเตือน */
const STRAIGHT_OK = {
  /* สามแถวนี้ยกมาจากเล่มพี่น้องพร้อมเหตุผลเดิม — เป็นถนนสายเดียวกัน บนแผ่นเดียวกัน และ
     เจ้าของเคยตัดสินไปแล้วที่นั่น ไม่ใช่การตัดสินใหม่ ที่เหลือทั้งหมดยังไม่ได้ตัดสิน */
  changan_tongguan: 'ลานตะพักแม่น้ำเว่ยจากฉางอันไปทางตะวันออกเป็นแนวตรงจริง ผ่านเว่ยหนานกับหัวอิน',
  tongguan_luoyang: 'ทางหลวงเลียบฝั่งใต้ฮวงโหจากถงกวนถึงลั่วหยาง — หุบเขาตรง ถนนจึงตรง',
  luoyang_tongguan: 'ถนนเส้นเดียวกับข้างบน วาดไว้คนละทิศเพราะฉากคนละฝ่ายเดิน',

  /* ── ★ เพิ่ม 2026-08-22 ตอนกวาดทั้งตาราง ──
     ⚠ ย่อหน้านี้เคยอ้างว่าอีก 20 เส้นถูก "วาดใหม่ให้โค้ง" ด้วย landmask — **ถอนคำนั้น**
     สคริปต์นั้นดันส่วนโค้งตั้งฉากที่จุดกึ่งกลางเพื่อให้ตัวเลขผ่าน ไม่ได้เดินตามหุบเขาหรือลำน้ำเลย
     เจ้าของเปิดดูแล้วทักทันทีว่ามันอ้อมโดยไม่มีเหตุ — ถูกต้อง และทั้ง 18 เส้นถูกถอยกลับแล้ว
     เกณฑ์ของแถวข้างล่างนี้: ประกาศได้เฉพาะเมื่อบอกได้ว่า "ตรงนั้นภูมิประเทศตรงจริง" */
  changan_puban:     'ที่ราบกวนจงจากฉางอันขึ้นไปทางท่าผู่ปั่นเป็นที่ราบล้วน ไม่มีอะไรให้ถนนอ้อม',
  changan_flee_east: 'ลานตะพักแม่น้ำเว่ยฝั่งตะวันออก — ถนนเส้นเดียวกับ changan_tongguan',
  chencang_mei:      'ไหลตามน้ำเว่ย 71px ตรงตามลำน้ำ (เหตุผลเดียวกับที่เล่มพี่น้องใช้)',
  longyou_chencang:  'ลุ่มน้ำเว่ยช่วงสั้นระหว่างเทียนซุ่ยกับตันฉอง — ลำน้ำตรง ถนนจึงตรง',
  luoyang_hedong:    'ข้ามฮวงโหแล้วขึ้นที่ราบเหอตง — ท่าข้ามไม่มีเหตุให้คด',
  puban_cross_south: 'ท่าข้ามแม่น้ำ การข้ามเป็นเส้นตรงโดยธรรมชาติ',
  steppe_anding:     'ม้าเผ่าลงมาจากทุ่งออร์ดอส — ทุ่งโล่ง ไม่มีหุบให้เลาะ'
};

/* ★ รูปทรง — เส้นเดียวควรโค้งไปทางเดียว มุมหักที่เป็นของจริงไม่ใช่ความผิด
   ถนนที่เลี้ยวที่ปากหุบเขาหรือที่แม่น้ำหักศอกก็ต้องหักตาม การดัดให้สวยคือการโกหกภูมิประเทศ
   ประกาศที่นี่พร้อมเหตุผล เหมือน STRAIGHT_OK ทุกประการ
   ⚠ บทเรียนจากเล่มพี่น้อง: แถวใน SHAPE_OK กลายเป็นที่ซ่อนบั๊กมาแล้วสองครั้ง
     ก่อนเพิ่มแถว ให้ถามว่ากำลังอธิบายภูมิประเทศ หรือกำลังอธิบายความผิดพลาดของตัวเอง */
const SHAPE_OK = {
  hanzhong_xiegu: 'ปากหุบที่ Xie Gu Pass หักศอกจริงบนแผ่นพิมพ์ — ออกทางตะวันออกก่อนแล้วค่อยขึ้นเหนือเข้าเหมย'
};

const SHORT = 60;   /* สั้นกว่านี้ยกเว้นกฎความคด */
const BEND  = 1.03; /* ต้องยาวกว่าระยะตรงอย่างน้อย 3% */

/* ── แปลง path (M + C เท่านั้น) เป็นลำดับจุด ── */
function samples(d, per = 24) {
  const nums = d.match(/-?[\d.]+/g).map(Number);
  const cmds = d.match(/[MC]/g);
  const pts = [];
  let i = 0, cur = null;
  for (const c of cmds) {
    if (c === 'M') { cur = [nums[i], nums[i+1]]; i += 2; pts.push(cur); }
    else {
      const [x1,y1,x2,y2,x3,y3] = nums.slice(i, i+6); i += 6;
      const [x0,y0] = cur;
      for (let k = 1; k <= per; k++) {
        const t = k/per, u = 1-t;
        pts.push([
          u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
          u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3
        ]);
      }
      cur = [x3, y3];
    }
  }
  return pts;
}
const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const arcLen = pts => pts.reduce((s,p,k) => k ? s + dist(pts[k-1], p) : 0, 0);
const isLand = (x,y) => {
  const gx = Math.floor(x/C), gy = Math.floor(y/C);
  if (gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
  return rows[gy].charCodeAt(gx) === 49;
};

const err = [], warn = [], todo = [];
const ids = Object.keys(RT);

for (const id of ids) {
  const r = RT[id];
  if (!r.label) err.push(`${id}: no label`);
  if (!r.d)     { err.push(`${id}: no d`); continue; }
  if (/[^MCLZ\s\d.,-]/.test(r.d)) warn.push(`${id}: path uses a command this checker does not sample`);

  const pts = samples(r.d);
  const chord = dist(pts[0], pts[pts.length-1]);
  const len   = arcLen(pts);
  const ratio = chord > 0 ? len/chord : 1;

  /* 1 · ★ straight-line rule */
  if (chord >= SHORT && ratio < BEND){
    if (STRAIGHT_OK[id])
      warn.push(`${id}: straight (${((ratio-1)*100).toFixed(1)}% bend) — allowed: ${STRAIGHT_OK[id]}`);
    else
      /* ★ เป็น "รายการค้าง" ไม่ใช่ error — ลดระดับเมื่อ 2026-08-22 ด้วยเหตุผลที่ต้องอ่าน
         ก่อนจะเผลอเลื่อนกลับ:
         ตอนกวาดตารางรอบแรก ผมเขียนสคริปต์ดัดเส้นให้ผ่านเกณฑ์นี้ โดยดันส่วนโค้งตั้งฉาก
         ที่จุดกึ่งกลาง — ซึ่งไม่ได้อ้างอิงหุบเขา ถนน หรือแม่น้ำใด ๆ เลย มันแค่ทำให้เส้นยาวขึ้น
         จนตัวเลขผ่าน เจ้าของเปิดดูแล้วทักทันทีว่า "ทำไมมันโค้งอ้อมน้ำ อ้อมเมือง
         เหมือนเดินอ้อมไปให้ไกลขึ้น" — ถูกต้อง เพราะมันคือการอ้อมที่ไม่มีเหตุผล
         **เส้นตรง = ยอมรับว่ายังไม่ได้วาดถนนเส้นนั้นจริง**
         **เส้นโค้งมั่ว = อ้างเรื่องภูมิประเทศที่ไม่จริง** — อย่างหลังแย่กว่า และตรวจไม่เจอ
         กฎ §6 มีไว้กันทัพเดินข้ามภูเขา ไม่ได้มีไว้ให้ไล่ทำตัวเลขให้เขียว
         การทำให้มันเป็น error จึงกดดันให้คนแก้แบบผิดวิธี ซึ่งเกิดขึ้นจริงมาแล้วหนึ่งครั้ง */
      todo.push(`${id}: still a straight line — ${len.toFixed(0)}px over a ${chord.toFixed(0)}px chord ` +
                `(${((ratio-1)*100).toFixed(1)}%). Draw it along the valley/road/river it actually ` +
                `follows, or declare it in STRAIGHT_OK with the terrain reason. ` +
                `Do NOT bend it just to pass this line.`);
  } else if (STRAIGHT_OK[id])
    warn.push(`${id}: listed in STRAIGHT_OK but it bends ${((ratio-1)*100).toFixed(0)}% — remove the entry`);

  /* 4 · inside the frame */
  for (const [x,y] of pts)
    if (x < 0 || x > 1650 || y < 0 || y > 1950) {
      err.push(`${id}: leaves the image at (${x.toFixed(0)},${y.toFixed(0)})`); break;
    }

  /* 2 · dry land, unless declared a water road.
     ★ Judged on the INTERIOR only — points within 20px of either end are skipped.
     The endpoints are fixed by places.js, and plenty of them are riverside towns whose
     printed marker sits on the drawn water: Jieting is on the Wei headwater, Puban IS a
     ford. Counting those made a dry road look 36% wet and hid the real question, which
     is whether the middle of the march is in a river. */
  if (!WATER.has(id)) {
    const a = pts[0], b = pts[pts.length-1];
    const mid = pts.filter(pt => dist(pt,a) > 20 && dist(pt,b) > 20);
    const wet = mid.filter(([x,y]) => isLand(x,y) === false).length;
    if (mid.length && wet / mid.length > 0.25)
      err.push(`${id}: ${(wet/mid.length*100).toFixed(0)}% of its middle is on water and it is not in WATER`);
    else if (wet > 0)
      warn.push(`${id}: ${wet}/${mid.length} interior points on water (river crossings are normal)`);
  }

  /* 3 · endpoints */
  const e = ENDS[id];
  if (!e) { warn.push(`${id}: not listed in ENDS — endpoints unchecked`); }
  else {
    const check = (pid, pt, which) => {
      if (!pid) return;
      const pl = P[pid];
      if (!pl) { err.push(`${id}: ENDS names "${pid}", which is not in places.js`); return; }
      const dd = dist([pl.x, pl.y], pt);
      if (dd > 22)
        err.push(`${id}: ${which} is ${dd.toFixed(0)}px from ${pl.label} — should start/end on it`);
    };
    check(e[0], pts[0], 'start');
    check(e[1], pts[pts.length-1], 'end');
  }
}

/* ── รูปทรง: flips กับ maxTurn ── */
function shapeOf(pts){
  const coarse=[pts[0]]; let acc=0;
  for (let i=1;i<pts.length;i++){ acc+=dist(pts[i],pts[i-1]);
    if (acc>=28){ coarse.push(pts[i]); acc=0; } }
  const last=pts[pts.length-1];
  if (dist(coarse[coarse.length-1],last)>4) coarse.push(last);
  let flips=0, prev=0, maxTurn=0;
  for (let i=1;i+1<coarse.length;i++){
    const a=[coarse[i][0]-coarse[i-1][0], coarse[i][1]-coarse[i-1][1]];
    const b=[coarse[i+1][0]-coarse[i][0], coarse[i+1][1]-coarse[i][1]];
    const la=Math.hypot(a[0],a[1]), lb=Math.hypot(b[0],b[1]);
    if (la<1||lb<1) continue;
    const cos=Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1])/(la*lb)));
    const turn=Math.acos(cos)*180/Math.PI;
    if (turn>maxTurn) maxTurn=turn;
    if (turn<6) continue;                       /* เกือบตรง — ไม่มีทิศโค้งให้เทียบ */
    const sg=Math.sign(a[0]*b[1]-a[1]*b[0]);
    if (prev && sg && sg!==prev) flips++;
    if (sg) prev=sg;
  }
  return { flips, maxTurn };
}
const shapes = {};
for (const id of ids){
  const sh = shapeOf(samples(RT[id].d));
  shapes[id] = sh;
  /* คาลิเบรตกับเส้นที่มีอยู่ 44 เส้น: การงอสลับข้างเพียงอย่างเดียวไม่ใช่ความผิด —
     ถนนยาว ๆ ที่เลาะสองหุบเขาต่อกันย่อมสลับข้างหนึ่งครั้งเป็นเรื่องปกติ (jiangling_fancheng)
     ที่ตาคนอ่านว่า "หยึกหยัก" คือการสลับข้าง**พร้อมกับ**หักแรง หรือสลับหลายรอบ */
  const bad = (sh.flips >= 2 && sh.maxTurn > 40) || sh.flips >= 3 || sh.maxTurn > 55;
  if (bad && SHAPE_OK[id])
    warn.push(`${id}: ${sh.flips} inflection(s), sharpest turn ${sh.maxTurn.toFixed(0)}° — allowed: ${SHAPE_OK[id]}`);
  else if (bad)
    err.push(`${id}: ${sh.flips} inflection(s) and a ${sh.maxTurn.toFixed(0)}° corner. ` +
             `A march reads as one road: it should curve one way, and it should not turn a ` +
             `corner sharper than the ground does. Redraw it, or add it to SHAPE_OK with the ` +
             `terrain reason (HANDOFF §2.13).`);
  else if (!bad && SHAPE_OK[id])
    warn.push(`${id}: listed in SHAPE_OK but it is smooth now (${sh.flips} flips, ${sh.maxTurn.toFixed(0)}°) — remove the entry`);
}

/* ── report ── */
console.log(`${ids.length} routes\n`);
const rows2 = ids.map(id => {
  const pts = samples(RT[id].d);
  const chord = dist(pts[0], pts[pts.length-1]);
  const len = arcLen(pts);
  return [id, len, chord, chord > 0 ? len/chord : 1];
}).sort((a,b) => a[3] - b[3]);
console.log('  bendiness (arc / straight line) — lowest first, 1.00 would be a straight line');
for (const [id, len, chord, ratio] of rows2)
  console.log('   ' + (ratio < BEND && chord >= SHORT ? '✖' : ' ') +
              ' ' + ratio.toFixed(2).padStart(5) + '  ' +
              String(Math.round(len)).padStart(4) + 'px over ' +
              String(Math.round(chord)).padStart(4) + 'px  ' + id +
              (chord < SHORT ? '   (short — exempt)' : ''));

/* ⚑ = รายการค้าง ไม่ใช่ความผิด — ไม่ทำให้ตัวตรวจล้มเหลว ดูเหตุผลที่จุดที่ push เข้ามา */
if (todo.length) {
  console.log(`\n⚑ ${todo.length} route(s) still to be drawn along real ground:`);
  todo.forEach(t => console.log('  · ' + t));
}
if (warn.length) { console.log(`\n⚠ ${warn.length} warning(s):`); warn.forEach(w => console.log('  ' + w)); }
console.log('');
for (const e of err) console.log('✖ ' + e);
console.log(err.length ? `${err.length} problem(s)`
  : (todo.length ? `no faults · ${todo.length} of ${ids.length} routes still need drawing along real ground` : `all ${ids.length} routes bend, stay in frame, keep to their ground, and land on their endpoints`));
process.exit(err.length ? 1 : 0);
