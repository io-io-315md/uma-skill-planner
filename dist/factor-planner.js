import { acquisitionRoutes, lowerClosure, normalizeFarmingProfile } from './engine.js';
import { farmingFixedSupportId } from './deck-rules.js';
import { defaultRedFactor } from './factor-targets.js';
import { FARMING_POLICY, usesInheritedFactor } from './farming-policy.js';

// These are ranking weights, not measured hint/event probabilities.
const WEIGHT={1:12,2:4,3:1};
const RELIABILITY={native:1,event:.9,hint:.65,'event-unverified':.25};
export const URA_METHODS={
  'レースの真髄・体':'スタミナで勝負！',
  'レースの真髄・力':'パワーで勝負！',
  'レースの真髄・速':'スピードで勝負！'
};

export const factorPlanKey=(state,name)=>`${state.courseId}:${state.style}:${state.characterId??0}:${name}`;
export const needsFactor=row=>!row.excluded&&(row.status==='inheritance'||row.status==='factor'&&row.factorEligible);
function allFarmingTargets(analysis,focus) {
  const rows=analysis.rows.filter(r=>!r.inherited&&r.factorEligible&&!r.excluded&&r.status==='factor');
  if(focus?.factorEligible&&!rows.some(r=>r.name===focus.name))rows.push(focus);
  return rows.sort((a,b)=>(a.name===focus?.name?-1:b.name===focus?.name?1:0)||a.priority-b.priority||a.name.localeCompare(b.name,'ja'));
}
export const farmingTargets=(analysis,focus)=>allFarmingTargets(analysis,focus).filter(r=>!usesInheritedFactor(r));
export const inheritedFarmingTargets=(analysis,focus)=>allFarmingTargets(analysis,focus).filter(usesInheritedFactor);

export function supportOptions(support,index) {
  let options=[{skills:new Map(),eventChoices:{}}];
  const add=(map,id,kind)=>{for(const lower of lowerClosure(id,index)){if((RELIABILITY[kind]??0)>(RELIABILITY[map.get(lower)]??0))map.set(lower,kind);}};
  support.hintSkills.forEach(id=>add(options[0].skills,id,'hint'));
  support.eventSkills.forEach(id=>add(options[0].skills,id,'event-unverified'));
  for(const event of support.events){
    if(event.selection!=='single'){for(const o of options)event.skills.forEach(id=>add(o.skills,id,'event'));continue;}
    options=options.flatMap(o=>event.choices.map(choice=>{const skills=new Map(o.skills);choice.skills.forEach(id=>add(skills,id,'event'));return{skills,eventChoices:{...o.eventChoices,[event.id]:choice.id}};}));
  }
  return options.map(o=>({...o,support}));
}

const targetWeight=(row,focus)=>WEIGHT[row.priority]+(row.name===focus?.name?60:0);
function coverageScore(option,targets,focus,covered=new Set()) {
  return targets.reduce((sum,r)=>sum+(!covered.has(r.skillId)&&option.skills.has(r.skillId)?targetWeight(r,focus)*RELIABILITY[option.skills.get(r.skillId)]:0),0);
}
function bestOption(options,targets,focus,covered=new Set()) {
  return [...options].sort((a,b)=>coverageScore(b,targets,focus,covered)-coverageScore(a,targets,focus,covered)||b.support.id-a.support.id)[0];
}

export function candidateSources(analysis,focus,catalog,characterId=null) {
  if(!focus?.factorEligible)return[];
  const own=analysis.index.characters.get(characterId)?.characterId;
  const targets=farmingTargets(analysis,focus);
  return catalog.supports.filter(s=>s.characterId!==own).flatMap(s=>{
    const options=supportOptions(s,analysis.index).filter(o=>o.skills.has(focus.skillId));
    if(!options.length)return[];
    const option=bestOption(options,targets,focus);
    return[{support:s,eventChoices:option.eventChoices,kind:option.skills.get(focus.skillId),coverage:targets.filter(r=>option.skills.has(r.skillId)).map(r=>r.name),score:coverageScore(option,targets,focus)}];
  }).sort((a,b)=>b.score-a.score||b.support.id-a.support.id);
}

