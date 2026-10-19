import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,normalizeState,acquisitionRoutes,eventChoicesForPurpose,normalizeFarmingProfile,exportChecklist} from '../dist/engine.js';
import {suggestFactorPlan,analyzeFactorPlan,factorPlanKey,candidateSources,completeFactorChoices} from '../dist/factor-planner.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const main=patch=>normalizeState({characterId:107601,style:'差し',supports:[30317,30304,30306,30302,30283,30305],...patch},catalog);
const find=(analysis,name)=>analysis.rows.find(r=>r.name===name);

test('本育成で金と引き換えになる白択を除外し、因子周回では選択できる',()=>{
 const a=analyze(main({}),catalog),e=catalog.supports.find(s=>s.id===30283).events.find(e=>e.selection==='single');
 assert.equal(eventChoicesForPurpose(e,a.index,'main').length,1);
 assert.equal(eventChoicesForPurpose(e,a.index,'factor').length,2);
});
test('旧保存データの本育成にあるファイン白択を補正する',()=>{
 const fine=catalog.supports.find(s=>s.id===30283),e=fine.events.find(e=>e.selection==='single');
 const state=main({eventChoices:{[e.id]:e.choices.find(c=>c.skills.includes(210101)).id}});
 assert.equal(state.eventChoices[e.id],undefined);
 assert.equal(find(analyze(state,catalog),'レースの真髄・体').status,'factor');
});
test('真髄体の周回編成にファインを提案し、白択を指定する',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体');
 const p=suggestFactorPlan(state,a,focus,catalog);
 assert.ok(p.supports.includes(30283));
 const result=analyzeFactorPlan(p,a,focus);
 assert.ok(result.covered.some(r=>r.name===focus.name));
 const e=catalog.supports.find(s=>s.id===30283).events.find(e=>e.selection==='single');
 assert.ok(e.choices.find(c=>c.id===p.eventChoices[e.id]).skills.includes(210101));
 assert.equal(find(analyze(state,catalog),focus.name).status,'factor');
});
test('本育成と周回の編成・イベント択・取得チェックを別々に保存する',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),before=structuredClone(state);
 const p=suggestFactorPlan(state,a,focus,catalog);p.learned=[focus.name];p.supports[5]=null;
 const key=factorPlanKey(state,focus.name);
 const updated=normalizeState({...state,farmingPlans:{[key]:p}},catalog);
 assert.deepEqual(updated.supports,before.supports);assert.deepEqual(updated.eventChoices,before.eventChoices);
 assert.deepEqual(updated.prepared,[]);assert.deepEqual(updated.farmingPlans[key].learned,[focus.name]);
 assert.notEqual(key,factorPlanKey({...state,courseId:'2026-12-cm'},focus.name));
});
test('継承固有は所有する衣装を周回キャラにし、同キャラサポートを入れない',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'黄金を訪ねて');
 const p=suggestFactorPlan(state,a,focus,catalog),parent=a.index.characters.get(p.characterId);
 assert.equal(parent.id,focus.ownerId);
 assert.ok(analyzeFactorPlan(p,a,focus).uniqueReady);
 assert.ok(p.supports.filter(Boolean).every(id=>a.index.supports.get(id).characterId!==parent.characterId));
});
test('自動編成は6枠以内・同キャラ重複なしで、表示する経路は実際の択と一致する',()=>{
 for(const style of ['逃げ','先行','差し','追込']){
  const state=main({style}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),p=suggestFactorPlan(state,a,focus,catalog);
  const supports=p.supports.filter(Boolean).map(id=>a.index.supports.get(id));
  assert.equal(p.supports.length,6);assert.equal(new Set(supports.map(s=>s.characterId)).size,supports.length);
  const actual=acquisitionRoutes(p,a.index,'factor'),result=analyzeFactorPlan(p,a,focus);
  assert.ok(result.targets.every(r=>r.canAcquire===actual.has(r.skillId)));
 }
});
test('白択と金択の同時計上を防ぎ、択変更で真髄体の取得経路が消える',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),p=suggestFactorPlan(state,a,focus,catalog);
 const e=catalog.supports.find(s=>s.id===30283).events.find(e=>e.selection==='single');
 p.eventChoices[e.id]=e.choices.find(c=>!c.skills.includes(210101)).id;
 assert.ok(!analyzeFactorPlan(p,a,focus).covered.some(r=>r.name===focus.name));
});
test('URAで真髄を狙う方法はその周回だけに計上する',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・力');
 const p=normalizeFarmingProfile({characterId:focus.ownerId,scenario:'ura'},catalog);
 assert.ok(analyzeFactorPlan(p,a,focus).covered.some(r=>r.name===focus.name));
 assert.ok(!analyzeFactorPlan({...p,scenario:'support'},a,focus).covered.some(r=>r.name===focus.name));
 assert.equal(find(analyze(state,catalog),focus.name).status,'factor');
});
test('周回キャラ本人のサポートは候補から除外する',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体');
 const fine=catalog.characters.find(c=>c.characterId===1022);
 assert.ok(candidateSources(a,focus,catalog,fine.id).every(s=>s.support.characterId!==1022));
 const p=normalizeFarmingProfile({characterId:fine.id,supports:[30283,30283],learned:'invalid',eventChoices:null},catalog);
 assert.deepEqual(p.supports,[null,null,null,null,null,30305]);assert.deepEqual(p.learned,[]);
});
test('周回の択を未指定へ戻したら自動で白択へ戻さない',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),p=suggestFactorPlan(state,a,focus,catalog);
 const e=catalog.supports.find(s=>s.id===30283).events.find(e=>e.selection==='single');p.eventChoices[e.id]='';
 const changed=completeFactorChoices(p,a,focus,catalog);
 assert.equal(changed.eventChoices[e.id],'');
 assert.ok(!analyzeFactorPlan(changed,a,focus).covered.some(r=>r.name===focus.name));
});
test('TXTでは本育成の不足と周回編成・白択を別に出す',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),p=suggestFactorPlan(state,a,focus,catalog);
 state.farmingPlans={[factorPlanKey(state,focus.name)]:p};
 const text=exportChecklist(state,a),[requirements,farming]=text.split('因子周回プラン（本育成とは別編成）');
 assert.ok(requirements.split('親からの継承候補')[0].includes('レースの真髄・体'));
 assert.match(farming,/対象因子：レースの真髄・体/);assert.match(farming,/因子周回の択：② 気持ちを乗せて/);
});
test('834件の画像がそれぞれのIDのローカルPNGに対応する',()=>{
 for(const [kind,items]of [['characters',catalog.characters],['supports',catalog.supports]])for(const item of items){
  assert.equal(item.image,`assets/${kind}/${item.id}.png`);
  const bytes=fs.readFileSync(new URL('../dist/'+item.image,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  if(kind==='characters'){
    assert.ok(Number.isInteger(item.raceDressId));
    assert.equal(item.imageSource,`https://uma-cdn.pure-db.com/img/trained_charas/trained_${item.characterId}_${String(item.raceDressId).padStart(6,'0')}_01.png`);
    assert.equal(bytes.readUInt32BE(16),256);assert.equal(bytes.readUInt32BE(20),256);
  }
 }
});
