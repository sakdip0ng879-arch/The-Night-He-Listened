/* strategic.js — แผนที่ยุทธศาสตร์
 *
 * SVG ชั้นเดียวครอบ JPG ใช้ viewBox = พิกัดพิกเซลของภาพต้นฉบับ (DECISIONS §4)
 * Zoom/Pan = แก้ค่า viewBox อย่างเดียว ห้ามซ้อน CSS transform (DECISIONS §5)
 */
window.TK = window.TK || {};

TK.map = (function(){

  const NS = 'http://www.w3.org/2000/svg';
  const W = 1650, H = 1950;

  /* ⚠ preserveAspectRatio="meet" ย่อ/ขยายตามด้านที่ "คับกว่า"
     ถ้า viewBox มีสัดส่วนไม่ตรงกับกล่องบนจอ จะเกิดขอบดำและสเกลไม่ใช่ w/screenW
     → บังคับสัดส่วน viewBox ให้ตรงกับกล่องเสมอ กล้องถึงจะไปตรงที่สั่งจริง ๆ */
  const fitAR = () => (host.clientHeight || 1) / (host.clientWidth || 1);
  const mk = (n,a) => { const e = document.createElementNS(NS,n);
    for (const k in (a||{})) e.setAttribute(k,a[k]); return e; };

  let svg, layers = {}, host;
  let vb = { x:0, y:0, w:W, h:H };
  let camCancel = null, scaleCache = null;
  let forceLabels = new Set();
  /* สถานที่ที่ marker ของฉากพิมพ์ข้อความของตัวเองไว้แล้ว — labeler จะได้ไม่พิมพ์ชื่อเมืองซ้อนอีกชั้น */
  let quietLabels = new Set();
  /* ต้องเก็บ timer กับ tween ของลูกศรไว้ยกเลิก ไม่งั้นกดต่อไปรัว ๆ
     แอนิเมชันของฉากเก่าจะค้างวิ่งทับกันไปเรื่อย ๆ จนเครื่องหน่วง */
  let mkTimers = [], mkTweens = [];
  const regionEl = {}, pinEl = {}, labelEl = {};

  /* ── สัญลักษณ์กองทัพ (DECISIONS §6) ── */
  function unitShape(kind, s){
    switch (kind){
      case 'triangle': return mk('polygon',{points:`0,${-s} ${s},${s*0.8} ${-s},${s*0.8}`});
      case 'hex':      return mk('polygon',{points:
        [0,30,90,150,210,270,330].slice(1).map(a=>{
          const r=a*Math.PI/180; return `${(s*Math.cos(r)).toFixed(1)},${(s*Math.sin(r)).toFixed(1)}`;
        }).join(' ')});
      case 'circle':   return mk('circle',{r:s});
      /* ประทุนเกวียน — ขบวนลำเลียงเสบียง · รูปเดียวกับใน battle.js shapeOf()
         ต้องมีทั้งสองที่ ไม่งั้นขบวนเสบียงบนแผนที่ใหญ่จะตกไปเป็นสี่เหลี่ยม
         ซึ่งตารางสัญลักษณ์ล็อกไว้แล้วว่าแปลว่าทหารราบ */
      /* ตัวเรือ — กองเรือ (เจ้าของเคาะ 2026-09-01 · บทที่ 11)
         ทรงสมมาตรซ้าย-ขวาโดยตั้งใจ เพราะสัญลักษณ์กองทัพ **ไม่ถูกหมุนตามทิศ**
         (มีแต่หัวลูกศรที่หมุน) · ท้องเรือกว้างบน สอบล่าง = อ่านออกว่าเรือทุกมุม
         และไม่ชนกับล้อเกวียน (วงกลม) หรือทหารราบ (สี่เหลี่ยม) ในตารางสัญลักษณ์ */
      case 'boat':     return mk('polygon',{points:
        [[-1.25,-.42],[1.25,-.42],[1.25,-.18],[.82,.62],[-.82,.62],[-1.25,-.18]]
        .map(([x,y]) => `${(x*s).toFixed(1)},${(y*s).toFixed(1)}`).join(' ')});
      case 'wagon':    return mk('polygon',{points:
        [[-1.30,.62],[-1.30,-.10],[-1.02,-.62],[-.56,-.90],[0,-.98],
         [.56,-.90],[1.02,-.62],[1.30,-.10],[1.30,.62]]
        .map(([x,y]) => `${(x*s).toFixed(1)},${(y*s).toFixed(1)}`).join(' ')});
      default:         return mk('rect',{x:-s, y:-s, width:s*2, height:s*2});
    }
  }

  /* ── สร้างครั้งเดียว ── */
  function init(hostEl){
    host = hostEl;
    svg = mk('svg',{viewBox:`0 0 ${W} ${H}`, preserveAspectRatio:'xMidYMid meet', id:'tkmap'});
    host.append(svg);

    /* (marker #ahead ของเดิมถูกถอด 2026-08-25 — หัวลูกศรตอนนี้เป็น path ของเราเอง
       ที่โผล่ตอนเดินถึง (.mk-head ใน setMarkers) ตามแบบ ข ที่เจ้าของเคาะ) */
    svg.append(mk('image',{href:'assets/map.jpg', x:0, y:0, width:W, height:H, id:'basemap'}));
    /* ★★ แผ่นพื้นที่เราวาดเอง — อยู่ตรงที่เดียวกับ map.jpg เป๊ะ (DECISIONS §14 เฟส 4)
       เปิดทีละแผ่นด้วย setPlate() · ทั้งสองใช้กรอบพิกัด 1650×1950 ชุดเดียวกัน (กฎ 4) */
    svg.append(layers.plate = mk('g',{id:'L-plate'}));
    /* ชั้น roads อยู่ใต้ routes เสมอ — กราฟถนนเป็นฉากหลัง การเดินทัพของฉากต้องอยู่ทับ
       (DECISIONS §15 "โหมดถนน · มาฟรีกับ §4" — ข้อมูลมาจาก TK.edges ไม่มีของใหม่)

       ★★★ `water` อยู่ **หลัง** `regions` โดยตั้งใจ — หมึกน้ำต้องทับสีเขต ไม่ใช่จมอยู่ใต้
       ปี 221 แผ่นดินมีเจ้าของครบทุกตารางนิ้ว ชั้นเขตจึงคลุมบกทั้งผืน · ถ้าน้ำอยู่ข้างใต้
       ทุกครั้งที่เพิ่มความทึบของเขตให้สีฝ่ายชัด แม่น้ำจะจมหายไปพร้อมกัน (DECISIONS §14 เฟส 2) */
    for (const name of ['regions','water','wall','works','focus','roads','routes','markers','pins','labels'])
      svg.append(layers[name] = mk('g',{id:'L-'+name}));

    /* ── ปิดทับตัวอักษร WEI / SHU / WU ที่พิมพ์มากับแผนที่ (DECISIONS §3) ──
       แผ่นต้นฉบับพิมพ์ SHU เป็นแดงและ WU เป็นเขียว ซึ่งสลับกับคอนเวนชันสีของเรา
       ถ้าปล่อยไว้ คนอ่านจะเห็นสองระบบสีขัดกันบนภาพเดียว

       ⚠⚠ **กรอบต้องพอดีตัวอักษร ห้ามเผื่อ** — เจ้าของจับได้ 2026-08-25 ว่ากรอบ WEI
       เดิม (560,455 กว้าง 205) กว้างเกินไปทางขวา 45 หน่วย และ **มันไปลบแม่น้ำเหลือง**
       ที่ไหลผ่าน x 727–745 ลงไปหาท่า Puban ทิ้ง · ขอบบนก็ล้ำไปตัดแม่น้ำสายเล็กที่ x≈550
       วัดใหม่ด้วย tools/map_inspect.js: ตัวอักษร WEI กิน x 571–719 · y 493–546
       กรอบใหม่ 560,470 กว้าง 165 สูง 82 = x 560–725 · y 470–552
         · ขอบขวา 725 < 727 ที่แม่น้ำเริ่ม  ✓
         · ขอบซ้าย 560 > 552 ที่แม่น้ำสายเล็กจบ  ✓
       **ใครจะขยับกรอบนี้ ให้รัน `node tools\map_inspect.js 560 470 165 82 --grid 10`
         แล้วดูด้วยตาก่อนเสมอ** ตัวตรวจทุกตัวมองไม่เห็นข้อนี้

       opacity: WEI ใช้ 1 เพราะตัวอักษรมันใหญ่และเข้ม เหลือ 1.5% ก็ยังอ่านออกตอนซูมเข้า
       ส่วน SHU/WU ใช้ .985 ตามเดิม — เจ้าของตรวจแล้วว่าไม่มีปัญหา ไม่ต้องแตะ */
    const mask = mk('g',{id:'L-mask'});
    [[560,470,165,82,1],[262,1195,215,95,.985],[1175,1450,180,95,.985]]
      .forEach(([x,y,w,h,op]) =>
        mask.append(mk('rect',{x,y,width:w,height:h, fill:'#eef1f4', opacity:op})));
    svg.insertBefore(mask, layers.regions);

    buildPlate();
    buildRegions();
    buildWorks();
    buildPins();
    bindPanZoom();
    vb = fitBox(0, 0, W, H);        // เริ่มที่ทั้งแผ่นดิน โดยสัดส่วนตรงกับกล่อง
    applyVB();
    relayout();
    return api;
  }

  /* ══ ★★ แผ่นพื้นของเราเอง (DECISIONS §14 · เจ้าของเคาะสไตล์ "กลางคืน" 2026-09-05) ══
     ข้อมูลมาจาก data/plate_water.js ซึ่งลอกจาก **หมึกของ map.jpg เอง** ไม่ใช่ Natural Earth
     → ความคลาดจากถนน 98 เส้นและหมุด 73 จุดที่ปักไว้แล้ว = ศูนย์โดยนิยาม

     สีทั้งหมดอยู่ที่ css/style.css (`.pl-*`) ที่เดียว — ห้ามใส่สีตรงนี้
     ⚠ ทุกความหนาที่นี่เป็น **หน่วยแผ่น ไม่ใช่หน่วยจอ** เพราะมันคือแผ่นดิน
       ต้องโตตามแผ่นเหมือนแม่น้ำกับกำแพง (§3) · relayout จึงไม่ต้องแตะชั้นนี้เลย  */
  function buildPlate(){
    const PW = TK.plateWater;
    if (!PW){ layers.plate.remove(); return; }
    const ring = f => { let d = ''; for (let i = 0; i < f.length; i += 2)
      d += (i ? 'L' : 'M') + f[i] + ' ' + f[i+1]; return d + 'Z'; };

    layers.plate.append(mk('rect',{x:0, y:0, width:W, height:H, class:'pl-ground'}));

    /* น้ำตื้นริมฝั่ง — เส้นหนาจาง ๆ ตามขอบ ทำให้ชายฝั่งอ่านเป็น "ฝั่ง" ไม่ใช่ "รอยตัด"
       ⚠ ต้อง clip ไว้ในทะเล ไม่งั้นครึ่งนอกของเส้นจะล้นขึ้นบกเป็นหาดทรายจาง ๆ */
    const defs = mk('defs');
    layers.plate.append(defs);
    PW.sea.forEach((f, i) => {
      const d = ring(f), id = 'pl-clip-' + i;
      const cp = mk('clipPath',{id});
      cp.append(mk('path',{d}));
      defs.append(cp);
      layers.plate.append(mk('path',{d, class:'pl-sea'}));
      layers.plate.append(mk('path',{d, class:'pl-shelf', 'clip-path':`url(#${id})`}));
    });
    for (const f of PW.islands) layers.plate.append(mk('path',{d:ring(f), class:'pl-isl'}));
    for (const f of PW.lakes)   layers.plate.append(mk('path',{d:ring(f), class:'pl-lake'}));

    /* ── ★★★ สายน้ำ = **ลายฉลุหมึกของแผ่นเอง** ไม่ใช่เส้นที่เราวาดใหม่ ────────────
       เจ้าของทักรอบสาม (2026-09-05): *"ไล่ยังไงก็ไล่ไม่หมดหรอก ... มันเพี้ยนจากเดิม
       มหาศาลเลย ถ้ามันเพี้ยน มันกดดูแผนที่เดิมมันก็ดีกว่าอะ"* — **ถูกทุกคำ**

       ต้นตอไม่ใช่ตัวกรองไหนตัวหนึ่ง มันคือ **การถอดเป็นแกนกลางแล้ววาดใหม่**
       ซึ่งเปลี่ยนรูปทุกจุดโดยธรรมชาติ (ปลายมน มุมเรียบ ความกว้างเฉลี่ย)
       ต่อให้ลากถูกที่ทุกเส้น มันก็ยังไม่ใช่เส้นเดิม → ไล่เท่าไรก็ไม่มีวันตรง

       ทางออกคือ **ไม่แปลงรูปมันเลย** — ส่งหมึกของแผ่นไปทั้งอย่างนั้นเป็นลายฉลุ 1 บิต
       (assets/water_stencil.png · 21 KB) แล้วใช้เป็น mask ระบายสีของเรา
       ★ **ความเพี้ยนจากแผ่นเดิม = ศูนย์โดยนิยาม**

       ⚠ สิ่งที่เรายังทำได้คือ *ลบ* ของที่รู้แน่ว่าไม่ใช่น้ำ (ตัวอักษร · กรอบป้าย · WEI)
         ซึ่งทำไปแล้วตอนสร้างลายฉลุ — **การลบปลอดภัย การประดิษฐ์ไม่ปลอดภัย**
       ⚠ `PW.rivers` ยังอยู่ในข้อมูล แต่ **ไม่ได้ถูกวาด** — มันเป็นแหล่งความกว้างจริง
         และเป็นของที่ `check_water` ใช้ตรวจ · ห้ามเอากลับมาวาดโดยไม่อ่านหมายเหตุนี้ */
    const stencil = mk('mask', { id:'pl-watermask', maskUnits:'userSpaceOnUse',
                                 x:0, y:0, width:W, height:H });
    stencil.append(mk('image',{ href:'assets/water_stencil.png', x:0, y:0, width:W, height:H }));
    defs.append(stencil);
    layers.water.append(mk('rect',{ x:0, y:0, width:W, height:H,
                                    class:'pl-river-ink', mask:'url(#pl-watermask)' }));

    /* ── ★ กำแพงเมืองจีน (เจ้าของสั่ง 2026-09-05 "ในเมื่อวาดใหม่เองแล้ว ต้องวาดกำแพงด้วย") ──
       ข้อมูล data/wall.js ลอกจาก **หมึกเทาของแผ่นเอง** (bordermask ค่า '2') ชุดเดียวกับ
       ที่ build_geo ใช้เป็นกำแพงกั้นสีมาตั้งแต่ 2026-08-26 — ไม่มีข้อมูลใหม่แม้แต่จุดเดียว

       อยู่เหนือชั้นเขตเหมือนหมึกน้ำ เพราะมันคือเส้นที่เรื่องอ้างถึงตลอด (แนวชายแดนเหนือ)
       ★ วาดเป็นเส้น + **ฟันเสมา** ห้อยด้านใต้ — เพื่อให้อ่านออกทันทีว่าเป็นสิ่งที่ *คนสร้าง*
         ไม่ใช่แม่น้ำอีกสาย · ฟันหันลงใต้เสมอ เพราะกำแพงกันของที่มาจากทางเหนือ  */
    if (TK.wall){
      const TEETH = 9, TOOTH = 3.4;
      for (const line of TK.wall){
        let d = '';
        for (let i = 0; i < line.length; i++) d += (i ? 'L' : 'M') + line[i][0] + ' ' + line[i][1];
        layers.wall.append(mk('path',{ d, class:'pl-wall' }));
        let carry = 0;
        for (let i = 0; i + 1 < line.length; i++){
          const [ax, ay] = line[i], [bx, by] = line[i+1];
          const len = Math.hypot(bx-ax, by-ay);
          if (len < 0.01) continue;
          const ux = (bx-ax)/len, uy = (by-ay)/len;
          /* ตั้งฉากที่ชี้ลงใต้เสมอ */
          let nx = -uy, ny = ux;
          if (ny < 0){ nx = -nx; ny = -ny; }
          for (let s = TEETH - carry; s < len; s += TEETH){
            const px = ax + ux*s, py = ay + uy*s;
            layers.wall.append(mk('line',{ x1:px.toFixed(1), y1:py.toFixed(1),
              x2:(px + nx*TOOTH).toFixed(1), y2:(py + ny*TOOTH).toFixed(1), class:'pl-tooth' }));
          }
          carry = (carry + len) % TEETH;
        }
      }
    }
  }

  /* สลับแผ่น — คลาสเดียวคุมทั้ง: ซ่อน jpg · ซ่อนกรอบปิด WEI/SHU/WU · ดันความทึบของเขต
     (บนพื้นมืด .38 ทำให้เขียว/น้ำเงิน/แดงแยกกันยาก — DECISIONS §14 เฟส 2) */
  function setPlate(useNew){
    plateNew = !!useNew && !!TK.plateWater;
    document.getElementById('stage').classList.toggle('plate-new', plateNew);
    return plateNew;
  }
  let plateNew = false;

  function buildRegions(){
    for (const id in TK.regions){
      const r = TK.regions[id];
      const c = TK.factions[r.owner].color;
      /* fill = รูปที่ขยายจนชนกันเองและชนชายฝั่ง (data/geo_fill.js สร้างอัตโนมัติ)
         ถ้าไม่มีไฟล์นั้นก็ถอยไปใช้รูปที่ลากด้วยมือใน geo.js ได้เลย ไม่พัง */
      const p = mk('path',{d:r.fill || r.d, class:'region', fill:c, stroke:c});
      p.dataset.id = id;
      const t = mk('title'); t.textContent = r.label;
      p.append(t);
      layers.regions.append(p);
      regionEl[id] = p;
    }
  }

  /* ── ★★ สัญลักษณ์สถานที่ (DECISIONS §3 · ล็อก 2026-09-02) ──────────────────
     ทุกรูปวาดบนกล่อง 24×24 · **จุดยึด = (12,22) กึ่งกลางฐาน** = พิกัดจริงของสถานที่
     สเปกภาพฉบับเต็ม + ที่มาของแต่ละรูป: tools/symbols_preview.html

     ⚠ ภาษาของสถานที่ต่างจากภาษาของกองทัพ (§3): **หมึกดำล้วน ไม่มีสีฝ่าย · ติดพื้น
     ไม่เคลื่อน** ส่วนกองทัพ **ทึบ มีสีฝ่าย เคลื่อนบนเส้นทาง** — จึงไม่ต้องแย่งรูปกัน
     ⚠ `px` คือความสูงบนจอ (คงที่ทุกระดับซูม) ไม่ใช่หน่วยแผนที่                      */
  const GLYPH = {
    capital: { px:34, fill:[
      'M12,0.5 L14.2,3.2 L9.8,3.2 Z',
      'M4.5,8.6 C6.2,8.2 6.6,5.6 8.4,4.6 H15.6 C17.4,5.6 17.8,8.2 19.5,8.6 Z',
      'M8,8.6 H16 V12.2 H8 Z',
      'M0.8,16.4 C3,15.9 3.4,13.2 5.4,12.2 H18.6 C20.6,13.2 21,15.9 23.2,16.4 Z',
      'M2.6,16.4 H21.4 V22 H2.6 Z M10.4,18.2 H13.6 V22 H10.4 Z' ] },
    city: { px:30, fill:[
      'M3.2,10.2 C5.2,9.7 5.6,7.2 7.4,6.2 H16.6 C18.4,7.2 18.8,9.7 20.8,10.2 Z',
      'M6.6,10.2 H17.4 V13.6 H6.6 Z',
      'M3.4,13.6 H20.6 V22 H3.4 Z M10.4,17.4 H13.6 V22 H10.4 Z' ] },
    town: { px:30, fill:[
      'M4.6,13.4 C6.6,12.9 8.6,9.2 12,7.6 C15.4,9.2 17.4,12.9 19.4,13.4 Z',
      'M6.8,13.4 H17.2 V22 H6.8 Z M10.6,17.2 H13.4 V22 H10.6 Z' ] },
    /* ★ ด่านต้อง "คร่อมถนน" — ประตูสองบานเว้นช่องกลางไว้ให้เส้นทางลอด */
    pass: { px:30, fill:[
      'M0.4,8.4 C1.9,8 2.2,5.6 3.8,4.8 H8.4 V8.4 Z',  'M2.2,8.4 H8.4 V22 H2.2 Z',
      'M23.6,8.4 C22.1,8 21.8,5.6 20.2,4.8 H15.6 V8.4 Z', 'M15.6,8.4 H21.8 V22 H15.6 Z',
      'M8.4,6.2 H15.6 V9.4 H8.4 Z' ] },
    fort: { px:30, fill:[
      'M12,2.4 L15.4,6 L8.6,6 Z', 'M9.6,6 H14.4 V11.4 H9.6 Z',
      'M3,11.4 h3 v-2.2 h2.4 v2.2 h7.2 v-2.2 h2.4 v2.2 h3 V22 H3 Z' ] },
    /* ⚠ กระโจมโค้ง ไม่ใช่สามเหลี่ยม — สามเหลี่ยมชนกับภูเขา (เจ้าของจับได้ 2026-09-02) */
    camp: { px:30, fill:[
      'M4,17.2 C4,9.4 20,9.4 20,17.2 Z M10.6,17.2 V13.4 H13.4 V17.2 Z',
      'M1.2,18.4 H22.8 V20.6 H1.2 Z',
      'M2.4,18.4 H4.4 V22 H2.4 Z M7.6,18.4 H9.6 V22 H7.6 Z ' +
      'M12.8,18.4 H14.8 V22 H12.8 Z M18,18.4 H20 V22 H18 Z' ] },
    /* ⚠ ร่องนาเป็นเส้น **ตรง** เฉียง — เส้นหยักแปลว่าน้ำ จะชนกับท่าข้าม */
    farm: { px:30,
      fill:['M1.2,9.6 C2.6,9.2 3.6,7 5.8,6 C8,7 9,9.2 10.4,9.6 Z','M3.2,9.6 H8.4 V14.6 H3.2 Z'],
      stroke:[{d:'M1.4,15.4 L21,13.2',w:1.85},{d:'M1.4,18.6 L21,16.4',w:1.85},
              {d:'M1.4,21.8 L21,19.6',w:1.85}] },
    depot: { px:30, fill:[
      'M2.6,9.4 C5,8.8 8,4.4 12,3 C16,4.4 19,8.8 21.4,9.4 Z',
      'M5,9.4 h14 v8.2 a7,4.4 0 0 1 -14,0 Z' ] },
    ford: { px:30, stroke:[
      {d:'M1.6,9 q3,-2.4 6,0 t6,0 t6,0',w:2}, {d:'M1.6,15.4 q3,-2.4 6,0 t6,0 t6,0',w:2},
      {d:'M9,4.6 V19.8',w:2,dash:'3 2.6'},    {d:'M15,4.6 V19.8',w:2,dash:'3 2.6'} ] },
    valley_mouth: { px:30, fill:[
      'M0,21.4 L7,5.4 L10.4,21.4 Z','M13.6,21.4 L17,5.4 L24,21.4 Z','M11.2,17 H12.8 V22 H11.2 Z' ] },
    /* ภูเขาที่มีชื่อ = สามเหลี่ยมทึบ — คอนเวนชันเดิมของแผ่น (เขาฮวา · ติ้งจวิน · เฉินชาง
       พิมพ์แบบนี้อยู่แล้ว) · ส่วน *ภูมิประเทศ* ภูเขาเป็นคนละชั้น ยังไม่ได้ทำ (เฟส 4) */
    mountain: { px:30, fill:['M2,21.5 L12,6 L22,21.5 Z'] }
  };

  /* ★★ LOD ของ *สัญลักษณ์* — **ห้ามใช้ `RANK` ของ labeler** ถึงจะมีอยู่แล้วก็ตาม
     สองตารางนี้จัดลำดับด้วยเหตุผลคนละอย่างและขัดกันโดยตรง:
       labeler จัดตาม **ความสำคัญของชื่อ** → ด่านอยู่อันดับ 4 เพราะชื่อด่านน่าเบื่อ
       ที่นี่จัดตาม **ปริมาณข้อมูลของรูป**  → ด่านอยู่อันดับ 1 เพราะรูปด่านคือทั้งหมด
         ของประโยค "อ้อมไม่ได้ ต้องผ่านตรงนี้"
     ★ ถ้าใช้ RANK ของ labeler ด่านทั้ง 11 จะไม่มีวันโผล่เลยสักฉาก — เพราะมันต้องรอ
       vbw ≤ 330 แต่กล้องของฉากต่ำสุดคือ 560 แล้วอัตราส่วนจอดันเป็น ~766 (ลองแล้ว 2026-09-02)

     วัดความหนาแน่นจริงที่กล้องฉาก (vbw 766) ได้ 56 จุดในกรอบ: town 23 · pass 10 ·
     city 10 · valley 4 · camp 3 · capital 2 · mountain 2 · ford 2
     → **town คือตัวที่ทำให้รก และเป็นตัวที่มีข้อมูลน้อยที่สุด** จึงเป็นอันดับท้ายสุด */
  const SYM_RANK = {
    capital:1, pass:1, ford:1, valley_mouth:1, camp:1, farm:1, depot:1, fort:1, mountain:1,
    city:2, town:3
  };
  function symMaxRank(vbw){
    if (vbw > 1300) return 1;      /* ถอยดูทั้งแผ่นดิน — เหลือนครหลวงกับสัญลักษณ์ภูมิศาสตร์ */
    if (vbw > 700)  return 2;      /* กล้องของฉากปกติ (~766) — เพิ่มเมือง ยังไม่ปล่อยหมู่บ้าน */
    return 3;                      /* ซูมเข้าจริง — ปล่อยครบ */
  }

  /* ★★★ ปีของฉากที่กำลังอ่าน — **สัญลักษณ์ของสิ่งที่ยังไม่ถูกสร้าง ห้ามโผล่**
     เจ้าของทัก 2026-09-05: *"พวกค่าย โซ่ป้อม ที่นา มันถูกสร้างมาทีหลังนี่"* — ถูก
     ค่ายนาอู่จ้างหยวนตั้งปี 234 แต่เดิมวาดตั้งแต่ฉากปี 221 = **โกหกอยู่ 13 ปี**
     แนวรั้วกัวหวยตั้งปี 229 · โซ่ป้อมเจียถิงปี 232 · ค่ายหน้าเฉินชางปี 224
     ⚠ ทั้งเล่มสร้างขึ้นบนกติกา "ห้ามแสดงสิ่งที่ยังไม่มี" — ชั้นสัญลักษณ์เป็นชั้นเดียว
       ที่ยังไม่เคารพกติกานั้น จนถึงวันนี้                                              */
  let curYear = null;
  function setYear(y){
    if (y === curYear) return curYear;
    curYear = y;
    scaleCache = null;        /* บังคับให้คิดใหม่ ไม่งั้นแคชจะกันการเปลี่ยนไว้ */
    scalePins();
    applyWorksYear();
    return curYear;
  }
  /* ของที่ยังไม่ถูกสร้าง ณ ปีนี้ (null = ยังไม่รู้ปี → แสดงไปก่อน ของเก่าไม่พัง) */
  const notYet = y => (y != null && curYear != null && curYear < y);

  /* จุดไหนที่ labeler เลือกจะเขียนชื่อให้ — จุดกลมยังผูกกับชุดนี้ ส่วนสัญลักษณ์ไม่ผูก */
  let labelPins = new Set();
  /* ★ กล่องจริงของหมุดที่วาดอยู่ตอนนี้ (หน่วยแผนที่) — labeler ยืมไปใช้กันป้ายทับรูป
     เขียนตอน scalePins เพราะที่นั่นเป็นที่เดียวที่รู้ทั้งขนาดและ LOD */
  const symBox = {};

  /* ★★ ขนาดสัญลักษณ์ — **ไม่ใช่ "คงที่บนจอ"** (เจ้าของทัก 2026-09-02:
     *"ตอนซูมออกไอคอนใหญ่กำลังดี แต่ซูมเข้ามันโคตรเล็ก"*)

     ของเดิมคูณ `mu` ตรง ๆ = ขนาดคงที่บนจอเป๊ะ ซึ่งถูกสำหรับ *เส้น* กับ *ป้าย*
     แต่ผิดสำหรับ *สัญลักษณ์* — พอซูมเข้า ทุกอย่างบนแผ่นโตขึ้นหมด (เมือง แม่น้ำ ภูเขา)
     แต่ไอคอนไม่โต มันเลยดู**หดลงเมื่อเทียบกับสิ่งรอบตัว** ทั้งที่พิกเซลเท่าเดิม

     → ใช้กฎยกกำลัง: ขนาดบนจอ = px × (VB_REF / vb.w)^(1−α)
       α = 1 คือคงที่บนจอ (ของเดิม) · α = 0 คือโตตามแผนที่เต็มที่

     ★★★ **ค่าชุดนี้ล็อกแล้ว 2026-09-02 — เจ้าของสั่งว่า "fix gain ไปเลย จะได้ไม่ต้อง
     แก้ขนาดไปขนาดมา"** · ห้ามขยับ `px` หรือ α ทีละนิดเพื่อความสวยงามอีก
     ถ้าจะเปลี่ยนต้องเปลี่ยนเพราะมีเหตุผลใหม่ และต้องบันทึกว่าเหตุผลนั้นคืออะไร

     รอบก่อนตั้งเล็กเกินไปเพราะกลัวรก — **กลัวผิดที่** ความรกจริง ๆ มาจาก `town`
     ซึ่งมี 38 จุดและมีข้อมูลน้อยที่สุด ไม่ได้มาจากขนาดของรูป · พอ LOD ซ่อน town
     ตอนถอยออกแล้ว ที่ว่างเหลือเยอะกว่าที่คิดมาก (เจ้าของทัก: *"มันใช้ไอคอนใหญ่กว่านี้
     ได้หมดเลยนะ ที่ใช้เล็กแบบนี้เพราะกังวลเรื่องอะไรหรือเปล่า"*)

     ⚠ **หนีบขาต่ำที่ 1** — ตอนถอยดูทั้งแผ่นขนาดกำลังดีแล้ว ห้ามเล็กลงกว่านั้น
     ⚠ **ขาบน 1.6** — ฐานใหญ่แล้ว ปล่อยให้โตอีกมากจะกลบแผนที่ · ช่วงจริงจึงแคบ
       และคาดเดาได้: ด่าน 32px ตอนถอย → 37px กล้องฉาก → 51px ตอนซูมสุด */
  const VB_REF = 900, SIZE_ALPHA = 0.7, ROLE_SCALE = 0.72;
  function symZoomFactor(vbw){
    return Math.min(1.6, Math.max(1, Math.pow(VB_REF / vbw, 1 - SIZE_ALPHA)));
  }

  /* แยกออกมาเป็นฟังก์ชันของตัวเองเพราะ **ล้อหมุนต้องเรียกมันด้วย** —
     `wheel` เปลี่ยน viewBox ทันทีแต่ relayout ถูกหน่วงไว้ 160ms
     ถ้าไม่เรียกตรงนี้ ไอคอนจะค้างขนาดเดิมระหว่างหมุนล้อ แล้ว "กระตุก" ทีเดียวตอนหยุด */
  function scalePins(mu){
    if (mu == null){
      const sw = host.clientWidth || 1000;
      mu = 1 / Math.min(sw / vb.w, (host.clientHeight || 1) / vb.h);
    }
    /* คีย์แคชด้วย vb.w ไม่ใช่ mu — ขนาดไอคอนขึ้นกับ vb.w ผ่าน symZoomFactor ด้วย */
    if (scaleCache !== null && Math.abs(vb.w / scaleCache - 1) < 0.01) return;
    scaleCache = vb.w;
    const cap = symMaxRank(vb.w), f = symZoomFactor(vb.w);

    /* ★★★ ตรวจชนแล้วยุบ — กติกาเดียวกับชั้นที่ 3 ของ `labeler` (2026-09-05)
       เจ้าของทัก: *"ตอนซูมออกแบบแผนที่ใหญ่ทั้งหมดมันใหญ่จนเกยกัน"*
       **ทางแก้ที่ผิดคือย่อรูปลง** — รูปเล็กจนอ่านไม่ออกก็ไม่มีความหมายที่จะวาด
       (เจ้าของพูดเองว่า *"ใช้สัญลักษณ์เล็กแทนเมืองเล็ก ๆ มันก็ไม่มีความหมาย
       เพราะมันเล็กจิ๋ว"*) → **คงขนาดไว้ แล้วให้ตัวที่แพ้ยุบเป็นจุดกลมแทน**
       ผลคือความหนาแน่นถูกคุมด้วย *จำนวน* ไม่ใช่ด้วย *ขนาด* — ซึ่งเป็นวิธีที่แผนที่
       ทำกันมาตลอด และเป็นเหตุผลเดียวกับที่ labeler ซ่อนป้ายแทนที่จะย่อฟอนต์

       ลำดับผู้ชนะ: ฉากนี้พูดถึง > SYM_RANK > ชนิดที่นิ่ง (เรียงชื่อ) — ต้องนิ่ง
       ไม่งั้นพอ relayout ทีไรตัวที่โผล่จะสลับกันไปมาแล้วภาพกะพริบ                */
    const cand = [];
    layers.pins.querySelectorAll('.pin').forEach(g => {
      const id = g.dataset.id, ty = TK.places[id].type;
      if (!g.querySelector('.pin-sym') || (SYM_RANK[ty] || 3) > cap) return;
      if (notYet(TK.places[id].year)) return;      /* ยังไม่ถูกสร้างในปีนี้ */
      cand.push({ id, ty, g,
                  pri: (forceLabels && forceLabels.has && forceLabels.has(id) ? 0 : 1),
                  rank: SYM_RANK[ty] || 3 });
    });
    cand.sort((a,b) => a.pri - b.pri || a.rank - b.rank || (a.id < b.id ? -1 : 1));
    const taken = [], keep = new Set();
    const PAD = 0.86;                    /* ยอมให้เฉียดกันได้นิดหน่อย ไม่งั้นซ่อนเยอะเกิน */
    for (const c of cand){
      const p = TK.places[c.id];
      const s = GLYPH[c.ty].px * f * mu * PAD;
      const box = { x:p.x - s/2, y:p.y - s, w:s, h:s };
      if (taken.some(t => box.x < t.x+t.w && t.x < box.x+box.w &&
                          box.y < t.y+t.h && t.y < box.y+box.h)) continue;
      taken.push(box); keep.add(c.id);
    }

    layers.pins.querySelectorAll('.pin').forEach(g => {
      const id = g.dataset.id, ty = TK.places[id].type;
      const dot = g.querySelector('.pin-dot'), sym = g.querySelector('.pin-sym');
      const show = keep.has(id);
      if (dot){
        dot.setAttribute('r', (ty==='capital' ? 5 : 3.4) * mu);
        dot.style.strokeWidth = (1.3 * mu) + 'px';
      }
      if (sym){
        sym.dataset.lod = show ? '1' : '0';
        if (!show) delete symBox[id];
        if (show){
          const p = TK.places[id], k = GLYPH[ty].px * f * mu / 24;
          symBox[id] = { x:p.x - GLYPH[ty].px*f*mu/2, y:p.y - GLYPH[ty].px*f*mu,
                         w:GLYPH[ty].px*f*mu, h:GLYPH[ty].px*f*mu };
          sym.setAttribute('transform',
            `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) scale(${k.toFixed(4)}) translate(-12,-22)`);
        }
      }
      const rg = g.querySelector('.pin-role');
      if (rg){
        const p = TK.places[id], rp = GLYPH[p.role].px * ROLE_SCALE;
        const kr = rp * f * mu / 24;
        /* ยืนขวารูปหลัก บนฐานเดียวกัน — ระยะห่างคิดจากครึ่งความกว้างของทั้งสองรูป */
        const dx = (GLYPH[ty].px * 0.46 + rp * 0.44) * f * mu;
        /* ★ ป้ายเสริมมีปีของตัวเอง — เฉินชางเป็นยุ้งของฮั่นตั้งแต่ 233 เท่านั้น
           ก่อนหน้านั้นมันเป็นป้อมของวุ่ย ป้ายยุ้งจึงห้ามโผล่ */
        rg.style.display = (show && !notYet(p.roleYear)) ? '' : 'none';
        if (show) rg.setAttribute('transform',
          `translate(${(p.x + dx).toFixed(2)},${p.y.toFixed(2)}) scale(${kr.toFixed(4)}) translate(-12,-22)`);
      }
    });
    applyPinVisibility();
  }

  /* ★ ตัวเดียวที่ตัดสินว่าหมุดไหนโผล่ — เรียกจากทั้ง relayout (ตอนสเกลเปลี่ยน)
     และจากตอน labeler คำนวณป้ายเสร็จ · แยกออกมาเพราะสองเหตุการณ์นี้เกิดคนละจังหวะ
     และถ้าต่างคนต่างเขียน `display` จะทับกันเองจนหมุดกะพริบ                        */
  function applyPinVisibility(){
    for (const id in pinEl){
      const g   = pinEl[id];
      const sym = g.querySelector('.pin-sym');
      const dot = g.querySelector('.pin-dot');
      const symOn = !!sym && sym.dataset.lod === '1';
      g.style.display = (symOn || labelPins.has(id)) ? '' : 'none';
      if (sym) sym.style.display = symOn ? '' : 'none';
      if (dot) dot.style.display = symOn ? 'none' : '';
    }
  }

  /* ── ★★ โซ่ป้อม / แนวรั้ว (DECISIONS §3 · เจ้าของอนุญาต 2026-09-05) ──────────
     ★ **ไม่มีพิกัดของตัวเอง** — สุ่มจุดจาก `d` ของ edge ที่มันเกาะอยู่ แล้วตัดเอา
       เฉพาะช่วง from–to · ถ้าถนนถูกลากใหม่วันไหน สิ่งก่อสร้างขยับตามเอง
     ⚠ ป้อมเป็น **หน่วยแผนที่** เหมือนกำแพง — มันคือสิ่งที่ตั้งอยู่บนแผ่นดิน
       ไม่ใช่สัญลักษณ์บนจอ                                                        */
  /* ⚠ แผ่นบีบระยะ — edge 180 ลี้ (tianshui–jieting) ยาวแค่ ~58 หน่วยบนแผ่น
     ระยะป้อมจึงต้องคิดจาก *หน่วยแผ่น* ไม่ใช่จากลี้ ไม่งั้นได้ป้อมสองหลังทั้งโซ่ */
  const FORT_STEP = 11, FORT_SIZE = 4.2, FENCE_STEP = 7, FENCE_TOOTH = 3.6;
  function buildWorks(){
    const list = TK.works || [];
    if (!list.length) return;
    const byPair = {};
    (TK.edges || []).forEach(e => { byPair[e.a+' '+e.b] = e; byPair[e.b+' '+e.a] = e; });

    for (const w of list){
      const e = byPair[w.on[0]+' '+w.on[1]];
      if (!e || !e.d) continue;                    /* ข้อ 14 ของตัวตรวจฟ้องให้แล้ว */
      const probe = mk('path',{d:e.d});
      layers.works.append(probe);                  /* ต้องอยู่ใน DOM ถึงจะวัดความยาวได้ */
      const total = probe.getTotalLength();
      /* `d` ลากจาก a ไป b เสมอ (กติกา §4) — ถ้า `on` กลับด้าน ต้องกลับเศษส่วนด้วย */
      const flip = (e.a !== w.on[0]);
      const t0 = flip ? 1 - w.to : w.from, t1 = flip ? 1 - w.from : w.to;
      const s0 = total * t0, s1 = total * t1;
      const g = mk('g',{class:'works w-'+w.kind+' s-'+(w.side||'none')});
      g.dataset.id = w.id;

      /* เส้นแกน — เก็บจุดตามช่วงที่กิน */
      let d = '', first = true;
      for (let s = s0; s <= s1; s += 4){
        const p = probe.getPointAtLength(s);
        d += (first ? 'M' : ' L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
        first = false;
      }
      g.append(mk('path',{class:'works-spine', d}));

      if (w.kind === 'fortchain'){
        /* ป้อมเป็นสี่เหลี่ยมเล็ก ๆ เรียงตามถนน — "แต่ละป้อมมองเห็นป้อมถัดไป" (c7-01) */
        for (let s = s0; s <= s1 + 0.01; s += FORT_STEP){
          const p = probe.getPointAtLength(Math.min(s, s1));
          g.append(mk('rect',{class:'works-fort', x:(p.x-FORT_SIZE/2).toFixed(1),
            y:(p.y-FORT_SIZE/2).toFixed(1), width:FORT_SIZE, height:FORT_SIZE}));
        }
      } else {
        /* รั้ว — หลักไม้ตั้งฉากกับแนว สั้นและถี่กว่าฟันเสมาของกำแพง */
        let teeth = '';
        for (let s = s0; s <= s1; s += FENCE_STEP){
          const p = probe.getPointAtLength(s);
          const q = probe.getPointAtLength(Math.min(s + 2, total));
          const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx,dy) || 1;
          const nx = -dy/len * FENCE_TOOTH, ny = dx/len * FENCE_TOOTH;
          teeth += `M${(p.x-nx/2).toFixed(1)},${(p.y-ny/2).toFixed(1)}` +
                   `l${nx.toFixed(1)},${ny.toFixed(1)}`;
        }
        if (teeth) g.append(mk('path',{class:'works-stake', d:teeth}));
      }
      const t = mk('title'); t.textContent = w.label + (w.note ? ' — ' + w.note : '');
      g.append(t);
      probe.remove();
      layers.works.append(g);
    }
  }

  /* works โผล่เฉพาะปีที่มันมีอยู่จริง — เรียกจาก setYear */
  function applyWorksYear(){
    layers.works.querySelectorAll('.works').forEach(g => {
      const w = (TK.works || []).find(x => x.id === g.dataset.id);
      g.style.display = (w && notYet(w.year)) ? 'none' : '';
    });
  }

  function buildPins(){
    for (const id in TK.places){
      const p = TK.places[id];
      const g = mk('g',{class:'pin t-'+p.type});
      g.dataset.id = id;
      /* จุดกลม — ยังอยู่ ไม่ได้ถอด: มันคือระดับ LOD ต่ำสุดตอนซูมออก (สเปก §3
         "9px ทั้งคู่อ่านไม่ออก → ขนาดนั้นต้องตัดเหลือจุดกลม ห้ามย่อสัญลักษณ์ลงไป") */
      g.append(mk('circle',{cx:p.x, cy:p.y, r: p.type==='capital' ? 6 : 4, class:'pin-dot'}));
      const spec = GLYPH[p.type];
      if (spec){
        const sym = mk('g',{class:'pin-sym'});
        (spec.fill   || []).forEach(d => sym.append(mk('path',{d, 'fill-rule':'evenodd'})));
        (spec.stroke || []).forEach(o => {
          const a = {d:o.d, class:'gs', 'stroke-width':o.w};
          if (o.dash) a['stroke-dasharray'] = o.dash;
          sym.append(mk('path', a));
        });
        g.append(sym);
      }
      /* ★ `role` — ป้ายเสริมข้าง ๆ รูปหลัก ไม่ใช่ตัวแทนมัน
         ฮั่นจงเป็น *เมือง* และ *คลัง* พร้อมกัน · ถ้าเอา depot ไปทับ type จะเสียรูปเมือง
         และเสียอันดับป้ายไปด้วย — จึงวาดสองรูป รูปเสริมเล็กกว่าและยืนบนฐานเดียวกัน */
      if (p.role && GLYPH[p.role]){
        const rg = mk('g',{class:'pin-role'});
        (GLYPH[p.role].fill   || []).forEach(d => rg.append(mk('path',{d, 'fill-rule':'evenodd'})));
        (GLYPH[p.role].stroke || []).forEach(o => {
          const a = {d:o.d, class:'gs', 'stroke-width':o.w};
          if (o.dash) a['stroke-dasharray'] = o.dash;
          rg.append(mk('path', a));
        });
        g.append(rg);
      }
      const t = mk('title'); t.textContent = p.map && p.map !== p.label ? `${p.label} · บนแผ่น: ${p.map}` : p.label;
      g.append(t);
      layers.pins.append(g);
      pinEl[id] = g;
    }
  }

  /* ── เจ้าของพื้นที่ ──
     ★★ 2026-08-28 เจ้าของทัก (บทที่ 8 c8-09/c8-13): *"ให้เปลี่ยนสีเทียนสุ่ยตอนที่ทัพ
        เดินไปถึงจะดีกว่า"* — ของเดิม setOwners ถูกเรียกที่บรรทัดแรกของ render()
        แผ่นดินจึงพลิกสีที่ t=0 แล้วลูกศรค่อยใช้เวลาอีก 1–3 วินาทีเดินไปหาเมืองที่
        **เปลี่ยนมือไปแล้ว** = ผลมาก่อนเหตุทุกฉากที่มีทั้ง delta และการเดินทัพ
        (โรคเดียวกับ "หมุดสีเล่าล่วงหน้า" ที่ §7 ห้ามไว้ แค่คนละแกน — อันนั้นแกนฉาก
         อันนี้แกนวินาที · ตัวตรวจทุกตัวเป็น static จึงไม่มีทางเห็น)
     → เขตที่อยู่ใน `hold` ถูกพักไว้ ไม่ทาสีจนกว่าลูกศรของฉากนั้นจะเดินถึงปลายทาง
        `setMarkers` เป็นคนปล่อย (flushOwners) เมื่อลูกศรเส้นสุดท้าย settle
        ไม่มีลูกศรให้รอ / โหมด scrub / ตอนถ่ายภาพ (animate=false) = ทาทันทีเหมือนเดิม */
  let ownerHold = null;

  function paintOwner(id, side){
    const el = regionEl[id]; if (!el) return;
    const c = TK.factions[side].color;
    if (el.getAttribute('fill') === c) return;
    el.setAttribute('fill', c);
    el.setAttribute('stroke', c);
    el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
  }

  function setOwners(owners, hold){
    ownerHold = null;
    const wait = {};
    for (const id in owners){
      if (hold && hold.has(id)){ wait[id] = owners[id]; continue; }
      paintOwner(id, owners[id]);
    }
    for (const _ in wait){ ownerHold = wait; break; }
  }

  function flushOwners(){
    if (!ownerHold) return;
    const w = ownerHold; ownerHold = null;
    for (const id in w) paintOwner(id, w[id]);
  }

  /* ── กล้อง: tween viewBox ──
     applyVB ทำแค่เขียน attribute เดียว ห้ามเรียก relayout ที่นี่
     เพราะระหว่าง tween มันจะยิงวินาทีละ 60 ครั้ง × (122 หมุด + 26 ป้าย) = เครื่องตาย */
  function applyVB(){
    svg.setAttribute('viewBox',
      `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
  }

  /* ระหว่างกล้องเคลื่อน ซ่อนป้ายไว้ก่อน แล้วค่อยจัดใหม่ตอนนิ่ง
     — เร็วกว่ามาก และดูดีกว่าปล่อยให้ป้ายวิ่งสะบัดตามกล้อง */
  let settleTimer = null;
  function settleLabels(delay){
    clearTimeout(settleTimer);
    layers.labels.style.opacity = 0;
    layers.pins.style.opacity   = 0;
    layers.focus.style.opacity  = 0;   // วงเน้นของฉากเก่าห้ามค้างระหว่างกล้องบิน (§17)
    settleTimer = setTimeout(() => {
      relayout();
      updateWhere();
      layers.labels.style.opacity = 1;
      layers.pins.style.opacity   = 1;
      layers.focus.style.opacity  = 1;
    }, delay);
  }

  /* ── "ตอนนี้กำลังดูอะไรอยู่" ──
     กล้องซูมเข้าออกโดยไม่บอกว่าดูอะไร ทำให้คนที่ไม่รู้จักภูมิศาสตร์แถบนั้นหลง
     หาเองได้จากเขตที่กล้องเล็งไป + สถานที่ที่ฉากนี้ปักหมุด ไม่ต้องเพิ่มข้อมูล 71 ฉาก */
  let focusBeat = null;
  const setFocus = b => { focusBeat = b; };

  function regionAt(x, y){
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    for (const id in regionEl)
      if (regionEl[id].isPointInFill(pt)) return id;
    return null;
  }

  /* ปลายทางของเส้นทางเดินทัพ — คือที่ที่ฉากกำลังจะไป ไม่ใช่ที่ที่ออกเดิน */
  function routeEnd(name, reverse){
    const rt = TK.routes[name]; if (!rt) return null;
    const n = rt.d.match(/-?[\d.]+/g).map(Number);
    return reverse ? [n[0], n[1]] : [n[n.length-2], n[n.length-1]];
  }

  /* ⚠ เลือกเขตจาก "สิ่งที่ฉากพูดถึง" ไม่ใช่จากจุดกึ่งกลางกล้อง
     กล้องถูกจัดให้เห็นการเคลื่อนไหวทั้งหมด จุดกึ่งกลางของมันจึงตกในเขตข้างเคียงได้บ่อย
     วัดแล้วมี 13 ฉากที่กรอบไปล้อมเขตที่ไม่มีหมุดหรือลูกศรของฉากอยู่เลยสักอัน
     เช่นฉากถอดโจฮองที่พูดถึงลกเอี๋ยง แต่กรอบไปล้อมกุนจิ๋ว */
  /* ★★ คืน **รายชื่อเขต** ไม่ใช่เขตเดียว (เจ้าของทัก 2026-08-25)
     ของเดิมโหวตหาเขตที่ได้คะแนนสูงสุดเขตเดียว แล้วถ้าเสมอก็ไม่ตีเลย ผลคือ
       · ฉากที่พูดถึงสี่เมืองในสี่เขต ตีได้เขตเดียว = "ครอบไม่หมดตามที่พูดถึง"
       · ฉากในท้องพระโรงที่หมุดสองอันอยู่ใน Yizhou ตี Yizhou ทั้งมณฑล = "ครอบทั้งหมด
         ไม่มั่นใจว่าใช้ทำไม" — กรอบวิ่งออกไปในที่ว่างจนไม่ได้บอกอะไร

     ใหม่: เก็บทุกเขตที่หมุด/ปลายลูกศรตกลงไป แล้ว **คัดออกเฉพาะเขตที่โผล่พ้นกล้องไปมาก**
     เกณฑ์: กรอบสี่เหลี่ยมของเขตต้องอยู่ในกล้องอย่างน้อย 55% ถึงจะตี
     → ฉากสี่เมืองได้สี่กรอบ · ฉาก Hanzhong ได้กรอบเดียวพอดี · ฉากท้องพระโรงไม่ได้กรอบเลย
       ซึ่งถูก เพราะหมุดบอกที่อยู่แล้ว การตีทั้งมณฑลไม่ได้เพิ่มอะไรนอกจากสิ่งรบกวน */
  function focusRegions(b){
    if (!b || !b.camera) return [];
    const hit = new Set();
    const put = p => { if (!p) return; const id = regionAt(p[0], p[1]); if (id) hit.add(id); };
    for (const m of (b.markers || [])){
      /* ★ หมุดอ้างอิง (focus:false) — ชี้ให้เห็นแต่ไม่ดึงเขตของมันเข้าวงเน้น (§17)
         เกิดจาก c1-03: หมุด "ฉางอาน — ปลายทาง" ลากกวานจงทั้งเขตเข้าวงแอ่งหลงโย่ว */
      if (m.focus === false) continue;
      if (m.place && TK.places[m.place]) put([TK.places[m.place].x, TK.places[m.place].y]);
      if (m.route) put(routeEnd(m.route, m.reverse));
    }
    if (!hit.size) return [];
    const cx = b.camera[0], cy = b.camera[1], cw = b.camera[2];
    const ch = b.camera[3] || cw * fitAR();
    const out = [];
    for (const id of hit){
      const el = regionEl[id]; if (!el) continue;
      let bb; try { bb = el.getBBox(); } catch (e) { continue; }
      if (!bb.width || !bb.height) continue;
      /* ต้องมีส่วนที่มองเห็นจริงในกล้องบ้าง ไม่งั้นตีกรอบให้ของที่อยู่นอกจอ */
      const ox = Math.max(0, Math.min(bb.x + bb.width,  cx + cw) - Math.max(bb.x, cx));
      const oy = Math.max(0, Math.min(bb.y + bb.height, cy + ch) - Math.max(bb.y, cy));
      if (ox * oy <= 0) continue;
      /* ★ เกณฑ์หลัก: เขตที่ใหญ่เกินสองเท่าของกล้อง = กรอบวิ่งออกไปในที่ว่าง ไม่ตี */
      if ((bb.width * bb.height) / (cw * ch) <= 2) out.push(id);
    }
    return out;
  }

  function focusRegion_unused(b){
    if (!b) return null;
    /* ถ่วงน้ำหนัก: จุดปะทะบอกที่ตั้งของฉากหนักแน่นกว่าหมุด และหมุดหนักแน่นกว่าปลายลูกศร
       ถ้าให้เท่ากันหมด ฉากที่มีหมุดหนึ่งกับลูกศรหนึ่งจะเสมอกันแล้วไม่ได้กรอบเลย
       ทั้งที่หมุดคือสิ่งที่ฉากชี้ให้ดูอยู่แล้ว */
    const votes = {};
    const add = (p, w) => { if (!p) return; const id = regionAt(p[0], p[1]);
                            if (id) votes[id] = (votes[id] || 0) + w; };
    for (const m of (b.markers || [])){
      if (m.place && TK.places[m.place])
        add([TK.places[m.place].x, TK.places[m.place].y], m.type === 'clash' ? 3 : 2);
      if (m.route) add(routeEnd(m.route, m.reverse), 1);
    }
    const rank = Object.entries(votes).sort((a, b2) => b2[1] - a[1]);
    if (!rank.length) return null;
    /* คะแนนเท่ากันหลายเขต = ฉากคร่อมหลายเขต ตีกรอบไปก็ชี้ผิด ไม่ตีดีกว่า */
    if (rank.length > 1 && rank[0][1] === rank[1][1]) return null;
    return rank[0][0];
  }

  function updateWhere(){
    const box = document.getElementById('where');
    if (!box) return;

    /* ⚠ ต้องตัดสินจาก "กรอบที่ฉากตั้งใจ" ไม่ใช่ viewBox จริงบนจอ
       เพราะ fitBox ขยายกรอบให้พอดีสัดส่วนจอ จอกว้างมาก ๆ (เช่น 2454×784)
       จะทำให้กรอบที่ตั้งใจซูม 340 บานเป็น 1535 แล้วถูกตัดสินว่า "ทั้งแผ่นดิน" ผิด ๆ */
    const cam  = focusBeat && focusBeat.camera;
    const wide = !cam || cam[2] > W * 0.72;
    const rids = wide ? [] : focusRegions(focusBeat);

    /* สถานที่ที่ฉากนี้พูดถึง เอามาจาก marker ตรง ๆ */
    const spots = [...new Set((focusBeat && focusBeat.markers || [])
      .filter(m => m.place && TK.places[m.place])
      .map(m => TK.places[m.place].label))].slice(0, 3);

    const parts = [];
    if (wide) parts.push('ทั้งแผ่นดิน');
    else if (rids.length) parts.push(rids.map(i => TK.regions[i].label).join(' · '));
    if (spots.length) parts.push(spots.join(' · '));

    box.innerHTML = parts.length
      ? `<b>${parts[0]}</b>${parts[1] ? '<span>' + parts[1] + '</span>' : ''}` : '';
    box.classList.toggle('on', parts.length > 0);

    /* ── วงเน้นเขตที่กำลังดู (DECISIONS §17 · เจ้าของเกลารอบสอง 2026-08-25) ──
       ยึด "ขอบเขตจริง" แต่วาดเฉพาะเส้นที่มีความหมาย:
         เขตต่อเขต และแนวที่เกาะเส้นพิมพ์ (t:"line")  → เส้นประทอง + casing เต็ม
         ชายฝั่ง (t:"coast")                          → เส้นประบาง จาง ไม่มี casing
         ขอบแผ่น (t:"edge") กับสุดเขตการโต (t:"open") → **ไม่วาด** — สองชนิดนี้คือ
           "เหลี่ยมประหลาดตามขอบแผนที่" ที่เจ้าของทัก มันไม่ใช่พรมแดนของอะไรจริง ๆ
       + เติมทองจาง .07 ทั้งกลุ่มให้พื้นที่มีมิติ — รูปเขตชนกันพอดี (§16) แสงจึงไร้ตะเข็บ */
    layers.focus.replaceChildren();
    if (rids.length){
      const inS = new Set(rids);
      const arcs = (TK.regionArcs || []).filter(a =>
        inS.has(a.a) !== (a.b ? inS.has(a.b) : false));
      for (const _id of rids){
        const r = TK.regions[_id];
        const p = mk('path',{d:r.fill || r.d, class:'region-glow'});
        p.style.fill = 'var(--gold)'; p.style.fillOpacity = '.07';
        layers.focus.append(p);
      }
      if (arcs.length){
        for (const a of arcs){
          if (a.t === 'edge' || a.t === 'open' || a.t === 'coast') continue;
          layers.focus.append(mk('path',{d:a.d, class:'region-focus-under'}));
        }
        for (const a of arcs){
          if (a.t === 'edge' || a.t === 'open') continue;
          layers.focus.append(mk('path',{d:a.d,
            class: a.t === 'coast' ? 'region-focus region-focus-coast' : 'region-focus'}));
        }
      } else {
        /* geo_fill รุ่นเก่าไม่มี arc — ถอยไปตีขอบรูปเต็มทีละเขต (ยังต้องใช้ fill
           ไม่ใช่ d — ตั้งแต่มี geo_fill สองรูปนี้ไม่ตรงกันแล้ว กรอบจะลอยผิดที่) */
        for (const _id of rids){
          const r = TK.regions[_id];
          layers.focus.append(mk('path',{d:r.fill || r.d, class:'region-focus-under'}));
          layers.focus.append(mk('path',{d:r.fill || r.d, class:'region-focus'}));
        }
      }
      styleFocusPaths();
    }
  }

  /* จัดกรอบที่ขอ (x,y,w,h) ให้พอดีกล่องบนจอ โดยยังเห็นครบทั้งกรอบ */
  function fitBox(x0, y0, w0, h0){
    const ar = fitAR();
    h0 = h0 || w0 * ar;
    const cx = x0 + w0/2, cy = y0 + h0/2;
    let w, h;
    if (h0 / w0 > ar) { h = h0; w = h0 / ar; }   // กรอบสูงกว่าจอ → ขยายด้านกว้าง
    else              { w = w0; h = w0 * ar; }   // กรอบเตี้ยกว่าจอ → ขยายด้านสูง
    if (w > W){ w = W; h = w * ar; }
    if (h > H){ h = H; w = h / ar; }
    return { w, h,
      x: Math.max(0, Math.min(W - w, cx - w/2)),
      y: Math.max(0, Math.min(H - h, cy - h/2)) };
  }

  function flyTo(cam, ms){
    if (camCancel) camCancel();
    if (!cam) return;
    const dur = ms === undefined ? 1100 : ms;
    const to = fitBox(cam[0], cam[1], cam[2], cam[3]);
    settleLabels(dur + 60);            // จัดป้ายใหม่ทีเดียวตอนกล้องหยุด
    camCancel = TK.engine.tween({...vb}, to, dur,
      cur => { vb = cur; applyVB(); });
  }

  const resetView = ms => flyTo([0,0,W,H], ms);

  /* map-unit ต่อ 1 screen px — ของที่ต้อง "ขนาดคงที่บนจอ" ทุกชิ้นต้องคูณค่านี้
     สเกลจริงของ preserveAspectRatio="meet" คือด้านที่คับกว่า อย่าเดาจากความกว้างอย่างเดียว */
  /* ความหนาเส้นทางเป็นพิกเซลจอ — ปุ่มเดียวสำหรับทั้งเล่ม ตั้งไว้ตรงกับโปรเจกต์พี่น้อง
     ใช้ทั้งตอนสร้าง (setMarkers) และตอนจัดใหม่ (relayout) จะได้ไม่เกิดมาหนาแล้วผอมวูบ
     CSS .mk-route{stroke-width:4} เป็นค่าสำรองในหน่วยแผนที่ ตรงกันเฉพาะตอนซูมออกสุด */
  const ROUTE_PX = 4;

  /* กรอบเน้นเขต (DECISIONS §17) — พิกเซลจอเช่นเดียวกับ ROUTE_PX
     ลายประ 9/7 จงใจให้ต่างจังหวะจากเส้นประเขตแดนที่พิมพ์มากับแผ่น (ของแผ่นถี่กว่า)
     และมีขอบมืด (casing) ใต้เส้นทอง — ไม่มีสองอย่างนี้ วงจะกลืนกับลายพิมพ์ของแผ่นทันที */
  const FOCUS_PX = 2, FOCUS_CASE_PX = 4.5, FOCUS_DASH = [9, 7];

  /* (สวิตช์ดีไซน์ชั่วคราว FOCUS_STYLE/ARROW_STYLE ถูกถอดแล้ว 2026-08-25 —
     เจ้าของเคาะ: วง = แบบ ก ฉบับเกลา (§17) · ลูกศร = แบบ ข (§3)) */

  function screenMU(){
    const scale = Math.min((host.clientWidth || 1000) / vb.w,
                           (host.clientHeight || 1) / vb.h);
    return 1 / scale;
  }

  /* ลายประของสายเสบียง — คงที่บนจอ 7/6 พิกเซล (ถี่กว่าวงเน้นเขต 9/7 จะได้ไม่สับสนกัน)
     ใช้ทั้งตอนวิ่งจบ (settle) และตอนสเกลเปลี่ยน (relayout) */
  const SUPPLY_DASH = [7, 6];
  /* ร่องรอยเรือ — ประที่ **เงาใต้เส้น** เท่านั้น เส้นสีด้านบนยังทึบ
     เหตุผล: เส้นทึบ = "การเดินทางครั้งเดียว" (ต่างจากสายเสบียงที่ประทั้งเส้น
     เพราะมันคือสายที่ไหลอยู่ตลอด) · ประที่เงาอ่านเป็นน้ำกระเพื่อม ไม่ใช่เส้นขาด */
  const WAKE_DASH = [3, 5];
  function setWakeDash(p, mu){
    if (!p) return;
    p.style.strokeDasharray  = WAKE_DASH.map(v => (v * mu).toFixed(2)).join(' ');
    p.style.strokeDashoffset = 0;
  }
  function setSupplyDash(p, mu){
    p.style.strokeDasharray  = SUPPLY_DASH.map(v => (v * mu).toFixed(2)).join(' ');
    p.style.strokeDashoffset = 0;
  }

  /* ขนาด/ลายประของวงเน้นต้องคงที่บนจอ — เรียกซ้ำได้ทุกครั้งที่สเกลเปลี่ยน (relayout) */
  function styleFocusPaths(){
    const mu = screenMU();
    layers.focus.querySelectorAll('path').forEach(p => {
      const c = p.getAttribute('class') || '';
      if (c.indexOf('region-glow') >= 0) return;        /* แสงพื้น ไม่มี stroke ให้ปรับ */
      const under = c.indexOf('region-focus-under') >= 0;
      const coast = c.indexOf('region-focus-coast') >= 0;
      p.style.strokeWidth = ((under ? FOCUS_CASE_PX : (coast ? 1.4 : FOCUS_PX)) * mu) + 'px';
      p.style.strokeDasharray = `${(FOCUS_DASH[0] * mu).toFixed(1)} ${(FOCUS_DASH[1] * mu).toFixed(1)}`;
    });
  }

  const fmtK = n => n >= 1000 ? (n/1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n);

  /* ── ป้ายธง ──
     ลูกศรบนแผนที่เดิมบอกได้แค่ "ฝ่ายไหน" (สี) กับ "เหล่าไหน" (รูปทรง) ไม่เคยบอกว่า *ใคร*
     คนอ่านเห็นสามเหลี่ยมเขียววิ่งไป แต่ไม่รู้ว่านั่นจูล่งหรือขงเบ้ง และมากับกี่คน
     ป้ายนี้เติมสองอย่างนั้น — ชื่อจาก TK.people (DECISIONS §4 กฎ 5 ห้ามพิมพ์ชื่อตรง ๆ ใน data)

     สามชั้นซ้อน เพราะแต่ละชั้นทำคนละหน้าที่และห้ามเขียนทับกัน:
       .mk-chip    translate ไปยังพิกัดบนแผนที่ (หน่วย map)
       .mk-chip-s  scale(mu) — relayout เป็นเจ้าของชั้นนี้ ทำให้ป้ายเท่าเดิมทุกระดับซูม
       ชั้นใน      เลื่อนซ้ายครึ่งหนึ่งของความกว้าง (หน่วย px) ให้ป้ายอยู่กึ่งกลางจุดยึด */
  /* ── ป้ายทั้งหมดของฉาก และสิ่งกีดขวางที่ป้ายห้ามทับ ──
     ป้ายชื่อ (mk-chip) กับคำบรรยายหมุด (mk-cap) เคยวางที่ระยะตายตัวคนละสูตร
     ไม่มีใครรู้จักใครเลย ผลคือ "Guo Huai stops the rout here" ทับ "Guo Huai 78k"
     และคำบรรยายของหมุดสองอันที่อยู่ห่างกัน 43 หน่วยก็ทับกันเอง
     ตอนนี้ทุกป้ายเข้าคิวไว้ก่อน แล้วค่อยจัดพร้อมกันทีเดียวใน layoutAnnotations() */
  let pendingAnn = [], annBlocks = [], annPaths = [], leaderG = null;

  /* ตัวป้ายมีขนาดเป็นพิกเซลจอ ส่วนจุดยึดเป็นหน่วยแผนที่ — โครงสามชั้นเลยจำเป็น:
       ชั้นนอก  translate ไปจุดที่จัดให้ (หน่วยแผนที่)
       ชั้นกลาง scale(mu) — relayout เป็นเจ้าของ ทำให้ป้ายเท่าเดิมทุกระดับซูม
       ชั้นใน   เลื่อนซ้ายครึ่งความกว้าง (พิกเซล) ให้ข้อความอยู่กึ่งกลางจุดยึด */
  function shell(parent, cls){
    const g  = mk('g',{class:cls});
    const gs = mk('g',{class:'mk-chip-s', transform:`scale(${screenMU().toFixed(3)})`});
    const gi = mk('g');
    gs.append(gi); g.append(gs); parent.append(g);
    return { g, gi };
  }

  function addChip(parent, side, text){
    const { g, gi } = shell(parent, 'mk-chip');
    const t = mk('text',{class:'mk-chip-txt', x:15, y:4});
    t.textContent = text;
    gi.append(t);
    /* ต้องอยู่ใน DOM ก่อนถึงวัดความกว้างจริงได้ — เดาจากจำนวนตัวอักษรแล้วพื้นหลังจะไม่พอดี
       (บทเรียนเดียวกับ labeler.js ที่ใช้ canvas วัด ไม่ใช่นับตัวอักษร) */
    const w = t.getComputedTextLength() + 24;
    gi.insertBefore(mk('circle',{cx:9, cy:0, r:3.6, fill:TK.factions[side].color}), t);
    gi.insertBefore(mk('rect',{x:0, y:-9.5, width:w, height:19, rx:9.5,
                               class:'mk-chip-pill'}), gi.firstChild);
    gi.setAttribute('transform', `translate(${(-w/2).toFixed(1)},0)`);
    return { g, w, h:19 };
  }

  /* คำบรรยายหมุด — ตัวทองมีฮาโล ไม่มีพื้นหลังทึบ (ของเดิม) แต่ย้ายมาอยู่ในโครงเดียวกับ
     ป้ายชื่อ เพื่อให้วัดเป็นพิกเซลได้และเข้าคิวจัดตำแหน่งร่วมกันได้ */
  function addCaption(parent, text){
    const { g, gi } = shell(parent, 'mk-cap');
    const t = mk('text',{class:'mk-label', x:0, y:6});
    t.textContent = text;
    gi.append(t);
    const w = t.getComputedTextLength();
    gi.setAttribute('transform', `translate(${(-w/2).toFixed(1)},0)`);
    return { g, w, h:20 };
  }

  /* เข้าคิว: ป้ายหนึ่งอัน ยึดกับจุด (ax,ay) หน่วยแผนที่
     rank ต่ำได้เลือกที่ก่อน — คำบรรยายของฉากสำคัญกว่าป้ายชื่อกองทัพ */
  function queueAnn(item, ax, ay, rank, gap){
    pendingAnn.push({ ...item, ax, ay, rank, gap: gap === undefined ? 12 : gap });
  }
  /* สิ่งกีดขวาง: หมุด วงปะทะ สัญลักษณ์กองทัพ — รัศมีเป็นพิกเซลจอ */
  const blockAt = (x, y, r) => annBlocks.push({ x, y, r });

  /* ลองแปดตำแหน่งรอบจุดยึด เรียงตามความสวยงาม บนก่อน แล้วล่าง แล้วข้าง */
  const SLOTS = [[0,-1],[0,1],[1,-0.75],[-1,-0.75],[1,0.75],[-1,0.75],[1,0],[-1,0]];

  function layoutAnnotations(){
    if (!pendingAnn.length) return;
    const mu = screenMU();
    const toPx = (mx, my) => [ (mx - vb.x)/mu, (my - vb.y)/mu ];
    const boxes = annBlocks.map(o => {
      const [px, py] = toPx(o.x, o.y);
      return { x:px - o.r, y:py - o.r, w:o.r*2, h:o.r*2 };
    });
    /* ★ เส้นทาง/เสบียงเป็นสิ่งกีดขวาง "ชั้นอ่อน" (รีวิวรอบสอง 2026-08-26 — เจ้าของ:
       "มีเส้นทับคำบรรยาย") — สุ่มจุดตามเส้นทุก ~22px จอเป็นกล่องเล็ก ป้ายจะพยายาม
       หาที่ที่ไม่ทับเส้นก่อน · ฉากแน่นจนไม่มีที่จริง ๆ ค่อยยอมทับ ซึ่งตอนนั้น
       เส้นโยง + การยกป้ายขึ้นชั้นบนสุด (ล่างสุดของฟังก์ชันนี้) ทำให้ยังอ่านออก */
    const lineBoxes = [];
    for (const p of annPaths){
      let L = 0; try { L = p.getTotalLength(); } catch(e){ continue; }
      const r = 6, step = 22 * mu;
      for (let s = 0; s <= L; s += step){
        const q = p.getPointAtLength(s);
        const [qx, qy] = toPx(q.x, q.y);
        lineBoxes.push({ x:qx - r, y:qy - r, w:r*2, h:r*2 });
      }
    }
    const ov = (a,b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const hitsHard = a => boxes.some(b => ov(a,b));
    const hitsLine = a => lineBoxes.some(b => ov(a,b));
    /* ★ ขอบเฟรมเป็นกติกาด้วย — ป้ายที่หนีคนอื่นจนหลุดจอคือป้ายที่หายไปเฉย ๆ
       (selfcheck จับ "เฉาเจิน" หลุดบนใน c4-10 ตอนเปิดใช้วงสอง · LOG §6.2 เคย
       พยากรณ์ไว้แล้วว่าวันหนึ่งต้อง clamp เข้าขอบ — วันนั้นคือวันนี้) */
    const FW = vb.w / mu, FH = vb.h / mu;
    const inFrame = b => b.x >= 2 && b.y >= 2 && b.x + b.w <= FW - 2 && b.y + b.h <= FH - 2;

    /* วงแรกชิดจุดยึด · วงสอง (~สองเท่า) สำหรับฉากแน่น — เส้นโยงพาสายตากลับมาเอง */
    const RINGS = [1, 1.9];

    if (leaderG && leaderG.parentNode) leaderG.remove();
    leaderG = mk('g',{class:'mk-leaders'});

    const placed = [];
    for (const a of pendingAnn.slice().sort((p, q) => p.rank - q.rank)){
      const [ax, ay] = toPx(a.ax, a.ay);
      let cx = ax, cy = ay - a.h - a.gap, box = null;
      /* สองรอบ: รอบแรกห้ามทับทั้งของแข็งทั้งเส้น · รอบสองยอมทับเส้น (ที่หมดจริง ๆ) */
      search:
      for (const strict of [true, false]){
        for (const ring of RINGS){
          for (const [dx, dy] of SLOTS){
            cx = ax + dx * (a.w/2 + a.gap) * ring;
            cy = ay + dy * (a.h + a.gap) * ring;
            box = { x:cx - a.w/2 - 3, y:cy - a.h/2 - 3, w:a.w + 6, h:a.h + 6 };
            if (inFrame(box) && !hitsHard(box) && (!strict || !hitsLine(box))) break search;
            box = null;
          }
        }
        /* สิบหกที่สองวงเต็ม — ไต่ขึ้นไปเรื่อย ๆ จนพ้น ดีกว่าซ่อนป้ายที่ฉากตั้งใจให้อ่าน */
        for (let k = 1; k <= 8; k++){
          cx = ax; cy = ay - (a.h + a.gap) * (1 + k * 0.9);
          box = { x:cx - a.w/2 - 3, y:cy - a.h/2 - 3, w:a.w + 6, h:a.h + 6 };
          if (inFrame(box) && !hitsHard(box) && (!strict || !hitsLine(box))) break search;
          box = null;
        }
      }
      /* ที่สุดท้าย: ยอมทับได้แต่ห้ามหลุดจอ — clamp กลับเข้าขอบ */
      if (!box){
        cx = Math.min(Math.max(cx, a.w/2 + 5), FW - a.w/2 - 5);
        cy = Math.min(Math.max(cy, a.h/2 + 5), FH - a.h/2 - 5);
        box = { x:cx - a.w/2 - 3, y:cy - a.h/2 - 3, w:a.w + 6, h:a.h + 6 };
      }
      boxes.push(box);
      a.g.setAttribute('transform',
        `translate(${(a.ax + (cx - ax) * mu).toFixed(1)},${(a.ay + (cy - ay) * mu).toFixed(1)})`);
      placed.push(a);

      /* ★ เส้นโยง (รีวิวรอบสอง — เจ้าของ: "อีลุงตุงนังไม่รู้อันไหนของใคร") — ป้ายที่ไกล
         จุดยึดเกินระยะวงแรกได้เส้นบางพากลับไปหาเจ้าของ · วัดจากขอบกล่องป้ายจริง
         วงแรกอยู่ห่าง ~13–22px จึงตั้งเส้นแบ่งไว้ 26px: ป้ายชิดไม่มีเส้น ป้ายไกลมีเสมอ
         แขวนอ้างอิงไว้ที่ตัวป้าย (g._leaders) ให้ showChip ของลูกศรเปิดเส้นพร้อมป้าย —
         สร้างใหม่ทุกรอบ layout เพราะ leaderG ถูกรื้อสร้างใหม่ทุกรอบเช่นกัน */
      a.g._leaders = [];
      const nx = Math.max(box.x, Math.min(ax, box.x + box.w));
      const ny = Math.max(box.y, Math.min(ay, box.y + box.h));
      if (Math.hypot(ax - nx, ay - ny) > 26){
        const ex = vb.x + nx * mu, ey = vb.y + ny * mu;
        const hid = a.g.style.opacity === '0';
        for (const [cls, wpx] of [['mk-leader-under', 2.8], ['mk-leader', 1.2]]){
          const ln = mk('line',{x1:a.ax, y1:a.ay, x2:ex, y2:ey, class:cls});
          ln.style.strokeWidth = (wpx * mu) + 'px';
          if (hid) ln.style.opacity = 0;
          leaderG.append(ln);
          a.g._leaders.push(ln);
        }
        /* จองแนวเส้นโยงกันป้ายอื่นมานอนคร่อม — กล่องเล็กสามจุดตามเส้นพอ */
        for (const f of [0.3, 0.6, 0.85]){
          const lx = ax + (nx - ax) * f, ly = ay + (ny - ay) * f;
          boxes.push({ x:lx - 4, y:ly - 4, w:8, h:8 });
        }
      }
    }

    /* ★ "Sent to front" (คำเจ้าของเป๊ะ ๆ) — จัดเสร็จแล้วยกทั้งชั้นขึ้นบนสุดของ DOM:
       เส้นโยงอยู่เหนือเส้นทาง · ป้ายอยู่เหนือเส้นโยง · คำบรรยายฉาก (rank 0) บนสุด
       การ re-append ไม่รบกวนแอนิเมชัน — ตัว element เดิม อ้างอิงเดิม opacity เดิม */
    layers.markers.append(leaderG);
    for (const a of placed.slice().sort((p, q) => q.rank - p.rank))
      layers.markers.append(a.g);
  }
  /* ── หมุด / ลูกศร / การปะทะ ── */
  function clearMarkers(){
    mkTimers.forEach(clearTimeout);  mkTimers = [];
    mkTweens.forEach(cancel => cancel()); mkTweens = [];
    layers.markers.replaceChildren();
    /* ผีของโหมดสองเอกภพตายพร้อมฉาก — สีแผ่นดินไม่ต้องคืนที่นี่
       เพราะ render() ของฉากใหม่เรียก setOwners ของมันเองเสมอ */
    mirrorSnap = null; mirrorG = null;
  }

  function setMarkers(markers, animate){
    clearMarkers();
    forceLabels = new Set();
    quietLabels = new Set();
    pendingAnn = []; annBlocks = []; annPaths = []; leaderG = null;
    /* ★ นับลูกศรที่กำลังจะวิ่งจริง — เขตที่ setOwners พักไว้จะถูกทาเมื่อเส้นสุดท้ายถึงที่หมาย
       (ดูคอมเมนต์ยาวที่ setOwners) · echo ไม่นับ มันไม่ได้กำลังเดิน */
    let walking = 0;
    /* ★★ คลื่นการเดินทัพ — เพิ่ม 2026-09-01 (เจ้าของทัก c10-08 "ดูเหมือนถอยก่อน
       ทัพเสริมมาถึง") · เดิมลูกศรทุกเส้นออกพร้อมกันโดยเหลื่อมกันแค่ 140ms ต่อเส้น
       และความเร็วคิดจาก **ความยาวบนจอ** เส้นสั้นจึงลงจอดก่อนเส้นยาวเสมอ ไม่ว่าจะ
       เรียงในอาร์เรย์อย่างไร → ง่อ 3k (เส้นสั้น) ถึงบ้านก่อนกำลังเสริมวุ่ย 25k
       (เส้นยาว) ทั้งที่เรื่องเป็นทางกลับกัน
       ⚠ หนึ่งเฟรมไม่มีเวลา — แต่ **ลำดับการวาดมี** และในฉากที่เหตุกับผลอยู่ในเฟรม
         เดียวกัน ลำดับคือสิ่งเดียวที่บอกได้ว่าอะไรเกิดก่อน
         wave:0 (ค่าปริยาย) — ออกพร้อมกันเหมือนเดิม ฉากเก่าทุกฉากจึงไม่เปลี่ยนเลย
         wave:1, 2, …       — ไม่ออกจนกว่าคลื่นก่อนหน้าจะถึงที่หมายครบทุกเส้น
       ⚠ ต้องเรียง marker ตามคลื่นในอาร์เรย์ด้วย — ตัวนับเดินหน้าอย่างเดียว */
    let waveNow = 0, waveGate = 0, waveEnd = 0;
    if (!markers){ flushOwners(); return; }

    markers.forEach((m, idx) => {
      /* ── echo — เพิ่ม 2026-08-22 สำหรับ "โหมดทั้งฤดู" ใน ui.js ────────────────
         marker ที่ติดธง echo คือของ *ฉากอื่นในฤดูเดียวกัน* ไม่ใช่ของฉากที่กำลังอ่าน
         มันมีหน้าที่เดียวคือบอกว่า "ตอนนั้นมีอะไรเกิดขึ้นที่อื่นด้วย" จึงต้องเบาลง
         ทุกทาง: ไม่มีป้ายธง ไม่มีคำบรรยาย ไม่ขอ label เมือง ไม่จองที่กันคนอื่น
         และไม่มีวงปะทะ — วงปะทะของฉากอื่นลอยอยู่บนจอเดียวกันอ่านเป็นศึกที่ไม่มีจริง
         62 ฉากจาก 101 อยู่ในฤดูที่มีเพื่อน จึงมีของให้ดูจริง ไม่ใช่ฟีเจอร์เปล่า */
      const echo = !!m.echo;
      if (echo && m.type === 'clash') return;

      if (m.type === 'pin'){
        const p = TK.places[m.place]; if (!p) return;
        if (echo){
          const g = mk('g',{class:'mk-pin mk-echo'});
          g.append(mk('circle',{cx:p.x, cy:p.y, r:5, class:'mk-dot'}));
          layers.markers.append(g);
          return;
        }
        forceLabels.add(m.place);
        /* ★ `side` + `strength` บนหมุด — ยกมาจากโปรเจกต์ 2 (D13 · DECISIONS §7)
           ไม่ใส่ side = หมุดทอง แปลว่า "ฉากนี้ชี้ให้ดูตรงนี้"
           ใส่ side  = หมุดสีของฝ่ายนั้น แปลว่า "ที่นี่เป็นของฝ่ายนี้" และป้ายเปลี่ยนจาก
                       คำบรรยายทอง (mk-cap) เป็นป้ายติดจุดสีแบบเดียวกับป้ายธงลูกศร (mk-chip)
           ⚠ หมุดที่มีสีไม่ได้เปลี่ยนเจ้าของพื้นที่ สีของแผ่นดินมาจาก mapDelta อย่างเดียว

           เหตุผลที่โปรเจกต์นี้ขาดไม่ได้: เรื่องนี้เป็นเรื่องของฝ่ายตั้งรับเกือบทั้งเล่ม
           (Hao Zhao พันคนต่อสามหมื่น · Ma Dai สามพันที่ Mumen · Wang Ping สามหมื่นที่ชะง่อน ·
           โซ่ป้อมบนสันเขาสิบสี่ปี) และ **ลูกศรแปลว่าเดินทัพ ซึ่งคนบนกำแพงไม่ได้ทำ**
           ถ้าหมุดใส่เลขไม่ได้ กองรักษาการณ์จะไร้น้ำหนักทุกฉาก — โปรเจกต์ 2 วัดไว้แล้วว่า
           12 จาก 16 ฉากรบวาดกองทัพไว้ฝ่ายเดียวเพราะเหตุนี้ */
        const col = m.side && TK.factions[m.side] ? TK.factions[m.side].color : null;
        const g = mk('g',{class:'mk-pin'});
        const halo = mk('circle',{cx:p.x, cy:p.y, r:13, class:'mk-halo'});
        const dot  = mk('circle',{cx:p.x, cy:p.y, r:5,  class:'mk-dot'});
        /* ⚠ `.style.fill` ไม่ใช่ `setAttribute('fill')` — style.css มี `.mk-halo{fill:var(--gold)}`
           กับ `.mk-dot{fill:var(--gold)}` อยู่ และ **กฎใน CSS ชนะ presentation attribute เสมอ**
           โปรเจกต์ 2 เขียน D13 ไว้แล้วหมุดยังเป็นทองหมดอยู่หลายเดือน ตรวจเจอด้วยภาพจริงเท่านั้น
           (BUGS_SEEN §B4) · inline style ชนะ CSS class */
        if (col){ halo.style.fill = col; dot.style.fill = col; }
        g.append(halo); g.append(dot);
        layers.markers.append(g);
        blockAt(p.x, p.y, 15);                 // วงฮาโลที่เต้นถึง r19 บนจอ
        if (m.label){
          /* rank 0 — คำบรรยายคือสิ่งที่ฉากตั้งใจให้อ่าน ได้เลือกที่ก่อนป้ายชื่อกองทัพ
             ⚠ หมุดทอง (ไม่มี side) ไม่รับเลข — ทองแปลว่า "ฉากนี้ชี้ตรงนี้" ไม่ใช่ "ใครถืออะไร" */
          const txt = col && m.strength ? m.label + '   ' + fmtK(m.strength) : m.label;
          const lab = col ? addChip(layers.markers, m.side, txt)
                          : addCaption(layers.markers, m.label);
          queueAnn(lab, p.x, p.y, 0, 14);
          quietLabels.add(m.place);            // ข้อความของฉากพูดแทนชื่อเมืองแล้ว
        }
      }

      if (m.type === 'arrow'){
        const rt = TK.routes[m.route]; if (!rt) return;
        const col = TK.factions[m.side].color;
        /* สองธงนี้แยกกันเด็ดขาด อย่าให้อันหนึ่งลากอีกอัน:
             reverse = ทิศทาง — วิ่งย้อนเส้นทาง (ปลายทาง → ต้นทาง)
             retreat = ความหมาย — เป็นการถอยทัพ มีผลแค่หน้าตา
           การถอยไม่ได้แปลว่าต้องย้อนเส้นทางเสมอ เช่น กุยห้วยถอย "ไปยัง" ตันฉอง
           ซึ่งเป็นทิศเดียวกับที่ route วางไว้อยู่แล้ว */
        const back = !!m.reverse;
        const mu0 = screenMU();
        /* ★ ลูกศร "แบบ ข" (เจ้าของเคาะ 2026-08-25 รอบสอง): เส้นสีบนขอบมืด (casing)
           + หัวเพรียวที่โผล่ตอนเดินถึง + จุดแวะที่ node ระหว่างทาง (ต่อจุดเมืองต่อเมือง)
           echo ไม่ได้ทั้งสามอย่าง — ร่องรอยของฉากอื่นต้องเบากว่าฉากที่กำลังอ่านเสมอ */
        /* ★ `supply` — ขบวนเสบียง ไม่ใช่กองทัพ (DECISIONS §15 "โหมดเสบียง" ชั้นแรก)
           ต่างจากลูกศรทัพสามอย่าง: เส้นบางกว่า · ไม่มีสัญลักษณ์กองทัพวิ่งนำ ·
           พอวิ่งถึงแล้วกลายเป็นเส้นประ = สายที่ "ไหลอยู่ตลอด" ไม่ใช่การเดินครั้งเดียว
           ⚠ ต้องเป็นเส้นทึบตอนวิ่ง เพราะแอนิเมชันใช้ dasharray เป็นตัววาด — ใส่ลายประ
             ตั้งแต่แรกจะไปทับกลไกนั้นแล้วเส้นจะโผล่ทั้งเส้นตั้งแต่เฟรมแรก */
        const supply = !!m.supply;
        /* ★ `fleet` — กองเรือ (เจ้าของเคาะ 2026-09-01) · ต่างจาก `supply` ตรงที่
           **มันคือกองทัพ** เส้นจึงหนาเท่าทัพบกและมีเลขกำลังพลเหมือนกัน
           สิ่งที่ต่างคือรูปหน่วย (ตัวเรือ) กับร่องรอยที่เส้นทิ้งไว้ (WAKE_DASH) */
        const fleet  = !!m.fleet;
        const wRoute = supply ? ROUTE_PX * 0.62 : ROUTE_PX;
        let under = null;
        if (!echo){
          under = mk('path',{d:rt.d, class:'mk-route mk-route-under' +
            (m.retreat ? ' retreat' : '') + (supply ? ' supply' : '') + (fleet ? ' fleet' : '')});
          under.style.stroke = '#0b0d12';
          under.style.strokeWidth = ((wRoute + 4.5) * mu0) + 'px';
          layers.markers.append(under);
        }
        const path = mk('path',{d:rt.d, stroke:col,
          class:'mk-route' + (m.retreat ? ' retreat' : '') +
                (supply ? ' supply' : '') + (fleet ? ' fleet' : '') +
                (echo ? ' mk-echo' : '')});
        /* ★ "หนาคงที่บนจอ" — เจ้าของชี้ให้ดูโปรเจกต์กวนอูแล้วบอกว่า "เส้นไม่หนา" คือสิ่งที่
           ต้องการ · เส้นดูบาง = ปัญหากล้องแคบ ทางแก้คือถอยกล้อง ไม่ใช่ทำเส้นหนา (ROUTE_PX) */
        path.style.strokeWidth = (wRoute * mu0) + 'px';
        layers.markers.append(path);
        /* ★ จดเส้นไว้ให้ layoutAnnotations หลบ (รีวิวรอบสอง 2026-08-26: "เส้นทับคำบรรยาย")
           echo ไม่ต้อง — เส้นจางของฉากอื่นไม่คุ้มให้ป้ายของฉากนี้หนี */
        if (!echo) annPaths.push(path);
        const L = path.getTotalLength();
        /* echo ไม่วาดตัวเอง — มันอยู่ที่นั่นตั้งแต่แรกแล้ว ไม่ใช่การเดินทัพที่กำลังเกิด
           และการปล่อย strokeDasharray ว่างไว้คือสิ่งที่ทำให้ CSS ใส่ลายประให้ได้
           (ถ้าตั้ง dasharray = L ตรงนี้ ลายประใน .mk-echo จะถูกทับทันที) */
        if (!echo){
          path.style.strokeDasharray  = L;
          path.style.strokeDashoffset = back ? -L : L;
          under.style.strokeDasharray  = L;
          under.style.strokeDashoffset = back ? -L : L;
        }

        /* หัวลูกศรของเราเอง (แทน marker สามเหลี่ยมเดิม) — ชี้ตามทิศจริงที่ปลายทาง
           ซ่อนไว้จนเดินถึง: หัวที่ค้างอยู่ปลายทางก่อนทัพไปถึงคือการโกหกเล็ก ๆ ทุกเฟรม */
        let headG = null;
        if (!echo){
          const tip = path.getPointAtLength(back ? 0 : L);
          const near = path.getPointAtLength(back ? Math.min(L, 9 * mu0) : Math.max(0, L - 9 * mu0));
          const ang = Math.atan2(tip.y - near.y, tip.x - near.x) * 180 / Math.PI;
          headG = mk('g',{class:'mk-head' + (m.retreat ? ' retreat' : ''),
            transform:`translate(${tip.x.toFixed(1)},${tip.y.toFixed(1)}) rotate(${ang.toFixed(1)})`});
          const hs = mk('g',{class:'mk-unit-s', transform:`scale(${mu0.toFixed(3)})`});
          const hp = mk('path',{d:'M 3,0 L -17,8.5 L -12,0 L -17,-8.5 Z'});
          hp.setAttribute('fill', col);
          hp.setAttribute('stroke', '#0b0d12');
          hp.setAttribute('stroke-width', 1);
          hs.append(hp); headG.append(hs);
          layers.markers.append(headG);
          headG.style.opacity = 0;
        }

        /* จุดแวะ — node ระหว่างทางของ march นี้ (ข้อมูลจริงจากกราฟถนน ไม่ใช่ของแต่ง)
           ให้อ่านออกว่าทัพ "เดินเมืองต่อเมือง" ตามที่ DECISIONS §4 ประกาศไว้ */
        let ticksG = null;
        const meta = TK.routeMeta && TK.routeMeta[m.route];
        if (!echo && meta && TK.nodes){
          ticksG = mk('g',{class:'mk-ticks'});
          for (const nid of meta.path.slice(1, -1)){
            const nd = TK.nodes[nid]; if (!nd || nd.x == null) continue;
            const tg = mk('g',{transform:`translate(${nd.x},${nd.y})`});
            const ts = mk('g',{class:'mk-unit-s', transform:`scale(${mu0.toFixed(3)})`});
            const c = mk('circle',{r:2.7, class:'mk-tick'});
            c.style.fill = col;
            ts.append(c); tg.append(ts); ticksG.append(tg);
          }
          layers.markers.append(ticksG);
          ticksG.style.opacity = 0;
        }

        /* ชั้นนอกรับ translate ชั้นในรับ scale — relayout() ปรับ scale ให้ขนาดคงที่บนจอ
           ⚠ ต้องใส่ scale ตั้งแต่ตอนสร้าง เหมือนที่ shell() ทำให้ป้ายธง (2026-08-22)
           เดิมชั้นนี้เกิดมาไม่มี transform เลย แปลว่าสัญลักษณ์กองทัพถูกวาดด้วยหน่วยแผนที่
           (ครึ่งด้าน 9 map unit) จนกว่า relayout() รอบถัดไปจะมาแก้ให้ ผลคือ:
             · ในหน้าจริง หน่วยเกิดมาใหญ่เวอร์แล้วหดวูบตอนกล้องหยุด ราวหนึ่งวินาทีให้หลัง
               ซึ่งเกิดกลางทางที่ลูกศรกำลังวิ่ง — เห็นเป็น "ลูกศรทัพแปลก ๆ"
             · ใน shot.ps1 ไม่มี relayout ตามมาเลย (setMarkers ถูกเรียกเป็นคำสั่งสุดท้าย)
               ภาพตรวจงานทุกใบที่ผ่านมาจึงมีหน่วยใหญ่เกินจริง — เครื่องมือตรวจโกหกเรื่องขนาด
           ยิ่งซูมเข้ายิ่งหนัก เพราะขนาดคงที่ในหน่วยแผนที่ = โตขึ้นตามสเกลจอ */
        const g  = mk('g',{class:'mk-unit' + (m.retreat ? ' retreat' : '') + (echo ? ' mk-echo' : '')});
        const gs = mk('g',{class:'mk-unit-s', transform:`scale(${screenMU().toFixed(3)})`});
        /* ขบวนเสบียงไม่ใช่กองทัพ — ใช้รูปวงกลมเล็ก (ล้อเกวียน) แทนสี่เหลี่ยมกองทัพ
           ถ้าใช้รูปเดียวกัน คนอ่านจะนับมันเป็นทัพอีกทัพหนึ่งบนแผนที่ */
        const sh = supply ? mk('circle',{r:5})
                 : fleet  ? unitShape('boat', 9)
                          : unitShape(m.unit || 'square', 9);
        if (m.retreat){ sh.setAttribute('fill','none');
                        sh.setAttribute('stroke',col);
                        sh.setAttribute('stroke-width',3); }
        else if (supply){ sh.setAttribute('fill', col);
                          sh.setAttribute('stroke', '#0b0d12');
                          sh.setAttribute('stroke-width', 2); }
        else            sh.setAttribute('fill', col);
        gs.append(sh); g.append(gs);
        layers.markers.append(g);

        /* ป้ายธงเกาะอยู่บนเส้นทาง เยื้องออกด้านข้างในแนวตั้งฉาก
           ห้ามวางที่หัวลูกศร เพราะหัวลูกศรไปจบบนเมืองปลายทาง ซึ่งมีทั้งชื่อพิมพ์บนภาพพื้น
           และ (ถ้าฉากนั้นมีการรบ) วงปะทะรัศมีราว 50px คร่อมอยู่
           ระยะถอยจึงคิดจาก "ครึ่งความกว้างป้าย + รัศมีวงปะทะ" เป็นพิกเซลจอ ไม่ใช่เศษส่วนของเส้น
           — เส้นสั้น ๆ อย่าง chencang_mei ถ้าใช้ 50% ป้ายจะไปนั่งทับวงปะทะพอดี */
        let chipEl = null;
        const who = TK.people[m.who];
        const cname = echo ? null : (who ? who.label : m.name);
        if (cname){
          const mu = screenMU();
          const c  = addChip(layers.markers, m.side,
                             cname + (m.strength ? '   ' + fmtK(m.strength) : ''));
          /* ★ `chip:"head"` (รีวิวรอบสาม 2026-08-26 — เจ้าของ: "ชี้เฮ่าเจาที่เฉินชาง
             ก็ได้ 1k ไม่ต้องวางข้างเส้น ไหน ๆ เราก็ได้วิธีใหม่กันมาละ") — ลูกศรที่
             ความหมายคือ "เข้าประจำที่ปลายทาง" ยึดป้ายที่หัวลูกศรเลย ความแน่นแถวนั้น
             ให้ layout หลบ + เส้นโยงพากลับ · ค่าปกติยังเกาะกลางเส้นเหมือนเดิม
             (ลูกศรเดินทัพยาว ๆ ป้ายกลางเส้นอ่านถูกแล้ว) */
          let p1;
          if (m.chip === 'head'){
            p1 = path.getPointAtLength(back ? 0 : L);
          } else {
            const clear = Math.min(L * 0.85, Math.max(L * 0.35, (c.w / 2 + 52) * mu));
            const sAt   = back ? clear : L - clear;        // หัวลูกศรอยู่ที่ 0 เมื่อวิ่งย้อนเส้น
            p1 = path.getPointAtLength(sAt);
          }
          /* จุดยึดคือจุดบนเส้นทาง — layoutAnnotations จะขยับหนีคนอื่นจากตรงนี้เอง
             rank 1 = ยอมหลบให้คำบรรยายของฉากก่อน */
          queueAnn(c, p1.x, p1.y, 1, 16);
          chipEl = c.g;
          chipEl.style.opacity = 0;
        }

        /* สัญลักษณ์กองทัพไปหยุดที่หัวลูกศร — จองที่ไว้ ป้ายจะได้ไม่ไปนั่งทับ
           echo ไม่จอง: ของฉากที่กำลังอ่านต้องได้ที่ก่อนเสมอ */
        const head = path.getPointAtLength(back ? 0 : L);
        if (!echo) blockAt(head.x, head.y, 14);

        /* หน่วยหยุดก่อนถึงปลาย 12px จอ — ไม่งั้นสัญลักษณ์เหล่าไปนั่งทับหัวลูกศรพอดี */
        const capL = Math.max(0, L - 12 * mu0);
        const at = v => path.getPointAtLength(back ? L - capL * v : capL * v);
        /* เปิดป้ายพร้อมเส้นโยงของมัน (ถ้า layout แขวนไว้) — เส้นโยงที่โผล่ก่อนป้าย
           คือเส้นชี้ไปหาอากาศ */
        const showChip = () => { if (chipEl){ chipEl.style.opacity = 1;
          (chipEl._leaders || []).forEach(l => l.style.opacity = ''); } };
        const settle = () => {
          path.style.strokeDashoffset = 0;
          if (under) under.style.strokeDashoffset = 0;
          /* เสบียง: พอถึงปลายทางแล้วเปลี่ยนเป็นเส้นประ — สายที่ไหลอยู่ตลอด ไม่ใช่การเดินครั้งเดียว
             (ทำหลังวิ่งจบ เพราะระหว่างวิ่ง dasharray เป็นกลไกวาดเส้น · relayout คุมระยะประต่อ) */
          if (supply) setSupplyDash(path, screenMU());
          if (fleet)  setWakeDash(under, screenMU());
          const pt = at(1);
          g.setAttribute('transform', `translate(${pt.x},${pt.y})`);
          showChip();
          if (headG) headG.style.opacity = 1;
          if (ticksG) ticksG.style.opacity = 1;
          /* ★ ทัพถึงที่หมายแล้ว — ถ้านี่คือเส้นสุดท้ายของฉาก ธงถึงจะพลิกได้ */
          if (animate !== false && --walking <= 0) flushOwners();
        };
        /* ★★ ความเร็วลูกศรคิดจาก **ความยาวบนจอ** ไม่ใช่เวลาคงที่ (เจ้าของทัก 2026-08-26:
           "ทุกลูกศรวิ่งไวมากเวลาอยู่ไกล ดูเร่งรีบเหมือน the flash")
           เดิมทุกเส้นใช้ 1500ms เท่ากันหมด — เส้น 59 หน่วย (วุ่ยถอยที่เจียถิง) กับเส้น
           551 หน่วย (ทัพเหอซีถูกเรียกกลับ) จึงวิ่งด้วยความเร็วต่างกันเกือบสิบเท่า
           ทัพที่เดินไกลกว่าควร *ใช้เวลานานกว่า* บนจอ ไม่ใช่วิ่งเร็วขึ้นให้จบพร้อมกัน
           SPEED เป็นพิกเซลจอต่อมิลลิวินาที — คิดจากพิกเซลเพราะสิ่งที่ตาเห็นคือพิกเซล
           ไม่ใช่หน่วยแผนที่ (ซูมเข้าแล้วเส้นเดิมยาวขึ้นบนจอ ก็ควรใช้เวลานานขึ้นด้วย)
           เพดานบนกันไม่ให้เส้นข้ามแผ่นดินกลายเป็นการรอ · เพดานล่างกันเส้นสั้นกระตุก */
        const SPEED = 0.23, MIN_MS = 750, MAX_MS = 3600;
        const runMs = Math.max(MIN_MS, Math.min(MAX_MS, (L / mu0) / SPEED));
        /* ประตูคลื่นถัดไปเปิดตอนคลื่นก่อนหน้าลงจอดครบ + จังหวะหายใจหนึ่งจังหวะ
           (240ms — พอให้ตาเห็นว่า "เส้นนั้นจบแล้ว เส้นนี้เพิ่งเริ่ม" ไม่ใช่ต่อกันติด) */
        const wv = m.wave || 0;
        if (wv > waveNow){ waveNow = wv; waveGate = waveEnd + 240; }
        const startAt = waveGate + 260 + idx*140;
        const durMs   = runMs + idx*160;
        waveEnd = Math.max(waveEnd, startAt + durMs);
        const run = () => mkTweens.push(
          TK.engine.tween({v:0},{v:1}, durMs, cur => {
            const rest = L * (1 - cur.v);
            path.style.strokeDashoffset = back ? -rest : rest;
            if (under) under.style.strokeDashoffset = back ? -rest : rest;
            const pt = at(cur.v);
            g.setAttribute('transform', `translate(${pt.x},${pt.y})`);
          }, settle));
        if (animate === false) settle();
        else { walking++; mkTimers.push(setTimeout(run, startAt)); }
      }

      if (m.type === 'clash'){
        const p = TK.places[m.place]; if (!p) return;
        forceLabels.add(m.place);

        /* ราคาของการรบไม่ได้เขียนเป็นตัวเลขบนแผนที่ — มันไปอยู่ในคอลัมน์นิยาย (ui.js .chg)
           รวมกับแถวพื้นที่เปลี่ยนมือ ตรงที่สายตาคนอ่านอยู่แล้ว
           เหตุผล: ตัวเลขเดียวกันถูกเล่าสามที่ (ร้อยแก้วมักบอกอยู่แล้ว · หลอด HUD ลดให้เห็น ·
           ป้ายบนแผนที่) พอเอาป้ายที่สามออก แผนที่ก็โล่งโดยไม่เสียข้อมูลสักตัว

           ⚠ เคยลองให้วงหนาตามราคาศึกแล้ว — ถอยออก วงปะทะมีหน้าที่เดียวคือบอกว่า
           "ใครปะทะกับใคร ที่ไหน" วงหนา ๆ บังแผนที่ และสองศึกที่อยู่ติดกันจะรกทันที
           ความหนาคงที่มาจาก CSS (.mk-clash-ring) เหมือนเดิม */
        /* scale ตั้งแต่ตอนสร้างด้วยเหตุผลเดียวกับ .mk-unit-s ข้างบน — วงปะทะเคยเกิดมา
           กว้าง 24 map unit แล้วค่อยหดตอน relayout ยิ่งซูมเข้าวงยิ่งกลืนทั้งสมรภูมิ
           relayout() ถอด " scale(...)" ออกก่อนใส่ใหม่อยู่แล้ว รูปแบบนี้จึงเข้ากันได้ */
        const g = mk('g',{class:'mk-clash',
          transform:`translate(${p.x},${p.y}) scale(${screenMU().toFixed(3)})`});
        g.append(mk('circle',{r:16, class:'mk-clash-ring'}));
        g.append(mk('circle',{r:24, class:'mk-clash-ring r2'}));
        g.append(mk('path',{d:'M -7,-7 L 7,7 M 7,-7 L -7,7', class:'mk-clash-x'}));
        layers.markers.append(g);
        blockAt(p.x, p.y, 30);                 // วงนอกพองถึง 1.5 เท่าของ r24 ตอนเต้น
      }
    });

    /* ไม่มีลูกศรวิ่งสักเส้น (ฉากหมุดล้วน · โหมด echo ล้วน · ตอนถ่ายภาพ) = ไม่มีอะไรให้รอ */
    if (!walking) flushOwners();

    /* ทุกอย่างเข้าคิวครบแล้ว จัดทีเดียว — ต้องรอให้ครบ ไม่งั้นป้ายแรก ๆ ไม่รู้ว่ามีใครตามมา */
    layoutAnnotations();
  }

  function relayout(){
    const screenW = host.clientWidth || 1000;
    const FONT_PX = 13.5;
    /* สเกลจริงของ meet = ด้านที่คับกว่า — คำนวณตรง ๆ อย่าเดาจากความกว้างอย่างเดียว */
    const scale = Math.min(screenW / vb.w, (host.clientHeight || 1) / vb.h);
    const mu = 1 / scale;                      // map-unit ต่อ 1 screen px

    /* ทุกอย่างที่ต้อง "ขนาดคงที่บนจอ" ต้องคูณ mu เพราะ viewBox ย่อ-ขยายตลอด
       (.mk-label ไม่ต้องคิดขนาดเองแล้ว มันอยู่ในชั้น .mk-chip-s ที่ถูก scale ให้อยู่) */
    layers.markers.querySelectorAll('.mk-unit-s, .mk-chip-s').forEach(g =>
      g.setAttribute('transform', `scale(${mu.toFixed(3)})`));
    layers.markers.querySelectorAll('.mk-route').forEach(p => {
      const w = (p.classList.contains('supply') ? ROUTE_PX * 0.62 : ROUTE_PX);
      p.style.strokeWidth = ((p.classList.contains('mk-route-under') ? w + 4.5 : w) * mu) + 'px';
      /* ระยะประของสายเสบียงต้องคงที่บนจอเหมือนทุกอย่างอื่น — แต่แตะเฉพาะเส้นที่วิ่งจบแล้ว
         (ถ้าเส้นยังวิ่งอยู่ dasharray คือกลไกวาด ห้ามยุ่ง — ดูที่ dashoffset ว่าเป็น 0 หรือยัง) */
      if (p.classList.contains('supply') && !p.classList.contains('mk-route-under') &&
          parseFloat(p.style.strokeDashoffset || '0') === 0) setSupplyDash(p, mu);
      /* ร่องรอยเรืออยู่ที่ **เงา** ไม่ใช่เส้นสี — เงื่อนไข mk-route-under จึงกลับด้าน */
      if (p.classList.contains('fleet') && p.classList.contains('mk-route-under') &&
          parseFloat(p.style.strokeDashoffset || '0') === 0) setWakeDash(p, mu);
    });
    styleFocusPaths();                 // วงเน้นเขตก็ขนาดคงที่บนจอเหมือนกัน (§17)
    if (roadsOn){                      // ถนนก็ขนาดคงที่บนจอ ไม่งั้นซูมออกแล้วกลายเป็นใยแมงมุม
      layers.roads.querySelectorAll('.road').forEach(p => {
        p.style.strokeWidth = (1.6 * mu) + 'px';
        if (p.classList.contains('road-horse'))
          p.style.strokeDasharray = `${(4*mu).toFixed(2)} ${(3.5*mu).toFixed(2)}`;
      });
      layers.roads.querySelectorAll('.road-node').forEach(c => {
        c.setAttribute('r', (2.2 * mu).toFixed(2));
        c.style.strokeWidth = (1 * mu) + 'px';
      });
    }
    layers.markers.querySelectorAll('.mk-clash').forEach(g => {
      const t = g.getAttribute('transform').replace(/ scale\([^)]*\)/,'');
      g.setAttribute('transform', `${t} scale(${mu.toFixed(3)})`);
    });
    scalePins(mu);

    /* สเกลเปลี่ยน = ขนาดป้ายเทียบกับระยะบนแผนที่เปลี่ยน ต้องจัดตำแหน่งใหม่
       ไม่งั้นซูมเข้าแล้วป้ายที่เคยหลบกันพอดีจะกางออกจนลอยห่างจากสิ่งที่มันอธิบาย */
    layoutAnnotations();

    /* ★ ส่งกล่องป้ายของฉาก (ชั้น markers) ไปให้ labeler จองไว้ก่อน — ไม่งั้นชื่อเมือง
       จะไปนอนทับป้ายของฉาก เพราะสองชั้นนี้ไม่เคยรู้จักกันมาก่อน (selfcheck ข้อ 5
       จับได้ห้าจุดตอน 2026-08-26 เช่น "ขอตราใหม่" ทับ "จิ่วเฉวียน")
       ต้องอ่าน *หลัง* layoutAnnotations() เท่านั้น ป้ายถึงจะอยู่ที่จริงแล้ว
       แปลง screen rect → หน่วยแผนที่ด้วย CTM ของ svg (ป้ายมี transform ซ้อนหลายชั้น
       จะไปคำนวณเองด้วยมือไม่ได้) */
    const avoid = [];
    {
      const svgEl = layers.markers.ownerSVGElement;
      const ctm = svgEl && svgEl.getScreenCTM();
      if (ctm){
        const inv = ctm.inverse(), pt = svgEl.createSVGPoint();
        const toMap = (x,y) => { pt.x = x; pt.y = y; return pt.matrixTransform(inv); };
        for (const g of layers.markers.querySelectorAll('.mk-chip, .mk-cap')){
          const r = g.getBoundingClientRect(); if (!r.width) continue;
          const a = toMap(r.left, r.top), b = toMap(r.right, r.bottom);
          avoid.push({ x:a.x, y:a.y, w:b.x - a.x, h:b.y - a.y });
        }
      }
    }
    const res = TK.labeler.layout(TK.places, vb, screenW, {
      force: forceLabels, quiet: quietLabels, fontPx: FONT_PX, pinR: 4, avoid,
      pinBox: (id) => symBox[id],      /* ★ กล่องจริงของรูป ไม่ใช่วงกลม 4px */
      fontFamily: '"Leelawadee UI","Segoe UI",Tahoma,sans-serif'
    });

    /* ★★ 2026-09-02 — **หมุดเลิกผูกกับป้าย** (เดิม: `display = on.has(id)` บรรทัดเดียว)
       เดิมหมุดโผล่เฉพาะจุดที่ labeler เลือกจะ *เขียนชื่อ* ให้ ซึ่งถูกสำหรับจุดกลม
       (จุดที่ไม่มีชื่อกำกับก็ไม่มีความหมาย) แต่ **ผิดสำหรับสัญลักษณ์** —
       รูปด่านบอกว่า "อ้อมไม่ได้" ได้ด้วยตัวมันเอง ไม่ต้องรอชื่อ และแผ่นก็พิมพ์ชื่อ
       ไว้ให้แล้ว 119 จาก 122 จุด (ดูหัวไฟล์ labeler.js)
       → สัญลักษณ์ใช้ LOD ของตัวเอง (`symMaxRank`) · จุดกลมยังผูกกับป้ายเหมือนเดิม */
    const on = new Set(res.pins);
    labelPins = on;
    applyPinVisibility();

    layers.labels.replaceChildren();
    for (const L of res.labels){
      const t = mk('text',{x:L.x, y:L.y, 'text-anchor':L.anchor,
        class:'plabel' + (forceLabels.has(L.id) ? ' hot' : '')});
      t.style.fontSize = L.fontMU + 'px';
      /* ฮาโลบางกว่านี้ไม่ชัด หนากว่านี้สระไทยจะเชื่อมกันเป็นก้อนดำอ่านไม่ออก */
      t.style.strokeWidth = (L.fontMU * 0.17) + 'px';
      t.textContent = TK.places[L.id].label;
      layers.labels.append(t);
      labelEl[L.id] = t;
    }
  }

  /* ── ลาก/ซูมด้วยมือ ── */
  function toMap(evt){
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function bindPanZoom(){
    let from = null;

    /* ⚠ ตัวควบคุมทุกอันลอยอยู่ *ข้างใน* #stage (ปุ่มมุมขวาบน · HUD · กระดูกสันหลัง)
       ดังนั้นทุก pointerdown ที่กดปุ่ม ก็เป็น pointerdown ของ #stage ด้วยเสมอ
       ถ้าปล่อยให้มันเริ่มลากแผนที่ จะเกิดสองอย่าง และอย่างที่สองคือตัวฆ่า:
         1. กดปุ่มแล้วแผนที่เลื่อนตาม ซึ่งไม่มีใครตั้งใจ
         2. setPointerCapture ย้ายเป้าหมายของ pointer ที่เหลือทั้งชุดมาที่ #stage
            แล้ว click ก็ไปลงที่ #stage แทนที่จะลงที่ปุ่ม — **ปุ่มตายสนิท**
       ข้อ 2 คือเหตุผลที่ปุ่ม Spine/Season/Play/Map กดแล้วไม่มีอะไรเกิดขึ้นเลย
       และเหตุผลที่ shot.ps1 ตรวจไม่เจอ: มันเรียก .click() ตรง ๆ ซึ่งข้ามชุด pointer
       ทั้งหมด — เครื่องมือจึงทดสอบเส้นทางที่ผู้อ่านไม่เคยเดิน (บทเรียนซ้ำรอบที่สามในวันเดียว)
       ⚠ ห้ามแก้ด้วยการเพิ่ม z-index — ปัญหาไม่ใช่ลำดับการวาด แต่เป็นการจับ pointer */
    const onChrome = e => e.target.closest('#maptools, #hud, #spine, #where, #seasonnote');

    host.addEventListener('wheel', e => {
      if (onChrome(e)) return;       // หมุนล้อบนพาเนลไม่ควรซูมแผนที่
      e.preventDefault();
      if (camCancel) camCancel();
      const p = toMap(e);
      const k = e.deltaY > 0 ? 1.16 : 1/1.16;
      const nw = Math.min(W, Math.max(140, vb.w * k)), nh = nw * fitAR();
      vb.x = p.x - (p.x - vb.x) * (nw/vb.w);
      vb.y = p.y - (p.y - vb.y) * (nh/vb.h);
      vb.w = nw; vb.h = nh;
      applyVB();
      scalePins();                // ★ ไอคอนต้องโตตามทันที ไม่งั้นกระตุกตอนหยุดหมุน
      settleLabels(160);          // จัดป้ายใหม่ตอนหยุดหมุนล้อ
    }, {passive:false});

    host.addEventListener('pointerdown', e => {
      if (onChrome(e)) return;
      if (camCancel) camCancel();
      from = {mx:e.clientX, my:e.clientY, vx:vb.x, vy:vb.y};
      host.setPointerCapture(e.pointerId);
      host.classList.add('grabbing');
    });
    host.addEventListener('pointermove', e => {
      if (!from) return;
      if (!from.moved){ from.moved = true; layers.labels.style.opacity = 0;
                        layers.pins.style.opacity = 0;
                        layers.focus.style.opacity = 0; }
      const sc = vb.w / (host.clientWidth || 1);
      vb.x = from.vx - (e.clientX - from.mx) * sc;
      vb.y = from.vy - (e.clientY - from.my) * sc;
      applyVB();
    });
    const end = () => {
      if (from) settleLabels(60);   // ปล่อยเมาส์แล้วค่อยจัดป้าย
      from = null; host.classList.remove('grabbing');
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);

    /* ย่อ-ขยายหน้าต่างแล้วต้องแก้สัดส่วน viewBox ตาม ไม่งั้นสเกลเพี้ยนทันที */
    window.addEventListener('resize', () => {
      const c = { x: vb.x + vb.w/2, y: vb.y + vb.h/2 };
      const f = fitBox(c.x - vb.w/2, c.y - vb.h/2, vb.w, vb.w * fitAR());
      vb = f; applyVB();
      scaleCache = null;            // สัดส่วนเปลี่ยน ต้องคำนวณขนาดหมุดใหม่
      settleLabels(180);
    });
  }

  /* ══ โหมดถนน (DECISIONS §15) ══════════════════════════════════════════════
     เปิดกราฟถนนทั้งแผ่นให้เห็นว่า "ทำไมกองทัพต้องไปทางนั้น"
     ★ ห้ามมีข้อมูลใหม่ — วาดจาก TK.edges/TK.nodes ตรง ๆ เส้นไหนลาก d แล้วก็ใช้ d
       เส้นไหนยังไม่ลากก็ต่อจุดตรง ๆ ตามกติกา §4 ข้อ 3 (ตรง = ยังไม่ลากตามภูมิประเทศ)
     สร้างครั้งเดียวตอนเปิดครั้งแรก แล้วซ่อน/โชว์ทั้งชั้น — 49 เส้นไม่คุ้มที่จะสร้างใหม่ทุกครั้ง */
  let roadsBuilt = false, roadsOn = false;
  function buildRoads(){
    if (roadsBuilt || !TK.edges) return;
    roadsBuilt = true;
    const at = id => TK.places[id] || (TK.nodes && TK.nodes[id]) || null;
    for (const e of TK.edges){
      const A = at(e.a), B = at(e.b); if (!A || !B) continue;
      const d = e.d || `M ${A.x},${A.y} L ${B.x},${B.y}`;
      /* wagons:false = ทางม้า ไม่ใช่ถนนเกวียน — เส้นประบาง ๆ ให้ต่างกันได้ด้วยตา
         (ข้อมูลนี้มีอยู่แล้วใน §4 ไม่ได้แต่งเพิ่ม และโหมดเสบียงในอนาคตใช้ค่าเดียวกัน) */
      layers.roads.append(mk('path',{ d, fill:'none',
        class: 'road' + (e.wagons === false ? ' road-horse' : '') }));
    }
    for (const id in (TK.nodes || {})){
      const p = at(id); if (!p) continue;
      layers.roads.append(mk('circle',{cx:p.x, cy:p.y, r:2.2, class:'road-node'}));
    }
  }
  function setRoads(on){
    roadsOn = !!on;
    if (roadsOn) buildRoads();
    layers.roads.style.display = roadsOn ? '' : 'none';
    if (roadsOn) relayout();            // ความหนาเส้นคงที่บนจอ ต้องคิดตามสเกลปัจจุบัน
    return roadsOn;
  }

  /* ══ ★ โหมดสองเอกภพ (DECISIONS §15 · เจ้าของเคาะ "Visual เลย" ตอนเคาะบทที่ 7) ══
     ฉากที่มีคีย์ `mirror` (c7-09) เรียก showMirror(m):
       1. เขตใน m.owners พลิกเป็นสีของ "เอกภพของเรา" — ใช้ setOwners เดิม
          จึงได้แอนิเมชัน flip ของ CSS ฟรี · จดสีเดิมไว้คืนตอน hide
       2. หมุดผี (m.markers) — วงประเทา ๆ กับตัวหนังสือซีด ไม่แตะระบบป้ายจริง
          (เป็น overlay ชั่วคราว ไม่เข้าคิว layoutAnnotations — ของผีห้ามดันของจริง)
       3. ป้ายมุมบนบอกว่ากำลังมองเอกภพไหน
     ออกจากฉาก: clearMarkers เก็บผี · setOwners ของฉากใหม่คืนสีแผ่นดินเอง */
  let mirrorSnap = null, mirrorG = null;
  function showMirror(m){
    if (mirrorSnap || !m) return false;
    mirrorSnap = {};
    for (const id in (m.owners || {})){
      const el = regionEl[id]; if (!el) continue;
      mirrorSnap[id] = el.getAttribute('fill');
    }
    setOwners(m.owners || {});
    const mu = screenMU();
    mirrorG = mk('g',{class:'mk-mirror'});
    for (const gm of (m.markers || [])){
      const p = TK.places[gm.place]; if (!p) continue;
      const gg = mk('g',{class:'mk-ghost', transform:`translate(${p.x},${p.y})`});
      const gs = mk('g',{class:'mk-unit-s', transform:`scale(${mu.toFixed(3)})`});
      gs.append(mk('circle',{r:6.5, class:'mk-ghost-dot'}));
      if (gm.label){
        /* dx/dy/anchor ต่อหมุด (พิกเซลจอ) — หมุดผีไม่เข้าคิว layoutAnnotations
           (ของผีห้ามดันของจริง) จึงต้องกางป้ายเองตอนหมุดอยู่ใกล้กัน (c7-09
           สามจุดห่างกัน ~25 หน่วย ป้ายชนกันเป็นก้อนถ้าวางสูตรเดียว) */
        const t = mk('text',{class:'mk-ghost-txt',
          x:gm.dx || 0, y:gm.dy === undefined ? -16 : gm.dy,
          'text-anchor':gm.anchor || 'middle'});
        t.textContent = gm.label;
        gs.append(t);
      }
      gg.append(gs); mirrorG.append(gg);
    }
    if (m.label){
      const tag = mk('g',{class:'mk-mirror-tag',
        transform:`translate(${(vb.x + vb.w/2).toFixed(1)},${(vb.y + 34*mu).toFixed(1)})`});
      const ts = mk('g',{class:'mk-unit-s', transform:`scale(${mu.toFixed(3)})`});
      const t = mk('text',{class:'mk-mirror-txt', x:0, y:0, 'text-anchor':'middle'});
      t.textContent = m.label;
      ts.append(t); tag.append(ts); mirrorG.append(tag);
    }
    layers.markers.append(mirrorG);
    return true;
  }
  function hideMirror(){
    if (!mirrorSnap) return false;
    for (const id in mirrorSnap){
      const el = regionEl[id]; if (!el) continue;
      el.setAttribute('fill', mirrorSnap[id]);
      el.setAttribute('stroke', mirrorSnap[id]);
      el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
    }
    if (mirrorG) mirrorG.remove();
    mirrorSnap = null; mirrorG = null;
    return false;
  }

  /* ★ เปิดตาราง GLYPH ให้ ui.js เอาไปทำปุ่มสัญลักษณ์ — **อ่านอย่างเดียว**
     ห้ามให้ที่อื่นแก้ ไม่งั้นตารางสัญลักษณ์จะมีสองแหล่ง (§14) */
  const api = { init, setOwners, flyTo, resetView, setMarkers, relayout, setFocus, setRoads, setYear,
                setPlate, get plateNew(){ return plateNew; }, get hasPlate(){ return !!TK.plateWater; },
                get glyphs(){ return GLYPH; }, unitShape,
                showMirror, hideMirror, get mirrorOn(){ return !!mirrorSnap; },
                get viewBox(){ return {...vb}; } };
  return api;
})();
