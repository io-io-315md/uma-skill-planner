import {scenarioSkillOptions,selectedScenarioSkill,SCENARIO_SKILL_SOURCE} from './scenario-skills.js';
import {escape} from './ui.js';

export function scenarioChoiceHTML(state,index,{attribute='scenario-choice',purpose='main',course={}}={}){
  if(['ura','tracen'].includes(state.scenario)||!index.characters.has(state.characterId))return '';
  const selected=selectedScenarioSkill(state,index,{purpose,course});
  return `<div class="event-choices scenario-choice"><label>駿大祭のスキル択（シニア10月前半）<select data-${attribute} aria-label="駿大祭のスキル択"><option value="auto" ${state.scenarioChoice==='auto'?'selected':''}>自動：${escape(selected?.name)} / ${escape(selected?.skillName)}</option>${scenarioSkillOptions(state,index).map(o=>`<option value="${o.id}" ${state.scenarioChoice===o.id?'selected':''}>${escape(o.name)} / ${o.linked?'金：':'白：'}${escape(o.skillName)}</option>`).join('')}</select></label><details><summary>取得条件</summary><p>「本番前のひと時」で選べる1種類だけを計上します。対応キャラを育成またはサポカに編成すると金ヒント。全身全霊・ハヤテ一文字・機先の勝負なども、シナリオの進行・大成功の条件を満たしたときの取得候補です。</p><a href="${SCENARIO_SKILL_SOURCE}" target="_blank" rel="noopener noreferrer">条件・出典 ↗</a></details></div>`;
}
