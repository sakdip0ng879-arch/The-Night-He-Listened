/*
  check_map_inline.js — ไฟล์ฝังสำหรับ file:// ยังตรงกับต้นฉบับของ Codex อยู่ไหม

  ★ กับดักที่ตัวตรวจนี้ปิด (2026-09-08)
    ชั้นภาพมี **สองเส้นทางโหลด** ที่ต้องให้ภาพเดียวกัน:
      http/https → `import()` อ่าน `assets/map-art/*.svg` ตรง ๆ
      file://    → `<script>` อ่าน `assets/map-art/map-art-inline.js` ที่ฝังข้อความไว้
    วันที่ฝั่ง Codex ส่งรุ่นใหม่มาแล้วไม่มีใครรัน `node tools/build_map_inline.js`
    **คนเปิดผ่านเซิร์ฟเวอร์จะเห็นรุ่นใหม่ ส่วนคนดับเบิลคลิกเห็นรุ่นเก่า — เงียบสนิท**
    ไม่มี error ไม่มีอะไรฟ้อง เพราะไฟล์เก่าก็ยังใช้งานได้ปกติ มันแค่*ไม่ใช่ของล่าสุด*

  ★ วิธีตรวจ: **สร้างใหม่ในหน่วยความจำแล้วเทียบไบต์ต่อไบต์กับไฟล์บนดิสก์**
    ไม่ต้องเก็บ hash ไว้ที่ไหน และจับได้ครบทั้งสามกรณี —
    SVG เปลี่ยน · ตัวโหลดของ Codex เปลี่ยน · ตัวสร้างของเราเองเปลี่ยน

  ใช้:  node tools/check_map_inline.js
*/
'use strict';
const fs = require('fs'), path = require('path');
const { generate, OUT, ROOT, EMBED } = require('./build_map_inline.js');

const rel = p => path.relative(ROOT, p).split(String.fromCharCode(92)).join('/');
let bad = 0;
const fail = m => { console.error('  ✗ ' + m); bad++; };

console.log('check_map_inline — ไฟล์ฝังสำหรับผู้อ่านที่เปิดผ่าน file://');

if (!fs.existsSync(OUT)) {
  fail('ไม่มี ' + rel(OUT) + ' — คนที่ดับเบิลคลิก index.html จะไม่เห็นแผ่นวาดใหม่เลย' +
       '\n    แก้ด้วย: node tools/build_map_inline.js');
} else {
  const onDisk = fs.readFileSync(OUT, 'utf8');
  let fresh;
  try { fresh = generate().code; }
  catch (e) { fail('สร้างใหม่ไม่ผ่าน: ' + e.message); }

  if (fresh !== undefined) {
    if (fresh === onDisk) {
      const kb = (Buffer.byteLength(onDisk, 'utf8') / 1024).toFixed(1);
      console.log('  ✓ ' + rel(OUT) + ' ตรงกับต้นฉบับ (' + kb + ' KB · ฝัง ' + EMBED.join(', ') + ')');
    } else {
      fail('ไฟล์ฝัง **ล้าสมัย** — ไม่ตรงกับ assets/map-art/ ที่อยู่บนดิสก์ตอนนี้' +
           '\n    (บนดิสก์ ' + onDisk.length + ' ตัวอักษร · สร้างใหม่ได้ ' + fresh.length + ')' +
           '\n    แปลว่าคนเปิด http กับคนเปิด file:// กำลังเห็นคนละรุ่น' +
           '\n    แก้ด้วย: node tools/build_map_inline.js');
    }
  }
}

/* ตรวจฝั่งผู้เรียกด้วย — ถ้ามีคนถอดทางโหลดสำหรับ file:// ออกไป ไฟล์ฝังก็ไร้ความหมาย */
const strat = fs.readFileSync(path.join(ROOT, 'js', 'strategic.js'), 'utf8');
if (!strat.includes("map-art-inline.js"))
  fail('js/strategic.js ไม่ได้อ้างถึง map-art-inline.js แล้ว — ทางโหลดสำหรับ file:// หายไป');
if (!strat.includes("location.protocol !== 'file:'"))
  fail("js/strategic.js ไม่มีการแยกทางตาม location.protocol แล้ว");

console.log(bad ? '\nไม่ผ่าน ' + bad + ' ข้อ' : '\nผ่านหมด');
process.exit(bad ? 1 : 0);
