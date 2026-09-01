/* check_hud.js — ตรวจตัวเลขประชากร/กำลังพลที่คำนวณจากพื้นที่
 *
 *   node tools\check_hud.js          สรุป + เตือนถ้าผิด
 *   node tools\check_hud.js --all    พิมพ์ทุกฉากที่ตัวเลขขยับ
 *
 * ตรวจสามอย่าง:
 *   1. ยอดรวมปี 219 ต้องตรงกับ BOARD_219 §3 (ด่าน 1) และผ่านด่าน 2 (ฮั่นปี 224 = 1.50) กับด่าน 3
 *   2. ทุกเขตต้องมีน้ำหนัก ไม่งั้นเขตนั้นหายจากยอดเงียบ ๆ
 *   3. ★ กองทัพที่เนื้อเรื่องเอ่ยถึง ต้องไม่เกินกำลังพลที่ฝ่ายนั้นมีในฉากนั้น
 *      (เจอมาแล้ว: สุมาเจียว "ทุ่มยี่สิบหกหมื่น" ล้อมโซ่วชุน ทั้งที่ HUD ให้วุ่ยแค่ 19)
 *
 * ★ ตาราง WANT กับ CLAIMS เขียนใหม่ทั้งชุดสำหรับโปรเจกต์นี้ (START_HERE §5)
 *   ของเดิมเป็นของเอกภพ 228–276 ใช้ที่นี่ไม่ได้สักแถว
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'names.js'));
require(path.join(ROOT, 'data', 'geo.js'));
/* timeline.js is GENERATED and does not exist until the scenes are written. Before
   that this tool still has a job — the opening-year totals and the region weights —
   so a missing timeline is "nothing to check yet", not a crash. */
try { require(path.join(ROOT, 'data', 'timeline.js')); } catch { window.TK.timeline = []; }
window.TK.timeline = window.TK.timeline || [];

const TK = window.TK, T = TK.timeline;
const SIDES = ['han','wei','wu'];
const LBL = s => TK.factions[s].label;

/* ยอดตั้งต้น ฤดูร้อน ค.ศ. 221 — คำนวณจาก data/geo.js ของโปรเจกต์นี้โดยตรง
   ⚠ **ห้ามลอกจากโปรเจกต์ 1 หรือ 2** ทั้งสองชุดเป็นของกระดานคนละปีและคนละเส้นแบ่ง
   สามอย่างที่ต่างและตั้งใจให้ต่าง:
     · ง่อ 2.07 ไม่ใช่ 1.85 — เอกภพนี้ง่อถือ Jing Zhou ทั้งผืนตั้งแต่ปี 220 เพราะ Guan Yu ตายแล้ว
     · ฮั่น 1.03 ไม่ใช่ 1.30 — ยังไม่มี Longyou ยังไม่มี Hexi และไม่มี Jing Zhou ตะวันตกอีกแล้ว
     · วุ่ย 4.73 ไม่ใช่ 4.40 — เพราะภาคตะวันตกถูกแตกละเอียดและให้น้ำหนักตามจริง รวมประชากร
       เผ่า Qiang กับ Di ที่ทะเบียนราชการไม่เคยนับ แต่ส่งทหารม้าให้จริง (DECISIONS §9)
   ยอดฮั่นจะขึ้นถึงราว 1.44 ในปี 226 ซึ่งตรงกับที่ Liu Bei พูดข้างเตียงว่าคนล้านครึ่ง

   ⚠⚠ **กำลังพลฮั่นในเอกภพนี้จะไม่มีวันตกฮวบเหมือนเอกภพของเรา** เพราะไม่มี Yiling
   ให้หัก จึงไม่มีบรรทัด losses ก้อนใหญ่ในปี 222 · ตัวเลขตั้งต้นเท่ากัน สิ่งที่ต่างคือ
   ไม่มีอะไรมาลบ — ถ้าวันหนึ่งเห็นกำลังฮั่นดิ่งลงในช่วงปี 222 แปลว่ามีคนเผลอใส่ losses ผิดที่ */
const WANT = { han:[1.03,12.5], wei:[4.73,43.6], wu:[2.07,18.5] };

if (!T.length){
  /* Phase 3 gate: geo.js exists, no scenes yet. Check what can be checked — every
     region carries a weight, and the three opening totals come out where BOARD_219
     says they must. */
  const bad = [];
  const missing = Object.keys(TK.regions).filter(id => TK.regions[id].pop === undefined);
  if (missing.length) bad.push("regions without weights: " + missing.join(", "));

  const open = { han:{pop:0,troops:0}, wei:{pop:0,troops:0}, wu:{pop:0,troops:0} };
  for (const id in TK.regions){
    const r = TK.regions[id];
    if (open[r.owner] && r.pop !== undefined){ open[r.owner].pop += r.pop;
                                               open[r.owner].troops += r.troops; }
  }
  console.log("no scenes yet — checking the opening board of 219 on its own\n");
  for (const k of SIDES){
    const [wp, wt] = WANT[k];
    const gp = Math.round(open[k].pop * 1000) / 1000;
    const gt = Math.round(open[k].troops * 100) / 100;
    const okP = Math.abs(gp - wp) < 0.005, okT = Math.abs(gt - wt) < 0.05;
    console.log("  " + LBL(k).padEnd(4) + " " + String(gp).padEnd(6) + "M / " +
                String(gt).padEnd(5) + "x10k   want " + wp + "M / " + wt +
                "   " + (okP && okT ? "✓" : "✗"));
    if (!okP) bad.push(LBL(k) + " population in 219 = " + gp + ", should be " + wp);
    if (!okT) bad.push(LBL(k) + " strength in 219 = " + gt + ", should be " + wt);
  }

  /* Gate 2 — the one figure the prose states outright, in Part Five */
  const HAN224 = ["yizhou","hanzhong","jingzhou_w","shangyong",
                  "xiangyang","nanyang_s","longyou","anding"];
  let h224 = 0, w224 = 0;
  for (const id of HAN224){ const r = TK.regions[id];
    if (!r) { bad.push("region named in the 224 check does not exist: " + id); continue; }
    h224 += r.pop; }
  for (const id in TK.regions){ const r = TK.regions[id];
    if (r.owner === "wei" && !HAN224.includes(id) && r.pop !== undefined) w224 += r.pop; }
  h224 = Math.round(h224 * 1000) / 1000; w224 = Math.round(w224 * 1000) / 1000;
  console.log("\n  224: Han " + h224 + "M vs Wei " + w224 + "M — \"Wei in 224 had over " +
              "four million registered people against Han's one and a half\"");
  if (Math.abs(h224 - 1.5) > 0.005) bad.push("Han in 224 = " + h224 + ", the story says 1.5");
  if (!(w224 > 4))                  bad.push("Wei in 224 = " + w224 + ", the story says over 4");

  /* Gate 3 — Part Six, on taking Guanzhong */
  const gz = TK.regions.guanzhong;
  if (!gz || gz.pop !== 0.26)
    bad.push("guanzhong = " + (gz && gz.pop) + ", the story says \"a quarter of a " +
             "million more mouths\"");
  else console.log("  227: Guanzhong " + gz.pop + "M — \"a quarter of a million more " +
                   "mouths\" ✓");

  console.log("");
  for (const e of bad) console.log("✖ " + e);
  console.log(bad.length ? bad.length + " problem(s) found"
    : "all " + Object.keys(TK.regions).length + " regions carry weights · the opening " +
      "board of 219 and all three calibration gates match BOARD_219");
  process.exit(bad.length ? 1 : 0);
}

