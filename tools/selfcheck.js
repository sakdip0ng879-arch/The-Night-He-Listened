/* selfcheck.js — ตัวตรวจ "ความผิดพลาดที่ DOM ถูกแต่ภาพผิด"
 *
 * ทำไมต้องมี: บั๊กก้อนดำเต็มจอกับวงกลมไหลหลุดจอ ตรวจด้วยการอ่าน DOM ไม่เจอเลย
 * เพราะ DOM ถูกต้องทุกอย่าง — ผิดตอน "เรนเดอร์" เท่านั้น
 * ตัวนี้จึงตรวจจาก computed style + getBBox ซึ่งเป็นผลลัพธ์หลังเรนเดอร์จริง
 *
 * วิธีใช้ — เปิด index.html แล้ววางใน console:
 *   const s=document.createElement('script'); s.src='tools/selfcheck.js';
 *   document.head.append(s);
 *   // แล้วเรียก
 *   TK.selfcheck.all()          เดินทุกฉากบนแผนที่ใหญ่แล้วรายงาน
 *
 * ตรวจห้าอย่าง: (1) path ที่ไม่มีใครสั่งว่าจะระบายยังไง (2) animation ที่ลืม transform-box
 * (3) ของที่วาดหลุดนอกกรอบ (4) ป้ายของฉากทับกันเอง (5) ป้ายของฉากทับชื่อเมืองบนแผนที่
 *
 * ⚠ **ต้องเปิดผ่าน http ไม่ใช่ file://** (DECISIONS §13) — `node tools/serve.js` แล้วเปิด
 *   http://localhost:8778 · ถ้าเปิดจาก file:// การอ่าน cssRules ของข้อ 2 จะถูกบล็อกเงียบ ๆ
 *
 * (เดิมตรวจโหมดสมรภูมิด้วย — โหมดนั้นถูกถอดออกแล้ว ดู DECISIONS §9)
 */
window.TK = window.TK || {};

