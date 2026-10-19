import { acquisitionRoutes, normalizeFarmingProfile, normalizeLineagePlan } from './engine.js';
import { farmingTargets, inheritedFarmingTargets, supportOptions, URA_METHODS, refreshFarmingPolicy } from './factor-planner.js';
import { FARMING_POLICY, INHERITED_FACTOR_NOTE } from './farming-policy.js';
import { FIXED_SUPPORT_ID } from './deck-rules.js';
import { suggestRedFactors, analyzeRedPlan } from './factor-targets.js';

export const LINEAGE_NODES=[
  {label:'親1',side:0,generation:'parent'},
  {label:'親2',side:1,generation:'parent'},
  {label:'祖父母1',side:0,generation:'grandparent'},
  {label:'祖父母2',side:0,generation:'grandparent'},
  {label:'祖父母3',side:1,generation:'grandparent'},
  {label:'祖父母4',side:1,generation:'grandparent'}
];
export const branchIndices=side=>[side,2+side*2,3+side*2];
export const lineagePlanKey=state=>`${state.courseId}:${state.style}:${state.characterId??0}`;
export const lineageSignature=(state,analysis)=>JSON.stringify([FARMING_POLICY,state.supports,Object.entries(state.eventChoices).sort(),state.supplied.slice().sort(),state.excluded.slice().sort(),analysis.rows.map(r=>[r.name,r.priority,r.status,r.excluded])]);
export function refreshLineagePolicy(plan,analysis,catalog){
  return {...plan,nodes:plan.nodes.map(node=>refreshFarmingPolicy(node,analysis,catalog))};
}
export function refreshSavedFarmingPlans(state,analysis,catalog){
  const key=lineagePlanKey(state),prefix=`${key}:`,updates={};
  for(const [savedKey,profile]of Object.entries(state.farmingPlans)){
    if(!savedKey.startsWith(prefix)||profile.farmingPolicy===FARMING_POLICY)continue;
    const focus=analysis.rows.find(row=>row.name===savedKey.slice(prefix.length));
    if(focus)updates[savedKey]=refreshFarmingPolicy(profile,analysis,catalog,focus);
  }
  const old=state.lineagePlans[key];let plan=old;
  if(old?.nodes.some(node=>node.farmingPolicy!==FARMING_POLICY))plan=old.manual?refreshLineagePolicy(old,analysis,catalog):suggestLineagePlan(state,analysis,catalog,{previous:old});
  if(!Object.keys(updates).length&&plan===old)return state;
  return {...state,farmingPlans:{...state.farmingPlans,...updates},lineagePlans:plan===old?state.lineagePlans:{...state.lineagePlans,[key]:plan}};
}
const inheritanceTargets=analysis=>analysis.rows.filter(r=>r.status==='inheritance'&&!r.excluded);
const compare=(a,b)=>{for(let i=0;i<a.length;i++){const diff=a[i]-b[i];if(diff)return diff;}return 0;};
const known=route=>route.kind!=='event-unverified';

export function coverageRoutes(profile,analysis) {
  const routes=acquisitionRoutes(profile,analysis.index,'factor');
  if(profile.scenario==='ura')for(const[name,method]of Object.entries(URA_METHODS)){
    const id=analysis.index.normalByName.get(name)?.id;
    if(id)routes.set(id,[...(routes.get(id)??[]),{kind:'scenario',label:`URA：ハッピーミークとの対決「${method}」に成功`}]);
  }
  return routes;
}

export function analyzeCoverageProfile(profile,analysis) {
  const routes=coverageRoutes(profile,analysis);
  const targets=farmingTargets(analysis).map(row=>{
    const all=routes.get(row.skillId)??[];
    return {...row,farmingRoutes:all.filter(known),uncertainRoutes:all.filter(r=>!known(r)),canAcquire:all.some(known),learned:profile.learned.includes(row.name)};
  });
  const inheritedTargets=inheritedFarmingTargets(analysis).map(row=>({...row,farmingRoutes:(routes.get(row.skillId)??[]).filter(known),learned:profile.learned.includes(row.name)}));
  return {targets,inheritedTargets,covered:targets.filter(r=>r.canAcquire),missing:targets.filter(r=>!r.canAcquire),routes};
}