/* ── ต้องเหมือน engine.strength() ทุกบรรทัด ── */
const RECOVER = 0.68, DESPERATION = 0.5;
const BASE219 = (() => { const b = { han:0, wei:0, wu:0 };
  for (const id in TK.regions){ const r = TK.regions[id];
    if (b[r.owner] !== undefined && r.troops !== undefined) b[r.owner] += r.troops; }
  return b; })();

function ownersAt(n){
  const o = {}; for (const id in TK.regions) o[id] = TK.regions[id].owner;
  for (let k = 0; k <= n; k++) Object.assign(o, T[k].mapDelta || {});
  return o;
}

/* ★★ การหน่วงกำลังพล และทัพที่ถอนออกมา — สำเนาของ engine.js
   เหตุผลเต็มอยู่ที่นั่นและใน docs/PROPOSAL_ch7_8.md §3.1 · ⚠ แก้ที่ไหนต้องแก้อีกที่ให้ตรงกัน */
const DIGEST = [0, 0.25, 0.50, 0.75];     /* ผู้ยึด · อายุ 0–3 ปี · ตั้งแต่ปีที่ 4 = เต็ม */
const EVAC   = [0.60, 0.40, 0.25, 0.10];  /* ผู้เสีย · ทัพที่ถอนออกมาและยังไม่ถูกทดแทน */
const digest = a => a >= DIGEST.length ? 1 : DIGEST[a];
const evac   = a => a >= EVAC.length   ? 0 : EVAC[a];

function ownershipAt(n){
  const o = {}; for (const id in TK.regions) o[id] = TK.regions[id].owner;
  const moved = {};
  for (let k = 0; k <= n; k++){
    const d = T[k].mapDelta; if (!d) continue;
    for (const id in d){
      if (d[id] === o[id]) continue;
      moved[id] = { year: T[k].year, from: o[id] };
      o[id] = d[id];
    }
  }
  return { owners:o, moved };
}

function strength(n){
  const { owners:o, moved } = ownershipAt(n);
  const s = { han:{pop:0,troops:0}, wei:{pop:0,troops:0}, wu:{pop:0,troops:0} };
  const year = T[n].year;
  for (const id in o){ const side = s[o[id]], r = TK.regions[id];
    if (!r || r.pop === undefined) continue;
    const m   = moved[id];
    const age = m ? Math.max(0, year - m.year) : 99;
    if (side){ side.pop += r.pop; side.troops += r.troops * digest(age); }
    if (m && o[id] !== 'none' && s[m.from]) s[m.from].troops += r.troops * evac(age); }
  for (const k in s){
    const share = BASE219[k] ? s[k].troops / BASE219[k] : 1;
    s[k].troops *= 1 + DESPERATION * Math.max(0, 1 - share);
  }
  /* ★ ต้องเดินตาม js/engine.js ให้ตรงทุกบรรทัด ไม่งั้นตัวตรวจจะสอบเลขคนละชุดกับที่คนอ่านเห็น
     2026-08-27 เพิ่ม taken (ไม่มี RECOVER) + ปัดที่หลักพันแทนหลักหมื่น */
  for (let k = 0; k <= n; k++){
    const age = Math.max(0, year - T[k].year);
    const L = T[k].losses;
    if (L) for (const w in L) if (s[w]) s[w].troops -= L[w] * Math.pow(RECOVER, age);
    const K = T[k].taken;
    if (K) for (const w in K) if (s[w]) s[w].troops -= K[w];
  }
  for (const k in s){ s[k].pop = Math.round(s[k].pop*10)/10;
                      s[k].troops = Math.max(0, Math.round(s[k].troops*10)/10); }
  return s;
}

const err = [];
const warn = [];   /* ข้อ 5 ใช้ — เตือนแต่ไม่ทำให้ build ล้ม */

/* 1 + 2 */
const noWeight = Object.keys(TK.regions).filter(id => TK.regions[id].pop === undefined);
if (noWeight.length) err.push(`regions without weights in geo.js: ${noWeight.join(', ')}`);

const s0 = strength(0);
for (const k of SIDES){
  const [p, t] = WANT[k];
  if (Math.abs(s0[k].pop - p) > 0.05)
    err.push(`${LBL(k)} population in 221 = ${s0[k].pop}, should be ${p}`);
  if (Math.abs(s0[k].troops - t) > 0.5)
    err.push(`${LBL(k)} strength in 221 = ${s0[k].troops}, should be ${t}`);
}

/* 3. Army sizes the prose names outright — each must fit inside the strength that side
      actually has in that scene. Listed by hand because pulling numbers out of English
/* ★★ เขียนใหม่ทั้งตารางสำหรับโปรเจกต์นี้ 2026-08-25
      ของโปรเจกต์ 2 ถูกลบทิ้งทั้งชุด — ไม่มี scene id ไหนของมันมีอยู่ในเล่มนี้เลย

      `id` เป็น null จนกว่าฉากที่แบกประโยคนั้นจะถูกเขียนจริง · null ถูกรายงานว่า
      **ค้างอยู่** ไม่ใช่ผ่าน — ไม่งั้นตารางนี้จะเงียบและไม่ตรวจอะไรเลยตลอดช่วงที่
      พงศาวดารกำลังเขียน ซึ่งคือ failure mode ที่โปรเจกต์ก่อนเตือนไว้สองรอบ

      [id, ฝ่าย, หมื่นคนที่เรื่องอ้าง, ปี, คำในเรื่อง] */
