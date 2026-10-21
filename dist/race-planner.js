import {RACE_DATA} from './race-data.js';
import {RED_FACTORS,redAptitude,projectedAptitude,analyzeRedPlan} from './factor-targets.js';

const RANKS=['G','F','E','D','C','B','A','S'];
const TYPES=['芝','ダート','短距離','マイル','中距離','長距離'];
export const COMPATIBILITY_PAIRS=[[0,1],[0,2],[0,3],[1,4],[1,5]];
// 周回はデビュー1着で1,000人以上になる編成を前提とする。凸数を入力しないため、
// 各サポカの実値を仮定せず、その条件を満たす下限の合計ファンボーナスで判定する。
export const ROTATION_MIN_FAN_BONUS=43;
export const minimumRaceFans=race=>Math.floor(race.fansGained*(100+ROTATION_MIN_FAN_BONUS)/100);
export const ROTATION_SOURCES=[
  {name:'GameTora：キャラ別目標・レース日程',url:RACE_DATA.sources.calendar,date:RACE_DATA.verifiedAt},
  {name:'20マンモス：因子の掘り方と周回ローテ',url:'https://note.com/200000is/n/nc60b4a56195a',date:'2025-04-15'},
  {name:'ml’p：因子周回・共通GⅠボーナス',url:'https://note.com/mlp_229/n/n3688b3add40c',date:'2026-08-26'},
  {name:'dai：自主トレ周回と目標・適性の違い',url:'https://note.com/light_bear2389/n/n84ceacf1568d',date:'2026-09-21'},
  {name:'れい：トレセン軒の因子周回',url:'https://note.com/umamusume_sui/n/n7eb1445f0c07',date:'2026-07-02'},
  {name:'しちみ：ファン数ボーナスの合算とデビュー1,000人の条件',url:'https://note.com/mekabu1672/n/nb332b7447f1e',date:'2021-05-10'},
  {name:'U-tools：共通GⅠの5組と重複勝利の扱い',url:'https://xn--gck1f423k.xn--1bvt37a.tools/announcements/5',date:'2023-03-06'},
  {name:'公式：相性ボーナス詳細の表示',url:'https://umamusume.jp/news/detail/?id=3395',date:'2026-08-24'}
];
const cache=new Map();
const calendarByTurn=new Map();
for(const race of RACE_DATA.races){if(!calendarByTurn.has(race.turn))calendarByTurn.set(race.turn,[]);calendarByTurn.get(race.turn).push(race);}
const g1Keys=[...new Set(RACE_DATA.races.filter(r=>r.grade===100).map(r=>r.key))];
const bits=new Map(g1Keys.map((key,i)=>[key,1n<<BigInt(i)]));
const rank=value=>RANKS.indexOf(value);
const sumFactors=factors=>Object.fromEntries(RED_FACTORS.map(type=>[type,factors.reduce((n,f)=>n+(f.type===type?f.stars:0),0)]).filter(([,n])=>n));
export const raceDate=turn=>({year:Math.floor((turn-1)/24)+1,month:Math.floor(((turn-1)%24)/2)+1,half:turn%2===1?'前半':'後半'});
export const raceDateLabel=turn=>{const d=raceDate(turn);return `${['','ジュニア','クラシック','シニア'][d.year]??'育成終了'} ${d.month}月${d.half}`;};
export const gradeLabel=grade=>({100:'GⅠ',200:'GⅡ',300:'GⅢ',400:'OP',700:'OP',900:'デビュー'}[grade]??'OP');

export function starsToRank(initial,target){
  if(!RANKS.includes(initial)||!RANKS.includes(target))return null;
  const steps=rank(target)-rank(initial);
  return steps<=0?0:steps>4?Infinity:1+(steps-1)*3;
}

export function canRaceWithPreparation(race,preparation){
  return rank(preparation.aptitudes[race.surface])>=3 && rank(preparation.aptitudes[race.distanceType])>=4;
}

