/* หอป้อม/รั้วเกาะกราฟถนนเดิม จำนวนรูปเป็นความหนาแน่นการวาด ไม่ใช่จำนวนป้อมจริง */
window.TK=window.TK||{};
TK.worksArt=(()=>{
  let items=[],layer,occupied=[];
  function build(parent,mk){
    layer=parent;items=[];
    for(const w of TK.works||[]){
      const edge=TK.edges.find(e=>(e.a===w.on[0]&&e.b===w.on[1])||(e.b===w.on[0]&&e.a===w.on[1]));if(!edge||!edge.d)continue;/* edge ที่ยังไม่ลาก d วัดความยาวไม่ได้ — check_routes ข้อ 14 ฟ้องแล้ว (ของเดิมใน strategic.js มี guard นี้) */
      const probe=mk('path',{d:edge.d});parent.append(probe);const length=probe.getTotalLength(),flip=edge.a!==w.on[0],lo=length*(flip?1-w.to:w.from),hi=length*(flip?1-w.from:w.to);
      const g=mk('g',{class:'works w-'+w.kind+' s-'+w.side,'data-art-layer':'works'});g.dataset.id=w.id;
      const title=mk('title');title.textContent=w.label+(w.note?' — '+w.note:'');g.append(title);
      g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label',w.label+' · เปิดรายละเอียด');
      const inspect=()=>TK.mapPeople.inspect(g,{name:w.label,label:w.note,side:w.side});
      g.addEventListener('click',e=>{e.stopPropagation();inspect();});g.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();inspect();}});
      const spine=mk('path',{class:'works-art-spine'});g.append(spine);const samples=[];
      for(let s=lo;s<hi;s+=2){const p=probe.getPointAtLength(s);samples.push({x:p.x,y:p.y,s});}const end=probe.getPointAtLength(hi);samples.push({x:end.x,y:end.y,s:hi});
      const posts=[];
      const add=s=>{const p=probe.getPointAtLength(s),q=probe.getPointAtLength(Math.min(length,s+1)),n=mk('g',{class:w.kind==='fortchain'?'works-tower':'works-timber'});n.dataset.x=p.x;n.dataset.y=p.y;
        if(w.kind==='fortchain'){
          n.append(mk('path',{d:'M-5 4V-4H-6V-7H-3V-5H-1V-7H1V-5H3V-7H6V-4H5V4Z',class:'works-masonry'}),mk('path',{d:'M-5 3H5M1-4H5V4H1Z',class:'works-stone-shade'}),mk('path',{d:'M-1.3 4V.5Q0-1 1.3.5V4',class:'works-door'}),mk('path',{d:'M-3-2H-1V-1H-3Z',class:'works-banner'}),mk('path',{d:'M0-9C-4-12 3-14 0-17C-3-20 2-22 1-24',class:'works-smoke'}));
        }else{n.append(mk('path',{d:'M-5 3V-4L-4-6L-3-4V3M-1 3V-4L0-6L1-4V3M3 3V-4L4-6L5-4V3M-6-2H6M-6 1H6',class:'works-wood'}));}
        g.append(n);posts.push({g:n,x:p.x,y:p.y,s,angle:Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI});};
      // จุดสำรองทุก 3 หน่วยของ edge เดียวกัน ช่วยหาช่องว่างระหว่างด่านที่อยู่ชิดกัน
      // update คัดเหลือเฉพาะรูปที่ไม่ชน จึงไม่ได้แปลว่าเพิ่มจำนวนป้อมในเรื่อง
      for(let s=Math.ceil(lo/3)*3;s<=hi+.01;s+=3)add(s);if(!posts.length)add((lo+hi)/2);
      parent.append(g);probe.remove();items.push({w,g,spine,samples,posts});
    }
  }
  const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function update(mu,symbols){
    if(!layer)return;const blocks=Object.values(symbols).map(b=>({x:b.x-5*mu,y:b.y-5*mu,w:b.w+10*mu,h:b.h+10*mu})),used=[];
    for(const item of items){
      if(item.g.style.display==='none')continue;
      let d='',open=false;
      for(const p of item.samples){if(blocks.some(b=>hit({x:p.x-mu,y:p.y-mu,w:2*mu,h:2*mu},b))){open=false;continue;}d+=(open?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1);open=true;}
      item.spine.setAttribute('d',d);item.spine.style.strokeWidth=String(.8*mu);
      const size=Math.min(1.5,Math.max(.65,1.15/mu))*mu;
      for(const p of item.posts){
        const box={x:p.x-7*size,y:p.y-8*size,w:14*size,h:13*size};
        const hide=blocks.some(b=>hit(box,b))||used.some(b=>hit({...box,x:box.x-5*mu,w:box.w+10*mu},b));
        p.g.style.display=hide?'none':'';p.g.setAttribute('transform',`translate(${p.x},${p.y}) scale(${size})`);
        if(!hide)used.push(box);
      }
    }
    occupied=used;
  }
  function signal(ids=[]){
    for(const item of items){item.g.classList.remove('works-signalling');if(!ids.includes(item.w.id)||item.g.style.display==='none')continue;
      let n=0;for(const p of item.posts)if(p.g.style.display!=='none')p.g.style.setProperty('--signal-delay',(n++*.18)+'s');
      void item.g.getBoundingClientRect();item.g.classList.add('works-signalling');
    }
  }
  function focus(ids){const points=items.filter(i=>ids.includes(i.w.id)).flatMap(i=>i.samples);if(!points.length)return;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),w=Math.max(210,x1-x0+120),h=Math.max(130,y1-y0+100);TK.map.flyTo([(x0+x1-w)/2,(y0+y1-h)/2,w,h],650);}
  return{build,update,signal,focus,get boxes(){return occupied;}};
})();
