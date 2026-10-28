import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeState,normalizeFarmingProfile,createIndex,acquisitionRoutes,analyze,resolvedEventChoice} from '../dist/engine.js';
import {applyMainDeck} from '../dist/main-deck.js';
import {COURSES,STYLES} from '../dist/recommendations.js';
import {createSupportUsageIndex,matchesSupportUsage} from '../dist/support-usage.js';
import {selectedScenarioSkill,scenarioSkillOptions,scenarioAcquisition} from '../dist/scenario-skills.js';
import {validateLiveData,loadLiveData} from '../dist/live-data.js';
import {COURSE_TIERS} from '../dist/character-tiers.js';
import {scenarioChoiceHTML} from '../dist/scenario-ui.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const index=createIndex(catalog),skill=name=>index.normalByName.get(name)?.id;
const main=(style,patch={})=>applyMainDeck(normalizeState({characterId:107601,style,...patch},catalog),catalog);

test('旧固定たづなを吾妻へ移行し、他5枚と保存スナップショット・準備チェックを保つ',()=>{
  const supports=[30302,30311,30304,30322,30289,30305],snapshot={supports:[...supports]};
  const raw={characterId:107601,supports,prepared:['右回り○'],plans:[{label:'旧保存',state:snapshot}]},before=structuredClone(raw);
  const state=normalizeState(raw,catalog);
  assert.deepEqual(raw,before);
  assert.deepEqual(state.supports,[...supports.slice(0,5),30323]);
  assert.deepEqual(state.prepared,['右回り○']);assert.deepEqual(state.plans[0].state,snapshot);
});

test('因子周回はシナリオごとの友人を固定し、SR・Rと赤因子を保持する',()=>{
  const sr=catalog.supports.find(s=>s.rarity==='SR'),r=catalog.supports.find(s=>s.rarity==='R'&&s.characterId!==sr.characterId&&s.characterId!==9052);
  const source={characterId:107601,supports:[sr.id,r.id,null,null,null,30305],redFactor:{type:'ダート',stars:3}};
  const current=normalizeFarmingProfile(source,catalog);
  assert.equal(current.supports[5],30323);assert.ok(current.supports.includes(sr.id)&&current.supports.includes(r.id));
  assert.deepEqual(current.redFactor,source.redFactor);
  for(const scenario of ['tracen','ura']){
    const old=normalizeFarmingProfile({...current,scenario},catalog);assert.equal(old.supports[5],30305);assert.ok(!old.supports.includes(30323));
    assert.equal(normalizeFarmingProfile({...old,scenario:'support'},catalog).supports[5],30323);
  }
});

test('全脚質を5種類・スピード2枚型にし、前方はマヤノ、後方は専用パワーを優先する',()=>{
  for(const courseId of ['2026-11-loh','2026-12-cm'])for(const style of STYLES){
    const state=main(style,{courseId}),cards=state.supports.map(id=>index.supports.get(id));
    assert.equal(new Set(cards.map(c=>c.type)).size,5);assert.equal(cards.filter(c=>c.type==='speed').length,2);
    assert.equal(state.supports[5],30323);assert.ok(!state.supports.includes(30305));
    if(['逃げ','先行'].includes(style))assert.ok(state.supports.includes(30322));
    else assert.ok(!state.supports.includes(30322));
  }
  assert.ok(main('差し').supports.includes(30297));assert.ok(main('追込').supports.includes(30321));
  const mayano=main('逃げ',{characterId:102403});assert.ok(!mayano.supports.includes(30322));assert.equal(mayano.supports.filter(Boolean).length,6);
});

test('マヤノは汎用候補として後方にも表示し、金3択は同時計上しない',()=>{
  const usage=createSupportUsageIndex(catalog).get(30322);
  for(const style of STYLES)assert.equal(matchesSupportUsage(usage,{distance:'長距離',style,surface:'芝'}),true);
  const mayano=index.supports.get(30322),event=mayano.events.find(e=>e.id==='evt_30322_arrows3');
  assert.equal(event.choices.length,3);
  for(const [i,name]of ['機転','希代の才覚','アドバンテージ'].entries()){
    const state=normalizeState({characterId:107601,style:'差し',supports:[30322],eventChoices:{[event.id]:event.choices[i].id}},catalog);
    const routes=acquisitionRoutes(state,index);
    assert.ok(routes.has(skill('英俊豪傑'))&&routes.has(skill(name)));
    for(const other of ['機転','希代の才覚','アドバンテージ'].filter(n=>n!==name))assert.ok(!routes.has(skill(other)));
  }
  assert.equal(index.skills.get(skill('希代の才覚')).lowerId,skill('直感力'));
  assert.equal(analyze(main('先行'),catalog).rows.find(r=>r.name==='直感力').status,'available');
  const middle=main('先行',{courseId:'2027-01-cm'});
  assert.equal(resolvedEventChoice(event,middle,index).skills.includes(skill('機転')),true);
});

