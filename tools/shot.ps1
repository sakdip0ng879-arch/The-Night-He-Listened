<#
  shot.ps1 — ถ่ายภาพหน้าจอจริงของ beat ที่ระบุ เพื่อ "ดูด้วยตา" ตาม DECISIONS §8.5

  เครื่องมือนี้ไม่วาดอะไรเองแม้แต่เส้นเดียว
  มันเปิด index.html ตัวจริงผ่าน http แล้วสั่ง engine ตัวจริงให้ไปหยุดที่ beat ที่ขอ
  แล้วให้ Chrome ถ่ายภาพออกมา  ภาพที่ได้จึงเป็นสิ่งเดียวกับที่ผู้ใช้เห็นเป๊ะ ๆ
  (บทเรียนจาก render_battle.ps1 ที่ถูกลบทิ้ง เพราะมันวาดแผนที่ขึ้นมาเองแล้วรายงานผิดสองครั้ง)

  ใช้:
    tools\shot.ps1 c1-05
    tools\shot.ps1 c1-05,c1-06 -Width 1904 -Height 980
    tools\shot.ps1 next:7               # กดปุ่ม "ตอนต่อไป" จริง 7 ครั้ง
    tools\shot.ps1 c1-05 -Out D:\somewhere

  โหมด beat=<id> เชื่อถือได้ ใช้ตรวจภาพของฉากใดฉากหนึ่ง
  โหมด next:N ใช้ตรวจว่า "กดรัว ๆ แล้วพัง" หรือเปล่า — แต่ตัวเลข 5/71 vs 8/71 ที่ได้
  อย่าไปเชื่อ เพราะ --virtual-time-budget เร่ง setTimeout แต่ไม่เร่ง scroll event
  ลำดับ programmatic/pickCurrent ของ ui.js จึงสลับกันได้ ไม่เหมือนที่ผู้ใช้เจอ
  ดูแค่ว่า "ภาพพังไหม" พอ อย่าใช้ตัดสินว่าปุ่มนับผิด
  (โหมดนี้จับบั๊ก tween ที่ ease(t) ระเบิดตอน t ติดลบมาแล้วครั้งหนึ่ง)

  ทำไมต้องผ่าน http ไม่เปิด file:// ตรง ๆ:
    preview pane แคช file:// ไว้ แก้ data แล้วหน้าไม่เปลี่ยน ทำให้ตรวจงานผิด
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string[]]$Beat,
  [int]$Width  = 1904,
  [int]$Height = 980,
  [int]$Port   = 8777,
  [string]$Out = "$env:TEMP\tk-shots",
  [switch]$Season,
  [switch]$Spine,
  [switch]$Roads,
  [switch]$Art,
  [switch]$Mirror
)

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$node   = "$env:LOCALAPPDATA\ms-playwright-go\1.50.1\node.exe"
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"

foreach ($exe in @($node, $chrome)) {
  if (-not (Test-Path $exe)) { throw "ไม่พบ $exe" }
}
if (-not (Test-Path $Out)) { New-Item -ItemType Directory -Path $Out | Out-Null }

