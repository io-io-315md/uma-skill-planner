import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSkillTargets,createSupportUsageIndex,matchesSupportUsage,skillMatchesRace,classifySupport} from '../dist/support-usage.js';
import {normalizeState,normalizeFarmingProfile,createIndex,resolvedEventChoice,exportChecklist,analyze} from '../dist/engine.js';
import {FIXED_SUPPORT_ID,FIXED_SUPPORT_SLOT,RENTAL_SUPPORT_SLOT} from '../dist/deck-rules.js';
import {artwork,SUPPORT_ART_TYPES} from '../dist/ui.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const usage=createSupportUsageIndex(catalog),skills=new Map(catalog.skills.map(s=>[s.id,s]));

test('全サポカの全取得スキルに元説明と対象を持ち、相手へのけん制や前方条件を脚質制限と誤認しない',()=>{
  for(const support of catalog.supports){
    const profile=usage.get(support.id);
    assert.ok(profile.contexts.length,'用途未分類: '+support.id);
    for(const id of profile.skillIds){
      const s=skills.get(id);assert.ok(s.description&&s.targets,'対象未登録: '+id);
      assert.deepEqual(s.targets,parseSkillTargets(s.description));
    }
  }
  assert.deepEqual(parseSkillTargets('レース中盤に逃げの速度を下げる＜長距離＞'),{distances:['長距離'],styles:[],surfaces:[]});
  assert.equal(skillMatchesRace({targets:parseSkillTargets('前方だと速度が上がる＜中距離/長距離＞')},{distanceType:'長距離',surface:'芝'},'追込'),true);
});

test('ヤングは汎用とダートの択、ドトウは中長距離汎用、新スピテイオーは全距離先行に分類',()=>{
  assert.equal(usage.get(30289).label,'全距離 / 汎用');assert.equal(usage.get(30289).hasDirt,true);
  assert.equal(usage.get(30304).label,'中距離・長距離 / 汎用');
  assert.equal(usage.get(30275).label,'全距離 / 先行');
  for(const style of ['逃げ','先行','差し','追込']){
    assert.equal(matchesSupportUsage(usage.get(30289),{distance:'長距離',style,surface:'芝'}),true);
    assert.equal(matchesSupportUsage(usage.get(30304),{distance:'中距離',style,surface:'芝'}),true);
    assert.equal(matchesSupportUsage(usage.get(30304),{distance:'長距離',style,surface:'芝'}),true);
  }
  assert.equal(matchesSupportUsage(usage.get(30304),{distance:'マイル',style:'先行',surface:'芝'}),false);
  for(const distance of ['短距離','マイル','中距離','長距離'])assert.equal(matchesSupportUsage(usage.get(30275),{distance,style:'先行',surface:'芝'}),true);
  assert.equal(matchesSupportUsage(usage.get(30275),{distance:'長距離',style:'差し',surface:'芝'}),false);
});

test('ダート限定カードを芝向けの自動候補に混ぜず、汎用・ダートの両方の択があるカードは残す',()=>{
  const dirt=usage.get(30211);
  assert.ok(dirt.hasDirt);
  assert.equal(matchesSupportUsage(dirt,{distance:'マイル',style:'先行',surface:'芝'}),false);
  assert.equal(matchesSupportUsage(dirt,{distance:'マイル',style:'先行',surface:'ダート',dirtOnly:true}),true);
  assert.equal(matchesSupportUsage(usage.get(30289),{distance:'マイル',style:'差し',surface:'ダート',dirtOnly:true}),true);
  assert.equal(matchesSupportUsage(usage.get(30304),{distance:'中距離',dirtOnly:true}),true,'ダートでも使える汎用スキルを除外しない');
  assert.equal(matchesSupportUsage(usage.get(30275),{style:'汎用'}),false);
});

test('異なるイベント択の距離と脚質を交差させず、同じ金スキルの組合せで判定する',()=>{
  const sampleSkills=new Map([[1,{rarity:2,targets:parseSkillTargets('効果＜先行・長距離＞')}],[2,{rarity:2,targets:parseSkillTargets('効果＜差し・マイル＞')}]]);
  const profile=classifySupport({eventSkills:[],hintSkills:[],events:[{selection:'single',choices:[{skills:[1]},{skills:[2]}]}]},sampleSkills);
  assert.equal(matchesSupportUsage(profile,{distance:'長距離',style:'先行'}),true);
  assert.equal(matchesSupportUsage(profile,{distance:'マイル',style:'差し'}),true);
  assert.equal(matchesSupportUsage(profile,{distance:'長距離',style:'差し'}),false);
  assert.equal(matchesSupportUsage(profile,{distance:'マイル',style:'先行'}),false);
});

test('長距離で新テイオーの中距離限定択を自動選択せず、ヤングも芝では汎用金択を選ぶ',()=>{
  const index=createIndex(catalog);
  const event=catalog.supports.find(s=>s.id===30275).events.find(e=>e.choices.some(c=>c.skills.includes(203441)));
  const choice=resolvedEventChoice(event,normalizeState({style:'先行'},catalog),index);
  assert.ok(choice.skills.includes(203421));assert.ok(!choice.skills.includes(203441));
  const young=catalog.supports.find(s=>s.id===30289).events.find(e=>e.choices.some(c=>c.skills.includes(204191)));
  assert.ok(resolvedEventChoice(young,normalizeState({},catalog),index).skills.includes(204181));
});

test('SSRたづなを本育成と因子周回の6枠目に固定し、周回の残りはSSR・SR・Rを保つ',()=>{
  assert.equal(FIXED_SUPPORT_SLOT,5);assert.equal(RENTAL_SUPPORT_SLOT,4);
  const state=normalizeState({},catalog);assert.equal(state.supports[5],FIXED_SUPPORT_ID);
  assert.equal(normalizeState({supports:[null,null,null,null,null,30289]},catalog).supports[5],FIXED_SUPPORT_ID);
  const swapped=normalizeState({supports:[30305,30304,30306,30302,30283,30289]},catalog);
  assert.deepEqual(swapped.supports,[30289,30304,30306,30302,30283,30305]);
  assert.equal(new Set(swapped.supports).size,6);
  const farming=normalizeFarmingProfile({supports:[30289]},catalog);assert.equal(farming.supports[5],FIXED_SUPPORT_ID);
  assert.equal(farming.supports.filter(id=>id===FIXED_SUPPORT_ID).length,1);
  const text=exportChecklist(swapped,analyze(swapped,catalog));
  assert.match(text,/5\. .*\[レンタル\]/);assert.match(text,/6\. .*駿川たづな \[自前・固定\]/);
});

test('サポカ7種類のゲーム内アイコンを画像右上用に添付し、キャラの顔アイコンには付けない',()=>{
  for(const [type,{label}]of Object.entries(SUPPORT_ART_TYPES)){
    const item=catalog.supports.find(s=>s.type===type),html=artwork(item);
    assert.ok(html.includes('support-type-badge')&&html.includes('aria-label="'+label+'"')&&html.includes('assets/support-types/'+type+'.png'));
    const bytes=fs.readFileSync(new URL('../dist/assets/support-types/'+type+'.png',import.meta.url));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }
  assert.ok(!artwork(catalog.characters[0]).includes('support-type-badge'));
});