// 分岐の一覧はゲームの目標データを保持する。ランダムな目標を選択可能とは表示しない。
export function goalGroups(character){
  const groups=new Map();
  for(const goal of RACE_DATA.goals[character?.characterId]??[]){
    if(!groups.has(goal.order))groups.set(goal.order,[]);
    const options=groups.get(goal.order);
    if(!options.some(g=>g.turn===goal.turn&&g.type===goal.type&&g.races.map(r=>r.key).join()===goal.races.map(r=>r.key).join()))options.push(goal);
  }
  return [...groups].map(([order,options])=>({order,options,mode:character?.characterId===1056&&[2,7].includes(order)?'random':
    options.some(o=>[1,2].includes(o.choice))||[1005,1022,1071].includes(character?.characterId)?'select':'conditional'}));
}

export function normalizeGoalChoices(character,choices={}){
  const groups=goalGroups(character);
  const result=Object.fromEntries(Object.entries(choices??{}).filter(([order,value])=>Number.isInteger(value)&&value>=0&&value<(groups.find(g=>String(g.order)===order)?.options.length??0)));
  if(character?.characterId===1005){
    // フジキセキ：三冠＝ダービー＋菊花賞、マイル＝NHK＋マイルCS。
    const derby=Number(result['5'])===1;
    if(result['5']!==undefined)result['6']=derby?0:1;
    else if(result['6']!==undefined)result['5']=Number(result['6'])===0?1:0;
  }
  return result;
}

function chooseGoals(character,choices,frequency){
  const selected={};
  for(const group of goalGroups(character)){
    const explicit=Number(choices?.[group.order]);
    let choice=Number.isInteger(explicit)&&explicit>=0&&explicit<group.options.length?explicit:0;
    if(choices?.[group.order]===undefined&&group.mode==='select'){
      const guaranteed=new Set((RACE_DATA.goals[character?.characterId]??[]).filter(g=>!g.choice&&g.order!==group.order).flatMap(g=>g.races.map(r=>r.key)));
      const value=g=>g.races.reduce((n,r)=>n+(frequency.get(r.key)??0)*8+(guaranteed.has(r.key)?-80:80)+Math.max(0,rank(redAptitude(character,r.distanceType))),0);
      choice=group.options.reduce((best,g,i)=>value(g)>value(group.options[best])?i:best,0);
    }
    selected[group.order]=choice;
  }
  const normalized=normalizeGoalChoices(character,{...selected,...choices});
  const goals=goalGroups(character).filter(group=>!(character?.characterId===1134&&group.order===7&&Number(normalized['6'])!==1)).map(group=>({
    ...(group.options[normalized[group.order]]??group.options[0]),goalMode:group.mode,hasAlternatives:group.options.length>1,
    resolvedAutomatic:character?.characterId===1016||character?.characterId===1071&&group.order===9||character?.characterId===1134&&group.order===7
  }));
  return {groups:goalGroups(character),selected:normalized,goals};
}

function preparations(character,target,fixed){
  const types=[...new Set([...TYPES,target.type])],freeCount=6-fixed.length,result=new Map();
  function visit(position,left,free){
    if(position===types.length-1){
      const factors=[...fixed,...free,...Array.from({length:left},()=>({type:types[position],stars:3}))];
      const totals=sumFactors(factors),aptitudes=Object.fromEntries(RED_FACTORS.map(type=>[type,projectedAptitude(redAptitude(character,type),totals[type]??0)]));
      const outputRank=aptitudes[target.type],ready=rank(outputRank)>=6;
      const available=TYPES.map(type=>rank(aptitudes[type])>=([ '芝','ダート' ].includes(type)?3:4)?1:0).join('');
      const id=available+':'+ready;
      const score=Math.min(12,totals[target.type]??0)*3+Object.values(aptitudes).reduce((n,r)=>n+Math.max(0,rank(r)),0)+Math.max(0,rank(aptitudes['ダート']))+Math.max(0,rank(aptitudes['マイル']));
      const old=result.get(id);
      if(!old||score>old.allocationScore)result.set(id,{factors,totals,aptitudes,ready,outputRank,allocationScore:score,fixedCount:fixed.length,target});
      return;
    }
    for(let count=0;count<=left;count++)visit(position+1,left-count,[...free,...Array.from({length:count},()=>({type:types[position],stars:3}))]);
  }
  visit(0,freeCount,[]);
  const list=[...result.values()],ready=list.filter(p=>p.ready);
  return ready.length?ready:list;
}

