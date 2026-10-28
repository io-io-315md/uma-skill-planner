import {skillMatchesRace} from './support-usage.js';

export const SCENARIO_SKILL_OPTIONS=[
  {id:'1009',name:'ダイワスカーレット',gold:'先手必勝',white:'先駆け'},
  {id:'1024',name:'マヤノトップガン',gold:'順風満帆',white:'気持ちを乗せて',front:true},
  {id:'1029',name:'ユキノビジン',gold:'燃ゆる魂',white:'灯を胸に'},
  {id:'1096',name:'ノーリーズン',gold:'刹那の勝機',white:'間隙を突いて'},
  {id:'1128',name:'ブラストワンピース',gold:'ウママニア',white:'ウマ好み'},
  {id:'9052',name:'吾妻',gold:'螺旋のエキスパート',white:'弧を描いて'}
];
export const SCENARIO_SKILL_SOURCE='https://kamigame.jp/umamusume/page/445590736528778652.html';
export function scenarioSkillOptions(state,index){
  const characterIds=new Set([index.characters.get(state.characterId)?.characterId,...(state.supports??[]).map(id=>index.supports.get(id)?.characterId)]);
  return SCENARIO_SKILL_OPTIONS.map(option=>{
    const linked=characterIds.has(Number(option.id)),skill=index.normalByName.get(linked?option.gold:option.white);
    return {...option,linked,skillId:skill?.id,skillName:skill?.name};
  });
}
export function selectedScenarioSkill(state,index,{purpose='main',course={}}={}){
  const options=scenarioSkillOptions(state,index),explicit=options.find(o=>o.id===state.scenarioChoice);
  if(explicit)return explicit;
  // 因子周回の自動択は友人側に固定し、編成探索途中に取得経路が変わらないようにする。
  if(purpose==='factor')return options.find(o=>o.id==='9052');
  const score=o=>{
    if(!skillMatchesRace(index.skills.get(o.skillId),course,state.style))return -1000;
    if(o.front&&['差し','追込'].includes(state.style))return -500;
    return (o.linked?100:0)+(o.id==='1024'?20:o.id==='9052'?10:0);
  };
  return [...options].sort((a,b)=>score(b)-score(a))[0];
}
export function scenarioAcquisition(state,index,{purpose='main',course={}}={}){
  if(!index.characters.has(state.characterId)||['ura','tracen'].includes(state.scenario)||purpose==='factor'&&state.scenario!=='support')return [];
  const fixed=[
    ['全身全霊','クラシック12月後半・第2回進捗発表会の報酬'],
    ['ハヤテ一文字','シニア10月後半・全演目で大成功'],
    ['機先の勝負','シニア10月後半・全演目で大成功'],
    ['名にし負う夢','育成終了時・シナリオの進行条件を達成']
  ].map(([name,condition])=>({skillId:index.normalByName.get(name)?.id,condition}));
  const choice=selectedScenarioSkill(state,index,{purpose,course});
  if(choice)fixed.push({skillId:choice.skillId,condition:`シニア10月前半「本番前のひと時」で${choice.name}を選ぶ${choice.linked?'（編成・育成リンク）':'（リンクなしの白ヒント）'}`});
  return fixed.filter(r=>r.skillId).map(r=>({...r,kind:'scenario',label:`駿大祭：${r.condition}（条件達成時）`}));
}
