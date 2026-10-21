import { COURSES, RECOMMENDATIONS, STYLES, SOURCES, LIVE_METADATA } from './recommendations.js';
import { resolvePriority, PRIORITIES } from './priorities.js';
import { normalizeMainSupports, normalizeFarmingSupports, FIXED_SUPPORT_ID, FIXED_SUPPORT_SLOT } from './deck-rules.js';
import { RED_FACTORS, redFactorDetails } from './factor-targets.js';
import { skillMatchesRace } from './support-usage.js';
import { FARMING_POLICY, INHERITED_FACTOR_NOTE, usesInheritedFactor } from './farming-policy.js';
export { PRIORITIES } from './priorities.js';

export const TYPE_LABELS = { speed: 'スピード', stamina: 'スタミナ', power: 'パワー', guts: '根性', wit: '賢さ', friend: '友人', group: 'グループ' };
export const DEFAULT_STATE = { version: 2, courseId: COURSES[0].id, style: '先行', characterId: null, awakening: 5, supports: [null,null,null,null,null,FIXED_SUPPORT_ID], eventChoices: {}, mainDeck:{mode:'auto'}, supplied: [], prepared: [], excluded: [], farmingPlans: {}, lineagePlans: {}, plans: [] };

export function normalizeFarmingProfile(raw, catalog) {
  const profile=raw&&typeof raw==='object'?raw:{};
  const char=catalog.characters.find(c=>c.id===Number(profile.characterId));
  return {
    characterId:char?.id??null,
    supports:normalizeFarmingSupports(profile.supports,catalog,char?.characterId),
    redFactor:RED_FACTORS.includes(profile.redFactor?.type)?{type:profile.redFactor.type,stars:[1,2,3].includes(profile.redFactor.stars)?profile.redFactor.stars:3}:null,
    eventChoices:profile.eventChoices&&typeof profile.eventChoices==='object'&&!Array.isArray(profile.eventChoices)?Object.fromEntries(Object.entries(profile.eventChoices).filter(([k,v])=>k.startsWith('evt_')&&typeof v==='string')):{},
    learned:Array.isArray(profile.learned)?[...new Set(profile.learned.filter(s=>typeof s==='string'))]:[],
    anchorSupportId:catalog.supports.some(s=>s.id===Number(profile.anchorSupportId))?Number(profile.anchorSupportId):null,
    farmingPolicy:profile.farmingPolicy===FARMING_POLICY?FARMING_POLICY:'',
    scenario:profile.scenario==='ura'?'ura':'support'
  };
}

export function normalizeLineagePlan(raw,catalog,mainCharacterId=null) {
  const plan=raw&&typeof raw==='object'?raw:{};
  const seen=new Set([catalog.characters.find(c=>c.id===mainCharacterId)?.characterId]);
  const nodes=Array.from({length:6},(_,i)=>{
    const profile=normalizeFarmingProfile(plan.nodes?.[i],catalog);
    const character=catalog.characters.find(c=>c.id===profile.characterId);
    if(character&&seen.has(character.characterId))return normalizeFarmingProfile({...profile,characterId:null},catalog);
    if(character)seen.add(character.characterId);
    return profile;
  });
  return {nodes,friendSide:plan.friendSide===0?0:1,manual:plan.manual===true,signature:typeof plan.signature==='string'?plan.signature.slice(0,12000):''};
}

