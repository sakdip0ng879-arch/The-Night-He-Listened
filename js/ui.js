/* ui.js — โหมดอ่านนิยาย + แถบเวลา + HUD กำลังพล
 *
 * แนวคิดหลัก: นี่ไม่ใช่สไลด์ที่กดทีละหน้า แต่เป็น "นิยายที่เลื่อนอ่านต่อเนื่อง
 * แล้วแผนที่วิ่งตามที่อ่านอยู่" — เนื้อเรื่องทั้ง 71 ตอนอยู่ในหน้าเดียวกันหมด
 * เลื่อนถึงตอนไหน กล้องกับพื้นที่บนแผนที่ก็ขยับไปตอนนั้น
 */
window.TK = window.TK || {};

TK.ui = (function(){

  const $ = s => document.querySelector(s);
  const E = TK.engine;

  /* **ตัวหนา** ในหมายเหตุจริง/แต่ง — เนื้อหาเป็นของเราเองทั้งหมด (ไม่ใช่ input ผู้ใช้)
     แต่ escape < > ไว้ก่อนอยู่ดี เผื่อวันหลังมีใครเขียนเครื่องหมายน้อยกว่าลงไป */
  const mdBold = t => (t || '')
    .replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const FACT = {
    real:    { label:"จริง", cls:"f-real" },
    fiction: { label:"แต่ง", cls:"f-fic"  },
    mixed:   { label:"ผสม", cls:"f-mix"  }
  };
  const SEASON = {spring:'ฤดูใบไม้ผลิ', summer:'ฤดูร้อน',
                  autumn:'ฤดูใบไม้ร่วง', winter:'ฤดูหนาว'};
  const SHORT = ['นำ','1','2','3','4','5','6','7','8','9','10','11','ปิด'];

  let arts = [];          // <article> ของแต่ละตอน
  let scrollDriven = false;   // การเปลี่ยนตอนครั้งนี้มาจากการเลื่อนอ่านหรือไม่
  let programmatic = false;   // กำลังสั่งเลื่อนเองอยู่ ห้าม observer ยิงกลับ

  /* ══ โหมดทั้งฤดู ══
     ช่องว่างที่แผนที่นี้มีเทียบกับแผนที่แคมเปญของเกมแนวนั้น ไม่ใช่ 3 มิติ และไม่ใช่ภูมิประเทศ
     — มันคือ "หลายอย่างเกิดพร้อมกัน" พงศาวดารเล่าทีละฉาก คนอ่านจึงไม่เคยเห็นว่าฤดูร้อน 253
     มีสามเรื่องเกิดคนละที่พร้อมกัน ทั้งที่ข้อมูลบอกไว้ครบแล้ว
     วัดแล้ว 62 ฉากจาก 101 อยู่ในฤดูที่มีฉากอื่นอยู่ด้วย จึงมีของให้ดูจริง */
  let seasonOn = false;
  const seasonKey = b => b.year + (b.season ? '/' + b.season : '');
  const seasonMap = new Map();          // key -> [index, …]
  const yearMap   = new Map();          // ปีล้วน — ใช้เป็นตาข่ายรองรับ

  /* ★ ฤดูก่อน ถ้าฤดูนั้นอยู่คนเดียวค่อยถอยมาใช้ปี (2026-08-22)
     จัดกลุ่มด้วยฤดูล้วนได้ครอบคลุมแค่ 61% และตายสนิทตรงที่คนอ่านอยู่นานที่สุดพอดี:
       ภาค IV 13% · ภาค V 32%   (สองภาคนี้รวมกัน 41 ฉากจาก 101)
     สาเหตุชัดมาก — ปี 241 มีสี่ฉาก (c4-03b/c/d/e) แต่เป็นคนละฤดูกันทั้งสี่ จึงไม่จับคู่กันเลย
     ทั้งที่มันคือแคมเปญเดียวกันแท้ ๆ ปุ่มเลยดูเหมือนเสียทั้งที่ทำงานถูกต้องตามที่เขียนไว้
     ถอยมาใช้ปีเมื่อฤดูไม่มีเพื่อน: ครอบคลุม 85% · ภาค IV 63% · ภาค V 84%
     และปีที่แน่นอยู่แล้ว (228 มี 17 ฉาก) ยังแตกตามฤดูเหมือนเดิม ไม่ระเบิดใส่หน้าคนอ่าน */
  function groupOf(i){
    const b = E.beats[i];
    const s = seasonMap.get(seasonKey(b)) || [i];
    return s.length > 1 ? s : (yearMap.get(b.year) || [i]);
  }

  /* กรอบที่กินทุกอย่างของฉากกลุ่มนี้ — ใช้ตอนเปิดโหมดฤดู เพราะกล้องของฉากเดียว
     มักตัดเพื่อนร่วมฤดูทิ้งหมด (ฉากเดียวกันปี 253 อยู่คนละมุมของแผ่นดิน) */
  function seasonBox(idxs){
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
    const eat = (x, y) => { any = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const i of idxs){
      for (const m of (E.beats[i].markers || [])){
        const p = m.place && TK.places[m.place];
        if (p) eat(p.x, p.y);
        const rt = m.route && TK.routes[m.route];
        if (rt){
          const n = rt.d.match(/-?[\d.]+/g).map(Number);
          for (let k = 0; k + 1 < n.length; k += 2) eat(n[k], n[k+1]);
        }
      }
    }
    if (!any) return null;
    /* ขอบเผื่อให้ป้ายกับหัวลูกศร แล้วบังคับพื้นกล้อง 560 หน่วยเหมือนที่ check_camera ใช้
       ฤดูที่มีฉากเดียวจะได้ไม่ซูมจนเส้นบางหายไปในแผนที่พื้น */
    const pad = 70;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const w = Math.max(560, x1 - x0), h = y1 - y0;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - w/2, cy - h/2, w, h];
  }

  /* ⚠⚠ ต้องอ่าน "ตำแหน่งที่ค้างไว้" **ก่อน** E.goTo(0) เสมอ — เพราะ goTo ยิง render
     ซึ่งเขียนทับ tk-place ด้วยฉากแรกทันที · ตอนแรกเขียน setupResume() ไว้ท้าย init()
     แล้วแถบไม่ขึ้นเลยทั้งที่ค่าถูกเก็บไว้จริง (อ่านได้ 'p0-01' ทุกครั้ง)
     ★ ตระกูลเดียวกับบั๊กลำดับใน init() ที่คอมเมนต์ข้างล่างเล่าไว้ — ในฟังก์ชันนี้
       **ลำดับสำคัญกว่าที่หน้าตาโค้ดทำให้คิด** ทุกครั้ง */
  let placeAtLoad = null;
  try { placeAtLoad = localStorage.getItem('tk-place'); } catch {}

  function init(){
    E.beats.forEach((b, i) => {
      const k = seasonKey(b);
      if (!seasonMap.has(k)) seasonMap.set(k, []);
      seasonMap.get(k).push(i);
      if (!yearMap.has(b.year)) yearMap.set(b.year, []);
      yearMap.get(b.year).push(i);
    });
    buildReader();
    buildTimeline();
    buildHud();
    /* ★ ต่อ engine เข้ากับการวาด *ก่อน* ผูกปุ่ม — กันตายทั้งหน้าเพราะปุ่มเดียว
       ลำดับเดิมคือ bindControls() ก่อน แล้ววันที่ 2026-08-22 มีค่าเก่าใน localStorage
       ทำให้มันโยนกลางคัน ผลคือแผนที่ไม่ถูกวาดเลยแม้แต่ครั้งเดียว ทั้งที่เนื้อเรื่องกับ
       แถบเวลาสร้างเสร็จไปแล้ว — อาการที่ผู้อ่านเห็นคือ "แผนที่ไม่ขยับ" ซึ่งชี้ไปผิดที่หมด
       สลับลำดับแล้วอย่างแย่ที่สุดคือปุ่มเสีย ไม่ใช่หนังสือทั้งเล่มเสีย */
    E.on('beat', render);
    E.goTo(0, 'init');
    bindControls();
    setupIntro();
    setupResume();
    const ri = $('#btnIntro'); if (ri) ri.onclick = reopenIntro;
  }

  /* ══ ★ ลิงก์ตรงถึงฉาก + หน้าเปิด (เพิ่ม 2026-09-01) ══════════════════════
     `#c7-13` ในลิงก์ = เปิดมาที่ฉากนั้นเลย · ใช้ได้ทุกฉาก ไม่ใช่แค่สามฉากในหน้าเปิด
     ⚠ อ่านอย่างเดียว ไม่เขียน hash กลับตอนผู้อ่านเลื่อน — เพราะการเขียน hash ทุกฉาก
       จะถล่ม history ของเบราว์เซอร์ (132 รายการ) และไปกวน observer ของคอลัมน์นิยาย */
  const beatIndexById = id => E.beats.findIndex(b => b.id === id);

  function applyDeepLink(){
    const id = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
    if (!id) return false;
    const n = beatIndexById(id);
    if (n < 0) return false;
    scrollTo(n);
    return true;
  }

  function setupIntro(){
    const el = $('#intro');
    if (!el) return;
    const close = () => {
      el.remove();
      try { localStorage.setItem('tk-intro', '1'); } catch {}
    };

    /* ⚠⚠ สามทางที่ต้องไม่โชว์หน้าเปิด — ข้อสองสำคัญที่สุด:
         1. เคยดูแล้ว
         2. `?intro=0` — **ตัวตรวจกับตัวถ่ายภาพส่งมา** ถ้าไม่มีข้อนี้
            `check_click` จะกดปุ่มไม่โดน (overlay บัง) และภาพจาก `shot.ps1`
            จะมีหน้าเปิดทับทุกใบ
         3. มาด้วยลิงก์ตรงถึงฉาก — คนที่รู้ว่ามาหาอะไร ไม่ต้องอ่านคำนำ */
    const q = new URLSearchParams(location.search);
    const force = q.get('intro') === '1';      /* ?intro=1 = บังคับโชว์ ชนะทุกเงื่อนไข */
    let seen = false;
    try { seen = localStorage.getItem('tk-intro') === '1'; } catch {}
    const skip = q.get('intro') === '0';
    const deep = force ? false : applyDeepLink();
    if (!force && (skip || seen || deep)){ el.remove(); return; }

    /* มาถึงตรงนี้ = ตัดสินใจแล้วว่า **โชว์** · ถอดคลาสกันวาดที่สคริปต์ใน <head> ติดไว้
       (จำเป็นสำหรับเคส hash ที่ชี้ไปฉากซึ่งไม่มีอยู่จริง — สคริปต์ใน head เห็นแค่ว่า
        "มี hash" แต่ตัดสินไม่ได้ว่ามันชี้ไปฉากที่มีจริงหรือเปล่า) */
    document.documentElement.classList.remove('no-intro');
    $('#introStart').onclick = close;
    $('#introPeek').onclick  = () => el.classList.add('peek');
    el.querySelectorAll('.peeks button').forEach(btn => {
      btn.onclick = () => {
        const n = beatIndexById(btn.dataset.goto);
        close();
        if (n >= 0) scrollTo(n);
      };
    });
    document.addEventListener('keydown', function esc(e){
      if (e.key === 'Escape' && document.body.contains(el)){
        close(); document.removeEventListener('keydown', esc);
      }
    });
    /* เปลี่ยน hash ทีหลังก็ยังกระโดดได้ (เช่นคนแก้ URL เอง) */
    window.addEventListener('hashchange', applyDeepLink);
  }

  /* ══ ★ อ่านต่อจากที่ค้างไว้ (เพิ่ม 2026-09-02) ═════════════════════════════
     เจ้าของทัก: *"พอกดดูฉากไปแล้วครั้งนึง พอออกเข้าใหม่มันเด้งไปให้อ่านตั้งแต่ต้น"*
     ต้นเหตุมีมาก่อนหน้าเปิด — แอปนี้ **ไม่เคยจำตำแหน่งเลย** (E.goTo(0,'init'))
     แต่หน้าเปิดทำให้มันเจ็บขึ้น เพราะพอใช้ทางลัดแล้วกลับมา ได้ทั้งเริ่มใหม่จากศูนย์
     และเมนูสามฉากหายถาวร
     ★ เลือก **เสนอ ไม่ใช่ยึด** — เปิดมายังเริ่มที่ฉากแรกเหมือนเดิม แล้วขึ้นแถบเล็ก ๆ
       ให้กดอ่านต่อ · เพราะพงศาวดารเป็นของที่คนกลับมาอ่านใหม่ตั้งแต่ต้นได้ การโยน
       คนเข้ากลางภาคเจ็ดเงียบ ๆ สร้างความงงมากกว่าความสะดวก (และลิงก์ที่แชร์กันต่อ
       ต้องเริ่มที่เดียวกันเสมอ ไม่ใช่ขึ้นกับว่าเครื่องนั้นเคยอ่านถึงไหน) */
  function setupResume(){
    const bar = $('#resume');
    if (!bar) return;
    const id = placeAtLoad;              /* ค่าที่อ่านไว้ตั้งแต่ก่อน goTo(0) */
    if (!id) return;
    const n = beatIndexById(id);
    /* หนีบเสมอ ห้ามเชื่อค่าที่เก็บไว้ว่ายังมีอยู่ — ฉากอาจถูกลบ/เปลี่ยน id ไปแล้ว
       และอย่าเสนอถ้าเพิ่งอ่านไปไม่กี่ฉาก มันไม่ได้ช่วยอะไร */
    if (n < 3) return;
    const b = E.beats[n];
    const chap = TK.chapters.find(c => c.n === b.chapter);
    $('#resumeWhere').textContent =
      (chap ? chap.label.replace(/^ภาค/, 'ภาค') + ' · ' : '') + 'ฉากที่ ' + (n + 1);
    bar.hidden = false;
    $('#resumeGo').onclick = () => { bar.hidden = true; scrollTo(n); };
    $('#resumeNo').onclick = () => { bar.hidden = true; };
  }

  /* กลับไปดูหน้าเปิดอีกครั้ง — ล้างธงแล้วโหลดใหม่ ใช้ทางเดิมทั้งหมด ไม่มีสถานะซ้อน */
  function reopenIntro(){
    try { localStorage.removeItem('tk-intro'); } catch {}
    location.hash = '';
    location.reload();
  }

  /* ══ นิยาย: สร้างทุกตอนไว้ในหน้าเดียว ══ */
  function buildReader(){
    const reader = $('#reader');
    reader.replaceChildren();
    arts = [];
    let lastChapter = -1;

    E.beats.forEach((b, i) => {
      if (b.chapter !== lastChapter){
        lastChapter = b.chapter;
        const info = TK.chapters.find(c => c.n === b.chapter) || {};
        const h = document.createElement('div');
        h.className = 'chapmark';
        h.innerHTML = `<b>${info.label || 'ภาคที่ ' + b.chapter}</b><i>${info.years || ''}</i>`;
        reader.append(h);
      }

      const a = document.createElement('article');
      a.className = 'beat';
      a.dataset.i = i;
      const f = FACT[b.fact] || FACT.mixed;
      /* ★ 2026-08-28 — `factNote` ของ 30 ฉากใน 5 บทเขียน **ตัวหนา** แบบ markdown ไว้
         และมันแสดงเป็นดอกจันจริง ๆ บนจอมาตลอด (เจอตอนอ่านภาพ c9-06)
         แปลงที่ตัวเรนเดอร์ทีเดียว ดีกว่าไล่ลบดอกจันในบทที่ล็อกไปแล้วห้าบท
         ⚠ ใช้กับ `factNote` เท่านั้น — `text` เป็นร้อยแก้วนิยาย ห้ามมีตัวหนา (BUGS_SEEN §E14) */
      a.innerHTML =
        `<div class="bmeta">${b.year}${b.season ? ' · ' + SEASON[b.season] : ''}</div>
         <h2 class="btitle">${b.title}</h2>
         <p class="text${b.voice === 'watcher' ? ' watcher' : ''}">${b.text}</p>
         <div class="chg"></div>
         <span class="fact ${f.cls}">${f.label}</span>
         <div class="fnote">${mdBold(b.factNote)}</div>`;

      a.querySelector('.fact').onclick = e => {
        e.stopPropagation();
        a.querySelector('.fnote').classList.toggle('open');
      };

      reader.append(a);
      arts.push(a);
    });

    /* เว้นท้ายไว้ให้ตอนสุดท้ายเลื่อนขึ้นมาถึงเส้นอ่านได้ */
    const tail = document.createElement('div');
    tail.style.height = '52vh';
    reader.append(tail);

    watchScroll(reader);
  }

  /* เส้นอ่านอยู่ราว 35% จากขอบบนของพาเนล — ตอนที่คร่อมเส้นนี้คือตอนที่กำลังอ่าน
     ใช้ scroll event คำนวณตรง ๆ แทน IntersectionObserver เพราะตรวจสอบง่ายกว่า
     และไม่มีปัญหาแถบบางเกินจนไม่มีอะไรแตะ */
  let tScroll = null;
  function watchScroll(reader){
    reader.addEventListener('scroll', () => {
      if (programmatic) return;
      clearTimeout(tScroll);
      tScroll = setTimeout(pickCurrent, 70);
    }, {passive:true});
  }

  function pickCurrent(){
    const reader = $('#reader');
    const line = reader.getBoundingClientRect().top + reader.clientHeight * 0.35;
    let best = 0, bd = Infinity;
    arts.forEach((a, i) => {
      const r = a.getBoundingClientRect();
      const d = (r.top <= line && r.bottom >= line) ? 0
              : Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line));
      if (d < bd){ bd = d; best = i; }
    });
    if (best !== E.index){ scrollDriven = true; E.goTo(best, 'read'); scrollDriven = false; }
  }

  /* กระโดดไปตอนที่ระบุ — เลื่อนหน้าให้ด้วย และสั่งเปลี่ยนตอนเองเลย
     ห้ามรอให้ตัวตรวจจับการเลื่อนทำงาน เพราะระหว่างเลื่อนเองมันถูกปิดไว้ */
  function scrollTo(i){
    const a = arts[i]; if (!a) return;
    programmatic = true;
    a.scrollIntoView({ behavior:'smooth', block:'center' });
    clearTimeout(scrollTo._t);
    scrollTo._t = setTimeout(() => { programmatic = false; }, 650);
    if (i !== E.index) E.goTo(i, 'jump');
  }

  /* ══ แถบเวลา ══ */
  function buildTimeline(){
    const strip = $('#chapstrip'), track = $('#track');
    strip.replaceChildren(); track.replaceChildren();

    const groups = [];
    E.beats.forEach((b, i) => {
      const last = groups[groups.length - 1];
      if (!last || last.chapter !== b.chapter)
        groups.push({ chapter:b.chapter, first:i, items:[i] });
      else last.items.push(i);
    });

    for (const g of groups){
      const info = TK.chapters.find(c => c.n === g.chapter) || {};
      const cap  = `${info.label || 'ภาคที่ ' + g.chapter}${info.years ? ' · ' + info.years : ''}`;

      const btn = document.createElement('button');
      btn.className = 'chapbtn';
      btn.dataset.chapter = g.chapter;
      btn.style.flexGrow = g.items.length;
      btn.title = cap;
      btn.innerHTML = `<b>${SHORT[g.chapter] ?? g.chapter}</b><i>${info.years || ''}</i>`;
      btn.onclick = () => scrollTo(g.first);
      strip.append(btn);

      const grp = document.createElement('div');
      grp.className = 'tgrp';
      grp.style.flexGrow = g.items.length;
      grp.dataset.chapter = g.chapter;
      grp.title = cap;
      for (const i of g.items){
        const b = E.beats[i];
        const cell = document.createElement('button');
        cell.className = 'tcell';
        cell.dataset.i = i;
        cell.title = `${b.year} · ${b.title}`;
        cell.onclick = () => scrollTo(i);
        grp.append(cell);
      }
      track.append(grp);
    }
    bindScrub();
  }

  /* ลากไล่ดูตลอดแถบเวลา */
  function bindScrub(){
    const track = $('#track'), strip = $('#chapstrip');
    let on = false, last = -1;

    const indexAt = x => {
      let best = null, bd = Infinity;
      for (const c of track.querySelectorAll('.tcell')){
        const r = c.getBoundingClientRect();
        const d = Math.abs(x - (r.left + r.width/2));
        if (d < bd){ bd = d; best = +c.dataset.i; }
      }
      return best;
    };
    const move = e => {
      if (!on) return;
      const i = indexAt(e.clientX);
      if (i !== null && i !== last){ last = i; scrollTo(i); E.goTo(i, 'scrub'); }
    };
    const stop = () => { on = false; track.classList.remove('scrubbing'); };

    for (const el of [track, strip]){
      el.addEventListener('pointerdown', e => {
        on = true; last = -1; el.setPointerCapture(e.pointerId);
        track.classList.add('scrubbing'); move(e);
      });
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', stop);
      el.addEventListener('pointercancel', stop);
    }
  }

  function buildHud(){
    /* the header says what the bars measure — without it readers had to guess */
    const head = document.createElement('div');
    head.className = 'hhead';
    head.textContent = 'กำลังพลที่แผ่นดินของแต่ละฝ่ายเลี้ยงได้';

    $('#hud').replaceChildren(head, ...['han','wei','wu'].map(k => {
      const f = TK.factions[k];
      const row = document.createElement('div');
      row.className = 'hrow';
      row.innerHTML =
        `<div class="htop">
           <span class="hname"><i class="hdot" style="background:${f.color}"></i>${f.label}</span>
           <span class="hnum" data-num="${k}">—</span>
         </div>
         <span class="hbar"><i data-bar="${k}" style="background:${f.color}"></i></span>`;
      return row;
    }));

    /* ★★ บรรทัดแนวตะวันตก — สะพานชั้นกลาง (ทางเลือก ก · เจ้าของเคาะ 2026-08-27)
       ซ่อนไว้ก่อนจนกว่าจะมีฉากที่ประกาศ `front` (ฉากแรกคือ c6-03 ที่กางบัญชีทัพสองฝั่ง)
       — ก่อนหน้านั้น "แนวรบตะวันตก" ยังไม่เป็นของจริง ไม่ต้องมีบรรทัดว่าง ๆ ค้างไว้ */
    const fr = document.createElement('div');
    fr.className = 'hfront';
    fr.id = 'hfront';
    fr.style.display = 'none';
    $('#hud').appendChild(fr);
  }

  /* ══ เล่นเอง ══
     ไม่ใช่แอนิเมชันที่วิ่งตลอดเวลา — เจตนาคือ "กดแล้วดู" เท่านั้น
     ของที่ขยับอยู่ข้างตัวหนังสือแย่งสมาธิคนอ่าน เล่มนี้เจอมาแล้วสองครั้ง
     (สีแคว้นที่ต้องแช่แข็งตอนถ่ายภาพ · ลูกศรที่หนาแล้วผอมกลางทาง)
     2600ms ต่อฉาก = กล้องบิน 1000 + ลูกศรวิ่งจบราว 1800 แล้วเหลือเวลาให้มองอีกหน่อย */
  let playTimer = null;
  function setPlaying(on){
    clearTimeout(playTimer); playTimer = null;
    const btn = $('#btnPlay');
    btn.classList.toggle('on', on);
    btn.textContent = on ? '❚❚ หยุด' : '▶ เล่น';
    if (!on) return;
    (function step(){
      if (E.index >= E.length - 1){ setPlaying(false); return; }
      scrollTo(E.index + 1);
      playTimer = setTimeout(step, 2600);
    })();
  }

  /* ══ ผูกปุ่มแบบไม่ทิ้งกับดักไว้ให้ Enter ══
     เบราว์เซอร์ให้โฟกัสค้างบนปุ่มที่เพิ่งคลิก แล้ว Enter/Space ก็ไปกดปุ่มนั้นซ้ำ
     กับปุ่มที่เป็น "ก้าว" ยังพอทำเนา แต่กับ Play ซึ่งเป็น **โหมด** มันคือกับดัก:
     เจ้าของกด Play ด้วยเมาส์ แล้วกด Enter ทีหลัง → Play เริ่มเดินเองเงียบ ๆ
     ฉากไหลไปสามฉากโดยไม่รู้ว่าทำไม (รายงานจริง 2026-08-22)
     e.detail > 0 = คลิกด้วยตัวชี้จริง · e.detail === 0 = ถูกเรียกจากคีย์บอร์ด
     จึงถอนโฟกัสเฉพาะกรณีแรก คนที่ใช้ Tab+Enter ยังคงเดินต่อได้ตามปกติ */
  const tap = (sel, fn) => {
    const el = $(sel);
    el.onclick = e => { if (e.detail) el.blur(); fn(e); };
  };

  /* ★ โหมดสองเอกภพ (§15 · ◆④ บทที่ 7) — สถานะข้ามฟังก์ชัน:
     curBeat กันไทเมอร์ของฉากเก่ายิงใส่ฉากใหม่ · mirrorSeen = เหลือบอัตโนมัติ
     ครั้งแรกที่เข้าฉากเท่านั้น (ครั้งต่อไปผู้อ่านกดปุ่มเอง) */
  let curBeat = null, mirrorT1 = 0, mirrorT2 = 0;
  const mirrorSeen = new Set();

  function bindControls(){
    tap('#btnNext',  () => { setPlaying(false); scrollTo(Math.min(E.length - 1, E.index + 1)); });
    tap('#btnPrev',  () => { setPlaying(false); scrollTo(Math.max(0, E.index - 1)); });
    tap('#btnReset', () => TK.map.resetView(900));
    tap('#btnPlay',  () => setPlaying(!playTimer));
    tap('#btnSeason', () => {
      seasonOn = !seasonOn;
      $('#btnSeason').classList.toggle('on', seasonOn);
      try { localStorage.setItem('tk-season', seasonOn ? '1' : '0'); } catch {}
      E.goTo(E.index, 'jump');            /* วาดใหม่ด้วยโหมดใหม่ ไม่ต้องเลื่อนหน้า */
    });
    try { seasonOn = localStorage.getItem('tk-season') === '1'; } catch {}
    $('#btnSeason').classList.toggle('on', seasonOn);

    /* โหมดถนน — ปุ่มนี้มีอยู่ใน index.html มาตั้งแต่ต้นแต่ไม่มีโค้ดหลังปุ่ม กดแล้วเงียบ
       (เจ้าของสั่งเก็บ 2026-08-26) · ตัวโหมดอยู่ที่ TK.map.setRoads — ดู DECISIONS §15
       ไม่จำค่าไว้ใน localStorage ต่างจากโหมดฤดู: นี่เป็นแว่นส่องชั่วคราว ไม่ใช่วิธีอ่านเรื่อง
       ถ้าจำไว้ ผู้อ่านที่เผลอกดจะเปิดหน้าครั้งหน้ามาเจอใยถนนทั้งแผ่นโดยไม่รู้ว่ามาจากไหน */
    let roadsOn = false;
    tap('#btnRoads', () => {
      roadsOn = TK.map.setRoads(!roadsOn);
      $('#btnRoads').classList.toggle('on', roadsOn);
    });

    /* ชั้นน้ำจริง (Natural Earth ดัดเข้าพิกัดแผ่น) — เจ้าของเคาะโหมด "ทับ" ก่อน
       เพื่อเทียบกับแม่น้ำที่แผ่นพิมพ์มา · ไม่จำสถานะใน localStorage เหมือนโหมดถนน
       ด้วยเหตุผลเดียวกัน: มันเป็นแว่นส่องชั่วคราว ไม่ใช่วิธีอ่านเรื่อง */
    let waterOn = false;
    tap('#btnWater', () => {
      waterOn = TK.map.setWater(!waterOn);
      $('#btnWater').classList.toggle('on', waterOn);
    });


    /* ★★ ปุ่มสัญลักษณ์ — ตารางแปลรูปบนแผนที่ (เจ้าของสั่ง 2026-09-05:
       *"ถ้ากังวลว่าคนอ่านจะดูยากว่าคืออะไร เราค่อยเพิ่มตัวปุ่มให้คนกดดู icon ทีหลังก็ได้"*)

       ★ **ไม่มีข้อมูลใหม่** — รูปสถานที่อ่านจาก `TK.map.glyphs` (ตาราง GLYPH ตัวจริง
       ที่แผนที่ใช้วาด) และรูปกองทัพเรียก `TK.map.unitShape` ตัวเดียวกับที่ลูกศรใช้
       ถ้าวันหนึ่งมีคนแก้รูป ตารางนี้เปลี่ยนตาม **ไม่มีวันเน่าแบบ §E17**

       ⚠ ไม่จำสถานะใน localStorage — เหมือนโหมดถนน มันคือแว่นส่องชั่วคราว           */
    const LEGEND = [
      ['สถานที่', [
        ['capital','นครหลวง','ผังสามชั้น ฐานกว้างสุด'],
        ['city','เมือง','มีกำแพงมีประตู = ล้อมได้ ยึดได้ มียุ้ง'],
        ['town','เมืองเล็ก','หลังคาเดียว ไม่มีกำแพง = ผ่านได้ ไม่ต้องหยุด'],
        ['pass','ด่าน','ประตูคร่อมถนน — อ้อมไม่ได้'],
        ['fort','ป้อม','ใบเสมา + หอคอย = จุดที่ไม่ยอม'],
        ['camp','ค่าย','กระโจม + รั้วไม้ = ตั้งอยู่ ไม่ใช่เมือง ย้ายได้'],
        ['farm','ค่ายนา','กระท่อม + ร่องนา — ข้าวปลูกตรงนี้ ไม่ต้องเดินมาจากเฉิงตู'],
        ['depot','ยุ้ง/คลัง','ยุ้งกลมทรงฮั่น — ที่ที่ข้าวพัก'],
        ['ford','ท่าข้าม','ข้ามน้ำได้ที่นี่ที่เดียว'],
        ['valley_mouth','ปากหุบ','ผาสองข้างบีบ + ช่องแคบตรงกลาง'],
        ['mountain','ภูเขาที่มีชื่อ','เดินข้ามไม่ได้']
      ]]
    ];
    const UNITS = [['square','ทหารราบ'],['triangle','ทหารม้า'],
                   ['boat','กองเรือ'],['wagon','ขบวนเสบียง']];

    function buildLegend(){
      const box = $('#legend');
      if (box.childElementCount) return;
      const NS = 'http://www.w3.org/2000/svg';
      const row = (svg, name, why) => {
        const r = document.createElement('div'); r.className = 'lg-row';
        const c = document.createElement('div'); c.className = 'lg-ico'; c.append(svg);
        const t = document.createElement('div');
        t.innerHTML = '<b>' + name + '</b><span>' + why + '</span>';
        r.append(c, t); return r;
      };
      const head = txt => { const h = document.createElement('div');
                            h.className = 'lg-head'; h.textContent = txt; return h; };

      for (const [title, rows] of LEGEND){
        box.append(head(title));
        for (const [ty, name, why] of rows){
          const spec = TK.map.glyphs[ty]; if (!spec) continue;
          const svg = document.createElementNS(NS,'svg');
          svg.setAttribute('viewBox','0 0 24 24');
          svg.setAttribute('width','26'); svg.setAttribute('height','26');
          (spec.fill || []).forEach(d => {
            const p = document.createElementNS(NS,'path');
            p.setAttribute('d', d); p.setAttribute('fill-rule','evenodd'); svg.append(p); });
          (spec.stroke || []).forEach(o => {
            const p = document.createElementNS(NS,'path');
            p.setAttribute('d', o.d); p.setAttribute('class','gs');
            p.setAttribute('stroke-width', o.w);
            if (o.dash) p.setAttribute('stroke-dasharray', o.dash);
            svg.append(p); });
          box.append(row(svg, name, why));
        }
      }

      box.append(head('สิ่งก่อสร้าง'));
      const line = (inner, name, why) => {
        const svg = document.createElementNS(NS,'svg');
        svg.setAttribute('viewBox','0 0 26 26');
        svg.setAttribute('width','26'); svg.setAttribute('height','26');
        svg.innerHTML = inner; return row(svg, name, why);
      };
      box.append(line('<path class="lg-wall" d="M1,15 H25"/>' +
        '<path class="lg-wall-t" d="M3,15 v-4 M9,15 v-4 M15,15 v-4 M21,15 v-4"/>',
        'กำแพงเมืองจีน','เส้นทึบ + ฟันเสมา · ชายแดนเหนือของจักรวรรดิ'));
      box.append(line('<path class="lg-spine" d="M1,14 H25"/>' +
        '<rect class="lg-fort" x="3" y="11" width="5" height="5"/>' +
        '<rect class="lg-fort" x="11" y="11" width="5" height="5"/>' +
        '<rect class="lg-fort" x="19" y="11" width="5" height="5"/>',
        'โซ่ป้อม','ป้อมเรียงตามถนน — แต่ละป้อมมองเห็นป้อมถัดไป'));
      box.append(line('<path class="lg-spine" d="M1,15 H25"/>' +
        '<path class="lg-stake" d="M4,12 v6 M9,12 v6 M14,12 v6 M19,12 v6 M24,12 v6"/>',
        'แนวรั้ว','หลักไม้ถี่ — บอกว่าคนเข้ามาตรงไหน ไม่ได้กันคนเข้า'));

      box.append(head('กองทัพ — รูปทึบ มีสีฝ่าย เคลื่อนที่บนเส้นทาง'));
      for (const [kind, name] of UNITS){
        const svg = document.createElementNS(NS,'svg');
        svg.setAttribute('viewBox','-12 -12 24 24');
        svg.setAttribute('width','26'); svg.setAttribute('height','26');
        const sh = TK.map.unitShape(kind, 8);
        sh.setAttribute('class','lg-unit'); svg.append(sh);
        box.append(row(svg, name, ''));
      }
      const sw = document.createElement('div'); sw.className = 'lg-sides';
      sw.innerHTML = '<i style="background:var(--han)"></i>ฮั่น' +
                     '<i style="background:var(--wei)"></i>วุ่ย' +
                     '<i style="background:var(--wu)"></i>ง่อ' +
                     '<i style="background:#9AA0A6"></i>ไม่มีเจ้าของ';
      box.append(sw);
      const foot = document.createElement('div');
      foot.className = 'lg-foot';
      foot.textContent = 'สัญลักษณ์สถานที่เป็นหมึกดำล้วน ไม่มีสีฝ่าย และไม่เคลื่อนที่ — ' +
                         'สีฝ่ายเป็นภาษาของกองทัพเท่านั้น';
      box.append(foot);
    }

    tap('#btnLegend', () => {
      buildLegend();
      const box = $('#legend'), on = box.hidden;
      box.hidden = !on;
      $('#btnLegend').classList.toggle('on', on);
    });

    /* ★ โหมดสองเอกภพ — ปุ่มโผล่เฉพาะฉากที่มีคีย์ `mirror` (render จัดการ)
       ไม่จำค่าใน localStorage: มันคือการเหลือบมองเอกภพข้าง ๆ ไม่ใช่วิธีอ่านเรื่อง */
    tap('#btnMirror', () => {
      clearTimeout(mirrorT1); clearTimeout(mirrorT2);
      if (!curBeat || !curBeat.mirror) return;
      const on = TK.map.mirrorOn ? TK.map.hideMirror() : TK.map.showMirror(curBeat.mirror);
      $('#btnMirror').classList.toggle('on', !!on);
    });

    /* ⚠ เคยมีสามระดับ — `faint` ถูกตัดทิ้ง 2026-08-22
       มันมีไว้ตอนป้ายภาษาไทยของเราต้องสู้กับชื่ออังกฤษที่พิมพ์มากับ map.jpg ต้องฟอกแผนที่พื้น
       ให้ซีดจนตัวหนังสือของเราชนะ — ปัญหานั้นตายไปพร้อมการแปลทั้งเล่มเป็นอังกฤษเมื่อ 2026-08-09
       และป้ายก็มีฮาโลของตัวเองแล้ว มันเป็นซากของปัญหาที่แก้ไปแล้ว
       เจ้าของบอกเองว่า "ไม่มั่นใจว่าจะกดเองไหม ส่วนตัวกดแต่ Rich" — ค่าเริ่มต้นจึงเป็น rich */
    const MODES = [{cls:'',label:'ปกติ'},{cls:'map-rich',label:'เข้ม'}];
    /* ⚠ ค่าที่เก็บไว้ใน localStorage คือ **ดัชนีของอาร์เรย์** ซึ่งแปลว่ามันผูกกับความยาว
       ของอาร์เรย์ ณ วันที่เก็บ ไม่ใช่กับความหมาย — พอ 2026-08-22 ตัด `faint` ออกจากสามเหลือสอง
       ผู้อ่านที่เคยกด rich ไว้ (เก็บเลข 2) เปิดหน้ามาแล้ว MODES[2] เป็น undefined
       → TypeError กลาง bindControls() → ซึ่งถูกเรียก *ก่อน* E.on('beat') กับ E.goTo()
       → **แผนที่ไม่เคยสมัครรับ event และไม่เคยวาดเลยทั้งหน้า** เพราะปุ่มปุ่มเดียว
       ต้องหนีบเสมอ ห้ามเชื่อค่าที่เก็บไว้ว่ายังอยู่ในช่วง — และ check_click ก็จับไม่ได้
       เพราะมันเปิด Chrome ด้วยโปรไฟล์ใหม่ทุกครั้ง จึงไม่เคยเห็นสภาพของคนที่กลับมาอ่านซ้ำ */
    let mi = MODES.length - 1;                       // ค่าเริ่มต้น = rich
    try {
      const v = +localStorage.getItem('tk-mapmode');
      if (Number.isInteger(v) && v >= 0 && v < MODES.length) mi = v;
    } catch {}
    const applyMode = () => {
      const st = $('#stage');
      if (!(mi >= 0 && mi < MODES.length)) mi = MODES.length - 1;
      MODES.forEach(m => m.cls && st.classList.remove(m.cls));
      if (MODES[mi].cls) st.classList.add(MODES[mi].cls);
      $('#mapmode').textContent = 'แผนที่: ' + MODES[mi].label;
      try { localStorage.setItem('tk-mapmode', mi); } catch {}
    };
    tap('#mapmode', () => { mi = (mi + 1) % MODES.length; applyMode(); });
    applyMode();

    document.addEventListener('keydown', e => {
      if (e.target.closest('#reader') && ['ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key))
        return;                                   // ปล่อยให้เลื่อนอ่านตามปกติ
      if (e.key === 'ArrowRight' || e.key === ' '){ e.preventDefault(); $('#btnNext').click(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); $('#btnPrev').click(); }
      if (e.key === 'Home')       { e.preventDefault(); scrollTo(0); }
      /* Escape = "หยุดสิ่งที่กำลังเกิดขึ้น" — คืนกล้อง *และ* หยุดการเล่นอัตโนมัติ
         ทางออกที่เดาได้ เผื่อ Play ติดขึ้นมาโดยไม่ได้ตั้งใจอีก */
      if (e.key === 'Escape')     { setPlaying(false); TK.map.resetView(900); }
    });
  }

  /* ══ วาดใหม่เมื่อตอนที่อ่านอยู่เปลี่ยน ══ */
  function render(ev){
    const b = ev.beat, i = ev.index;
    /* ⚠⚠ เก็บ **id ของฉาก** ไม่ใช่ดัชนี — ดัชนีผูกกับความยาวอาร์เรย์ ณ วันที่เก็บ
       ไม่ใช่กับความหมาย · โปรเจกต์นี้เคยโดนกับดักนี้มาแล้วครั้งหนึ่งกับ tk-mapmode
       (ดูคอมเมนต์ยาวที่ MODES) แล้วผลคือแผนที่ไม่วาดเลยทั้งหน้า
       ถ้าวันไหนมีการแทรกฉากใหม่ ดัชนีจะเลื่อนทั้งเล่ม แต่ id ไม่เลื่อน */
    try { localStorage.setItem('tk-place', b.id); } catch {}
    const chap = TK.chapters.find(c => c.n === b.chapter);

    $('#nowchap').textContent = chap ? chap.label : '';
    $('#nowyear').textContent = b.year + (b.season ? ' · ' + SEASON[b.season] : '');
    $('#counter').textContent = `${i + 1} / ${E.length}`;

    arts.forEach((a, k) => a.classList.toggle('now', k === i));

    /* สิ่งที่ฉากนี้เปลี่ยนไป — พื้นที่ที่เปลี่ยนมือ และราคาที่จ่าย
       อยู่ในตอนนั้นเลย ให้คนอ่านเห็นพร้อมข้อความ ไม่ใช่ไปเขียนทับบนแผนที่
       (ตัวเลขกำลังพลเคยลองไปเป็นป้ายบนแผนที่แล้ว — รกทันที เพราะมันคือการเล่าเรื่องเดิม
        เป็นครั้งที่สาม ต่อจากร้อยแก้วที่มักบอกอยู่แล้ว และหลอด HUD ที่ลดให้เห็นอยู่แล้ว) */
    const box = arts[i] && arts[i].querySelector('.chg');
    if (box && !box.dataset.done){
      box.dataset.done = '1';
      let html = '';

      if (b.mapDelta){
        const before = i > 0 ? E.ownersAt(i - 1) : {};
        const rows = Object.entries(b.mapDelta)
          .filter(([id, to]) => before[id] !== to)
          .map(([id, to]) => {
            const from = TK.factions[before[id]] || TK.factions.none;
            const dest = TK.factions[to];
            return `<div class="crow"><span class="cname">${TK.regions[id].label}</span>
              <span style="color:${from.text}">${from.label}</span><span class="carrow">→</span>
              <span style="color:${dest.text}">${dest.label}</span></div>`;
          });
        if (rows.length)
          html += `<div class="chead">พื้นที่เปลี่ยนมือ · ${b.year}</div>${rows.join('')}`;
      }

      /* losses อยู่ในหน่วยหมื่น (SCHEMA) — heaviest first, เพราะสิ่งที่ฉากต้องการบอก
         คือใครจ่ายแพงกว่า ไม่ใช่ลำดับ han/wei/wu ตายตัว */
      if (b.losses){
        const rows = Object.entries(b.losses)
          .sort((a, c) => c[1] - a[1])
          .map(([sd, v]) => {
            const f = TK.factions[sd];
            return `<div class="crow loss"><span class="cname"
              style="color:${f.text}">${f.label}</span>
              <span class="cnum">−${Math.round(v * 10000).toLocaleString('en-US')}</span></div>`;
          });
        if (rows.length)
          html += `<div class="chead">สูญเสียถาวร · ${b.year}</div>${rows.join('')}`;
      }

      box.innerHTML = html;
    }

    document.querySelectorAll('.tcell').forEach(c => {
      const k = +c.dataset.i;
      c.classList.toggle('done', k <  i);
      c.classList.toggle('now',  k === i);
    });
    document.querySelectorAll('.chapbtn').forEach(c =>
      c.classList.toggle('now', +c.dataset.chapter === b.chapter));
    const cur = document.querySelector('.tcell.now');
    if (cur) cur.scrollIntoView({block:'nearest', inline:'nearest'});

    /* ทั้งสามตัวเลขมาจากพื้นที่ที่ถืออยู่จริงเหมือนกันหมด — เสียดินแดนเมื่อไหร่ลดพร้อมกัน
       เดิมจำนวนเขตคำนวณสด แต่ประชากรกับทหารอ่านค่าที่ประกาศไว้เพียง 7 ฉากจาก 71
       บรรทัดเดียวจึงมีตัวเลขเรียลไทม์ปนกับตัวเลขแช่แข็ง */
    /* ⚠ หลอดต้องวัด "กำลังพล" ให้ตรงกับหัวข้อที่เขียนไว้
       เดิมหลอดวัดสัดส่วนจำนวนเขต แต่ตัวเลขข้างหลอดเป็นทหาร คนละอย่างกัน
       จึงเกิดภาพที่วุ่ยมีทหารน้อยที่สุดแต่หลอดยาวที่สุดเพราะยังถือเขตเยอะ */
    const s = ev.strength, t = ev.tally;
    const army = ['han','wei','wu'].reduce((a,k) => a + (s ? s[k].troops : 0), 0);
    ['han','wei','wu'].forEach(k => {
      const pct = army ? (s[k].troops / army * 100) : 0;
      document.querySelector(`[data-bar="${k}"]`).style.width = pct.toFixed(1) + '%';
      /* ★ ทหารเขียนเป็น "431k" ไม่ใช่ "431,000" (เจ้าของสั่ง 2026-08-27 —
         *"ใช้เป็น k ก็ได้จริงๆ เขียนเป็นแสนแล้วมันยาว"*)
         `troops` เก็บหน่วย**หมื่น** ×10 จึงได้หน่วย**พัน** แล้วเติม k
         ⚠⚠ HANDOFF §2.5 เคยเจ็บมาแล้วเรื่องนี้ — คราวนั้นคือ **ตัด k ทิ้งโดยไม่แก้ตัวคูณ**
             ได้ "130 คน" ที่แปลว่า 130,000 · คราวนี้คือทางกลับกัน (เติม k พร้อมตัวคูณ ×10)
             ทุกครั้งที่แตะบรรทัดนี้ **ต้องถ่ายภาพดู** ตัวตรวจไม่เห็นหน่วยที่หายไป */
      document.querySelector(`[data-num="${k}"]`).textContent =
        `${t[k]} เขต` + (s && s[k] && t[k]
          ? ` · ประชากร ${s[k].pop} ล้าน · ทหาร ${Math.round(s[k].troops * 10).toLocaleString('en-US')}k` : '');
    });

    /* ★★ บรรทัดแนวตะวันตก — ตัวเลขชั้นกลางที่คนอ่านไม่เคยเห็น
       หน่วยเดียวกับทุกอย่างในเรื่อง (หมื่น) ×10 เป็นพัน แล้วเติม k เหมือนบรรทัดบน */
    { const fe = $('#hfront'), fr = ev.front;
      if (!fe) { /* ยังไม่ได้สร้าง — ไม่ทำอะไร */ }
      else if (!fr) fe.style.display = 'none';
      else {
        fe.style.display = '';
        fe.innerHTML = '<span class="hfl">กำลังรบแนวตะวันตก</span>' +
          ['han','wei'].filter(k => fr[k] != null).map(k => {
            const f = TK.factions[k];
            return `<span class="hfv"><i class="hdot" style="background:${f.color}"></i>` +
                   `${Math.round(fr[k] * 10).toLocaleString('en-US')}k</span>`;
          }).join('');
      } }

    /* ★ โหมดสองเอกภพ — เก็บของฉากเก่า (ไทเมอร์+สถานะปุ่ม) ก่อน setOwners ของฉากใหม่
       แล้วถ้าฉากนี้มี mirror: โชว์ปุ่ม + เหลือบอัตโนมัติหนึ่งครั้งแรกที่เข้า
       (หลังกล้อง/ข้อความนิ่ง ~2 วิ · ค้าง 3.6 วิ · คืน — ผู้อ่านกดปุ่มดูซ้ำได้เสมอ) */
    curBeat = b;
    clearTimeout(mirrorT1); clearTimeout(mirrorT2);
    { const mb = $('#btnMirror');
      if (mb){
        mb.style.display = b.mirror ? '' : 'none';
        mb.classList.remove('on');
        if (b.mirror && !mirrorSeen.has(b.id) && ev.how !== 'scrub'){
          mirrorSeen.add(b.id);
          mirrorT1 = setTimeout(() => {
            if (curBeat !== b) return;
            if (TK.map.showMirror(b.mirror)){
              mb.classList.add('on');
              mirrorT2 = setTimeout(() => {
                if (curBeat !== b) return;
                TK.map.hideMirror(); mb.classList.remove('on');
              }, 3600);
            }
          }, 2200);
        }
      }
    }

    const scrub = ev.how === 'scrub';
    /* ★★ 2026-08-28 (เจ้าของทัก c8-09/c8-13: "เปลี่ยนสีตอนที่ทัพเดินไปถึงจะดีกว่า")
       ฉากที่ทั้งพลิกธงและมีการเดินทัพ = พักการทาสีไว้ก่อน ให้ลูกศรเป็นคนปล่อย
       (กลไกอยู่ที่ setOwners/flushOwners ใน strategic.js) · scrub กับ init ไม่พัก
       เพราะไม่มีแอนิเมชันให้รอ และการหน่วงตอนลากแถบเวลาคือความหน่วงเปล่า ๆ */
    const flipHold = (!scrub && ev.how !== 'init' && b.mapDelta &&
                      (b.markers || []).some(m => m.type === 'arrow'))
      ? new Set(Object.keys(b.mapDelta)) : null;
    TK.map.setOwners(ev.owners, flipHold);
    TK.map.setFocus(b);

    /* ══ กล้องกับ marker — ต่างกันสองโหมด ══
       ปกติ: กล้องของฉาก + marker ของฉาก
       โหมดฤดู: กรอบที่กินทุกฉากในฤดูนั้น + marker ของฉากนี้เต็มสี + ของฉากอื่นเป็น echo
       ลำดับ echo มาก่อนเสมอ เพื่อให้ของฉากปัจจุบันวาดทับ และ layoutAnnotations
       จัดที่ให้คำบรรยายของฉากปัจจุบันก่อน (echo ไม่จองที่เลย) */
    const { sibs, marks, camBox } = compose(i);

    TK.map.flyTo(camBox || b.camera, ev.how === 'init' ? 0 : scrub ? 320 : 1000);
    TK.map.setMarkers(marks, ev.how !== 'init' && !scrub);
    paintSeasonNote(b, sibs);
  }

  /* marker + กรอบกล้องของฉากที่ i ตามโหมดที่เปิดอยู่
     แยกออกมาเป็นฟังก์ชันเพราะ tools\shot.ps1 ต้องเรียกใช้ด้วย — ไม่งั้นภาพตรวจงาน
     จะวาด marker ของฉากเดียวเสมอ และโหมดฤดูก็จะไม่มีทางถูกตรวจด้วยตาเลย
     (บทเรียนเดิมจากรอบที่แล้ว: เครื่องมือตรวจที่วาดคนละอย่างกับของจริงคือเครื่องมือที่โกหก) */
  function compose(i){
    const b = E.beats[i];
    const grp  = groupOf(i);
    const sibs = seasonOn ? grp.filter(k => k !== i) : [];
    /* ⚠ ห้ามตั้งชื่อตัวแปรนี้ว่า `box` ในสโคปของ render() — ชื่อนั้นถูกใช้ไปแล้วสำหรับกล่อง
       .chg ของคอลัมน์นิยาย และ const ซ้ำสโคปคือ SyntaxError ที่ทำให้ทั้งหน้าไม่โหลด */
    const camBox = sibs.length ? seasonBox(grp) : null;
    const marks  = sibs.length
      ? [...sibs.flatMap(k => (E.beats[k].markers || []).map(m => ({...m, echo:true}))),
         ...(b.markers || [])]
      : b.markers;
    return { sibs, marks, camBox };
  }

  /* ══ ป้ายบอกว่ากำลังดูทั้งฤดู ══ */
  function paintSeasonNote(b, sibs){
    const el = $('#seasonnote');
    el.classList.toggle('on', seasonOn);
    /* ★ ปุ่มหรี่ลงเมื่อฉากนี้ไม่มีเพื่อนจริง ๆ — ไม่งั้นมันดูเหมือนปุ่มเสีย
       ซึ่งเป็นสิ่งที่เจ้าของเจอ: กดแล้วไม่มีอะไรเกิดขึ้นในภาค IV/V เกือบทั้งภาค */
    $('#btnSeason').disabled = groupOf(E.index).length < 2;
    if (!seasonOn) return;
    /* ป้ายต้องบอกความจริงว่ากำลังจัดกลุ่มด้วยอะไร — ฤดู หรือถอยมาทั้งปีแล้ว */
    const sameSeason = (seasonMap.get(seasonKey(b)) || []).length > 1;
    const when = b.year + (sameSeason && b.season ? ' · ' + SEASON[b.season] : '');
    const span = sameSeason ? 'ฤดู' : 'ปี';
    el.innerHTML = sibs.length
      ? `<b>${when}</b> — <i>และอีก ${sibs.length} ฉากใน${span}เดียวกัน</i>`
      : `<b>${when}</b> — <i>ปีนี้ไม่มีเหตุการณ์อื่น</i>`;
  }

  return { init, scrollTo, pickCurrent, compose };
})();
