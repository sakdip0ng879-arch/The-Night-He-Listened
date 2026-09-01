/* serve.js — เสิร์ฟโฟลเดอร์โปรเจกต์แบบไม่แคช เพื่อเปิด index.html ตัวจริงผ่าน http
 *
 *   node tools/serve.js [port]        (ปริยาย 8778)  →  http://localhost:8778
 *
 * ทำไมต้องมี: DECISIONS §13 ห้ามตรวจงานผ่าน `file://` เพราะ preview pane แคชไว้
 * แก้ข้อมูลแล้วหน้าไม่เปลี่ยน แล้วเราจะอ่านว่า "แก้แล้วไม่เห็นผล" ทั้งที่หน้าเป็นของเก่า
 *
 * `shot.ps1` เขียนเซิร์ฟเวอร์แบบเดียวกันนี้ลง TEMP เองอยู่แล้วสำหรับการถ่ายภาพ
 * ไฟล์นี้มีไว้ให้ *คน* (หรือเบราว์เซอร์ของผู้ช่วย) เปิดดูสด ๆ ได้ด้วย และเป็นปลายทางของ
 * `.claude/launch.json` — ห้ามชี้ launch.json ไปที่ไฟล์ใน TEMP เด็ดขาด มันหายทุกเซสชัน
 *
 * ⚠ ROOT ต้อง path.resolve ก่อนเทียบ — ถ้าส่งพาธมาแบบ / แล้วเทียบกับผลของ path.join
 *   (ซึ่งเป็น \ บนวินโดวส์) ทุกคำขอจะกลายเป็น 403 เงียบ ๆ ทั้งที่ไฟล์อยู่ครบ
 */
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = +(process.argv[2] || 8778);
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.md':'text/plain; charset=utf-8'
};

http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { s.writeHead(403).end(); return; }
  fs.readFile(f, (e, b) => {
    if (e) { s.writeHead(404).end(); return; }
    s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });
    s.end(b);
  });
}).listen(PORT, () => console.log(`TK3 · http://localhost:${PORT}  (ROOT ${ROOT})`));
