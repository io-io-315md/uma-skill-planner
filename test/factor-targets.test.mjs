import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,normalizeState,normalizeFarmingProfile} from '../dist/engine.js';
import {suggestLineagePlan,exportLineagePlan} from '../dist/lineage-planner.js';
import {analyzeRedPlan,starsToA,projectedAptitude,redFactorDetails} from '../dist/factor-targets.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const state=normalizeState({characterId:107601,style:'差し',supports:[30317,30304,30306,30302,30287,30305]},catalog);

test('赤因子は距離Sを狙う配分を基本にし、各個体の準備とフレンド条件にも出力できる',()=>{
  const analysis=analyze(state,catalog),plan=suggestLineagePlan(state,analysis,catalog),red=analyzeRedPlan(state,analysis,plan);
  assert.ok(plan.nodes.every(n=>n.redFactor.type==='長距離'&&n.redFactor.stars===3));
  assert.equal(red.totals.長距離,18);assert.ok(red.initial.every(r=>r.ready));
  assert.equal(red.genes[0].distanceStars,6);assert.equal(red.genes[0].remainingDistance,6);
  assert.equal(red.genes[0].remainingStyle,6);assert.equal(red.genes[2].visible.length,0);
  assert.ok(red.targets.every(r=>r.preparation));
  assert.match(exportLineagePlan(plan,analysis,state),/指定する赤因子：長距離/);
});

test('適性補正の星数境界を正しく扱い、初期F/Gを開始時AやSにしない',()=>{
  assert.deepEqual(['A','B','C','D','E'].map(starsToA),[0,1,4,7,10]);
  assert.equal(starsToA('F'),Infinity);assert.equal(starsToA(null),null);
  assert.deepEqual([0,1,3,4,6,7,9,10,18].map(s=>projectedAptitude('G',s)),['G','F','F','E','E','D','D','C','C']);
  assert.equal(projectedAptitude('A',18),'A');assert.equal(projectedAptitude('F',18),'B');
});

test('本育成の脚質が低い場合は補正用の赤因子を確保し、開始時Aに届かない計画を明示する',()=>{
  const altered=structuredClone(catalog),character=altered.characters.find(c=>c.id===state.characterId);
  character.aptitude[8]='D';
  const s=normalizeState(state,altered),analysis=analyze(s,altered),plan=suggestLineagePlan(s,analysis,altered),red=analyzeRedPlan(s,analysis,plan);
  assert.equal(red.totals.差し,9);assert.equal(red.totals.長距離,9);
  assert.equal(red.initial.find(r=>r.type==='差し').projected,'A');
  character.aptitude[8]='G';const a=analyze(s,altered),p=suggestLineagePlan(s,a,altered),r=analyzeRedPlan(s,a,p);
  assert.ok(r.warnings.some(w=>w.includes('差し')&&w.includes('開始時Aに届いていない')));
});

test('赤因子の手動設定・星目標とSR/Rを保存し、たづなを欠落・重複させない',()=>{
  const fixed=catalog.supports.find(s=>s.id===30305);
  const cards=[];for(const rarity of ['SR','R'])cards.push(catalog.supports.find(s=>s.rarity===rarity&&s.characterId!==1076&&s.characterId!==fixed.characterId&&!cards.some(c=>c.characterId===s.characterId)));
  const old={characterId:107601,supports:[30305,cards[0].id,cards[1].id,null,null,30283],redFactor:{type:'ダート',stars:2}};
  const p=normalizeFarmingProfile(old,catalog);
  assert.equal(p.supports[5],30305);assert.equal(p.supports.filter(id=>id===30305).length,1);
  assert.ok(p.supports.includes(30283),'たづな移動で空いた枠に6枚目を残す');
  assert.deepEqual(p.redFactor,{type:'ダート',stars:2});
  assert.ok(p.supports.includes(cards[0].id)&&p.supports.includes(cards[1].id));
  assert.equal(normalizeFarmingProfile({redFactor:{type:'invalid',stars:9}},catalog).redFactor,null);
  assert.equal(redFactorDetails(p,analyze(state,catalog)).type,'ダート');
});

test('今回の京都の自制心だけを中へ調整し、他の高スキルと12月の設定を保つ',()=>{
  for(const style of ['逃げ','先行','差し','追込']){
    const a=analyze({...state,style},catalog),jisei=a.rows.find(r=>r.name==='自制心');
    assert.equal(jisei.priority,2);assert.match(jisei.priorityReason,/今回の京都3000m/);
    for(const name of ['右回り○','秋ウマ娘○','レースの真髄・体'])assert.equal(a.rows.find(r=>r.name===name).priority,1);
  }
  assert.equal(analyze({...state,courseId:'2026-12-cm'},catalog).rows.find(r=>r.name==='自制心').priority,2);
});
