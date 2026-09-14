/* check_names.js — ชื่อที่คนอ่านเห็นต้องสะกดตามตาราง names.js / places.js (DECISIONS §11)
 *
 *   node tools/check_names.js
 *
 * ทำไมต้องมี — 2026-09-14 เจอ "ต่งอวิ๋น" ในร้อยแก้วบทที่ 9 ทั้งที่ names.js เคาะไว้ว่า "ต่งหยุ่น"
 *   ค้างมาตั้งแต่เขียนบทโดยไม่มีตัวตรวจไหนเห็น แล้วมาโผล่ให้เจ้าของเห็นเมื่อแถว "คนในฉาก"
 *   (data/scene_people.js) วาดชื่อจาก names.js ไว้ข้างร้อยแก้วที่สะกดอีกแบบ (LOG §5.39)
 *
 * ตรวจอะไร — ข้อความที่คนอ่านเห็นทั้งหมด (timeline ที่ build แล้ว · label ของตารางคน/สถานที่ ·
 *   scene_people · scene_art) ต้องไม่มีคำในรายการห้าม · รายการห้ามชี้กลับไปที่ id ในตาราง
 *   คำที่ถูกจึงอ่านจากตารางเสมอ ไม่มีสำเนาที่สองให้เพี้ยน
 * ⚠ ตรวจได้เฉพาะตัวสะกดที่รู้แล้วว่าผิด ไม่ใช่ทุกชื่อ — ไทยไม่มีช่องว่างให้ตัดคำ
 *   จึงเดาไม่ได้ว่าคำไหนคือชื่อคน · เจอตัวสะกดผิดตัวใหม่เมื่อไหร่ ให้เพิ่มแถวในตารางข้างล่าง
 */
const path = require('path');
global.window = global;
for (const f of ['names', 'places', 'timeline', 'scene_people', 'scene_art'])
  require(path.join(__dirname, '..', 'data', f + '.js'));

/* คำห้าม → id ในตาราง names.js
   ชุดแรก = ชื่อฉบับเจ้าพระยาพระคลัง(หน) ที่ §11 ห้ามปนกับคำอ่านพินอิน */
const BANNED = {
  'โจโฉ': 'caocao', 'เล่าปี่': 'liubei', 'ขงเบ้ง': 'kongming', 'จูล่ง': 'zhaoyun',
  'กวนอู': 'guanyu', 'เตียวหุย': 'zhangfei',
  /* 董允 อ่าน yǔn เสียง 3 → หยุ่น · "อวิ๋น" คือคำอ่านของ 云 yún คนละตัวอักษร (LOG §5.39) */
  'ต่งอวิ๋น': 'dongyun',
};

for (const [word, id] of Object.entries(BANNED)){
  const label = TK.people[id] && TK.people[id].label;
  if (!label || label.includes(word)){
    console.log('✖ ตารางคำห้ามผิดเอง: "' + word + '" ชี้ id "' + id + '" ซึ่ง label = ' + JSON.stringify(label));
    process.exit(2);
  }
}

let bad = 0, seen = 0;
function scan(value, where){
  if (typeof value === 'string'){
    seen++;
    for (const [word, id] of Object.entries(BANNED))
      if (value.includes(word)){
        bad++;
        console.log('✖ ' + where + ': "' + word + '" → ใช้ "' + TK.people[id].label + '" ตาม names.js (' + id + ')');
      }
  } else if (value && typeof value === 'object'){
    for (const [k, v] of Object.entries(value)) scan(v, where + '.' + k);
  }
}
for (const b of TK.timeline) scan(b, 'timeline ' + b.id);
for (const [id, p] of Object.entries(TK.people)) scan(p.label, 'names.js ' + id);
for (const [id, p] of Object.entries(TK.places)) scan(p.label, 'places.js ' + id);
scan(TK.scenePeople || {}, 'scene_people.js');
scan(TK.sceneArt || {}, 'scene_art.js');

if (bad){
  console.log('\n' + bad + ' จุดสะกดชื่อไม่ตรงตาราง (DECISIONS §11 ข้อ 3: คำในตารางคือคำตัดสิน)');
  process.exit(1);
}
console.log('✅ ชื่อที่คนอ่านเห็น: ไม่มีตัวสะกดต้องห้าม ' + Object.keys(BANNED).length + ' คำ · ตรวจ ' + seen + ' ข้อความ');
