/* ตรวจ UI บน Chrome จริง: node tools/audit_ui.js [ชื่อรอบ] [--scenes] */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'), run=process.argv[2]||'baseline';
const out=path.join(__dirname,'_ui-audit',run);fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless','--no-first-run','--no-default-browser-check','--hide-scrollbars',
 '--remote-debugging-port=9335','--window-size=1904,980',
 '--user-data-dir='+path.join(require('os').tmpdir(),'tk-ui-'+Date.now()),
 (process.argv.includes('--file')?require('url').pathToFileURL(path.join(root,'index.html')).href:'http://localhost:8778/index.html')+'?intro=0'+(run.includes('studio')?'&ui=studio':'')+(run.includes('svg')?'&renderer=svg':'')
 ],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
 let target;
 for(let i=0;i<60&&!target;i++){await wait(250);try{target=(await(await fetch('http://localhost:9335/json')).json()).find(t=>t.type==='page');}catch{}}
 if(!target)throw Error('Chrome unavailable');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
 let id=0;const pending=new Map(),errors=[],trace=[];let traceDone=false;
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Tracing.dataCollected')trace.push(...m.params.value);if(m.method==='Tracing.tracingComplete')traceDone=true;});
 const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description);return m.result?.result?.value;};
 await send('Runtime.enable');await send('Page.enable');await send('Performance.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1904,height:980,deviceScaleFactor:1,mobile:false});await wait(3500);
 await ev("localStorage.clear();TK.engine.goTo(0,'init')");await wait(800);
 if(process.argv.includes('--bake')){
   for(const name of ['environment','relief']){
     const png=await ev(`new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=1650;c.height=1950;c.getContext('2d').drawImage(img,0,0,1650,1950);resolve(c.toDataURL('image/png').split(',')[1]);};img.onerror=()=>reject(Error('cache SVG failed'));img.src='assets/map-art/cache/${name}.svg';})`);
     fs.writeFileSync(path.join(root,'assets/map-art/cache',name+'.png'),Buffer.from(png,'base64'));console.log('Rendered',name);
   }
 }
 if(run.includes('nofilters')) await ev(`(()=>{const s=document.createElement('style');s.textContent='#stage *{filter:none!important;backdrop-filter:none!important}';document.head.append(s)})()`);
 if(run.includes('noanim')) await ev(`(()=>{const s=document.createElement('style');s.textContent='#tkmap *{animation:none!important;transition:none!important}';document.head.append(s)})()`);
 if(run.includes('novector')) await ev(`(()=>{const s=document.createElement('style');s.textContent='#tkmap .zline,#tkmap .zline-case{vector-effect:none}';document.head.append(s)})()`);
 if(run.includes('htmlcamera')) await ev(`(()=>{const svg=document.querySelector('#tkmap'),wrap=document.createElement('div');wrap.style.cssText='position:absolute;inset:0;transform-origin:0 0;will-change:transform;';svg.before(wrap);wrap.append(svg);svg.style.willChange='auto';Object.defineProperty(svg.style,'transform',{get(){return wrap.style.transform},set(v){wrap.style.transform=v}});})()`);
 if(run.includes('composite')) await ev(`(()=>{const cam=document.getElementById('L-cam'),svg=document.getElementById('tkmap'),host=document.getElementById('stage');const set=cam.setAttribute.bind(cam),remove=cam.removeAttribute.bind(cam);svg.style.transformOrigin='0 0';svg.style.willChange='transform';svg.style.overflow='visible';cam.setAttribute=(name,value)=>{if(name!=='transform')return set(name,value);const [tx,ty,s]=value.match(/-?[0-9.]+/g).map(Number),b=svg.viewBox.baseVal,k=Math.min(host.clientWidth/b.width,host.clientHeight/b.height),ox=(host.clientWidth-k*b.width)/2,oy=(host.clientHeight-k*b.height)/2;svg.style.transform='translate3d('+(k*(tx+(s-1)*b.x)+(1-s)*ox)+'px,'+(k*(ty+(s-1)*b.y)+(1-s)*oy)+'px,0) scale('+s+')';};cam.removeAttribute=name=>{if(name==='transform')svg.style.transform='';return remove(name)};})()`);
 const saveShot=async name=>{const m=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(m.result.data,'base64'));};
 const start=()=>ev(`window.__frames=[];window.__record=true;window.__last=performance.now();requestAnimationFrame(function tick(t){if(!window.__record)return;__frames.push(t-__last);__last=t;requestAnimationFrame(tick);})`);
 const stop=()=>ev(`window.__record=false;(()=>{const a=__frames.filter(x=>x>0).sort((a,b)=>a-b);return {frames:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],over50:a.filter(x=>x>50).length};})()`);
 const bench=[];
 if(process.argv.includes('--trace'))await send('Tracing.start',{categories:'devtools.timeline,blink,cc,gpu',transferMode:'ReportEvents'});
 for(let round=0;round<(process.argv.includes('--smoke')?0:2);round++){
 await ev("TK.engine.goTo(0,'init')");await wait(600);await start();
 const b=await ev("(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.6}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...b,button:'left',clickCount:1});
 for(let k=1;k<=30;k++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:b.x+k*5,y:b.y+k,button:'left',buttons:1});await wait(16);}
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:b.x+150,y:b.y+30,button:'left',clickCount:1});await wait(100);bench.push({action:'drag',round,...await stop()});
 await wait(400);await start();const scriptMS=await ev("(()=>{const t=performance.now();TK.engine.goTo(TK.timeline.findIndex(b=>b.id==='c4-10'),'next');return performance.now()-t})()");await wait(1600);bench.push({action:'scene',round,scriptMS,...await stop()});
 }
 if(process.argv.includes('--trace')){await send('Tracing.end');for(let n=0;n<500&&!traceDone;n++)await wait(10);fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify({traceEvents:trace}));const sums={};for(const e of trace)if(e.ph==='X'&&e.dur){const s=sums[e.name]||(sums[e.name]={count:0,total:0,max:0});s.count++;s.total+=e.dur/1000;s.max=Math.max(s.max,e.dur/1000);}console.log('TRACE',JSON.stringify(Object.entries(sums).sort((a,b)=>b[1].total-a[1].total).slice(0,22)));}
 await ev('TK.ui.scrollTo(TK.engine.index)');await wait(100);await saveShot('scene-c4-10');
 const records=[];
 const interactions=[];
 if(run.includes('studio')){
   const click=async selector=>{const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
   await ev("TK.ui.scrollTo(TK.timeline.findIndex(b=>b.id==='c7-11'))");await wait(1400);
   interactions.push({check:'scene destination',pass:await ev("TK.engine.beat.id==='c7-11'")});
   await click('#city-search');await send('Input.insertText',{text:'เฉิงตู'});await wait(100);
   interactions.push({check:'search',pass:await ev("document.querySelector('.studio-results button')?.textContent==='เฉิงตู'")});
   await click('.studio-results button');await wait(1000);
   interactions.push({check:'place card',pass:await ev("!document.querySelector('#placecard').hidden && document.querySelector('#placecard h3').textContent==='เฉิงตู'")});
   await click('.studio-return');await wait(1200);
   interactions.push({check:'no army control panel',pass:await ev("!document.querySelector('.studio-briefing')")});
   interactions.push({check:'legacy animated circles hidden',pass:await ev("[...document.querySelectorAll('.mk-halo,.mk-clash-ring')].every(e=>getComputedStyle(e).display==='none')")});
   await ev('TK.map.setMarkers(TK.engine.beat.markers,false,TK.engine.beat.mapDelta);TK.map.relayout()');await wait(100);await saveShot('art-c7-11');
   await click('#studio-gallery');await wait(500);await saveShot('cover');
   interactions.push({check:'opening map gallery',pass:await ev("document.body.classList.contains('studio-gallery')&&TK.engine.index===0&&getComputedStyle(document.querySelector('aside')).display==='none'&&getComputedStyle(document.querySelector('#L-markers')).display==='none'")});
   const coverPoint=await ev("(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x+r.width*.6,y:r.y+r.height*.55}})()");
   await send('Input.dispatchMouseEvent',{type:'mouseWheel',...coverPoint,deltaX:0,deltaY:-80});await wait(350);
   const coverBefore=await ev('({...TK.map.viewBox})');
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...coverPoint,button:'left',clickCount:1});
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',...coverPoint,button:'left',clickCount:1});await wait(400);
   const coverAfter=await ev('({...TK.map.viewBox})');
   interactions.push({check:'cover zoom then release preserves centered negative origin',pass:coverBefore.x<0&&Math.abs(coverBefore.x-coverAfter.x)<1&&Math.abs(coverBefore.y-coverAfter.y)<1,before:coverBefore,after:coverAfter});
   await click('.studio-gallery-controls button:nth-child(2)');await wait(100);
   interactions.push({check:'gallery labels toggle',pass:await ev("document.body.classList.contains('gallery-names')")});
   await click('.studio-gallery-controls button');await wait(100);
   interactions.push({check:'gallery restores scene',pass:await ev("!document.body.classList.contains('studio-gallery')&&TK.engine.beat.id==='c7-11'")});
   await click('#studio-expand');await wait(250);
   interactions.push({check:'expand map',pass:await ev("getComputedStyle(document.querySelector('aside')).display==='none'")});await click('#studio-expand');await wait(250);
   await ev("TK.map.flyTo([450,350,560,440],1000)");await wait(120);
   const p=await ev("(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x+r.width*.7,y:r.y+r.height*.7}})()");
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await wait(250);
   interactions.push({check:'interrupt camera with click',pass:await ev("!document.querySelector('#stage').classList.contains('camera-moving') && document.querySelector('#tkmap').style.transform==='' && document.querySelector('#L-labels').style.opacity==='1'")});
   await ev("TK.map.flyTo([450,400,560,440],0)");await wait(100);
   const anchor=()=>ev(`(()=>{const p=document.querySelector('#tkmap').createSVGPoint();p.x=${p.x};p.y=${p.y};const q=p.matrixTransform(document.querySelector('#L-cam').getScreenCTM().inverse());return {x:q.x,y:q.y}})()`);
   const a=await anchor();await send('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:-100});await wait(350);const z=await anchor();
   interactions.push({check:'wheel keeps map point under cursor',pass:Math.hypot(a.x-z.x,a.y-z.y)<.3,errorMapUnits:Math.hypot(a.x-z.x,a.y-z.y)});
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await wait(350);await saveShot('mobile');
   interactions.push({check:'mobile fits',pass:await ev('document.documentElement.scrollWidth<=390 && document.querySelector("#stage").clientHeight>=200')});
   await send('Emulation.setDeviceMetricsOverride',{width:1904,height:980,deviceScaleFactor:1,mobile:false});await wait(350);
 }
 if(process.argv.includes('--scenes')){
 const beats=await ev('TK.timeline');
 for(let i=0;i<beats.length;i++){
 await ev(`TK.engine.goTo(${i},'init');TK.ui.scrollTo(${i});TK.map.flyTo(TK.timeline[${i}].camera,0);TK.map.setMarkers(TK.timeline[${i}].markers||[],false,TK.timeline[${i}].mapDelta);TK.map.relayout()`);await wait(80);
 const state=await ev(`(()=>{const ids=['L-labels','L-pins','L-markers'];return Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.children.length]));})()`);
 records.push({...beats[i],rendered:state});await saveShot(beats[i].id);
 if(i%12===0)console.log('scene',i+1,'/',beats.length);
 }
 fs.writeFileSync(path.join(out,'scenes.json'),JSON.stringify(records,null,2));
 }
 if(process.argv.includes('--surface')){
   const ready=await ev("!!document.querySelector('#L-map-surface canvas')");
   interactions.push({check:'cached surface mounted',pass:ready});
   if(!ready)throw Error('Surface did not mount');
   const parity=await ev(`(async()=>{let checked=0;const failed=[];for(let i=0;i<TK.timeline.length;i++){TK.ui.scrollTo(i);TK.engine.goTo(i,'init');await new Promise(r=>setTimeout(r,60));const c=document.querySelector('#L-map-surface canvas');const expected=[...document.querySelectorAll('#L-regions path.region')].map(el=>[el.dataset.id,el.getAttribute('fill')]);if(c.dataset.owners!==JSON.stringify(expected))failed.push({id:TK.timeline[i].id,expected,drawn:JSON.parse(c.dataset.owners)});checked++;}return {checked,failed};})()`);
   interactions.push({check:'surface ownership matches all scenes',pass:parity.checked===132&&!parity.failed.length,...parity});
   const held=await ev(`(async()=>{const el=document.querySelector('#L-regions path.region'),id=el.dataset.id,old=el.getAttribute('fill'),side=Object.keys(TK.factions).find(s=>TK.factions[s].color!==old);TK.map.setOwners({[id]:side},new Set([id]));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const held=el.getAttribute('fill')===old;TK.map.setMarkers([],false);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {held,released:el.getAttribute('fill')===TK.factions[side].color,surface:JSON.parse(document.querySelector('#L-map-surface canvas').dataset.owners).find(p=>p[0]===id)[1]===el.getAttribute('fill')};})()`);
   interactions.push({check:'hold ownership until movement released',pass:held.held&&held.released&&held.surface,...held});
   await ev('TK.map.setArt(false)');await wait(100);
   const fallback=await ev("({display:getComputedStyle(document.querySelector('#L-map-surface')).display,opacity:Number(getComputedStyle(document.querySelector('#L-regions')).opacity),art:TK.map.artOn})");interactions.push({check:'original map fallback',pass:fallback.display==='none'&&Math.abs(fallback.opacity-.45)<.001&&!fallback.art,...fallback});
   await ev("TK.map.setArt(true);TK.engine.goTo(0,'init')");await wait(100);
 }
 if(process.argv.includes('--lifetimes')){
   const lifetime=await ev(`(()=>{const bad=[];let checked=0;for(let i=0;i<TK.timeline.length;i++){TK.engine.goTo(i,'init');TK.map.relayout();const y=TK.timeline[i].year;for(const [id,p] of Object.entries(TK.places)){if((p.year!=null&&y<p.year)||(p.gone!=null&&y>=p.gone)){const pin=document.querySelector('#L-pins [data-id="'+id+'"]');if(getComputedStyle(pin).display!=='none'||[...document.querySelectorAll('#L-labels .plabel')].some(t=>t.textContent===p.label))bad.push({scene:TK.timeline[i].id,id});checked++;}}}return {checked,bad};})()`);
   interactions.push({check:'no premature or expired place dots and names in all 132 scenes',pass:!lifetime.bad.length,...lifetime});
   const years=await ev(`(()=>{TK.map.flyTo([230,430,560,440],0);const out=[];for(const year of [221,227,228,233,234,274,228,221]){TK.map.setYear(year);TK.map.relayout();out.push({year,visible:getComputedStyle(document.querySelector('#L-pins [data-id="hanying"]')).display!=='none',active:TK.map.isPlaceActive('hanying')});}return out;})()`);
   interactions.push({check:'forward camp boundaries and reverse scrubbing',pass:years.every(x=>x.active===(x.year>=228&&x.year<234)&&x.visible===x.active),years});
   if(run.includes('studio')){
     await ev("TK.engine.goTo(0,'init');const input=document.querySelector('#city-search');input.value='ค่ายหน้า';input.dispatchEvent(new Event('input'))");
     interactions.push({check:'future camp excluded from search',pass:await ev("document.querySelectorAll('.studio-results button').length===0")});
     await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await wait(100);
     await ev("document.querySelector('#studio-context-toggle').click()");
     interactions.push({check:'mobile search panel opens',pass:await ev("getComputedStyle(document.querySelector('.studio-context')).display!=='none' && document.querySelector('#studio-context-toggle').getAttribute('aria-expanded')==='true'")});
     await saveShot('mobile-context');
     await send('Emulation.setDeviceMetricsOverride',{width:1904,height:980,deviceScaleFactor:1,mobile:false});await wait(350);
   }
 }
 if(process.argv.includes('--fade')){
   await ev("TK.engine.goTo(0,'init');window.__testRegion=document.querySelector('#L-regions path.region').dataset.id;window.__testSide=Object.keys(TK.factions).find(s=>TK.factions[s].color!==document.querySelector('#L-regions path.region').getAttribute('fill'));TK.map.setOwners({[__testRegion]:__testSide},null,true)");
   await ev("(async()=>{await document.querySelectorAll('#L-map-surface canvas')[1].getAnimations()[0]?.ready;await new Promise(r=>requestAnimationFrame(r));})()");
   await wait(220);
   const mid=await ev("(()=>{const c=document.querySelectorAll('#L-map-surface canvas')[1];return {opacity:Number(getComputedStyle(c).opacity),animations:c.getAnimations().length}})()");
   interactions.push({check:'ownership crossfade has intermediate opacity',pass:mid.opacity>0&&mid.opacity<1&&mid.animations===1,...mid});
   await ev("TK.map.setOwners({[__testRegion]:Object.keys(TK.factions).find(s=>s!==__testSide)},null,true)");await wait(120);
   interactions.push({check:'interrupted fade restarts one transition',pass:await ev("document.querySelectorAll('#L-map-surface canvas')[1].getAnimations().length===1")});
   await ev("TK.engine.goTo(0,'init')");await wait(30);
   interactions.push({check:'scrub/init clears old ownership image',pass:await ev("Number(getComputedStyle(document.querySelectorAll('#L-map-surface canvas')[1]).opacity)===0 && document.querySelectorAll('#L-map-surface canvas')[1].getAnimations().length===0")});
 }
 if(process.argv.includes('--lod')){
   await ev("TK.ui.scrollTo(0);TK.engine.goTo(0,'init');TK.map.setMarkers([],false);TK.map.flyTo([0,0,1650,1950],0);TK.map.relayout()");await wait(150);
   const overview=await ev("(()=>{const visible=[...document.querySelectorAll('#L-pins .pin')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.dataset.id);return {visible,types:visible.map(id=>TK.places[id].type),provinces:document.querySelectorAll('.zlabel').length,level:document.querySelector('#stage').dataset.mapLevel,view:TK.map.viewBox};})()");
   interactions.push({check:'overview capitals and provinces without passes',pass:overview.provinces===14&&overview.visible.includes('changan')&&overview.types.every(type=>!['pass','mountain','valley_mouth'].includes(type)),...overview});
   interactions.push({check:'overview excludes Xiling and Shouchun; shows Jiangling; depot hidden',pass:await ev("getComputedStyle(document.querySelector('#L-pins .pin[data-id=xiling]')).display==='none'&&getComputedStyle(document.querySelector('#L-pins .pin[data-id=shouchun]')).display==='none'&&getComputedStyle(document.querySelector('#L-pins .pin[data-id=jiangling]')).display!=='none'&&getComputedStyle(document.querySelector('#L-pins .pin[data-id=hanzhong] .pin-role')).display==='none'")});
   interactions.push({check:'overview Jiangling label readable',pass:await ev("[...document.querySelectorAll('#L-labels .plabel')].some(e=>e.textContent==='เจียงหลิง')")});
   const geography=await ev("(()=>{const c=document.createElement('canvas').getContext('2d');const at=(x,y)=>Object.entries(TK.regionsFill).filter(([id,d])=>c.isPointInPath(new Path2D(d),x,y)).map(([id])=>id);return {north:at(40,500),south:at(100,1900),wudu:at(365,683),newCities:Object.values(TK.places).filter(p=>p.province).length};})()");
   interactions.push({check:'corrected opening extent and city registry',pass:!geography.north.includes('yizhou')&&geography.south.includes('jiaozhou')&&geography.wudu.includes('wudu')&&geography.newCities===24,...geography});
   await saveShot('overview');
   await ev("TK.map.flyTo([430,420,300,250],0);TK.map.relayout()");await wait(150);
   interactions.push({check:'near view hides province names and settles vector text',pass:await ev("document.querySelectorAll('.zlabel').length===0&&document.querySelector('#tkmap').style.transform===''")});
   await saveShot('near');
   await ev('TK.map.flyTo([350,690,320,260],0);TK.map.relayout()');await wait(150);
   interactions.push({check:'Hanzhong depot returns when zoomed in',pass:await ev("getComputedStyle(document.querySelector('#L-pins .pin[data-id=hanzhong] .pin-role')).display!=='none'")});

 }
 await ev(fs.readFileSync(path.join(__dirname,'selfcheck.js'),'utf8'));
 const selfcheck=await ev('TK.selfcheck.all()');
 const result={run,viewport:[1904,980],bench,errors,selfcheck,scenes:records.length,interactions};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(errors.length||selfcheck.errors||interactions.some(x=>x.pass===false))process.exitCode=1;
 }finally{ws?.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