# ── หน้าถ่ายภาพ: index.html ตัวจริง + สคริปต์สั่งให้ไปหยุดที่ beat ที่ขอ ──────────
$driver = @'
<script>
(async () => {
  const q  = new URLSearchParams(location.search);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* .body มี scroll-behavior:smooth ซึ่งทำให้แม้แต่การกำหนด scrollTop ตรง ๆ ก็กลายเป็นแอนิเมชัน
     headless + virtual time ไม่เดินเฟรมให้ คอลัมน์นิยายจึงค้างอยู่ที่ตอนแรกตลอด
     ภาพที่ได้จะเป็น "แผนที่ฉากที่ 8 คู่กับเนื้อเรื่องฉากที่ 1" ซึ่งอ่านผิดว่าเป็นบั๊ก
     ปิดเฉพาะตอนถ่ายภาพ ไม่แตะโปรดักต์ */
  const rd = document.getElementById('reader');
  rd.style.scrollBehavior = 'auto';

  /* ปิด transition ของสีแคว้นกับแอนิเมชันแฟลชตอนเปลี่ยนมือ
     เคยไล่เพิ่มเวลารอจาก 900 เป็น 1800ms แล้วก็ยังจับภาพกลางทางอยู่ดี
     (ฉากปิดที่ทุกแคว้นเปลี่ยนมือพร้อมกัน ออกมาเป็นแผนที่สามสีทั้งที่ HUD บอก 22/0/0)
     การไล่รอเป็นการเดา — หยุดแอนิเมชันไปเลยคือคำตอบที่แน่นอน
     นี่คือการแตะ "จังหวะ" ไม่ใช่ "การวาด" ภาพที่ได้จึงยังเป็นของจริงทุกพิกเซล */
  const freeze = document.createElement('style');
  freeze.textContent =
    '.region{transition:none !important; animation:none !important}' +
    /* ⚠⚠ ต้องมีทั้ง transition:none และ **opacity:1 !important** — เจอ 2026-08-25:
       กลุ่ม (<g>) ที่ถูกสลับ opacity ด้วย inline style ระหว่างโหลด จะ**ไม่ถูกวาดลงภาพ**
       ใต้ --virtual-time-budget แม้ DOM กับ computed style จะบอก opacity:1 ครบถ้วน
       (พิสูจน์แล้ว: path เดิมย้ายจาก L-focus ไป L-markers แล้วโผล่ทันที · สแกนพิกเซลยืนยัน)
       opacity:1 ระดับ stylesheet ชนะ inline ทำให้การสลับกลายเป็นโมฆะ แล้วชั้นกลับมาวาดปกติ
       — ไม่โกงภาพ เพราะสถานะจริงตอนนิ่งของทั้งสามชั้นคือ opacity 1 อยู่แล้ว */
    '#L-labels,#L-pins,#L-focus{transition:none !important; opacity:1 !important}' +
    /* ⚠ ช่องแถบเวลาก็มี transition (.tcell{transition:background .2s, transform .15s})
       และมันไม่เดินใต้ --virtual-time-budget เหมือนกัน — ผลคือ **ภาพโกหกเรื่องแถบเวลา**
       เจอ 2026-08-26 ตอนสแกนพิกเซลแถวช่องของภาพ 17 ใบ: c3-02 กับ c3-05 ยังทาทองที่ช่องแรก
       (ช่องเดิมตอนโหลดหน้า) ส่วน c3-07 ไม่มีช่องทองเลยเพราะถูกจับกลางทาง ทั้งที่ DOM
       ตั้ง .tcell.now ถูกต้องครบ 28 ฉาก (ตรวจสดในเบราว์เซอร์แล้ว)
       ถ้าไม่หยุดตรงนี้ คนตรวจงานจะเห็น "หมุดแถบเวลาชี้ผิดฉาก" แล้วไล่แก้บั๊กที่ไม่มีอยู่จริง */
    '.tcell{transition:none !important}';
  document.head.append(freeze);

  /* โหมดทั้งฤดู — กดปุ่มจริง ไม่ตั้ง localStorage เพราะ TK.ui.init() วิ่งไปก่อนสคริปต์นี้แล้ว
     ใช้:  tools\shot.ps1 c5-02c -Season                                                  */
  /* โหมด next=N — กดปุ่ม "ตอนต่อไป" จริง ๆ N ครั้ง ใช้ตรวจว่าเส้นทางที่ผู้ใช้กดจริงทำงานครบ
     (ทั้งแผนที่และคอลัมน์นิยายต้องขยับไปด้วยกัน) */
  if (q.has('next')) {
    const n = +q.get('next');
    for (let k = 0; k < n; k++) { document.getElementById('btnNext').click(); await wait(1200); }
    await wait(600);
    /* ลูกศรวาดตัวเองด้วย rAF ซึ่งไม่เดินใต้ virtual time — ถ้าไม่ settle ภาพจะไม่มีลูกศรเลย
       แล้วเข้าใจผิดว่าฉากนี้ไม่มีการเดินทัพ */
    TK.map.setMarkers(TK.timeline[TK.engine.index].markers, false);
  /* ต้องเรียก relayout เอง — setMarkers ถูกสั่งเป็นคำสั่งสุดท้าย จึงไม่มีใครมาจัดขนาด
     กับตำแหน่งให้ของที่เพิ่งสร้าง ผลที่เห็น: ชื่อสถานที่ที่ฉากนี้ชี้ (forceLabels) หายไปทั้งที่
     ผู้อ่านจริงเห็น — ภาพตรวจงานจึงโกหก เจอตอนเพิ่งเพิ่มหมุด jianhe แล้ววงปะทะมีแต่ไม่มีชื่อ */
    TK.map.relayout();
    document.title = 'READY next=' + n + ' -> ' + TK.timeline[TK.engine.index].id;
    return;
  }

  /* โหมด battle=<id>&phase=N — เปิดโหมดสมรภูมิแล้วหยุดที่ระยะที่ขอ
     goPhase(n, true) เล่นทุกระยะก่อนหน้าแบบทันที ภาพที่ได้จึงเป็นสภาพสะสมจริง
     ไม่ใช่ระยะนั้นลอย ๆ — ใช้ตรวจว่าของที่ควรหายไปแล้ว (โซ่ หลักเหล็ก) หายจริง */
  if (q.has('battle')) {
    const bid = q.get('battle');
    TK.battle.open(bid);
    await wait(400);
    TK.battle.goPhase(+(q.get('phase') || 0), true);
    await wait(700);
    document.title = 'READY ' + bid + ' phase ' + (q.get('phase') || 0);
    return;
  }

  /* โหมด beat=<id> — กระโดดตรง เร็วและนิ่ง ใช้ตรวจภาพของฉากใดฉากหนึ่ง */
  const b = TK.timeline.find(x => x.id === q.get('beat')) || TK.timeline[0];
  const i = TK.timeline.indexOf(b);

  /* goTo ไม่เลื่อนคอลัมน์นิยายให้ (ปุ่มจริงเรียกผ่าน scrollTo ของ ui.js)
     ต้องเลื่อนเอง ไม่งั้นภาพจะเป็นแผนที่ฉากที่ 8 คู่กับเนื้อเรื่องฉากที่ 1
     คำนวณจาก rect ตรง ๆ เชื่อถือได้กว่า scrollIntoView ในหน้าที่เพิ่งวางเลย์เอาต์เสร็จ */
  const art = rd.querySelectorAll('article')[i];
  if (art) rd.scrollTop += art.getBoundingClientRect().top
                         - rd.getBoundingClientRect().top - rd.clientHeight * 0.35;

  /* ⚠ ต้องเลื่อนก่อน แล้วค่อย goTo — ห้ามสลับ
     การเลื่อนยิง scroll event ซึ่งไปเรียก pickCurrent ของ ui.js ที่คำนวณ
     "ตอนที่กำลังอ่าน" ใหม่แล้วสั่ง goTo ทับ ถ้า goTo ก่อนจะได้ภาพคนละฉากกับที่ขอ
     (เคยได้ภาพฉาก 16 ตอนสั่งถ่าย c2-07 มาแล้ว แล้วเกือบอ่านว่าแผนที่เพี้ยน) */
  await wait(250);
  TK.engine.goTo(i, 'init');

  /* โหมดฤดู — กดปุ่มจริง ไม่ใช่ตั้ง localStorage แล้วหวังว่ามันจะติด
     ลองทางอ้อมมาแล้วและมันเงียบ: ภาพออกมาเป็นฉากเดี่ยวทุกใบโดยไม่มีอะไรฟ้อง ซึ่งเป็น
     ความล้มเหลวชนิดที่แย่ที่สุดของเครื่องมือตรวจ — มันบอกว่าผ่านทั้งที่ไม่ได้ทดสอบอะไรเลย
     กดปุ่มแล้ว render จะวิ่งเองครบทั้งทาง (compose · ป้ายบอกฤดู · ปุ่มติดไฟ)
     เหลือแค่กล้องที่ tween ด้วย rAF ซึ่งไม่เดินใต้ virtual time — บังคับให้ถึงที่ด้วย ms=0 ข้างล่าง */
  if (q.has('season')) { document.getElementById('btnSeason').click(); await wait(60); }
  /* กระดูกสันหลังก็กดปุ่มจริงเหมือนกัน มันสร้าง SVG ทั้งแผ่นตอนเปิดครั้งแรก */
  if (q.has('spine'))  { document.getElementById('btnSpine').click(); await wait(120); }
  /* โหมดถนน — กดปุ่มจริงเหมือนสองโหมดข้างบน (DECISIONS §15) */
  if (q.has('roads'))  { document.getElementById('btnRoads').click(); await wait(120); }
  /* ★ โหมดแผ่นภาพวาดใหม่ (2026-09-08) — กดปุ่มจริงเหมือนโหมดอื่น แล้ว **ต้องรอ**
     เพราะมันโหลด SVG กับ PNG 2.7 MB ผ่านเน็ตเวิร์กจริง ไม่ใช่แค่สลับคลาส
     ⚠ ไม่มีโหมดนี้ = ภาพตรวจงานถ่ายชั้นภาพใหม่ไม่ได้เลยสักใบ (localStorage ของ
       โปรไฟล์ Chrome ใหม่ว่างเสมอ ปุ่มจึงเริ่มที่ "แผ่น: ต้นฉบับ" ทุกครั้ง) */
  /* ★ บังคับ *สถานะ* ของแผ่น ไม่ใช่ 'กดปุ่มหนึ่งครั้ง' — ตั้งแต่ 2026-09-08
     แผ่นวาดใหม่เป็นค่าเริ่มต้น การกดปุ่มทื่อ ๆ จึงกลายเป็นการ *ปิด* มัน
     art=1 บังคับเปิด · art=0 บังคับปิด (ใช้ถ่ายแผ่นต้นฉบับไว้เทียบ) */
  if (q.has('art')) {
    const want = q.get('art') !== '0';
    if (TK.map.artOn !== want) document.getElementById('btnBase').click();
    for (let k = 0; k < 80 && TK.map.artOn !== want; k++) await wait(100);
    await wait(500);
  }

  /* .region มี transition:fill .9s — เคยรอ 900ms พอดีเป๊ะ แล้วได้ภาพกลางทาง
     ภาคเหนือออกมาเป็นสีวุ่ยทั้งแถบทั้งที่ HUD บอกว่าวุ่ยเหลือศูนย์เขต
     เผลออ่านว่าเป็นบั๊กของแผนที่ไปแล้วรอบหนึ่ง — เผื่อไว้ให้ยาวกว่า transition ชัด ๆ */
  await wait(1800);
  /* ★ ต้องเป็น marker ที่ ui ประกอบแล้ว ไม่ใช่ b.markers ดิบ ๆ — ไม่งั้นโหมดฤดู
     (echo ของฉากอื่นในฤดูเดียวกัน) จะไม่มีทางถูกถ่ายภาพเลย เครื่องมือจะวาดคนละอย่าง
     กับที่ผู้อ่านเห็น ซึ่งเป็นบั๊กเดิมที่เพิ่งแก้ไปเมื่อรอบที่แล้ว */
  const comp = TK.ui.compose(i);
  TK.map.flyTo(comp.camBox || b.camera, 0);          // ms=0 เพราะ rAF ไม่เดินใต้ virtual time
  TK.map.setMarkers(comp.marks, false);              // วางลูกศรที่ตำแหน่งสุดท้าย ไม่ต้องรอ tween
  /* ต้องเรียก relayout เอง — setMarkers ถูกสั่งเป็นคำสั่งสุดท้าย จึงไม่มีใครมาจัดขนาด
     กับตำแหน่งให้ของที่เพิ่งสร้าง ผลที่เห็น: ชื่อสถานที่ที่ฉากนี้ชี้ (forceLabels) หายไปทั้งที่
     ผู้อ่านจริงเห็น — ภาพตรวจงานจึงโกหก เจอตอนเพิ่งเพิ่มหมุด jianhe แล้ววงปะทะมีแต่ไม่มีชื่อ */
  TK.map.relayout();
  /* โหมดสองเอกภพ (§15) — เปิดตรง ๆ หลังทุกอย่างนิ่ง: ไทเมอร์เหลือบอัตโนมัติของ ui.js
     วิ่งจบไปแล้วใต้ virtual time (โชว์แล้วคืนแล้ว) การเรียกซ้ำตรงนี้คือสถานะ "ผู้อ่านกดปุ่ม"
     ใช้:  tools\shot.ps1 c7-13 -Mirror   (ฉากกระจกย้าย 09→13 ตอนแตก 15 ฉาก 2026-08-27) */
  if (q.has('mirror') && b.mirror){ TK.map.hideMirror(); TK.map.showMirror(b.mirror); }
  document.title = 'READY ' + b.id;
})();
</script>
'@
# โหมดฤดูอ่านค่าจาก localStorage ตอน bindControls ซึ่งเกิดก่อนสคริปต์ท้ายหน้า
# จึงต้องตั้งค่าไว้ใน <head> ก่อน ไม่ใช่ในตัว driver
# ⚠ เคยตั้ง localStorage['tk-season'] ไว้ใน <head> ตรงนี้เพื่อเปิดโหมดฤดู — ถอดออกแล้ว
#   กลไกจริงคือ driver กดปุ่ม #btnSeason ซึ่งเดินผ่านโค้ดเส้นเดียวกับที่ผู้อ่านกด
#   ทางอ้อมนั้นเงียบสนิทตอนมันไม่ทำงาน (ภาพออกมาเป็นฉากเดี่ยวทุกใบโดยไม่มีอะไรฟ้อง)
#   และพอมีทั้งสองทางพร้อมกันมันยิ่งแย่ — สองครั้ง = สลับกลับเป็นปิดพอดี
$shotPage = Join-Path $root '_shot.html'
$html = Get-Content (Join-Path $root 'index.html') -Raw -Encoding UTF8
($html -replace '</body>', ($driver + "`r`n</body>")) | Out-File $shotPage -Encoding utf8

