import fs from 'node:fs/promises';
// GameToraの個別ページで復元済みの日本版イベントを使う。辞書とイベントの
// 公開タイミングが異なるマニフェストを混ぜて選択肢を復号しない。
const ids=[30322,30323,10149,30321],verifiedAt='2026-10-28';
const skills=new Map(JSON.parse(await fs.readFile(new URL('../research/gametora-skills.json',import.meta.url),'utf8')).map(s=>[s.id,s.jpname]));
const cards=[];
for(const id of ids){
  const slug=id===30322?'mayano-top-gun':id===30321?'duramente':'azuma',source=`https://gametora.com/ja/umamusume/supports/${id}-${slug}`;
  const response=await fetch(source);if(!response.ok)throw Error(`${id}: ${response.status}`);
  const match=(await response.text()).match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if(!match)throw Error('Event page unavailable: '+id);
  const page=JSON.parse(match[1]).props.pageProps;
  if(page.itemData.support_id!==id)throw Error('Wrong support page: '+id);
  const groups=JSON.parse(page.eventData.ja),events=[];
  for(const [group,list]of Object.entries(groups))for(const [i,event]of list.entries()){
    if(!event?.c?.length)continue;
    const choices=event.c.map((choice,j)=>{
      const outcomes=[[]];for(const reward of choice.r??[]){if(reward.t==='di')outcomes.push([]);else if(reward.t==='sk')outcomes.at(-1).push(reward.d);}
      // 成功・通常結果に共通するスキルだけを確定した取得経路として登録。
      const ids=[...new Set(outcomes[0])].filter(id=>outcomes.every(ids=>ids.includes(id)));
      for(const id of ids)if(!skills.has(id))throw Error('Unknown event skill: '+id);
      return {id:`choice${j+1}`,label:`${['①','②','③','④','⑤','⑥'][j]??j+1} ${choice.o||'イベント完走'}${ids.length?'｜'+ids.map(id=>skills.get(id)).join('＋'):''}`,skills:ids.map(skillId=>({skillId}))};
    });
    if(!choices.some(c=>c.skills.length))continue;
    events.push({id:`evt_${id}_${group}${i+1}`,label:event.n,selection:choices.length>1?'single':'all',skills:choices.length===1?choices[0].skills:[],...(choices.length>1?{choices}:{}),defaultChoiceId:null});
  }
  cards.push({id,source,verifiedAt,events});
}
await fs.mkdir(new URL('../data/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../data/support-event-overrides.json',import.meta.url),JSON.stringify({verifiedAt,cards},null,2)+'\n');
console.log('Verified support event updates: '+cards.map(c=>`${c.id} (${c.events.length})`).join(', '));