const CLAIMS = [
  /* ── บทที่ 1 · 221 ── */
  ["c1-06", "han",  4.5, 221, "ทัพหลวงเคลื่อนขึ้นเหนือสู่ฮั่นจง — ต้นฉบับไม่ได้ให้เลข ตั้งไว้ที่ 45,000"],
  ["c1-07", "wu",   5,   221, "ตรึงทหารง่อห้าหมื่นคนไว้ที่จิงโจวตลอดไป"],

  /* ── บทที่ 2 · 221–222 ── */
  ["c2-02", "han",  1.5, 221, "ทัพหน้าหมื่นห้ายกจากฮั่นจงขึ้นสายอู่ตู"],
  ["c2-04", "han",  1.2, 222, "เราได้ทหารม้าหนึ่งหมื่นสองพันโดยไม่เสียเลือดสักหยด"],

  /* ── บทที่ 3 · 223–225 ── */
  ["c3-01", "wu",   0.5, 222, "จูหรันยันเจียงหลิงไว้ได้หกเดือนเต็มด้วยทหารห้าพัน"],
  ["c3-03", "han",  1.5, 223, "มีทหารหมื่นห้า และมีคำสั่งข้อเดียวคือห้ามขยับ"],
  ["c3-09", "han",  1.8, 225, "กองทหารม้าฮั่นชุดแรกจำนวนหนึ่งหมื่นแปดพันคน"],
  [null,    "han",  1.5, 223, "Zhang Fei ถือบ่าตะวันออก ... มีทหารหมื่นห้า"],

  /* ── บทที่ 4 · 224–225 ── */
  ["c4-04",  "wei",  6,   224, "ทัพวุ่ยเคลื่อนออกจาก Chencang ... กำลังพลหกหมื่น"],
  ["c4-05",  "han",  2.2, 224, "ทหารสองหมื่นสองพัน ทหารม้าเผ่า Qiang อีกหมื่นสอง"],
  ["c4-09",  "han",  6.4, 225, "สามก้อน: 22,000 + 30,000 ของหม่าไต้ + ม้าเชียง 12,000"],

  /* ── บทที่ 6 · 227–231 (id ชุด 15 ฉาก — รีนัมเบอร์ 2026-08-26) ── */
  ["c6-03",  "han",  3,   227, "ทัพหลวงสามหมื่นเคลื่อนจากจี้เฉิงมาตั้งที่เทียนสุ่ย"],
  ["c6-03",  "wei",  6,   227, "เฉาเจินถือทัพสนามราวหกหมื่น … อยู่ที่ฉางอาน"],
  ["c6-05",  "han",  3,   228, "กองทัพฮั่นสามหมื่นคน (ล้อม Chencang)"],
  ["c6-05",  "wei",  0.1, 228, "ทหารหนึ่งพันคน ต่อสามหมื่น ยี่สิบสองวัน"],
  ["c6-05",  "wei",  2.5, 228, "กองหนุน … สองหมื่นห้าภายใต้เฉาเจินเอง"],
  ["c6-07",  "wei",  0.8, 229, "กัวหวยกับเฟ่ยเย่านำทหารม้าแปดพันออกจากฉางอาน"],
  ["c6-09",  "han",  1,   230, "เขาขอทหารม้าหนึ่งหมื่น (Wei Yan · Yangxi)"],
  ["c6-10",  "wei",  4,   231, "ทัพกลางที่ราชสำนักมอบให้สี่หมื่น"],
  ["c6-12",  "wei",  5.2, 231, "สามกองม้าเบารวมหมื่นสอง + ทัพหลักสี่หมื่น"],
  ["c6-12",  "han",  3,   231, "กองทัพฮั่นทั้งกองที่กำลังกดดันเฉินชางอยู่"],
  ["c6-14",  "han",  0.3, 231, "เขาถือช่องแคบที่ Mumen ไว้สิบเอ็ดวันด้วยทหารสามพันคน"],

  /* ── บทที่ 7 · 232–234 (id ชุด 15 ฉาก — รีนัมเบอร์ 2026-08-27 ตอนแตก beat ·
        แถววุ่ยสี่แถวใหม่ = มวลวุ่ยที่เพิ่งได้เลขบนจอ ต้องสอบกับ HUD ด้วย) ── */
  ["c7-03",  "han",  2.5, 232, "ทัพหลวงสองหมื่นห้า — ศึกชิงคืนครั้งที่สอง"],
  ["c7-03",  "wei",  6.3, 232, "กัวหวยมีทหารหกหมื่นสามพันอยู่ในมือ และไม่ส่งไปช่วยแม้แต่กองเดียว"],
  ["c7-05",  "han",  4,   233, "คีมสองแขน: หุบเว่ย 25,000 + ด่านซ่าน 15,000"],
  ["c7-06",  "wei",  2.5, 233, "เขานำทหารสองหมื่นห้าออกจากฉางอานด้วยตัวเอง (กองหนุนเฉินชาง)"],
  ["c7-08",  "han",  2,   233, "ทหารม้าสองหมื่นจากทุ่งหญ้า Longyou กับ Hexi"],
  ["c7-08",  "wei",  2,   233, "ม้าทั้งภาคตะวันตกสองหมื่นตั้งรอที่เป่ยหยวน (¶540 จำนวนพอ ๆ กัน)"],
  ["c7-10",  "wei",  3,   234, "ฉินหลางกับทัพกลางสามหมื่นขึ้นถนนหลวง"],
  ["c7-11",  "han",  1.5, 234, "เว่ยเหยียนออกจากค่ายเหมยกับทหารหมื่นห้า (12k สัน + 3k ด่านอู่)"],
  ["c7-12",  "wei",  2,   234, "Guo Huai นำทหารสองหมื่นถอยออกทาง Tong Pass"],

  /* ── บทที่ 8 · 235–241 ── */
  ["c8-12", "wei",  8,   241, "เขาเข้ามาในเดือนที่สาม กำลังพลแปดหมื่น"],

  /* ── บทที่ 9 · 242–248 ── */
  ["c9-07", "wei", 10,   244, "Cao Shuang เดินเข้าไปในนั้นด้วยกำลังหนึ่งแสนคน"],
  ["c9-08", "han",  3,   244, "Wang Ping มีทหารสามหมื่นคน ซึ่งน้อยกว่าหนึ่งในสาม"],

  /* ── บทที่ 10 · 249–262 ── */
  ["c10-07", "wei", 15,  257, "Zhuge Dan ก่อการครั้งที่สาม ... ด้วยกำลังสิบห้าหมื่น"],
  ["c10-07", "wu",   3,  257, "Sun Chen เลือกส่งกำลังไปสามหมื่น"],

  /* ── บทที่ 11 · 263–274 ── */
  /* ★ ปี 270 ไม่ใช่ 269 — ต้นฉบับขัดกันเองเรื่องปฏิทิน เจ้าของเคาะทางออกแล้ว
     (STORY_DEBT #4: ฎีกา 269 秋 → ทัพเคลื่อน 270 春 ซึ่งทำให้ "ห้าปี" ของลู่ค่างเป๊ะ) */
  ["c11-05", "han", 21,  270, "รวมสองแสนหนึ่งหมื่นคน (หกทัพ)"],
  ["c11-02", "wu",   5,  264, "ทหารง่อห้าหมื่นคนก็ยังเฝ้าแนวตะวันตกอยู่ที่เดิม"]
];
let pending = 0;
for (const [id, side, need, year, quote] of CLAIMS){
  if (id === null){ pending++; continue; }
  const n = T.findIndex(b => b.id === id);
  if (n < 0){ err.push("scene " + id + " referenced in CLAIMS not found"); continue; }
  if (T[n].year !== year)
    err.push(id + ": CLAIMS says " + year + " but the scene is dated " + T[n].year);
  const have = strength(n)[side].troops;
  if (have < need)
    err.push(id + " " + T[n].year + ": story says \"" + quote + "\" (" + need +
             " x10k) but " + LBL(side) + " only has " + have + " x10k");
}
if (pending)
  console.log("note: " + pending + " of " + CLAIMS.length + " army sizes have no scene id " +
              "yet and were NOT checked\n");