// Lexicographic counts: a high-priority skill always precedes any number of
// medium/low skills. These are coverage counts, never hint probabilities.
function coverageVector(covered,targets,alreadyCovered=new Set()) {
  return [1,2,3].flatMap(priority=>{
    const rows=targets.filter(r=>r.priority===priority&&covered.has(r.skillId));
    return [rows.filter(r=>!alreadyCovered.has(r.skillId)).length,rows.length];
  });
}
const optionIds=option=>[...option.skills].filter(([,kind])=>kind!=='event-unverified').map(([id])=>id);
const recency=option=>[option.support.releaseDate??'',option.support.id];
const newer=(a,b)=>recency(a)[0].localeCompare(recency(b)[0])||recency(a)[1]-recency(b)[1];

export function suggestCoverageDeck(characterId,analysis,catalog,{alreadyCovered=new Set(),scenario='support',options:cachedOptions}={}) {
  const targets=farmingTargets(analysis),parent=analysis.index.characters.get(characterId);
  const fixed=catalog.supports.find(s=>s.id===FIXED_SUPPORT_ID),limit=fixed?5:6;
  const targetIds=new Set(targets.map(r=>r.skillId));
  const options=(cachedOptions??catalog.supports.flatMap(s=>supportOptions(s,analysis.index))).filter(o=>o.support.characterId!==parent?.characterId&&o.support.characterId!==fixed?.characterId)
    .map(o=>({...o,ids:optionIds(o).filter(id=>targetIds.has(id))})).filter(o=>o.ids.length);
  const native=new Set([...coverageRoutes({characterId,supports:fixed?[fixed.id]:[],eventChoices:{},scenario},analysis)].filter(([,r])=>r.some(known)).map(([id])=>id));
  const union=deck=>new Set([...native,...deck.flatMap(o=>o.ids)]);
  const score=deck=>coverageVector(union(deck),targets,alreadyCovered);
  const bestOf=(candidates,deck)=>{
    let best,bestScore;
    for(const candidate of candidates){const value=score([...deck,candidate]);if(!best||compare(value,bestScore)>0||(compare(value,bestScore)===0&&newer(candidate,best)>0)){best=candidate;bestScore=value;}}
    return best;
  };
  function search(seed){
    const chosen=seed?[seed]:[];
    while(chosen.length<limit){
      const used=new Set(chosen.map(o=>o.support.characterId));
      const next=bestOf(options.filter(o=>!used.has(o.support.characterId)),chosen);
      if(!next||compare(score([...chosen,next]),score(chosen))<=0)break;
      chosen.push(next);
    }
    for(let pass=0;pass<6;pass++){
      let improvement=null;
      const currentScore=score(chosen);
      for(let slot=0;slot<chosen.length;slot++){
        const rest=chosen.filter((_,i)=>i!==slot),used=new Set(rest.map(o=>o.support.characterId));
        const next=bestOf(options.filter(o=>!used.has(o.support.characterId)),rest);
        if(next&&compare(score([...rest,next]),currentScore)>0&&(!improvement||compare(score([...rest,next]),improvement.score)>0))improvement={slot,next,score:score([...rest,next])};
      }
      if(!improvement)break;
      chosen[improvement.slot]=improvement.next;
    }
    return chosen;
  }
  // Retry from a source of each high-priority skill. This avoids a broad card
  // blocking another card of the same character with an essential white choice.
  const seeds=[null,...targets.filter(r=>r.priority===1&&!native.has(r.skillId)).map(r=>bestOf(options.filter(o=>o.ids.includes(r.skillId)),[]))].filter((s,i,a)=>i===0||s&&!a.slice(1,i).some(o=>o?.support.id===s.support.id&&JSON.stringify(o.eventChoices)===JSON.stringify(s.eventChoices)));
  let chosen=[];
  for(const seed of seeds){const candidate=search(seed);if(compare(score(candidate),score(chosen))>0)chosen=candidate;}
  return normalizeFarmingProfile({characterId,supports:[...Array.from({length:limit},(_,i)=>chosen[i]?.support.id??null),...(fixed?[fixed.id]:[])],eventChoices:Object.assign({},...chosen.map(o=>o.eventChoices)),scenario,farmingPolicy:FARMING_POLICY},catalog);
}

