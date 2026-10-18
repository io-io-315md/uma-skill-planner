import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyze, normalizeState, createIndex, acquisitionRoutes, exportChecklist } from '../dist/engine.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const make=patch=>normalizeState(patch,catalog);
const row=(analysis,name)=>analysis.rows.find(r=>r.name===name);

test('11月は秋、3000m回復を表示し、12月は冬・晴・良に切り替える',()=>{
  const nov=analyze(make({}),catalog),dec=analyze(make({courseId:'2026-12-cm'}),catalog);
  assert.ok(row(nov,'秋ウマ娘○'));assert.ok(row(nov,'超長距離回復○'));
  assert.ok(!row(nov,'冬ウマ娘○'));assert.ok(!row(nov,'晴れの日○'));assert.ok(!row(nov,'良バ場○'));
  assert.ok(row(dec,'冬ウマ娘○'));assert.ok(row(dec,'晴れの日○'));assert.ok(row(dec,'良バ場○'));
  assert.ok(!row(dec,'超長距離回復○'));assert.ok(!row(dec,'登山家'));
});
test('未発表コースでは推奨と不足件数を出さない',()=>{
  for(const id of ['2027-01-cm','2027-02-loh','2027-03-cm']){const a=analyze(make({courseId:id}),catalog);assert.equal(a.rows.length,0);assert.equal(a.counts.factor,0);}
});
test('先行と追込の加速を混ぜない',()=>{
  assert.ok(row(analyze(make({style:'先行'}),catalog),'勇気の一歩'));
  assert.ok(!row(analyze(make({style:'先行'}),catalog),'直線一気'));
  assert.ok(row(analyze(make({style:'追込'}),catalog),'直線一気'));
});
test('覚醒を最大とし、自前の金スキルが下位白もカバーする',()=>{
  const full=analyze(make({characterId:106803,style:'逃げ',awakening:1}),catalog);
  assert.equal(row(full,'迷いなし').status,'available');assert.equal(row(full,'迷いなし').goldMissing,false);
  assert.equal(make({characterId:106803,awakening:1}).awakening,5);
});
test('白ヒントは金スキルをカバーしない',()=>{
  const support=catalog.supports.find(s=>s.hintSkills.includes(202482)&&!s.eventSkills.includes(202481)&&!s.events.some(e=>e.skills.includes(202481)||e.choices.some(c=>c.skills.includes(202481))));
  assert.ok(support);
  const a=analyze(make({style:'先行',supports:[support.id]}),catalog);
  assert.notEqual(row(a,'本領発揮').status,'factor');assert.equal(row(a,'本領発揮').goldMissing,true);
});
test('本育成はコースに合う金スキル択を初期選択し、他の択は同時計上しない',()=>{
  const support=catalog.supports.find(s=>s.id===30311);
  const event=support.events.find(e=>e.selection==='single'&&e.choices.some(c=>c.skills.includes(203711)));
  assert.ok(event);
  const choice=event.choices.find(c=>c.skills.includes(203711));
  const state=make({style:'先行',supports:[30311]});
  assert.equal(row(analyze(state,catalog),'勇気の一歩').goldMissing,false);
  state.eventChoices[event.id]=choice.id;
  assert.equal(row(analyze(state,catalog),'勇気の一歩').goldMissing,false);
  state.eventChoices[event.id]=event.choices.find(c=>c.id!==choice.id).id;
  assert.equal(row(analyze(state,catalog),'勇気の一歩').goldMissing,true);
});
test('育成キャラ本人・同じキャラの別サポカは重複できない',()=>{
  const own=catalog.supports.find(s=>s.characterId===1068),others=catalog.supports.filter(s=>s.characterId===1001);
  const state=make({characterId:106801,supports:[own.id,others[0].id,others[1].id,others[0].id]});
  assert.equal(state.supports[0],null);assert.equal(state.supports[1],others[0].id);assert.equal(state.supports[2],null);assert.equal(state.supports[3],null);
});
test('継承元の衣装はDBを優先し、本体固有と同キャラ不可を区別する',()=>{
  assert.equal(row(analyze(make({}),catalog),'Joy to the World').ownerId,107702);
  assert.equal(row(analyze(make({characterId:106801,style:'逃げ'}),catalog),'勝ち鬨ワッショイ！').status,'own-unique');
  assert.equal(row(analyze(make({characterId:106802,style:'逃げ'}),catalog),'勝ち鬨ワッショイ！').status,'incompatible');
});
test('順位条件は12人立てと9人立てで切り替える',()=>{
  assert.match(row(analyze(make({style:'差し'}),catalog),'がむしゃら').note,/5〜12位/);
  assert.match(row(analyze(make({style:'差し',courseId:'2026-12-cm'}),catalog),'がむしゃら').note,/4〜9位/);
});
test('別経路・見送り・準備チェックを出力に反映する',()=>{
  const state=make({supplied:['右回り○'],excluded:['本領発揮'],prepared:['秋ウマ娘○']});
  const a=analyze(state,catalog),text=exportChecklist(state,a);
  assert.equal(row(a,'右回り○').status,'manual');assert.ok(row(a,'本領発揮').excluded);
  assert.match(text,/\[x\] \[優先度 高\] 秋ウマ娘○/);assert.ok(!text.includes('[優先度 中] 本領発揮'));
  assert.match(text,/金スキルの取得経路を要確認（白因子では取得不可）/);
});
test('不正な保存値と未対応IDを補正する',()=>{
  const state=make({courseId:'bad',style:'大逃げ',characterId:999,supports:[999],eventChoices:null,awakening:99,prepared:'bad',plans:[null,{label:'x',state:{}},'bad']});
  assert.equal(state.courseId,'2026-11-loh');assert.equal(state.style,'先行');assert.equal(state.characterId,null);assert.equal(state.awakening,5);assert.deepEqual(state.supports,[null,null,null,null,null,null]);assert.deepEqual(state.prepared,[]);assert.equal(state.plans.length,1);
});
test('覚醒Lv6/7と旧カードを扱える',()=>{
  assert.equal(make({characterId:100101,awakening:1}).awakening,7);
  const routes=acquisitionRoutes(make({characterId:100101,awakening:7}),createIndex(catalog));
  assert.ok(routes.has(204262));assert.ok(catalog.supports.some(s=>s.id===30016));assert.ok(catalog.supports.some(s=>s.id===30028));
});
test('京都のスピード緑と真髄体を高、スタミナ緑を低に分ける',()=>{
  const a=analyze(make({}),catalog);
  for(const name of ['右回り○','秋ウマ娘○','レースの真髄・体'])assert.equal(row(a,name).priority,1);
  for(const name of ['京都レース場○','非根幹距離○'])assert.equal(row(a,name).priority,3);
  assert.match(row(a,'レースの真髄・体').conditionLabel,/持久力/);
});
test('コース・脚質によって優先度を変える',()=>{
  assert.equal(row(analyze(make({style:'逃げ'}),catalog),'レースの真髄・力').priority,3);
  assert.equal(row(analyze(make({style:'差し'}),catalog),'レースの真髄・力').priority,2);
  assert.equal(row(analyze(make({}),catalog),'下り坂巧者').priority,3);
  assert.equal(row(analyze(make({courseId:'2026-12-cm'}),catalog),'下り坂巧者').priority,2);
});
test('ファインの白択は因子周回だけで使い、本育成の真髄体の不足を消さない',()=>{
  const fine=catalog.supports.find(s=>s.id===30283);
  const event=fine.events.find(e=>e.choices.some(c=>c.skills.includes(210101)));
  const choice=event.choices.find(c=>c.skills.includes(210101));
  const state=make({supports:[30283]});
  assert.equal(row(analyze(state,catalog),'レースの真髄・体').status,'factor');
  state.eventChoices[event.id]=choice.id;
  const a=analyze(state,catalog);
  assert.equal(row(a,'レースの真髄・体').status,'factor');
  assert.ok(exportChecklist(state,a).split('親からの継承候補')[0].includes('レースの真髄・体'));
  assert.ok(row(a,'レースの真髄・体').alternateEvents.some(e=>e.supportId===30283));
  assert.equal(row(analyze(state,catalog,{purpose:'factor'}),'レースの真髄・体').status,'available');
});