/* 4. ★ ป้ายธงบนลูกศร — กำลังพลที่เขียนบนแผนที่ต้องไม่เกินที่ฝ่ายนั้นมีจริงในฉากนั้น
      ต่างจาก CLAIMS ข้างบนตรงที่อันนี้ไม่ต้องดูแลด้วยมือเลย ตัวเลขอยู่ในข้อมูลอยู่แล้ว
      เพิ่มไว้เพราะป้ายธงเป็นตัวเลขที่ "คนอ่านเห็นบนแผนที่" ถ้ามันขัดกับหลอด HUD
      ที่อยู่มุมล่างซ้ายของจอเดียวกัน คนอ่านจับได้ทันที
      side "none" ไม่นับ — เผ่าที่วุ่ยจ้างไม่ได้กินกำลังพลของรัฐไหน */
let chips = 0;
T.forEach((b, n) => {
  /* ★ 2026-08-21 — หมุดกองรักษาการณ์นับด้วย (`{type:"pin", side, strength}`)
     ทหารที่ยืนอยู่บนกำแพงกินกำลังของรัฐเท่ากับทหารที่เดิน · ตัวแปรยังชื่อ arrows ตามเดิม */
  const arrows = (b.markers || []).filter(m =>
    (m.type === 'arrow' || m.type === 'pin') && m.strength !== undefined);
  if (!arrows.length) return;
  const s = strength(n);
  for (const m of arrows){
    chips++;
    const nm = m.who ? TK.people[m.who].label : (m.name || m.label || '?');
    if (!SIDES.includes(m.side)) continue;
    const need = m.strength / 10000, have = s[m.side].troops;
    if (need > have + 0.5)
      err.push(`${b.id} ${b.year}: arrow "${nm}" carries ${m.strength.toLocaleString('en-US')} ` +
               `(${need} ×10k) but ${LBL(m.side)} only has ${have} ×10k`);
    /* คนกับธงต้องเป็นฝ่ายเดียวกัน — ยกเว้นคนที่เปลี่ยนธง (was) ซึ่งถูกทั้งสองฝั่งตามปี */
    const p = m.who && TK.people[m.who];
    if (p && p.side !== m.side && p.was !== m.side)
      err.push(`${b.id}: arrow flies ${LBL(m.side)} but ${p.label} is ${LBL(p.side)}`);
  }
});

/* ── 5. ★ สัดส่วนของกำลังทั้งรัฐที่ลูกศรหนึ่งอันกินไป — เพิ่ม 2026-08-20 ──────────
   ที่มา: รีวิวจากภายนอก (What_If_Three_Kingdoms_Military_Review_for_Claude.md) ทักว่า
   "Han ดูเหมือนมีทหารเพิ่มไม่รู้จบ" · ไล่ตัวเลขจริงแล้วพบว่า**ไม่จริง** — ฮั่นโตจาก 160k
   เป็น 200k ในสิบสี่ปี และทุกหน่วยมาจากการได้แผ่นดิน ไม่ใช่การเกณฑ์คน
   แต่ข้อ 4 ข้างบนหลวมเกินกว่าจะยืนยันเรื่องนี้ได้: มันตรวจแค่ว่า strength ไม่เกิน**ยอดรวม**
   ซึ่ง 60,000 ผ่านสบาย ๆ ทั้งที่มันคือ 40% ของกำลังทั้งรัฐ

   ข้อนี้จึงถามคำถามที่ควรถาม: **ทัพกองเดียวกินสัดส่วนเท่าไรของทั้งรัฐ**
   เกิน 35% = การทุ่มสุดตัวครั้งเดียว ซึ่งมีได้ แต่ต้องเป็นการตัดสินใจ ไม่ใช่ของที่หลุดมา
   ประกาศใน SHARE_OK พร้อมเหตุผล เหมือน STRAIGHT_OK กับ SHAPE_OK ใน check_routes */
