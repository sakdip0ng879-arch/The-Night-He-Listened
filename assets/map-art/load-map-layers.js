/** SVG integration helper; call once per existing 1650x1950 map. No app state is changed. */
export async function loadMapLayers(parent,{assetBase=new URL('./',import.meta.url),includeWall=false,prefix='tk-art-v3-',theme='day'}={}){
 const NS='http://www.w3.org/2000/svg',base=new URL(assetBase,document.baseURI);
 if(!base.pathname.endsWith('/'))throw new Error('assetBase must end with /');
 const group=document.createElementNS(NS,'g');group.setAttribute('data-map-art','v3');group.setAttribute('pointer-events','none');group.setAttribute('aria-hidden','true');
 const layers={};
 for(const [name,file] of [['terrain','terrain-layer.svg'],['water','water.svg'],...(includeWall?[['wall','wall.svg']]:[])]){
  const url=new URL(file,base),res=await fetch(url);if(!res.ok)throw new Error(file+': HTTP '+res.status);
  const source=new DOMParser().parseFromString(await res.text(),'image/svg+xml');if(source.querySelector('parsererror'))throw new Error('Invalid SVG: '+file);
  const root=source.documentElement,ids=new Map();for(const el of root.querySelectorAll('[id]')){const old=el.id;ids.set(old,prefix+name+'-'+old);el.id=ids.get(old);}
  for(const el of root.querySelectorAll('*'))for(const a of [...el.attributes]){let value=a.value;for(const [old,next]of ids){value=value.replaceAll('url(#'+old+')','url(#'+next+')');if(value==='#'+old)value='#'+next;}el.setAttribute(a.name,value);}
  for(const image of root.querySelectorAll('image[href]'))image.setAttribute('href',new URL(image.getAttribute('href'),url).href);
  const layer=document.createElementNS(NS,'g');layer.setAttribute('data-art-layer',name);for(const child of [...root.children])if(child.localName!=='title')layer.append(document.importNode(child,true));group.append(layer);layers[name]=layer;
 }
 // Atomic append: no half-loaded layer is attached if fetching/parsing failed.
 const setTheme=value=>{const dark=value==='night';group.setAttribute('data-theme',dark?'night':'day');layers.terrain.style.filter=dark?'brightness(.24) saturate(.45)':'none';layers.water.style.filter=dark?'brightness(.72) saturate(.7)':'none';if(layers.wall)layers.wall.style.filter=dark?'brightness(1.6) saturate(.65)':'none';};
 setTheme(theme);parent.append(group);return{group,...layers,setTheme,remove:()=>group.remove()};
}
