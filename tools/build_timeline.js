/* build_timeline.js — merge data/_part1..N.js into data/timeline.js, validating first
 *
 *   node tools/build_timeline.js
 *
 * Checks before writing:
 *   - duplicate ids
 *   - regionId / placeId / routeId actually exist
 *   - every beat has fact + factNote
 *   - chapters in order, years move forward
 *   - accumulated mapDelta ends with Han holding every region
 *   - battles referenced are on the Tier-A list
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const load = f => { require(path.join(ROOT, 'data', f)); };

global.window = {};
/* ★★ 2026-08-27 — เดิม hardcode รายชื่อ _partN ไว้สองที่ (ที่นี่ และที่ beats ข้างล่าง)
   ซึ่งเป็น**โรคเดียวกับที่ check_routes ข้อ 11 เคยเป็น**: ตอนเขียนบทที่ 5–6 ไม่มีใครเติมชื่อ
   ผลคือมันไม่เคยตรวจฉากสองบทนั้นเลยและผ่านเงียบ ๆ อยู่นาน
   ตอนนี้สแกนไดเรกทอรีจริง — บทใหม่โผล่มาก็ถูกอ่านและถูกตรวจเอง ไม่ต้องแก้ไฟล์นี้อีก */
const PARTS = fs.readdirSync(path.join(ROOT,'data'))
  .filter(f => /^_part\d+\.js$/.test(f))
  .sort((a,b) => (+a.match(/\d+/)[0]) - (+b.match(/\d+/)[0]));
if (!PARTS.length){ console.error('✖ ไม่พบไฟล์บท (_partN.js) สักไฟล์ใน data/'); process.exit(1); }
const NEED = ['names.js','places.js','geo.js','roads.js', ...PARTS];
const missing = NEED.filter(f => !fs.existsSync(path.join(ROOT,'data',f)));
if (missing.length){
  console.error(`✖ missing files: ${missing.join(', ')}`);
  process.exit(1);
}
NEED.forEach(load);
const TK = global.window.TK;

/* ── battle mode was removed (DECISIONS §9) ──
   There used to be a second, hand-drawn tactical map behind a modal, and the losses of the
   ten scenes bound to it were derived from those files by a battleLosses() pass here.
   The tactical maps were drawn without checking their terrain against assets/map.jpg, and at
   least one (mei229) had its river on the wrong side of the field, which put a river between
   Zhao Yun and the ground he marched onto. Fixing that turned out to mean redrawing every
   unit position and movement path in the file, and there were ten files.
   The ten loss figures those files used to compute now sit in the scenes themselves, copied
   verbatim, so the HUD economy is byte-identical to what it was. See each scene's comment.
   Every scene now writes its own losses; nothing derives them any more. */

/* ตารางบทอยู่ที่นี่ ไม่ได้อยู่ใน timeline.js — ไฟล์นั้นถูกเขียนทับทุกครั้งที่ build
 *
 * ★ เขียนใหม่ทั้งตารางสำหรับโปรเจกต์นี้ 2026-08-25
 *   บทเรียนจากโปรเจกต์ 2 ที่บันทึกไว้ตรงนี้และยังใช้ได้: `ui.js` อ่าน TK.chapters สามที่
 *   และถอยไปใช้ "Part <n>" เฉพาะตอนที่ **ไม่มีเลข** เท่านั้น ถ้าตารางเป็นของเรื่องอื่น
 *   ทุกบทจะถูกหาเจอหมด แล้วคนอ่านจะได้หัวข้อที่มั่นใจและผิดทั้งชุด โดยไม่มีอะไร error
 *
 * สิบสามบท: บทนำ + สิบเอ็ดภาค + บทส่งท้าย
 *
 * ⚠⚠ **ภาคสี่เดินย้อนเวลาทับภาคสาม โดยตั้งใจ** (ค.ศ. 224–225 ทั้งคู่)
 *   ภาคสามเล่าฝั่งฮั่น ภาคสี่เล่าสองปีเดียวกันจากฝั่งวุ่ย และภาคสี่เปิดด้วยการที่
 *   ผู้เฝ้ามองยอมรับเองว่าเล่าผิดมาสามภาค · กฎ "ปีต้องเดินหน้า" ของตัว build เป็นกฎ
 *   ต่อบท ไม่ใช่ข้ามบท มันจึงผ่านอยู่แล้ว — แต่จดไว้ตรงนี้เพราะคนที่มาอ่านทีหลัง
 *   จะนึกว่าแถบเวลาพัง (DECISIONS §10)
 */