export function completeCoverageChoices(profile,analysis,catalog) {
  const eventChoices={...profile.eventChoices},targets=farmingTargets(analysis);
  for(const id of profile.supports){
    const support=analysis.index.supports.get(id);if(!support)continue;
    const options=supportOptions(support,analysis.index).filter(o=>support.events.filter(e=>e.selection==='single').every(e=>!Object.hasOwn(eventChoices,e.id)||eventChoices[e.id]===''||!e.choices.some(c=>c.id===eventChoices[e.id])||o.eventChoices[e.id]===eventChoices[e.id]));
    options.sort((a,b)=>compare(coverageVector(new Set(optionIds(b)),targets),coverageVector(new Set(optionIds(a)),targets)));
    for(const[key,value]of Object.entries(options[0]?.eventChoices??{}))if(!Object.hasOwn(eventChoices,key))eventChoices[key]=value;
  }
  return normalizeFarmingProfile({...profile,eventChoices},catalog);
}

function suggestCharacters(state,analysis,catalog,options) {
  const main=analysis.index.characters.get(state.characterId),used=new Set([main?.characterId]);
  const rows=inheritanceTargets(analysis).sort((a,b)=>Number(b.evolvedInheritance??false)-Number(a.evolvedInheritance??false)||a.priority-b.priority);
  const ids=[];
  for(const row of rows){
    const character=analysis.index.characters.get(row.ownerId);
    if(!character||used.has(character.characterId))continue;
    ids.push(character.id);used.add(character.characterId);if(ids.length===2)break;
  }
  const targets=farmingTargets(analysis);
  const fallback=catalog.characters.map(character=>{
    const native=acquisitionRoutes({characterId:character.id,supports:[],eventChoices:{}},analysis.index,'factor');
    return {character,score:coverageVector(new Set(native.keys()),targets)};
  }).sort((a,b)=>compare(b.score,a.score)||(b.character.releaseDate??'').localeCompare(a.character.releaseDate??'')||b.character.id-a.character.id);
  while(ids.length<2){const next=fallback.find(({character})=>!used.has(character.characterId));if(!next)break;ids.push(next.character.id);used.add(next.character.characterId);}
  // Grandparents can supply white skills no support card currently teaches.
  // Reserve space for a registered native source before optional unique skills.
  const supportIds=new Set(options.flatMap(optionIds));
  const nativeIds=id=>new Set(acquisitionRoutes({characterId:id,supports:[],eventChoices:{}},analysis.index,'factor').keys());
  const nativeCovered=new Set(ids.flatMap(id=>[...nativeIds(id)]));
  const hard=targets.filter(r=>!supportIds.has(r.skillId)&&!Object.hasOwn(URA_METHODS,r.name)&&!nativeCovered.has(r.skillId));
  while(ids.length<6){
    const possible=fallback.filter(({character})=>!used.has(character.characterId)).map(({character})=>({character,ids:nativeIds(character.id)})).filter(candidate=>hard.some(r=>!nativeCovered.has(r.skillId)&&candidate.ids.has(r.skillId)));
    possible.sort((a,b)=>compare(coverageVector(b.ids,hard,nativeCovered),coverageVector(a.ids,hard,nativeCovered)));
    const next=possible[0];if(!next||!hard.some(r=>!nativeCovered.has(r.skillId)&&next.ids.has(r.skillId)))break;
    ids.push(next.character.id);used.add(next.character.characterId);next.ids.forEach(id=>nativeCovered.add(id));
  }
  for(const row of rows){
    const character=analysis.index.characters.get(row.ownerId);
    if(ids.length===6)break;
    if(!character||used.has(character.characterId)||row.evolvedInheritance)continue;
    ids.push(character.id);used.add(character.characterId);
  }
  for(const {character}of fallback){if(ids.length===6)break;if(used.has(character.characterId))continue;ids.push(character.id);used.add(character.characterId);}
  return Array.from({length:6},(_,i)=>ids[i]??null);
}

