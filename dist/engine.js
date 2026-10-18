import { COURSES, RECOMMENDATIONS, STYLES } from './recommendations.js';

export const TYPE_LABELS = { speed: 'スピード', stamina: 'スタミナ', power: 'パワー', guts: '根性', wit: '賢さ', friend: '友人', group: 'グループ' };
export const PRIORITIES = { 1: '優先', 2: 'おすすめ', 3: '補助・条件次第' };
export const DEFAULT_STATE = { version: 1, courseId: COURSES[0].id, style: '先行', characterId: null, awakening: 5, supports: [null,null,null,null,null,null], eventChoices: {}, supplied: [], prepared: [], excluded: [], plans: [] };

export function normalizeState(raw, catalog) {
  const state = { ...structuredClone(DEFAULT_STATE), ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!COURSES.some(c => c.id === state.courseId)) state.courseId = DEFAULT_STATE.courseId;
  if (!STYLES.includes(state.style)) state.style = DEFAULT_STATE.style;
  if (!catalog.characters.some(c => c.id === Number(state.characterId))) state.characterId = null;
  else state.characterId = Number(state.characterId);
  state.awakening = Math.max(1, Math.min(7, Number(state.awakening) || 5));
  const char = catalog.characters.find(c => c.id === state.characterId);
  state.awakening = Math.min(state.awakening, char ? char.awakening.length + 1 : 5);
  const seen = new Set();
  state.supports = Array.from({ length: 6 }, (_, i) => {
    const s = catalog.supports.find(c => c.id === Number(state.supports?.[i]));
    if (!s || seen.has(s.characterId) || s.characterId === char?.characterId) return null;
    seen.add(s.characterId); return s.id;
  });
  for (const key of ['supplied','prepared','excluded']) state[key] = Array.isArray(state[key]) ? [...new Set(state[key].filter(x => typeof x === 'string'))] : [];
  if (!state.eventChoices || typeof state.eventChoices !== 'object' || Array.isArray(state.eventChoices)) state.eventChoices = {};
  state.plans = Array.isArray(state.plans) ? state.plans.filter(p => p && typeof p.label === 'string' && p.state && typeof p.state === 'object').slice(0,20) : [];
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

export function acquisitionRoutes(state, index) {
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
    char.awakening.slice(0, state.awakening - 1).forEach((id, i) => add(id, { kind: 'native', label: `自前・覚醒Lv${i+2}` }));
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
        const choiceId = state.eventChoices[event.id];
        const choice = event.choices.find(c => c.id === choiceId);
        if (choice) choice.skills.forEach(skill => add(skill, { kind: 'event', label: `${label}：${choice.label}` }));
      } else event.skills.forEach(skill => add(skill, { kind: 'event', label: `${label}のイベント（発生・完走等の条件あり）` }));
    }
  }
  return routes;
}

export function analyze(state, catalog) {
  const index = createIndex(catalog);
  const course = COURSES.find(c => c.id === state.courseId) ?? COURSES[0];
  if (!course.confirmed) return { course, rows: [], counts: { all:0, available:0, factor:0, inheritance:0, gold:0 }, index };
  const routes = acquisitionRoutes(state, index);
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
    return { ...r, skillId: skill?.id, goldId: gold?.id, ownerId, ownerName: owner?.name, status, routes: available, goldRoutes, goldMissing: !!gold && !goldRoutes.length, ownUnique, sameCharacter, excluded, prepared: state.prepared.includes(r.name), note: r.courseNotes?.[course.id] ?? '', factorEligible: !r.inherited && skill?.rarity === 1 && skill.id < 900000 };
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
  const lines = [`UMAPLAN｜${course.year}年${course.date} ${course.title}`, course.confirmed ? `${course.venue} ${course.surface}${course.distance}m / ${course.turn} / ${course.season} / ${course.weather} / ${course.going}` : 'コース詳細未発表', `育成：${char?.name ?? '未選択'} / ${state.style} / 覚醒Lv${state.awakening}`, '', 'サポート編成', ...state.supports.map((id,i) => `${i+1}. ${index.supports.get(id)?.name ?? '未選択'}`), ''];
  for (const [title, pred] of [
    ['白因子で補う候補', r => r.status === 'factor' && r.factorEligible],
    ['親からの継承候補', r => r.status === 'inheritance'],
    ['編成から入手ルートがある候補', r => ['available','manual','own-unique','event-check'].includes(r.status)],
    ['金スキルの取得経路を要確認（白因子では取得不可）', r => r.goldMissing]
  ]) {
    lines.push(title);
    const rows = analysis.rows.filter(r => !r.excluded && pred(r));
    lines.push(...(rows.length ? rows.map(r => `${r.prepared ? '[x]' : '[ ]'} ${title.startsWith('金') ? r.gold : r.name}${r.evolvedInheritance ? '（本人所持・直接の親・進化条件を確認）' : ''}`) : ['該当なし']), '');
  }
  lines.push('優先度は編集上の目安。全候補を必須とはしません。ヒント・イベント・因子の発生は確約しません。', 'シナリオ固有の取得経路は自動計上しません。「別ルートで取得」に設定して補ってください。', `参照：https://dmg.umamusume.jp/news/detail/?id=3483 / 確認日：2026-10-18`);
  return lines.join('\n');
}
