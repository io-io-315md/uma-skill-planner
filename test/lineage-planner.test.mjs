import test from 'node:test';
import {farmingFixedSupportId} from '../dist/deck-rules.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyze, createIndex, normalizeState, normalizeLineagePlan } from '../dist/engine.js';
import { suggestCoverageDeck, suggestLineagePlan, analyzeLineagePlan, analyzeCoverageProfile, completeCoverageChoices, lineagePlanKey, lineageSignature, exportLineagePlan, branchIndices, refreshLineagePolicy, refreshSavedFarmingPlans } from '../dist/lineage-planner.js';
import { FARMING_POLICY } from '../dist/farming-policy.js';

const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const main=patch=>normalizeState({characterId:107601,style:'差し',supports:[30317,30304,30306,30302,30287,30323],...patch},catalog);
const row=(id,priority=1)=>({name:`skill${id}`,skillId:id,priority,status:'factor',factorEligible:true});
const support=(id,skills,rarity='SSR',extra={})=>({id,characterId:1000+id,name:`support${id}`,characterName:`support${id}`,type:'power',rarity,hintSkills:skills,eventSkills:[],events:[],...extra});
function fixture(supports,rows){const data={supports,characters:[{id:1,characterId:1,name:'parent',characterName:'parent',innate:[],awakening:[],eventSkills:[]}],skills:rows.map(r=>({id:r.skillId,name:r.name,rarity:1}))};return {catalog:data,analysis:{index:createIndex(data),rows}};}

test('因子厳選の自動提案はSSR・SR・Rを同じ取得経路の候補として扱う',()=>{
  const f=fixture([support(1,[1],'R'),support(2,[2],'SR'),support(3,[3],'SSR')],[row(1),row(2),row(3)]);
  const p=suggestCoverageDeck(1,f.analysis,f.catalog);
  assert.deepEqual(new Set(p.supports.filter(Boolean)),new Set([1,2,3]));
  assert.equal(analyzeCoverageProfile(p,f.analysis).covered.length,3);
});

test('低を多数カバーするSSRより高1件のRを優先し、6枠とキャラの併用制限を守る',()=>{
  const rows=[...Array.from({length:6},(_,i)=>row(i+1)),...Array.from({length:40},(_,i)=>row(i+100,3))];
  const f=fixture([...Array.from({length:6},(_,i)=>support(i+1,[i+1],'R')),support(7,rows.filter(r=>r.priority===3).map(r=>r.skillId))],rows);
  const p=suggestCoverageDeck(1,f.analysis,f.catalog),r=analyzeCoverageProfile(p,f.analysis);
  assert.equal(p.supports.length,6);assert.ok(!p.supports.includes(7));
  assert.equal(r.covered.filter(r=>r.priority===1).length,6);
});

test('未確認イベントを網羅済みに含めず、実際に選んだイベント択だけでカバーする',()=>{
  const f=fixture([support(1,[],'R',{eventSkills:[1]}),support(2,[],'SR',{events:[{id:'evt_test',selection:'single',choices:[{id:'a',skills:[2]},{id:'b',skills:[3,4,5]}],skills:[]}]})],[row(1),row(2),row(3,2),row(4,2),row(5,2)]);
  const p=suggestCoverageDeck(1,f.analysis,f.catalog),r=analyzeCoverageProfile(p,f.analysis);
  assert.deepEqual(p.supports.filter(Boolean),[2]);assert.equal(p.eventChoices.evt_test,'a');
  assert.deepEqual(r.covered.map(r=>r.skillId),[2]);
  const changed=completeCoverageChoices({...p,eventChoices:{evt_test:''}},f.analysis,f.catalog);
  assert.equal(changed.eventChoices.evt_test,'');assert.equal(analyzeCoverageProfile(changed,f.analysis).covered.length,0);
});