function chooseParent(state,analysis,focus,catalog,anchorSupportId) {
  if(focus.inherited)return focus.ownerId;
  const own=analysis.index.characters.get(state.characterId)?.characterId;
  const blocked=analysis.index.supports.get(anchorSupportId)?.characterId;
  const unique=analysis.rows.find(r=>r.status==='inheritance'&&!r.excluded&&analysis.index.characters.get(r.ownerId)?.characterId!==blocked);
  if(unique)return unique.ownerId;
  const targets=farmingTargets(analysis,focus);
  return catalog.characters.filter(c=>c.characterId!==own&&c.characterId!==blocked).map(c=>{
    const ids=new Set([...c.innate,...c.awakening,...c.eventSkills].flatMap(id=>lowerClosure(id,analysis.index)));
    return{char:c,score:targets.reduce((n,r)=>n+(ids.has(r.skillId)?targetWeight(r,focus):0),0)};
  }).sort((a,b)=>b.score-a.score||a.char.id-b.char.id)[0]?.char.id??null;
}

export function suggestFactorPlan(state,analysis,focus,catalog,options={}) {
  const own=analysis.index.characters.get(state.characterId)?.characterId;
  const preferred=analysis.index.characters.get(Number(options.characterId));
  const characterId=focus.inherited?focus.ownerId:preferred&&preferred.characterId!==own?preferred.id:chooseParent(state,analysis,focus,catalog,options.anchorSupportId);
  const parent=analysis.index.characters.get(characterId);
  const sources=candidateSources(analysis,focus,catalog,characterId);
  const anchor=options.anchorSupportId?sources.find(s=>s.support.id===Number(options.anchorSupportId)):usesInheritedFactor(focus)?null:sources[0];
  const scenario=options.scenario??(!usesInheritedFactor(focus)&&!anchor&&URA_METHODS[focus.name]?'ura':'support');
  const fixed=catalog.supports.find(s=>s.id===farmingFixedSupportId(scenario)),limit=fixed?5:6;
  const targets=farmingTargets(analysis,focus);
  const allOptions=catalog.supports.filter(s=>s.characterId!==parent?.characterId&&s.characterId!==fixed?.characterId).map(s=>supportOptions(s,analysis.index));
  const chosen=[],usedCharacters=new Set(),types=new Map(),covered=new Set();
  const native=acquisitionRoutes({characterId,supports:fixed?[fixed.id]:[],eventChoices:{}},analysis.index,'factor');
  for(const id of native.keys())covered.add(id);
  const add=option=>{
    chosen.push(option);usedCharacters.add(option.support.characterId);
    types.set(option.support.type,(types.get(option.support.type)??0)+1);
    for(const id of option.skills.keys())covered.add(id);
  };
  const selectedAnchor=anchor&&(!covered.has(focus.skillId)||options.anchorSupportId)?anchor:null;
  if(selectedAnchor){const option=allOptions.find(o=>o[0]?.support.id===selectedAnchor.support.id)?.find(o=>Object.entries(selectedAnchor.eventChoices).every(([k,v])=>o.eventChoices[k]===v));if(option)add(option);}
  while(chosen.length<limit){
    const candidates=allOptions.filter(o=>o.length&&!usedCharacters.has(o[0].support.characterId)&&(types.get(o[0].support.type)??0)<(['friend','group'].includes(o[0].support.type)?1:2)).map(o=>bestOption(o,targets,focus,covered));
    const next=bestOption(candidates,targets,focus,covered);
    if(!next||coverageScore(next,targets,focus,covered)<=0)break;
    add(next);
  }
  return normalizeFarmingProfile({characterId,supports:[...Array.from({length:limit},(_,i)=>chosen[i]?.support.id??null),...(fixed?[fixed.id]:[])],redFactor:defaultRedFactor(analysis),eventChoices:Object.assign({},...chosen.map(o=>o.eventChoices)),anchorSupportId:selectedAnchor?.support.id,scenario,farmingPolicy:FARMING_POLICY},catalog);
}

