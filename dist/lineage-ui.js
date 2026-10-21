import { analyze, normalizeFarmingProfile, normalizeLineagePlan, TYPE_LABELS, PRIORITIES } from './engine.js';
import { LINEAGE_NODES, branchIndices, lineagePlanKey, lineageSignature, suggestLineagePlan, suggestCoverageDeck, analyzeLineagePlan, completeCoverageChoices, refreshLineagePolicy } from './lineage-planner.js';
import { artwork, escape, inheritedFactorSection } from './ui.js';
import { FARMING_POLICY } from './farming-policy.js';
import { RED_FACTORS, analyzeRedPlan } from './factor-targets.js';
import { FIXED_SUPPORT_SLOT } from './deck-rules.js';
import { planLineageRotations, exportRotation, normalizeGoalChoices, ROTATION_SOURCES } from './race-planner.js';
import { preparationHTML, rotationPopupHTML } from './race-ui.js';

const $=id=>document.getElementById(id);
const priority=row=>`<span class="priority priority-${row.priority}">${PRIORITIES[row.priority]}</span>`;
const chips=rows=>rows.map(r=>`<span class="lineage-skill-chip">${priority(r)}${escape(r.name)}</span>`).join('');

export function createLineageUI({catalog,getState,update,openPicker,openFactor}) {
  let active=0,rotationNode=0;
  const context=()=>{const state=getState();return {state,analysis:analyze(state,catalog),key:lineagePlanKey(state)};};
  const current=()=>{const {state,key}=context();return state.lineagePlans[key];};
  const save=(plan,manual=true)=>{const {state,key}=context();update({lineagePlans:{...state.lineagePlans,[key]:normalizeLineagePlan({...plan,manual},catalog,state.characterId)}});};
  const profile=()=>current()?.nodes[active]??normalizeFarmingProfile({},catalog);
  function saveProfile(value){const plan=current();if(!plan)return;const nodes=[...plan.nodes];nodes[active]=value;save({...plan,nodes});}
  function rebuild(resetTree=false){const {state,analysis}=context();save(suggestLineagePlan(state,analysis,catalog,{previous:current(),resetTree}),false);}
  function render() {
    if($('lineage-overview').hidden)return;
    const {state,analysis}=context(),container=$('lineage-overview');
    if(!analysis.course.confirmed||!state.characterId){$('lineage-footer-notes').innerHTML='';container.innerHTML=`<div class="empty-state"><h3>${analysis.course.confirmed?'本育成のウマ娘と編成を選択':'コース詳細未発表'}</h3><p>${analysis.course.confirmed?'不足する白因子と継承候補から、親・祖父母と因子厳選用の編成を提案します。':'コース確定後に因子編成の提案を表示します。'}</p></div>`;return;}
    const plan=current(),signature=lineageSignature(state,analysis);
    if(!plan||(!plan.manual&&plan.signature!==signature)){rebuild();return;}
    if(plan.nodes.some(node=>node.farmingPolicy!==FARMING_POLICY)){save(refreshLineagePolicy(plan,analysis,catalog),plan.manual);return;}
    const result=analyzeLineagePlan(plan,analysis),main=analysis.index.characters.get(state.characterId);
    const red=analyzeRedPlan(state,analysis,plan);
    const rotations=planLineageRotations(state,analysis,plan);
    const high=result.targets.filter(r=>r.priority===1),highCovered=result.covered.filter(r=>r.priority===1);
    const parent=analysis.index.characters.get(plan.nodes[active].characterId),meta=LINEAGE_NODES[active];
    const friend=analysis.index.characters.get(plan.nodes[plan.friendSide].characterId);
    const unplaced=result.inheritance.filter(r=>r.placement==='unplaced'||r.evolvedInheritance&&!r.evolutionPossible);
    container.innerHTML=`
      <section class="lineage-overview-card" aria-labelledby="lineage-heading">
        <div class="lineage-heading"><h3 id="lineage-heading">因子ツリー</h3><button class="outline-button" data-lineage-rebuild>不足に合わせて再提案</button></div>
        <p class="lineage-caption">不足する白因子を優先度「高」からカバー。各個体のサポカ・赤因子は下の一覧に表示し、ウマを押すとイベント択・習得スキルまで編集できます。</p>
        <p class="lineage-scenario-note">全個体で新SSRたづなを6枠目に固定し、残り5枚をSSR・SR・Rから提案。トレセン軒のシナリオ効果を考慮した条件です。URAではシナリオ特効の必須枠ではありませんが、今回の提案は同じ1枠確保の条件で統一しています。<a href="https://www.4gamer.net/games/414/G041434/20260615028/" target="_blank" rel="noopener noreferrer">たづなの効果 ↗</a></p>
        ${plan.signature!==signature?'<div class="lineage-update-note" role="status">本育成または提案の条件が更新されました。たづな固定を適用したうえで手動調整を保持し、現在の不足スキルで再判定しています。「不足に合わせて再提案」で残り5枚を更新できます。</div>':''}
        <div class="lineage-metrics"><div><span>優先度 高の取得ルート</span><strong>${highCovered.length}<small> / ${high.length}</small></strong></div><div><span>6人でカバーする白因子</span><strong>${result.covered.length}<small> / ${result.targets.length}</small></strong></div><div><span>取得元が足りない白因子</span><strong>${result.missing.length}<small>件</small></strong></div></div>
        <p class="lineage-caption">件数は6人の周回編成に取得ルートがある白スキルの数です。既存因子から引き継ぐ分と条件未登録のイベント候補は含めません。</p>
        ${inheritedFactorSection(result.inheritedTargets)}
        <div class="lineage-tree" aria-label="継承ツリー：本育成、親2人、祖父母4人">
          <div class="lineage-trainee">${artwork(main)}<div><small>本育成 / ${escape(state.style)}</small><strong>${escape(main.name)}</strong></div></div>
          <div class="lineage-branches">${[0,1].map(side=>{
            const [p,g1,g2]=branchIndices(side),borrowed=side===plan.friendSide;
            return `<section class="lineage-branch ${borrowed?'friend-branch':''}" aria-label="${borrowed?'フレンド側':'自前側'}の親と祖父母"><div class="lineage-branch-label"><span>${borrowed?'フレンドから借りる':'自分で用意する'}</span><label><input type="radio" name="lineage-friend" value="${side}" data-lineage-friend ${borrowed?'checked':''}> この親を借りる</label></div>${renderNode(p,plan,result,red,rotations.rotations[p])}<div class="lineage-grandparents">${renderNode(g1,plan,result,red,rotations.rotations[g1])}${renderNode(g2,plan,result,red,rotations.rotations[g2])}</div></section>`;
          }).join('')}</div>
        </div>
        <p class="lineage-caption">親の固有は育成開始時にヒントを受け取れます。祖父母の固有は育成中の継承抽選。継承進化を狙う衣装は直接親に置き、レンタルでも本人の所持が必要です。固有因子用のキャラは★3以上で用意してください。</p>
        ${unplaced.length?`<details class="lineage-alternatives"><summary>ツリー外・直接親への変更が必要な継承候補 ${unplaced.length}件</summary><div>${unplaced.map(r=>`<p>${priority(r)}<strong>${escape(r.name)}</strong><span>${escape(r.ownerName)}${r.evolvedInheritance?' / 継承進化には直接親が必要':''}</span><button class="text-button" data-lineage-factor="${escape(r.name)}">取得条件を見る ↗</button></p>`).join('')}</div></details>`:''}
        <div class="lineage-footer-actions"><button class="text-button" data-lineage-reset-tree>親・祖父母も選び直す</button><details><summary>提案の基準・継承ルール</summary><p>継承進化の候補を直接親に優先配置。サポカで補えない白因子を自前で取れるウマも祖父母に含め、残りに固有候補を優先度順で配置します。白因子の担当は取得ルートを見て分散し、高は両親にも重ねる方針です。キャラ固有の相性は未評価。共通GⅠはおすすめローテで判定します。</p><p>サポカはSSR・SR・Rすべてが対象。高→中→低の順に取得経路の種類を増やす探索で、6枚の最適解を保証するものではありません。所持・凸数・レースボーナス・育成性能は未評価。経路が増えない枠は自由枠にしています。</p><a href="https://kamigame.jp/umamusume/page/154134787475434233.html" target="_blank" rel="noopener noreferrer">親・祖父母の固有／白因子の仕様 ↗</a><a href="https://kamigame.jp/umamusume/page/379386472786060081.html" target="_blank" rel="noopener noreferrer">継承進化の条件 ↗</a><a href="https://umamusumelabo.com/event/loh/loh-kyoto3000-202611" target="_blank" rel="noopener noreferrer">京都3000mの継承候補・継承進化 ↗</a></details></div>
      </section>
      ${renderIndividuals(plan,analysis,result,red)}
      <section class="lineage-friend-card" aria-labelledby="lineage-friend-title"><div class="lineage-heading"><h3 id="lineage-friend-title">フレンドで探す因子</h3><span class="lineage-friend-tag">${LINEAGE_NODES[plan.friendSide].label}をレンタル</span></div><div class="lineage-friend-owner">${artwork(friend)}<div><strong>${escape(friend?.name??'親を選択')}</strong><p>${escape(result.inheritance.find(r=>r.node===plan.friendSide)?.name??'固有はカードの取得元で確認')}${result.inheritance.some(r=>r.node===plan.friendSide&&r.evolvedInheritance)?' / 継承進化には対象衣装の本人所持が必要（所持状況は未確認）':''}</p></div></div>
        <h4>代表と祖父母の赤因子</h4><div class="lineage-chips">${branchIndices(plan.friendSide).map(i=>`<span class="lineage-red-badge">${LINEAGE_NODES[i].label}：${red.targets[i].type} 目標★${red.targets[i].stars}</span>`).join('')}</div>
        <h4>代表・祖父母に用意する白因子</h4><div class="lineage-chips">${chips(result.friendTargets)||'<span>不足する白因子なし。必要な固有と相性で選択。</span>'}</div>
        ${result.inheritedTargets.length?`<h4>既存因子にも含める前提</h4><div class="lineage-chips">${chips(result.inheritedTargets)}</div><p class="lineage-caption">借りる代表・祖父母の白因子を確認。体のためのサポカ枠は確保していません。</p>`:''}
        ${result.friendOnly.length?`<h4>自前側の周回編成で取れない分を補う</h4><div class="lineage-chips">${chips(result.friendOnly)}</div>`:''}
        <p class="lineage-caption">祖父母：${branchIndices(plan.friendSide).slice(1).map(i=>escape(analysis.index.characters.get(plan.nodes[i].characterId)?.name??'未指定')).join(' ／ ')}。この組み合わせと白因子を持つ代表ウマを探すための条件です。実在するフレンドの因子在庫は検索・照合していません。</p>
        <p class="lineage-caption">高の因子を優先し、揃わない場合はツリーの親・祖父母を手持ちや募集条件に合わせて変更してください。</p><a href="https://uma.pure-db.com/" target="_blank" rel="noopener noreferrer">ウマ娘DBでフレンド因子を探す ↗</a>
      </section>
      <section class="lineage-active-card" id="lineage-active" aria-labelledby="lineage-deck-title"><div class="lineage-heading"><div><p class="eyebrow">${meta.label} / ${meta.side===plan.friendSide?'フレンド側':'自前側'}</p><h3 id="lineage-deck-title">${escape(parent?.characterName??'未選択')}の因子厳選用サポカ編成</h3></div><button class="outline-button" data-lineage-character>周回ウマを変更</button></div>
        <div class="lineage-active-parent">${artwork(parent)}<div><strong>${escape(parent?.name??'周回するウマを選択')}</strong><p>${escape(result.inheritance.find(r=>r.node===active)?.name??'白因子の取得元を優先した候補')}</p></div></div>
        <h4>このウマに用意する白因子</h4><div class="lineage-chips">${chips(result.assignments[active])||'<span>必要な因子を別の親・祖父母でカバー。周回では下記の高から追加できます。</span>'}</div>
        <div class="lineage-red-controls"><label>育成完了時に指定する赤因子<select data-lineage-red aria-label="指定する赤因子">${RED_FACTORS.map(type=>`<option ${red.targets[active].type===type?'selected':''}>${type}</option>`).join('')}</select></label><label>目標星数<select data-lineage-red-stars aria-label="赤因子の目標星数">${[3,2,1].map(stars=>`<option value="${stars}" ${red.targets[active].stars===stars?'selected':''}>★${stars}</option>`).join('')}</select></label></div><p class="lineage-caption">${escape(red.targets[active].preparation)} 星数は抽選です。</p>
        <div class="lineage-deck-controls"><label>取得方法<select data-lineage-scenario aria-label="この周回の取得方法"><option value="support" ${plan.nodes[active].scenario==='support'?'selected':''}>トレセン軒：サポカのヒント・イベント</option><option value="ura" ${plan.nodes[active].scenario==='ura'?'selected':''}>URA：真髄の対決イベントも使う</option></select></label><span>SSR・SR・Rすべて対象 / 6枠目はたづな固定</span></div>
        ${plan.nodes[active].scenario==='ura'?'<p class="lineage-scenario-note">この周回はURAで真髄・体／力／速も狙う案です。ハッピーミークとの対決で、それぞれスタミナ／パワー／スピードの勝負に成功する必要があります。<a href="https://umamusumelabo.com/beginner/urafinals-update" target="_blank" rel="noopener noreferrer">取得条件 ↗</a></p>':''}
        <div class="farming-deck lineage-deck">${renderDeck(plan.nodes[active],analysis,result.results[active])}</div>
        ${inheritedFactorSection(result.results[active].inheritedTargets,'lineage')}
        <div class="lineage-heading lineage-skill-heading"><h4>周回で習得するスキル</h4><span>取得ルート ${result.results[active].covered.length} / ${result.targets.length}</span></div><p class="lineage-caption">高から先に習得し、中・低へ。ヒント発生・イベント完走や成功条件があります。金まで習得しても、厳選対象は対応する下位の白因子です。</p>
        <div class="farming-skill-list lineage-target-list">${result.results[active].covered.map(r=>`<article class="farming-skill"><div>${priority(r)}<span class="lineage-assignment">${result.assignments[active].some(t=>t.skillId===r.skillId)?'このウマの担当':'追加候補'}</span></div><h4>${escape(r.name)}</h4><p class="farming-route">${r.farmingRoutes.map(route=>escape(route.label)).join('<br>')}</p><label class="prepare-checkbox"><input type="checkbox" data-lineage-learned="${escape(r.name)}" ${r.learned?'checked':''}> 取得済み（因子化は別）</label></article>`).join('')||'<p>この編成に取得経路はありません。</p>'}</div>
        ${result.results[active].missing.length?`<details class="lineage-missing"><summary>この周回に取得元がない白因子 ${result.results[active].missing.length}件</summary><div>${result.results[active].missing.map(r=>`<button data-lineage-factor="${escape(r.name)}">${priority(r)}<span>${escape(r.name)}</span><small>${r.uncertainRoutes.length?'未確認イベント候補あり':'別の取得元を見る'} ↗</small></button>`).join('')}</div></details>`:''}
      </section>
      ${result.missing.length?`<section class="lineage-uncovered"><h3>6人の編成でも別の取得元が必要</h3><p class="lineage-caption">サポカの差し替え・シナリオ・既存の因子から補う候補です。各因子を押すと個別の周回案を確認できます。</p><div class="lineage-chips">${result.missing.map(r=>`<button class="lineage-skill-chip" data-lineage-factor="${escape(r.name)}">${priority(r)}${escape(r.name)} ↗</button>`).join('')}</div></section>`:''}`;
    moveNotesToFooter(container,rotations);
    if($('rotation-dialog').open)renderRotation();
  }
  function renderNode(i,plan,result,red,rotation){
    const node=plan.nodes[i],meta=LINEAGE_NODES[i],character=catalog.characters.find(c=>c.id===node.characterId),unique=result.inheritance.find(r=>r.node===i),assigned=result.assignments[i];
    return `<article class="lineage-node ${active===i?'selected':''}"><button class="lineage-node-select" data-lineage-node="${i}" aria-pressed="${active===i}" aria-label="${meta.label} ${escape(character?.name??'未指定')}の周回編成を見る"><span class="lineage-node-role">${meta.label}${unique?.evolutionPossible?' <b>継承進化</b>':''}${node.scenario==='ura'?' <b>URA</b>':''}</span><span class="lineage-node-character">${artwork(character)}<span><small>${escape(character?.title??'')}</small><strong>${escape(character?.characterName??'ウマ未指定')}</strong></span></span><span class="lineage-node-unique">${escape(unique?.name??'白因子の取得用')}${unique?.evolvedInheritance&&!unique.evolutionPossible?'（祖父母では進化不可）':''}</span><span class="lineage-node-red">完成時の赤：${red.targets[i].type} ★${red.targets[i].stars}</span><span class="lineage-node-factors">${assigned.slice(0,2).map(r=>`${PRIORITIES[r.priority]}：${escape(r.name)}`).join('<br>')||'白因子は別の個体で担当'}</span><span class="lineage-node-action">編成・因子を見る <span>↗</span></span></button>${preparationHTML(rotation.preparation)}<button class="rotation-open-button" data-lineage-rotation="${i}" aria-label="${meta.label} ${escape(character?.characterName??'未指定')}のおすすめローテ">おすすめローテ ↗</button></article>`;
  }
  function moveNotesToFooter(container,rotations){
    const footer=$('lineage-footer-notes');footer.innerHTML='';
    const selectors=['.lineage-caption','.lineage-scenario-note','.lineage-metrics','.lineage-overview-card > .lineage-update-note','.lineage-overview-card > .inherited-factor-note','.lineage-footer-actions > details','.lineage-red-sources','.individual-red-guide','.lineage-skill-heading > span'];
    for(const element of container.querySelectorAll(selectors.join(','))){
      if(element.classList.contains('individual-red-guide')){const name=element.closest('.lineage-individual')?.querySelector('.lineage-individual-character strong')?.textContent;const summary=element.querySelector('summary');summary.textContent=name+'：'+summary.textContent;}
      footer.append(element);
    }
    for(const element of container.querySelectorAll('.lineage-individual-count'))element.remove();
    const compatibility=document.createElement('section');compatibility.className='rotation-compatibility';
    compatibility.innerHTML=`<h4>共通GⅠボーナスの計画（予定を全勝した場合）</h4><p>+${rotations.total}。ウマ娘固有の相性・トレーナーアビリティは加算していません。</p>${rotations.pairs.map(p=>`<p>${LINEAGE_NODES[p.a].label} × ${LINEAGE_NODES[p.b].label}：共通${p.common.length}種類 / +${p.bonus}</p>`).join('')}<p>GⅠは同じレースを複数回勝っても1種類として数えます。5組の共通勝利を増やす探索で、全組合せに対する最適解を保証するものではありません。フレンド側も、表示したローテの勝利実績がある個体を探すための条件です。</p>${ROTATION_SOURCES.map(s=>`<a href="${s.url}" target="_blank" rel="noopener noreferrer">${escape(s.name)}（${s.date}） ↗</a>`).join('')}`;
    footer.append(compatibility);
  }
  function renderRotation(){
    const {state,analysis}=context(),plan=current();if(!plan)return;
    const result=planLineageRotations(state,analysis,plan);
    $('rotation-title').textContent=LINEAGE_NODES[rotationNode].label+'のおすすめローテ';
    $('rotation-content').innerHTML=rotationPopupHTML(result.rotations[rotationNode],LINEAGE_NODES[rotationNode].label);
  }
  function renderIndividuals(plan,analysis,result,red){
    return `<section class="lineage-individuals" id="lineage-individuals" aria-labelledby="individuals-title"><div class="lineage-heading"><h3 id="individuals-title">個体ごとのサポカ・赤因子</h3><span>親2人・祖父母4人</span></div><p class="lineage-caption">完成時の赤因子はレース距離を基本にし、本育成の脚質・バ場の適性補正が必要なら配分します。★は厳選目標で、確定指定ではありません。下の開始時適性は6人が目標通りに揃った場合の計算です。</p><div class="lineage-red-totals">${Object.entries(red.totals).map(([type,stars])=>`<span>${type} 合計★${stars}</span>`).join('')}</div><div class="lineage-initial-aptitudes">${red.initial.map(r=>`<span class="${r.ready?'':'aptitude-shortfall'}">本育成の${r.type}：初期${r.rank??'不明'} ／ 開始時${r.projected??'不明'}</span>`).join('')}</div>${red.warnings.map(w=>`<p class="lineage-update-note">${escape(w)}</p>`).join('')}<div class="lineage-individual-grid">${plan.nodes.map((node,i)=>{
      const character=analysis.index.characters.get(node.characterId),target=red.targets[i],gene=red.genes[i],meta=LINEAGE_NODES[i];
      return `<article class="lineage-individual" data-individual="${i}"><div class="lineage-individual-heading"><div class="lineage-individual-character">${artwork(character)}<div><small>${meta.label} / ${meta.side===plan.friendSide?'フレンド側':'自前側'} / ${node.scenario==='ura'?'URA':'トレセン軒'}</small><strong>${escape(character?.name??'未指定')}</strong></div></div><button class="text-button" data-lineage-edit="${i}">編成を編集 ↗</button></div><div class="lineage-red-badge">指定する赤因子：<strong>${target.type}</strong><span>目標★${target.stars}</span></div><div class="lineage-individual-deck">${node.supports.map((id,slot)=>{
        const support=analysis.index.supports.get(id);return `<figure class="individual-support ${slot===FIXED_SUPPORT_SLOT?'individual-fixed':''}" title="${escape(support?.name??'自由枠')}">${support?artwork(support):'<span class="empty-slot-art">＋</span>'}<figcaption><strong>${escape(support?.characterName??'自由枠')}</strong><small>${support?`${support.rarity}${slot===FIXED_SUPPORT_SLOT?'・固定':''}`:'追加可'}</small></figcaption></figure>`;
      }).join('')}</div>${result.inheritedTargets.length?`<p class="individual-inherited">継承で引き継ぐ：${result.inheritedTargets.map(r=>escape(r.name)).join(' / ')}（高）</p>`:''}<p class="lineage-individual-count">白因子の取得ルート ${result.results[i].covered.length} / ${result.targets.length}種</p><div class="lineage-chips">${chips(result.assignments[i])||'<span>白因子は別の個体で担当</span>'}</div><details class="individual-red-guide"><summary>この個体の赤因子・遺伝子の準備</summary><p>${escape(target.preparation)}</p><p>追加の白因子目標：${escape(gene.distance)}${gene.style?`、${escape(gene.style)}`:''}。</p><p>${i<2?`この個体の育成に使う継承元6人のうち、表示中の祖父母2人は距離赤★${gene.distanceStars}・作戦赤★${gene.styleStars}の計画。${gene.budgetPossible?`残り4人に距離赤★${gene.remainingDistance}以上、作戦赤★${gene.remainingStyle}以上を追加すると、距離★12・作戦★6の目安に届きます。`:`残り4人の星数だけでは距離★12・作戦★6を両立できません。距離の遺伝子を優先するか、祖父母の赤因子を調整してください。`}`:'この祖父母個体を作る際の継承元6人は、ツリーのさらに下の世代です。距離赤を合計★12以上、作戦赤を合計★6以上用意する配分が目安です。'}</p></details></article>`;
    }).join('')}</div><details class="lineage-red-sources"><summary>赤因子・遺伝子の根拠</summary><p>開始時適性は同種の赤因子★1・4・7・10で1〜4段階上昇し、上限A。距離Sは育成中の継承で狙います。遺伝子は通常スキルの習得とは別で、攻略資料では育成に使った継承元6人の同種赤★6以上で抽選対象、★12以上が確定ラインとされています。ここでは距離★12＋作戦★6を準備の目安にし、距離と作戦の両方の遺伝子を確約しません。</p><a href="https://game8.jp/umamusume/438397" target="_blank" rel="noopener noreferrer">開始時適性の上昇 ↗</a><a href="https://note.com/mustbethetruth/n/nab089bd1fa0b" target="_blank" rel="noopener noreferrer">note：赤因子指定と遺伝子の仕組み ↗</a><a href="https://design.u-ma.org/guide/factors" target="_blank" rel="noopener noreferrer">星数と遺伝子の配分 ↗</a></details></section>`;
  }
  function renderDeck(profile,analysis,result){
    return profile.supports.map((id,slot)=>{
      const support=analysis.index.supports.get(id),prefix=support?`${TYPE_LABELS[support.type]}・${support.characterName}`:'',fixed=slot===FIXED_SUPPORT_SLOT,tag=fixed?'div':'button';
      const covered=support?[...result.covered,...result.inheritedTargets.map(r=>({...r,name:r.name+'（追加取得可・採用点外）'}))].filter(r=>r.farmingRoutes.some(route=>route.label.startsWith(prefix))):[];
      return `<article class="farming-support ${fixed?'lineage-fixed-support':''}"><${tag} class="farming-support-select" ${fixed?'role="group" aria-label="因子厳選サポート6：SSRたづな・固定"':`data-lineage-slot="${slot}" aria-label="${LINEAGE_NODES[active].label}の因子厳選サポート${slot+1}を選択"`}>${support?artwork(support):'<span class="empty-slot-art">＋</span>'}<span><small>${String(slot+1).padStart(2,'0')} / ${fixed?'固定':support?`${TYPE_LABELS[support.type]}・${support.rarity}`:'自由枠'}</small><strong>${escape(support?.characterName??'サポートを選択')}</strong><small>${escape(support?.title??'レースボーナス・育成用に調整')}</small></span></${tag}>${support?`${fixed?'':`<button class="remove-support" data-lineage-remove="${slot}" aria-label="因子厳選サポート${slot+1}を外す">×</button>`}<div class="lineage-card-coverage">${chips(covered)||(fixed?'<span>シナリオ・育成用の固定枠</span>':'<span>現在の不足スキルに登録経路なし</span>')}</div>${support.events.filter(e=>e.selection==='single').map(event=>`<label class="farm-event-label" for="lineage-${event.id}">因子厳選のイベント択</label><select id="lineage-${event.id}" data-lineage-event="${escape(event.id)}" aria-label="因子厳選 ${escape(support.characterName)}のイベント択"><option value="">未指定（この択は計上しない）</option>${event.choices.map(choice=>`<option value="${escape(choice.id)}" ${profile.eventChoices[event.id]===choice.id?'selected':''}>${escape(choice.label)}</option>`).join('')}</select>`).join('')}`:''}</article>`;
    }).join('');
  }
  function chooseCharacter(id){
    const {state,analysis}=context(),plan=current();if(!plan)return;
    const candidate=analysis.index.characters.get(id),main=analysis.index.characters.get(state.characterId);
    if(!candidate||candidate.characterId===main?.characterId||plan.nodes.some((n,i)=>i!==active&&analysis.index.characters.get(n.characterId)?.characterId===candidate.characterId))return;
    saveProfile({...suggestCoverageDeck(id,analysis,catalog,{scenario:profile().scenario}),redFactor:profile().redFactor});
  }
  function chooseSupport(id,slot){if(slot===FIXED_SUPPORT_SLOT)return;const {analysis}=context(),value=profile(),supports=[...value.supports];supports[slot]=id;saveProfile(completeCoverageChoices(normalizeFarmingProfile({...value,supports},catalog),analysis,catalog));}
  function excludedCharacters(){const {analysis}=context();return new Set((current()?.nodes??[]).filter((_,i)=>i!==active).map(n=>analysis.index.characters.get(n.characterId)?.characterId));}
  $('lineage-overview').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;const d=button.dataset;
    if(d.lineageRotation!==undefined){rotationNode=Number(d.lineageRotation);renderRotation();$('rotation-dialog').showModal();}
    else if(d.lineageNode!==undefined){active=Number(d.lineageNode);render();$('lineage-active').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(d.lineageEdit!==undefined){active=Number(d.lineageEdit);render();$('lineage-active').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(d.lineageRebuild!==undefined)rebuild();
    else if(d.lineageResetTree!==undefined)rebuild(true);
    else if(d.lineageCharacter!==undefined)openPicker('character',0,'lineage');
    else if(d.lineageSlot!==undefined)openPicker('support',Number(d.lineageSlot),'lineage');
    else if(d.lineageRemove!==undefined&&Number(d.lineageRemove)!==FIXED_SUPPORT_SLOT){const value=profile(),supports=[...value.supports];supports[Number(d.lineageRemove)]=null;saveProfile({...value,supports});}
    else if(d.lineageFactor)openFactor(d.lineageFactor);
  });
  $('close-rotation').addEventListener('click',()=>$('rotation-dialog').close());
  $('rotation-dialog').addEventListener('change',event=>{
    const order=event.target.dataset.rotationGoal;if(order===undefined)return;
    const plan=current(),node=plan.nodes[rotationNode],character=catalog.characters.find(c=>c.id===node.characterId);
    const choices={...node.raceGoalChoices,[order]:Number(event.target.value)};
    if(character?.characterId===1005&&order==='6')delete choices['5'];
    const nodes=[...plan.nodes];nodes[rotationNode]={...node,raceGoalChoices:normalizeGoalChoices(character,choices)};save({...plan,nodes});
  });
  $('rotation-dialog').addEventListener('click',async event=>{
    const button=event.target.closest('[data-rotation-copy]');if(!button)return;
    const {state,analysis}=context(),result=planLineageRotations(state,analysis,current());
    try{await navigator.clipboard.writeText(exportRotation(result.rotations[rotationNode]));button.textContent='コピーしました';}catch{button.textContent='コピーできませんでした';}
  });
  $('lineage-overview').addEventListener('change',event=>{
    const target=event.target,d=target.dataset,value=profile();
    if(d.lineageFriend!==undefined)save({...current(),friendSide:Number(target.value)},current().manual);
    else if(d.lineageRed!==undefined||d.lineageRedStars!==undefined){const {state,analysis}=context(),red=analyzeRedPlan(state,analysis,current()).targets[active];saveProfile({...value,redFactor:{type:d.lineageRed!==undefined?target.value:red.type,stars:d.lineageRedStars!==undefined?Number(target.value):red.stars}});}
    else if(d.lineageScenario!==undefined)saveProfile({...value,scenario:target.value});
    else if(d.lineageEvent)saveProfile({...value,eventChoices:{...value.eventChoices,[d.lineageEvent]:target.value}});
    else if(d.lineageLearned){const learned=new Set(value.learned);if(target.checked)learned.add(d.lineageLearned);else learned.delete(d.lineageLearned);saveProfile({...value,learned:[...learned]});}
  });
  return {render,profile,chooseCharacter,chooseSupport,excludedCharacters};
}