test('京都3000の実データでは全脚質で高を網羅し、同キャラの異なるファインを同時に入れない',()=>{
  for(const style of ['逃げ','先行','差し','追込']){
    const state=main({style}),analysis=analyze(state,catalog),before=structuredClone(state),plan=suggestLineagePlan(state,analysis,catalog),r=analyzeLineagePlan(plan,analysis);
    assert.deepEqual(state,before);
    assert.ok(r.targets.some(r=>r.priority===1));
    assert.equal(r.inheritedTargets.find(r=>r.name==='レースの真髄・体').priority,1);
    assert.ok(!r.targets.some(r=>r.name==='レースの真髄・体'));
    for(const [i,node]of plan.nodes.entries())if(node.supports.includes(30283))assert.ok(r.results[i].covered.some(t=>t.farmingRoutes.some(route=>route.label.includes('パワー・ファインモーション'))),'ファインを採用するなら体以外の不足を取る役割が必要');
    assert.ok(r.targets.filter(r=>r.priority===1).every(t=>r.covered.some(r=>r.skillId===t.skillId)));
    for(const [i,node]of plan.nodes.entries()){
      const char=analysis.index.characters.get(node.characterId),cards=node.supports.filter(Boolean).map(id=>analysis.index.supports.get(id));
      assert.equal(new Set(cards.map(s=>s.characterId)).size,cards.length);
      assert.ok(cards.every(s=>s.characterId!==char.characterId));
      assert.equal(node.supports[5],farmingFixedSupportId(node.scenario),'周回シナリオに合う友人1枠を確保する');
      assert.equal(node.supports.filter(id=>id===farmingFixedSupportId(node.scenario)).length,1);
      assert.ok(r.assignments[i].every(t=>r.results[i].covered.some(row=>row.skillId===t.skillId)));
    }
    assert.ok(r.covered.every(t=>r.assignments.some(rows=>rows.some(r=>r.skillId===t.skillId))));
  }
});

test('体だけが不足する場合、6個体のサポカもURAも体のために指定しない',()=>{
  const state=main({}),full=analyze(state,catalog),body=full.rows.find(r=>r.name==='レースの真髄・体');
  const analysis={...full,rows:[body]},p=suggestLineagePlan(state,analysis,catalog),r=analyzeLineagePlan(p,analysis);
  assert.ok(p.nodes.every(n=>n.supports.filter(Boolean).length===1&&n.supports[5]===30323&&n.scenario==='support'));
  assert.deepEqual(r.covered,[]);assert.deepEqual(r.missing,[]);assert.deepEqual(r.targets,[]);
  assert.equal(r.inheritedTargets.length,1);assert.equal(body.priority,1);
  const text=exportLineagePlan(p,analysis,state);
  assert.match(text,/既存因子から引き継ぐ白因子：\[高\] レースの真髄・体/);
  assert.match(text,/フレンド因子にも含める前提：レースの真髄・体/);
  assert.match(text,/6人の編成でも取得元が足りない白因子：なし/);
});

test('旧ツリーも体だけのカードを更新し、手動の赤因子・フレンド側・取得済みを保持する',()=>{
  const state=main({}),full=analyze(state,catalog),body=full.rows.find(r=>r.name==='レースの真髄・体'),analysis={...full,rows:[body]};
  const p=suggestLineagePlan(state,analysis,catalog),event=catalog.supports.find(s=>s.id===30283).events.find(e=>e.selection==='single');
  const slot=p.nodes.findIndex(n=>analysis.index.characters.get(n.characterId)?.characterId!==1022);
  p.nodes[slot]={...p.nodes[slot],supports:[30283,null,null,null,null,30323],eventChoices:{[event.id]:event.choices.find(c=>c.skills.includes(body.skillId)).id},learned:[body.name],farmingPolicy:''};
  p.manual=true;p.friendSide=0;const before=structuredClone(p),updated=refreshLineagePolicy(p,analysis,catalog);
  assert.deepEqual(p,before);assert.equal(updated.manual,true);assert.equal(updated.friendSide,0);
  assert.deepEqual(updated.nodes.map(n=>n.characterId),p.nodes.map(n=>n.characterId));assert.deepEqual(updated.nodes.map(n=>n.redFactor),p.nodes.map(n=>n.redFactor));
  assert.ok(!updated.nodes[slot].supports.includes(30283));assert.deepEqual(updated.nodes[slot].learned,[body.name]);
  assert.ok(updated.nodes.every(n=>n.farmingPolicy===FARMING_POLICY));
  const key=lineagePlanKey(state),saved={...state,lineagePlans:{[key]:p},farmingPlans:{[`${key}:${body.name}`]:p.nodes[slot]}};
  const refreshed=refreshSavedFarmingPlans(saved,analysis,catalog);
  assert.deepEqual(refreshed.supports,state.supports);assert.equal(saved.lineagePlans[key],p);
  assert.ok(!refreshed.lineagePlans[key].nodes[slot].supports.includes(30283));assert.ok(!refreshed.farmingPlans[`${key}:${body.name}`].supports.includes(30283));
  assert.equal(refreshSavedFarmingPlans(refreshed,analysis,catalog),refreshed,'更新後の再描画・書き出しで再提案を繰り返さない');
});

