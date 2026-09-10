/* สร้างพื้นภาพจาก SVG เดิมด้วย Chrome ไม่เปลี่ยนพิกัด/หน้ากาก/งานวาด
   ก่อนรันเปิด node tools/serve.js 8778; runtime ไม่ต้อง build และใช้ file:// ได้
   SVG กลางต้องฝัง PNG เพราะ SVG ที่โหลดเป็นภาพไม่โหลดภาพภายนอกซ้อนอีกชั้น */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'../assets/map-art'),out=path.join(root,'cache');
fs.mkdirSync(out,{recursive:true});
const read=f=>fs.readFileSync(path.join(root,f));
const embed=(s,file)=>s.replace(/href="[^"]+\.png"/,`href="data:image/png;base64,${read(file).toString('base64')}"`);
const env=embed(read('environment/environment-layer.svg').toString(),'environment/environment-art.png');
const terrain=read('terrain-layer.svg').toString();
const defs=terrain.match(/<defs>[\s\S]*?<\/defs>/)[0];
const image=terrain.match(/<image\b[\s\S]*?<\/image>/)[0];
const relief='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1650 1950" width="1650" height="1950">'+defs+embed(image,'terrain-art.png').replace('<image ','<image style="opacity:.72;filter:grayscale(1) brightness(1.06) contrast(1.22)" ')+'</svg>';
fs.writeFileSync(path.join(out,'environment.svg'),env);fs.writeFileSync(path.join(out,'relief.svg'),relief);
const files=['environment/environment-layer.svg','environment/environment-art.png','terrain-layer.svg','terrain-art.png'];
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({description:'Derived render resources; regenerate with node tools/build_map_cache.js',coordinateSystem:[1650,1950],inputs:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(read(f)).digest('hex')]))},null,2));
console.log('Created cache resources: environment '+env.length+' bytes, relief '+relief.length+' bytes');
const baked=require('child_process').spawnSync(process.execPath,[path.join(__dirname,'audit_ui.js'),'bake','--bake','--smoke'],{stdio:'inherit',windowsHide:true});
if(baked.status!==0)process.exit(baked.status||1);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
manifest.description='Regenerate with node tools/build_map_cache.js (local server 8778 required)';
manifest.rasterSize=[1650,1950];
manifest.render={environmentOpacity:.82,regionGroupOpacity:.45,regionStrokeWidth:1.5,reliefOpacity:.72,reliefFilter:'grayscale(1) brightness(1.06) contrast(1.22)',reliefComposite:'multiply',paper:'#f0e9d6'};
manifest.outputs=Object.fromEntries(['environment.png','relief.png'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
