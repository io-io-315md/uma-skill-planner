import fs from 'node:fs';
import assert from 'node:assert/strict';
import { RECOMMENDATIONS, COURSES, STYLES } from '../dist/recommendations.js';
import { createIndex, analyze, normalizeState } from '../dist/engine.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json', import.meta.url)));
const index = createIndex(catalog);
for (const list of [catalog.characters,catalog.supports,catalog.skills]) assert.equal(new Set(list.map(s=>s.id)).size,list.length,'IDs must be unique');
for (const r of RECOMMENDATIONS) {
  const skill=(r.inherited?index.uniqueByName:index.normalByName).get(r.name);
  assert.ok(skill, `Unresolved skill: ${r.name}`);
  if(r.gold) assert.equal(index.normalByName.get(r.gold)?.rarity,2,`Invalid gold: ${r.gold}`);
  if(!r.inherited) assert.equal(skill.rarity,1,`Ordinary recommendation must be white: ${r.name}`);
  if(r.inherited) assert.ok(index.characters.has(skill.ownerIds?.[0]??r.ownerId),`Missing owner: ${r.name}`);
}
for(const c of COURSES)for(const style of STYLES){const result=analyze(normalizeState({courseId:c.id,style},catalog),catalog);assert.ok(result.rows.every(r=>r.skillId));if(!c.confirmed)assert.equal(result.rows.length,0);}
for(const file of ['index.html','app.js','engine.js','recommendations.js','style.css','sw.js','manifest.webmanifest','icon.svg'])assert.ok(fs.statSync(new URL('../dist/'+file,import.meta.url)).size>0);
console.log(`Data valid: ${RECOMMENDATIONS.length} rules, ${catalog.characters.length} trainees, ${catalog.supports.length} supports. All course/style combinations resolved.`);
