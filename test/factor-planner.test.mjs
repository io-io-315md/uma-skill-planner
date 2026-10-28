import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,normalizeState,acquisitionRoutes,eventChoicesForPurpose,normalizeFarmingProfile,exportChecklist} from '../dist/engine.js';
import {suggestFactorPlan,analyzeFactorPlan,factorPlanKey,candidateSources,completeFactorChoices,refreshFarmingPolicy} from '../dist/factor-planner.js';
import {FARMING_POLICY} from '../dist/farming-policy.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const main=patch=>normalizeState({characterId:107601,style:'差し',supports:[30317,30304,30306,30302,30283,30323],...patch},catalog);
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
test('真髄体は高のまま継承前提とし、体を選択してもパワーファインを固定しない',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体');
 const p=suggestFactorPlan(state,a,focus,catalog);
 assert.ok(!p.supports.includes(30283));assert.equal(p.anchorSupportId,null);assert.equal(p.scenario,'support');
 const result=analyzeFactorPlan(p,a,focus);
 assert.ok(!result.targets.some(r=>r.name===focus.name));assert.ok(!result.missing.some(r=>r.name===focus.name));
 assert.equal(result.inheritedTargets.find(r=>r.name===focus.name).priority,1);
 assert.equal(find(analyze(state,catalog),focus.name).status,'factor');assert.equal(focus.priority,1);
 assert.equal(result.routes.has(focus.skillId),false,'継承を確認済みの経路として捏造しない');
});
test('継承元に体がない場合は手動指定でパワーファインと白択も使える',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体');
 const p=suggestFactorPlan(state,a,focus,catalog,{anchorSupportId:30283});
 assert.ok(p.supports.includes(30283));
 assert.ok(analyzeFactorPlan(p,a,focus).inheritedTargets.find(r=>r.name===focus.name).canAcquire);
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
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),p=suggestFactorPlan(state,a,focus,catalog,{anchorSupportId:30283});
 assert.ok(analyzeFactorPlan(p,a,focus).inheritedTargets.find(r=>r.name===focus.name).canAcquire);
 const e=catalog.supports.find(s=>s.id===30283).events.find(e=>e.selection==='single');
 p.eventChoices[e.id]=e.choices.find(c=>!c.skills.includes(210101)).id;
 assert.equal(analyzeFactorPlan(p,a,focus).inheritedTargets.find(r=>r.name===focus.name).canAcquire,false);
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
 assert.deepEqual(p.supports,[null,null,null,null,null,30323]);assert.deepEqual(p.learned,[]);
});
test('周回の択を未指定へ戻したら自動で白択へ戻さない',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),p=suggestFactorPlan(state,a,focus,catalog,{anchorSupportId:30283});
 const e=catalog.supports.find(s=>s.id===30283).events.find(e=>e.selection==='single');p.eventChoices[e.id]='';
 const changed=completeFactorChoices(p,a,focus,catalog);
 assert.equal(changed.eventChoices[e.id],'');
 assert.equal(analyzeFactorPlan(changed,a,focus).inheritedTargets.find(r=>r.name===focus.name).canAcquire,false);
});
test('TXTでは本育成の体の不足と因子周回の継承前提を区別する',()=>{
 const state=main({}),a=analyze(state,catalog),focus=find(a,'レースの真髄・体'),p=suggestFactorPlan(state,a,focus,catalog);
 state.farmingPlans={[factorPlanKey(state,focus.name)]:p};
 const text=exportChecklist(state,a),[requirements,farming]=text.split('因子周回プラン（本育成とは別編成）');
 assert.ok(requirements.split('親からの継承候補')[0].includes('レースの真髄・体'));
 assert.match(farming,/対象因子：レースの真髄・体/);assert.match(farming,/既存因子から継承する前提/);assert.ok(!farming.includes('因子周回の択：② 気持ちを乗せて'));
});

test('旧保存の体だけを担うファインを更新し、赤因子・周回キャラ・チェックを保持する',()=>{
 const state=main({}),full=analyze(state,catalog),focus=find(full,'レースの真髄・体'),a={...full,rows:[focus]};
 const legacy={...suggestFactorPlan(state,a,focus,catalog,{anchorSupportId:30283}),farmingPolicy:'',redFactor:{type:'差し',stars:2},learned:[focus.name]};
 const before=structuredClone(legacy),updated=refreshFarmingPolicy(legacy,a,catalog,focus);
 assert.deepEqual(legacy,before);assert.ok(!updated.supports.includes(30283));assert.equal(updated.anchorSupportId,null);
 assert.deepEqual(updated.redFactor,legacy.redFactor);assert.equal(updated.characterId,legacy.characterId);assert.deepEqual(updated.learned,legacy.learned);
 assert.equal(updated.supports[5],30323);assert.equal(updated.farmingPolicy,FARMING_POLICY);
 const explicit=suggestFactorPlan(state,a,focus,catalog,{anchorSupportId:30283});
 assert.equal(refreshFarmingPolicy(explicit,a,catalog,focus),explicit,'新方針で手動指定したカードは維持する');
});

test('ファインに体以外の不足スキルの役割があれば旧保存でも残す',()=>{
 const state=main({}),full=analyze(state,catalog),body=find(full,'レースの真髄・体'),white=full.index.normalByName.get('気持ちを乗せて');
 const other={...body,name:white.name,skillId:white.id},a={...full,rows:[body,other]};
 const candidates={...catalog,supports:catalog.supports.filter(s=>[30283,30323].includes(s.id))};
 const p=suggestFactorPlan(state,a,other,candidates,{characterId:113501});
 assert.ok(p.supports.includes(30283),'他の不足スキルでは自動提案の対象に残る');
 const updated=refreshFarmingPolicy({...p,farmingPolicy:''},a,catalog,other);
 assert.ok(updated.supports.includes(30283));assert.ok(analyzeFactorPlan(updated,a,other).covered.some(r=>r.name===other.name));
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
