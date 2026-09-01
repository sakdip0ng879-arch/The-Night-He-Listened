/* spine.js — สงครามทั้งก้อนในหน้าจอเดียว
 *
 * ทำไมต้องมี: แผนที่ตอบได้ดีมากว่า "ที่ไหน" แต่ตอบไม่ได้เลยว่า "รูปทรงของสงครามเป็นยังไง"
 * คนอ่านพงศาวดาร 101 ฉากเห็นทีละฉาก และ HUD มุมล่างซ้ายบอกแค่ "ณ ฉากนี้" —
 * ไม่มีที่ไหนในโปรแกรมที่บอกได้ว่า 48 ปีนี้หน้าตายังไง ตรงไหนคือทศวรรษที่ไม่มีอะไรเกิดขึ้น
 * ตรงไหนคือปีที่ทุกอย่างเกิดพร้อมกัน และราคา 75.3 หมื่นศพกระจายตัวยังไง
 *
 * ★ ไม่มีข้อมูลใหม่แม้แต่ตัวเดียว ทุกเส้นทุกจุดในนี้คำนวณจาก engine.strength / mapDelta /
 *   losses ที่มีอยู่แล้วและถูกตัวตรวจห้าตัวคุมอยู่แล้ว — ซึ่งเป็นเหตุผลที่มันปลอดภัย
 *   ต่างจากโหมดสมรภูมิเดิมที่สร้าง "แหล่งความจริงที่สอง" ขึ้นมาโดยไม่มีอะไรตรวจได้
 *
 * แกนนอนเป็นเวลาจริง (เชิงเส้น 228→276) ไม่ใช่ลำดับฉาก — ตั้งใจ เพราะรูปทรงที่อยากให้เห็น
 * คือ "ภาคสามคือสิบปีที่ไม่มีอะไรเกิดขึ้น" ซึ่งถ้าวางตามลำดับฉากจะหายไปทันที
 */
window.TK = window.TK || {};