const SHARE_OK = {
  /* ★★ แถวแรกของโปรเจกต์นี้ · เพิ่ม 2026-08-27 — **ไม่ใช่การเพิ่มเพื่อให้ผ่าน**
     มันโผล่ขึ้นมาเพราะวันเดียวกันนั้นการปัดตัวเลขเปลี่ยนจากหลักหมื่นเป็นหลักพัน:
       ตัวหารเดิมถูกปัดเป็น 130,000 → 45,000 อ่านได้ 34.6% ผ่านฉิวเฉียด
       ตัวหารจริงคือ 125,000 → **36.0% และเป็นแบบนี้มาตั้งแต่วันแรก** การปัดหยาบกลบไว้
     (HANDOFF §3 ที่เขียนว่า "45,000 = 35% พอดี" ก็เป็นผลของการปัดอันเดียวกัน — แก้แล้ว)
     ที่ยกเว้นให้ เพราะมันคือเคสที่กติกาข้อนี้เจาะช่องไว้ให้พอดีเป๊ะ ไม่ใช่เพราะอยากให้เขียว */
  "c1-06": "ราชโองการฉบับแรกของรัชกาล — หลิวเป้ยยกทัพขึ้นฮั่นจงด้วยตัวเอง ครั้งเดียว" +
           "ในเรื่องทั้งเรื่อง · นี่คือ 'การทุ่มสุดตัวครั้งเดียว' ที่กติกาข้อนี้เจาะช่องไว้ให้ " +
           "ยอด 45,000 ตั้งจากกำลังที่หลิวเป้ยยกไปอี๋หลิงจริงในเอกภพของเรา (HANDOFF §3)",

  /* ★★ 2026-09-01 · c11-11 คือฉากที่ง่อหมดตัวในเฟรมเดียว — **ตัวส่วนถูกทำลาย
     โดยเหตุการณ์ของฉากเอง** ไม่ใช่โดยขนาดของกอง (`strength(n)` คือสถานะ*หลัง*
     losses+taken ของฉากนั้นแล้ว · เขตทั้งสี่เปลี่ยนมือในฉากเดียวกัน ประชากรจึงเป็นศูนย์)
     ตัวหารที่ถูกต้องคือกำลังของง่อ**ก่อน**ฉากนี้ = 149,000 → 50,000 คือ 34% ผ่านพอดี
     ★ และห้าหมื่นนี้ไม่ใช่ตัวเลขที่เลือกมาลอย ๆ มันต้องเท่ากับห้าหมื่นของลู่ค่าง
       เป๊ะ ๆ เพราะประเด็นทั้งฉากคือ **กองล่อตรึงคนจำนวนเท่ากันไว้ไม่ให้ไปช่วยเขา**
     ตระกูลเดียวกับ LOSS_OK ของ c4-06/c10-08 — หมุดคือกำลังก่อนเหตุการณ์ */
  "c11-11": "ฉากที่ง่อหมดตัว — ตัวส่วนเป็นศูนย์เพราะเขตทั้งสี่เปลี่ยนมือในฉากเดียวกันนี้ " +
            "ตัวหารจริงคือ 149,000 ของก่อนหน้า → 34% · และห้าหมื่นนี้ต้องเท่ากับ" +
            "ห้าหมื่นของลู่ค่างพอดี เพราะประเด็นของฉากคือกองล่อตรึงคนจำนวนเท่ากันไว้",

  /* ★ ว่างเปล่าโดยตั้งใจ 2026-08-25 — รายการของโปรเจกต์ 2 ถูกลบทิ้งทั้งชุด ไม่มี scene id ไหนตรงกัน
     เพิ่มเข้ามาได้เฉพาะตอนที่เรื่องต้องการทัพกองเดียวเกิน 35% ของทั้งรัฐจริง ๆ **และต้องเขียนเหตุผลกำกับ**
     ตารางนี้มีไว้ให้การทุ่มสุดตัวเป็นการตัดสินใจที่มองเห็น ไม่ใช่ที่ปิดเสียงเตือน
     ⚠ ถ้าพบว่าตัวเองอยากเพิ่มแถวเพื่อให้ผ่าน ให้กลับไปดูตัวเลขก่อน — c1-06 รอบแรกตั้งไว้ 60,000
        ซึ่งเป็นเลขที่ผมเดาเอง ต้นฉบับไม่ได้ให้ไว้ · ลดเป็น 45,000 ตรงกับกำลังที่ Liu Bei ยกไป
        Yiling จริงในเอกภพของเรามากกว่า และผ่านเพดานพอดี ไม่ต้องยกเว้นอะไรเลย */
};

const SHARE_CAP = 0.35;
const ledger = [];
T.forEach((b, n) => {
  /* ★ 2026-08-21 — หมุดกองรักษาการณ์นับด้วย (`{type:"pin", side, strength}`)
     ทหารที่ยืนอยู่บนกำแพงกินกำลังของรัฐเท่ากับทหารที่เดิน · ตัวแปรยังชื่อ arrows ตามเดิม */
  const arrows = (b.markers || []).filter(m =>
    (m.type === 'arrow' || m.type === 'pin') && m.strength !== undefined);
  if (!arrows.length) return;
  const st = strength(n);
  for (const m of arrows){
    if (!SIDES.includes(m.side)) continue;
    const have = st[m.side].troops * 10000;
    const share = m.strength / have;
    const nm = m.who ? TK.people[m.who].label : (m.name || m.label || '?');
    ledger.push([b.id, b.year, LBL(m.side), nm, m.strength, have, share]);
    if (share <= SHARE_CAP) continue;
    const line = `${b.id} ${b.year}: "${nm}" carries ${m.strength.toLocaleString('en-US')} — ` +
                 `${(share*100).toFixed(0)}% of everything ${LBL(m.side)} can levy ` +
                 `(${have.toLocaleString('en-US')})`;
    if (SHARE_OK[b.id]) warn.push(line + ' — allowed: ' + SHARE_OK[b.id]);
    else err.push(line + '. One field army over ' + (SHARE_CAP*100) + '% of the state is a ' +
                  'once-in-a-reign decision, not a default. Lower it, or add it to SHARE_OK ' +
                  'with the reason.');
  }
});

/* ── 6. ★★ `losses` ต้องมีตัวส่วน — เพิ่ม 2026-08-21 ────────────────────────────
   ที่มา: เจ้าของอ่านสเกลทั้งเล่มแล้วบอกว่า *"ยกไปกิสานแค่ 4 หมื่นเอง ศึกกวนจงก็ตายไปเป็นหมื่น …
   สเกลดูไม่ค่อยลงตัวเท่าไหร่เรื่องกำลังพล"* · ไล่ทุกฉากที่มี `losses` เทียบกับกำลังที่วาดไว้ในฉากนั้น
   แล้วพบว่า **หนึ่งในสามของฉากที่เสียคน ไม่มีกองทัพอยู่บนแผนที่เลยให้เสียมาจาก** และที่มีก็หลุดสเกล:

     c1-01  เว่ยเสีย 30,000 · กำลังเว่ยที่วาดไว้ 4,000  → **750%**
     c4-06  เว่ยเสีย 60,000 · กำลังเว่ยที่วาดไว้ **ศูนย์**
     c6-15  ฮั่นเสีย 9,000 จากกองรักษาการณ์ 15,000 → 60% "ขณะที่ยันไว้ได้"
     c8-12  ฮั่นเสีย 11,000 · เว่ยเสีย 8,000 · **ทั้งสองฝ่ายไม่มีเลขบนแผนที่เลย**

   นี่คือสิ่งที่ทำให้ "สเกลไม่ลงตัว" — ตัวเลขไม่ได้ผูกกัน กำลังอยู่ฉากหนึ่ง ความตายอยู่อีกฉากหนึ่ง
   และคนอ่านมองไม่เห็นความสัมพันธ์ · กฎ "losses ต้องมีตัวส่วน" มีอยู่แล้ว **แต่ไม่มีใครตรวจ**
   (⚠ อ้างอิงเดิมเขียนว่า §17 — นั่นคือ DECISIONS ของโปรเจกต์ 2 · §17 ของเล่มนี้คือวงเส้นประ)

   ⚠ **เตือน ไม่ใช่ error** เพราะมีเคสที่ถูกต้อง: บิลของทั้งแคมเปญมาลงที่ฉากปิดแคมเปญ
   ประกาศใน `LOSS_OK` พร้อมเหตุผล รูปแบบเดียวกับ STRAIGHT_OK / SHAPE_OK / SHARE_OK / SOLO_OK */