function selectPreparation(character,target,fixed,goals,weights){
  const candidates=preparations(character,target,fixed);
  const distinct=[...new Map(RACE_DATA.races.filter(r=>r.grade===100).map(r=>[r.key,r])).values()];
  for(const p of candidates){
    p.score=distinct.reduce((n,r)=>n+(canRaceWithPreparation(r,p)?weights.get(r.key)??100:0),0);
    p.score+=goals.filter(g=>g.type===1).reduce((n,g)=>n+(g.races.some(r=>canRaceWithPreparation(r,p))?20000:0),0);
  }
  candidates.sort((a,b)=>b.score-a.score||b.allocationScore-a.allocationScore);
  const best=candidates[0];
  if(!fixed.length){
    const ordered=[...best.factors].sort((a,b)=>{
      const priority=type=>(type===target.type?4:0)+(type==='ダート'?3:type==='マイル'?2:0)+(6-Math.max(0,rank(redAptitude(character,type))));
      return priority(b.type)-priority(a.type)||TYPES.indexOf(a.type)-TYPES.indexOf(b.type);
    });best.factors=ordered;
  }
  best.parents=best.factors.slice(0,2);best.grandparents=best.factors.slice(2);
  best.changes=Object.entries(best.totals).map(([type,stars])=>({type,stars,initial:redAptitude(character,type),projected:best.aptitudes[type],minimum:starsToRank(redAptitude(character,type),type===target.type?'A':type==='芝'||type==='ダート'?'D':'C')})).filter(c=>c.initial!==c.projected);
  return best;
}

function scheduleG1(goals,preparation,weights){
  const forced=new Map(goals.filter(g=>g.type===1&&g.races.length).map(g=>[g.turn,{...g.races[0],turn:g.turn,goal:g,
    mode:g.resolvedAutomatic?'automatic':g.choice===4||g.choice===7?'conditional':g.hasAlternatives?(g.goalMode==='random'?'random':g.goalMode==='select'?'branch':'conditional-branch'):g.choice===3?'conditional':'automatic'}]));
  let beam=[{mask:0n,score:0,rows:[],streak:0}];
  for(let turn=12;turn<=72;turn++){
    const mandatory=forced.get(turn);
    const choices=mandatory?[mandatory]:[null,...(calendarByTurn.get(turn)??[]).filter(r=>r.grade===100&&canRaceWithPreparation(r,preparation)).map(r=>({...r,mode:'reserve'}))];
    const next=new Map();
    for(const state of beam)for(const option of choices){
      const feasible=option&&canRaceWithPreparation(option,preparation),bit=feasible&&option.grade===100?bits.get(option.key)??0n:0n;
      const fresh=!!bit&&!(state.mask&bit),mask=state.mask|bit,streak=option?state.streak+1:0;
      const score=state.score+(fresh?(weights.get(option.key)??100):0)-(option?(mandatory?0:2)+(streak>3?(streak-3)*2:0):0);
      const candidate={mask,streak,score,rows:option?[...state.rows,{...option,canWin:!!feasible}]:state.rows};
      const key=mask+':'+streak,previous=next.get(key);
      if(!previous||candidate.score>previous.score)next.set(key,candidate);
    }
    beam=[...next.values()].sort((a,b)=>b.score-a.score||a.rows.length-b.rows.length).slice(0,48);
  }
  return beam[0]?.rows??[];
}