const CHAPTERS = [
  { n:0,  label:"บทนำ — ผู้เฝ้ามอง",                    years:"221"      },
  { n:1,  label:"ภาคหนึ่ง — คำที่เดินทางขึ้นข้างบน",      years:"221"      },
  { n:2,  label:"ภาคสอง — เมืองที่ฆ่าลูกเมียตน",          years:"221–222"  },
  { n:3,  label:"ภาคสาม — สงครามที่ไม่มีน้ำ",             years:"223–225"  },
  { n:4,  label:"ภาคสี่ — ปีที่วุ่ยหันมามอง",              years:"224–225"  },
  { n:5,  label:"ภาคห้า — เมืองจี้เฉิง ฤดูใบไม้ร่วง",       years:"226"      },
  { n:6,  label:"ภาคหก — วุ่ยไม่ใช่ของอ่อน",              years:"227–231"  },
  { n:7,  label:"ภาคเจ็ด — ทุ่งอู่จ้างหยวน",               years:"232–234"  },
  { n:8,  label:"ภาคแปด — ระเบียบที่ถือแอ่งไว้",          years:"235–241"  },
  { n:9,  label:"ภาคเก้า — ชะง่อน",                      years:"242–248"  },
  { n:10, label:"ภาคสิบ — ฟ้าเหนือแปร",                  years:"249–262"  },
  { n:11, label:"ภาคสิบเอ็ด — แม่น้ำสายสุดท้าย",          years:"263–274"  },
  { n:12, label:"บทส่งท้าย — ศิลาที่หน้าค่าย",            years:"270s"     }
];

const beats = PARTS.reduce((a,f) => a.concat(TK['_' + f.slice(1).replace('.js','')] || []), []);
const err = [], warn = [];

/* ── validate ── */
const seen = new Set();
let lastChapter = -1, lastYear = 0, prevOpenedChapter = false;

