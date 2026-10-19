export const RED_FACTORS=['芝','ダート','短距離','マイル','中距離','長距離','逃げ','先行','差し','追込'];
const RANKS=['G','F','E','D','C','B','A','S'];
const starThreshold=[0,1,4,7,10];
export const redAptitude=(character,type)=>character?.aptitude?.[RED_FACTORS.indexOf(type)]??null;
export const starsToA=rank=>{const steps=6-RANKS.indexOf(rank);return RANKS.includes(rank)?steps<=0?0:steps>4?Infinity:starThreshold[steps]:null;};
export function projectedAptitude(rank,stars){
  if(!RANKS.includes(rank))return null;
  if(rank==='S')return 'S';
  const steps=stars<1?0:Math.min(4,1+Math.floor((stars-1)/3));
  return RANKS[Math.min(6,RANKS.indexOf(rank)+steps)];
}
export const defaultRedFactor=analysis=>({type:analysis.course.distanceType,stars:3});

export function suggestRedFactors(state,analysis,nodes) {
  const goal=analysis.course.distanceType,main=analysis.index.characters.get(state.characterId);
  const choices=nodes.map(n=>n.redFactor&&RED_FACTORS.includes(n.redFactor.type)?{...n.redFactor}:null);
  const repair=[analysis.course.surface,state.style].filter(t=>RED_FACTORS.includes(t)&&t!==goal);
  const reserved=new Set(choices.map((r,i)=>r?i:null).filter(i=>i!==null));
  for(const type of repair){
    const needed=starsToA(redAptitude(main,type));if(!needed)continue;
    const minimum=Number.isFinite(needed)?needed:10;
    let total=choices.reduce((sum,r)=>sum+(r?.type===type?r.stars:0),0);
    const candidates=nodes.map((n,i)=>({i,rank:RANKS.indexOf(redAptitude(analysis.index.characters.get(n.characterId),type))})).filter(n=>!reserved.has(n.i)).sort((a,b)=>b.rank-a.rank||Number(b.i>=2)-Number(a.i>=2)||a.i-b.i);
    for(const candidate of candidates){if(total>=minimum)break;choices[candidate.i]={type,stars:3};reserved.add(candidate.i);total+=3;}
  }
  return choices.map(r=>r??{type:goal,stars:3});
}

export function redFactorDetails(profile,analysis) {
  const target=profile.redFactor??defaultRedFactor(analysis),character=analysis.index.characters.get(profile.characterId);
  const rank=redAptitude(character,target.type),needed=starsToA(rank);
  const preparation=rank===null?'適性データ未登録。周回ウマの適性を確認してください。':needed===0?`${target.type}の初期適性は${rank}。適性上げを追加せずにこの赤因子を狙える候補です。`:!Number.isFinite(needed)?`${target.type}の初期適性は${rank}。開始時の赤因子だけではAに届かないため、育成中の継承も必要です。`:`${target.type}の初期適性は${rank}。★3を狙う準備として、この個体の育成に使う継承元6人に${target.type}の赤因子を合計★${needed}以上用意し、開始時Aへ上げます。`;
  return {...target,rank,minimumStars:needed,preparation};
}

export function analyzeRedPlan(state,analysis,plan) {
  const selected=suggestRedFactors(state,analysis,plan.nodes);
  const targets=plan.nodes.map((n,i)=>redFactorDetails({...n,redFactor:selected[i]},analysis));
  const totals=Object.fromEntries(RED_FACTORS.map(type=>[type,targets.reduce((sum,r)=>sum+(r.type===type?r.stars:0),0)]).filter(([,stars])=>stars));
  const main=analysis.index.characters.get(state.characterId);
  const initial=[analysis.course.distanceType,analysis.course.surface,state.style].filter((type,i,a)=>RED_FACTORS.includes(type)&&a.indexOf(type)===i).map(type=>{
    const rank=redAptitude(main,type),stars=totals[type]??0,projected=projectedAptitude(rank,stars);
    return {type,rank,stars,projected,minimumStars:starsToA(rank),ready:projected==='A'||projected==='S'};
  });
  const genes=targets.map((_,i)=>{
    const visible=i<2?[2+i*2,3+i*2]:[];
    const distanceStars=visible.reduce((sum,j)=>sum+(targets[j].type===analysis.course.distanceType?targets[j].stars:0),0);
    const styleStars=visible.reduce((sum,j)=>sum+(targets[j].type===state.style?targets[j].stars:0),0);
    const remainingDistance=Math.max(0,12-distanceStars),remainingStyle=Math.max(0,6-styleStars);
    return {distance:`${analysis.course.distanceType}の遺伝子`,style:state.style?`${state.style}の遺伝子`:null,visible,distanceStars,styleStars,remainingDistance,remainingStyle,budgetPossible:remainingDistance+remainingStyle<=(6-visible.length)*3};
  });
  return {targets,totals,initial,genes,warnings:initial.filter(r=>r.rank&&!r.ready).map(r=>`${r.type}は初期${r.rank}→開始時${r.projected}の計画。開始時Aに届いていないため、赤因子の配分・育成ウマ・作戦を確認してください。`)};
}