// Upgrade old saved decks once. Retain manual cards with any other target role,
// character, red factors and learned checks; replace only a body-only source.
export function refreshFarmingPolicy(profile,analysis,catalog,focus) {
  if(profile.farmingPolicy===FARMING_POLICY)return profile;
  const targets=farmingTargets(analysis,focus),inherited=inheritedFarmingTargets(analysis,focus);
  const supports=[...profile.supports],eventChoices={...profile.eventChoices},vacancies=[];
  for(let slot=0;slot<Math.min(5,supports.length);slot++){
    const support=analysis.index.supports.get(supports[slot]);if(!support)continue;
    const routes=acquisitionRoutes({supports:[support.id],eventChoices},analysis.index,'factor');
    if(!inherited.some(r=>routes.has(r.skillId))||targets.some(r=>routes.has(r.skillId)))continue;
    supports[slot]=null;vacancies.push(slot);
    for(const event of support.events)delete eventChoices[event.id];
  }
  for(const slot of vacancies){
    const used=new Set(supports.filter(Boolean).map(id=>analysis.index.supports.get(id)?.characterId));
    used.add(analysis.index.characters.get(profile.characterId)?.characterId);
    const covered=new Set(acquisitionRoutes({...profile,supports,eventChoices},analysis.index,'factor').keys());
    const options=catalog.supports.filter(s=>!used.has(s.characterId)).flatMap(s=>supportOptions(s,analysis.index));
    const next=bestOption(options,targets,focus,covered);
    if(next&&coverageScore(next,targets,focus,covered)>0){supports[slot]=next.support.id;Object.assign(eventChoices,next.eventChoices);}
  }
  return normalizeFarmingProfile({...profile,supports,eventChoices,anchorSupportId:supports.includes(profile.anchorSupportId)?profile.anchorSupportId:null,farmingPolicy:FARMING_POLICY},catalog);
}

export function completeFactorChoices(profile,analysis,focus,catalog) {
  const targets=farmingTargets(analysis,focus),eventChoices={...profile.eventChoices};
  for(const id of profile.supports){const support=analysis.index.supports.get(id);if(!support)continue;
    let options=supportOptions(support,analysis.index);
    options=options.filter(o=>support.events.filter(e=>e.selection==='single').every(e=>!Object.hasOwn(eventChoices,e.id)||eventChoices[e.id]===''||!e.choices.some(c=>c.id===eventChoices[e.id])||o.eventChoices[e.id]===eventChoices[e.id]));
    const best=bestOption(options,targets,focus);
    for(const[k,v]of Object.entries(best?.eventChoices??{}))if(!Object.hasOwn(eventChoices,k))eventChoices[k]=v;
  }
  return normalizeFarmingProfile({...profile,eventChoices},catalog);
}

export function analyzeFactorPlan(profile,analysis,focus) {
  const routes=acquisitionRoutes(profile,analysis.index,'factor');
  if(profile.scenario==='ura')for(const name of Object.keys(URA_METHODS)){const skill=analysis.index.normalByName.get(name);if(skill){const list=routes.get(skill.id)??[];routes.set(skill.id,[...list,{kind:'scenario',label:`URA：ハッピーミークとの対決「${URA_METHODS[name]}」に成功`}]);}}
  const targets=farmingTargets(analysis,focus).map(r=>({...r,farmingRoutes:routes.get(r.skillId)??[],canAcquire:routes.has(r.skillId),learned:profile.learned.includes(r.name)}));
  const inheritedTargets=inheritedFarmingTargets(analysis,focus).map(r=>({...r,farmingRoutes:routes.get(r.skillId)??[],canAcquire:routes.has(r.skillId),learned:profile.learned.includes(r.name)}));
  return{targets,inheritedTargets,covered:targets.filter(r=>r.canAcquire),missing:targets.filter(r=>!r.canAcquire),routes,parent:analysis.index.characters.get(profile.characterId),uniqueReady:!!(focus.inherited&&profile.characterId===focus.ownerId)};
}
