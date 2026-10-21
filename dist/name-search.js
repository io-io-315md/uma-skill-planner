// 表示名（name）には衣装名・カード名も入るため、検索にはキャラ名だけを使う。
export function normalizeCharacterName(value) {
  return String(value??'').normalize('NFKC').toLowerCase()
    .replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))
    .replace(/\s/g,'');
}

export function matchesCharacterName(item,query='') {
  const text=normalizeCharacterName(query);
  return !text || normalizeCharacterName(item?.characterName).includes(text);
}