function completeRequirements(rows,goals,preparation){
  const result=[...rows];
  const fansBefore=turn=>result.filter(r=>r.turn<turn&&r.canWin).reduce((sum,r)=>sum+minimumRaceFans(r),0);
  function insert(before,after,predicate,reason){
    const occupied=new Set(result.map(r=>r.turn));
    const options=RACE_DATA.races.filter(r=>r.turn<before&&r.turn>after&&!occupied.has(r.turn)&&canRaceWithPreparation(r,preparation)&&r.fansNeeded<=fansBefore(r.turn)&&predicate(r));
    options.sort((a,b)=>b.fansGained-a.fansGained||b.turn-a.turn);
    const best=options[0];if(!best)return false;
    result.push({...best,mode:'reserve',canWin:true,purpose:reason});return true;
  }
  for(let pass=0;pass<30;pass++){
    let changed=false;
    for(const row of [...result].sort((a,b)=>a.turn-b.turn)){
      if(row.turn===12||fansBefore(row.turn)>=row.fansNeeded)continue;
      if(insert(row.turn,12,()=>true,'出走に必要なファン数を確保')){changed=true;break;}
    }
    if(changed)continue;
    for(let i=0;i<goals.length;i++){
      const goal=goals[i],previous=goals[i-1]?.turn??12;
      if(goal.type===3){
        const total=result.filter(r=>r.turn<=goal.turn&&r.canWin).reduce((n,r)=>n+minimumRaceFans(r),0);
        if(total<goal.position&&insert(goal.turn+1,12,()=>true,'ファン数の育成目標を達成')){changed=true;break;}
      }else if(goal.type===2){
        const count=result.filter(r=>r.turn>previous&&r.turn<=goal.turn&&r.canWin&&r.grade<=goal.grade).length;
        if(count<goal.count&&insert(goal.turn+1,previous,r=>r.grade<=goal.grade,'着順・回数の育成目標を達成')){changed=true;break;}
      }
    }
    if(!changed)break;
  }
  result.sort((a,b)=>a.turn-b.turn);
  const issues=[];
  for(const row of result){
    if(row.turn>12&&fansBefore(row.turn)<row.fansNeeded)issues.push(`${raceDateLabel(row.turn)} ${row.name}の必要ファン${row.fansNeeded.toLocaleString()}人に不足`);
    if(row.goal?.position>0&&!row.canWin)issues.push(`${row.name}の目標着順に向け、${row.surface}D・${row.distanceType}C以上への追加補正が必要`);
  }
  for(let i=0;i<goals.length;i++){
    const g=goals[i],previous=goals[i-1]?.turn??12;
    if(g.type===3&&result.filter(r=>r.turn<=g.turn&&r.canWin).reduce((n,r)=>n+minimumRaceFans(r),0)<g.position)issues.push(`${raceDateLabel(g.turn)}までにファン${g.position.toLocaleString()}人が必要`);
    if(g.type===2&&result.filter(r=>r.turn>previous&&r.turn<=g.turn&&r.canWin&&r.grade<=g.grade).length<g.count)issues.push(`${raceDateLabel(g.turn)}までの${gradeLabel(g.grade)}以上${g.count}回の目標に不足`);
  }
  let previous=0,streak=0;
  for(const row of result){streak=row.turn===previous+1?streak+1:1;row.streak=streak;previous=row.turn;}
  return {rows:result,issues:[...new Set(issues)]};
}

export function commonG1Bonus(rotations){
  const pairs=COMPATIBILITY_PAIRS.map(([a,b])=>{
    const first=new Set(rotations[a]?.rows.filter(r=>r.grade===100&&r.canWin).map(r=>r.key)??[]);
    const second=new Set(rotations[b]?.rows.filter(r=>r.grade===100&&r.canWin).map(r=>r.key)??[]);
    const common=[...first].filter(key=>second.has(key));
    return {a,b,common,bonus:common.length*3};
  });
  return {pairs,total:pairs.reduce((n,p)=>n+p.bonus,0)};
}