export function suggestLineagePlan(state,analysis,catalog,{previous,resetTree=false}={}) {
  const seed=previous&&!resetTree?normalizeLineagePlan(previous,catalog,state.characterId):null;
  const options=catalog.supports.flatMap(s=>supportOptions(s,analysis.index)); // SSR, SR and R alike.
  const ids=seed?seed.nodes.map(n=>n.characterId):suggestCharacters(state,analysis,catalog,options);
  const alreadyCovered=new Set(),nodes=[];
  for(let i=0;i<6;i++){
    const node=suggestCoverageDeck(ids[i],analysis,catalog,{alreadyCovered,options,scenario:seed?.nodes[i].scenario??'support'});
    node.redFactor=seed?.nodes[i].redFactor??null;
    nodes.push(node);analyzeCoverageProfile(node,analysis).covered.forEach(r=>alreadyCovered.add(r.skillId));
  }
  // On an initial proposal, compare one URA grandparent as a complement when
  // the six support-based rounds still have no route to a Shinzui target.
  const targets=farmingTargets(analysis);
  if(!seed&&targets.some(r=>Object.hasOwn(URA_METHODS,r.name)&&!alreadyCovered.has(r.skillId))){
    let best=null,bestScore=coverageVector(alreadyCovered,targets);
    for(let slot=2;slot<6;slot++){
      const rest=new Set(nodes.filter((_,i)=>i!==slot).flatMap(n=>analyzeCoverageProfile(n,analysis).covered.map(r=>r.skillId)));
      const node=suggestCoverageDeck(ids[slot],analysis,catalog,{alreadyCovered:rest,options,scenario:'ura'});
      const all=new Set([...rest,...analyzeCoverageProfile(node,analysis).covered.map(r=>r.skillId)]),value=coverageVector(all,targets);
      if(compare(value,bestScore)>0){best={slot,node};bestScore=value;}
    }
    if(best){best.node.redFactor=nodes[best.slot].redFactor;nodes[best.slot]=best.node;}
  }
  suggestRedFactors(state,analysis,nodes).forEach((redFactor,i)=>nodes[i].redFactor=redFactor);
  return normalizeLineagePlan({nodes,friendSide:seed?.friendSide??1,signature:lineageSignature(state,analysis),manual:false},catalog,state.characterId);
}

export function analyzeLineagePlan(plan,analysis) {
  const results=plan.nodes.map(n=>analyzeCoverageProfile(n,analysis)),targets=farmingTargets(analysis);
  const assignments=Array.from({length:6},()=>[]);
  for(const row of targets){
    const possible=results.map((r,i)=>({i,available:r.covered.some(t=>t.skillId===row.skillId)})).filter(r=>r.available);
    // Repeat high-priority factors on both direct parents where obtainable;
    // distribute remaining skills to balance the preparation work.
    const selected=row.priority===1?possible.filter(r=>r.i<2).map(r=>r.i):[];
    const count=row.priority===1?2:row.priority===2?2:1;
    while(selected.length<Math.min(count,possible.length)){
      const next=possible.filter(r=>!selected.includes(r.i)).sort((a,b)=>assignments[a.i].length-assignments[b.i].length||a.i-b.i)[0];
      if(!next)break;selected.push(next.i);
    }
    selected.forEach(i=>assignments[i].push(row));
  }
  const covered=targets.filter(r=>results.some(result=>result.covered.some(t=>t.skillId===r.skillId)));
  const missing=targets.filter(r=>!covered.some(t=>t.skillId===r.skillId));
  const inheritance=inheritanceTargets(analysis).map(row=>{
    const node=plan.nodes.findIndex(n=>n.characterId===row.ownerId);
    return {...row,node,placement:node<0?'unplaced':node<2?'parent':'grandparent',evolutionPossible:!!(row.evolvedInheritance&&node>=0&&node<2)};
  });
  const friendNodes=branchIndices(plan.friendSide),ownNodes=branchIndices(1-plan.friendSide);
  const friendTargets=targets.filter(r=>friendNodes.some(i=>assignments[i].some(t=>t.skillId===r.skillId)));
  const friendOnly=targets.filter(r=>friendNodes.some(i=>results[i].covered.some(t=>t.skillId===r.skillId))&&!ownNodes.some(i=>results[i].covered.some(t=>t.skillId===r.skillId)));
  return {results,targets,inheritedTargets:inheritedFarmingTargets(analysis),covered,missing,assignments,inheritance,friendTargets,friendOnly,friendNodes,ownNodes};
}