const LOSS_OK = {
  "c1-01": 'อิกิ๋มถูกจับ ไม่ได้ตาย — 30,000 คือเชลย และตอนนี้มีหมุดของเขาบนแผนที่แล้ว',
  "c8-18": 'ค่าสึกหรอของการเดินสี่พันลี้สองเที่ยวบวกล้อมสามเดือน ไม่ใช่ความพ่ายแพ้ — เว่ยชนะแคมเปญนี้',
  /* ★ หมุดในฉากนี้คือ**ผู้รอดชีวิต** ไม่ใช่กำลังที่ยกไป — ตัวตรวจหารด้วยตัวเลขที่เหลือ ไม่ใช่ตัวเลขที่ไป
     บัญชีลงตัวพอดีทั้งแคมเปญ และตั้งใจให้ลงตัว:
       ยกไป (c4-02)  โจจิ๋น 90k + เตียวคับ 40k + กุยห้วย 25k = **155,000**
       รอดกลับ (c4-06) 40k + 33k + 22k                       = **95,000**
       ส่วนต่าง                                               = **60,000 = losses.wei 6.0**
     และ 40 จาก 90 ของโจจิ๋นคือ "something under half of what he brought in" ตรงตามต้นฉบับ */
  "c4-06": 'หมุดคือผู้รอดชีวิต ไม่ใช่กำลังที่ยกไป — 155,000 ไป · 95,000 กลับ · ส่วนต่าง 60,000 ตรงกับ losses พอดี',
  /* ★ 2026-08-31 — ตัวหารซ้ำแบบเดียวกับ c4-06 กลับด้าน: หมุดคือกำลังที่ยกเข้าไป
     (30,000) ส่วนลูกศรถอยคือคนกลุ่มเดียวกันที่เดินออกมาได้ (3,000) ตัวตรวจบวก
     สองก้อนเป็น 33,000 ซึ่งนับคนสามพันนั้นสองครั้ง · ตัวหารจริงคือ 30,000 = 90%
     และเก้าสิบเปอร์เซ็นต์ **คือเนื้อเรื่องของฉาก** ไม่ใช่ความผิดพลาดของสเกล —
     ¶890 เขียนเองว่า "ออกมาได้ไม่ถึงหนึ่งในสิบ" */
  "c10-08": 'หมุด 30,000 คือกำลังที่ยกเข้าไป · ลูกศรถอย 3,000 คือคนกลุ่มเดียวกันที่เดินออกมา — ตัวหารจริงคือ 30,000 และ 90% คือประโยคของต้นฉบับเอง (¶890)'
};
const LOSS_CAP = 0.55;
T.forEach(b => {
  if (!b.losses) return;
  for (const side of SIDES){
    if (!b.losses[side]) continue;
    const shown = (b.markers || [])
      .filter(m => m.side === side && m.strength !== undefined)
      .reduce((s, m) => s + m.strength, 0);
    const lost = b.losses[side] * 10000;
    const head = `${b.id} ${b.year}: ${LBL(side)} loses ${lost.toLocaleString('en-US')}`;
    let line = null;
    if (!shown)
      line = `${head} but has no force on the map in this scene to lose them from — ` +
             `a number the reader cannot divide is a number the reader cannot feel`;
    else if (lost / shown > LOSS_CAP)
      line = `${head} out of the ${shown.toLocaleString('en-US')} shown — ` +
             `${(lost/shown*100).toFixed(0)}%, which is annihilation rather than a battle`;
    if (!line) continue;
    if (LOSS_OK[b.id]) warn.push(line + ' — allowed: ' + LOSS_OK[b.id]);
    else warn.push(line);
  }
});

/* ── รายงาน ── */
const showAll = process.argv.includes('--all');
let moves = 0, prev = null; const lines = [];
T.forEach((b, n) => {
  const s = strength(n);
  const key = SIDES.map(k => s[k].pop + '/' + s[k].troops).join('|');
  if (key !== prev){ moves++;
    lines.push(`  ${b.id} ${b.year}  ` +
      /* ★ 2026-08-27 — เดิมเขียน `${troops}0k` คือเอา 43 มาต่อ "0k" ให้เป็น "430k"
         ซึ่งเป็นลูกเล่นที่ใช้ได้เฉพาะตอนค่าเป็นจำนวนเต็มหมื่น · พอปัดที่หลักพันแล้ว
         43.6 กลายเป็น "43.60k" ทันที — คูณสิบให้ตรงไปตรงมาแทน */
      SIDES.map(k => `${LBL(k)} ${s[k].pop}M/${Math.round(s[k].troops * 10)}k`).join('  ')); }
  prev = key;
});
if (ledger.length){
  console.log('army sizes printed on the map, as a share of what that state can levy:\n');
  for (const [id, yr, side, nm, n, have, sh] of ledger)
    console.log('  ' + (sh > SHARE_CAP ? '⚠' : ' ') + ' ' + id.padEnd(7) + yr + '  ' +
      side.padEnd(4) + (n/1000 + 'k').padStart(5) + ' / ' + (have/1000 + 'k').padStart(6) +
      ' = ' + (sh*100).toFixed(0).padStart(3) + '%   ' + nm);
  console.log('');
}

/* ── 7 + 8. ★★ แผ่นดินต้องมีราคา และไม่มีใครนิ่งได้นานเกินไป (เพิ่ม 2026-08-21) ────────
   ที่มา: docs/PROPOSAL_ch7_8.md §1 · เจ้าของอ่านบทที่ 7–8 แล้วบอกว่า *"เว่ยมันแพ้แบบโคตรง่ายเลย"*
   ไล่ตัวเลขแล้วพบว่ามันวัดได้ ไม่ใช่เรื่องรสนิยม:

     219–232  แผ่นดินเปลี่ยนมือ  56,000 หน่วยกำลังพล · เลือด 309,000  → แผ่นดิน/เลือด = 0.18
     233–248  แผ่นดินเปลี่ยนมือ 344,000 หน่วยกำลังพล · เลือด  55,000  → แผ่นดิน/เลือด = 6.25

   **ต่างกัน 35 เท่า และครึ่งหลังคือครึ่งที่จักรวรรดิเปลี่ยนมือ** · ตัวตรวจทั้งหกที่มีอยู่
   ไม่มีตัวไหนถามคำถามนี้เลย เพราะทุกตัวตรวจ *ฉาก* ทีละฉาก และความโล้นเป็นสมบัติของ *ปี*
   นี่คือตัวตรวจตัวที่สี่ในโปรเจกต์นี้ที่ถูกเขียนขึ้นเพราะกฎมีอยู่แล้วแต่ไม่มีใครบังคับ
   (ต่อจาก check_routes รูปทรง · check_map ข้อ 6 · check_hud ข้อ 6)

   ⚠ ทั้งสองข้อเป็น **คำเตือน ไม่ใช่ error** — มีปีที่เงียบโดยชอบธรรมจริง ๆ (222 · 233)
   หน้าที่ของมันคือทำให้ความเงียบเป็นสิ่งที่ต้อง *ตอบ* ไม่ใช่สิ่งที่เกิดขึ้นเองโดยไม่มีใครเห็น */
