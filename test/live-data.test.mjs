import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateLiveData, applyLiveData, loadLiveData } from '../dist/live-data.js';
import { COURSES, RECOMMENDATIONS } from '../dist/recommendations.js';
import { MAIN_DECK_GUIDE } from '../dist/main-deck-data.js';
import { PRIORITY_RULES } from '../dist/priorities.js';
import { normalizeState, analyze } from '../dist/engine.js';
import { applyMainDeck } from '../dist/main-deck.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const payload=JSON.parse(fs.readFileSync(new URL('../dist/data/live-planner.json',import.meta.url)));
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};

test('現在の開催条件・推奨・noteとラボの出典を更新データに含める',()=>{
  const data=validateLiveData(payload,catalog);
  assert.equal(data.mainDeckGuide.verifiedAt,'2026-10-20');
  const nov=data.mainDeckGuide.events.find(e=>e.courseId==='2026-11-loh');
  assert.ok(nov.sourceIds.some(id=>data.sources[id].url.startsWith('https://note.com/')));
  assert.ok(nov.sourceIds.includes('november'));assert.equal(data.priorityRules['レースの真髄・体'].priority,1);
});
test('起動時の取得はキャッシュを回避し、取得成功時だけ更新データを保存する',async()=>{
  const saved=storage();let request;
  const result=await loadLiveData(catalog,{storage:saved,now:123,fetcher:async(url,options)=>{request={url:String(url),options};return {ok:true,json:async()=>payload};}});
  assert.equal(result.source,'network');assert.match(request.url,/live-planner\.json\?t=123/);assert.equal(request.options.cache,'no-store');
  assert.equal(JSON.parse(saved.getItem('umaplan.live.v1')).revision,payload.revision);
});
test('通信失敗・壊れたデータでは前回の検証済みデータを使い、最新取得と偽らない',async()=>{
  const saved=storage();saved.setItem('umaplan.live.v1',JSON.stringify(payload));
  const failed=await loadLiveData(catalog,{storage:saved,fetcher:async()=>{throw new Error('offline');}});
  assert.equal(failed.source,'cache');assert.equal(failed.data.revision,payload.revision);
  const bad=await loadLiveData(catalog,{storage:saved,fetcher:async()=>({ok:true,json:async()=>({schemaVersion:999})})});
  assert.equal(bad.source,'cache');assert.equal(JSON.parse(saved.getItem('umaplan.live.v1')).revision,payload.revision);
  const empty=await loadLiveData(catalog,{storage:storage(),fetcher:async()=>({ok:false})});
  assert.equal(empty.source,'bundled');assert.equal(empty.data,null);
});
test('存在しないカード・SR・脚質や開催条件の欠落・危険なリンクを拒否する',()=>{
  for(const mutate of [d=>{d.mainDeckGuide.events[0].decks['逃げ'][0]=999999;},d=>{d.mainDeckGuide.events[0].decks['逃げ'][0]=20037;},d=>{delete d.courses[0].distance;},d=>{d.sources.november.url='javascript:alert(1)';},d=>{d.recommendations[0].styles=['不明'];}]){
    const copy=structuredClone(payload);mutate(copy);assert.throws(()=>validateLiveData(copy,catalog));
  }
});
test('新たにコース詳細・推奨・編成が公開されたら同じページの判定へ一括反映できる',()=>{
  const next=structuredClone(payload),jan=next.courses.find(c=>c.id==='2027-01-cm');
  // Synthetic future announcement; this fixture is never shipped as real data.
  Object.assign(jan,{venue:'テスト場',distance:2000,turn:'左',season:'春',weather:'雨',going:'重',time:'昼',runners:9,confirmed:true,summary:'テスト',source:'official'});
  next.recommendations.push({name:'左回り○',category:'緑スキル',priority:1,reason:'テスト用',courses:[jan.id],styles:['逃げ','先行','差し','追込'],sources:['official']});
  next.mainDeckGuide.revision='future-test';next.mainDeckGuide.events.push({courseId:jan.id,venue:jan.venue,distance:2000,surface:'芝',sourceIds:['official'],decks:{'逃げ':[30311,30302,30304,30295,30289],'先行':[30311,30302,30304,30295,30289],'差し':[30311,30302,30304,30295,30289],'追込':[30311,30302,30304,30295,30289]}});
  try{
    const data=validateLiveData(next,catalog);applyLiveData(data);
    const state=applyMainDeck(normalizeState({courseId:jan.id,characterId:107601,style:'先行'},catalog),catalog),a=analyze(state,catalog);
    assert.equal(a.course.distance,2000);assert.equal(a.course.weather,'雨');assert.equal(a.course.venue,'テスト場');
    assert.ok(a.rows.some(r=>r.name==='左回り○'));assert.equal(state.mainDeck.revision,'future-test');assert.equal(state.mainDeck.status,'reviewed');
    assert.ok(!a.rows.some(r=>r.name==='秋ウマ娘○'));assert.equal(PRIORITY_RULES['レースの真髄・体'].priority,1);
  }finally{applyLiveData(validateLiveData(payload,catalog));}
  assert.equal(COURSES.find(c=>c.id===jan.id).confirmed,false);assert.ok(!RECOMMENDATIONS.some(r=>r.reason==='テスト用'));assert.equal(MAIN_DECK_GUIDE.revision,payload.mainDeckGuide.revision);
});
