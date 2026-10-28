import { COURSES, STYLES, RECOMMENDATIONS } from './recommendations.js';
import { createIndex, normalizeState, eventChoicesForPurpose, lowerClosure } from './engine.js';
import { skillMatchesRace } from './support-usage.js';
import { MAIN_DECK_GUIDE } from './main-deck-data.js';
import { FIXED_SUPPORT_ID } from './deck-rules.js';

const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
export function preferredStyle(character,current='先行'){
  const ranks={A:7,B:6,C:5,D:4,E:3,F:2,G:1};
  const values=STYLES.map((style,i)=>({style,rank:ranks[character?.aptitude?.[6+i]]??0}));
  const best=Math.max(...values.map(r=>r.rank));
  return values.find(r=>r.style===current&&r.rank===best)?.style??values.find(r=>r.rank===best)?.style??current;
}
function cardOptions(card,index,course,style){
  const valid=id=>skillMatchesRace(index.skills.get(id),course,style);
  let options=[{card,ids:[...card.hintSkills.filter(valid)],eventChoices:{}}];
  for(const event of card.events){
    if(event.selection!=='single'){for(const option of options)option.ids.push(...event.skills.filter(valid));continue;}
    const choices=eventChoicesForPurpose(event,index,'main').filter(c=>c.skills.filter(id=>index.skills.get(id)?.rarity===2).every(valid));
    if(!choices.length)continue;
    options=options.flatMap(o=>choices.map(c=>({card,ids:[...o.ids,...c.skills.filter(valid)],eventChoices:{...o.eventChoices,[event.id]:c.id}})));
  }
  return options.map(o=>({...o,ids:new Set(o.ids.flatMap(id=>lowerClosure(id,index))),gold:new Set(o.ids.filter(id=>index.skills.get(id)?.rarity===2))}));
}
export function suggestMainDeck(state,catalog,guide=MAIN_DECK_GUIDE){
  const index=createIndex(catalog),character=index.characters.get(state.characterId),course=COURSES.find(c=>c.id===state.courseId)??COURSES[0];
  if(!character)return {supports:[null,null,null,null,null,FIXED_SUPPORT_ID],eventChoices:{},status:'unselected',sourceIds:[],reasons:[]};
  const event=guide.events.find(e=>e.courseId===course.id&&e.distance===course.distance&&e.surface===course.surface&&e.venue===course.venue);
  const base=event?.decks[state.style]??guide.defaults?.[state.style];
  const types=base?base.map(id=>index.supports.get(id)?.type):['speed','speed','stamina','power','wit'];
  const native=new Set([...character.innate,...character.awakening].flatMap(id=>lowerClosure(id,index)));
  const rows=RECOMMENDATIONS.filter(r=>r.courses.includes(course.id)&&r.styles.includes(state.style)&&!r.inherited);
  const important=new Set(rows.filter(r=>r.priority===1&&r.gold).map(r=>index.normalByName.get(r.gold)?.id).filter(Boolean));
  const allOptions=new Map();
  for(const card of catalog.supports){
    if(card.rarity!=='SSR'||card.characterId===character.characterId||['friend','group'].includes(card.type))continue;
    const options=cardOptions(card,index,course,state.style).filter(o=>o.gold.size);
    if(options.length)allOptions.set(card.id,options);
  }
  const score=deck=>{
    const ids=new Set([...native,...deck.flatMap(o=>[...o.ids])]),gold=new Set(deck.flatMap(o=>[...o.gold]).filter(id=>!native.has(id)));
    const useful=deck.reduce((n,o)=>n+o.review*(Array.from(o.gold).some(id=>!native.has(id))?1:.25),0);
    return [[...important].filter(id=>ids.has(id)).length,useful,gold.size,rows.reduce((n,r)=>n+(ids.has(index.normalByName.get(r.name)?.id)?4-r.priority:0),0)];
  };
  let beam=[[]];
  for(let slot=0;slot<5;slot++){
    const type=types[slot],reviewed=[...new Set([base?.[slot],...(guide.pools[type]??[])].filter(Boolean))];
    const fallback=catalog.supports.filter(c=>c.type===type&&allOptions.has(c.id)&&!reviewed.includes(c.id)).sort((a,b)=>(b.releaseDate??'').localeCompare(a.releaseDate??'')||b.id-a.id).slice(0,6).map(c=>c.id);
    const candidates=[...reviewed,...fallback].flatMap((id,i)=>(allOptions.get(id)??[]).map(o=>({...o,review:i<reviewed.length?100-i*8:10,slot})));
    const next=beam.flatMap(deck=>{
      const used=new Set(deck.map(o=>o.card.characterId));
      const choices=candidates.filter(o=>!used.has(o.card.characterId));
      return choices.length?choices.map(o=>[...deck,o]):[deck];
    });
    next.sort((a,b)=>compare(score(b),score(a))||b.reduce((n,o)=>n+o.card.id,0)-a.reduce((n,o)=>n+o.card.id,0));
    beam=next.slice(0,32);
  }
  const selected=beam[0]??[],supports=Array.from({length:5},(_,slot)=>selected.find(o=>o.slot===slot)?.card.id??null);
  const fixed=index.supports.get(FIXED_SUPPORT_ID);
  const fixedChoice=fixed?cardOptions(fixed,index,course,state.style).sort((a,b)=>b.ids.size-a.ids.size)[0]:null;
  const reasons=selected.map(o=>({slot:o.slot,cardId:o.card.id,gold:[...o.gold].filter(id=>!native.has(id)).map(id=>index.skills.get(id)?.name),replacement:!!base&&base[o.slot]!==o.card.id}));
  return {supports:[...supports,FIXED_SUPPORT_ID],eventChoices:Object.assign({},...selected.map(o=>o.eventChoices),fixedChoice?.eventChoices),status:event&&course.confirmed?'reviewed':'provisional',sourceIds:event?.sourceIds??[],reasons};
}
export function applyMainDeck(state,catalog,guide=MAIN_DECK_GUIDE){
  if(!state.characterId)return state;
  const plan=suggestMainDeck(state,catalog,guide);
  return normalizeState({...state,supports:plan.supports,eventChoices:plan.eventChoices,mainDeck:{mode:'auto',revision:guide.revision,status:plan.status,sourceIds:plan.sourceIds,reasons:plan.reasons}},catalog);
}
export function changeMainConditions(state,patch,catalog,guide=MAIN_DECK_GUIDE,{force=false,chooseStyle=false}={}){
  const next=normalizeState({...state,...patch},catalog);
  if(chooseStyle&&next.characterId)next.style=preferredStyle(catalog.characters.find(c=>c.id===next.characterId),next.style);
  const changed=['characterId','style','courseId'].some(key=>next[key]!==state[key]);
  return (changed||force)&&next.characterId?applyMainDeck(next,catalog,guide):next;
}