const GROUND_CAP = 3.0;    /* หน่วยกำลังพลของเขต (3.0 = 30,000) ที่ย้ายได้ในหนึ่งปีโดยไม่ต้องมีเลือด */
const QUIET_CAP  = 4;      /* จำนวนปีติดกันที่ฝ่ายหนึ่งไม่เสียคนเลยได้ ขณะที่ยังเสียแผ่นดินอยู่ */
/* ปีที่แผ่นดินย้ายเยอะโดยไม่มีเลือด **โดยชอบธรรม** — ประกาศพร้อมเหตุผล แบบเดียวกับ SHARE_OK */
const GROUND_OK = {
  248: 'การยอมจำนนโดยเจรจา ไม่ใช่การพ่ายศึก — สุมาอี้เจรจาเองบนสะพานเชือกสองวัน และต้นฉบับ ' +
       'ยืนยันสองทาง: "Wei\'s field army did not lose a battle" และ "it fell the way these ' +
       'things actually fall, which is slowly and mostly on paper" · ★ และราคาของปีนี้ถูกจ่าย ' +
       'ไปแล้วในฉากก่อนหน้า (c8-13b): กองทัพสี่หมื่นที่ยังไม่เคยแพ้ กินข้าวปลูกของตัวเองไปทั้งฤดูหนาว ' +
       'ปีที่ไม่มีเลือดปีนี้คือ *ผลลัพธ์* ของสิ่งนั้น ไม่ใช่ช่องว่างที่ลืมเติม'
};

{
  const yr = {};   /* ปี → { moved, blood:{…}, lost:{…}, holds:{…} } */
  const own = {}; for (const id in TK.regions) own[id] = TK.regions[id].owner;
  for (const b of T){
    const y = yr[b.year] || (yr[b.year] = { moved:0, blood:{}, lost:{}, holds:{} });
    for (const id in (b.mapDelta || {})){
      const to = b.mapDelta[id], from = own[id];
      if (to === from) continue;
      const r = TK.regions[id];
      if (r && r.troops !== undefined){ y.moved += r.troops; if (SIDES.includes(from)) y.lost[from] = true; }
      own[id] = to;
    }
    for (const k in (b.losses || {})) y.blood[k] = (y.blood[k] || 0) + b.losses[k];
    /* ★ 2026-08-27 — กองที่ยอมจำนนก็คือ "ราคาที่จ่ายไป" เหมือนกัน ข้อ 7/ข้อ 8 ต้องนับด้วย
       ไม่งั้นปีที่แผ่นดินย้ายมือเพราะเมืองยอม จะถูกฟ้องว่า "ได้แผ่นดินฟรี" ทั้งที่ไม่ฟรี */
    for (const k in (b.taken || {})) y.blood[k] = (y.blood[k] || 0) + b.taken[k];
    /* ★ 2026-08-22 — ยังถือแผ่นดินอยู่ไหม ณ สิ้นปีนั้น · ข้อ 8 ต้องใช้
       บั๊กที่เจอตอนปิดบทที่ 9: เว่ยเสียเยปี 248 แล้วหายไปจากกระดาน แต่ข้อ 8 ยังนับ
       249–256 เป็น "เสียแผ่นดินแล้วไม่เสียคน" ต่อไปอีกแปดปี เพราะไม่มีอะไรมารีเซ็ตมัน
       รัฐที่ไม่มีแผ่นดินเหลือแล้ว ไม่ได้กำลัง "ถูกแยกชิ้นส่วนอย่างเงียบ ๆ" มันจบไปแล้ว */
    for (const s of SIDES) y.holds[s] = false;
    for (const id in own) if (y.holds[own[id]] !== undefined) y.holds[own[id]] = true;
  }
  const years = Object.keys(yr).map(Number).sort((a,b) => a-b);

  /* ข้อ 7 — ปีที่ย้ายแผ่นดินมากโดยไม่มีใครเสียคนเลย */
  for (const y of years){
    const d = yr[y];
    if (d.moved <= GROUND_CAP) continue;
    if (Object.keys(d.blood).length) continue;
    const line = `${y}: ${(d.moved*10000).toLocaleString('en-US')} of levy changed hands and ` +
                 `nobody lost a man anywhere in the year`;
    if (GROUND_OK[y]) warn.push(line + ' — allowed: ' + GROUND_OK[y]);
    else warn.push(line + `. Ground with no price on it is the shape §1 of ` +
                   `PROPOSAL_ch7_8 measured — either the year needs a beat with losses in ` +
                   `it, or the transfer needs splitting across more than one year.`);
  }

  /* ข้อ 8 — ฝ่ายที่กำลังเสียแผ่นดินอยู่ แต่ไม่เสียคนเลยหลายปีติด */
  for (const side of SIDES){
    let run = [], losing = false;
    for (const y of years){
      const d = yr[y];
      /* รัฐที่ไม่เหลือแผ่นดินแล้วไม่นับ — มันไม่ได้เงียบ มันไม่อยู่แล้ว */
      if (!d.holds[side]) { run = []; losing = false; continue; }
      if (d.lost[side]) losing = true;
      if (d.blood[side]) {
        if (losing && run.length > QUIET_CAP)
          warn.push(`${LBL(side)} lost ground in this stretch and lost nobody: ` +
                    `${run[0]}–${run[run.length-1]} (${run.length} years). ` +
                    `A state that is being taken apart and never bleeds is a state the ` +
                    `map is not drawing.`);
        run = []; losing = false;
      } else run.push(y);
    }
    if (losing && run.length > QUIET_CAP)
      warn.push(`${LBL(side)} lost ground in this stretch and lost nobody: ` +
                `${run[0]}–${run[run.length-1]} (${run.length} years).`);
  }
}