export function planLineageRotations(state,analysis,plan){
  const key=JSON.stringify([state.characterId,state.style,analysis.course.distanceType,analysis.course.surface,plan.nodes.map(n=>[n.characterId,n.redFactor,n.raceGoalChoices,n.scenario])]);
  if(cache.has(key))return cache.get(key);
  const red=analyzeRedPlan(state,analysis,plan),characters=plan.nodes.map(n=>analysis.index.characters.get(n.characterId));
  const frequency=new Map();
  for(const character of characters)for(const g of RACE_DATA.goals[character?.characterId]??[])for(const r of g.races)if(r.grade===100)frequency.set(r.key,(frequency.get(r.key)??0)+1);
  const selections=characters.map((c,i)=>chooseGoals(c,plan.nodes[i].raceGoalChoices,frequency));
  function build(i,weights){
    const character=characters[i];if(!character)return {rows:[],issues:['周回ウマを選択してください。'],character:null,preparation:null,...selections[i]};
    const fixed=i<2?[red.targets[2+i*2],red.targets[3+i*2]].map(({type,stars})=>({type,stars})):[];
    const preparation=selectPreparation(character,red.targets[i],fixed,selections[i].goals,weights);
    const completed=completeRequirements(scheduleG1(selections[i].goals,preparation,weights),selections[i].goals,preparation);
    return {character,preparation,...selections[i],...completed};
  }
  let rotations=characters.map((_,i)=>build(i,new Map(g1Keys.map(k=>[k,100+(frequency.get(k)??0)*20]))));
  // 5組の共通GⅠを揃えるため、隣接する親・祖父母の予定勝鞍を重みへ戻す。
  for(let pass=0;pass<2;pass++)for(const i of [0,1,2,3,4,5]){
    const peers=COMPATIBILITY_PAIRS.filter(p=>p.includes(i)).map(p=>p.find(n=>n!==i));
    const weights=new Map(g1Keys.map(k=>[k,100+peers.reduce((n,j)=>n+(rotations[j].rows.some(r=>r.grade===100&&r.canWin&&r.key===k)?1000:0),0)]));
    const candidate=build(i,weights),next=rotations.map((r,j)=>j===i?candidate:r);
    const oldBonus=commonG1Bonus(rotations).total,newBonus=commonG1Bonus(next).total;
    const count=list=>list.reduce((n,r)=>n+new Set(r.rows.filter(r=>r.grade===100&&r.canWin).map(r=>r.key)).size,0);
    if(candidate.issues.length<=rotations[i].issues.length&&(newBonus>oldBonus||newBonus===oldBonus&&count(next)>=count(rotations)))rotations=next;
  }
  const result={rotations,...commonG1Bonus(rotations),red};
  cache.set(key,result);if(cache.size>16)cache.delete(cache.keys().next().value);
  return result;
}

export function exportRotation(rotation){
  const prep=rotation.preparation,format=factors=>Object.entries(sumFactors(factors)).map(([type,stars])=>`${type}★${stars}`).join('・');
  return [`${rotation.character?.name??'未選択'}｜おすすめローテ`,prep?`育成に使う赤因子：親 ${format(prep.parents)} / 祖父母 ${format(prep.grandparents)} / 合計 ${format(prep.factors)}`:'',
    ...rotation.rows.map(r=>`${raceDateLabel(r.turn)}｜${r.name}｜${r.mode==='reserve'?'予約':r.mode==='branch'?'目標分岐で選択・予約不要':r.mode==='random'?'抽選目標・予約不要':r.mode==='conditional'?'条件目標・なければ予約':r.mode==='conditional-branch'?'条件で変わる目標・予約不要':'育成目標・予約不要'}${r.purpose?' / '+r.purpose:''}`),
    'ファン数は合計ファン数ボーナス43%以上・デビュー1着で1,000人以上になる編成を前提に判定。',
    '記載したGⅠは1着を揃える計画。勝利実績・予約のゲーム内反映は手動。',...rotation.issues].filter(Boolean).join('\n');
}
