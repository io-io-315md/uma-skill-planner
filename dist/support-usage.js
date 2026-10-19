export const DISTANCES=['短距離','マイル','中距離','長距離'];
export const RUN_STYLES=['逃げ','先行','差し','追込'];
const SURFACES=['芝','ダート'];
const axes={distances:DISTANCES,styles:RUN_STYLES,surfaces:SURFACES};

// 対戦相手へのけん制や「前方」を、自分の脚質制限とは解釈しない。
export function parseSkillTargets(description) {
  if(typeof description!=='string'||!description)return null;
  const qualifiers=[...description.matchAll(/[＜<]([^＞>]+)[＞>]/g)].map(m=>m[1]).join('・');
  return Object.fromEntries(Object.entries(axes).map(([axis,values])=>[axis,values.filter(v=>qualifiers.includes(v))]));
}

export function skillMatchesRace(skill,course={},style) {
  if(!skill?.targets)return true;
  const {distances=[],styles=[],surfaces=[]}=skill.targets;
  const distance=course.distanceType??(course.distance?course.distance<=1400?'短距離':course.distance<=1800?'マイル':course.distance<=2400?'中距離':'長距離':null);
  return (!distance||!distances.length||distances.includes(distance))&&(!style||!styles.length||styles.includes(style))&&
    (!course.surface||!surfaces.length||surfaces.includes(course.surface));
}

export function targetLabel(targets) {
  if(!targets)return '対象未確認';
  return [(targets.distances?.length?targets.distances.join('・'):'全距離'),
    (targets.styles?.length?targets.styles.join('・'):'汎用'),
    ...(targets.surfaces?.includes('ダート')?['ダート']:[])].join(' / ');
}

function routeFor(ids,skills,verified=true) {
  const targets=Object.fromEntries(Object.entries(axes).map(([key,all])=>[key,[...all]]));
  let unknown=false;
  for(const id of ids){
    const target=skills.get(id)?.targets;
    if(!target){unknown=true;continue;}
    for(const [key,all] of Object.entries(axes))if(target[key]?.length)targets[key]=targets[key].filter(v=>target[key].includes(v));
  }
  return {skillIds:[...new Set(ids)],targets,verified,unknown};
}
const valid=route=>Object.values(route.targets).every(values=>values.length);
const unrestricted=targets=>Object.fromEntries(Object.entries(axes).map(([key,all])=>[key,targets[key].length===all.length?[]:targets[key]]));
const contains=(a,b)=>Object.keys(axes).every(key=>b.targets[key].every(v=>a.targets[key].includes(v)));

export function classifySupport(support,skills) {
  const skillIds=[...new Set([...support.hintSkills,...support.eventSkills,...support.events.flatMap(e=>[...(e.skills??[]),...(e.choices??[]).flatMap(c=>c.skills)])])];
  const goldIds=ids=>ids.filter(id=>skills.get(id)?.rarity===2);
  const fixed=[...goldIds(support.eventSkills),...support.events.filter(e=>e.selection!=='single').flatMap(e=>goldIds(e.skills))];
  let groups=[fixed],hasGold=!!fixed.length;
  for(const event of support.events.filter(e=>e.selection==='single')){
    const choices=event.choices.map(c=>goldIds(c.skills)).filter(ids=>ids.length);
    if(choices.length){hasGold=true;groups=groups.flatMap(base=>choices.map(ids=>[...base,...ids]));}
  }
  let basis='gold';
  const unverified=goldIds(support.eventSkills).length>1;
  let routes=hasGold?groups.map(ids=>routeFor(ids,skills,!unverified)):
    skillIds.map(id=>routeFor([id],skills));
  if(!hasGold)basis=routes.length?'white':'none';
  const conflicting=routes.some(r=>!valid(r));
  // 択の詳細が未登録で金スキルの対象が交わらない場合は個別の対象を残す。
  if(conflicting)routes=routes.flatMap(r=>valid(r)?[r]:r.skillIds.map(id=>routeFor([id],skills,false)));
  routes=routes.filter(valid);
  const known=routes.filter(r=>!r.unknown);
  const contexts=known.flatMap(r=>r.targets.distances.flatMap(distance=>r.targets.styles.flatMap(style=>r.targets.surfaces.map(surface=>({distance,style,surface})))));
  const hasDirt=skillIds.some(id=>skills.get(id)?.targets?.surfaces.includes('ダート'));
  const goldSkillIds=skillIds.filter(id=>skills.get(id)?.rarity===2);
  const summaries=known.filter((route,i)=>!known.some((other,j)=>j!==i&&contains(other,route)&&(!contains(route,other)||j<i)));
  const labels=[...new Set(summaries.map(r=>targetLabel(unrestricted(r.targets))))];
  return {basis,routes,contexts,hasDirt,goldSkillIds,skillIds,uncertain:unverified||conflicting||routes.some(r=>r.unknown),
    label:labels.length?labels.join(' ／ '):'対象未確認'};
}

export function createSupportUsageIndex(catalog) {
  const skills=new Map(catalog.skills.map(s=>[s.id,s]));
  return new Map(catalog.supports.map(s=>[s.id,classifySupport(s,skills)]));
}

export function matchesSupportUsage(usage,{distance='すべて',style='すべて',surface,dirtOnly=false}={}) {
  if(!usage)return false;
  if(dirtOnly)surface='ダート';
  const distances=distance==='汎用'?DISTANCES:distance==='すべて'?[null]:[distance];
  const styles=style==='汎用'?RUN_STYLES:style==='すべて'?[null]:[style];
  return distances.every(d=>styles.every(s=>usage.contexts.some(c=>(!d||c.distance===d)&&(!s||c.style===s)&&(!surface||c.surface===surface))));
}
