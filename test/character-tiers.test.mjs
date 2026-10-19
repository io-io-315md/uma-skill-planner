import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COURSES, STYLES } from '../dist/recommendations.js';
import { COURSE_TIERS, TIER_ORDER, TIER_SOURCES, getCourseTier } from '../dist/character-tiers.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));

test('各コースのTierは10衣装を実在の顔アイコン・作戦・複数の当該開催資料に結び付ける',()=>{
  for(const [id,board] of Object.entries(COURSE_TIERS)) {
    assert.equal(getCourseTier(COURSES.find(c=>c.id===id)),board);
    assert.equal(board.entries.length,10);
    assert.equal(new Set(board.entries.map(e=>e.characterId)).size,10);
    assert.deepEqual([...new Set(board.entries.map(e=>e.tier))].sort(),[...TIER_ORDER].sort());
    for(const entry of board.entries) {
      const char=catalog.characters.find(c=>c.id===entry.characterId);
      assert.ok(char?.image,'衣装IDと顔アイコンが必要');
      assert.ok(entry.styles.length&&entry.styles.every(s=>STYLES.includes(s)));
      assert.ok(entry.reason&&entry.caution);
      const sources=entry.opinions.map(o=>TIER_SOURCES[o.source]);
      assert.ok(entry.opinions.every(o=>o.note&&board.sourceIds.includes(o.source)));
      assert.ok(sources.every(s=>s?.courseId===id),'別コースの評価を混ぜない');
      assert.ok(new Set(sources.map(s=>new URL(s.url).hostname)).size>=2,'各候補に2媒体以上の根拠');
    }
  }
});

test('衣装の取り違えを防ぐ（通常・水着・花嫁・ハロウィン・ラーメン・赤キタサン）',()=>{
  const expected=new Map([[107703,'[万福龍湯伝・頂]'],[101703,'[Adamant Sovereign]'],[102503,'[幽玄薔薇]'],[108902,'[夏凪ネイビードロップ]'],[101301,'[エレガンス・ライン]'],[102403,'[ろっきん☆MewMeow]'],[106803,'[結願のしまい華]'],[106402,'[赤心のトナカイさん]'],[111901,'[夢路のよすが]']]);
  for(const [id,title] of expected)assert.equal(catalog.characters.find(c=>c.id===id)?.title,title);
});

test('未発表コースや開催条件が変わったコースへ既存Tierを流用しない',()=>{
  assert.equal(getCourseTier(undefined),null);
  for(const c of COURSES.filter(c=>!c.confirmed))assert.equal(getCourseTier(c),null);
  const known=COURSES.find(c=>c.id==='2026-11-loh');
  for(const patch of [{confirmed:false},{id:'2026-10-cm'},{distance:3200},{runners:9},{season:'冬'},{weather:'晴'},{going:'良'},{type:'チャンミ'}]) {
    assert.equal(getCourseTier({...known,...patch}),null);
  }
});
