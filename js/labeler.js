/* labeler.js — วางป้ายชื่อสถานที่อัตโนมัติ
 *
 * แก้ปัญหา "ชื่อซ้อนทับกัน" ด้วยอัลกอริทึม ไม่ใช่ด้วยการขยับพิกัดทีละอัน
 * (point-feature label placement — วิธีมาตรฐานทางแผนที่)
 *
 * สามชั้น:
 *   1. จัดลำดับความสำคัญ  นครหลวง=1 · เมืองใหญ่=2 · เมือง=3 · ด่าน/ภูเขา=4
 *   2. LOD ตามระดับซูม     ซูมออกโชว์เฉพาะอันดับต้น ซูมเข้าค่อยปล่อยอันดับรอง
 *   3. ตรวจชนแล้วหลบ       ลอง 8 ตำแหน่งรอบหมุด เอาอันแรกที่ไม่ทับใคร ไม่มีที่ว่าง = ซ่อน
 *
 * ผลลัพธ์: ไม่ต้องแก้พิกัดป้ายด้วยมือเลยตลอดโปรเจกต์
 *
 * ⚠ ชั้นที่ 3 หลบได้เฉพาะของที่ "เราวาดเอง" เท่านั้น
 *   มันมองไม่เห็นตัวหนังสือที่พิมพ์ติดมากับ map.jpg และนั่นคือของที่รกจริง:
 *   94 จาก 107 สถานที่มีชื่ออังกฤษพิมพ์อยู่บนภาพพื้นแล้ว (นับใหม่ 2026-09-05 · ตัวเลขเดิม 119/122 ค้างจากตอน places ยังมี 122 จุด) (places.js ฟิลด์ `map`)
 *   ตอนเป็นชื่อไทยเรื่องนี้ไม่เป็นปัญหา เพราะ "เตียงอาน" กับ "Chang An" อ่านแยกกันออก
 *   พอแปลเป็นอังกฤษ เรากลายเป็นพิมพ์ "Chang'an" ทับ "Chang An" ที่ห่างกันไม่กี่พิกเซล
 *   — และถ้าฉากนั้นปักหมุดด้วย ก็ได้ข้อความสามชั้นซ้อนกัน (ป้ายหมุด + ชื่อเมือง + ชื่อบนภาพ)
 *
 *   ทางแก้ไม่ใช่ไปหลบให้เก่งขึ้น แต่คือ "เลิกแข่งกับแผนที่พื้น":
 *     วาดชื่อของเราเฉพาะเมื่อ (ก) ฉากนี้พูดถึงมัน หรือ (ข) แผนที่พื้นไม่ได้พิมพ์ชื่อไว้ให้
 *   ที่เหลือปล่อยให้แผนที่พื้นทำหน้าที่ของมัน — ที่ระดับซูมของฉากจริง ๆ
 *   ตัวหนังสือบนภาพถูกขยายจนใหญ่กว่าป้ายของเราอยู่แล้ว
 */
window.TK = window.TK || {};

