/*
  build_map_inline.js — สร้าง `assets/map-art/map-art-inline.js` สำหรับผู้อ่านที่เปิดผ่าน file://

  ★ ปัญหาที่ไฟล์นี้แก้ (เจ้าของทัก 2026-09-08: "ทำไมกด Index เดิมมันไม่ขึ้นแผนที่ใหม่ล่ะ")
    ชั้นภาพของ Codex โหลดด้วย `import()` + `fetch()` ซึ่ง **file:// บล็อกทั้งคู่**
    ผลคือ setArt(true) โยน error เงียบ ๆ แล้วปุ่มเด้งกลับ "แผ่น: ต้นฉบับ"

  ★★ วัดจริงบน file:// ด้วย Chrome จริง (headless --dump-dom) 2026-09-08:
      | กลไก                | file:// |
      |---------------------|---------|
      | `import()` ES module | FAIL — Failed to fetch dynamically imported module |
      | `fetch()`            | FAIL — Failed to fetch |
      | `<script src>` ธรรมดา| **OK**  |
      | `<img>` / raster     | **OK** (อ่าน terrain-art.png ได้ 1153x1364) |

    → ทางแก้จึงไม่ใช่ไฟล์ base64 4 MB ที่ HANDOFF เคยเสนอ (ทางเลือก "ค")
      แค่เอา *ข้อความ* ของ SVG สองไฟล์มาห่อเป็นสคริปต์ธรรมดา ~315 KB
      **PNG ไม่ต้องฝัง** เพราะ raster โหลดผ่าน file:// ได้อยู่แล้ว

  ★★★ ทำไมต้องเป็นเครื่องมือ ไม่ใช่ก๊อปโค้ดมาแก้มือ
    ตัวโหลดเป็นของฝั่ง Codex (`tk3-art-outsourced-to-codex`) เขาจะส่งรุ่นใหม่มาอีก
    ถ้าเราก๊อปมาแก้มือ วันที่เขาส่งรุ่น 04 มา เราจะมีสำเนาที่เพี้ยนจากต้นฉบับโดยไม่มีใครรู้
    เครื่องมือนี้ **อ่านไฟล์ของเขาแล้วแปลงสด** → รันใหม่ทุกครั้งที่เขาส่งของ

  ใช้:  node tools/build_map_inline.js
*/
'use strict';
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR  = path.join(ROOT, 'assets', 'map-art');
const OUT  = path.join(DIR, 'map-art-inline.js');

/* ⚠ ฝังเฉพาะไฟล์ที่แอปเรียกใช้จริง — `strategic.js` ส่ง `includeWall:false`
   เพราะกำแพงใช้ข้อมูลของเราเอง (`data/wall.js`) · ฝัง wall.svg เข้ามาด้วยจะกลายเป็น
   แนวกำแพงชุดที่สองที่ไม่มีใครใช้ แต่ดูเหมือนใช้ได้ — shim ข้างล่างจึงฟ้องชัด ๆ แทน */
const EMBED = ['terrain-layer.svg', 'water.svg'];

/* ── อ่านตัวโหลดของ Codex แล้วแปลงให้เป็นสคริปต์ธรรมดา ──────────────────────────
   แก้สามจุด และ **ทุกจุดมี assert** — ถ้าเขาเปลี่ยนโครง เครื่องมือต้องตายเสียงดัง
   ไม่ใช่เงียบแล้วปล่อยไฟล์ที่ใช้ไม่ได้ออกไป */
/* ── ตัวสร้าง — แยกเป็นฟังก์ชันเพื่อให้ `check_map_inline.js` เรียกซ้ำแล้วเทียบได้ ──
   ★ ตัวตรวจจึงไม่ต้องเก็บ hash เอง มันแค่ **สร้างใหม่แล้วเทียบไบต์ต่อไบต์**
     ซึ่งจับได้ทั้งกรณี SVG เปลี่ยน · ตัวโหลดเปลี่ยน · และตัวสร้างเองเปลี่ยน */
