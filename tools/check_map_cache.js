/* ตรวจว่า PNG ที่ใช้ลดแลคยังมาจากงานศิลป์รุ่นปัจจุบัน */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../assets/map-art');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'cache/manifest.json'),'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const stale=[];
for(const [file,want] of Object.entries(manifest.inputs))if(hash(path.join(root,file))!==want)stale.push(file);
for(const [file,want] of Object.entries(manifest.outputs||{}))if(hash(path.join(root,'cache',file))!==want)stale.push(file);
if(!manifest.outputs||Object.keys(manifest.outputs).length!==2)stale.push('manifest outputs missing');
if(stale.length){console.error('Cache stale:',stale.join(', '),'— เปิด server 8778 แล้วรัน node tools/build_map_cache.js');process.exitCode=1;}
else console.log('Map cache: source hashes and both rendered PNGs match');