test('吾妻のお出かけから神速、マヤノの2回目からアオハル賢を照合する',()=>{
  const state=main('逃げ'),routes=acquisitionRoutes(state,index);
  assert.ok(routes.get(skill('神速')).some(r=>r.label.includes('吾妻')));
  assert.ok(routes.get(skill('アオハル点火・賢')).some(r=>r.label.includes('いいきっかけ')));
  assert.equal(state.eventChoices.evt_30323_random2,'choice2');
});

test('駿大祭のリンク択は1種類だけ。前方は順風、後方は吾妻の択を自動設定する',()=>{
  const front=main('先行'),rear=main('差し');
  assert.equal(selectedScenarioSkill(front,index).id,'1024');assert.equal(selectedScenarioSkill(rear,index).id,'9052');
  assert.ok(acquisitionRoutes(front,index).has(skill('順風満帆')));
  assert.ok(!acquisitionRoutes(front,index).has(skill('螺旋のエキスパート')));
  assert.ok(acquisitionRoutes(rear,index).has(skill('螺旋のエキスパート')));
  assert.ok(!acquisitionRoutes(rear,index).has(skill('順風満帆')));
  const selected={...rear,scenarioChoice:'1128'},option=scenarioSkillOptions(selected,index).find(o=>o.id==='1128');
  assert.equal(option.linked,false);assert.equal(option.skillName,'ウマ好み');
  const only=scenarioAcquisition(selected,index).filter(r=>r.condition.includes('本番前のひと時'));
  assert.equal(only.length,1);assert.equal(only[0].skillId,skill('ウマ好み'));
  for(const scenario of ['ura','tracen'])assert.deepEqual(scenarioAcquisition({...front,scenario},index),[]);
  const milestones=scenarioAcquisition(front,index).filter(r=>r.condition.includes('全演目で大成功'));
  assert.equal(milestones.length,2);assert.ok(milestones.every(r=>r.label.includes('条件達成時')));
});

test('シナリオ択のHTMLは選択済み1件を表示し、旧シナリオでは新シナリオ択を出さない',()=>{
  const state={...main('先行'),scenarioChoice:'1024'},html=scenarioChoiceHTML(state,index);
  assert.equal((html.match(/ selected/g)??[]).length,1);assert.match(html,/金：順風満帆/);
  assert.match(html,/data-scenario-choice/);assert.match(html,/全身全霊/);
  assert.equal(scenarioChoiceHTML({...state,scenario:'tracen'},index),'');
  assert.equal(scenarioChoiceHTML({...state,scenario:'ura'},index),'');
});

test('前シナリオの編成データをキャッシュから再適用せず、同梱の新シナリオへ戻る',async()=>{
  const old=JSON.parse(fs.readFileSync(new URL('../dist/data/live-planner.json',import.meta.url)));
  old.mainDeckGuide.fixedSupportId=30305;old.mainDeckGuide.scenario='トレセン軒';
  assert.throws(()=>validateLiveData(old,catalog),/scenario friend/);
  const result=await loadLiveData(catalog,{fetcher:async()=>{throw Error('offline');},storage:{getItem:()=>JSON.stringify(old)}});
  assert.equal(result.source,'bundled');assert.equal(result.data,null);
});

test('新ダスカを複数の公開評価で追加し、東京2400の発表と4月の予定も反映する',()=>{
  const nov=COURSE_TIERS['2026-11-loh'],daiwa=nov.entries.find(e=>e.characterId===100903);
  assert.equal(daiwa.tier,'A');assert.equal(daiwa.opinions.length,2);assert.ok(nov.sourceIds.includes('kyotoLab'));
  const jan=COURSES.find(c=>c.id==='2027-01-cm');assert.equal(jan.distance,2400);assert.equal(jan.venue,'東京');assert.equal(jan.confirmed,true);
  const rows=analyze(main('先行',{courseId:jan.id}),catalog).rows;
  assert.ok(rows.some(r=>r.name==='左回り○'));assert.ok(!rows.some(r=>r.name==='右回り○'||r.name==='直感力'));
  assert.equal(COURSES.find(c=>c.id==='2027-04-cm').confirmed,false);
});
