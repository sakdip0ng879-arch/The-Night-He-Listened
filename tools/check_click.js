/* check_click.js — ปุ่มทุกปุ่มบนหน้าจอ "กดแล้วมีอะไรเกิดขึ้น" จริงหรือเปล่า
 *
 *   node tools\check_click.js
 *
 * ทำไมต้องมี — และทำไมต้องเป็นตัวนี้ ไม่ใช่ shot.ps1:
 *   2026-08-22 ปุ่ม Spine/Season/Play/Map ตายสนิททั้งสี่ปุ่มในเบราว์เซอร์จริง แต่ shot.ps1
 *   รายงานว่าผ่านทุกใบ เพราะ shot.ps1 เรียก element.click() ตรง ๆ ซึ่ง **ข้ามชุด pointer
 *   ทั้งหมด** ส่วนคนจริงกดเมาส์แล้วเกิด pointerdown → #stage เรียก setPointerCapture →
 *   click ถูกส่งไปที่ #stage แทนที่จะไปที่ปุ่ม
 *   สรุป: เครื่องมือทดสอบเส้นทางที่ผู้อ่านไม่เคยเดิน แล้วบอกว่าผ่าน
 *
 * ตัวนี้จึงยิง **input จริง** ผ่าน DevTools Protocol (Input.dispatchMouseEvent) ซึ่งเดินผ่าน
 * ทางเดียวกับเมาส์จริงทุกประการ รวมถึง pointer capture ที่เป็นต้นเหตุ
 * ไม่มี dependency — Node 22 มี WebSocket กับ fetch มาให้แล้ว
 *
 * วิธีอ่านผล: แต่ละแถวคือปุ่มหนึ่งปุ่ม เก็บค่า probe ก่อนกด แล้วกดจริง แล้วอ่าน probe อีกครั้ง
 * ถ้าค่าไม่เปลี่ยน = ปุ่มนั้นไม่ได้ทำอะไรเลย
 */
const { spawn } = require('child_process');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const CHROME = path.join(process.env['ProgramFiles'] || 'C:\\Program Files',
                         'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 8791, DBG = 9333;

/* ปุ่มที่ต้องทำงาน + วิธีรู้ว่ามันทำงาน (นิพจน์ที่ค่าต้องเปลี่ยนหลังกด) */
const CONTROLS = [
  ['btnSpine',  `document.getElementById('spine').className`],
  ['btnSeason', `document.getElementById('btnSeason').className`],
  ['btnPlay',   `document.getElementById('btnPlay').textContent`],
  ['btnLegend', `document.getElementById('legend').hidden`],
  ['mapmode',   `document.getElementById('mapmode').textContent`],
  ['btnNext',   `TK.engine.index`],
  ['btnPrev',   `TK.engine.index`],
  ['btnReset',  `Math.round(TK.map.viewBox.w)`]
];

const serve = () => new Promise(res => {
  const MIME = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
                '.css':'text/css; charset=utf-8', '.jpg':'image/jpeg', '.png':'image/png'};
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) return r.writeHead(403).end();
    fs.readFile(f, (e, b) => {
      if (e) return r.writeHead(404).end();
      r.writeHead(200, {'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
                        'Cache-Control':'no-store'});
      r.end(b);
    });
  }).listen(PORT, () => res(s));
});

const wait = ms => new Promise(r => setTimeout(r, ms));

