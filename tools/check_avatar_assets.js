/* รายชื่อและไฟล์ส่งมอบจริงต้องครบ ไม่อ้างภาพในโฟลเดอร์ต้นแบบขณะใช้งาน */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');global.window=global;require(path.join(root,'data/names.js'));require(path.join(root,'data/timeline.js'));
const dir=path.join(root,'assets/avatars/map'),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.deepEqual(m.people.map(p=>p.id),Object.keys(TK.people));assert.equal(m.count,80);
for(const p of m.people)for(const size of [128,256]){const b=fs.readFileSync(path.join(dir,p.files[size].path));assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);assert.equal(sha(b),p.files[size].sha256);}
let routes=0;const scenes=new Set();for(const b of TK.timeline)for(const mark of b.markers||[])if(mark.who){assert.ok(TK.people[mark.who],b.id+': unknown commander');assert.ok(m.people.some(p=>p.id===mark.who));routes++;scenes.add(b.id);}
require(path.join(root,'data/scene_people.js'));require(path.join(root,'data/places.js'));
for(const [id,cast]of Object.entries(TK.scenePeople)){
  const beat=TK.timeline.find(b=>b.id===id);assert.ok(beat,id+': unknown scene');
  assert.equal(new Set(cast.map(a=>a.who)).size,cast.length,id+': duplicate person');
  for(const actor of cast){
    assert.ok(TK.people[actor.who]&&m.people.some(p=>p.id===actor.who),id+': missing portrait');
    assert.ok(actor.role,id+': missing scene role');
    if(actor.place)assert.ok(TK.places[actor.place],id+': unknown location');
    if(actor.route)assert.ok(beat.markers.some(mark=>mark.type==='arrow'&&mark.route===actor.route&&mark.who===actor.who),id+': route actor differs from story');
    assert.ok(!(actor.place&&actor.route),id+': person cannot be both stationed and travelling');
  }
}
console.log('PASS: 80 avatars / 160 PNG files; '+routes+' named routes in '+scenes.size+' scenes; narrative cast references and locations valid.');
