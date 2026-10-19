import fs from 'node:fs';
import path from 'node:path';
import {SUPPORT_ART_TYPES} from '../dist/ui.js';
const root=path.resolve(import.meta.dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'dist/data/catalog.json'),'utf8'));
const rawCharactersFile=path.join(root,'research/gametora-character-cards.json');
const rawCharacters=fs.existsSync(rawCharactersFile)?JSON.parse(fs.readFileSync(rawCharactersFile,'utf8').replace(/^\uFEFF/,'')).map(c=>[c.card_id,c.costume]):[];
const dresses=new Map(rawCharacters);
for(const c of catalog.characters){c.raceDressId=c.raceDressId??dresses.get(c.id);if(!Number.isInteger(c.raceDressId))throw new Error(`Missing costume mapping: ${c.id}`);}
const jobs=[
  ...catalog.characters.map(c=>({item:c,kind:'characters',url:`https://uma-cdn.pure-db.com/img/trained_charas/trained_${c.characterId}_${String(c.raceDressId).padStart(6,'0')}_01.png`})),
  ...catalog.supports.map(c=>({item:c,kind:'supports',url:`https://media.gametora.com/umamusume/supports/full/small/${c.id}.png`})),
  ...Object.entries(SUPPORT_ART_TYPES).map(([type,{icon}])=>{const url=`https://gametora.com/images/umamusume/icons/utx_ico_obtain_${icon}.png`;return{item:{id:type,imageSource:url},kind:'support-types',url};})
];
let next=0,completed=0;const failures=[];
await Promise.all(Array.from({length:4},async()=>{
  while(next<jobs.length){const job=jobs[next++];const relative=`assets/${job.kind}/${job.item.id}.png`;const file=path.join(root,'dist',relative);
    try {
      if(!fs.existsSync(file)||job.item.imageSource!==job.url){
        const r=await fetch(job.url,{signal:AbortSignal.timeout(30000)});
        if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error(`HTTP ${r.status}`);
        const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<100||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Invalid PNG');
        if(job.kind==='characters'&&(bytes.readUInt32BE(16)!==256||bytes.readUInt32BE(20)!==256))throw new Error('Unexpected face icon size');
        fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
      }
      job.item.image=relative;job.item.imageSource=job.url;completed++;
    }catch(e){failures.push({id:job.item.id,kind:job.kind,error:e.message});}
  }
}));
if(failures.length){console.log(JSON.stringify({completed,failures}));process.exitCode=1;}
else{catalog.sources.artwork={...catalog.sources.artwork,characters:'https://uma.pure-db.com/ja-jp/',supports:'https://gametora.com/ja/umamusume/supports',supportTypes:'https://gametora.com/ja/umamusume/supports'};fs.writeFileSync(path.join(root,'dist/data/catalog.json'),JSON.stringify(catalog));console.log(`Artwork verified: ${completed} images (${catalog.characters.length} game face icons, 7 support type icons).`);}
