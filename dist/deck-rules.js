export const FIXED_SUPPORT_ID=30305;
export const FIXED_SUPPORT_SLOT=5;
export const RENTAL_SUPPORT_SLOT=4;

export function normalizeMainSupports(raw,catalog,traineeCharacterId) {
  const fixed=catalog.supports.find(s=>s.id===FIXED_SUPPORT_ID);
  const slots=Array.from({length:6},(_,i)=>Number(raw?.[i])||null);
  const seen=new Set(fixed?[fixed.characterId]:[]);
  const result=slots.slice(0,5).map(id=>{
    const card=catalog.supports.find(s=>s.id===id);
    if(!card||card.rarity!=='SSR'||card.characterId===traineeCharacterId||seen.has(card.characterId))return null;
    seen.add(card.characterId);return card.id;
  });
  // たづなが別の枠に入っていた場合などは、移動で空いた枠へ元の6枚目を残す。
  const displaced=catalog.supports.find(s=>s.id===slots[5]);
  if(displaced&&displaced.rarity==='SSR'&&displaced.characterId!==traineeCharacterId&&!seen.has(displaced.characterId)&&result.includes(null))result[result.indexOf(null)]=displaced.id;
  return [...result,fixed?.id??null];
}
