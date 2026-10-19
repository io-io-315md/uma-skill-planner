import { analyze, normalizeFarmingProfile, normalizeLineagePlan, TYPE_LABELS, PRIORITIES } from './engine.js';
import { LINEAGE_NODES, branchIndices, lineagePlanKey, lineageSignature, suggestLineagePlan, suggestCoverageDeck, analyzeLineagePlan, completeCoverageChoices } from './lineage-planner.js';
import { artwork, escape } from './ui.js';

const $=id=>document.getElementById(id);
const priority=row=>`<span class="priority priority-${row.priority}">${PRIORITIES[row.priority]}</span>`;
const chips=rows=>rows.map(r=>`<span class="lineage-skill-chip">${priority(r)}${escape(r.name)}</span>`).join('');

export function createLineageUI({catalog,getState,update,openPicker,openFactor}) {
  let active=0;
  const context=()=>{const state=getState();return {state,analysis:analyze(state,catalog),key:lineagePlanKey(state)};};
  const current=()=>{const {state,key}=context();return state.lineagePlans[key];};
  const save=(plan,manual=true)=>{const {state,key}=context();update({lineagePlans:{...state.lineagePlans,[key]:normalizeLineagePlan({...plan,manual},catalog,state.characterId)}});};
  const profile=()=>current()?.nodes[active]??normalizeFarmingProfile({},catalog);
  function saveProfile(value){const plan=current();if(!plan)return;const nodes=[...plan.nodes];nodes[active]=value;save({...plan,nodes});}
  function rebuild(resetTree=false){const {state,analysis}=context();save(suggestLineagePlan(state,analysis,catalog,{previous:current(),resetTree}),false);}
  function render() {
    if($('lineage-overview').hidden)return;
    const {state,analysis}=context(),container=$('lineage-overview');
    if(!analysis.course.confirmed||!state.characterId){container.innerHTML=`<div class="empty-state"><h3>${analysis.course.confirmed?'本育成のウマ娘と編成を選択':'コース詳細未発表'}</h3><p>${analysis.course.confirmed?'不足する白因子と継承候補から、親・祖父母と因子厳選用の編成を提案します。':'コース確定後に因子編成の提案を表示します。'}</p></div>`;return;}
    const plan=current(),signature=lineageSignature(state,analysis);
    if(!plan||(!plan.manual&&plan.signature!==signature)){rebuild();return;}
    const result=analyzeLineagePlan(plan,analysis),main=analysis.index.characters.get(state.characterId);
    const high=result.targets.filter(r=>r.priority===1),highCovered=result.covered.filter(r=>r.priority===1);
    const parent=analysis.index.characters.get(plan.nodes[active].characterId),meta=LINEAGE_NODES[active];
    const friend=analysis.index.characters.get(plan.nodes[plan.friendSide].characterId);
    const unplaced=result.inheritance.filter(r=>r.placement==='unplaced'||r.evolvedInheritance&&!r.evolutionPossible);
    container.innerHTML=`
      <section class="lineage-overview-card" aria-labelledby="lineage-heading">
        <div class="lineage-heading"><div><p class="eyebrow">FACTOR PLAN</p><h3 id="lineage-heading">親・祖父母と白因子の編成案</h3></div><button class="outline-button" data-lineage-rebuild>不足に合わせて再提案</button></div>
        <p class="lineage-caption">不足する白因子を優先度「高」からカバー。各ウマを押すと、その周回用のサポカ・イベント択・習得スキルを表示します。</p>
        ${plan.signature!==signature?'<div class="lineage-update-note" role="status">本育成の編成が変わりました。手動調整した周回編成は保持し、取得ルートの件数を現在の不足スキルで再計算しています。「不足に合わせて再提案」でサポカを更新できます。</div>':''}
        <div class="lineage-metrics"><div><span>優先度 高の取得ルート</span><strong>${highCovered.length}<small> / ${high.length}</small></strong></div><div><span>6人でカバーする白因子</span><strong>${result.covered.length}<small> / ${result.targets.length}</small></strong></div><div><span>取得元が足りない白因子</span><strong>${result.missing.length}<small>件</small></strong></div></div>
        <p class="lineage-caption">件数は6人の周回編成に取得ルートがある白スキルの数です。白因子化・継承は抽選。条件未登録のイベント候補は件数に含めません。</p>
        <div class="lineage-tree" aria-label="継承ツリー：本育成、親2人、祖父母4人">
          <div class="lineage-trainee">${artwork(main)}<div><small>本育成 / ${escape(state.style)}</small><strong>${escape(main.name)}</strong></div></div>
          <div class="lineage-branches">${[0,1].map(side=>{
            const [p,g1,g2]=branchIndices(side),borrowed=side===plan.friendSide;
            return `<section class="lineage-branch ${borrowed?'friend-branch':''}" aria-label="${borrowed?'フレンド側':'自前側'}の親と祖父母"><div class="lineage-branch-label"><span>${borrowed?'フレンドから借りる':'自分で用意する'}</span><label><input type="radio" name="lineage-friend" value="${side}" data-lineage-friend ${borrowed?'checked':''}> この親を借りる</label></div>${renderNode(p,plan,result)}<div class="lineage-grandparents">${renderNode(g1,plan,result)}${renderNode(g2,plan,result)}</div></section>`;
          }).join('')}</div>
        </div>
        <p class="lineage-caption">親の固有は育成開始時にヒントを受け取れます。祖父母の固有は育成中の継承抽選。継承進化を狙う衣装は直接親に置き、レンタルでも本人の所持が必要です。固有因子用のキャラは★3以上で用意してください。</p>
        ${unplaced.length?`<details class="lineage-alternatives"><summary>ツリー外・直接親への変更が必要な継承候補 ${unplaced.length}件</summary><div>${unplaced.map(r=>`<p>${priority(r)}<strong>${escape(r.name)}</strong><span>${escape(r.ownerName)}${r.evolvedInheritance?' / 継承進化には直接親が必要':''}</span><button class="text-button" data-lineage-factor="${escape(r.name)}">取得条件を見る ↗</button></p>`).join('')}</div></details>`:''}
        <div class="lineage-footer-actions"><button class="text-button" data-lineage-reset-tree>親・祖父母も選び直す</button><details><summary>提案の基準・継承ルール</summary><p>継承進化の候補を直接親に優先配置。サポカで補えない白因子を自前で取れるウマも祖父母に含め、残りに固有候補を優先度順で配置します。白因子の担当は取得ルートを見て分散し、高は両親にも重ねる方針です。相性・共通勝利レースは未評価です。</p><p>サポカはSSR・SR・Rすべてが対象。高→中→低の順に取得経路の種類を増やす探索で、6枚の最適解を保証するものではありません。所持・凸数・レースボーナス・育成性能は未評価。経路が増えない枠は自由枠にしています。</p><a href="https://kamigame.jp/umamusume/page/154134787475434233.html" target="_blank" rel="noopener noreferrer">親・祖父母の固有／白因子の仕様 ↗</a><a href="https://kamigame.jp/umamusume/page/379386472786060081.html" target="_blank" rel="noopener noreferrer">継承進化の条件 ↗</a><a href="https://umamusumelabo.com/event/loh/loh-kyoto3000-202611" target="_blank" rel="noopener noreferrer">京都3000mの継承候補・継承進化 ↗</a></details></div>
      </section>
      <section class="lineage-friend-card" aria-labelledby="lineage-friend-title"><div class="lineage-heading"><h3 id="lineage-friend-title">フレンドで探す因子</h3><span class="lineage-friend-tag">${LINEAGE_NODES[plan.friendSide].label}をレンタル</span></div><div class="lineage-friend-owner">${artwork(friend)}<div><strong>${escape(friend?.name??'親を選択')}</strong><p>${escape(result.inheritance.find(r=>r.node===plan.friendSide)?.name??'固有はカードの取得元で確認')}${result.inheritance.some(r=>r.node===plan.friendSide&&r.evolvedInheritance)?' / 継承進化には対象衣装の本人所持が必要（所持状況は未確認）':''}</p></div></div>
        <h4>代表・祖父母に用意する白因子</h4><div class="lineage-chips">${chips(result.friendTargets)||'<span>不足する白因子なし。必要な固有と相性で選択。</span>'}</div>
        ${result.friendOnly.length?`<h4>自前側の周回編成で取れない分を補う</h4><div class="lineage-chips">${chips(result.friendOnly)}</div>`:''}
        <p class="lineage-caption">祖父母：${branchIndices(plan.friendSide).slice(1).map(i=>escape(analysis.index.characters.get(plan.nodes[i].characterId)?.name??'未指定')).join(' ／ ')}。この組み合わせと白因子を持つ代表ウマを探すための条件です。実在するフレンドの因子在庫は検索・照合していません。</p>
        <p class="lineage-caption">高の因子を優先し、揃わない場合はツリーの親・祖父母を手持ちや募集条件に合わせて変更してください。</p><a href="https://uma.pure-db.com/" target="_blank" rel="noopener noreferrer">ウマ娘DBでフレンド因子を探す ↗</a>
      </section>
      <section class="lineage-active-card" id="lineage-active" aria-labelledby="lineage-deck-title"><div class="lineage-heading"><div><p class="eyebrow">${meta.label} / ${meta.side===plan.friendSide?'フレンド側':'自前側'}</p><h3 id="lineage-deck-title">${escape(parent?.characterName??'未選択')}の因子厳選用サポカ編成</h3></div><button class="outline-button" data-lineage-character>周回ウマを変更</button></div>
        <div class="lineage-active-parent">${artwork(parent)}<div><strong>${escape(parent?.name??'周回するウマを選択')}</strong><p>${escape(result.inheritance.find(r=>r.node===active)?.name??'白因子の取得元を優先した候補')}</p></div></div>
        <h4>このウマに用意する白因子</h4><div class="lineage-chips">${chips(result.assignments[active])||'<span>必要な因子を別の親・祖父母でカバー。周回では下記の高から追加できます。</span>'}</div>
        <div class="lineage-deck-controls"><label>取得方法<select data-lineage-scenario aria-label="この周回の取得方法"><option value="support" ${plan.nodes[active].scenario==='support'?'selected':''}>サポカのヒント・イベント</option><option value="ura" ${plan.nodes[active].scenario==='ura'?'selected':''}>URA：真髄の対決イベントも使う</option></select></label><span>SSR・SR・Rすべて対象 / 6枠を個別に変更可</span></div>
        ${plan.nodes[active].scenario==='ura'?'<p class="lineage-scenario-note">この周回はURAで真髄・体／力／速も狙う案です。ハッピーミークとの対決で、それぞれスタミナ／パワー／スピードの勝負に成功する必要があります。<a href="https://umamusumelabo.com/beginner/urafinals-update" target="_blank" rel="noopener noreferrer">取得条件 ↗</a></p>':''}
        <div class="farming-deck lineage-deck">${renderDeck(plan.nodes[active],analysis,result.results[active])}</div>
        <div class="lineage-heading lineage-skill-heading"><h4>周回で習得するスキル</h4><span>取得ルート ${result.results[active].covered.length} / ${result.targets.length}</span></div><p class="lineage-caption">高から先に習得し、中・低へ。ヒント発生・イベント完走や成功条件があります。金まで習得しても、厳選対象は対応する下位の白因子です。</p>
        <div class="farming-skill-list lineage-target-list">${result.results[active].covered.map(r=>`<article class="farming-skill"><div>${priority(r)}<span class="lineage-assignment">${result.assignments[active].some(t=>t.skillId===r.skillId)?'このウマの担当':'追加候補'}</span></div><h4>${escape(r.name)}</h4><p class="farming-route">${r.farmingRoutes.map(route=>escape(route.label)).join('<br>')}</p><label class="prepare-checkbox"><input type="checkbox" data-lineage-learned="${escape(r.name)}" ${r.learned?'checked':''}> 取得済み（因子化は別）</label></article>`).join('')||'<p>この編成に取得経路はありません。</p>'}</div>
        ${result.results[active].missing.length?`<details class="lineage-missing"><summary>この周回に取得元がない白因子 ${result.results[active].missing.length}件</summary><div>${result.results[active].missing.map(r=>`<button data-lineage-factor="${escape(r.name)}">${priority(r)}<span>${escape(r.name)}</span><small>${r.uncertainRoutes.length?'未確認イベント候補あり':'別の取得元を見る'} ↗</small></button>`).join('')}</div></details>`:''}
      </section>
      ${result.missing.length?`<section class="lineage-uncovered"><h3>6人の編成でも別の取得元が必要</h3><p class="lineage-caption">サポカの差し替え・シナリオ・既存の因子から補う候補です。各因子を押すと個別の周回案を確認できます。</p><div class="lineage-chips">${result.missing.map(r=>`<button class="lineage-skill-chip" data-lineage-factor="${escape(r.name)}">${priority(r)}${escape(r.name)} ↗</button>`).join('')}</div></section>`:''}`;
  }
  function renderNode(i,plan,result){
    const node=plan.nodes[i],meta=LINEAGE_NODES[i],character=catalog.characters.find(c=>c.id===node.characterId),unique=result.inheritance.find(r=>r.node===i),assigned=result.assignments[i];
    return `<button class="lineage-node ${active===i?'selected':''}" data-lineage-node="${i}" aria-pressed="${active===i}" aria-label="${meta.label} ${escape(character?.name??'未指定')}の周回編成を見る"><span class="lineage-node-role">${meta.label}${unique?.evolutionPossible?' <b>継承進化</b>':''}${node.scenario==='ura'?' <b>URA</b>':''}</span><span class="lineage-node-character">${artwork(character)}<span><small>${escape(character?.title??'')}</small><strong>${escape(character?.characterName??'ウマ未指定')}</strong></span></span><span class="lineage-node-unique">${escape(unique?.name??'白因子の取得用')}${unique?.evolvedInheritance&&!unique.evolutionPossible?'（祖父母では進化不可）':''}</span><span class="lineage-node-factors">${assigned.slice(0,2).map(r=>`${PRIORITIES[r.priority]}：${escape(r.name)}`).join('<br>')||'担当の白因子なし'}${assigned.length>2?`<small>ほか${assigned.length-2}種</small>`:''}</span><span class="lineage-node-action">編成・因子を見る <span>↗</span></span></button>`;
  }
  function renderDeck(profile,analysis,result){
    return profile.supports.map((id,slot)=>{
      const support=analysis.index.supports.get(id),prefix=support?`${TYPE_LABELS[support.type]}・${support.characterName}`:'';
      const covered=support?result.covered.filter(r=>r.farmingRoutes.some(route=>route.label.startsWith(prefix))):[];
      return `<article class="farming-support"><button class="farming-support-select" data-lineage-slot="${slot}" aria-label="${LINEAGE_NODES[active].label}の因子厳選サポート${slot+1}を選択">${support?artwork(support):'<span class="empty-slot-art">＋</span>'}<span><small>${String(slot+1).padStart(2,'0')} / ${support?`${TYPE_LABELS[support.type]}・${support.rarity}`:'自由枠'}</small><strong>${escape(support?.characterName??'サポートを選択')}</strong><small>${escape(support?.title??'レースボーナス・育成用に調整')}</small></span></button>${support?`<button class="remove-support" data-lineage-remove="${slot}" aria-label="因子厳選サポート${slot+1}を外す">×</button><div class="lineage-card-coverage">${chips(covered)||'<span>現在の不足スキルに登録経路なし</span>'}</div>${support.events.filter(e=>e.selection==='single').map(event=>`<label class="farm-event-label" for="lineage-${event.id}">因子厳選のイベント択</label><select id="lineage-${event.id}" data-lineage-event="${escape(event.id)}" aria-label="因子厳選 ${escape(support.characterName)}のイベント択"><option value="">未指定（この択は計上しない）</option>${event.choices.map(choice=>`<option value="${escape(choice.id)}" ${profile.eventChoices[event.id]===choice.id?'selected':''}>${escape(choice.label)}</option>`).join('')}</select>`).join('')}`:''}</article>`;
    }).join('');
  }
  function chooseCharacter(id){
    const {state,analysis}=context(),plan=current();if(!plan)return;
    const candidate=analysis.index.characters.get(id),main=analysis.index.characters.get(state.characterId);
    if(!candidate||candidate.characterId===main?.characterId||plan.nodes.some((n,i)=>i!==active&&analysis.index.characters.get(n.characterId)?.characterId===candidate.characterId))return;
    saveProfile(suggestCoverageDeck(id,analysis,catalog,{scenario:profile().scenario}));
  }
  function chooseSupport(id,slot){const {analysis}=context(),value=profile(),supports=[...value.supports];supports[slot]=id;saveProfile(completeCoverageChoices(normalizeFarmingProfile({...value,supports},catalog),analysis,catalog));}
  function excludedCharacters(){const {analysis}=context();return new Set((current()?.nodes??[]).filter((_,i)=>i!==active).map(n=>analysis.index.characters.get(n.characterId)?.characterId));}
  $('lineage-overview').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;const d=button.dataset;
    if(d.lineageNode!==undefined){active=Number(d.lineageNode);render();$('lineage-active').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(d.lineageRebuild!==undefined)rebuild();
    else if(d.lineageResetTree!==undefined)rebuild(true);
    else if(d.lineageCharacter!==undefined)openPicker('character',0,'lineage');
    else if(d.lineageSlot!==undefined)openPicker('support',Number(d.lineageSlot),'lineage');
    else if(d.lineageRemove!==undefined){const value=profile(),supports=[...value.supports];supports[Number(d.lineageRemove)]=null;saveProfile({...value,supports});}
    else if(d.lineageFactor)openFactor(d.lineageFactor);
  });
  $('lineage-overview').addEventListener('change',event=>{
    const target=event.target,d=target.dataset,value=profile();
    if(d.lineageFriend!==undefined)save({...current(),friendSide:Number(target.value)},current().manual);
    else if(d.lineageScenario!==undefined)saveProfile({...value,scenario:target.value});
    else if(d.lineageEvent)saveProfile({...value,eventChoices:{...value.eventChoices,[d.lineageEvent]:target.value}});
    else if(d.lineageLearned){const learned=new Set(value.learned);if(target.checked)learned.add(d.lineageLearned);else learned.delete(d.lineageLearned);saveProfile({...value,learned:[...learned]});}
  });
  return {render,profile,chooseCharacter,chooseSupport,excludedCharacters};
}