for (const b of beats){
  const at = b.id || '(no id)';
  if (!b.id)            err.push(`${at}: missing id`);
  if (seen.has(b.id))   err.push(`${at}: duplicate id`);
  seen.add(b.id);

  if (typeof b.chapter !== 'number') err.push(`${at}: missing chapter`);
  if (typeof b.year !== 'number')    err.push(`${at}: missing year`);
  if (!b.title)  err.push(`${at}: missing title`);
  if (!b.text)   err.push(`${at}: missing text`);
  if (!b.fact)   err.push(`${at}: missing fact`);
  else if (!['real','fiction','mixed'].includes(b.fact))
                 err.push(`${at}: fact must be real|fiction|mixed, not "${b.fact}"`);
  if (!b.factNote) warn.push(`${at}: missing factNote`);

  if (b.chapter < lastChapter) err.push(`${at}: chapter goes backwards (${lastChapter}→${b.chapter})`);
  const opensChapter = b.chapter !== lastChapter;
  lastChapter = b.chapter;
  /* A chapter's first beat is often a bird's-eye summary that names a later year first,
     then loops back (Part Four opens with "around 240 the board looked like this").
     Not an error. */
  /* ★ 2026-08-22 — `!opensChapter` added for Part Nine. The file header (line 64) already
     said Part Nine opens in 241 inside years Part Eight has covered, but the exemption
     only looked at whether the PREVIOUS beat opened a chapter, so the one case it was
     written for was the one case it did not cover. A chapter that begins earlier than the
     last one ended is a deliberate structure here, announced in c9-01's own first line. */
  if (b.year < lastYear && !prevOpenedChapter && !opensChapter)
    warn.push(`${at}: year goes backwards (${lastYear}→${b.year})`);
  prevOpenedChapter = opensChapter;
  lastYear = b.year;

  if (b.camera && (!Array.isArray(b.camera) || b.camera.length < 3))
    err.push(`${at}: camera must be [x,y,w,h]`);

  /* losses = permanent combat losses in units of 10,000 men; only the three states,
     always positive. A misspelled side would vanish silently — hence the check. */
  for (const k in (b.losses || {})){
    if (!['han','wei','wu'].includes(k))
      err.push(`${at}: losses has unknown side "${k}" — use han|wei|wu`);
    else if (typeof b.losses[k] !== 'number' || b.losses[k] <= 0)
      err.push(`${at}: losses.${k} must be a positive number (units of 10k men), not ${b.losses[k]}`);
  }
  /* ★★ taken = กองที่ยอมจำนน/ถูกกลืน หน่วยหมื่นเหมือน losses แต่ **ไม่มี RECOVER**
     (เพิ่ม 2026-08-27 — เจ้าของทัก "การขึ้นลงกำลังพลไม่เคยขยับเลย")
     บทที่ 7 มีทหารวุ่ยยอมจำนน 32,500 ซึ่งมากกว่าคนที่ตายในสนามทั้งเล่มรวมกัน
     แต่เดิมมันหายจากบัญชีในคอมเมนต์เฉย ๆ ไม่เคยแตะแถบ HUD · เช็คเหมือน losses เป๊ะ ๆ
     เพราะชื่อฝ่ายที่พิมพ์ผิดจะเงียบหายไปแบบเดียวกัน */
  for (const k in (b.taken || {})){
    if (!['han','wei','wu'].includes(k))
      err.push(`${at}: taken has unknown side "${k}" — use han|wei|wu`);
    else if (typeof b.taken[k] !== 'number' || b.taken[k] <= 0)
      err.push(`${at}: taken.${k} must be a positive number (units of 10k men), not ${b.taken[k]}`);
  }
  /* กองที่ยอมจำนนต้องมีตัวตนบนจอก่อน ไม่งั้นแถบ HUD จะลดลงโดยไม่มีใครรู้ว่าลดจากอะไร
     ⚠ เป็นการ์ดหยาบ ๆ: มันตรวจได้แค่ว่า "ฝ่ายที่เสียคนมีเลขบนจอในฉากนี้" ไม่ได้ตรวจว่า
        เลขนั้นคือกองเดียวกับที่ยอมจำนน — ตรวจให้ละเอียดกว่านี้ต้องผูก taken กับ place
        ซึ่งยังไม่คุ้ม · หน้าที่เล่าว่าใครยอมยังเป็นของร้อยแก้ว */
  for (const side in (b.taken || {}))
    if (!(b.markers || []).some(m => m.type === 'pin' && m.strength && m.side === side))
      err.push(`${at}: taken.${side} but no ${side} pin carries a strength in this scene — ` +
               `the men who surrendered have to be visible before they can leave the board`);

  /* ★★ front = กำลังรบที่แต่ละฝ่ายทุ่มลงแนวตะวันตก ณ ฉากนั้น หน่วยหมื่น
     (เพิ่ม 2026-08-27 · ทางเลือก ก) — ไม่ประกาศ = สืบค่าจากฉากก่อน
     ตรวจรูปแบบตรงนี้ · ตรวจว่ามัน**สมเหตุผลกับชั้นบนและชั้นล่าง**อยู่ที่ check_hud ข้อ 9 */
  for (const k in (b.front || {})){
    if (!['han','wei'].includes(k))
      err.push(`${at}: front has unknown side "${k}" — the western theatre only has han|wei`);
    else if (typeof b.front[k] !== 'number' || b.front[k] <= 0)
      err.push(`${at}: front.${k} must be a positive number (units of 10k men), not ${b.front[k]}`);
  }

  /* battle mode is gone — a scene carrying this field would silently do nothing */
  if (b.battle)
    err.push(`${at}: the battle field is retired — battle mode was removed; write losses directly`);
  if (b.hud)
    err.push(`${at}: the hud field is retired — numbers derive from held territory (see engine.strength)`);

  for (const k in (b.mapDelta || {})){
    if (!TK.regions[k]) err.push(`${at}: unknown region "${k}"`);
    /* none = independent / in revolt, belonging to no state (e.g. Gongsun Yuan's
       Liaodong in 238). The engine has supported it from the start. */
    if (!['han','wei','wu','none'].includes(b.mapDelta[k]))
      err.push(`${at}: owner must be han|wei|wu|none, not "${b.mapDelta[k]}"`);
  }

  for (const m of (b.markers || [])){
    if (!['pin','arrow','clash'].includes(m.type)) err.push(`${at}: no such marker type "${m.type}"`);
    if (m.place && !TK.places[m.place]) err.push(`${at}: unknown place "${m.place}"`);
    if (m.route && !TK.routes[m.route]) err.push(`${at}: unknown route "${m.route}"`);
    /* "none" is valid here too — bands that serve no state, like the tribes Wei pays
       to raid the Jing valley. Forcing wei would draw a Wei army where none marched. */
    if (m.side  && !['han','wei','wu','none'].includes(m.side)) err.push(`${at}: bad side "${m.side}"`);

    /* The banner chip on an arrow: who is marching, and with how many.
       `who` is an id into names.js — never a typed-out name (DECISIONS §4 rule 5).
       `name` is the escape hatch for forces with no single commander (tribal bands,
       "the Huainan army"), the same fallback battle.js uses for units without a `who`. */
    if (m.who && !TK.people[m.who])
      err.push(`${at}: unknown person "${m.who}" — add it to data/names.js or use name:"..."`);
    if (m.who && m.name)
      err.push(`${at}: marker has both who and name — pick one`);
    if (m.strength !== undefined && (typeof m.strength !== 'number' || m.strength <= 0))
      err.push(`${at}: marker strength is a positive count of men, not ${m.strength}`);
    /* strength is in men here, but losses are in ten-thousands. Writing 7 when you meant
       70000 would draw "Zhuge Liang 7" and pass every other check silently. */
    if (typeof m.strength === 'number' && m.strength > 0 && m.strength < 100)
      err.push(`${at}: marker strength ${m.strength} looks like ten-thousands — it is a count of men`);
    /* ★ 2026-08-21 — `strength` ย้ายมาอยู่บนหมุดที่มี `side` ได้ด้วย (กองรักษาการณ์)
       ส่วน who/name ยังเป็นของลูกศรอย่างเดียว เพราะป้ายหมุดคือ `label` ซึ่งเขียนชื่อได้อยู่แล้ว
       ⚠ หมุดทองห้ามมีเลข — ทองแปลว่า "ฉากนี้ชี้ตรงนี้" ไม่ใช่ "ใครถืออะไร" (D13) */
    if ((m.who || m.name) && m.type !== 'arrow')
      err.push(`${at}: who/name belong on an arrow, not on a ${m.type}`);
    if (m.strength !== undefined && m.type !== 'arrow' && m.type !== 'pin')
      err.push(`${at}: strength belongs on an arrow or a garrison pin, not on a ${m.type}`);
    if (m.strength !== undefined && m.type === 'pin' && !m.side)
      err.push(`${at}: a pin with strength needs a side — a gold pin marks where the scene ` +
               `is looking, not who is standing there (D13)`);
  }

}