export function normalizeState(raw, catalog) {
  const state = { ...structuredClone(DEFAULT_STATE), ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!COURSES.some(c => c.id === state.courseId)) state.courseId = DEFAULT_STATE.courseId;
  if (!STYLES.includes(state.style)) state.style = DEFAULT_STATE.style;
  if (!catalog.characters.some(c => c.id === Number(state.characterId))) state.characterId = null;
  else state.characterId = Number(state.characterId);
  const char = catalog.characters.find(c => c.id === state.characterId);
  state.awakening = char ? char.awakening.length + 1 : 5;
  state.supports=normalizeMainSupports(state.supports,catalog,char?.characterId);
  for (const key of ['supplied','prepared','excluded']) state[key] = Array.isArray(state[key]) ? [...new Set(state[key].filter(x => typeof x === 'string'))] : [];
  if (!state.eventChoices || typeof state.eventChoices !== 'object' || Array.isArray(state.eventChoices)) state.eventChoices = {};
  const eventIndex=createIndex(catalog);
  const events=new Map(catalog.supports.flatMap(s=>s.events.filter(e=>e.selection==='single').map(e=>[e.id,e])));
  state.eventChoices=Object.fromEntries(Object.entries(state.eventChoices).filter(([id,value])=>typeof value==='string'&&events.has(id)&&(value===''||eventChoicesForPurpose(events.get(id),eventIndex,'main').some(c=>c.id===value))));
  const deck=state.mainDeck&&typeof state.mainDeck==='object'?state.mainDeck:{};
  state.mainDeck={mode:deck.mode==='manual'?'manual':'auto',revision:typeof deck.revision==='string'?deck.revision.slice(0,100):'',status:deck.status==='reviewed'?'reviewed':'provisional',sourceIds:Array.isArray(deck.sourceIds)?deck.sourceIds.filter(id=>typeof id==='string').slice(0,12):[],reasons:Array.isArray(deck.reasons)?deck.reasons.filter(r=>r&&Number.isInteger(r.slot)&&r.slot>=0&&r.slot<5&&catalog.supports.some(c=>c.id===r.cardId)).map(r=>({slot:r.slot,cardId:r.cardId,replacement:r.replacement===true,gold:Array.isArray(r.gold)?r.gold.filter(n=>typeof n==='string').slice(0,6):[]})):[]};
  state.plans = Array.isArray(state.plans) ? state.plans.filter(p => p && typeof p.label === 'string' && p.state && typeof p.state === 'object').slice(0,20) : [];
  state.version=2;
  state.farmingPlans=state.farmingPlans&&typeof state.farmingPlans==='object'&&!Array.isArray(state.farmingPlans)?Object.fromEntries(Object.entries(state.farmingPlans).filter(([key,value])=>key.length<250&&value&&typeof value==='object').slice(-120).map(([key,value])=>[key,normalizeFarmingProfile(value,catalog)])):{};
  state.lineagePlans=state.lineagePlans&&typeof state.lineagePlans==='object'&&!Array.isArray(state.lineagePlans)?Object.fromEntries(Object.entries(state.lineagePlans).filter(([key,value])=>key.length<250&&value&&typeof value==='object').slice(-30).map(([key,value])=>[key,normalizeLineagePlan(value,catalog,Number(key.split(':').at(-1)))])):{};
  return state;
}

export function createIndex(catalog) {
  const skills = new Map(catalog.skills.map(s => [s.id, s]));
  const normalByName = new Map(catalog.skills.filter(s => !s.inherited && s.id < 900000 && s.rarity < 3).map(s => [s.name, s]));
  const uniqueByName = new Map(catalog.skills.filter(s => s.inherited).map(s => [s.name, s]));
  return { skills, normalByName, uniqueByName, characters: new Map(catalog.characters.map(c => [c.id,c])), supports: new Map(catalog.supports.map(c => [c.id,c])) };
}

// 上位ヒントから下位を取れる。下位白から金を取れるとはみなさない。
export function lowerClosure(id, index) {
  const ids = new Set();
  while (id && !ids.has(id)) { ids.add(id); id = index.skills.get(id)?.lowerId; }
  return [...ids];
}

export function eventChoicesForPurpose(event, index, purpose='main') {
  const gold=event.choices.filter(c=>c.skills.some(id=>index.skills.get(id)?.rarity===2));
  return purpose==='main'&&gold.length?gold:event.choices;
}

export function resolvedEventChoice(event, state, index, purpose='main') {
  const choices=eventChoicesForPurpose(event,index,purpose);
  const explicit=choices.find(c=>c.id===state.eventChoices?.[event.id]);
  if(explicit)return explicit;
  if(purpose!=='main'||!choices.some(c=>c.skills.some(id=>index.skills.get(id)?.rarity===2)))return null;
  const recommendations=RECOMMENDATIONS.filter(r=>r.courses.includes(state.courseId)&&r.styles.includes(state.style));
  const course=COURSES.find(c=>c.id===state.courseId)??{};
  const score=choice=>{
    const ids=new Set(choice.skills.flatMap(id=>lowerClosure(id,index)));
    const inactiveGold=choice.skills.filter(id=>index.skills.get(id)?.rarity===2&&!skillMatchesRace(index.skills.get(id),course,state.style)).length;
    return -1000*inactiveGold+recommendations.reduce((sum,r)=>sum+(ids.has(index.normalByName.get(r.name)?.id)?[0,12,4,1][resolvePriority(r,state.courseId,state.style).priority]:0),0)+choice.skills.filter(id=>index.skills.get(id)?.rarity===2).length/100;
  };
  return [...choices].sort((a,b)=>score(b)-score(a)||(a.id===event.defaultChoiceId?-1:b.id===event.defaultChoiceId?1:0))[0]??null;
}

