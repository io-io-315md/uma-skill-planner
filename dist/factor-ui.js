import { analyze, normalizeFarmingProfile, PRIORITIES, TYPE_LABELS } from './engine.js';
import { factorPlanKey, suggestFactorPlan, candidateSources, analyzeFactorPlan, completeFactorChoices, URA_METHODS } from './factor-planner.js';
import { artwork, escape } from './ui.js';
import { RED_FACTORS, redFactorDetails } from './factor-targets.js';
import { FIXED_SUPPORT_SLOT } from './deck-rules.js';

export function createFactorUI({catalog,getState,update,openPicker}) {
  const $=id=>document.getElementById(id);
  let targetName=null,sessionKey=null;
  const context=()=>{const state=getState(),analysis=analyze(state,catalog);return{state,analysis,focus:analysis.rows.find(r=>r.name===targetName)};};
  const profile=()=>getState().farmingPlans[sessionKey]??normalizeFarmingProfile({},catalog);
  const save=value=>update({farmingPlans:{...getState().farmingPlans,[sessionKey]:normalizeFarmingProfile(value,catalog)}});
  function rebuild(options={}){
    const {state,analysis,focus}=context();if(!focus)return;
    const current=profile();
    save({...suggestFactorPlan(state,analysis,focus,catalog,{characterId:current.characterId,...options}),learned:current.learned});
  }
  function open(name){
    const state=getState(),analysis=analyze(state,catalog),focus=analysis.rows.find(r=>r.name===name);
    if(!focus)return;
    targetName=name;sessionKey=factorPlanKey(state,name);
    if(!state.farmingPlans[sessionKey])save(suggestFactorPlan(state,analysis,focus,catalog));
    render();if(!$('factor-dialog').open)$('factor-dialog').showModal();
  }
  function render(){
    if(!targetName)return;
    const {state,analysis,focus}=context();if(!focus)return;
    const plan=profile(),result=analyzeFactorPlan(plan,analysis,focus);
    const main=analysis.index.characters.get(state.characterId);
    const parent=result.parent;
    const red=redFactorDetails(plan,analysis);
    const sources=candidateSources(analysis,focus,catalog,plan.characterId);
    const sourceIds=sources.slice(0,24);if(plan.anchorSupportId&&!sourceIds.some(s=>s.support.id===plan.anchorSupportId)){const chosen=sources.find(s=>s.support.id===plan.anchorSupportId);if(chosen)sourceIds.push(chosen);}
    $('factor-title').textContent=`因子周回：${focus.name}`;
    $('factor-content').innerHTML=`
      <p class="factor-context">${escape(analysis.course.month)}月 ${escape(analysis.course.venue)} ${analysis.course.distance}m / 本育成：${escape(main?.characterName??'未選択')}・${escape(state.style)}</p>
      <div class="factor-goal"><span class="priority priority-${focus.priority}">優先度 <strong>${PRIORITIES[focus.priority]}</strong></span><strong>${escape(focus.name)}</strong><p>${focus.inherited?`${escape(focus.ownerName)}を育成して固有因子を用意。${focus.evolvedInheritance?'継承進化は本育成で行います。本人の所持・直接の親・進化条件を確認してください。':'直接親の候補です。固有因子は白スキル因子とは別に扱います。'}`:escape(focus.factorReason)}</p></div>
      <div class="factor-setup">
        <section><h3>周回するウマ娘</h3><button class="picker-button farmer-picker" data-farm-character ${focus.inherited?'disabled':''}>${artwork(parent)}<span>${escape(parent?.name??'周回キャラを選択')}</span><span>⌄</span></button><p class="micro-note">${focus.inherited?'この固有の継承元となる衣装に固定。':'本育成の継承候補を初期選択。別の親・祖父母用キャラにも変更できます。'}</p></section>
        <section><h3>取得ルート</h3><label class="field-label" for="farm-scenario">周回の取得方法</label><select id="farm-scenario" data-farm-scenario><option value="support" ${plan.scenario==='support'?'selected':''}>トレセン軒：サポカのヒント・イベント</option><option value="ura" ${plan.scenario==='ura'?'selected':''}>URA：真髄スキルの対決イベントも使う</option></select>${focus.factorEligible?`<label class="field-label" for="farm-source">この因子の入手元から編成案を作る</label><select id="farm-source" data-farm-source><option value="">自動で選ぶ</option>${sourceIds.map(s=>`<option value="${s.support.id}" ${plan.anchorSupportId===s.support.id?'selected':''}>${escape(TYPE_LABELS[s.support.type])} ${escape(s.support.name)} / ${s.kind==='event'?'イベント択':s.kind==='hint'?'所持ヒント':'イベント条件要確認'}</option>`).join('')}</select>`:''}</section>
      </div>
      <div class="factor-method-note"><strong>育成完了時に指定する赤因子</strong><div class="lineage-red-controls"><label>種類<select data-farm-red aria-label="個別周回の赤因子">${RED_FACTORS.map(type=>`<option ${red.type===type?'selected':''}>${type}</option>`).join('')}</select></label><label>目標星数<select data-farm-red-stars aria-label="個別周回の赤因子目標星数">${[3,2,1].map(stars=>`<option value="${stars}" ${red.stars===stars?'selected':''}>★${stars}</option>`).join('')}</select></label></div><p>${escape(red.preparation)} 星数は抽選です。親・祖父母全体の赤因子配分は「因子厳選用サポカ編成」タブで確認できます。</p></div>
      ${URA_METHODS[focus.name]?`<div class="factor-method-note"><strong>シナリオから取る場合</strong><p>URAのハッピーミークとの対決「${escape(URA_METHODS[focus.name])}」に成功するとヒントを取得。「URA」を選んだ周回プランだけに計上します。<a href="https://gamewith.jp/uma-musume/article/show/376170" target="_blank" rel="noopener noreferrer">取得方法 ↗</a></p></div>`:''}
      <div class="factor-section-heading"><h3>因子周回のサポート編成</h3><button class="outline-button" data-farm-rebuild>編成案を作り直す</button></div>
      <p class="factor-caption">新SSRたづなを自前の6枠目に固定し、残り5枚で必要な白因子の取得経路をまとめます。SSR・SR・Rが対象。URAも今回の指定により同じ1枠確保で提案します。所持・凸数・レースボーナス・相性は自動評価していません。</p>
      <div class="farming-deck">${plan.supports.map((id,slot)=>{
        const support=analysis.index.supports.get(id),fixed=slot===FIXED_SUPPORT_SLOT,tag=fixed?'div':'button';
        const routes=support?acquiredBySupport(support,result):[];
        return`<div class="farming-support ${fixed?'lineage-fixed-support':''}"><${tag} class="farming-support-select" ${fixed?'role="group" aria-label="因子周回サポート6：SSRたづな・自前固定"':`data-farm-slot="${slot}" aria-label="因子周回サポート${slot+1}を選択"`}>${artwork(support)}<span><small>${String(slot+1).padStart(2,'0')} / ${fixed?'自前・固定':support?`${TYPE_LABELS[support.type]}・${support.rarity}`:'空き枠'}</small><strong>${escape(support?.characterName??'サポートを選択')}</strong><small>${escape(support?.title??'レース・スキルPt用に調整')}</small></span></${tag}>${support?`${fixed?'':`<button class="remove-support" data-farm-remove="${slot}" aria-label="因子周回サポート${slot+1}を外す">×</button>`}<p class="farming-card-skills">${escape(routes.length?routes.join(' / '):fixed?'シナリオ・育成用の固定枠':'対象スキルの経路なし')}</p>${support.events.filter(e=>e.selection==='single').map(e=>`<label class="farm-event-label" for="farm-${e.id}">因子周回のイベント択</label><select id="farm-${e.id}" data-farm-event="${escape(e.id)}"><option value="">未指定（この択は計上しない）</option>${e.choices.map(c=>`<option value="${escape(c.id)}" ${plan.eventChoices[e.id]===c.id?'selected':''}>${escape(c.label)}</option>`).join('')}</select>`).join('')}`:''}</div>`;
      }).join('')}</div>
      <div class="factor-section-heading"><h3>周回で優先して習得するスキル</h3><span>${result.covered.length} / ${result.targets.length}件に取得経路</span></div>
      <p class="factor-caption">選択した因子を先頭に、優先度「高」から習得。ヒント獲得後にスキルを習得し、育成終了時の因子を確認します。取得済みチェックはこの周回だけの記録です。</p>
      ${focus.inherited?`<p class="factor-method-note">固有因子を狙いつつ、下記の白因子を同時に厳選します。固有・白因子とも、ここでチェックしただけでは本育成の「準備済み」にはなりません。</p>`:''}
      <div class="farming-skill-list">${result.targets.filter(r=>r.canAcquire).map(r=>`<article class="farming-skill ${r.name===focus.name?'focused-factor':''}"><div><span class="priority priority-${r.priority}">優先度 <strong>${PRIORITIES[r.priority]}</strong></span>${r.name===focus.name?'<span class="focus-label">選択中の因子</span>':''}</div><h4>${escape(r.name)}</h4><p>${escape(r.priorityReason)}</p><p class="farming-route">${r.farmingRoutes.map(route=>escape(route.label)).join('<br>')}</p>${r.gold?`<p class="micro-note">上位：${escape(r.gold)}。上位まで取れる場合も、厳選するのは下位白因子です。</p>`:''}<label class="prepare-checkbox"><input type="checkbox" data-farm-learned="${escape(r.name)}" ${r.learned?'checked':''}> 取得済み</label></article>`).join('')||'<p>この編成に登録された白因子の取得経路はありません。</p>'}</div>
      ${result.missing.length?`<details class="factor-missing" open><summary>この周回では別の取得元が必要：${result.missing.length}件</summary><div>${result.missing.map(r=>`<button class="factor-missing-item" data-farm-target="${escape(r.name)}"><span class="priority priority-${r.priority}">${PRIORITIES[r.priority]}</span>${escape(r.name)}<span>別の編成案を見る ↗</span></button>`).join('')}</div></details>`:''}
      <div class="factor-method-note"><strong>因子厳選の手順</strong><ol><li>選択したスキルと優先度「高」の白スキルを先に習得。複数の因子を同時に狙います。</li><li>余裕があれば中・低も習得。◎や金まで取れる系統は上位の習得も検討します。</li><li>育成終了後に目的の白因子が付いたかを確認。スキル習得・取得済みチェックは因子化を保証しません。</li><li>因子が用意できたら本育成の一覧で「準備済み」をチェックします。</li></ol><a href="https://game8.jp/umamusume/460250" target="_blank" rel="noopener noreferrer">因子周回・上位スキルの解説 ↗</a>${focus.name==='レースの真髄・体'?'<a href="https://umamusumelabo.com/chara_support/ssr-finemotion-power" target="_blank" rel="noopener noreferrer">ファインの白スキル択 ↗</a>':''}</div>`;
  }
  function acquiredBySupport(support,result){return result.targets.filter(r=>r.farmingRoutes.some(route=>route.label.includes(`${TYPE_LABELS[support.type]}・${support.characterName}`))).map(r=>r.name);}
  function chooseCharacter(id){const {analysis,focus}=context();if(!focus||focus.inherited)return;save(completeFactorChoices(normalizeFarmingProfile({...profile(),characterId:id},catalog),analysis,focus,catalog));}
  function chooseSupport(id,slot){if(slot===FIXED_SUPPORT_SLOT)return;const current=profile(),supports=[...current.supports];supports[slot]=id;const {analysis,focus}=context();save(completeFactorChoices(normalizeFarmingProfile({...current,supports},catalog),analysis,focus,catalog));}
  $('factor-dialog').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;const d=button.dataset;
    if(d.farmCharacter!==undefined)openPicker('character',0,'farming');
    else if(d.farmSlot!==undefined)openPicker('support',Number(d.farmSlot),'farming');
    else if(d.farmRemove!==undefined&&Number(d.farmRemove)!==FIXED_SUPPORT_SLOT){const current=profile(),supports=[...current.supports];supports[Number(d.farmRemove)]=null;save({...current,supports});}
    else if(d.farmRebuild!==undefined)rebuild({anchorSupportId:profile().anchorSupportId,scenario:profile().scenario});
    else if(d.farmTarget)open(d.farmTarget);
  });
  $('factor-dialog').addEventListener('change',event=>{
    const target=event.target,current=profile(),d=target.dataset;
    if(d.farmEvent)save({...current,eventChoices:{...current.eventChoices,[d.farmEvent]:target.value}});
    else if(d.farmRed!==undefined||d.farmRedStars!==undefined){const {analysis}=context(),red=redFactorDetails(current,analysis);save({...current,redFactor:{type:d.farmRed!==undefined?target.value:red.type,stars:d.farmRedStars!==undefined?Number(target.value):red.stars}});}
    else if(d.farmSource!==undefined)rebuild({anchorSupportId:Number(target.value)||null,scenario:current.scenario});
    else if(d.farmScenario!==undefined)save({...current,scenario:target.value});
    else if(d.farmLearned){const names=new Set(current.learned);if(target.checked)names.add(d.farmLearned);else names.delete(d.farmLearned);save({...current,learned:[...names]});}
  });
  $('close-factor').addEventListener('click',()=>$('factor-dialog').close());
  $('factor-dialog').addEventListener('click',event=>{if(event.target===$('factor-dialog')){const r=$('factor-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('factor-dialog').close();}});
  return{open,render,profile,chooseCharacter,chooseSupport};
}
