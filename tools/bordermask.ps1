<#
  bordermask.ps1 — อ่าน assets\map.jpg แล้วหา "เส้นประเขตแดนที่พิมพ์บนแผ่น"
  เขียนผลเป็น data\bordermask.js (ตาราง 0/1 ความละเอียดเดียวกับ landmask — 5 หน่วย/ช่อง)

  แผ่นของ William L พิมพ์พรมแดนการเมืองเป็น **เส้นประหมึกแดง** ระบบเดียว:
  รอบอาณาเขต SHU ทั้งวง (แขนเหอซี · แนวฉินหลิ่ง · แนวอี้โจว–จิงโจว) และแนววุ่ย–ง่อ
  ที่วิ่งยาวไปจรดขอบตะวันออก — คือ "เส้นแบ่งรัฐปี 221" ที่เป็นกระดานเปิดเรื่องพอดี
  (สีที่เห็นบนจอเพี้ยนเป็นส้ม/น้ำตาลเพราะ CSS filter กับสีระบายทับ — หมึกจริงคือแดง)

  เจ้าของสั่ง 2026-08-25: "ทำให้สีมัน fit กับเส้นประนั้น มันจะเป็น Base ของทั้งเรื่อง"
  → build_geo.js ใช้ตารางนี้เป็น "กำแพง" ตอน BFS: สีเติบโตไปชนเส้นพิมพ์แล้วหยุด (DECISIONS §16)

  ทำไมสแกนความละเอียดเต็ม ไม่ย่อภาพแบบ landmask.ps1: เส้นประหนาแค่ ~3px
  ย่อภาพ 5 เท่าแล้วหมึกจะจางหายไปในค่าเฉลี่ย — ต้องนับพิกเซลจริงทีละช่องแทน

  รันครั้งเดียว ไม่ต้องรันซ้ำจนกว่าจะเปลี่ยนไฟล์แผนที่:
    tools\bordermask.ps1
#>
[CmdletBinding()]
param([int]$Cell = 5, [int]$MinPx = 2)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'assets\map.jpg'
$out  = Join-Path $root 'data\bordermask.js'

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$MW = $bmp.Width; $MH = $bmp.Height
$W = [int][Math]::Floor($MW / $Cell)
$H = [int][Math]::Floor($MH / $Cell)

