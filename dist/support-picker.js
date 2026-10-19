// 本育成のレアリティ制限は、因子周回の取得経路には適用しない。
export function canUseSupport(support, context='main') {
  return !!support && (context==='farming' || support.rarity==='SSR');
}

export function compareSupportRecency(a,b) {
  return (b.releaseDate??'').localeCompare(a.releaseDate??'') || b.id-a.id;
}

export function selectSupportCandidates(supports,{context='main',traineeCharacterId,excludedCharacterIds=new Set(),type='すべて',query=''}={}) {
  const text=query.toLowerCase().replace(/[\s\[\]「」]/g,'');
  return supports.filter(s=>canUseSupport(s,context) && s.characterId!==traineeCharacterId && !excludedCharacterIds.has(s.characterId) &&
    (type==='すべて'||s.type===type) && s.name.toLowerCase().replace(/[\s\[\]「」]/g,'').includes(text)).sort(compareSupportRecency);
}
