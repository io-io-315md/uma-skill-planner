import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeState, analyze, createIndex, resolvedEventChoice } from '../dist/engine.js';
import { applyMainDeck, suggestMainDeck, changeMainConditions, preferredStyle } from '../dist/main-deck.js';
import { MAIN_DECK_GUIDE } from '../dist/main-deck-data.js';
import { COURSES, STYLES } from '../dist/recommendations.js';
import { skillMatchesRace } from '../dist/support-usage.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const main=patch=>normalizeState({characterId:107601,style:'差し',...patch},catalog);

test('11・12月の4脚質でSSR6枠を自動設定し、自前吾妻・レンタル位置・併用制限を守る',()=>{
  for(const courseId of ['2026-11-loh','2026-12-cm'])for(const style of STYLES){
    const state=main({courseId,style}),before=structuredClone(state),p=applyMainDeck(state,catalog);
    assert.deepEqual(state,before);assert.equal(p.mainDeck.mode,'auto');assert.equal(p.mainDeck.status,'reviewed');
    assert.equal(p.supports.length,6);assert.equal(p.supports[5],30323);assert.notEqual(p.supports[4],30323);
    const cards=p.supports.map(id=>catalog.supports.find(s=>s.id===id));
    assert.ok(cards.every(c=>c?.rarity==='SSR'&&c.characterId!==1076));assert.equal(new Set(cards.map(c=>c.characterId)).size,6);
    const index=createIndex(catalog),course=COURSES.find(c=>c.id===courseId);
    for(const card of cards)for(const e of card.events.filter(e=>e.selection==='single')){
      const choice=resolvedEventChoice(e,p,index,'main');if(!choice)continue;
      const gold=choice.skills.filter(id=>index.skills.get(id)?.rarity===2);
      if(e.choices.some(c=>c.skills.some(id=>index.skills.get(id)?.rarity===2)))assert.ok(gold.length);assert.ok(gold.every(id=>skillMatchesRace(index.skills.get(id),course,style)));
    }
  }
});
test('脚質を切り替えると4種の編成と金スキル択が連動し、先行も5種類・スピード2枚になる',()=>{
  let state=main({style:'逃げ'});const decks=[];
  for(const style of STYLES){state=changeMainConditions(state,{style},catalog,MAIN_DECK_GUIDE,{force:true});decks.push(state.supports.join(','));}
  assert.equal(new Set(decks).size,4);
  const front=applyMainDeck(main({style:'先行'}),catalog);
  assert.equal(front.supports.filter(id=>catalog.supports.find(c=>c.id===id)?.type==='speed').length,2);
  assert.ok(front.supports.includes(30311));
});
test('覚醒で主加速を持たない差し・追込は対応するサポカを優先し、体だけでファインを入れない',()=>{
  const dashi=applyMainDeck(main({}),catalog),chase=applyMainDeck(main({style:'追込'}),catalog);
  assert.ok(dashi.supports.includes(30281));assert.ok(chase.supports.includes(30278));
  assert.ok(!dashi.supports.includes(30283));assert.ok(!chase.supports.includes(30283));
  assert.equal(analyze(dashi,catalog).rows.find(r=>r.name==='レースの真髄・体').priority,1);
});
test('自前の覚醒が主加速を持つ場合にはその金だけのサポカを固定しない',()=>{
  const gold=catalog.skills.find(s=>s.name==='無我夢中'&&s.rarity===2).id;
  const char=catalog.characters.find(c=>c.awakening.includes(gold));assert.ok(char);
  const p=applyMainDeck(main({characterId:char.id}),catalog);
  assert.ok(!p.supports.includes(30281));
});
test('サポカ本人を本育成に選ぶと代替カードを自動設定し、古いイベント択を残さない',()=>{
  const card=catalog.supports.find(c=>c.id===30302),char=catalog.characters.find(c=>c.characterId===card.characterId);assert.ok(char);
  const first=applyMainDeck(main({style:'先行'}),catalog),p=changeMainConditions(first,{characterId:char.id},catalog);
  assert.ok(!p.supports.includes(card.id));assert.equal(p.supports.filter(Boolean).length,6);
  assert.ok(card.events.every(e=>!Object.hasOwn(p.eventChoices,e.id)));
});
test('キャラ選択時は適性の高い脚質へ設定でき、その後の手動脚質指定を尊重する',()=>{
  const base=normalizeState({},catalog),lor=catalog.characters.find(c=>c.id===107601);
  assert.equal(preferredStyle(lor,'先行'),'差し');
  const picked=changeMainConditions(base,{characterId:lor.id},catalog,MAIN_DECK_GUIDE,{chooseStyle:true});
  assert.equal(picked.style,'差し');assert.equal(picked.supports.filter(Boolean).length,6);
  assert.equal(changeMainConditions(picked,{style:'先行'},catalog).style,'先行');
});
test('ページ起動・データ更新の再適用では手動編成から最新案へ戻し、因子周回・準備記録は保持する',()=>{
  const base=main({prepared:['右回り○'],farmingPlans:{x:{characterId:113501,supports:[20037],learned:['右回り○']}},mainDeck:{mode:'manual'},supports:[null,null,null,null,null,30323]});
  const result=applyMainDeck(base,catalog,{...MAIN_DECK_GUIDE,revision:'next'});
  assert.equal(result.mainDeck.revision,'next');assert.equal(result.mainDeck.mode,'auto');assert.equal(result.supports.filter(Boolean).length,6);
  assert.deepEqual(result.prepared,base.prepared);assert.deepEqual(result.farmingPlans,base.farmingPlans);
});
test('準備チェックだけの変更では手動編成を上書きせず、レース変更時には再編成する',()=>{
  const base=main({mainDeck:{mode:'manual'},supports:[null,null,null,null,null,30323]});
  const check=changeMainConditions(base,{prepared:['秋ウマ娘○']},catalog);
  assert.deepEqual(check.supports,base.supports);assert.equal(check.mainDeck.mode,'manual');
  const changed=changeMainConditions(check,{courseId:'2026-12-cm'},catalog);
  assert.equal(changed.mainDeck.mode,'auto');assert.ok(changed.mainDeck.sourceIds.includes('december'));
  assert.ok(analyze(changed,catalog).rows.some(r=>r.name==='冬ウマ娘○'));assert.ok(!analyze(changed,catalog).rows.some(r=>r.name==='秋ウマ娘○'));
});
test('コース詳細未発表のイベントは暫定編成とし、コース別スキルを捏造しない',()=>{
  const state=applyMainDeck(main({courseId:'2027-02-loh'}),catalog);
  assert.equal(state.mainDeck.status,'provisional');assert.equal(state.supports.filter(Boolean).length,6);
  assert.deepEqual(analyze(state,catalog).rows,[]);
  const empty=suggestMainDeck(normalizeState({},catalog),catalog);assert.equal(empty.status,'unselected');
});
