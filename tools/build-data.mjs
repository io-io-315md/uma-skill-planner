import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'research', name), 'utf8').replace(/^\uFEFF/, ''));
const rawSkills = read('gametora-skills.json');
const hierarchy = new Map(read('skills.json').map(s => [s.id, s]));
const skills = [];
for (const s of rawSkills) {
  const h = hierarchy.get(s.id);
  skills.push({ id: s.id, name: s.jpname, rarity: s.rarity, lowerId: h?.lowerSkillId ?? null, upperId: h?.upperSkillId ?? null, cost: s.cost ?? 0, ownerIds: s.char ?? [], versions: s.versions ?? [] });
  if (s.gene_version) skills.push({ id: s.gene_version.id, name: s.jpname, rarity: s.gene_version.rarity, inherited: true, originalId: s.id, ownerIds: s.char ?? [] });
}
// 一部の最新スキルは旧データにしかない場合も名前と階層を保持する。
const ids = new Set(skills.map(s => s.id));
for (const s of hierarchy.values()) if (!ids.has(s.id)) skills.push({ id: s.id, name: s.name, rarity: s.rarity, lowerId: s.lowerSkillId, upperId: s.upperSkillId, cost: s.baseSp, ownerIds: [] });
const characters = read('gametora-character-cards.json').filter(c => c.release <= '2026-10-18').map(c => ({
  id: c.card_id, characterId: c.char_id, name: `${c.title_jp ?? ''}${c.name_jp}`, characterName: c.name_jp, title: c.title_jp ?? '',
  aptitude: c.aptitude, innate: c.skills_innate ?? [], awakening: c.skills_awakening ?? [], eventSkills: c.skills_event ?? [], unique: c.skills_unique ?? [],
  evolutions: c.skills_evo ?? [], source: `https://gametora.com/ja/umamusume/characters/${c.url_name}`,
  raceDressId: c.costume,
  image: `assets/characters/${c.card_id}.png`, imageSource: `https://uma-cdn.pure-db.com/img/trained_charas/trained_${c.char_id}_${String(c.costume).padStart(6,'0')}_01.png`
}));
const curatedEvents = read('events.json').events;
const supports = read('gametora-support-cards.json').filter(c => c.release <= '2026-10-18').map(c => {
  const events = curatedEvents.filter(e => e.id.startsWith(`evt_${c.support_id}_`));
  const curatedIds = new Set(events.flatMap(e => e.choices ? e.choices.flatMap(ch => ch.skills.map(s => s.skillId)) : (e.skills ?? []).map(s => s.skillId)));
  return {
    id: c.support_id, characterId: c.char_id, name: `${c.title_ja ?? ''}${c.name_jp}`, title: c.title_ja ?? '', characterName: c.name_jp,
    rarity: ['','R','SR','SSR'][c.rarity], type: c.type === 'intelligence' ? 'wit' : c.type,
    hintSkills: c.hints?.hint_skills ?? [],
    eventSkills: (c.event_skills ?? []).filter(id => !curatedIds.has(id)),
    events: events.map(e => ({ id: e.id, label: e.label, selection: e.selection, skills: (e.skills ?? []).map(s => s.skillId), choices: e.choices?.map(ch => ({ id: ch.id, label: ch.label, skills: ch.skills.map(s => s.skillId) })) ?? [], defaultChoiceId: e.defaultChoiceId })),
    source: `https://gametora.com/ja/umamusume/supports/${c.url_name}`,
    image: `assets/supports/${c.support_id}.png`, imageSource: `https://media.gametora.com/umamusume/supports/full/small/${c.support_id}.png`
  };
});
// ☆1/2固有と☆3固有で継承版IDを共有する場合は、後の上位名称を採用する。
const uniqueSkills = [...new Map(skills.map(s => [s.id,s])).values()];
const catalog = { retrievedAt: '2026-10-18', sources: { database: 'https://gametora.com/data/manifests/umamusume.json', events: 'https://github.com/Tsuyuchan-jp/umamusume-data', artwork: { characters:'https://uma.pure-db.com/ja-jp/', supports:'https://gametora.com/ja/umamusume/supports' } }, skills: uniqueSkills, characters, supports };
fs.mkdirSync(path.join(root, 'dist', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'data', 'catalog.json'), JSON.stringify(catalog));
console.log(`Catalog: ${characters.length} characters, ${supports.length} supports, ${uniqueSkills.length} skills; ${supports.filter(s => s.events.length).length} cards with detailed event choices.`);