/* ── accumulate deltas; the story must end with Han holding everything ── */
const owners = {};
for (const id in TK.regions) owners[id] = TK.regions[id].owner;
const flips = [];
for (const b of beats){
  for (const k in (b.mapDelta || {})){
    if (owners[k] === b.mapDelta[k])
      warn.push(`${b.id}: "${k}" already belongs to ${b.mapDelta[k]} — redundant delta`);
    else flips.push(`${b.year} ${k}: ${owners[k]}→${b.mapDelta[k]}`);
    owners[k] = b.mapDelta[k];
  }
}
/* ★ --wip  เพิ่ม 2026-08-19 เพื่อให้เขียนเรื่องทีละภาคได้
   เงื่อนไข "ต้องจบที่ฮั่นถือครบทุกเขต" ถูกต้องเฉพาะตอนเรื่องครบทั้งเล่ม
   ระหว่างเขียนทีละภาค ฮั่นยังไม่ได้ถือครบอยู่แล้วเป็นเรื่องปกติ — ถ้าไม่มีสวิตช์นี้
   ตัวสร้างจะ error แล้ว "ไม่เขียนไฟล์" ทุกครั้ง ทำให้ทำงานเป็นตอน ๆ ไม่ได้เลย
   ⚠ สวิตช์นี้ต้องดังพอที่จะไม่มีใครเผลอปล่อยไว้จนปิดเล่ม — มันพิมพ์แบนเนอร์
   และยังนับเขตที่ค้างให้ดูทุกครั้ง ห้ามใช้ตอนตรวจงานรอบสุดท้าย */