export function acquisitionRoutes(state, index, purpose='main') {
  const routes = new Map();
  const add = (id, route) => {
    for (const lower of lowerClosure(id, index)) {
      if (!routes.has(lower)) routes.set(lower, []);
      if (!routes.get(lower).some(r => r.label === route.label && r.kind === route.kind)) routes.get(lower).push(route);
    }
  };
  const char = index.characters.get(state.characterId);
  if (char) {
    char.innate.forEach(id => add(id, { kind: 'native', label: `${char.characterName}の初期スキル` }));
    char.awakening.forEach((id, i) => add(id, { kind: 'native', label: `自前・覚醒Lv${i+2}` }));
    char.eventSkills.forEach(id => add(id, { kind: 'character-event', label: '育成キャラのイベント候補（条件あり）' }));
  }
  for (const id of state.supports) {
    const support = index.supports.get(id);
    if (!support) continue;
    const label = `${TYPE_LABELS[support.type]}・${support.characterName}`;
    support.hintSkills.forEach(skill => add(skill, { kind: 'hint', label: `${label}の所持ヒント` }));
    support.eventSkills.forEach(skill => add(skill, { kind: 'event-unverified', label: `${label}のイベント候補（選択・成功条件を確認）` }));
    for (const event of support.events) {
      if (event.selection === 'single') {
        const choice = resolvedEventChoice(event,state,index,purpose);
        if (choice) choice.skills.forEach(skill => add(skill, { kind: 'event', label: `${label}：${choice.label}` }));
      } else event.skills.forEach(skill => add(skill, { kind: 'event', label: `${label}のイベント（発生・完走等の条件あり）` }));
    }
  }
  return routes;
}

export function analyze(state, catalog, { purpose='main' }={}) {
  const index = createIndex(catalog);
  const course = COURSES.find(c => c.id === state.courseId) ?? COURSES[0];
  if (!course.confirmed) return { course, rows: [], counts: { all:0, available:0, factor:0, inheritance:0, gold:0 }, index };
  const routes = acquisitionRoutes(state, index, purpose);
  const char = index.characters.get(state.characterId);
  const rows = RECOMMENDATIONS.filter(r => r.courses.includes(course.id) && r.styles.includes(state.style)).map(r => {
    const skill = r.inherited ? index.uniqueByName.get(r.name) : index.normalByName.get(r.name);
    const gold = r.gold ? index.normalByName.get(r.gold) : null;
    const ownerId = skill?.ownerIds?.[0] ?? r.ownerId ?? null;
    const owner = index.characters.get(ownerId);
    const ownUnique = !!(r.inherited && char && owner && char.id === owner.id);
    const sameCharacter = !!(r.inherited && char && owner && char.characterId === owner.characterId && !ownUnique);
    const available = skill ? routes.get(skill.id) ?? [] : [];
    const goldRoutes = gold ? routes.get(gold.id) ?? [] : [];
    const manual = state.supplied.includes(r.name);
    const excluded = state.excluded.includes(r.name);
    let status = 'factor';
    if (r.inherited) status = ownUnique ? 'own-unique' : sameCharacter ? 'incompatible' : 'inheritance';
    else if (manual) status = 'manual';
    else if (available.length || goldRoutes.length) status = [...available, ...goldRoutes].every(a => a.kind === 'event-unverified') ? 'event-check' : 'available';
    const alternateEvents=!r.inherited&&status==='factor'?state.supports.flatMap(id=>{const s=index.supports.get(id);return(s?.events??[]).filter(e=>e.selection==='single').flatMap(e=>e.choices.filter(c=>c.id!==resolvedEventChoice(e,state,index,'main')?.id&&c.skills.some(id=>lowerClosure(id,index).includes(skill?.id))).map(c=>({supportId:s.id,label:`${s.name}：${c.label}`})));}):[];
    return { ...r, ...resolvePriority(r, course.id, state.style), skillId: skill?.id, goldId: gold?.id, ownerId, ownerName: owner?.name, status, routes: available, goldRoutes, goldMissing: !!gold && !goldRoutes.length, ownUnique, sameCharacter, excluded, prepared: state.prepared.includes(r.name), note: r.courseNotes?.[course.id] ?? '', factorEligible: !r.inherited && skill?.rarity === 1 && skill.id < 900000, alternateEvents, factorReason:alternateEvents.length?'本育成で選ぶイベント択では取らないため、因子で補う。':'本育成の自前スキル・サポート編成に取得ルートがないため。' };
  }).sort((a,b) => a.priority - b.priority || a.category.localeCompare(b.category, 'ja') || a.name.localeCompare(b.name, 'ja'));
  const active = rows.filter(r => !r.excluded);
  return { course, rows, index, counts: {
    all: active.length,
    available: active.filter(r => ['available','manual','own-unique','event-check'].includes(r.status)).length,
    factor: active.filter(r => r.status === 'factor' && r.factorEligible).length,
    inheritance: active.filter(r => r.status === 'inheritance').length,
    gold: active.filter(r => r.goldMissing).length
  }};
}