test('親2人と祖父母4人を重複なしで配置し、継承進化は直接親に置く',()=>{
  for(const style of ['先行','差し']){
    const state=main({style}),analysis=analyze(state,catalog),p=suggestLineagePlan(state,analysis,catalog),r=analyzeLineagePlan(p,analysis);
    assert.equal(p.nodes.length,6);
    const ids=p.nodes.map(n=>analysis.index.characters.get(n.characterId).characterId);
    assert.equal(new Set(ids).size,6);assert.ok(!ids.includes(analysis.index.characters.get(state.characterId).characterId));
    assert.ok(r.inheritance.filter(r=>r.evolvedInheritance).every(r=>r.placement==='parent'&&r.evolutionPossible));
    assert.equal(p.friendSide,1);assert.deepEqual(r.friendNodes,[1,4,5]);
    assert.ok(r.friendTargets.every(t=>r.friendNodes.some(i=>r.assignments[i].some(r=>r.skillId===t.skillId))));
    assert.ok(r.friendOnly.every(t=>r.ownNodes.every(i=>!r.results[i].covered.some(r=>r.skillId===t.skillId))));
    const moved=structuredClone(p);[moved.nodes[0],moved.nodes[2]]=[moved.nodes[2],moved.nodes[0]];
    const evolution=analyzeLineagePlan(moved,analysis).inheritance.find(r=>r.evolvedInheritance);
    assert.equal(evolution.placement,'grandparent');assert.equal(evolution.evolutionPossible,false);
  }
});

test('サポカに取得元のない連綿を自前の祖父母で、真髄力をURAで補完する',()=>{
  const state=main({}),analysis=analyze(state,catalog),p=suggestLineagePlan(state,analysis,catalog),r=analyzeLineagePlan(p,analysis);
  const ep=p.nodes.findIndex(n=>n.characterId===114101),ura=p.nodes.findIndex(n=>n.scenario==='ura');
  assert.ok(ep>=2,'差しではエピを継承進化の親として置かない');assert.ok(ura>=2);
  assert.ok(r.assignments[ep].some(r=>r.name==='連綿'));
  assert.ok(r.results[ura].covered.find(r=>r.name==='レースの真髄・力').farmingRoutes.some(route=>route.kind==='scenario'));
  assert.equal(r.covered.length,r.targets.length);
  const supportOnly={...p,nodes:p.nodes.map(n=>({...n,scenario:'support'}))};
  assert.ok(analyzeLineagePlan(supportOnly,analysis).missing.some(r=>r.name==='レースの真髄・力'));
});

test('本体育成のキャラと同じ継承元は親・祖父母に提案せず、12月にも条件を混ぜない',()=>{
  const state=main({characterId:113501,courseId:'2026-12-cm'}),analysis=analyze(state,catalog),p=suggestLineagePlan(state,analysis,catalog),r=analyzeLineagePlan(p,analysis);
  assert.ok(!p.nodes.some(n=>analysis.index.characters.get(n.characterId).characterId===1135));
  assert.ok(!r.inheritance.some(r=>r.name==='黄金を訪ねて'));
  assert.ok(!r.targets.some(r=>r.name==='秋ウマ娘○'));assert.ok(r.targets.some(r=>r.name==='冬ウマ娘○'));
});

test('親・祖父母のSR/R・択・チェックを本育成とは独立して保存し、不足の変更を識別する',()=>{
  const state=main({}),analysis=analyze(state,catalog),p=suggestLineagePlan(state,analysis,catalog),key=lineagePlanKey(state);
  p.nodes[0].learned=['右回り○'];p.manual=true;p.friendSide=0;
  const updated=normalizeState({...state,lineagePlans:{[key]:p}},catalog);
  assert.deepEqual(updated.supports,state.supports);assert.deepEqual(updated.eventChoices,state.eventChoices);
  assert.deepEqual(updated.lineagePlans[key],p);
  assert.equal(updated.lineagePlans[key].friendSide,0);
  assert.deepEqual(branchIndices(0),[0,2,3]);
  assert.equal(normalizeState({},catalog).lineagePlans.constructor,Object);
  assert.notEqual(key,lineagePlanKey({...state,courseId:'2026-12-cm'}));
  const changed=main({supports:[null,null,null,null,null,30323]});
  assert.notEqual(lineageSignature(changed,analyze(changed,catalog)),p.signature);
  const text=exportLineagePlan(p,analysis);
  assert.match(text,/親1：.*フレンド/);assert.match(text,/祖父母4：/);assert.match(text,/本人所持が必要/);assert.match(text,/因子厳選サポカ/);
});

test('インポート時の不正な系譜を補正し、本人や重複キャラをツリーに残さない',()=>{
  const p=normalizeLineagePlan({friendSide:9,nodes:[{characterId:107601},{characterId:113501},{characterId:113501},{characterId:999999}]},catalog,107601);
  assert.equal(p.friendSide,1);assert.equal(p.nodes.length,6);
  assert.deepEqual(p.nodes.slice(0,4).map(n=>n.characterId),[null,113501,null,null]);
  assert.deepEqual(p.nodes[1].supports,[null,null,null,null,null,30323]);
});