const WIP = process.argv.includes('--wip');
const notHan = Object.entries(owners).filter(([,o]) => o !== 'han').map(([k]) => k);
if (notHan.length){
  if (WIP) warn.push(`--wip: ${notHan.length}/${Object.keys(owners).length} regions are not Han yet ` +
                     `(${notHan.join(', ')}) — correct while the chronicle is unfinished, ` +
                     `an ERROR once it is done`);
  else err.push(`story ends with regions not held by Han: ${notHan.join(', ')}\n` +
                `     if you are still writing, run with --wip`);
}

/* ── report ── */
const byChapter = {};
for (const b of beats) byChapter[b.chapter] = (byChapter[b.chapter] || 0) + 1;

if (WIP) console.log('\n' + '═'.repeat(64) + '\n' +
  '  --wip  งานยังไม่จบเล่ม · ปิดเงื่อนไข "ฮั่นถือครบทุกเขต" ไว้ชั่วคราว\n' +
  '         ห้ามใช้สวิตช์นี้ตอนตรวจงานรอบสุดท้าย\n' + '═'.repeat(64));
console.log(`\ntotal beats: ${beats.length}`);
console.log('per chapter: ' + Object.entries(byChapter).map(([c,n]) => `${c}=${n}`).join('  '));
console.log(`years: ${beats[0].year} → ${beats[beats.length-1].year}`);
const withLoss = beats.filter(b => b.losses).length;
const totLoss  = beats.reduce((a,b) => a + Object.values(b.losses||{}).reduce((p,c)=>p+c,0), 0);
console.log(`scenes carrying losses: ${withLoss} · ${totLoss.toFixed(1)} ×10k men in total`);
const fc = {real:0,fiction:0,mixed:0};
beats.forEach(b => fc[b.fact] !== undefined && fc[b.fact]++);
console.log(`fact labels: real ${fc.real} · fiction ${fc.fiction} · mixed ${fc.mixed}`);
console.log(`\nterritory changes: ${flips.length}`);
flips.forEach(f => console.log('  ' + f));

if (warn.length){ console.log(`\n⚠ ${warn.length} warnings:`); warn.forEach(w => console.log('  ' + w)); }
if (err.length){
  console.log(`\n✖ ${err.length} errors — file NOT written:`);
  err.forEach(e => console.log('  ' + e));
  process.exit(1);
}

/* ── write ── */
/* multi-line print so git diffs show which scene changed */
const body = beats.map(b =>
  JSON.stringify(b, null, 2).split('\n').map(l => '  ' + l).join('\n')
).join(',\n');
const out =
`/* timeline.js — the spine of the story (see docs/SCHEMA.md)
 *
 * ⚠ GENERATED from data/_part1..5.js
 *   Edit the _partN files, then run  node tools/build_timeline.js
 *   Do not edit this file by hand — it gets overwritten.
 *
 * ${beats.length} beats · AD ${beats[0].year}–${beats[beats.length-1].year}
 */
window.TK = window.TK || {};

window.TK.chapters = ${JSON.stringify(CHAPTERS, null, 2)};

window.TK.timeline = [
${body}
];
`;
fs.writeFileSync(path.join(ROOT,'data','timeline.js'), out, 'utf8');
console.log(`\n✔ wrote data/timeline.js (${beats.length} beats)`);
