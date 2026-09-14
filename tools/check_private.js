/* check_private.js — ห้ามข้อมูลส่วนตัวหลุดเข้าไฟล์ที่เผยแพร่
 *
 *   node tools/check_private.js
 *
 * ทำไมต้องมี — repo นี้เป็น public และ GitHub Pages เสิร์ฟ **ทุกไฟล์ที่ track** (รวม docs/ และ
 *   prototypes/**.md) · 2026-09-14 เจอพาธเต็มบนเครื่องเจ้าของ (โฟลเดอร์ผู้ใช้ Windows) ใน md ของ
 *   prototypes สี่ไฟล์กับ tools/georef.js และถูก push ขึ้นไปแล้ว · เจ้าของต้องการ "ไม่มีความเสี่ยงเลย"
 *   ⇒ ห้ามตัดสินเองว่า "เสี่ยงต่ำ ปล่อยได้" — ให้ตัวตรวจแดงก่อน push แทน (LOG §5.39)
 *
 * ตรวจอะไร — ไฟล์ข้อความทุกไฟล์ที่ **จะถูก commit** (track แล้ว + ไฟล์ใหม่ที่ไม่ถูก .gitignore)
 *   ① พาธโฟลเดอร์ผู้ใช้ของ Windows / macOS / Linux   ② ที่อยู่อีเมล
 *   ถ้าต้องอ้างถึงไฟล์ ให้ใช้พาธในรีโป (data/names.js) หรือ ~/ แทนโฟลเดอร์ผู้ใช้
 * ⚠ ตัวตรวจนี้ไม่เห็นข้อมูล author/committer ของ commit — อันนั้นมาจาก git config ไม่ใช่จากไฟล์
 */
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

const RULES = [
  ['พาธโฟลเดอร์ผู้ใช้ Windows', /\b[A-Za-z]:[\/]+Users[\/]+[^\/\s`'")]+/g],
  ['พาธโฟลเดอร์ผู้ใช้ macOS/Linux', /(?:^|[\s`'"(=])\/(?:Users|home)\/[A-Za-z][\w.-]*/g],
  ['ที่อยู่อีเมล', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g],
];
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|mp3|mp4|zip)$/i;

const list = args => execSync('git ls-files -z ' + args, { cwd: ROOT, maxBuffer: 64 << 20 })
  .toString('utf8').split('\0').filter(Boolean);
const files = [...new Set([...list(''), ...list('--others --exclude-standard')])]
  .filter(f => !BINARY.test(f) && fs.existsSync(path.join(ROOT, f)));

let bad = 0;
for (const f of files){
  const buf = fs.readFileSync(path.join(ROOT, f));
  if (buf.includes(0) && !f.endsWith('.js')) continue;          /* ไฟล์ไบนารีที่นามสกุลไม่บอก */
  const lines = buf.toString('utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [what, re] of RULES){
      re.lastIndex = 0;
      if (re.test(line)){
        bad++;
        console.log('✖ ' + f + ':' + (i + 1) + ' — ' + what);   /* ไม่พิมพ์ข้อความที่เจอ ไม่ให้หลุดซ้ำใน log */
      }
    }
  });
}
if (bad){
  console.log('\n' + bad + ' จุดมีข้อมูลส่วนตัวในไฟล์ที่จะเผยแพร่ — ล้างก่อน commit/push');
  process.exit(1);
}
console.log('✅ ข้อมูลส่วนตัว: ไม่พบพาธโฟลเดอร์ผู้ใช้หรืออีเมล ใน ' + files.length + ' ไฟล์ที่จะเผยแพร่');