/* ── 9. ★★ กำลังรบแนวตะวันตกต้องอยู่ระหว่างชั้นบนกับชั้นล่าง (เพิ่ม 2026-08-27) ────────
   `front` เป็นค่าที่ **ประกาศ** ไม่ใช่คำนวณ — วัดแล้วว่าคำนวณจากเขตไม่ได้จริง ๆ
   (สิบเขตตะวันตกรวมกันเกณฑ์ได้ 70,000 แต่กองทัพที่ยืนอยู่ตรงนั้นปี 232 รวม 180,000
    เพราะทั้งสองฝ่ายขนทัพมาจากนอกแนว) · โมเดลเขตตอบ "แผ่นดินนี้เลี้ยงทหารได้เท่าไร"
   ซึ่งไม่ใช่คำถามเดียวกับ "ตอนนี้มีทหารยืนอยู่ตรงนั้นเท่าไร"

   ⚠⚠ **และเพราะมันประกาศ มันจึงเป็น "แหล่งความจริงที่สอง" ตามที่ §14 เตือนไว้เป๊ะ ๆ**
   ข้อนี้คือราคาที่จ่ายเพื่อให้มันมีอยู่ได้ — บังคับให้มันถูกหนีบระหว่างสองชั้นที่
   คำนวณจากของจริงอยู่แล้ว ทุกฉาก:
     ชั้นบน  · front[side] ≤ กำลังทั้งรัฐของ side  — แนวรบใหญ่กว่าประเทศไม่ได้
     ชั้นล่าง · ทุก strength บนหมุด/ลูกศรของ side ในฉากนั้น ≤ front[side]
                — กองปฏิบัติการกองเดียวใหญ่กว่าทั้งแนวรบไม่ได้
   ถ้าวันไหนบัญชีทัพในคอมเมนต์ดริฟต์ออกจากฉาก ข้อนี้จะจับได้ทันที ซึ่งเป็นสิ่งที่
   คอมเมนต์เปล่า ๆ ทำไม่ได้เลยตลอดเจ็ดบทที่ผ่านมา                                  */
{
  const FSIDES = ['han','wei'];
  let cur = null, shown = 0, prevF = null, blood = { han:0, wei:0 };
  const ftraj = [];
  for (let n = 0; n < T.length; n++){
    const b = T[n];
    /* 'front' in b  ไม่ใช่  b.front — `front:null` คือการ **ปิดบรรทัด** ไม่ใช่ไม่ประกาศ
       (เพิ่ม 2026-09-01 พร้อมกับ engine.frontAt · ดูคอมเมนต์ที่นั่น) */
    if ('front' in b){
      if (!b.front){ if (cur) ftraj.push(`  ${b.id} ${b.year}  — บรรทัดแนวตะวันตกจบที่นี่`);
                     cur = null; prevF = null; blood = { han:0, wei:0 }; }
      else cur = b.front;
    }
    if (!cur) continue;
    shown++;
    const s = strength(n);
    for (const side of FSIDES){
      if (cur[side] == null) continue;
      /* ชั้นบน */
      if (cur[side] > s[side].troops + 0.05)
        err.push(`${b.id} ${b.year}: western front ${LBL(side)} ${(cur[side]*10000).toLocaleString('en-US')} ` +
                 `exceeds everything ${LBL(side)} can levy nationwide ` +
                 `(${(s[side].troops*10000).toLocaleString('en-US')}) — the theatre cannot be bigger than the state`);
      /* ชั้นล่าง */
      for (const m of (b.markers || [])){
        if (m.side !== side || !m.strength) continue;
        if (m.strength > cur[side] * 10000 + 500)
          err.push(`${b.id} ${b.year}: "${(m.label||m.name||m.route||m.place||'?').slice(0,34)}" carries ` +
                   `${m.strength.toLocaleString('en-US')} but the whole western front of ${LBL(side)} ` +
                   `is only ${(cur[side]*10000).toLocaleString('en-US')} — one column cannot outweigh its own theatre`);
      }
    }
    /* ★ พิมพ์ส่วนต่างเทียบกับ "เลือดที่บันทึกไว้จริง" ระหว่างสองการประกาศ
       front ตกได้จากสามเหตุ: ตายในสนาม (losses) · ยอมจำนน (taken) · **ย้ายออกจากแนวรบ**
       เหตุที่สามถูกต้องและไม่ใช่ losses (กองคุ้มกันขบวนอพยพของ c7-11 คือตัวอย่าง)
       ตัวตรวจจึงไม่ฟ้องเป็น error — แต่ต้องพิมพ์ออกมาให้เห็นเสมอ ไม่งั้นบัญชีทัพ
       จะดริฟต์ออกจากฉากอีกแบบเงียบ ๆ เหมือนที่มันเคยทำมาเจ็ดบท */
    /* ⚠ ต้องบวกเลือดของ**ฉากนี้เอง**ก่อนเทียบ — ค่า front ที่ประกาศคือสถานะ*หลัง*
       เหตุการณ์ในฉากจบแล้ว (c7-06 ประกาศ 7.2 ซึ่งหักกองที่ยอมจำนนของฉากนั้นไปแล้ว)
       เรียงสลับกันเมื่อไหร่ ตัวเลข "ไม่ได้บันทึก" จะเลื่อนไปโผล่ผิดแถวทั้งคอลัมน์ */
    for (const k in (b.losses || {})) if (blood[k] != null) blood[k] += b.losses[k];
    for (const k in (b.taken  || {})) if (blood[k] != null) blood[k] += b.taken[k];

    if (b.front){
      const bits = FSIDES.map(k => {
        if (cur[k] == null) return `${LBL(k)} —`;
        let line = `${LBL(k)} ${Math.round(cur[k]*10)}k`;
        if (prevF && prevF[k] != null){
          const d = cur[k] - prevF[k];
          const bled = Math.round((blood[k] || 0) * 10) / 10;
          line += ` (${d >= 0 ? '+' : ''}${Math.round(d*10)}k`;
          if (bled) line += ` · เลือดที่บันทึก ${Math.round(bled*10)}k`;
          const unexplained = -d - bled;
          if (unexplained > 0.05) line += ` · ย้าย/ไม่ได้บันทึก ${Math.round(unexplained*10)}k`;
          line += ')';
        }
        return line;
      });
      ftraj.push(`  ${b.id} ${b.year}  ${bits.join('  ')}`);
      prevF = cur; blood = { han:0, wei:0 };
    }
  }
  if (shown) console.log(`western-front line declared on ${ftraj.length} scenes, ` +
                         `carried through ${shown}:\n${ftraj.join('\n')}\n`);
}

console.log(`${T.length} scenes · numbers move ${moves} times ` +
            `(${(moves/T.length*100).toFixed(0)}% of scenes)\n`);
console.log(showAll ? lines.join('\n') + '\n'
                    : lines.slice(0,3).join('\n') + '\n  ...\n' + lines.slice(-3).join('\n') + '\n');

for (const e of err) console.log('✖ ' + e);
for (const w of warn) console.log("⚠ " + w + "\n");
console.log(err.length ? `${err.length} problem(s) found`
  : `opening-year totals match · ${CLAIMS.length - pending}/${CLAIMS.length} army sizes ` +
    `named in the story and all ${chips} strengths printed on map arrows fit ` +
    `the strength on hand`);
process.exit(err.length ? 1 : 0);
