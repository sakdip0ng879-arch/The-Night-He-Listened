/* ตัวอย่างการจัดหน้าบน engine จริง เปิดด้วย ?ui=studio ไม่เปลี่ยนหน้าปกติ */
(() => {
 if(new URLSearchParams(location.search).get('ui')==='classic')return;
 document.body.classList.add('ui-studio');
 const initialScene=TK.timeline.findIndex(b=>b.id===location.hash.slice(1));
 const $=s=>document.querySelector(s), make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e;};
 const dock=make('header','studio-dock');
 const brand=make('div','studio-brand','THE NIGHT HE LISTENED');
 const mode=make('span','studio-mode','แผนที่ประกอบพงศาวดาร');brand.append(mode);dock.append(brand);
 dock.append($('#maptools'));document.body.prepend(dock);
 const side=$('aside'),where=$('#where'),hud=$('#hud');
 const context=make('section','studio-context');context.append(where,hud);side.insertBefore(context,$('#reader'));
 const finder=make('section','studio-finder');
 const label=make('label','','ค้นหาเมืองและสถานที่');label.htmlFor='city-search';
 const input=make('input','');input.id='city-search';input.placeholder='ชื่อไทย / อังกฤษ';input.type='search';input.autocomplete='off';
 const result=make('div','studio-results');result.hidden=true;
 const hint=make('small','','หมุดย่อเมื่อซูมออก · ชี้หรือแตะเพื่อดูชื่อ');
 finder.append(label,input,result,hint);context.prepend(finder);
 const returnButton=make('button','studio-return','กลับสู่ฉากที่อ่าน');returnButton.hidden=true;
 returnButton.onclick=()=>{document.querySelector('#placecard').hidden=true;TK.engine.goTo(TK.engine.index,'jump');returnButton.hidden=true;};context.append(returnButton);
 const render=()=>{
   result.replaceChildren();const q=input.value.trim().toLocaleLowerCase();result.hidden=!q;if(!q)return;
   const matches=Object.entries(TK.places).filter(([id,p])=>TK.map.isPlaceActive(id)).filter(([id,p])=>[id,p.label,p.py,p.map].some(s=>String(s||'').toLocaleLowerCase().includes(q)));
   const count=make('small','',`${matches.length} สถานที่`);result.append(count);
   for(const [id,p] of matches.slice(0,15)){
     const b=make('button','',`${p.label}${p.chk?' · รอตรวจตำแหน่ง':''}`);
     b.onclick=()=>{TK.map.flyTo([p.x-280,p.y-220,560,440],700);document.querySelector(`#L-pins [data-id="${id}"]`)?.dispatchEvent(new MouseEvent('click',{bubbles:true}));result.hidden=true;returnButton.hidden=false;};result.append(b);
   }
   if(matches.length>15)result.append(make('small','','พิมพ์เพิ่มเพื่อจำกัดผลค้นหา'));
 };
 input.addEventListener('input',render);input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){result.hidden=true;input.blur();}if(e.key==='Enter')result.querySelector('button')?.click();});
 const card=$('#placecard');side.insertBefore(card,$('#reader'));
 TK.engine.on('beat',render);
 const legend=$('#legend');side.insertBefore(legend,$('#reader'));
 const contextToggle=make('button','studio-context-toggle','ค้นหา / กำลังพล');contextToggle.id='studio-context-toggle';context.id='studio-context';contextToggle.setAttribute('aria-controls',context.id);contextToggle.setAttribute('aria-expanded','false');
 contextToggle.onclick=()=>{const open=document.body.classList.toggle('studio-context-open');contextToggle.setAttribute('aria-expanded',String(open));if(open)input.focus();};$('#maptools').prepend(contextToggle);
 const readerToggle=make('button','','ขยายแผนที่');readerToggle.id='studio-expand';readerToggle.setAttribute('aria-expanded','false');
 readerToggle.onclick=()=>{const on=document.body.classList.toggle('studio-map-only');readerToggle.textContent=on?'กลับมาอ่านเรื่อง':'ขยายแผนที่';readerToggle.setAttribute('aria-expanded',String(on));window.dispatchEvent(new Event('resize'));};$('#maptools').prepend(readerToggle);
 const openingCover=!!$('#intro')||new URLSearchParams(location.search).get('view')==='cover';
 const gallery=make('section','studio-gallery-controls'),cover=make('div','studio-cover-title');
 cover.append(make('small','','THE NIGHT HE LISTENED'),make('h1','','ถ้าหลิวเป้ยฟังคำทัดทานของจ้าวหยุน'),make('p','',`แผ่นดินก่อนเรื่องราวเริ่มต้น · ค.ศ. ${TK.timeline[0].year}`));
 const read=make('button','','เริ่มอ่านเรื่อง'),back=make('button','','กลับหน้าที่อ่าน'),names=make('button','','เมืองและมณฑล'),title=make('button','','ซ่อนชื่อปก');
 const heading=cover.querySelector('h1');heading.replaceChildren(...['ถ้าหลิวเป้ย','ฟังคำทัดทาน','ของจ้าวหยุน'].map(t=>make('span','',t)));cover.append(read);gallery.append(back,names,title);document.body.append(cover,gallery);const credit=$('.credit').cloneNode(true);credit.className='studio-gallery-credit';document.body.append(credit);
 let savedScene=0,savedCamera=null;
 const leaveGallery=start=>{document.body.classList.remove('studio-gallery','gallery-names','gallery-no-title');const n=start?0:savedScene;window.dispatchEvent(new Event('resize'));TK.ui.scrollTo(n);TK.engine.goTo(n,'init');if(!start&&savedCamera)TK.map.flyTo([savedCamera.x,savedCamera.y,savedCamera.w,savedCamera.h],0);};
 const showGallery=()=>{if($('#btnPlay')?.classList.contains('on'))$('#btnPlay').click();names.setAttribute('aria-pressed','false');title.textContent='ซ่อนชื่อปก';savedScene=TK.engine.index;savedCamera=TK.map.viewBox;$('#intro')?.remove();document.body.classList.remove('studio-map-only');document.body.classList.add('studio-gallery');TK.ui.scrollTo(0);TK.engine.goTo(0,'init');window.dispatchEvent(new Event('resize'));TK.map.flyTo([0,0,1650,1950],0);};
 read.onclick=()=>leaveGallery(true);back.onclick=()=>leaveGallery(false);
 names.setAttribute('aria-pressed','false');names.onclick=()=>{const on=document.body.classList.toggle('gallery-names');names.setAttribute('aria-pressed',String(on));TK.map.relayout();};
 title.onclick=()=>{const off=document.body.classList.toggle('gallery-no-title');title.textContent=off?'แสดงชื่อปก':'ซ่อนชื่อปก';};
 document.addEventListener('keydown',e=>{if(!document.body.classList.contains('studio-gallery'))return;if(['ArrowLeft','ArrowRight',' ','Escape'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')leaveGallery(false);}},true);
 const galleryButton=make('button','','ชมแผนที่ / ปก');galleryButton.id='studio-gallery';galleryButton.onclick=showGallery;$('#maptools').prepend(galleryButton);
 /* เครื่องมือรองพับรวมกัน คืนพื้นที่อ่านและไม่เพิ่มแถวปุ่มบนมือถือ */
 const toolsMenu=make('details','art-tools-menu'),toolsTitle=make('summary','','เครื่องมือ'),toolsPanel=make('div','art-tools-panel');toolsMenu.id='art-tools-menu';toolsMenu.append(toolsTitle,toolsPanel);
 for(const id of ['studio-context-toggle','btnSpine','btnSeason','btnRoads','btnLegend','btnBase','btnIntro']){const b=$('#'+id);if(b)toolsPanel.append(b);}
 toolsPanel.addEventListener('click',e=>{if(e.target.closest('button')){toolsMenu.open=false;window.dispatchEvent(new Event('resize'));}});
 toolsMenu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();toolsMenu.open=false;toolsTitle.focus();}});
 document.addEventListener('pointerdown',e=>{if(!toolsMenu.contains(e.target))toolsMenu.open=false;});$('#maptools').append(toolsMenu);
 window.dispatchEvent(new Event('resize'));
 requestAnimationFrame(()=>{
   const n=initialScene>=0?initialScene:TK.engine.index;
   TK.ui.scrollTo(n);
   /* การจัด dock เปลี่ยนกรอบและยกเลิกกล้องที่ init เดิมกำลังบินอยู่
      ต้องจัดกล้องฉากซ้ำ แม้ index จะตรงอยู่แล้ว */
   TK.engine.goTo(n,'init');
   if(openingCover)showGallery();
 });
})();
