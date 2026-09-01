<#
  landmask.ps1 — อ่าน assets\map.jpg แล้วแยก "พื้นดิน" ออกจาก "พื้นน้ำ"
  เขียนผลเป็น data\landmask.js (ตาราง 0/1 ความละเอียด 5 หน่วยแผนที่ต่อช่อง)

  ทำไมต้องมีไฟล์นี้: build_geo.js ต้องรู้ว่าชายฝั่งอยู่ตรงไหน จะได้ระบายสีหยุดที่ทะเล
  แต่ Node เปล่า ๆ ถอดรหัส JPEG ไม่ได้ และจะให้เปิดเบราว์เซอร์มาอ่านก็ติด canvas taint
  ตอนเปิดแบบ file:// — ฝั่ง .NET ของ Windows อ่านได้ตรง ๆ จบ

  รันครั้งเดียว ไม่ต้องรันซ้ำจนกว่าจะเปลี่ยนไฟล์แผนที่:
    tools\landmask.ps1
#>
[CmdletBinding()]
param([int]$Cell = 5)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'assets\map.jpg'
$out  = Join-Path $root 'data\landmask.js'

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$MW = $bmp.Width; $MH = $bmp.Height
$W = [int][Math]::Floor($MW / $Cell)
$H = [int][Math]::Floor($MH / $Cell)

# ย่อภาพลงก่อนแล้วค่อยอ่านทีละพิกเซล เร็วกว่าอ่านต้นฉบับ 3.2 ล้านจุดมาก
$small = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($small)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmp, 0, 0, $W, $H)
$g.Dispose(); $bmp.Dispose()

$rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$bits = $small.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $bits.Stride
$buf = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $buf, 0, $buf.Length)
$small.UnlockBits($bits); $small.Dispose()

# ทะเล/ทะเลสาบบนแผนที่ต้นฉบับเป็นฟ้าอ่อน — ฟ้าเด่นกว่าแดงชัดเจนและสว่าง
# เกณฑ์นี้ได้จากการวัดจริงในเบราว์เซอร์ ไม่ได้เดา
$rows = New-Object System.Text.StringBuilder
$land = 0
for ($y = 0; $y -lt $H; $y++) {
  $line = New-Object System.Text.StringBuilder $W
  for ($x = 0; $x -lt $W; $x++) {
    $i = $y * $stride + $x * 3          # ลำดับไบต์เป็น BGR
    $b = $buf[$i]; $r = $buf[$i + 2]
    if ($b -gt $r + 18 -and $b -gt 150) { [void]$line.Append('0') }
    else                                { [void]$line.Append('1'); $land++ }
  }
  [void]$rows.AppendLine('"' + $line.ToString() + '",')
}

$header = @"
/* landmask.js — สร้างโดย tools\landmask.ps1 ห้ามแก้ด้วยมือ
 * ตาราง $W x $H ช่อง · 1 ช่อง = $Cell หน่วยบนแผนที่ (${MW}x${MH})
 * '1' = พื้นดิน · '0' = พื้นน้ำ
 * ใช้โดย tools\build_geo.js เพื่อให้สีพื้นที่ยึดครองหยุดที่ชายฝั่งจริง
 */
window.TK = window.TK || {};
window.TK.landmask = { cell:$Cell, w:$W, h:$H, rows:[
"@

($header + $rows.ToString().TrimEnd("`r`n").TrimEnd(',') + "`n]};`n") |
  Out-File $out -Encoding utf8

"เขียน data\landmask.js แล้ว — $W x $H ช่อง · พื้นดิน $land ช่อง ($([Math]::Round($land/($W*$H)*100,1))%)"