# ── เสิร์ฟโฟลเดอร์แบบ no-cache ─────────────────────────────────────────────────
$serverJs = Join-Path $env:TEMP 'tk-serve.js'
@'
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2],PORT=+process.argv[3];
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((q,s)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)){s.writeHead(403).end();return;}
  fs.readFile(f,(e,b)=>{ if(e){s.writeHead(404).end();return;}
    s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream',
      'Cache-Control':'no-store'}); s.end(b); });
}).listen(PORT);
'@ | Out-File $serverJs -Encoding utf8

$srv = Start-Process -FilePath $node -ArgumentList @($serverJs, $root, $Port) -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 600

try {
  $n = 0
  foreach ($id in $Beat) {
    # "next:7" = กดปุ่มตอนต่อไป 7 ครั้ง · "wuguan244@3" = สมรภูมิระยะที่ 3 · อย่างอื่นคือ id ของ beat
    if     ($id -match '^next:(\d+)$')   { $qs = "next=$($Matches[1])"; $file = "next-$($Matches[1])" }
    elseif ($id -match '^(.+)@(\d+)$')   { $qs = "battle=$($Matches[1])&phase=$($Matches[2])"
                                           $file = "$($Matches[1])-p$($Matches[2])" }
    else                                 { $qs = "beat=$id";            $file = $id }
    if ($Season) { $qs += "&season=1"; $file += "-season" }
    if ($Spine)  { $qs += "&spine=1";  $file += "-spine" }
    if ($Roads)  { $qs += "&roads=1";  $file += "-roads" }
    if ($Art)    { $qs += "&art=1";    $file += "-art" }
    if ($Mirror) { $qs += "&mirror=1"; $file += "-mirror" }
    # ★ 2026-09-01 — ปิดหน้าเปิด ไม่งั้นมันทับภาพตรวจงานทุกใบ (ui.js setupIntro)
    $qs += "&intro=0"
    $png = Join-Path $Out "$file.png"
    # โปรไฟล์ใหม่ทุกครั้ง ใช้ซ้ำแล้ว Chrome จะไม่ยอมเขียนไฟล์รอบที่สอง
    $prof = Join-Path $Out ("prof-" + [guid]::NewGuid().ToString('N').Substring(0,8))
    & $chrome --headless --disable-gpu --no-sandbox --hide-scrollbars `
              --user-data-dir="$prof" --virtual-time-budget=20000 `
              --window-size="$Width,$Height" --screenshot="$png" `
              "http://localhost:$Port/_shot.html?$qs" | Out-Null
    Start-Sleep -Milliseconds 400
    Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $png) { Write-Output "  $id  ->  $png"; $n++ }
    else                { Write-Output "  $id  ->  ถ่ายไม่ติด" }
  }
  Write-Output "ถ่ายได้ $n/$($Beat.Count) ภาพ  ที่ $Out"
}
finally {
  Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
  Remove-Item $shotPage -Force -ErrorAction SilentlyContinue   # ห้ามหลงเหลือใน repo
}