TK.selfcheck = (function(){

  const problems = [];
  const add = (sev, where, what, how) => problems.push({sev, where, what, how});

  /* ── 1. path ที่ระบายทึบ "โดยไม่ได้ตั้งใจ" (ต้นเหตุ "ก้อนดำเต็มจอ") ──
     SVG ระบาย path เป็นสีดำทึบตามค่าปริยาย ถ้าลืมสั่ง fill:none
     แต่ path ที่ตั้งใจให้ระบาย (ชั้นพื้นที่ยึดครอง, หัวลูกศร) ต้องไม่ถูกฟ้อง
     → เกณฑ์: ฟ้องเฉพาะ path ที่ "ไม่มีทั้ง attribute fill และไม่มี class"
       เพราะนั่นคือ path ที่ไม่มีใครกำหนดหน้าตาให้เลย = ลืมสั่ง */
  function checkFills(root, where){
    for (const p of root.querySelectorAll('path')){
      if (p.hasAttribute('fill') || p.hasAttribute('class')) continue;
      /* ไม่ดูค่า computed เพราะอาจมีกฎ CSS แบบเหมารวมช่วยไว้อยู่
         ตรวจที่ "ผู้เขียนสั่งหรือยัง" — พึ่งกฎเหมารวมเป็นการป้องกันที่เปราะ
         ย้ายไฟล์หรือเปลี่ยน id ของชั้นเมื่อไหร่ บั๊กกลับมาทันที */
      const r = p.getBoundingClientRect();
      add('error', where,
        `path has neither a fill attribute nor a class — nobody said how to paint it ` +
        `(it is covering ${Math.round(r.width)}×${Math.round(r.height)} px right now)`,
        'set fill="none" explicitly where that path is created');
    }
  }

  /* ── 2. transform animation ที่ลืม transform-box (ต้นเหตุ "วงกลมไหลหลุดจอ") ──
     ใน SVG ถ้าใช้ transform-origin:center โดยไม่มี transform-box:fill-box
     คำว่า center = กึ่งกลางของทั้ง viewport ไม่ใช่ของรูปนั้น พอ scale จะเหวี่ยงหลุด */
  function checkTransformBox(root, where){
    for (const e of root.querySelectorAll('*')){
      const cs = getComputedStyle(e);
      if (cs.animationName === 'none') continue;
      const usesTransform = [...document.styleSheets].some(ss => {
        try {
          return [...ss.cssRules].some(r =>
            r.type === CSSRule.KEYFRAMES_RULE && r.name === cs.animationName &&
            [...r.cssRules].some(k => /transform:\s*(scale|rotate)/.test(k.cssText)));
        } catch { return false; }
      });
      if (usesTransform && cs.transformBox !== 'fill-box'){
        add('error', where,
          `<${e.tagName}> class="${e.getAttribute('class')||'—'}" ` +
          `animation "${cs.animationName}" scales or rotates, but transform-box = ${cs.transformBox}`,
          'add transform-box:fill-box alongside transform-origin:center');
      }
    }
  }

  /* ── 3. อะไรที่วาดหลุดออกนอกกรอบภาพ ──
     ⚠ ต้องใช้ getBoundingClientRect ไม่ใช่ getBBox
       getBBox คืนกรอบ "ก่อน" ใส่ transform ของตัวเอง ทุกหน่วยจะกองอยู่ที่ (0,0) หมด
     ดูเฉพาะชั้น marker — ภาพพื้นกับรูปแคว้นล้นกรอบเป็นเรื่องปกติตอนซูมเข้า
     ที่ต้องไม่ล้นคือของที่ฉากวาดขึ้นมาเอง: ลูกศร ป้ายธง คำบรรยาย วงปะทะ */
  function checkBounds(svg, where){
    const V = svg.getBoundingClientRect();
    if (!V.width) return;
    const layer = svg.querySelector('#L-markers');
    if (!layer) return;
    const pad = Math.max(V.width, V.height) * 0.06;
    for (const e of layer.querySelectorAll('path,rect,circle,polygon,text')){
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.left < V.left - pad || r.top  < V.top - pad ||
          r.right > V.right + pad || r.bottom > V.bottom + pad){
        add('warning', where,
          `<${e.tagName}> class="${e.getAttribute('class')||'—'}" is drawn outside the frame`,
          'check the coordinates in data, or whether a transform threw it off');
      }
    }
  }

  /* ── 4. ป้ายบนแผนที่ทับกันเอง ──
     ใช้ screen rect เพราะต้องเทียบหลังใส่ transform แล้ว
     (เดิมตรวจสัญลักษณ์หน่วยในโหมดสมรภูมิ ซึ่งถูกถอดออกไปแล้ว — ตอนนี้ตรวจป้ายธง
      กับคำบรรยายหมุดของแผนที่ใหญ่แทน ซึ่งเป็นที่เดียวที่ยังมีป้ายลอยทับกันได้) */
  function checkOverlap(where){
    const boxes = [];
    for (const g of document.querySelectorAll('#L-markers .mk-chip, #L-markers .mk-cap')){
      const t = g.querySelector('text');
      boxes.push({ label: t ? `"${t.textContent}"` : 'a label',
                   r: g.getBoundingClientRect() });
    }

    for (let i=0;i<boxes.length;i++)
      for (let j=i+1;j<boxes.length;j++){
        const A = boxes[i].r, B = boxes[j].r;
        if (!A.width || !B.width) continue;
        const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox > 3 && oy > 3)
          add('warning', where,
            `${boxes[i].label} overlaps ${boxes[j].label} (by ${Math.round(ox)}×${Math.round(oy)} px)`,
            'the annotation layout could not find a free slot — the scene may be pointing at too much at once');
      }
  }

  /* ── 5. ป้ายของฉากทับ "ชื่อเมือง" ที่ชั้นป้ายวาดไว้ ──
     ข้อ 4 ข้างบนเทียบ chip กับ chip เท่านั้น — ชื่อเมืองที่ labeler.js วางไว้อยู่คนละชั้น
     (`#L-labels`) จึงไม่เคยถูกเทียบกับอะไรเลย ผลจริง: ป้าย "เปลี่ยนธงในสองเดือน" ของ c2-03
     นอนทับคำว่า "หนานอาน" อยู่ 52×2 px มาตลอดโดยไม่มีตัวตรวจไหนเห็น (เจ้าของเห็นก่อน)
     ⚠ ทั้งสองชั้นมี transform คนละชุด จึงต้องเทียบด้วย screen rect เท่านั้น            */
  function checkCrossLayer(where){
    const chips  = [...document.querySelectorAll('#L-markers .mk-chip, #L-markers .mk-cap')];
    const labels = [...document.querySelectorAll('#L-labels text, #L-pins text')];
    for (const c of chips){
      const A = c.getBoundingClientRect(); if (!A.width) continue;
      const t = c.querySelector('text');
      for (const l of labels){
        const B = l.getBoundingClientRect(); if (!B.width) continue;
        const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox > 2 && oy > 2)
          add('warning', where,
            `scene label ${t ? `"${t.textContent}"` : ''} overlaps the map name ` +
            `"${l.textContent}" (by ${Math.round(ox)}×${Math.round(oy)} px)`,
            'move the pin onto its real dot, shorten the label, or reframe the camera');
      }
    }
  }

  /* ── ตรวจแผนที่ยุทธศาสตร์ ทีละฉาก ──
     เดินทุก beat แทนที่จะดูฉากเดียว เพราะป้ายทับกันเป็นเรื่องเฉพาะฉาก */
  function strategic(){
    const svg = document.getElementById('tkmap');
    if (!svg) return;
    const beats = TK.engine.beats;
    for (let i = 0; i < beats.length; i++){
      TK.engine.goTo(i, 'init');
      TK.map.setMarkers(beats[i].markers, false);
      /* ⚠⚠ **ต้องเรียก relayout เอง** — setMarkers สร้างของขึ้นมาดิบ ๆ ยังไม่มีใครจัดขนาด
         กับตำแหน่งให้ ปกติ rAF ของกล้องจะเรียกให้ แต่ลูปนี้เดินแบบ synchronous จึงไม่มี
         ถ้าไม่เรียก ป้ายจะถูก "วัด" ตั้งแต่ยังไม่ถูกวาง แล้วข้อ 4 (ป้ายทับกัน) จะรายงาน
         ผลของภาพที่ไม่มีอยู่จริง — ตัวตรวจที่ตอบว่า "ไม่เจออะไร" ทั้งที่ไม่ได้ตรวจอะไรเลย
         (บทเรียนเดียวกับ shot.ps1 · BUGS_SEEN §C4 · เจอ 2026-08-26) */
      TK.map.relayout();
      const where = `scene ${beats[i].id}`;
      checkFills(svg, where);
      checkTransformBox(svg, where);
      checkBounds(svg, where);
      checkOverlap(where);
      checkCrossLayer(where);
    }
  }

  function all(){
    problems.length = 0;
    strategic();
    return report();
  }

  function report(){
    const bad  = problems.filter(p => p.sev === 'error');
    const warn = problems.filter(p => p.sev === 'warning');
    console.log(`%cdone — ${bad.length} error(s) · ${warn.length} warning(s)`,
                `font-weight:bold;color:${bad.length?'#ff6b6b':'#6fd39a'}`);
    if (bad.length)  console.table(bad.map(p => ({where:p.where, problem:p.what, fix:p.how})));
    if (warn.length) console.table(warn.map(p => ({where:p.where, problem:p.what, fix:p.how})));
    return { errors: bad.length, warnings: warn.length, list: problems };
  }

  return { all, strategic, report, get problems(){ return problems; } };
})();