export function exportLineagePlan(plan,analysis,state={}) {
  plan=refreshLineagePolicy(plan,analysis,{characters:[...analysis.index.characters.values()],supports:[...analysis.index.supports.values()]});
  const result=analyzeLineagePlan(plan,analysis),lines=['親・祖父母の因子設計'];
  if(result.inheritedTargets.length)lines.push(INHERITED_FACTOR_NOTE,'体は周回編成のカバー件数に含めず、各個体の継承ヒントから習得して白因子を狙う。');
  const red=analyzeRedPlan(state,analysis,plan);
  for(let i=0;i<6;i++){
    const node=plan.nodes[i],meta=LINEAGE_NODES[i],character=analysis.index.characters.get(node.characterId);
    const borrowed=meta.side===plan.friendSide;
    lines.push(`${meta.label}：${character?.name??'未指定'} [${i<2?(borrowed?'フレンド':'自前'):(borrowed?'フレンド側の祖父母':'自前側の祖父母')}]`);
    const unique=result.inheritance.find(r=>r.node===i);
    if(unique)lines.push(`固有：${unique.name}${unique.evolvedInheritance?(i<2?'（直接親・対象衣装の本人所持が必要）':'（祖父母では継承進化不可）'):i<2?'（直接親）':'（育成中の継承抽選）'}`);
    lines.push(`用意する白因子：${result.assignments[i].map(r=>`[${['','高','中','低'][r.priority]}] ${r.name}`).join(' / ')||'取得ルート・手持ちに応じて追加'}`);
    if(result.inheritedTargets.length)lines.push(`既存因子から引き継ぐ白因子：${result.inheritedTargets.map(r=>`[${['','高','中','低'][r.priority]}] ${r.name}`).join(' / ')}（継承ヒント・白因子化を確認）`);
    lines.push(`指定する赤因子：${red.targets[i].type}（目標★${red.targets[i].stars}・星数は抽選）`,red.targets[i].preparation);
    lines.push(`因子厳選サポカ：${node.supports.map((id,slot)=>(analysis.index.supports.get(id)?.name??'自由枠')+(slot===5?' [自前・固定]':'')).join(' / ')}`);
    for(const id of node.supports){const support=analysis.index.supports.get(id);for(const event of support?.events??[]){const choice=event.choices.find(c=>c.id===node.eventChoices[event.id]);if(choice)lines.push(`  ${support.characterName}の択：${choice.label}`);}}
    if(node.scenario==='ura')lines.push('URAの真髄対決イベントも使用');
  }
  if(result.inheritedTargets.length)lines.push(`フレンド因子にも含める前提：${result.inheritedTargets.map(r=>r.name).join(' / ')}（代表・祖父母の白因子を確認）`);
  lines.push(`フレンド側で補う白因子：${result.friendOnly.map(r=>r.name).join(' / ')||'自前側と重ねて確保'}`,`6人の編成でも取得元が足りない白因子：${result.missing.map(r=>r.name).join(' / ')||'なし'}`,'相性・共通勝利レース・所持/凸数は未評価。白因子化・継承は抽選。');
  return lines.join('\n');
}
