import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectSupportCandidates,compareSupportRecency} from '../dist/support-picker.js';
import {normalizeState,normalizeFarmingProfile} from '../dist/engine.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));

test('本育成はSSRのみ、因子周回はSSR・SR・Rを実装日が新しい順に表示',()=>{
  const main=selectSupportCandidates(catalog.supports);
  const farming=selectSupportCandidates(catalog.supports,{context:'farming'});
  assert.ok(main.length>0&&main.every(s=>s.rarity==='SSR'));
  assert.deepEqual([...new Set(farming.map(s=>s.rarity))].sort(),['R','SR','SSR']);
  assert.equal(farming.length,catalog.supports.length);
  for(const list of [main,farming]) {
    assert.deepEqual(list.slice(0,3).map(s=>s.id),[30321,30320,30319]);
    for(let i=1;i<list.length;i++)assert.ok(compareSupportRecency(list[i-1],list[i])<=0);
    assert.ok(list.every(s=>/^\d{4}-\d{2}-\d{2}$/.test(s.releaseDate)));
  }
  assert.ok(farming.findIndex(s=>s.id===20101)<farming.findIndex(s=>s.id===30316),'新しいSRを古いSSRより上に表示');
});

test('検索と種類フィルターでもレアリティ・併用制限・実装順を維持し、原本を並べ替えない',()=>{
  const before=catalog.supports.map(s=>s.id);
  const results=selectSupportCandidates(catalog.supports,{context:'farming',type:'power',query:'ファイン',excludedCharacterIds:new Set([1001]),traineeCharacterId:1068});
  assert.ok(results.length>0&&results.every(s=>s.type==='power'&&s.name.includes('ファイン')));
  assert.ok(results.every(s=>s.characterId!==1001&&s.characterId!==1068));
  const main=selectSupportCandidates(catalog.supports,{type:'wit',query:'ナリタ',excludedCharacterIds:new Set([1016])});
  assert.ok(main.every(s=>s.type==='wit'&&s.rarity==='SSR'&&s.characterId!==1016));
  assert.deepEqual(catalog.supports.map(s=>s.id),before);
  const records=[{id:1,characterId:1,name:'test',rarity:'SSR',type:'power',releaseDate:'2026-09-30'},
    {id:9,characterId:2,name:'test',rarity:'SSR',type:'power',releaseDate:'2026-08-01'}];
  assert.deepEqual(selectSupportCandidates(records).map(s=>s.id),[1,9],'カード番号ではなく実装日が優先');
});

test('旧保存のSR・Rは本育成から外し、保存した因子周回や保存プランの原本は維持する',()=>{
  const cards=['SSR','SR','R'].map(r=>catalog.supports.find(s=>s.rarity===r&&s.characterId!==1001));
  // 別キャラのカードを用いてレアリティ制限だけを確認する。
  for(let i=1;i<cards.length;i++)cards[i]=catalog.supports.find(s=>s.rarity===cards[i].rarity&&!cards.slice(0,i).some(c=>c.characterId===s.characterId)&&s.characterId!==1001);
  const profile={supports:cards.map(s=>s.id),learned:['右回り○']};
  const raw={supports:profile.supports,farmingPlans:{target:profile},plans:[{label:'saved',state:profile}]};
  const normalized=normalizeState(raw,catalog);
  assert.deepEqual(normalized.supports.slice(0,3),[cards[0].id,null,null]);
  assert.deepEqual(normalized.farmingPlans.target.supports.slice(0,3),profile.supports);
  assert.deepEqual(normalizeFarmingProfile(profile,catalog).supports.slice(0,3),profile.supports);
  assert.deepEqual(normalized.plans[0].state.supports,profile.supports);
  assert.deepEqual(raw.supports,profile.supports);
});
