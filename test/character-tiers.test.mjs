import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COURSES, STYLES } from '../dist/recommendations.js';
import { COURSE_TIERS, TIER_ORDER, TIER_SOURCES, TIER_VERIFIED_AT, getCourseTier } from '../dist/character-tiers.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));

test('掲載Tierは当該開催の新しいnoteを実際の候補評価に使い、指定のラボ記事を保持する',()=>{
  for(const [id,board] of Object.entries(COURSE_TIERS)) {
    assert.equal(getCourseTier(COURSES.find(c=>c.id===id)),board);
    if(board.status!=='published')continue;
    assert.equal(board.entries.length,10);
    assert.equal(new Set(board.entries.map(e=>e.characterId)).size,10);
    assert.deepEqual([...new Set(board.entries.map(e=>e.tier))].sort(),[...TIER_ORDER].sort());
    assert.ok(board.sourceIds.some(key=>TIER_SOURCES[key].platform==='note'));
    assert.ok(new Set(board.sourceIds.map(key=>TIER_SOURCES[key].name)).size>=2);
    for(const key of board.sourceIds) {
      const source=TIER_SOURCES[key];
      assert.ok(source.publishedAt>='2026-09-30'&&source.publishedAt<=TIER_VERIFIED_AT);
      assert.ok(source.contentAsOf>='2026-09-30'&&source.contentAsOf<=TIER_VERIFIED_AT&&source.scope);
      assert.ok(board.entries.some(e=>e.opinions.some(o=>o.source===key)),'参照だけ飾る記事は使わない');
    }
    for(const e of board.entries) {
      assert.ok(catalog.characters.find(c=>c.id===e.characterId)?.image);
      assert.ok(e.styles.length&&e.styles.every(s=>STYLES.includes(s))&&e.reason&&e.caution);
      assert.ok(e.opinions.length&&e.opinions.every(o=>o.note&&board.sourceIds.includes(o.source)&&TIER_SOURCES[o.source]?.courseId===id));
      assert.ok(e.opinions.some(o=>TIER_SOURCES[o.source].platform==='note'),'各候補にnoteの直接の言及がある');
      if(e.opinions.length===1)assert.equal(e.limitedEvidence,true,'比較情報が少ない候補を明示');
    }
  }
  assert.equal(TIER_SOURCES.kyotoLab.url,'https://umamusumelabo.com/event/loh/loh-kyoto3000-202611');
  assert.ok(COURSE_TIERS['2026-11-loh'].sourceIds.includes('kyotoLab'));
});

test('11月の評価をnoteと再照合し、12月は古い開催記事で穴埋めしない',()=>{
  const nov=COURSE_TIERS['2026-11-loh'];
  assert.deepEqual(nov.entries.filter(e=>e.tier==='S').map(e=>e.characterId),[107703]);
  assert.equal(nov.entries.find(e=>e.characterId===101703).mixed,true);
  assert.equal(nov.entries.find(e=>e.characterId===114101).tier,'A');
  const dec=COURSE_TIERS['2026-12-cm'];
  assert.equal(dec.status,'withheld');assert.deepEqual(dec.entries,[]);assert.deepEqual(dec.sourceIds,[]);
  assert.ok(dec.pendingReason&&dec.pendingDetail);
});

test('衣装の取り違えを防ぎ、未発表・条件の違うコースへTierを流用しない',()=>{
  const expected=new Map([[107703,'[万福龍湯伝・頂]'],[101703,'[Adamant Sovereign]'],[102503,'[幽玄薔薇]'],[108902,'[夏凪ネイビードロップ]'],[101301,'[エレガンス・ライン]'],[102403,'[ろっきん☆MewMeow]'],[106803,'[結願のしまい華]'],[102303,'[Engineered Victory]'],[105702,'[絢爛花道歌舞く君]']]);
  for(const [id,title] of expected)assert.equal(catalog.characters.find(c=>c.id===id)?.title,title);
  assert.equal(getCourseTier(undefined),null);
  for(const c of COURSES.filter(c=>!c.confirmed))assert.equal(getCourseTier(c),null);
  const known=COURSES.find(c=>c.id==='2026-11-loh');
  for(const patch of [{confirmed:false},{id:'2026-10-cm'},{distance:3200},{runners:9},{season:'冬'},{weather:'晴'},{going:'良'},{type:'チャンミ'}])assert.equal(getCourseTier({...known,...patch}),null);
});
