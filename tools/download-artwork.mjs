import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'dist/data/catalog.json'),'utf8'));
const jobs=[
  ...catalog.characters.map(c=>({item:c,kind:'characters',url:`https://gametora.com/images/umamusume/characters/thumb/chara_stand_${c.characterId}_${c.id}.png`})),
  ...catalog.supports.map(c=>({item:c,kind:'supports',url:`https://media.gametora.com/umamusume/supports/full/small/${c.id}.png`}))
];
let next=0,completed=0;const failures=[];
await Promise.all(Array.from({length:4},async()=>{
  while(next<jobs.length){const job=jobs[next++];const relative=`assets/${job.kind}/${job.item.id}.png`;const file=path.join(root,'dist',relative);
    try {
      if(!fs.existsSync(file)){
        const r=await fetch(job.url,{signal:AbortSignal.timeout(30000)});
        if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error(`HTTP ${r.status}`);
        const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<100)throw new Error('Empty image');
        fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
      }
      job.item.image=relative;job.item.imageSource=job.url;completed++;
    }catch(e){failures.push({id:job.item.id,kind:job.kind,error:e.message});}
  }
}));
if(failures.length){console.log(JSON.stringify({completed,failures}));process.exitCode=1;}
else{fs.writeFileSync(path.join(root,'dist/data/catalog.json'),JSON.stringify(catalog));console.log(`Artwork verified: ${completed} images.`);}