TK.spine = (function(){

  const E = TK.engine;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const e = document.createElementNS(NS, t);
                         for (const k in a) e.setAttribute(k, a[k]); return e; };

  const W = 1000, H = 560;
  const L = 56, R = 22, T = 48, B = 96;       /* ขอบ */
  const PLOT_B = H - B;                        /* ก้นกราฟกำลังพล */
  const LANE_TERR = H - B + 24;                /* แถวแผ่นดินเปลี่ยนมือ */
  const LANE_SCENE = H - B + 54;               /* แถวฉาก */

  const SIDES = ['han','wei','wu'];
  const SHORT = ['นำ','1','2','3','4','5','6','7','8','9','10','11','ปิด'];   /* ตรงกับแถบเวลาใน ui.js */
  const SEASON = {spring:'ฤดูใบไม้ผลิ', summer:'ฤดูร้อน',
                  autumn:'ฤดูใบไม้ร่วง', winter:'ฤดูหนาว'};
  let host = null, svg = null, tip = null, open = false;
  let xs = [], maxTroops = 1;

  /* ── เวลาของแต่ละฉาก ──
     ปีจริง + ตำแหน่งภายในปีตามลำดับที่เล่า ไม่ได้อ้างว่ารู้เดือน รู้แค่ลำดับ ซึ่งเป็นของจริง
     ที่หนังสือเองยืนยัน (build_timeline บังคับให้ปีเดินหน้าอยู่แล้ว) */
  function buildX(){
    const perYear = new Map();
    E.beats.forEach(b => perYear.set(b.year, (perYear.get(b.year) || 0) + 1));
    const seen = new Map();
    xs = E.beats.map(b => {
      const k = seen.get(b.year) || 0;
      seen.set(b.year, k + 1);
      const n = perYear.get(b.year);
      return b.year + (n > 1 ? k / n : 0.5);
    });
  }

  const y0 = E.beats[0].year, y1 = E.beats[E.beats.length - 1].year + 1;
  const X  = t => L + (t - y0) / (y1 - y0) * (W - L - R);
  const Y  = v => PLOT_B - (v / maxTroops) * (PLOT_B - T);

  /* ── วาดครั้งเดียว ── */
  function build(){
    buildX();
    const S = E.beats.map((b, n) => E.strength(n));
    maxTroops = Math.max(1, ...S.flatMap(s => SIDES.map(k => s[k].troops)));
    maxTroops = Math.ceil(maxTroops / 5) * 5;

    svg = mk('svg', {viewBox:`0 0 ${W} ${H}`, class:'spine-svg',
                     preserveAspectRatio:'xMidYMid meet'});

    /* ── ภาคเป็นแถบบนสุด — ให้คนอ่านรู้ว่ากำลังดูช่วงไหนของหนังสือ ── */
    const chapAt = {};
    E.beats.forEach((b, n) => {
      const c = chapAt[b.chapter] || (chapAt[b.chapter] = {a:xs[n], b:xs[n]});
      c.a = Math.min(c.a, xs[n]); c.b = Math.max(c.b, xs[n]);
    });
    Object.entries(chapAt).forEach(([n, c], k) => {
      const info = TK.chapters.find(x => x.n === +n) || {};
      const x = X(c.a), w = Math.max(2, X(c.b) - X(c.a));
      svg.append(mk('rect', {x, y:14, width:w, height:20,
                             class:'sp-chap' + (k % 2 ? ' alt' : '')}));
      if (w > 16){
        const t = mk('text', {x:x + w/2, y:28, class:'sp-chaptxt'});
        /* เลขภาคแบบเดียวกับแถบเวลาข้างล่าง — คนอ่านจะได้เทียบสองแถบนี้ได้ทันที */
        t.textContent = SHORT[+n] ?? n;
        svg.append(t);
      }
    });

    /* ── เส้นกริดกำลังพล ── */
    for (let v = 0; v <= maxTroops; v += 10){
      svg.append(mk('line', {x1:L, x2:W - R, y1:Y(v), y2:Y(v), class:'sp-grid'}));
      const t = mk('text', {x:L - 8, y:Y(v) + 4, class:'sp-axis', 'text-anchor':'end'});
      t.textContent = v ? (v * 10) + 'k' : '0';
      svg.append(t);
    }
    /* ── เส้นกริดปี ทุกสิบปี ── */
    for (let y = Math.ceil(y0 / 10) * 10; y < y1; y += 10){
      svg.append(mk('line', {x1:X(y), x2:X(y), y1:T, y2:LANE_SCENE + 8, class:'sp-grid'}));
      const t = mk('text', {x:X(y), y:H - 24, class:'sp-axis', 'text-anchor':'middle'});
      t.textContent = y;
      svg.append(t);
    }

    /* ── กำลังพลสามฝ่าย ── */
    for (const k of SIDES){
      const d = E.beats.map((b, n) => `${n ? 'L' : 'M'}${X(xs[n]).toFixed(1)},${Y(S[n][k].troops).toFixed(1)}`).join(' ');
      svg.append(mk('path', {d, class:'sp-line sp-' + k}));
    }

    /* ── ราคา: ฉากที่มีคนตาย ──
       วงกลมบนเส้นของฝ่ายที่จ่ายแพงที่สุดในฉากนั้น รัศมีตามรากที่สองของจำนวน
       (รากที่สอง ไม่ใช่เชิงเส้น — ไม่งั้นซูฉาง 13.7 จะกลบทุกอย่างที่เหลือ) */
    E.beats.forEach((b, n) => {
      if (!b.losses) return;
      const worst = Object.entries(b.losses).sort((a, c) => c[1] - a[1])[0];
      const total = Object.values(b.losses).reduce((a, c) => a + c, 0);
      svg.append(mk('circle', {cx:X(xs[n]), cy:Y(S[n][worst[0]].troops),
                               r:(2.2 + Math.sqrt(total) * 1.5).toFixed(1),
                               class:'sp-loss sp-' + worst[0], 'data-i':n}));
    });

    /* ── ทุกฉากเป็นจุดกดได้ ──
       ⚠ เคยมีแถวที่สาม "แผ่นดินเปลี่ยนมือ" (36 ขีด) อยู่เหนือแถวนี้ — ถอดออก 2026-08-22
         เจ้าของบอกว่ากราฟ "ดูเยอะเกินไป" จนไม่ค่อยได้เปิด และสิ่งเดียวที่พูดถึงคือเส้นของหวู
         การเปลี่ยนมือของแผ่นดินสะท้อนอยู่ในเส้นกำลังพลอยู่แล้ว (เสียแคว้น = เส้นตก)
         ข้อมูลชั้นที่สองที่เล่าเรื่องเดียวกันคือความรก ไม่ใช่ความละเอียด — บทเรียนเดียวกับ
         ตอนที่เอาตัวเลขความสูญเสียออกจากแผนที่เมื่อ 2026-08-17
       ⚠ ห้ามเขียน c.append(x).textContent — Element.append() คืน undefined ไม่ใช่ node */
    E.beats.forEach((b, n) => {
      svg.append(mk('circle', {cx:X(xs[n]), cy:LANE_SCENE, r:3.4,
                               class:'sp-dot', 'data-i':n}));
    });

    /* ── เส้นบอกฉากที่กำลังอ่าน ── */
    svg.append(mk('line', {id:'sp-now', x1:0, x2:0, y1:T - 6, y2:LANE_SCENE + 10}));

    /* ── ป้ายกำกับแถว ── */
    const lab = (y, s) => { const t = mk('text', {x:L - 8, y, class:'sp-axis', 'text-anchor':'end'});
                            t.textContent = s; svg.append(t); return t; };
    lab(LANE_SCENE + 4, 'ฉาก');

    /* ── หัวเรื่องกับกุญแจสี ──
       HUD มุมล่างซ้ายถูกโอเวอร์เลย์บังอยู่ ถ้าไม่มีกุญแจตรงนี้คนดูต้องเดาว่าเส้นไหนของใคร */
    const head = mk('text', {x:L, y:10, class:'sp-head'});
    head.textContent = `${y0}–${y1 - 1} · กำลังพลที่ระดมได้ · ` +
      `${E.length} ฉาก · มีราคาเลือด ${E.beats.filter(b => b.losses).length} ฉาก`;
    svg.append(head);

    /* ⚠ กุญแจสีอยู่ชิดซ้ายต่อจากหัวเรื่อง ไม่ใช่ชิดขวา — มุมขวาบนเป็นที่ของแถวปุ่ม
       ซึ่งลอยอยู่เหนือโอเวอร์เลย์นี้ (z-index 9 > 8) กุญแจที่วางไว้ตรงนั้นจะถูกบังทันที */
    let kx = 470;
    for (const k of SIDES){
      const name = TK.factions[k].label;
      svg.append(mk('rect', {x:kx, y:3, width:8, height:8, class:'sp-sw2 sp-' + k}));
      const t = mk('text', {x:kx + 12, y:10, class:'sp-key sp-' + k});
      t.textContent = name;
      svg.append(t);
      kx += 12 + name.length * 6.8 + 16;
    }

    host.append(svg);
    bindHover();
  }

  /* ── hover / click ──
     ผูกที่ svg ตัวเดียวแล้วอ่าน data-i แทนที่จะผูกทีละจุด — 159 element ที่มี listener
     ของตัวเองเป็นของที่ต้องมานั่งถอดตอนสร้างใหม่ และเราสร้างใหม่ทุกครั้งที่เปิด */
  function bindHover(){
    svg.addEventListener('mousemove', e => {
      const el = e.target.closest('[data-i]');
      if (!el){ tip.classList.remove('on'); return; }
      const n = +el.dataset.i, b = E.beats[n];
      const bits = [`<b>${b.year}${b.season ? ' · ' + (SEASON[b.season] || b.season) : ''}</b> ${b.title}`];
      if (b.losses) bits.push('เสีย ' +
        Object.entries(b.losses).map(([k, v]) =>
          `<i class="sp-sw sp-${k}"></i>${(v * 10000).toLocaleString('en-US')}`).join('  '));
      if (b.mapDelta) bits.push('แผ่นดินเปลี่ยนมือ ' + Object.keys(b.mapDelta).length + ' เขต');
      tip.innerHTML = bits.join('<br>');
      tip.classList.add('on');
      const r = host.getBoundingClientRect();
      tip.style.left = Math.min(r.width - 250, Math.max(8, e.clientX - r.left + 14)) + 'px';
      tip.style.top  = (e.clientY - r.top + 16) + 'px';
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('on'));
    svg.addEventListener('click', e => {
      const el = e.target.closest('[data-i]');
      if (!el) return;
      toggle(false);
      TK.ui.scrollTo(+el.dataset.i);
    });
  }

  /* ── ฉากที่กำลังอ่าน ── */
  function mark(n){
    if (!svg) return;
    const line = svg.querySelector('#sp-now');
    if (line){ line.setAttribute('x1', X(xs[n])); line.setAttribute('x2', X(xs[n])); }
    svg.querySelectorAll('.sp-dot').forEach(c =>
      c.classList.toggle('now', +c.dataset.i === n));
  }

  function toggle(on){
    open = on === undefined ? !open : on;
    host.classList.toggle('on', open);
    document.getElementById('btnSpine').classList.toggle('on', open);
    if (open){ if (!svg) build(); mark(E.index); }
  }

  function init(){
    host = document.getElementById('spine');
    tip  = document.createElement('div');
    tip.className = 'sp-tip';
    host.append(tip);
    /* ถอนโฟกัสเมื่อถูกคลิกด้วยเมาส์ ด้วยเหตุผลเดียวกับ tap() ใน ui.js —
       ไม่งั้น Enter ที่กดทีหลังจะไปเปิด-ปิดกระดูกสันหลังซ้ำโดยไม่มีใครตั้งใจ */
    const btn = document.getElementById('btnSpine');
    btn.onclick = e => { if (e.detail) btn.blur(); toggle(); };
    E.on('beat', ev => { if (open) mark(ev.index); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && open){ e.stopPropagation(); toggle(false); }
    }, true);
  }

  return { init, toggle };
})();
