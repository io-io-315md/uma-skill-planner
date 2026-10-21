import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeState,normalizeFarmingProfile,analyze} from '../dist/engine.js';
import {suggestLineagePlan} from '../dist/lineage-planner.js';
import {RACE_DATA} from '../dist/race-data.js';
import {starsToRank,canRaceWithPreparation,commonG1Bonus,planLineageRotations,normalizeGoalChoices,exportRotation,goalGroups} from '../dist/race-planner.js';
import {preparationHTML,rotationPopupHTML} from '../dist/race-ui.js';

const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const state=normalizeState({characterId:107601,style:'差し'},catalog),analysis=analyze(state,catalog);
const plan=suggestLineagePlan(state,analysis,catalog),result=planLineageRotations(state,analysis,plan);
const character=id=>catalog.characters.find(c=>c.characterId===id);

test('全育成ウマにGameToraの目標プランがあり、共通GⅠの開催年月を保持する',()=>{
  assert.equal(RACE_DATA.verifiedAt,'2026-10-21');
  for(const c of catalog.characters)assert.ok(RACE_DATA.goals[c.characterId]?.length,c.name);
  for(const r of RACE_DATA.races)assert.ok(r.turn>=13&&r.turn<=72&&r.name&&r.fansGained>0);
  const races=RACE_DATA.races.filter(r=>r.key===1018||r.key===1019);
  assert.deepEqual(races.filter(r=>r.turn===46).map(r=>r.key).sort(),[1018,1019]);
  assert.deepEqual(races.filter(r=>r.turn===70).map(r=>r.key).sort(),[1018,1019]);
});

test('ダートD・距離Cを手動周回の候補基準にし、赤★1・4・7・10で準備する',()=>{
  assert.equal(starsToRank('G','D'),7);assert.equal(starsToRank('G','C'),10);
  assert.equal(starsToRank('E','D'),1);assert.equal(starsToRank('D','C'),1);
  assert.equal(starsToRank('A','C'),0);assert.equal(starsToRank('G','A'),Infinity);
  const race={surface:'ダート',distanceType:'マイル'};
  assert.equal(canRaceWithPreparation(race,{aptitudes:{ダート:'D',マイル:'C'}}),true);
  assert.equal(canRaceWithPreparation(race,{aptitudes:{ダート:'E',マイル:'C'}}),false);
  assert.equal(canRaceWithPreparation(race,{aptitudes:{ダート:'D',マイル:'D'}}),false);
});

test('各個体の赤因子は継承元6枠・合計★18以内で、直接親になるツリーの祖父母を含む',()=>{
  for(const [i,rotation]of result.rotations.entries()){
    const prep=rotation.preparation;
    assert.equal(prep.factors.length,6);assert.equal(prep.parents.length,2);assert.equal(prep.grandparents.length,4);
    assert.ok(prep.factors.every(f=>f.stars>=1&&f.stars<=3));
    assert.ok(Object.values(prep.totals).reduce((n,s)=>n+s,0)<=18);
    if(i<2)assert.deepEqual(prep.parents,result.red.targets.slice(2+i*2,4+i*2).map(({type,stars})=>({type,stars})));
    assert.match(preparationHTML(prep),/育成に使う赤因子/);
    assert.match(preparationHTML(prep),/祖父母/);
  }
});

test('目標レースと任意予約を分け、同一ターンの二重予約をせず、3連戦も許容する',()=>{
  let triple=false;
  for(const rotation of result.rotations){
    assert.equal(rotation.issues.length,0,rotation.character.name+rotation.issues.join());
    assert.equal(new Set(rotation.rows.map(r=>r.turn)).size,rotation.rows.length);
    for(const goal of rotation.goals.filter(g=>g.type===1)){
      assert.ok(rotation.rows.some(r=>r.turn===goal.turn&&goal.races.some(g=>g.key===r.key)&&r.mode!=='reserve'),rotation.character.name+' 目標'+goal.order);
    }
    for(const row of rotation.rows){
      if(row.mode==='reserve'){
        assert.equal(canRaceWithPreparation(row,rotation.preparation),true);
        assert.ok(rotation.rows.filter(r=>r.turn<row.turn&&r.canWin).reduce((n,r)=>n+r.fansGained,0)>=row.fansNeeded);
      }
      if(row.streak>=3)triple=true;
    }
  }
  assert.equal(triple,true,'3戦目を機械的に休みにしない');
});

