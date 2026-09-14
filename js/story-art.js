/* การอ่านภาพ: เครื่องมืออยู่ใน reader ใช้ฉาก/เส้น/กำลังพลจริงทั้งหมด */
window.TK=window.TK||{};
TK.storyArt=(()=>{
  const h=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e;};
  let selectedRoute=null,compare=false,signalTimer;
  const pair=['c11-06','c11-10'],camera=TK.timeline.find(b=>b.id==='c11-06').camera;
  function focusRoute(id){
    selectedRoute=id||null;
    document.querySelectorAll('#L-markers>[data-route],#L-people>[data-route]').forEach(e=>e.classList.toggle('route-muted',!!id&&e.dataset.route!==id));
    document.querySelectorAll('.art-route-choice').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.route===(id||''))));
  }
  function ensureScene(beat){if(TK.engine.beat.id!==beat.id){const i=TK.timeline.indexOf(beat);TK.ui.scrollTo(i);TK.engine.goTo(i,'init');}}
  function labelFor(beat,m){const labels=TK.sceneArt?.[beat?.id]?.labels||{};return labels[m.place+':'+m.side]||labels[m.place]||m.label;}
  function vehicle(parent,m){
    const NS='http://www.w3.org/2000/svg',mk=(tag,a)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);return e;};
    const g=mk('g',{class:m.fleet?'art-vessel':'art-wagon','data-art-layer':'vehicle'});
    if(m.fleet)g.append(mk('path',{d:'M-12 3H12L7 8H-7ZM0 3V-12L9 0H1M-2-10L-9 0H-2',fill:'#cbbb96',stroke:'#574933','stroke-width':1.2}),mk('path',{d:'M-13 11Q-8 9-3 11T8 11',fill:'none',stroke:'#edf0d6','stroke-width':1.3}));
    else g.append(mk('path',{d:'M-9 2H9L7 6H-7ZM-7 1V-5Q-3-9 0-5V1M0 1V-6Q4-10 7-6V1M9 3L14 0',fill:'#ccb48a',stroke:'#5b4a33','stroke-width':1.2}),mk('circle',{cx:-5,cy:7,r:2.6,fill:'#625138',stroke:'#eee0ba','stroke-width':.8}),mk('circle',{cx:6,cy:7,r:2.6,fill:'#625138',stroke:'#eee0ba','stroke-width':.8}));
    parent.append(g);
  }
  function controls(beat){
    const config=TK.sceneArt?.[beat.id]||{},root=h('div','story-art-controls');root.dataset.scene=beat.id;
    // ป้ายเต็มเก็บข้างร้อยแก้ว เลือกอ่านได้โดยไม่ทับแผนที่
    const notes=(beat.markers||[]).filter(m=>m.type==='pin'&&labelFor(beat,m)!==m.label);
    if(notes.length){const details=h('details','art-map-notes');details.append(h('summary','','รายละเอียดป้ายบนแผนที่'));for(const m of notes)details.append(h('p','',TK.places[m.place].label+' — '+m.label+(m.strength?' · '+m.strength.toLocaleString('en-US')+' คน':'')));root.append(details);}
    if(config.signals){const b=h('button','art-action','ดูการส่งข่าวตามโซ่ป้อม');b.type='button';b.onclick=()=>{ensureScene(beat);TK.worksArt.signal(config.signals);};root.append(b);}
    if(config.works||config.signals){const b=h('button','art-action','ดูแนวป้อมใกล้ ๆ');b.type='button';b.onclick=()=>{ensureScene(beat);TK.worksArt.focus(config.works||config.signals);};root.append(b);}
    if(config.supply){
      const box=h('section','art-supply');box.setAttribute('aria-label','ข้าวสิบกระสอบออกเดินทาง ถึงแนวหน้าสามกระสอบ ตามเนื้อเรื่อง');box.append(h('h3','','ข้าวที่ถึงแนวหน้า'));
      const sacks=h('div','art-grain');for(let i=0;i<10;i++){const sack=h('span','grain-sack'+(i>=3?' grain-spent':''));sack.setAttribute('aria-hidden','true');sacks.append(sack);}box.append(sacks,h('p','','ออก 10 → ถึง 3 กระสอบ'),h('small','','อีก 7 ถูกใช้ระหว่างขนส่ง ตามอัตราส่วนในฉาก'));
      const b=h('button','art-action','เน้นเส้นทางข้าว');b.type='button';b.onclick=()=>{ensureScene(beat);focusRoute(selectedRoute===config.supply.route?null:config.supply.route);};box.append(b);root.append(box);
    }
    const routes=(beat.markers||[]).filter(m=>(m.type==='arrow'&&!m.supply)||(m.type==='pin'&&config.focusPins?.includes(m.place)));
    if(routes.length>=3){const detail=h('details','art-route-picker');detail.append(h('summary','','เลือกดูกองทัพ · '+routes.length+' เส้นทาง'));const choices=h('div','art-route-options');
      const all=h('button','art-action art-route-choice','เห็นทุกกอง');all.type='button';all.dataset.route='';all.setAttribute('aria-pressed','true');all.onclick=()=>{ensureScene(beat);focusRoute(null);};choices.append(all);
      for(const m of routes){const route=m.route||'station:'+m.place+':'+m.side,name=TK.people[m.who]?.label||m.name?.split(' — ')[0]||(m.type==='pin'?labelFor(beat,m):'กองทัพ');const b=h('button','art-action art-route-choice',name+(m.strength?' · '+m.strength.toLocaleString('en-US'):''));b.type='button';b.dataset.route=route;b.setAttribute('aria-pressed','false');b.onclick=()=>{ensureScene(beat);focusRoute(selectedRoute===route?null:route);};choices.append(b);}detail.append(choices);root.append(detail);
    }
    if(config.compare){const box=h('section','art-compare');box.append(h('h3','','เส้นทางเดิม ต่างกันที่คนเฝ้า'));for(const [id,text]of [['c11-06','270 · ลู่ค่างยังรักษาแนว'],['c11-10','274 · หลังลู่ค่างเสียชีวิต']]){const b=h('button','art-action',text);b.type='button';b.dataset.compare=id;b.setAttribute('aria-pressed',String(beat.id===id));b.onclick=()=>{compare=true;ensureScene(TK.timeline.find(s=>s.id===id));TK.map.flyTo(camera,0);};box.append(b);}const exit=h('button','art-action','คืนมุมฉาก');exit.type='button';exit.onclick=()=>{compare=false;TK.map.flyTo(TK.engine.beat.camera,0);};box.append(exit);root.append(box);}
    root.addEventListener('keydown',e=>{if(e.target.closest('button,summary')&&[' ','Enter','ArrowLeft','ArrowRight'].includes(e.key))e.stopPropagation();});
    return root.children.length?root:null;
  }
  function init(){
    document.querySelectorAll('#reader article.beat').forEach(article=>{const b=TK.timeline[Number(article.dataset.i)],node=controls(b);if(node)article.querySelector('.text').after(node);});
    TK.engine.on('beat',ev=>{focusRoute(null);clearTimeout(signalTimer);if(compare&&pair.includes(ev.beat.id))TK.map.flyTo(camera,0);else compare=false;
      const signals=TK.sceneArt?.[ev.beat.id]?.signals;if(signals&&ev.how!=='init')signalTimer=setTimeout(()=>{if(TK.engine.beat.id===ev.beat.id&&!document.body.classList.contains('studio-gallery'))TK.worksArt.signal(signals);},1150);
    });
  }
  return{init,labelFor,vehicle,focusRoute,clear:()=>focusRoute(null)};
})();