export function exportChecklist(state, analysis) {
  const { course, index } = analysis;
  const char = index.characters.get(state.characterId);
  const lines = [`UMAPLAN｜${course.year}年${course.date} ${course.title}`, course.confirmed ? `${course.venue} ${course.surface}${course.distance}m / ${course.turn} / ${course.season} / ${course.weather} / ${course.going}` : 'コース詳細未発表', `育成：${char?.name ?? '未選択'} / ${state.style}（覚醒は最大で判定）`, '', 'サポート編成', ...state.supports.map((id,i) => `${i+1}. ${index.supports.get(id)?.name ?? '未選択'}${i===FIXED_SUPPORT_SLOT?' [固定]':''}`), ''];
  for (const [title, pred] of [
    ['白因子で補う候補', r => r.status === 'factor' && r.factorEligible],
    ['親からの継承候補', r => r.status === 'inheritance'],
    ['編成から入手ルートがある候補', r => ['available','manual','own-unique','event-check'].includes(r.status)],
    ['金スキルの取得経路を要確認（白因子では取得不可）', r => r.goldMissing]
  ]) {
    lines.push(title);
    const rows = analysis.rows.filter(r => !r.excluded && pred(r));
    lines.push(...(rows.length ? rows.map(r => `${r.prepared ? '[x]' : '[ ]'} [優先度 ${PRIORITIES[r.priority]}] ${title.startsWith('金') ? r.gold : r.name}${r.conditionLabel ? `（${r.conditionLabel}）` : ''}${r.evolvedInheritance ? '（本人所持・直接の親・進化条件を確認）' : ''}`) : ['該当なし']), '');
  }
  const prefix=`${state.courseId}:${state.style}:${state.characterId??0}:`;
  const farming=Object.entries(state.farmingPlans??{}).filter(([key])=>key.startsWith(prefix));
  if(farming.length){
    lines.push('因子周回プラン（本育成とは別編成）');
    if(analysis.rows.some(r=>!r.excluded&&r.status==='factor'&&usesInheritedFactor(r)))lines.push(INHERITED_FACTOR_NOTE,'継承ヒントを受け取って習得し、終了時に白因子を確認。継承・因子化は確約しません。');
    for(const[key,plan]of farming){
      lines.push(`対象因子：${key.slice(prefix.length)}`,`周回キャラ：${index.characters.get(plan.characterId)?.name??'未選択'}`,`取得方法：${plan.scenario==='ura'?'URAの対決イベントも使用':'サポートのヒント・イベント'}`);
      const red=redFactorDetails(plan,analysis);lines.push(`指定する赤因子：${red.type}（目標★${red.stars}・星数は抽選）`);
      for(const[id,slot]of plan.supports.map((id,i)=>[id,i])){const support=index.supports.get(id);lines.push(`${slot+1}. ${support?.name??'空き枠'}${slot===FIXED_SUPPORT_SLOT?' [固定]':''}`);for(const event of support?.events??[]){const choice=event.choices.find(c=>c.id===plan.eventChoices[event.id]);if(choice)lines.push(`  因子周回の択：${choice.label}`);}}
      if(plan.learned.length)lines.push(`周回の取得済み：${plan.learned.join(' / ')}（因子の準備完了とは別）`);
      lines.push('');
    }
  }
  lines.push('優先度は編集上の目安。全候補を必須とはしません。ヒント・イベント・因子の発生は確約しません。', '本育成のシナリオ固有の取得経路は自動計上しません。「別ルートで取得」に設定して補ってください。', `参照：${SOURCES[course.source]?.url??SOURCES.official.url} / 確認日：${LIVE_METADATA.verifiedAt}`);
  return lines.join('\n');
}