test('ボーナスは正しい5組の共通GⅠだけで計算し、同じGⅠの複数年勝利を重ねない',()=>{
  const rows=[{key:1005,grade:100,canWin:true},{key:1010,grade:100,canWin:true},{key:1005,grade:100,canWin:true},{key:3001,grade:300,canWin:true},{key:1001,grade:100,canWin:false}];
  const common=commonG1Bonus(Array.from({length:6},()=>({rows})));
  assert.equal(common.total,30);assert.equal(common.pairs.length,5);
  assert.deepEqual(common.pairs.map(p=>[p.a,p.b]),[[0,1],[0,2],[0,3],[1,4],[1,5]]);
});

test('フジキセキの三冠とマイルの目標を連動させ、不可能な混合ルートを出さない',()=>{
  const fuji=character(1005);
  assert.deepEqual(normalizeGoalChoices(fuji,{'5':1}),{'5':1,'6':0});
  assert.deepEqual(normalizeGoalChoices(fuji,{'5':0}),{'5':0,'6':1});
  assert.deepEqual(normalizeGoalChoices(fuji,{'6':0}),{'5':1,'6':0});
  const changed=structuredClone(plan);changed.nodes[5].characterId=fuji.id;changed.nodes[5].raceGoalChoices={'5':0};
  const rotation=planLineageRotations(state,analysis,changed).rotations[5];
  assert.equal(rotation.goals.find(g=>g.order===5).races[0].name,'NHKマイルカップ');
  assert.equal(rotation.goals.find(g=>g.order===6).races[0].name,'マイルチャンピオンシップ');
  assert.match(rotationPopupHTML(rotation,'祖父母4'),/マイル路線/);
});

test('ステイゴールドはシニア秋天との重複だけのためにクラシックの菊花賞を落とさない',()=>{
  const gold=result.rotations.find(r=>r.character.characterId===1135);
  assert.equal(gold.goals.find(g=>g.order===5).races[0].key,1015);
  assert.ok(gold.rows.some(r=>r.key===1016&&r.turn===68));
});

test('フクキタルの目標はランダムと表示し、実際に抽選された目標に変更できる',()=>{
  const fuku=character(1056),changed=structuredClone(plan);
  assert.equal(goalGroups(fuku).find(g=>g.order===2).mode,'random');
  changed.nodes[4].characterId=fuku.id;changed.nodes[4].raceGoalChoices={'2':2,'7':2};
  const rotation=planLineageRotations(state,analysis,changed).rotations[4];
  assert.equal(rotation.goals.find(g=>g.order===2).races[0].name,'毎日杯');
  assert.equal(rotation.rows.find(r=>r.goal?.order===2).mode,'random');
  assert.match(rotationPopupHTML(rotation,'祖父母3'),/抽選で指定された目標に合わせる/);
});

test('分岐指定を保存・読み込みし、出力にも予約と自動目標を区別して含める',()=>{
  const raw={characterId:character(1056).id,raceGoalChoices:{'2':2,'7':1,bad:'1','3':-1}};
  assert.deepEqual(normalizeFarmingProfile(JSON.parse(JSON.stringify(raw)),catalog).raceGoalChoices,{'2':2,'7':1});
  const text=exportRotation(result.rotations[0]);
  assert.match(text,/親 .*祖父母 .*合計/);assert.match(text,/予約不要/);assert.match(text,/｜予約/);
});

test('カレンブーケドールは日経賞ルートだけ春天を自動目標として追加する',()=>{
  const changed=structuredClone(plan);changed.nodes[5].characterId=character(1134).id;
  changed.nodes[5].raceGoalChoices={'6':0};
  const kyoto=planLineageRotations(state,analysis,changed).rotations[5];
  assert.equal(kyoto.goals.some(g=>g.order===7),false);
  assert.ok(kyoto.rows.filter(r=>r.key===1006).every(r=>r.mode==='reserve'));
  changed.nodes[5].raceGoalChoices={'6':1};
  const nikkei=planLineageRotations(state,analysis,changed).rotations[5];
  assert.equal(nikkei.goals.find(g=>g.order===6).races[0].name,'日経賞');
  assert.equal(nikkei.rows.find(r=>r.goal?.order===7).mode,'automatic');
});
