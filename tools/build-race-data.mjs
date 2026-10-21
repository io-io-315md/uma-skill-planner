import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const keys=['races','ura-races','ura-objectives','race-fans'];
if(process.argv.includes('--download')){
  await fs.mkdir(path.join(root,'research'),{recursive:true});
  const manifest=await(await fetch('https://gametora.com/data/manifests/umamusume.json')).json();
  await fs.writeFile(path.join(root,'research/race-manifest.json'),JSON.stringify(manifest));
  for(const key of keys){
    const response=await fetch(`https://gametora.com/data/umamusume/${key}.${manifest[key]}.json`);
    if(!response.ok)throw Error(`${key}: ${response.status}`);
    await fs.writeFile(path.join(root,`research/race-${key}.json`),await response.text());
  }
}
const read=async key=>JSON.parse(await fs.readFile(path.join(root,`research/race-${key}.json`),'utf8'));
const [races,calendar,objectives,fans,manifest]=await Promise.all([...keys,'manifest'].map(read));
const byId=new Map(races.map(r=>[r.id,r]));
const canonical=new Map(races.filter(r=>r.list_ura?.length).map(r=>[r.name_ja,r.race_id]));
const fanIndex=new Map(fans.map(f=>[f.id,f.fans.find(x=>x.order===1)?.fans??0]));
const distanceType=n=>n<=1400?'短距離':n<=1800?'マイル':n<=2400?'中距離':'長距離';
const simplify=(race,needed,gained)=>({
  key:canonical.get(race.name_ja)??race.race_id??race.id,name:race.name_ja,grade:race.grade,
  distance:race.distance,distanceType:distanceType(race.distance),surface:race.terrain===2?'ダート':'芝',
  fansNeeded:needed??race.fans_needed??0,fansGained:gained??race.fans_gained??0
});
const data={
  verifiedAt:'2026-10-21',schemaVersion:1,
  sources:{manifest:'https://gametora.com/data/manifests/umamusume.json',calendar:'https://gametora.com/ja/umamusume/race-scheduler',hashes:Object.fromEntries(keys.map(k=>[k,manifest[k]]))},
  races:calendar.filter(r=>r.year<=3&&r.instance).map(r=>{
    const race=byId.get(r.instance);if(!race)throw Error('Race missing: '+r.instance);
    return {id:r.id,turn:(r.year-1)*24+(r.month-1)*2+r.half,...simplify(race,r.fans_needed,fanIndex.get(r.fans_gain))};
  }),
  goals:Object.fromEntries(objectives.map(group=>[group.char_id,group.objectives.filter(o=>o.target_type===1&&o.turn<=72).map(o=>({
    order:o.order,turn:o.turn,type:o.cond_type,grade:o.cond_id,position:o.cond_value,count:o.cond_value_2,
    choice:o.race_choice,branch:o.race_choice_details,races:(o.races??[]).map(r=>simplify(r))
  }))]))
};
const catalog=JSON.parse(await fs.readFile(path.join(root,'dist/data/catalog.json'),'utf8'));
for(const character of catalog.characters)if(!data.goals[character.characterId])throw Error('Goals missing: '+character.id);
await fs.writeFile(path.join(root,'dist/race-data.js'),'// GameTora公開データから生成。更新: node tools/build-race-data.mjs --download\nexport const RACE_DATA='+JSON.stringify(data)+';\n');
console.log(`Race data: ${data.races.length} calendar entries, ${Object.keys(data.goals).length} character goal plans.`);
