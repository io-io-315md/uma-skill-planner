export const FIXED_SUPPORT_ID=30323;
export const LEGACY_FIXED_SUPPORT_ID=30305;
export const FIXED_SUPPORT_SLOT=5;
export const RENTAL_SUPPORT_SLOT=4;
export const CURRENT_SCENARIO='駿大祭';
export const farmingFixedSupportId=scenario=>['ura','tracen'].includes(scenario)?LEGACY_FIXED_SUPPORT_ID:FIXED_SUPPORT_ID;
export const farmingScenarioLabel=scenario=>scenario==='ura'?'URA':scenario==='tracen'?'トレセン軒':CURRENT_SCENARIO;

export function normalizeFarmingSupports(raw,catalog,traineeCharacterId,scenario='support') {
  const fixedId=farmingFixedSupportId(scenario),retired=fixedId===FIXED_SUPPORT_ID?LEGACY_FIXED_SUPPORT_ID:FIXED_SUPPORT_ID;
  const fixed=catalog.supports.find(s=>s.id===fixedId);
  const slots=Array.from({length:6},(_,i)=>Number(raw?.[i])||null);
  const seen=new Set(fixed?[fixed.characterId]:[]);
  const limit=fixed?5:6;
  const result=slots.slice(0,limit).map(id=>{
    const card=catalog.supports.find(s=>s.id===id);
    if(!card||card.characterId===traineeCharacterId||seen.has(card.characterId))return null;
    seen.add(card.characterId);return card.id;
  });
  const displaced=fixed&&catalog.supports.find(s=>s.id===slots[5]);
  if(displaced&&displaced.id!==retired&&displaced.characterId!==traineeCharacterId&&!seen.has(displaced.characterId)&&result.includes(null))result[result.indexOf(null)]=displaced.id;
  return fixed?[...result,fixed.id]:result;
}

export function normalizeMainSupports(raw,catalog,traineeCharacterId) {
  const fixed=catalog.supports.find(s=>s.id===FIXED_SUPPORT_ID);
  const slots=Array.from({length:6},(_,i)=>Number(raw?.[i])||null);
  const seen=new Set(fixed?[fixed.characterId]:[]);
  const result=slots.slice(0,5).map(id=>{
    const card=catalog.supports.find(s=>s.id===id);
    if(!card||card.rarity!=='SSR'||card.characterId===traineeCharacterId||seen.has(card.characterId))return null;
    seen.add(card.characterId);return card.id;
  });
  // 固定友人の移動で空いた枠には元の6枚目を残す。前シナリオの固定友人は移さない。
  const displaced=catalog.supports.find(s=>s.id===slots[5]);
  if(displaced&&displaced.id!==LEGACY_FIXED_SUPPORT_ID&&displaced.rarity==='SSR'&&displaced.characterId!==traineeCharacterId&&!seen.has(displaced.characterId)&&result.includes(null))result[result.indexOf(null)]=displaced.id;
  return [...result,fixed?.id??null];
}
