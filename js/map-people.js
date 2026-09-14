/* ภาพผู้เดินทางจาก marker และคนในเมืองจาก scene_people ซึ่งระบุเป็นรายฉาก */
window.TK=window.TK||{};
TK.mapPeople=(()=>{
  const NS='http://www.w3.org/2000/svg';
  const el=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
  const html=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e;};
  const colors={han:'#56745c',wei:'#607a91',wu:'#a36954'};
  let serial=0,selected=null,card=null;
  const imagePath=(id,size=128)=>'assets/avatars/map/'+size+'/'+id+'.png';
  function close(restore=false){TK.storyArt?.clear();const previous=selected;if(previous){previous.classList.remove('chosen');previous.setAttribute('aria-pressed','false');}selected=null;if(card)card.hidden=true;if(restore){if(previous?.isConnected)previous.focus();TK.map.relayout();}}
  function show(g,m){
    if(selected===g){close(true);return;}close();selected=g;g.classList.add('chosen');g.setAttribute('aria-pressed','true');
    if(!card){card=html('section','map-person-card');card.id='map-person-card';card.setAttribute('aria-label','รายละเอียดบนแผนที่');document.querySelector('#stage').append(card);card.addEventListener('pointerdown',e=>e.stopPropagation());card.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});card.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close(true);}});}
    card.replaceChildren();card.hidden=false;
    const dismiss=html('button','map-person-close','×');dismiss.type='button';dismiss.setAttribute('aria-label','ปิดรายละเอียด');dismiss.onclick=()=>close(true);card.append(dismiss);
    const who=TK.people[m.who],title=html('h3','',who?who.label:m.name||TK.places[m.place]?.label||'เหตุการณ์ในฉาก');
    if(who){const pic=html('img','map-person-face');pic.src=imagePath(m.who,256);pic.alt=who.label;pic.onerror=()=>pic.hidden=true;card.append(pic);}
    card.append(title);
    const facts=[];
    if(m.side&&TK.factions[m.side])facts.push(TK.factions[m.side].label);
    if(m.strength)facts.push(m.strength.toLocaleString('th-TH')+' คน');
    if(m.retreat)facts.push('ถอยทัพ');else if(m.fleet)facts.push('กองเรือ');else if(m.type==='arrow')facts.push(m.strength?'เดินทัพ':'เดินทาง');
    if(facts.length)card.append(html('p','map-person-meta',facts.join(' · ')));
    const route=TK.routeMeta?.[m.route]?.path;
    if(route?.length){const ids=m.reverse?route.slice().reverse():route;card.append(html('p','',TK.places[ids[0]].label+' → '+TK.places[ids.at(-1)].label));}
    if(m.place&&TK.places[m.place])card.append(html('p','map-person-meta','อยู่ที่'+TK.places[m.place].label));
    if(m.role)card.append(html('p','map-person-event',m.role));
    if(m.label)card.append(html('p','map-person-event',m.label));
    const hint=html('small','','รายละเอียดและลำดับเหตุการณ์อยู่ในเนื้อเรื่อง');card.append(hint);
    TK.map.relayout();
    if(m.route)TK.storyArt?.focusRoute(m.route);
  }
  function interactive(g,m){g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-pressed','false');g.setAttribute('aria-label',[TK.people[m.who]?.label||TK.places[m.place]?.label,m.label,m.strength?m.strength.toLocaleString('th-TH')+' คน':null,'เปิดรายละเอียด'].filter(Boolean).join(' · '));const title=el('title');title.textContent=g.getAttribute('aria-label');g.append(title);g.addEventListener('click',e=>{e.stopPropagation();show(g,m);});g.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();show(g,m);}if(e.key==='Escape'){e.stopPropagation();close(true);}});}
  function portrait(parent,shell,m){
    const {g,gi:container}=shell(parent,'mk-chip mk-portrait'),gi=el('g');container.append(gi);g.dataset.who=m.who;g.dataset.route=m.route||'';g.dataset.place=m.place||'';
    const clipId='portrait-clip-'+(++serial),defs=el('defs'),clip=el('clipPath',{id:clipId});clip.append(el('circle',{cx:0,cy:-6,r:21}));defs.append(clip);gi.append(defs);
    gi.append(el('circle',{cx:0,cy:-6,r:23,class:'map-portrait-rim',fill:'#d9ceb0',stroke:colors[m.side]||'#8d7950','stroke-width':2.5}));
    const pic=el('image',{href:imagePath(m.who,256),x:-21,y:-27,width:42,height:42,preserveAspectRatio:'xMidYMid meet','clip-path':'url(#'+clipId+')'});gi.append(pic);
    pic.addEventListener('error',()=>{pic.remove();const fallback=el('text',{x:0,y:0,'text-anchor':'middle',class:'map-portrait-fallback'});fallback.textContent=TK.people[m.who].label;gi.append(fallback);});
    const tag=m.retreat?'ถอย':m.strength?m.strength.toLocaleString('en-US'):null;
    let pillWidth=44;
    if(tag){
      const t=el('text',{x:0,y:30,'text-anchor':'middle',class:'map-portrait-count'});t.textContent=tag;gi.append(t);
      // วัดตัวเลขจริงก่อนขยายพื้นป้ายและกล่องหลบ ไม่ลดขนาดอักษรเมื่อจำนวนมากขึ้น
      pillWidth=Math.max(44,t.getComputedTextLength()+12);
      gi.insertBefore(el('rect',{x:-pillWidth/2,y:18,width:pillWidth,height:16,rx:7,class:'map-portrait-count-bg'}),t);
    }
    function reflow(){const mobile=document.querySelector('#stage').clientWidth<600,chosen=g.classList.contains('chosen'),diameter=mobile?(chosen?64:56):(chosen?76:64),scale=diameter/46;gi.setAttribute('transform','scale('+scale+')');g.dataset.diameter=diameter;return{w:Math.max(50,pillWidth+6)*scale,h:70*scale};}
    interactive(g,m);return{g,...reflow(),reflow};
  }
  function moving(parent,m){const id='portrait-clip-'+(++serial),defs=el('defs'),clip=el('clipPath',{id}),art=el('g',{transform:'scale('+(document.querySelector('#stage').clientWidth<600?1.12:1.3)+')'});clip.append(el('circle',{r:15}));defs.append(clip);art.append(defs,el('circle',{r:17,fill:'#d9ceb0',stroke:colors[m.side]||'#8d7950','stroke-width':2}),el('image',{href:imagePath(m.who),x:-15,y:-15,width:30,height:30,preserveAspectRatio:'xMidYMid meet','clip-path':'url(#'+id+')'}));parent.append(art);}
  function castRow(beat){
    const cast=TK.scenePeople?.[beat.id];if(!cast?.length)return null;
    const row=html('section','scene-cast'),title=html('h3','scene-cast-title','คนในฉาก'),list=html('div','scene-cast-list'),detail=html('p','scene-cast-role');
    row.dataset.scene=beat.id;row.setAttribute('aria-label','คนในฉาก '+beat.title);
    detail.id='scene-cast-role-'+beat.id;detail.hidden=true;detail.setAttribute('aria-live','polite');
    let more=null;
    if(cast.length>3){more=html('details','scene-cast-more');more.append(html('summary','','อีก '+(cast.length-2)+' คน'));}
    for(const [index,m] of cast.entries()){
      const who=TK.people[m.who],button=html('button','scene-cast-person'),pic=html('img','');
      button.type='button';button.dataset.who=m.who;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',detail.id);
      pic.src=imagePath(m.who);pic.alt='';pic.width=48;pic.height=48;pic.loading='lazy';pic.onerror=()=>pic.hidden=true;
      button.append(pic,html('span','',who.label));
      button.addEventListener('keydown',e=>{if(['Enter',' ','ArrowLeft','ArrowRight','Escape'].includes(e.key))e.stopPropagation();});
      button.addEventListener('click',e=>{e.stopPropagation();const open=button.getAttribute('aria-expanded')!=='true';for(const b of list.querySelectorAll('button'))b.setAttribute('aria-expanded','false');button.setAttribute('aria-expanded',String(open));detail.hidden=!open;detail.textContent=who.label+' — '+m.role;});
      if(more&&index>=2)more.append(button);else list.append(button);
    }
    if(more)list.append(more);
    row.addEventListener('keydown',e=>{if(e.target.tagName==='SUMMARY'&&[' ','Enter','ArrowLeft','ArrowRight'].includes(e.key))e.stopPropagation();});
    row.append(title,list,detail);return row;
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected){e.preventDefault();e.stopImmediatePropagation();close(true);}});
  return{portrait,moving,castRow,inspect:show,clear:()=>close(),get selected(){return selected?.dataset.who||null;}};
})();