TK.labeler = (function(){

  /* ★ 2026-09-02 เพิ่ม farm/depot/valley_mouth/fort — ระดับเดียวกับ camp สำหรับ *ชื่อ*
     ⚠ ตารางนี้จัดตาม "ความสำคัญของชื่อ" เท่านั้น · **สัญลักษณ์ใช้ `SYM_RANK` ของ
     strategic.js ซึ่งเป็นคนละตารางและจัดลำดับสวนทางกันโดยตั้งใจ** (ด่านอันดับ 4 ที่นี่
     แต่อันดับ 1 ที่โน่น) — เหตุผลเต็มอยู่ในคอมเมนต์ของ SYM_RANK */
  const RANK = { capital:1, city:2, town:3, pass:4, ford:4, mountain:4, camp:4,
                 farm:4, depot:4, valley_mouth:4, fort:4 };

  /* ซูมออกสุด (w=1650) โชว์แค่นครหลวง · ยิ่งซูมเข้ายิ่งปล่อยอันดับรองออกมา
     ด่านกับภูเขา (อันดับ 4) โผล่เฉพาะตอนซูมเข้าใกล้จริง ๆ
     — แต่ถ้าฉากนั้นพูดถึงมัน จะถูก force ให้โผล่เสมอไม่ว่าซูมระดับไหน */
  function maxRank(vbw){
    if (vbw > 1100) return 1;
    if (vbw > 650)  return 2;
    if (vbw > 330)  return 3;
    return 4;
  }

  /* วัดความกว้างข้อความจริงด้วย canvas — แม่นกว่าเดาจากจำนวนตัวอักษร
     สำคัญมากกับภาษาไทยที่สระบน-ล่างไม่กินความกว้าง */
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const wCache = new Map();
  const metricsCache = new Map();
  function textMetrics(text,fontPx,fontFamily){
    const key=text+'|'+fontPx+'|'+fontFamily;
    if(!metricsCache.has(key)){
      ctx.font=`600 ${fontPx}px ${fontFamily}`;
      const m=ctx.measureText(text);
      metricsCache.set(key,{ascent:Math.max(fontPx*.95,m.actualBoundingBoxAscent||0),descent:Math.max(fontPx*.25,m.actualBoundingBoxDescent||0)});
    }
    return metricsCache.get(key);
  }
  function textWidth(text, fontPx, fontFamily){
    const key = text + '|' + fontPx + '|' + fontFamily;
    if (wCache.has(key)) return wCache.get(key);
    ctx.font = `600 ${fontPx}px ${fontFamily}`;
    const w = ctx.measureText(text).width;
    wCache.set(key, w);
    return w;
  }

  /* ตำแหน่งผู้สมัคร 8 จุดรอบหมุด เรียงตามความสวยงาม (ขวาก่อน แล้วซ้าย แล้วบน-ล่าง แล้วมุม) */
  const CANDIDATES = [
    { dx: 1, dy: 0.32, anchor:'start'  },   // ขวา
    { dx:-1, dy: 0.32, anchor:'end'    },   // ซ้าย
    { dx: 0, dy:-0.9,  anchor:'middle' },   // บน
    { dx: 0, dy: 1.5,  anchor:'middle' },   // ล่าง
    { dx: 1, dy:-0.75, anchor:'start'  },   // บนขวา
    { dx: 1, dy: 1.35, anchor:'start'  },   // ล่างขวา
    { dx:-1, dy:-0.75, anchor:'end'    },   // บนซ้าย
    { dx:-1, dy: 1.35, anchor:'end'    }    // ล่างซ้าย
  ];

  const overlaps = (a,b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /**
   * @param places  {id: {label,map,x,y,type}}  ทั้งหมด
   * @param vb      {x,y,w,h} viewBox ปัจจุบัน
   * @param screenW ความกว้างจริงบนจอ (px)
   * @param opts    { force:Set<id>  สถานที่ที่ฉากนี้พูดถึง — โชว์เสมอไม่สนใจ LOD
   *                  quiet:Set<id>  ฉากนี้พิมพ์ข้อความของมันเองไว้ตรงหมุดแล้ว
   *                                 (m.label ของ marker) → อย่าพิมพ์ชื่อเมืองซ้ำอีก
   *                  fontPx:number  ขนาดตัวอักษรบนจอ (คงที่ทุกระดับซูม)
   *                  fontFamily:string
   *                  pinR:number    รัศมีหมุดบนจอ
   *                  avoid:[{x,y,w,h}]  ★ กล่องที่จองไว้แล้วโดย *ชั้นอื่น* (หน่วยแผนที่)
   *                                 — ป้ายของฉาก (mk-chip/mk-cap) อยู่คนละชั้นกับที่นี่
   *                                 ถ้าไม่ส่งมา ชื่อเมืองจะไปนอนทับป้ายของฉากได้ ซึ่ง
   *                                 ตัวตรวจข้อ 5 ของ selfcheck จับได้ 5 จุดตอน 2026-08-26
   *                                 กติกา: **ป้ายของฉากชนะเสมอ** ชื่อเมืองเป็นฝ่ายหลบ }
   * @returns { labels:[{id,x,y,anchor,fontMU}], pins:[id], hidden:number }
   */
  function layout(places, vb, screenW, opts){
    opts = opts || {};
    const force      = opts.force || new Set();
    const quiet      = opts.quiet || new Set();
    const fontPx     = opts.fontPx || 12;
    const fontFamily = opts.fontFamily || '"Leelawadee UI",sans-serif';
    const pinRpx     = opts.pinR || 5;
    /* ★★★ แผ่นพื้นพิมพ์ชื่อเมืองไว้ให้หรือเปล่า (เพิ่ม 2026-09-08)
       ค่าเริ่มต้น = true คือพฤติกรรมเดิมเป๊ะ (map.jpg พิมพ์ชื่อไว้ 94/107 จุด)
       ⚠ **แผ่นวาดใหม่ของ Codex ไม่มีชื่อพิมพ์เลยสักตัว** (`containsLabels:false`)
         เหตุผลทั้งหมดที่หัวไฟล์นี้เขียนไว้ว่า "เลิกแข่งกับแผนที่พื้น" จึงเป็นโมฆะบนแผ่นนั้น
         — ถ้ายังกรองด้วย `!p.map` อยู่ ผู้อ่านจะได้แผ่นที่สวยแต่ **โล้น ไม่มีชื่อเมืองเลย**
         (เจ้าของทัก 2026-09-08: *"แผนที่เก่ามันมีเมืองทุกเมืองเขียนชื่อบอกหมด ของเราปัจจุบันมันยังโล้น"*) */
    const plateNames = opts.plateNames !== false;

    const mu     = opts.mu || vb.w / screenW; // ใช้ meet scale จริงเมื่อมีขอบว่างบนจอ
    const fontMU = fontPx * mu;             // ป้ายมีขนาดคงที่บนจอทุกระดับซูม
    const lineMU = fontMU * 1.15;
    /* ★ `rankBonus` — ปล่อยอันดับรองเพิ่มกี่ขั้น (เพิ่ม 2026-09-08)
       แผ่นเก่าพิมพ์ชื่อ *ทุกเมือง* ไว้ในภาพ และชื่อพวกนั้น **ย่อ-ขยายตามแผนที่**
       ตอนซูมออกมันเลยเล็กลงแต่ยังอยู่ครบ · ป้ายของเราขนาด **คงที่บนจอ**
       ปล่อยครบ 107 อันตอนซูมออก = ทับกันจนอ่านไม่ออก LOD จึงยังต้องมี
       — bonus นี้คือปุ่มปรับว่าจะใจกว้างกว่าเดิมกี่ขั้นบนแผ่นที่ไม่มีชื่อพิมพ์มาให้ */
    const limit  = maxRank(vb.w) + (opts.rankBonus || 0);
    const pad    = fontMU * 0.28;

    /* คัดเฉพาะที่อยู่ในกรอบภาพ (เผื่อขอบไว้กันป้ายกระพริบตอนแพน) */
    const m = vb.w * 0.04;
    const inView = ([id,p]) =>
      p.x >= vb.x - m && p.x <= vb.x + vb.w + m &&
      p.y >= vb.y - m && p.y <= vb.y + vb.h + m;

    const visible = Object.entries(places).filter(inView).filter(([id,p])=>!opts.eligible || opts.eligible(id,p));

    /* หมุดที่แสดง — เดิมคือ "ทุกอันที่ผ่าน LOD" ซึ่งแปลว่าเราเอาจุดขาวไปแปะทับ
       จุดที่ map.jpg พิมพ์มาให้แล้วนับร้อยจุด เหลื่อมกันไปสองสามพิกเซล = เห็นเป็นจุดคู่
       ตอนนี้เหลือสองกรณีเท่านั้น:
         1. ฉากนี้พูดถึงมัน (force) — เป็นการชี้ ไม่ใช่การทำสารบัญ
         2. แผนที่พื้นไม่มีชื่อให้ (p.map เป็น null) — ของเราเป็นแหล่งเดียวที่มี
            กรณีนี้ยังคิด LOD อยู่ ไม่งั้นตอนซูมออกสุดจะมีจุดลอยไร้บริบท */
    const shown = visible.filter(([id,p]) =>
      force.has(id) || ((plateNames ? !p.map : true) && (RANK[p.type] || 4) <= limit));

    /* ★★ 2026-09-05 — หมุดไม่ใช่จุดกลม 4px อีกแล้ว
       ตั้งแต่มีสัญลักษณ์สถานที่ (§3) รูปที่วาดจริงสูงได้ถึง ~34px และ **ยึดที่ฐาน**
       (พิกัดของสถานที่อยู่กึ่งกลางฐานของรูป รูปจึงกินที่ *เหนือ* จุดขึ้นไปทั้งหมด)
       ถ้ายังคิดเป็นวงกลมรัศมี 4 ป้ายจะไปนอนทับรูปเต็ม ๆ
       → `opts.pinBox(id, p)` ให้ `strategic.js` ส่งกล่องจริงมา (มันเป็นคนวาด มันรู้ขนาด)
         ไม่ส่งมา = ใช้วงกลมแบบเดิม ของเก่าจึงไม่พัง */
    const boxOf = (id, p) => {
      const b = opts.pinBox && opts.pinBox(id, p);
      if (b && b.w > 0) return b;
      const r = (p.type === 'capital' ? pinRpx + 2 : pinRpx) * mu;
      return { x:p.x - r, y:p.y - r, w:r*2, h:r*2 };
    };
    /* จองพื้นที่ของหมุดทุกอันก่อน — ป้ายห้ามทับรูปของสถานที่อื่น */
    const taken = shown.map(([id,p]) => boxOf(id, p));
    /* ★ กล่องของชั้นอื่นที่จองไว้ก่อนแล้ว — ป้ายของฉากเป็นเจ้าของที่ ชื่อเมืองต้องหลบ */
    if (opts.avoid) for (const b of opts.avoid) if (b && b.w > 0 && b.h > 0) taken.push(b);

    /* เรียงลำดับ: ที่ถูก force มาก่อน แล้วตามอันดับความสำคัญ
       เพื่อให้เมืองสำคัญได้เลือกที่ก่อน เมืองรองค่อยหลบ */
    shown.sort((A,B) => {
      const fa = force.has(A[0]) ? 0 : 1, fb = force.has(B[0]) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (RANK[A[1].type]||4) - (RANK[B[1].type]||4);
    });

    const labels = [];
    let hidden = 0;
    const cap = opts.maxLabels || 26;      // เพดานกันจอรก อ่านไม่ออก

    for (const [id,p] of shown){
      /* ฉากพิมพ์ข้อความของมันเองไว้ที่หมุดนี้แล้ว (เช่น "Guo Huai stops the rout here")
         ชื่อเมืองอีกอันจะเป็นข้อความชั้นที่สาม ซ้อนกับชื่อบนแผนที่พื้นอีกที — ข้ามไป
         หมุดยังอยู่ มันแค่ไม่มีชื่อเมืองกำกับ */
      if (quiet.has(id)) continue;
      if (labels.length >= cap && !force.has(id)){ hidden++; continue; }
      const wPx = textWidth(p.label, fontPx, fontFamily);
      const wMU = wPx * mu;
      const metrics=textMetrics(p.label,fontPx,fontFamily);
      /* ★ ระยะเยื้องต้องคิดจาก **กล่องจริง** ไม่ใช่รัศมีเดียวใช้ทุกทิศ
         รูปยึดที่ฐาน → ด้านบนต้องเยื้องเท่าความสูงของรูป ส่วนด้านล่างไม่ต้องเยื้องเลย
         (ใต้จุดยึดไม่มีอะไรวาดอยู่) — ใช้รัศมีเดียวทุกทิศคือที่มาของป้ายทับรูป */
      const bx  = boxOf(id, p);
      const halfW = bx.w / 2;
      const upH   = (p.y - bx.y);            /* รูปสูงเหนือจุดยึดเท่าไร */

      let placed = null;
      /* ★★★ ที่ที่ฉากชี้ต้องได้ชื่อ **เสมอ** — เก็บตัวเลือกที่ทับน้อยที่สุดไว้เป็นทางลง
         (เจ้าของสั่ง 2026-09-10: *"เวลา highlight สถานที่ไหน ชื่อเมืองมันหาย ไม่เอาแบบนี้"*)
         ⚠ ของเดิมลองครบแปดทิศแล้วถ้าไม่ว่างเลยก็ **ทิ้งชื่อ** — ซึ่งยอมรับได้สำหรับเมือง
           ทั่วไป (หมุดยังอยู่ ฮอเวอร์ได้) แต่ **ยอมไม่ได้สำหรับที่ที่ฉากกำลังชี้**
           วัดแล้วเกิดจริง 23 ฉาก กระจุกที่ด่านถง/ด่านหานกู่/เถาหลิน ซึ่งอยู่ชิดกันสามจุด
         ★ ทับนิดหน่อยยังอ่านออก · ไม่มีชื่อเลยอ่านไม่ออกแน่นอน — เลือกอย่างแรก */
      let fallback = null, fallbackCost = Infinity;
      /* ★★ ลอง **ขยับออกห่างหมุด** ก่อนจะยอมให้ทับ — ที่แน่นมักแน่นเฉพาะวงในรอบหมุด
         (ด่านถง–ด่านหานกู่–เถาหลิน อยู่กันในรัศมี 40 หน่วย) ถอยออกอีกนิดก็มีที่ว่างแล้ว
         ⚠ ระยะ 1.0 คือพฤติกรรมเดิมเป๊ะ — ป้ายทั่วไปได้แค่รอบนี้รอบเดียว ไม่มีอะไรเปลี่ยน
           สองระยะที่เหลือเปิดให้ **เฉพาะที่ที่ฉากชี้** ซึ่งเป็นจุดที่ยอมให้ชื่อหายไม่ได้ */
      const SPREADS = force.has(id) ? [1, 1.6, 2.4] : [1];
      for (const sp of SPREADS){
      for (const c of CANDIDATES){
        const x = p.x + c.dx * (halfW + pad*1.6) * sp;
        const y = c.dy < 0 ? bx.y - pad*1.2 + c.dy * lineMU * 0.1 * sp
                : c.dy > 1 ? p.y + c.dy * lineMU * sp   /* ล่าง — ไม่มีรูปขวาง */
                :            p.y + c.dy * lineMU * sp + (c.dx === 0 ? 0 : -upH * 0.35);
        const boxX = c.anchor === 'start' ? x
                   : c.anchor === 'end'   ? x - wMU
                   :                        x - wMU/2;
        // รวมสระบน/ล่างและ halo ของไทย ไม่ประมาณจาก line-height อย่างเดียว
        const box = { x:boxX - pad, y:y - metrics.ascent*mu - pad,
                      w:wMU + pad*2, h:(metrics.ascent+metrics.descent)*mu + pad*2 };
        if (!taken.some(t => overlaps(box, t))){
          taken.push(box);
          placed = { id, x, y, anchor:c.anchor, fontMU };
          break;
        }
        if (force.has(id)){
          /* พื้นที่ทับรวม — ตัวเลือกที่ทับน้อยที่สุดชนะ · เก็บจากทุกระยะ */
          let cost = 0;
          for (const t of taken){
            const ow = Math.min(box.x+box.w, t.x+t.w) - Math.max(box.x, t.x);
            const oh = Math.min(box.y+box.h, t.y+t.h) - Math.max(box.y, t.y);
            if (ow > 0 && oh > 0) cost += ow * oh;
          }
          if (cost < fallbackCost){ fallbackCost = cost; fallback = { id, x, y, anchor:c.anchor, fontMU, box }; }
        }
      }
      if (placed) break;
      }
      if (!placed && fallback){            /* ★ ทางลงของที่ที่ฉากชี้ — ทับน้อยที่สุดดีกว่าไม่มีชื่อ */
        taken.push(fallback.box);
        placed = { id, x:fallback.x, y:fallback.y, anchor:fallback.anchor, fontMU:fallback.fontMU };
      }
      if (placed) labels.push(placed);
      else hidden++;                       // ไม่มีที่ว่าง → เหลือแต่หมุด (hover ค่อยโผล่)
    }

    return { labels, pins: shown.map(s => s[0]), hidden, limit };
  }

  return { layout, RANK, maxRank, textWidth };
})();
