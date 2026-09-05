<#
  plate_ink.ps1 — เฟส 0 ของโครงการ "วาดแผ่นใหม่" (รอบสอง · 2026-09-05)

  คำถามที่ไฟล์นี้ตอบ: **หมึกบนแผ่นเดิมสะอาดพอจะลอกออกมาเป็นเส้นของเราเองไหม**
  ไม่ใช่ "ภูมิศาสตร์จริงอยู่ตรงไหน" — รอบที่แล้วถามคำถามนั้นแล้วล้ม (DECISIONS §14)

  รอบนี้ต่างตรงที่ **แหล่งข้อมูลคือแผ่นเอง** ไม่ใช่ Natural Earth
  → ไม่มีความคลาดให้เห็น เพราะไม่มีของสองชุด · และเส้นถนน 98 เส้นที่ลากไว้แล้ว
    ยังอยู่กับร่องน้ำเดิมทุกเส้น (ดู tools/trace_river.js ที่ลากถนนจาก landmask จริง)

    powershell -File tools\plate_ink.ps1

  เขียนอะไรบ้าง (ทั้งหมดเป็นของชั่วคราว ไม่แตะ data/ ไม่แตะโปรดักต์):
    tools\_ink_preview.png    ภาพ false-colour ให้เจ้าของดูว่า "ถ้าลบภาพพื้นออก เหลืออะไร"
    <scratch>\water.rle       mask น้ำแบบ run-length (ให้ Node อ่านต่อในเฟส 1)
    <scratch>\relief.rle      mask ภูเขา

  เกณฑ์สีสืบทอดของเดิมทั้งสองตัว ไม่ได้เดาใหม่:
    น้ำ    b > r+18 และ b > 150            (tools\landmask.ps1 — วัดในเบราว์เซอร์แล้ว)
    ภูเขา  g > r+22 และ g > b+22 และ g < 215 (DECISIONS §3 ชั้นภูมิประเทศ)
#>
[CmdletBinding()]
param(
  [string]$Out = '',
  [string]$Rle = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Out) { $Out = Join-Path $here '_ink_preview.png' }
if (-not $Rle) { $Rle = $here }
$root = Split-Path -Parent $here
$src  = Join-Path $root 'assets\map.jpg'