async function main(){
  if (!fs.existsSync(CHROME)){ console.error('✖ ไม่พบ Chrome ที่ ' + CHROME); process.exit(2); }
  const server = await serve();
  const profile = path.join(require('os').tmpdir(), 'tk-click-' + Date.now());

  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${DBG}`,
    /* ★ 2026-09-01 — intro=0 ปิดหน้าเปิด ไม่งั้น overlay บังปุ่มแล้วทุกแถวขึ้น DEAD */
    '--window-size=1904,980', `http://localhost:${PORT}/index.html?intro=0`
  ], { stdio:'ignore' });

  /* รอให้ DevTools endpoint ขึ้น */
  let target = null;
  for (let k = 0; k < 60 && !target; k++){
    await wait(250);
    try {
      const list = await (await fetch(`http://localhost:${DBG}/json/list`)).json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch {}
  }
  if (!target){ console.error('✖ ต่อ DevTools ไม่ติด'); chrome.kill(); server.close(); process.exit(2); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  /* ★ เก็บ exception ที่หลุดออกมาระหว่างโหลดด้วย — ไม่ใช่แค่ผลของการกดปุ่ม
     บั๊กที่ร้ายที่สุดของวันนี้ไม่ได้ทำให้ปุ่มใดปุ่มหนึ่งเสีย มันโยน TypeError กลาง init()
     แล้วแผนที่ทั้งหน้าก็ไม่ถูกวาดเลย ตัวตรวจที่ดูแต่ "กดแล้วค่าเปลี่ยนไหม" มองไม่เห็นแบบนั้น */
  const thrown = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown'){
      const d = m.params?.exceptionDetails;
      thrown.push((d?.exception?.description || d?.text || 'exception').split('\n')[0]);
    }
    if (m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const n = ++id; pending.set(n, res);
    ws.send(JSON.stringify({ id:n, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression:expr, returnByValue:true });
    if (r.result && r.result.exceptionDetails)
      return '‹throw: ' + (r.result.exceptionDetails.exception?.description || '?').split('\n')[0] + '›';
    return r.result?.result?.value;
  };

  const rows = [];
  await send('Page.enable'); await send('Runtime.enable');
  await wait(2500);                                   /* ให้ TK.*.init() เดินจนจบ */

  /* ★ รอบสอง: จำลอง "คนที่เคยอ่านมาก่อน" — เพิ่ม 2026-08-22
     โปรไฟล์ใหม่ทุกครั้งแปลว่า localStorage ว่างเสมอ ซึ่งเป็นสภาพของ *คนที่เพิ่งมาครั้งแรก*
     เท่านั้น แล้วเราก็พลาดบั๊กที่ร้ายที่สุดของวันไปเพราะเหตุนี้: ค่า tk-mapmode ที่เก็บไว้
     เป็น "ดัชนีอาร์เรย์" พอตัดโหมดหนึ่งออก ดัชนีเก่าก็เกินขอบ MODES[mi] เป็น undefined
     แล้วโยนกลาง bindControls() ทำให้ **แผนที่ไม่ถูกวาดเลยทั้งหน้า** — ตัวตรวจบอกว่าผ่านหมด
     ยัดค่าที่ "เคยถูกในอดีต แต่ตอนนี้เกินขอบ" ลงไปแล้วโหลดใหม่ ถ้าหน้ายังรอดถึงจะผ่านจริง */
  const STALE = { 'tk-mapmode':'2', 'tk-season':'1' };
  await evalJs(`(()=>{try{${Object.entries(STALE)
      .map(([k,v]) => `localStorage.setItem('${k}','${v}')`).join(';')}}catch(e){}})()`);
  thrown.length = 0;
  await send('Page.reload', { ignoreCache:true });
  await wait(2800);
  /* ⚠ probe ต้องพิสูจน์ว่า **render() เดินจริง** ไม่ใช่แค่ว่า TK.map.init() วาดรูปแคว้นไว้
     ชั้นแคว้นถูกสร้างตอน init ซึ่งเกิดก่อน bindControls จึงรอดแม้ตอนที่พังจริง
     ช่อง HUD ถูกสร้างด้วยขีด "—" แล้ว render เท่านั้นที่เติมตัวเลขลงไป — ใช้อันนั้นวัด */
  const survived = await evalJs(
    `(()=>{try{const h=document.querySelector('[data-num="han"]');
       return !!(h && h.textContent && h.textContent !== '—' && TK.map.viewBox.w > 0);
     }catch(e){return String(e);}})()`);
  const clean = survived === true && thrown.length === 0;
  rows.push(['returning reader', clean ? 'ok' : 'DEAD',
             'stale localStorage ' + JSON.stringify(STALE),
             thrown.length ? thrown[0] : String(survived)]);
  /* ล้างทิ้งแล้วโหลดใหม่ ปุ่มที่เหลือจะได้ทดสอบบนหน้าที่ปกติ */
  await evalJs(`(()=>{try{localStorage.clear()}catch(e){}})()`);
  await send('Page.reload', { ignoreCache:true });
  await wait(2800);

  const ready = await evalJs(`!!(window.TK && TK.engine && TK.ui && TK.spine)`);
  if (ready !== true){
    console.error('✖ หน้าโหลดไม่ครบ — TK ยังไม่พร้อม: ' + JSON.stringify(ready));
    console.error('  (ดู console ของหน้าเว็บ อาจมี SyntaxError ในไฟล์ js ไฟล์ใดไฟล์หนึ่ง)');
  }

  for (const [ctl, probe] of CONTROLS){
    const box = await evalJs(
      `(()=>{const e=document.getElementById('${ctl}');if(!e)return null;
             const r=e.getBoundingClientRect();
             return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), w:r.width};})()`);
    if (!box || !box.w){ rows.push([ctl, 'MISSING', '', '']); continue; }

    /* เริ่มทุกปุ่มบนหน้าที่สะอาด — ปิดกระดูกสันหลังก่อนเสมอ
       ถ้าปล่อยให้ค้างเปิด โอเวอร์เลย์จะคลุมปุ่มที่เหลือ แล้วผลจะออกมาว่า "ตาย" ทั้งแถบ
       ทั้งที่จริงแค่ถูกบัง — การคืนสภาพเป็นการจัดฉาก ไม่ใช่สิ่งที่กำลังทดสอบ จึงเรียก API ตรง */
    await evalJs(`TK.spine.toggle(false)`);
    await wait(120);

    const before = await evalJs(probe);
    /* ★ input จริง — ผ่าน pointer capture ของ #stage เหมือนเมาส์คนจริงทุกประการ */
    const common = { x:box.x, y:box.y, button:'left', clickCount:1 };
    await send('Input.dispatchMouseEvent', { type:'mousePressed',  buttons:1, ...common });
    await wait(40);
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', buttons:0, ...common });
    await wait(400);
    const after = await evalJs(probe);

    const changed = JSON.stringify(before) !== JSON.stringify(after);
    rows.push([ctl, changed ? 'ok' : 'DEAD', String(before), String(after)]);

    /* คืนสภาพเดิมเท่าที่ทำได้ ปุ่มถัดไปจะได้ทดสอบบนหน้าที่ไม่รกไปเรื่อย ๆ */
    if (changed && ['btnSpine','btnSeason','btnPlay'].includes(ctl)){
      await send('Input.dispatchMouseEvent', { type:'mousePressed',  buttons:1, ...common });
      await wait(40);
      await send('Input.dispatchMouseEvent', { type:'mouseReleased', buttons:0, ...common });
      await wait(300);
    }
  }

  /* ── ★ กด Enter หลังคลิกด้วยเมาส์ ต้องไม่ยิงปุ่มเดิมซ้ำ — เพิ่ม 2026-08-22 ──
     เบราว์เซอร์ทิ้งโฟกัสไว้บนปุ่มที่เพิ่งคลิก แล้ว Enter ก็กดมันอีกรอบ
     กับ Play ซึ่งเป็น "โหมด" ไม่ใช่ "ก้าว" นี่คือกับดัก: เจ้าของกด Play ด้วยเมาส์ กด Enter
     ทีหลัง แล้วฉากไหลไปเองสามฉากโดยไม่รู้ว่าทำไม (รายงานจริง)
     ui.js ถอนโฟกัสเมื่อ e.detail > 0 แล้ว แถวนี้เฝ้าไว้ว่ามันยังถอนอยู่ */
  await evalJs(`TK.spine.toggle(false); TK.engine.goTo(13,'jump')`);
  await wait(400);
  for (const ctl of ['btnPlay','btnSpine','btnSeason','mapmode']){
    const box = await evalJs(
      `(()=>{const e=document.getElementById('${ctl}');const r=e.getBoundingClientRect();
             return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};})()`);
    const common = { x:box.x, y:box.y, button:'left', clickCount:1 };
    await send('Input.dispatchMouseEvent', { type:'mousePressed',  buttons:1, ...common });
    await wait(30);
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', buttons:0, ...common });
    await wait(350);
    const probe = ctl === 'btnPlay'
      ? `document.getElementById('${ctl}').textContent`
      : `document.getElementById('${ctl}').textContent + '|' + TK.engine.index`;
    const mid = await evalJs(probe);
    await send('Input.dispatchKeyEvent', {type:'rawKeyDown', windowsVirtualKeyCode:13, key:'Enter', code:'Enter'});
    await send('Input.dispatchKeyEvent', {type:'keyUp',      windowsVirtualKeyCode:13, key:'Enter', code:'Enter'});
    await wait(600);
    const end = await evalJs(probe);
    rows.push(['Enter after ' + ctl, mid === end ? 'ok' : 'DEAD', String(mid), String(end)]);
    await evalJs(`(()=>{const p=document.getElementById('btnPlay');
       if(p.textContent.indexOf('Stop')>=0) p.click();
       TK.spine.toggle(false);
       const s=document.getElementById('btnSeason'); if(s.classList.contains('on')) s.click();})()`);
    await wait(300);
  }

  /* ── ลากแผนที่ยังต้องทำงานอยู่ ──
     การแก้ที่ทำให้ปุ่มกลับมามีชีวิตคือ "อย่าเริ่มลากถ้า pointerdown ลงบนตัวควบคุม"
     ซึ่งอยู่ห่างจาก "อย่าเริ่มลากเลย" แค่บรรทัดเดียว แถวนี้เฝ้าเส้นแบ่งนั้นไว้ */
  await evalJs(`TK.spine.toggle(false)`);
  await wait(150);
  const beforePan = await evalJs(`Math.round(TK.map.viewBox.x)`);
  const mid = await evalJs(
    `(()=>{const r=document.getElementById('stage').getBoundingClientRect();
           return {x:Math.round(r.left+r.width*0.4), y:Math.round(r.top+r.height*0.55)};})()`);
  await send('Input.dispatchMouseEvent', {type:'mousePressed', button:'left', buttons:1, clickCount:1, ...mid});
  await wait(40);
  for (let k = 1; k <= 4; k++){
    await send('Input.dispatchMouseEvent', {type:'mouseMoved', button:'left', buttons:1,
                                            x:mid.x + k * 22, y:mid.y});
    await wait(30);
  }
  await send('Input.dispatchMouseEvent', {type:'mouseReleased', button:'left', buttons:0,
                                          clickCount:1, x:mid.x + 88, y:mid.y});
  await wait(300);
  const afterPan = await evalJs(`Math.round(TK.map.viewBox.x)`);
  rows.push(['map drag', beforePan !== afterPan ? 'ok' : 'DEAD',
             String(beforePan), String(afterPan)]);

  ws.close(); chrome.kill(); server.close();
  try { fs.rmSync(profile, { recursive:true, force:true }); } catch {}

  const dead = rows.filter(r => r[1] !== 'ok');
  console.log(`${rows.length} controls clicked with real mouse input\n`);
  for (const [ctl, st, b, a] of rows)
    console.log(`  ${st === 'ok' ? '✔' : '✖'} ${ctl.padEnd(10)} ${st.padEnd(8)}` +
                (st === 'ok' ? `${b}  →  ${a}`
                             : `${b}${a && a !== 'undefined' ? '  →  ' + a : ''}`));
  console.log('');
  console.log(dead.length
    ? `${dead.length} control(s) do nothing when a real mouse clicks them`
    : 'every control responds to a real click');
  process.exit(dead.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
