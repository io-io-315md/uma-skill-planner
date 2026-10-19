import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseSkillTargets} from '../dist/support-usage.js';

export function enrichSupportSkills(catalog,rawSkills) {
  const raw=new Map(rawSkills.map(s=>[s.id,s]));
  const needed=new Set(catalog.supports.flatMap(s=>[...s.hintSkills,...s.eventSkills,...s.events.flatMap(e=>[...e.skills,...e.choices.flatMap(c=>c.skills)])]));
  for(const skill of catalog.skills)if(needed.has(skill.id)){
    const description=raw.get(skill.id)?.jpdesc;
    if(!description)throw new Error('Missing support skill description: '+skill.id);
    skill.description=description;
    skill.targets=parseSkillTargets(description);
  }
  catalog.supportUsageVerifiedAt='2026-10-19';
  return needed.size;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const catalogPath=new URL('../dist/data/catalog.json',import.meta.url);
  const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
  const count=enrichSupportSkills(catalog,JSON.parse(fs.readFileSync(new URL('../research/gametora-skills.json',import.meta.url),'utf8')));
  fs.writeFileSync(catalogPath,JSON.stringify(catalog));
  console.log('Support skill targets: '+count+' skills / '+catalog.supports.length+' cards.');
}