$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class PlateInk {
  public const byte PAPER=0, WATER=1, RELIEF=2, DARK=3;

  public static string Run(string src, string outPng, string waterRle, string reliefRle, string darkRle){
    Bitmap bmp = (Bitmap)Bitmap.FromFile(src);
    int W = bmp.Width, H = bmp.Height;
    BitmapData bd = bmp.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
    int stride = bd.Stride;
    byte[] buf = new byte[stride*H];
    Marshal.Copy(bd.Scan0, buf, 0, buf.Length);
    bmp.UnlockBits(bd); bmp.Dispose();

    byte[] cls = new byte[W*H];
    long nW=0, nR=0, nD=0, nP=0;
    for (int y=0; y<H; y++){
      int row = y*stride, o = y*W;
      for (int x=0; x<W; x++){
        int i = row + x*3;
        int b = buf[i], g = buf[i+1], r = buf[i+2];
        byte c;
        if (b > r+18 && b > 150)                 { c = WATER;  nW++; }
        else if (g > r+22 && g > b+22 && g < 215) { c = RELIEF; nR++; }
        else if (r < 110 && g < 110 && b < 110)   { c = DARK;   nD++; }
        else                                      { c = PAPER;  nP++; }
        cls[o+x] = c;
      }
    }

    // ── ชิ้นส่วนน้ำแบบ 8 ทิศ (flood fill แบบ stack ไม่ใช้ recursion) ──
    int[] lab = new int[W*H];
    List<int> sizes = new List<int>();
    List<int[]> boxes = new List<int[]>();   // x0,y0,x1,y1
    int[] stack = new int[W*H];
    int nextLab = 0;
    for (int p=0; p<W*H; p++){
      if (cls[p]!=WATER || lab[p]!=0) continue;
      nextLab++;
      int sp=0; stack[sp++]=p; lab[p]=nextLab;
      int size=0, x0=W, y0=H, x1=-1, y1=-1;
      while (sp>0){
        int q = stack[--sp]; size++;
        int qx = q % W, qy = q / W;
        if (qx<x0) x0=qx; if (qx>x1) x1=qx;
        if (qy<y0) y0=qy; if (qy>y1) y1=qy;
        for (int dy=-1; dy<=1; dy++) for (int dx=-1; dx<=1; dx++){
          if (dx==0 && dy==0) continue;
          int nx=qx+dx, ny=qy+dy;
          if (nx<0||ny<0||nx>=W||ny>=H) continue;
          int np = ny*W+nx;
          if (cls[np]==WATER && lab[np]==0){ lab[np]=nextLab; stack[sp++]=np; }
        }
      }
      sizes.Add(size); boxes.Add(new int[]{x0,y0,x1,y1});
    }

    // ── PNG false-colour ──
    Bitmap outb = new Bitmap(W,H, PixelFormat.Format24bppRgb);
    BitmapData ob = outb.LockBits(new Rectangle(0,0,W,H), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
    int ostr = ob.Stride;
    byte[] obuf = new byte[ostr*H];
    for (int y=0; y<H; y++){
      int row=y*ostr, o=y*W;
      for (int x=0; x<W; x++){
        int i=row+x*3; byte c=cls[o+x];
        byte r,g,b;
        if (c==WATER)       { r=0x1b; g=0x6e; b=0xc2; }
        else if (c==RELIEF) { r=0x2f; g=0x7d; b=0x32; }
        else if (c==DARK)   { r=0x18; g=0x18; b=0x18; }
        else                { r=0xf4; g=0xf0; b=0xe6; }
        obuf[i]=b; obuf[i+1]=g; obuf[i+2]=r;
      }
    }
    Marshal.Copy(obuf, 0, ob.Scan0, obuf.Length);
    outb.UnlockBits(ob);
    outb.Save(outPng, ImageFormat.Png);
    outb.Dispose();

    // ── ใบที่สอง: แผ่นที่ถูกถอดตัวหนังสือ/ไอคอนออกหมด เหลือแต่ที่เราลอกได้ ──
    //   ทิ้งชิ้นน้ำที่เล็กกว่า MINPX — ตัวอักษรสีน้ำเงินบนแผ่น (ชื่อแม่น้ำ · WEI)
    //   แตกเป็นชิ้นเล็ก ๆ ทีละตัวอักษร ส่วนแม่น้ำจริงเป็นเส้นยาวต่อกัน
    const int MINPX = 200;
    bool[] keep = new bool[nextLab+1];
    for (int i=0;i<sizes.Count;i++) keep[i+1] = sizes[i] >= MINPX;
    int dropped=0; foreach(int z in sizes) if (z<MINPX) dropped++;

    Bitmap cb = new Bitmap(W,H, PixelFormat.Format24bppRgb);
    BitmapData cbd = cb.LockBits(new Rectangle(0,0,W,H), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
    int cstr = cbd.Stride;
    byte[] cbuf = new byte[cstr*H];
    for (int y=0; y<H; y++){
      int row=y*cstr, o=y*W;
      for (int x=0; x<W; x++){
        int i=row+x*3; byte c=cls[o+x];
        byte r,g,b;
        if (c==WATER && keep[lab[o+x]]) { r=0x6f; g=0x9c; b=0xbe; }
        else if (c==RELIEF)             { r=0x93; g=0xa4; b=0x86; }
        else                            { r=0xf2; g=0xed; b=0xe3; }
        cbuf[i]=b; cbuf[i+1]=g; cbuf[i+2]=r;
      }
    }
    Marshal.Copy(cbuf, 0, cbd.Scan0, cbuf.Length);
    cb.UnlockBits(cbd);
    cb.Save(outPng.Replace("_ink_preview","_ink_clean"), ImageFormat.Png);
    cb.Dispose();

    WriteRle(waterRle,  cls, WATER,  W, H);
    WriteRle(reliefRle, cls, RELIEF, W, H);
    WriteRle(darkRle,   cls, DARK,   W, H);

    // ── รายงาน ──
    StringBuilder s = new StringBuilder();
    double tot = (double)(W*H);
    s.AppendLine("ขนาดแผ่น " + W + " x " + H + " = " + (W*H) + " พิกเซล");
    s.AppendLine(String.Format("  น้ำ    {0,9} ({1,5:0.00}%)", nW, nW/tot*100));
    s.AppendLine(String.Format("  ภูเขา  {0,9} ({1,5:0.00}%)", nR, nR/tot*100));
    s.AppendLine(String.Format("  หมึกดำ {0,9} ({1,5:0.00}%)  = ตัวหนังสือ+ไอคอน+เส้นเขต ที่จะหายไปตอนวาดใหม่", nD, nD/tot*100));
    s.AppendLine(String.Format("  พื้น   {0,9} ({1,5:0.00}%)", nP, nP/tot*100));
    s.AppendLine();
    s.AppendLine("ชิ้นส่วนน้ำทั้งหมด " + sizes.Count + " ชิ้น · ทิ้งไป " + dropped + " ชิ้นที่เล็กกว่า 200px (ตัวอักษรสีน้ำเงิน+ขอบภาพ)");
    int[] thresh = {10000, 1000, 200, 50, 10};
    foreach (int t in thresh){
      int c=0; foreach (int z in sizes) if (z>=t) c++;
      s.AppendLine(String.Format("  ชิ้นที่ใหญ่กว่า {0,6} px : {1,5} ชิ้น", t, c));
    }
    // 20 ชิ้นใหญ่สุด
    int[] idx = new int[sizes.Count];
    for (int i=0;i<idx.Length;i++) idx[i]=i;
    Array.Sort(idx, delegate(int a, int b){ return sizes[b].CompareTo(sizes[a]); });
    s.AppendLine();
    s.AppendLine("20 ชิ้นใหญ่สุด (px · กล่องคลุม x0,y0-x1,y1)");
    for (int i=0; i<Math.Min(20, idx.Length); i++){
      int[] bx = boxes[idx[i]];
      s.AppendLine(String.Format("  {0,2}. {1,8} px   {2,4},{3,4} - {4,4},{5,4}   กว้าง {6,4} สูง {7,4}",
        i+1, sizes[idx[i]], bx[0],bx[1],bx[2],bx[3], bx[2]-bx[0], bx[3]-bx[1]));
    }
    return s.ToString();
  }

  static void WriteRle(string path, byte[] cls, byte want, int W, int H){
    StringBuilder s = new StringBuilder();
    s.AppendLine(W + " " + H);
    for (int y=0; y<H; y++){
      int o=y*W, x=0; bool first=true;
      while (x<W){
        while (x<W && cls[o+x]!=want) x++;
        if (x>=W) break;
        int st=x;
        while (x<W && cls[o+x]==want) x++;
        if(!first) s.Append(' ');
        s.Append(st); s.Append(':'); s.Append(x-st);
        first=false;
      }
      s.Append('\n');
    }
    File.WriteAllText(path, s.ToString());
  }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$wr = Join-Path $Rle '_plate_water.rle'
$rr = Join-Path $Rle '_plate_relief.rle'
$dr = Join-Path $Rle '_plate_dark.rle'
$report = [PlateInk]::Run($src, $Out, $wr, $rr, $dr)
Write-Output $report
Write-Output ''
Write-Output ("ภาพ false-colour : " + $Out)
Write-Output ("mask น้ำ         : " + $wr)
Write-Output ("mask ภูเขา       : " + $rr)
