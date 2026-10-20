import { COURSES, RECOMMENDATIONS, SOURCES, STYLES, LIVE_METADATA } from './recommendations.js';
import { MAIN_DECK_GUIDE } from './main-deck-data.js';
import { PRIORITY_RULES } from './priorities.js';

const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s));
const demand=(ok,label)=>{if(!ok)throw new Error(`Invalid planner data: ${label}`);};
export function validateLiveData(raw,catalog){
  demand(raw?.schemaVersion===1&&typeof raw.revision==='string'&&raw.revision.length<100&&validDate(raw.verifiedAt),'version');
  demand(Array.isArray(raw.courses)&&raw.courses.length>0&&raw.courses.length<=30,'courses');
  const ids=new Set(),skills=new Set(catalog.skills.map(s=>s.name)),cards=new Map(catalog.supports.map(c=>[c.id,c]));
  for(const c of raw.courses){
    demand(c&&typeof c.id==='string'&&!ids.has(c.id)&&/^\d{4}-\d{2}-(cm|loh)$/.test(c.id),'course id');ids.add(c.id);
    demand(['芝','ダート'].includes(c.surface)&&['短距離','マイル','中距離','長距離'].includes(c.distanceType)&&typeof c.confirmed==='boolean','course conditions');
    demand(['month','year','date','type','title'].every(k=>typeof c[k]==='string'),'schedule');
    if(c.confirmed)demand(typeof c.venue==='string'&&Number.isInteger(c.distance)&&c.distance>=1000&&c.distance<=4000&&['turn','season','weather','going','time','summary','source'].every(k=>typeof c[k]==='string')&&Number.isInteger(c.runners)&&c.runners>1,'confirmed course');
  }
  demand(raw.sources&&typeof raw.sources==='object'&&!Array.isArray(raw.sources),'sources');
  for(const s of Object.values(raw.sources))demand(s&&typeof s.name==='string'&&typeof s.kind==='string'&&/^https:\/\//.test(s.url)&&!/[\s<>"']/.test(s.url),'source url');
  demand(Array.isArray(raw.recommendations)&&raw.recommendations.length>0&&raw.recommendations.length<1000,'rules');
  for(const r of raw.recommendations)demand(skills.has(r.name)&&[1,2,3].includes(r.priority)&&typeof r.reason==='string'&&Array.isArray(r.courses)&&r.courses.every(id=>ids.has(id))&&Array.isArray(r.styles)&&r.styles.every(s=>STYLES.includes(s))&&Array.isArray(r.sources)&&r.sources.every(s=>Object.hasOwn(raw.sources,s))&&(!r.gold||skills.has(r.gold)),'rule');
  demand(raw.priorityRules&&typeof raw.priorityRules==='object'&&!Array.isArray(raw.priorityRules),'priority rules');
  for(const [name,r]of Object.entries(raw.priorityRules))demand(skills.has(name)&&[1,2,3].includes(r.priority)&&typeof r.reason==='string'&&(!r.byCourse||Object.entries(r.byCourse).every(([id,p])=>ids.has(id)&&[1,2,3].includes(p))),'priority');
  const guide=raw.mainDeckGuide;
  demand(guide&&validDate(guide.verifiedAt)&&typeof guide.revision==='string'&&typeof guide.scenario==='string'&&Array.isArray(guide.events)&&guide.pools&&typeof guide.pools==='object','deck guide');
  for(const [type,list]of Object.entries(guide.pools)){demand(['speed','stamina','power','guts','wit'].includes(type)&&Array.isArray(list)&&list.length>0&&list.length<=30,'pool');for(const id of list)demand(cards.get(id)?.type===type&&cards.get(id)?.rarity==='SSR','pool card');}
  for(const event of guide.events){demand(ids.has(event.courseId)&&Array.isArray(event.sourceIds)&&event.sourceIds.every(id=>Object.hasOwn(raw.sources,id)),'deck source');for(const style of STYLES){const list=event.decks?.[style];demand(Array.isArray(list)&&list.length===5&&list.every(id=>cards.get(id)?.rarity==='SSR'&&!['friend','group'].includes(cards.get(id).type))&&new Set(list.map(id=>cards.get(id).characterId)).size===5,'deck cards');}}
  return structuredClone(raw);
}
export function applyLiveData(data){
  LIVE_METADATA.verifiedAt=data.verifiedAt;
  COURSES.splice(0,COURSES.length,...data.courses);
  RECOMMENDATIONS.splice(0,RECOMMENDATIONS.length,...data.recommendations);
  for(const key of Object.keys(PRIORITY_RULES))delete PRIORITY_RULES[key];
  Object.assign(PRIORITY_RULES,data.priorityRules);
  Object.assign(SOURCES,data.sources);Object.assign(MAIN_DECK_GUIDE,data.mainDeckGuide);
}
export async function loadLiveData(catalog,{fetcher=fetch,storage,now=Date.now()}={}){
  const key='umaplan.live.v1';
  try{
    const url=new URL('./data/live-planner.json',import.meta.url);url.searchParams.set('t',String(now));
    const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Planner data fetch failed');
    const data=validateLiveData(await response.json(),catalog);
    try{storage?.setItem(key,JSON.stringify(data));}catch{}
    return {data,source:'network'};
  }catch{
    try{const cached=JSON.parse(storage?.getItem(key)??'null');if(cached)return {data:validateLiveData(cached,catalog),source:'cache'};}catch{}
    return {data:null,source:'bundled'};
  }
}