$rect = New-Object System.Drawing.Rectangle 0, 0, $MW, $MH
$bits = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                      [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $bits.Stride
$buf = New-Object byte[] ($stride * $MH)
[System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($bits); $bmp.Dispose()

# ตัวอักษร SHU / WEI / WU บนแผ่นใช้หมึกโทนเดียวกับเส้น — ต้องเว้นกรอบทิ้ง
# (กรอบเดียวกับที่ strategic.js ใช้ปิดทับ · DECISIONS §3)
$skip = @(
  @(560, 470, 165, 82),    # WEI
  @(262, 1195, 215, 95),   # SHU
  @(1175, 1450, 180, 95)   # WU
)

# นับพิกเซลหมึกต่อช่อง สองคลาส:
#   แดง = เส้นประพรมแดนสามรัฐ (R เด่น · G≈B · ไม่มืดไม่สว่างเกิน)
#   เทา = กำแพงเมืองจีน (สามช่องใกล้กัน 105–190) — ชายแดนเหนือของจักรวรรดิ
#         (เจ้าของยืนยัน 2026-08-26: แนวเหนือของแอ่งหลงโย่วต้องหยุดที่กำแพง "อิงของจริง")
$cnt  = New-Object int[] ($W * $H)
$grey = New-Object int[] ($W * $H)
for ($y = 0; $y -lt $MH; $y++) {
  $row = $y * $stride
  $cy = [int][Math]::Floor($y / $Cell); if ($cy -ge $H) { continue }
  for ($x = 0; $x -lt $MW; $x++) {
    $o = $row + $x * 3
    $b = $buf[$o]; $g = $buf[$o + 1]; $r = $buf[$o + 2]
    $cx = [int][Math]::Floor($x / $Cell); if ($cx -ge $W) { continue }
    # เทากลาง (กำแพง + เศษตัวหนังสือ — เดี๋ยวกรองด้วยขนาดก้อนข้างล่าง)
    if ([Math]::Abs($r - $g) -le 14 -and [Math]::Abs($g - $b) -le 14 -and
        [Math]::Abs($r - $b) -le 14 -and $r -ge 105 -and $r -le 190) {
      $grey[$cy * $W + $cx]++
    }
    if ($r -lt 115) { continue }
    if (($r - $g) -lt 35 -or ($r - $b) -lt 30) { continue }
    if ([Math]::Abs($g - $b) -gt 45 -or $g -gt 160 -or $b -gt 165) { continue }
    $inSkip = $false
    foreach ($s in $skip) {
      if ($x -ge $s[0] -and $x -lt ($s[0] + $s[2]) -and $y -ge $s[1] -and $y -lt ($s[1] + $s[3])) {
        $inSkip = $true; break
      }
    }
    if ($inSkip) { continue }
    $cnt[$cy * $W + $cx]++
  }
}

# กำแพง = ช่องเทา ≥3px ที่อยู่ในก้อนต่อเนื่อง (8 ทิศ) ขนาด ≥ 40 ช่อง
# — กำแพงจริงเป็นโครงยาวหลายร้อยช่อง ส่วนตัวหนังสือเทาเป็นก้อนจิ๋ว 1–6 ช่อง ตกเกณฑ์หมด
$isG = New-Object bool[] ($W * $H)
for ($i = 0; $i -lt $isG.Length; $i++) { if ($grey[$i] -ge 3) { $isG[$i] = $true } }
$wallCell = New-Object bool[] ($W * $H)
$seen = New-Object bool[] ($W * $H)
for ($i = 0; $i -lt $isG.Length; $i++) {
  if (-not $isG[$i] -or $seen[$i]) { continue }
  $comp = New-Object System.Collections.Generic.List[int]
  $stack = New-Object System.Collections.Generic.Stack[int]
  $stack.Push($i); $seen[$i] = $true
  while ($stack.Count) {
    $c = $stack.Pop(); $comp.Add($c)
    $cx = $c % $W; $cy = [int][Math]::Floor($c / $W)
    for ($dy = -1; $dy -le 1; $dy++) { for ($dx = -1; $dx -le 1; $dx++) {
      $nx = $cx + $dx; $ny = $cy + $dy
      if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $W -or $ny -ge $H) { continue }
      $j = $ny * $W + $nx
      if ($isG[$j] -and -not $seen[$j]) { $seen[$j] = $true; $stack.Push($j) }
    } }
  }
  if ($comp.Count -ge 40) { foreach ($c in $comp) { $wallCell[$c] = $true } }
}

# '0' ว่าง · '1' เส้นประแดง · '2' กำแพงเมืองจีน (แดงชนะถ้าทับกัน)
$rows = New-Object System.Text.StringBuilder
$marked = 0; $markedW = 0
for ($y = 0; $y -lt $H; $y++) {
  $line = New-Object System.Text.StringBuilder $W
  for ($x = 0; $x -lt $W; $x++) {
    $i = $y * $W + $x
    if ($cnt[$i] -ge $MinPx)  { [void]$line.Append('1'); $marked++ }
    elseif ($wallCell[$i])    { [void]$line.Append('2'); $markedW++ }
    else                      { [void]$line.Append('0') }
  }
  [void]$rows.AppendLine('"' + $line.ToString() + '",')
}

$header = @"
/* bordermask.js — สร้างโดย tools\bordermask.ps1 ห้ามแก้ด้วยมือ
 * ตาราง $W x $H ช่อง · 1 ช่อง = $Cell หน่วยบนแผนที่ (${MW}x${MH})
 * '1' = เส้นประเขตแดนหมึกแดงของแผ่น (เว้นกรอบตัวอักษร SHU/WEI/WU แล้ว)
 * '2' = กำแพงเมืองจีน (โครงเทาต่อเนื่อง — ชายแดนเหนือของจักรวรรดิ)
 * เป็นช่องดิบตามหมึก — build_geo.js เป็นคนถมช่องไฟกับพองเป็นกำแพงเอง
 * ใช้โดย tools\build_geo.js: ทั้งสองชนิดเป็นแนวกั้นการระบายสี (DECISIONS §16)
 */
window.TK = window.TK || {};
window.TK.bordermask = { cell:$Cell, w:$W, h:$H, rows:[
"@

($header + $rows.ToString().TrimEnd("`r`n").TrimEnd(',') + "`n]};`n") |
  Out-File $out -Encoding utf8

"เขียน data\bordermask.js แล้ว — $W x $H ช่อง · หมึกแดง $marked ช่อง · กำแพง $markedW ช่อง"
