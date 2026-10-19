import fs from 'node:fs';
import assert from 'node:assert/strict';
import { RECOMMENDATIONS, COURSES, STYLES } from '../dist/recommendations.js';
import { createIndex, analyze, normalizeState } from '../dist/engine.js';
import { PRIORITIES } from '../dist/priorities.js';
import { COURSE_TIERS, TIER_SOURCES, TIER_ORDER, getCourseTier } from '../dist/character-tiers.js';
import {createSupportUsageIndex} from '../dist/support-usage.js';
import {SUPPORT_ART_TYPES} from '../dist/ui.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json', import.meta.url)));
const index = createIndex(catalog);
for (const list of [catalog.characters,catalog.supports,catalog.skills]) assert.equal(new Set(list.map(s=>s.id)).size,list.length,'IDs must be unique');
for (const support of catalog.supports) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(support.releaseDate),'Missing support release date: '+support.id);
const usage=createSupportUsageIndex(catalog);
for(const support of catalog.supports){
  assert.ok(usage.get(support.id).contexts.length,'Missing support category: '+support.id);
  for(const id of usage.get(support.id).skillIds)assert.ok(index.skills.get(id)?.description&&index.skills.get(id)?.targets,'Missing support skill targets: '+id);
}
for(const type of Object.keys(SUPPORT_ART_TYPES))assert.ok(fs.statSync(new URL('../dist/assets/support-types/'+type+'.png',import.meta.url)).size>100);
for (const r of RECOMMENDATIONS) {
  const skill=(r.inherited?index.uniqueByName:index.normalByName).get(r.name);
  assert.ok(skill, `Unresolved skill: ${r.name}`);
  if(r.gold) assert.equal(index.normalByName.get(r.gold)?.rarity,2,`Invalid gold: ${r.gold}`);
  if(!r.inherited) assert.equal(skill.rarity,1,`Ordinary recommendation must be white: ${r.name}`);
  if(r.inherited) assert.ok(index.characters.has(skill.ownerIds?.[0]??r.ownerId),`Missing owner: ${r.name}`);
}
for(const c of COURSES)for(const style of STYLES){const result=analyze(normalizeState({courseId:c.id,style},catalog),catalog);assert.ok(result.rows.every(r=>r.skillId&&PRIORITIES[r.priority]&&r.priorityReason));if(!c.confirmed)assert.equal(result.rows.length,0);}
for(const [id,board] of Object.entries(COURSE_TIERS)){
  assert.ok(getCourseTier(COURSES.find(c=>c.id===id)),'Tier conditions must match the course: '+id);
  if(board.status==='withheld'){assert.equal(board.entries.length,0);assert.equal(board.sourceIds.length,0);assert.ok(board.pendingReason);continue;}
  assert.equal(board.status,'published');
  assert.ok(board.sourceIds.some(key=>TIER_SOURCES[key]?.platform==='note'),'Published tiers require note research');
  for(const e of board.entries){
    assert.ok(index.characters.has(e.characterId)&&TIER_ORDER.includes(e.tier),'Invalid tier character');
    assert.ok(e.styles.every(s=>STYLES.includes(s)),'Invalid tier style');
    assert.ok(e.opinions.every(o=>board.sourceIds.includes(o.source)&&TIER_SOURCES[o.source]?.courseId===id),'Tier sources must match the event');
  }
}
for(const file of ['index.html','app.js','engine.js','recommendations.js','priorities.js','factor-planner.js','factor-ui.js','ui.js','character-tiers.js','tier-ui.js','support-picker.js','tier.css','style.css','layout.css','factor.css','sw.js','manifest.webmanifest','icon.svg'])assert.ok(fs.statSync(new URL('../dist/'+file,import.meta.url)).size>0);
for(const item of [...catalog.characters,...catalog.supports])assert.ok(item.image&&fs.statSync(new URL('../dist/'+item.image,import.meta.url)).size>100,`Missing artwork: ${item.id}`);
console.log(`Data valid: ${RECOMMENDATIONS.length} rules, ${catalog.characters.length} trainees, ${catalog.supports.length} supports. All course/style combinations resolved.`);