function generate(){
  const loaderPath = path.join(DIR, 'load-map-layers.js');
  let loader = fs.readFileSync(loaderPath, 'utf8');

  function swap(from, to, why){
    if (!loader.includes(from))
      throw new Error('โครงของ load-map-layers.js เปลี่ยนไป — หาไม่เจอ: ' + why +
                      '\n  ที่หา: ' + from.slice(0, 80));
    loader = loader.replace(from, to);
  }

  /* ① `export` ใช้ในสคริปต์ธรรมดาไม่ได้ */
  swap('export async function loadMapLayers',
       'async function loadMapLayers',
       'คำว่า export หน้า loadMapLayers');

  /* ② `import.meta.url` เป็น **syntax error** ในสคริปต์ธรรมดา (พังตั้งแต่ตอน parse
        ไม่ใช่ตอนรัน) — ต้องเปลี่ยนแม้ค่า default ตัวนี้จะไม่เคยถูกใช้ก็ตาม
        เพราะ `strategic.js` ส่ง assetBase มาให้เสมอ */
  swap("new URL('./',import.meta.url)",
       "new URL('./',document.baseURI)",
       'ค่า default ของ assetBase ที่ใช้ import.meta.url');

  /* ③ ยืนยันว่ายังเรียก fetch อยู่ — shim ข้างล่างจะไปบังตัวนี้
        (ประกาศ `const fetch` ใน IIFE เดียวกัน = บังตัว global โดยไม่ต้องแตะ window) */
  if (!/await fetch\(url\)/.test(loader))
    throw new Error('โครงเปลี่ยน: ไม่เจอ `await fetch(url)` — shim จะไม่ทำงาน');

  /* ── ห่อข้อความ SVG ─────────────────────────────────────────────────────────── */
  function jsString(s){
    /* ⚠ เขียนแบ็กสแลชด้วย fromCharCode(92) ไม่ใช่ตัวอักษรตรง ๆ — ตั้งใจ
       ให้อ่านง่ายกว่าการนับ backslash ซ้อนสามชั้นในไฟล์ที่ *สร้างโค้ดอีกที* */
    const BS = String.fromCharCode(92);
    return JSON.stringify(s)
      .split(String.fromCharCode(60,47)).join(String.fromCharCode(60) + BS + String.fromCharCode(47))
      .split(String.fromCharCode(0x2028)).join(BS + "u2028")
      .split(String.fromCharCode(0x2029)).join(BS + "u2029");
  }

  const parts = [];
  let bytes = 0;
  for (const f of EMBED){
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) throw new Error('ไม่พบ ' + f + ' ที่ ' + DIR);
    const text = fs.readFileSync(p, 'utf8');
    bytes += Buffer.byteLength(text, 'utf8');
    parts.push('  ' + JSON.stringify(f) + ': ' + jsString(text));
  }

  const out = `/* ╔═══════════════════════════════════════════════════════════════════════════╗
     ║  ไฟล์นี้ถูก **สร้างอัตโนมัติ** โดย tools/build_map_inline.js — อย่าแก้ด้วยมือ  ║
     ╚═══════════════════════════════════════════════════════════════════════════╝

     มีไว้ให้ผู้อ่านที่ **ดับเบิลคลิก index.html** (โปรโตคอล file://) เห็นแผ่นวาดใหม่ได้
     บน file:// เบราว์เซอร์บล็อก \`import()\` กับ \`fetch()\` แต่ปล่อย \`<script src>\` ผ่าน
     ไฟล์นี้จึงเป็น "ตัวโหลดของ Codex + ข้อความ SVG" ห่อเป็นสคริปต์ธรรมดาก้อนเดียว

     ⚠ PNG ของภาพนูน (terrain-art.png) **ไม่ได้ฝังอยู่ในนี้** และไม่ต้องฝัง —
       raster โหลดผ่าน file:// ได้ตามปกติ (วัดแล้ว) · ไฟล์นี้จึงเป็นข้อความล้วน

     สร้างใหม่ทุกครั้งที่ฝั่ง Codex ส่งชั้นภาพรุ่นใหม่มา:  node tools/build_map_inline.js  */
  (function(){
  'use strict';

  const SRC = {
  ${parts.join(',\n')}
  };

  /* บัง \`fetch\` ของ global เฉพาะใน IIFE นี้ — ตัวโหลดข้างล่างเรียก \`fetch(url)\`
     แล้วได้ข้อความจาก SRC แทนการออกเน็ตเวิร์ก (ซึ่ง file:// ไม่ยอมให้ทำ) */
  const fetch = async function(url){
    const name = String(url).split('/').pop().split('?')[0];
    if (!(name in SRC))
      throw new Error('map-art-inline: ไม่ได้ฝัง ' + name +
        ' ไว้ — เพิ่มชื่อไฟล์ใน EMBED ของ tools/build_map_inline.js แล้วสร้างใหม่');
    return { ok: true, status: 200, text: async () => SRC[name] };
  };

  ${loader.trim()}

  window.TK_MAP_ART_INLINE = { loadMapLayers, embedded: Object.keys(SRC) };
  })();
  `;

  /* ตรวจว่าไฟล์ที่จะเขียน **parse ผ่านจริง** ก่อนเขียนลงดิสก์
     (new Function แค่ parse ไม่ได้รัน — window/document จึงไม่ต้องมี) */
  /* ตรวจว่าไฟล์ที่จะเขียน **parse ผ่านจริง** ก่อนคืนค่า
     (new Function แค่ parse ไม่ได้รัน — window/document จึงไม่ต้องมี) */
  try { new Function(out); }
  catch (e) { throw new Error("ไฟล์ที่สร้างออกมา parse ไม่ผ่าน: " + e.message); }

  return { code: out, bytes };
}

module.exports = { generate, OUT, ROOT, EMBED };

/* รันตรง ๆ = เขียนไฟล์ · require = แค่ยืมฟังก์ชันไปเทียบ (tools/check_map_inline.js) */
if (require.main === module) {
  const { code, bytes } = generate();
  fs.writeFileSync(OUT, code, "utf8");
  const kb = n => (n / 1024).toFixed(1) + " KB";
  console.log("เขียน " + path.relative(ROOT, OUT).split(String.fromCharCode(92)).join("/") + "  " + kb(Buffer.byteLength(code, "utf8")));
  for (const f of EMBED) console.log("  ฝัง " + f);
  console.log("  (ข้อความ SVG รวม " + kb(bytes) + ")");
}