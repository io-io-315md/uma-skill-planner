import { COURSES, STYLES, CATEGORIES, SOURCES } from './recommendations.js';
import { DEFAULT_STATE, normalizeState, analyze, TYPE_LABELS, PRIORITIES, exportChecklist, eventChoicesForPurpose, resolvedEventChoice, acquisitionRoutes } from './engine.js';
import { needsFactor } from './factor-planner.js';
import { createFactorUI } from './factor-ui.js';
import { createLineageUI } from './lineage-ui.js';
import { exportLineagePlan, lineagePlanKey, refreshSavedFarmingPlans } from './lineage-planner.js';
import { artwork } from './ui.js';
import { createTierUI } from './tier-ui.js';
import { selectSupportCandidates } from './support-picker.js';
import { createSupportUsageIndex, DISTANCES, RUN_STYLES, targetLabel, skillMatchesRace } from './support-usage.js';
import { FIXED_SUPPORT_SLOT, RENTAL_SUPPORT_SLOT } from './deck-rules.js';
import { MAIN_DECK_GUIDE } from './main-deck-data.js';
import { applyMainDeck, changeMainConditions } from './main-deck.js';
import { loadLiveData, applyLiveData } from './live-data.js';

const $ = id => document.getElementById(id);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE = 'umaplan.v1';
const statusLabels = { factor:'白因子で補う候補', inheritance:'親から継承', available:'編成から取得候補', manual:'別ルートで取得', 'own-unique':'本体固有・継承不要', 'event-check':'イベント条件を確認', incompatible:'同キャラの継承不可' };
let catalog, state, analysis, factorUI, lineageUI, tierUI, supportUsage;
let view = 'factor', category = 'すべて', priorityFilter = 'all', query = '', showExcluded = false;
let picker = { kind:'character', slot:0, type:'すべて', context:'main' };
let toastTimer;
let liveSource='bundled',refreshing=false;
const liveStorage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};

function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4300); }
function persist() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { toast('保存できませんでした。JSON書き出しでプランを保管してください。'); } }
function update(patch = {},options={}) {
  const changed=['characterId','style','courseId'].some(k=>Object.hasOwn(patch,k)&&patch[k]!==state[k]);
  state=options.preserve?normalizeState({...state,...patch},catalog):changeMainConditions(state,patch,catalog,MAIN_DECK_GUIDE,options);
  if((patch.supports||patch.eventChoices)&&!changed&&!options.force)state.mainDeck.mode='manual';
  persist();render();
}
function toggle(array, value) { return array.includes(value) ? array.filter(v => v !== value) : [...array, value]; }
function checklistText(){const plan=state.lineagePlans[lineagePlanKey(state)];return exportChecklist(state,analysis)+(plan?'\n\n'+exportLineagePlan(plan,analysis,state):'');}

function render() {
  analysis = analyze(state, catalog);
  const refreshed=refreshSavedFarmingPlans(state,analysis,catalog);
  if(refreshed!==state){state=refreshed;persist();}
  renderCourses(); renderSetup(); renderResults(); renderSaved(); factorUI?.render(); tierUI?.render();
}
async function refreshLiveData(){
  if(refreshing||!catalog)return;
  refreshing=true;renderSetup();
  try{
    const response=await fetch(new URL('./data/catalog.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Catalog unavailable');
    const nextCatalog=await response.json();
    const live=await loadLiveData(nextCatalog,{storage:liveStorage});
    if(!live.data){liveSource='cache';toast('更新データを取得できませんでした。現在のデータを保持しています。');return;}
    applyLiveData(live.data);catalog=nextCatalog;liveSource=live.source;
    supportUsage=createSupportUsageIndex(catalog);
    state=applyMainDeck(normalizeState(state,catalog),catalog,MAIN_DECK_GUIDE);persist();
    toast(live.source==='network'?'開催条件・推奨編成・不足因子を更新しました。':'更新できないため、前回のデータで再編成しました。');
  }catch{liveSource='cache';toast('更新データを取得できませんでした。現在の編成を保持しています。');}
  finally{refreshing=false;render();}
}
function renderCourses() {
  const c = analysis.course;
  $('course-tabs').innerHTML = COURSES.map(course => `<button class="course-tab ${course.id === c.id ? 'active' : ''} ${course.confirmed ? '' : 'pending'}" data-course="${course.id}" aria-pressed="${course.id === c.id}"><span class="course-tab-top"><span class="course-month">${course.month}<small>${course.year}</small></span><span class="tag ${course.type === 'LoH' ? 'tag-loh' : 'tag-cm'}">${course.type}</span></span><strong>${course.confirmed ? `${course.venue} ${course.surface}${course.distance.toLocaleString()}m` : `${course.surface}・${course.distanceType}`}</strong><span class="course-tab-bottom">${course.confirmed ? '<span class="status-dot"></span>コース確定' : 'コース詳細発表待ち'}<span> / ${course.date}</span></span></button>`).join('');
  $('course-banner').classList.toggle('pending-banner', !c.confirmed);
  $('course-banner').innerHTML = c.confirmed ? `<div><p class="banner-caption">${c.year}.${c.month} <span aria-hidden="true">/</span> ${escape(c.title)}</p><div class="banner-title"><h2>${c.venue}</h2><strong>${c.distance.toLocaleString()}<small>m</small></strong><span class="condition">${c.surface}・${c.distanceType}</span></div><div class="banner-conditions">${[c.turn,c.season,c.weather === 'ランダム' ? '天候ランダム' : c.weather,c.going === 'ランダム' ? 'バ場ランダム' : c.going,c.time,`${c.runners}人立て`].map(v => `<span class="condition">${escape(v)}</span>`).join('')}</div></div><div class="banner-aside"><p>${escape(c.summary)}</p><a href="${SOURCES.official.url}" target="_blank" rel="noopener noreferrer">公式の開催条件を見る ↗</a></div>` : `<div><p class="banner-caption">${c.year}.${c.month} / ${escape(c.date)}</p><div class="banner-title"><h2>コース詳細の発表待ち</h2></div><div class="banner-conditions"><span class="condition">${c.type}</span><span class="condition">${c.surface}・${c.distanceType}</span>${c.rule ? `<span class="condition">${c.rule}</span>` : ''}</div></div><div class="banner-aside"><p>競馬場・距離が未発表のため、コース別スキルの推奨は保留しています。</p><a href="${SOURCES.official.url}" target="_blank" rel="noopener noreferrer">公式スケジュール ↗</a></div>`;
}
function renderSetup() {
  const char = analysis.index.characters.get(state.characterId);
  $('character-label').innerHTML = char ? `${artwork(char)}<span>${escape(char.name)}</span>` : 'ウマ娘を選択';
  const aptitude=char?.aptitude,styleIndex=STYLES.indexOf(state.style)+6;
  const distance=analysis.course.distanceType,distanceIndex={短距離:2,マイル:3,中距離:4,長距離:5}[distance];
  $('character-note').textContent=char?`覚醒は最大で判定。初期適性：${distance} ${aptitude?.[distanceIndex]??'不明'} / ${state.style} ${aptitude?.[styleIndex]??'不明'}`:'本育成で作るウマ娘を選択します。';
  $('style-buttons').innerHTML=STYLES.map(style=>`<button class="style-button ${style===state.style?'active':''}" data-style="${style}" aria-pressed="${style===state.style}">${style}</button>`).join('');
  $('support-count').textContent=`${state.supports.filter(Boolean).length} / 6`;
  $('main-deck-mode').textContent=state.mainDeck.mode==='manual'?'手動調整中':state.mainDeck.status==='reviewed'?'自動編成':'暫定編成';
  $('main-deck-apply').disabled=!char;
  $('main-deck-note').textContent=!char?'キャラを選ぶと、レースと脚質に合う編成をセットします。':`${analysis.course.venue??'コース未発表'} ${analysis.course.distance?analysis.course.distance+'m':distance}・${state.style} / ${MAIN_DECK_GUIDE.scenario}${state.mainDeck.status==='reviewed'?'':'（発表済みの距離・脚質による暫定案）'}`;
  $('live-data-state').textContent=refreshing?'更新データを確認中…':`${liveSource==='network'?'公開データ取得済み':liveSource==='cache'?'更新できないため前回のデータ':'同梱データを使用'} / ${MAIN_DECK_GUIDE.verifiedAt.replaceAll('-','.')}`;
  $('refresh-data').disabled=refreshing;
  $('data-edition').textContent=`編成・開催 ${MAIN_DECK_GUIDE.verifiedAt.replaceAll('-','.')} / DB ${catalog.retrievedAt.replaceAll('-','.')}`;
  $('main-deck-sources').innerHTML=(state.mainDeck.sourceIds.length?state.mainDeck.sourceIds:['novemberDecks','decemberDecks']).filter(id=>SOURCES[id]).map(id=>`<a href="${escape(SOURCES[id].url)}" target="_blank" rel="noopener noreferrer">${escape(SOURCES[id].name)} ↗</a>`).join('');
  $('support-slots').innerHTML=state.supports.map((id,i)=>{
    const support=analysis.index.supports.get(id);
    const goldRoles=support?[...acquisitionRoutes({...state,characterId:null,supports:[id]},analysis.index)].filter(([id,routes])=>analysis.index.skills.get(id)?.rarity===2&&skillMatchesRace(analysis.index.skills.get(id),analysis.course,state.style)&&routes.some(r=>r.kind!=='event-unverified')).map(([id])=>analysis.index.skills.get(id).name):[];
    const fixed=i===FIXED_SUPPORT_SLOT,tag=fixed?'div':'button',assignment=fixed?'自前・固定':i===RENTAL_SUPPORT_SLOT?'レンタル':'自前';
    return `<div class="support-slot ${fixed?'fixed-support-slot':''}"><div class="support-slot-main"><span class="slot-number">${String(i+1).padStart(2,'0')}</span><${tag} class="slot-select visual-slot-select" ${fixed?'role="group" aria-label="サポート6：SSRたづな・自前固定"':`data-slot="${i}" aria-label="サポート${i+1}を選択"`}>${support?`${artwork(support)}<span class="slot-copy"><span class="slot-assignment ${fixed?'fixed-assignment':''}">${assignment}</span><span class="slot-title">${escape(support.title)}</span><strong>${escape(support.characterName)}</strong><small>${TYPE_LABELS[support.type]}・${support.rarity}</small></span>`:`<span class="empty-slot-art">＋</span><span><span class="slot-assignment">${assignment}</span><strong class="empty-title">サポートを選択</strong></span>`}</${tag}>${support&&!fixed?`<button class="remove-support" data-remove="${i}" aria-label="サポート${i+1}を外す">×</button>`:''}</div>${goldRoles.length?`<p class="main-card-role">金スキル候補：${goldRoles.map(escape).join(' / ')}</p>`:''}${(support?.events??[]).filter(e=>e.selection==='single').map(event=>{
      const choices=eventChoicesForPurpose(event,analysis.index,'main');
      const chosen=resolvedEventChoice(event,state,analysis.index,'main');
      const explicit=choices.some(c=>c.id===state.eventChoices[event.id]);
      const excludesWhite=choices.length<event.choices.length;
      return `<div class="event-choices"><label for="${event.id}">本育成のイベント択${excludesWhite?'（金スキル側）':''}</label><select id="${event.id}" data-event="${event.id}" aria-label="本育成 ${escape(support.characterName)} ${escape(event.label)}"><option value="">${chosen?`自動：${escape(chosen.label)}`:'未指定（択のスキルは計上しない）'}</option>${choices.map(choice=>`<option value="${escape(choice.id)}" ${explicit&&state.eventChoices[event.id]===choice.id?'selected':''}>${escape(choice.label)}</option>`).join('')}</select>${excludesWhite?'<p class="micro-note">金と引き換えになる白スキル択は、因子周回で設定します。</p>':''}</div>`;
    }).join('')}</div>`;
  }).join('');
}

function renderResults() {
  const {counts,course}=analysis;
  const uncertain=analysis.rows.filter(r=>!r.excluded&&r.status==='event-check').length;
  $('results-title').textContent=view==='factor'?'必要な継承・白因子':view==='lineage'?'因子厳選用サポカ編成':'本育成の取得スキル';
  $('stats').innerHTML=[['白因子が必要',counts.factor],['継承固有の候補',counts.inheritance],['本育成で取得候補',counts.available-uncertain],['イベント条件要確認',uncertain]].map(([label,n])=>`<div class="stat"><span class="stat-label">${label}</span><strong class="stat-number">${n}<small>件</small></strong></div>`).join('');
  const blanks=state.supports.filter(s=>!s).length;
  $('results-notice').innerHTML=`<span class="notice-dot">•</span><span>${!course.confirmed?'コース未確定のため、不足判定は表示しません。':!state.characterId?'本育成のウマ娘を選択してください。':blanks?`本育成のサポート ${6-blanks}/6枠。空き枠があるため不足一覧は仮の結果です。`:'本育成は金スキル側のイベント択で照合。白スキルを優先する択は因子周回で別に扱います。'}</span>`;
  $('todo-count').textContent=counts.factor+counts.inheritance;
  document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===view);button.setAttribute('aria-selected',String(button.dataset.view===view));});
  $('course-factor-summary').hidden=view!=='factor'||!state.characterId;
  $('course-factor-summary').innerHTML=COURSES.filter(c=>c.confirmed).map(c=>{
    const a=c.id===course.id?analysis:analyze({...state,courseId:c.id},catalog);
    return `<button class="course-factor-count ${c.id===course.id?'active':''}" data-course="${c.id}"><strong>${c.month}月 ${c.venue} ${c.distance}m</strong><span>白因子 ${a.counts.factor} / 継承固有の候補 ${a.counts.inheritance}</span></button>`;
  }).join('');
  $('factor-view-note').hidden=view!=='factor';
  $('skill-results-body').hidden=view==='lineage';
  $('skill-results-body').setAttribute('aria-labelledby',view==='all'?'all-tab':'factor-tab');
  $('lineage-overview').hidden=view!=='lineage';
  if(view==='lineage'){lineageUI?.render();return;}
  $('category-filters').innerHTML=['すべて',...CATEGORIES].map(c=>`<button class="category-button ${category===c?'active':''}" data-category="${c}" aria-pressed="${category===c}">${c}</button>`).join('');
  const scopedRows=analysis.rows.filter(r=>(showExcluded||!r.excluded)&&(category==='すべて'||r.category===category)&&(!query||`${r.name} ${r.gold??''} ${r.ownerName??''} ${r.reason} ${r.priorityReason}`.toLowerCase().includes(query.toLowerCase()))&&(view==='all'||needsFactor({...r,excluded:false})||r.status==='event-check'));
  $('priority-filters').innerHTML=['all',1,2,3].map(level=>`<button class="priority-filter ${String(priorityFilter)===String(level)?'active':''}" data-priority="${level}" aria-pressed="${String(priorityFilter)===String(level)}">${level==='all'?'全優先度':`<span class="priority-code priority-code-${level}">${PRIORITIES[level]}</span>`}<span class="priority-count">${level==='all'?scopedRows.length:scopedRows.filter(r=>r.priority===level).length}</span></button>`).join('');
  const rows=scopedRows.filter(r=>priorityFilter==='all'||r.priority===Number(priorityFilter));
  $('result-count').textContent=course.confirmed?`${rows.length}件を表示 / 優先度順`:'詳細発表待ち';
  if(!course.confirmed)$('skill-list').innerHTML=`<div class="empty-state"><h3>コース詳細未発表</h3><p>発表済みの条件は「${course.surface}・${course.distanceType}」。コース確定後に推奨を追加します。</p><a href="${SOURCES.official.url}" target="_blank" rel="noopener noreferrer">公式スケジュール ↗</a></div>`;
  else if(view==='factor'&&!state.characterId)$('skill-list').innerHTML='<div class="empty-state"><h3>本育成のウマ娘と編成を選択</h3><p>自前スキルと編成を照合し、このレースで用意する継承・白因子を表示します。</p></div>';
  else if(!rows.length)$('skill-list').innerHTML='<div class="empty-state"><h3>該当するスキルはありません</h3><p>検索・カテゴリ・優先度を確認してください。</p></div>';
  else $('skill-list').innerHTML=rows.map(renderSkill).join('');
}

function renderSkill(row) {
  const key = escape(row.name);
  const routeText = [...row.goldRoutes.map(r => `${row.gold}：${r.label}`), ...row.routes.map(r => `${row.name}：${r.label}`)];
  const owner = row.ownerName ?? '取得元を資料で確認';
  const sourceKeys = [...new Set([...row.prioritySources, ...row.sources])].filter(id => {
    if (!SOURCES[id]) return false;
    if (analysis.course.id === '2026-11-loh' && (id.startsWith('december') || id === 'noteNakayama')) return false;
    if (analysis.course.id === '2026-12-cm' && (id.startsWith('november') || id.startsWith('noteKyoto'))) return false;
    return true;
  });
  const inheritanceDetails = row.inherited ? `<p><strong>継承元：</strong>${escape(owner)}</p><p>${row.sameCharacter ? '育成キャラと同じキャラのため、この衣装からの継承はできません。' : row.ownUnique ? '本体の固有・進化条件を確認してください。継承枠としての準備は不要です。' : '継承元の固有と、継承元・育成先の組み合わせを確認してください。'}</p>${row.evolvedInheritance ? '<p>継承進化には本人の所持と、直接の親からの継承が必要です。祖父母経由では進化できません。育成内の進化条件も満たしてください。</p>' : ''}` : '';
  const routeDetails = !row.inherited ? `<p><strong>この編成の取得候補</strong></p>${routeText.length ? `<ul>${routeText.map(t => `<li>${escape(t)}</li>`).join('')}</ul>` : '<p>登録された取得経路に見つかっていません。白因子・シナリオ・イベント経由を確認してください。</p>'}<p>ヒントは抽選、イベントは選択・成功・完走等の条件があります。金スキルは白因子から取得できません。</p>${row.status === 'manual' ? '<p>別経路で取得する予定として手動で補っています。</p>' : ''}` : '';
  return `<article class="skill-card ${row.prepared ? 'prepared' : ''} ${row.excluded ? 'excluded' : ''}" data-priority="${row.priority}">
    <div class="skill-main">
      <div class="skill-card-top"><span class="priority priority-${row.priority}">優先度 <strong>${PRIORITIES[row.priority]}</strong></span><span class="skill-category-label">${row.evolvedInheritance ? '継承進化' : row.category}</span></div>
      <h3 class="skill-title">${needsFactor(row)||row.status==='event-check'?`<button class="factor-link" data-factor-open="${key}" aria-label="${key}の因子周回を開く">${key}<span>↗</span></button>`:key}</h3>
      <p class="skill-reason">${escape(row.priorityReason)}</p>${row.status==='factor'?`<p class="factor-needed-reason">${escape(row.factorReason)}</p>`:''}
      ${row.conditionLabel ? `<p class="skill-condition">${escape(row.conditionLabel)}</p>` : ''}
      ${row.gold ? `<p class="gold-note"><span>上位：${escape(row.gold)}</span><span>${row.goldRoutes.length ? '取得候補あり' : '経路を確認'}</span></p>` : ''}
      ${row.inherited ? `<p class="skill-owner">${artwork(analysis.index.characters.get(row.ownerId))}<span>${escape(owner)}</span></p>` : ''}
      <div class="skill-state-row"><span class="route-badge route-${row.status}">${statusLabels[row.status]}</span>${['factor','inheritance'].includes(row.status) ? `<label class="prepare-checkbox"><input type="checkbox" data-prepared="${key}" ${row.prepared ? 'checked' : ''}> 準備済み</label>` : ''}</div>
    </div>
    ${needsFactor(row)||row.status==='event-check'?`<button class="factor-plan-button" data-factor-open="${key}">因子周回の編成・優先スキルを見る <span>↗</span></button>`:''}<details class="skill-details"><summary>条件・取得ルート・根拠</summary><div class="detail-content">
      <p><strong>発動・採用条件</strong></p><p>${escape(row.reason)}${row.note ? ` ${escape(row.note)}` : ''}</p>
      ${inheritanceDetails}${routeDetails}
      ${row.category === '加速' ? '<p>本体固有・進化の加速との重複を確認し、不要な補助加速は見送りに設定できます。</p>' : ''}
      <p class="priority-source-note">優先度は資料と発動条件を基にした取得時の目安です。編成を前提にした因子設計の順位は、そのまま取得優先度に転用していません。</p>
      <div class="source-links">${sourceKeys.map(id => `<a href="${SOURCES[id].url}" target="_blank" rel="noopener noreferrer">${escape(SOURCES[id].name)} ↗</a>`).join('')}</div>
      <div class="detail-actions">${!row.inherited ? `<button class="text-button" data-supplied="${key}">${state.supplied.includes(row.name) ? '別ルートの設定を解除' : '別ルートで取得する予定にする'}</button>` : '<span></span>'}<button class="text-button muted" data-excluded="${key}">${row.excluded ? '候補に戻す' : '今回は見送る'}</button></div>
    </div></details>
  </article>`;
}

function renderSaved() {
  $('saved-plans').innerHTML = state.plans.map((plan,i) => `<div class="saved-plan"><button data-load-plan="${i}">${escape(plan.label)}</button><button data-delete-plan="${i}" aria-label="保存プラン${i+1}を削除">×</button></div>`).join('');
}
function openPicker(kind,slot=0,context='main') {
  if(kind==='support'&&slot===FIXED_SUPPORT_SLOT)return;
  picker = {kind,slot,type:'すべて',context,distance:context==='main'?(analysis.course.distanceType??'すべて'):'すべて',style:context==='main'?state.style:'すべて',dirtOnly:context==='main'&&analysis.course.surface==='ダート',allUsage:context!=='main'};
  $('picker-title').textContent = `${context==='main'?'本育成':'因子周回'}：${kind === 'character' ? 'ウマ娘を選択' : `サポート ${slot+1} を選択`}`;
  $('picker-eyebrow').textContent = kind === 'character' ? 'SELECT TRAINEE' : 'BUILD YOUR DECK';
  $('picker-search').value = '';
  renderPicker(); $('picker-dialog').showModal(); $('picker-search').focus();
}
function renderPicker() {
  const kind = picker.kind;
  const text = $('picker-search').value.toLowerCase().replace(/[\s\[\]「」]/g,'');
  const profile=picker.context==='lineage'?lineageUI.profile():picker.context==='farming'?factorUI.profile():state;
  const char = analysis.index.characters.get(profile.characterId);
  const mainChar=analysis.index.characters.get(state.characterId);
  const selectedChars = new Set(profile.supports.filter((_,i) => i !== picker.slot).map(id => analysis.index.supports.get(id)?.characterId));
  const lineageExcluded=picker.context==='lineage'?lineageUI.excludedCharacters():new Set();
  const candidates = kind==='support'
    ? selectSupportCandidates(catalog.supports,{context:picker.context==='main'?'main':'farming',traineeCharacterId:char?.characterId,excludedCharacterIds:selectedChars,type:picker.type,query:text,usageIndex:supportUsage,
      usageFilter:picker.allUsage?null:{distance:picker.distance,style:picker.style,dirtOnly:picker.dirtOnly,surface:picker.dirtOnly?'ダート':analysis.course.surface}})
    : catalog.characters.filter(c=>(picker.context==='main'||c.characterId!==mainChar?.characterId)&&!lineageExcluded.has(c.characterId)&&c.name.toLowerCase().replace(/[\s\[\]「」]/g,'').includes(text)).sort((a,b)=>a.characterId-b.characterId||a.id-b.id);
  $('picker-results').classList.toggle('character-picker-grid',kind==='character');
  renderUsageFilters(kind==='support'&&picker.context==='main');
  $('picker-filters').innerHTML = kind === 'support' ? ['すべて','speed','stamina','power','guts','wit','friend','group'].map(type => `<button class="category-button ${picker.type === type ? 'active' : ''}" data-picker-type="${type}">${TYPE_LABELS[type] ?? type}</button>`).join('') : '';
  $('picker-results').innerHTML = `<p class="picker-summary">${candidates.length}件${kind === 'support' ? ` / ${picker.context==='main'?'SSRのみ':'SSR・SR・R'} / 実装日の新しい順` : ''}</p>` + candidates.map(c =>kind==='support'?renderSupportCandidate(c):`<button class="picker-result character-picker-result" data-pick="${c.id}">${artwork(c)}<span class="picker-result-name"><small>${escape(c.title)}</small><strong>${escape(c.characterName)}</strong></span></button>`).join('');
  if(!candidates.length)$('picker-results').innerHTML+='<p class="picker-empty">該当するカードはありません。種類・用途・検索条件を変更してください。</p>';
}

function renderUsageFilters(visible) {
  const container=$('picker-usage-filters');container.hidden=!visible;if(!visible){container.innerHTML='';return;}
  const chips=(values,axis,current)=>values.map(v=>`<button class="usage-chip ${!picker.allUsage&&v===current?'active':''}" data-usage-${axis}="${v}" aria-pressed="${!picker.allUsage&&v===current}">${v}</button>`).join('');
  container.innerHTML=`<div class="usage-filter-top"><strong>スキルの用途</strong><button class="usage-reset" data-usage-current>今回の条件に合わせる</button><button class="usage-all ${picker.allUsage?'active':''}" data-usage-all aria-pressed="${picker.allUsage}">全SSRを表示</button></div><div class="usage-axis" role="group" aria-label="サポカの距離・ダート"><span>距離</span><div>${chips(DISTANCES,'distance',picker.distance)}<button class="usage-chip usage-dirt ${picker.dirtOnly?'active':''}" data-usage-dirt aria-pressed="${picker.dirtOnly}">ダート</button></div></div><div class="usage-axis" role="group" aria-label="サポカの脚質"><span>脚質</span><div>${chips(RUN_STYLES,'style',picker.style)}</div></div><p class="usage-filter-note">汎用カードも含めて表示。金スキルの択を基準に分類し、所持ヒントは各カードで確認できます。</p>`;
}

function renderSupportCandidate(card) {
  const usage=supportUsage.get(card.id),skill=id=>analysis.index.skills.get(id);
  const allIds=usage.skillIds,gold=usage.goldSkillIds;
  const events=allIds.filter(id=>!gold.includes(id)&&!card.hintSkills.includes(id));
  const choices=card.events.filter(e=>e.selection==='single').flatMap(e=>e.choices.filter(c=>c.skills.some(id=>skill(id)?.rarity===2)));
  const list=(ids,descriptions=false)=>`<ul>${ids.map(id=>{const s=skill(id);return `<li><strong>${escape(s?.name??id)}</strong><span>${escape(targetLabel(s?.targets))}</span>${descriptions?`<p>${escape(s?.description??'')}</p>`:''}</li>`;}).join('')}</ul>`;
  return `<article class="support-picker-card"><button class="picker-result" data-pick="${card.id}">${artwork(card)}<span class="picker-result-name"><small>${escape(card.title)}</small><strong>${escape(card.characterName)}</strong><small>${escape((card.releaseDate??'実装日未登録').replaceAll('-','.'))} · ${card.rarity}</small><span class="support-usage-label">${escape(usage.label)}</span>${usage.hasDirt?'<span class="support-dirt-label">ダートスキルあり</span>':''}</span></button><details class="support-skill-details"><summary>対象スキルを見る</summary><div>${gold.length?'<h4>金スキル</h4>'+list(gold,true):''}${choices.length?'<h4>金スキルのイベント択</h4>'+choices.map(c=>'<p class="support-choice">'+escape(c.label)+'</p>').join(''):''}${usage.uncertain?'<p class="support-skill-note">金スキルの対象を優先した用途分類です。未登録のイベント択は取得元で確認してください。</p>':''}${card.hintSkills.length?'<h4>所持ヒント</h4>'+list(card.hintSkills):''}${events.length?'<h4>イベントの白スキル</h4>'+list(events):''}<a href="${escape(card.source)}" target="_blank" rel="noopener noreferrer">カード・イベントの取得元 ↗</a></div></details></article>`;
}
function openInfo(title, html) { $('info-title').textContent = title; $('info-content').innerHTML = html; $('info-dialog').showModal(); }
function showSources() {
  openInfo('データ・出典と判定の範囲', `<p>開催条件はCygamesの公式発表、推奨は各攻略資料を確認しています。スキル・編成の対応は非公式データベースに基づきます。</p><h3>データの範囲</h3><p>キャラ・サポカDB取得日 ${catalog.retrievedAt}。編成・開催確認日 ${MAIN_DECK_GUIDE.verifiedAt}。育成キャラ ${catalog.characters.length}衣装 / サポート ${catalog.supports.length}枚 / 詳細なイベント選択肢 ${catalog.supports.filter(s => s.events.length).length}枚。10月チャンミは含めません。1〜3月の未発表条件は推測しません。</p><h3>取得優先度について</h3><p>優先度は高・中・低の3段階です。コースと脚質に合うスキルを、発動条件・役割・取得Ptに対する効果を参考に分類しています。公式のランキングや勝率計算ではありません。</p><p>真髄・体の優先度「高」は消費分も走り切れる持久力の確保が前提です。noteの編成別因子優先度と、取得時の優先度は区別しています。同コースの過去開催資料は参考として明記しています。</p><h3>取得判定について</h3><ul><li>初期・最大覚醒Lvまでの自前スキル、育成キャラのイベント、サポートヒント・イベントを照合します。</li><li>本育成では金スキル側の択を優先します。因子周回の白スキル択は別の編成に保存し、本育成の取得経路には混ぜません。詳細未登録のイベントは要確認とします。</li><li>キャラの進化スキルは加速量などを自動比較しません。本体で足りるものは「今回は見送る」で調整してください。</li><li>本育成のシナリオ固有・共通イベント等は自動計上しません。「別ルートで取得する予定にする」で補えます。因子周回でURAを選んだ場合は、真髄・体／力／速の対決イベントを取得候補に加えます。</li><li>白因子候補は、この編成の登録済み取得経路に見つからない白スキルです。因子発動や取得を保証する表示ではありません。</li><li>推奨はすべてを必須とするものではありません。最終スタミナ、対戦相手、所持キャラに応じて判断してください。</li></ul><h3>参照元</h3>${Object.values(SOURCES).map(s => `<div class="source-row"><small>${escape(s.kind)}</small><a href="${s.url}" target="_blank" rel="noopener noreferrer">${escape(s.name)} ↗</a></div>`).join('')}<h3>保存と更新</h3><p>プランはこのブラウザーのlocalStorageに保存します。サーバーへの送信は行いません。ページを開くと公開済みの最新の編成・開催条件・スキル情報を取得し、本育成の編成と不足因子を更新します。「最新情報を更新」から再取得もできます。通信できない場合は前回の検証済みデータか同梱データを使います。攻略サイトの変更を直接自動判定する機能ではなく、確認して公開した更新データを反映します。</p><p>「ウマ娘 プリティーダービー」の権利は株式会社Cygames等の権利者に帰属します。本ツールは非公式です。キャラのゲーム内顔アイコンはウマ娘DB、サポカ画像はGameToraから取得し、個別画像を同梱しています。</p>`);
}
function download(name,text,type='text/plain;charset=utf-8') { const url = URL.createObjectURL(new Blob([text],{type})); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }

document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || !catalog) return;
  const d = button.dataset;
  if(d.factorOpen)factorUI.open(d.factorOpen);
  else if (d.course) { category='すべて'; priorityFilter='all'; update({courseId:d.course},{force:true}); }
  else if (d.style) update({style:d.style},{force:true});
  else if (d.slot !== undefined) openPicker('support',Number(d.slot));
  else if (d.remove !== undefined) { const supports=[...state.supports];supports[Number(d.remove)]=null;update({supports}); }
  else if (d.view) { view=d.view;renderResults(); }
  else if (d.priority !== undefined) { priorityFilter=d.priority;renderResults(); }
  else if (d.category) { category=d.category;renderResults(); }
  else if (d.pickerType) { picker.type=d.pickerType;renderPicker(); }
  else if (d.usageAll!==undefined) { picker.allUsage=true;picker.distance='すべて';picker.style='すべて';picker.dirtOnly=false;renderPicker(); }
  else if (d.usageCurrent!==undefined) { picker.allUsage=false;picker.distance=analysis.course.distanceType??'すべて';picker.style=state.style;picker.dirtOnly=analysis.course.surface==='ダート';renderPicker(); }
  else if (d.usageDistance!==undefined) { picker.distance=!picker.allUsage&&picker.distance===d.usageDistance?'すべて':d.usageDistance;picker.allUsage=false;renderPicker();document.querySelector('[data-usage-distance="'+d.usageDistance+'"]')?.focus(); }
  else if (d.usageStyle!==undefined) { picker.style=!picker.allUsage&&picker.style===d.usageStyle?'すべて':d.usageStyle;picker.allUsage=false;renderPicker();document.querySelector('[data-usage-style="'+d.usageStyle+'"]')?.focus(); }
  else if (d.usageDirt!==undefined) { picker.allUsage=false;picker.dirtOnly=!picker.dirtOnly;renderPicker(); }
  else if (d.pick) {
    const id=Number(d.pick);
    if(picker.context==='lineage'){if(picker.kind==='character')lineageUI.chooseCharacter(id);else lineageUI.chooseSupport(id,picker.slot);}
    else if(picker.context==='farming'){if(picker.kind==='character')factorUI.chooseCharacter(id);else factorUI.chooseSupport(id,picker.slot);}
    else if (picker.kind === 'character') { update({characterId:id},{chooseStyle:true,force:true});toast('キャラ・脚質・レースに合わせて編成しました。'); }
    else { const supports=[...state.supports];supports[picker.slot]=id;update({supports}); }
    $('picker-dialog').close();
  }
  else if (d.supplied) { update({supplied:toggle(state.supplied,d.supplied)});toast('取得予定を更新しました。'); }
  else if (d.excluded) update({excluded:toggle(state.excluded,d.excluded)});
  else if (d.loadPlan !== undefined) {const saved=state.plans[Number(d.loadPlan)];if(saved)update({...saved.state,mainDeck:{...saved.state.mainDeck,mode:'manual'},plans:state.plans},{preserve:true});toast('保存した編成を読み込みました。');}
  else if (d.deletePlan !== undefined) update({plans:state.plans.filter((_,i)=>i!==Number(d.deletePlan))});
});
document.addEventListener('change', event => {
  if (!catalog) return;
  const target=event.target;
  if(target.dataset.event)update({eventChoices:{...state.eventChoices,[target.dataset.event]:target.value}});
  else if(target.dataset.prepared)update({prepared:toggle(state.prepared,target.dataset.prepared)});
});
$('character-picker').addEventListener('click',()=>openPicker('character'));
$('main-deck-apply').addEventListener('click',()=>{update({},{force:true});toast('現在の推奨編成をセットしました。');});
$('refresh-data').addEventListener('click',refreshLiveData);
$('skill-search').addEventListener('input',e=>{query=e.target.value;renderResults();});
$('picker-search').addEventListener('input',renderPicker);
$('show-excluded').addEventListener('change',e=>{showExcluded=e.target.checked;renderResults();});
$('close-picker').addEventListener('click',()=>$('picker-dialog').close());
$('close-info').addEventListener('click',()=>$('info-dialog').close());
for(const id of ['sources-button','footer-sources'])$(id).addEventListener('click',showSources);
$('help-button').addEventListener('click',()=>openInfo('使い方', '<h3>1. コースと育成条件を選ぶ</h3><p>上の開催予定からコースを選び、育成する衣装・作戦を設定します。</p><h3>2. 自動編成を確認する</h3><p>キャラ・脚質・レースを選ぶと推奨編成をセットします。自前の覚醒と併用制限を反映し、6枠目はSSRたづなで固定。各枠は手動変更でき、「推奨に戻す」で再設定できます。金スキルを優先し、金と引き換えになる白スキル択は本育成の取得経路に含めません。</p><h3>3. 継承・因子の準備を確認する</h3><p>「必要な継承・白因子」で、編成にない白スキルと継承元を確認します。因子名をタップすると、因子周回のキャラ・サポート編成・イベント択・優先スキルを別に設定できます。シナリオ等で取れるものは「別ルートで取得」、不要な加速などは「今回は見送る」に設定できます。</p><h3>4. 保存する</h3><p>準備できたものにチェックし、リストをコピー。複数プランの保存とJSONでの持ち運びもできます。スマートフォンはブラウザーの「ホーム画面に追加」からアプリとして使えます。</p>'));
$('copy-checklist').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(checklistText());toast('チェックリストをコピーしました。');}catch{download('umaplan-checklist.txt',checklistText());toast('コピーできなかったため、テキストで保存しました。');}});
$('download-checklist').addEventListener('click',()=>download('umaplan-checklist.txt',checklistText()));
$('save-plan').addEventListener('click',()=>{const char=analysis.index.characters.get(state.characterId);const {plans,...snapshot}=state;const label=`${analysis.course.month}月 ${analysis.course.venue??'未定'} / ${char?.characterName??'キャラ未選択'} / ${state.style}`;update({plans:[{label,state:snapshot},...plans].slice(0,20)});toast('プランを保存しました（最大20件）。');});
$('export-json').addEventListener('click',()=>download('umaplan-plans.json',JSON.stringify({app:'umaplan',version:2,state},null,2),'application/json'));
$('import-json').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>3_000_000)throw new Error('large');const raw=JSON.parse(await file.text());if(raw.app!=='umaplan'||![1,2].includes(raw.version)||!raw.state)throw new Error('format');update({...raw.state,mainDeck:{...raw.state.mainDeck,mode:'manual'}},{preserve:true});toast('保存した編成を読み込みました。');}catch{toast('UMAPLANで書き出した有効なJSONを選んでください。');}finally{event.target.value='';}});
$('reset-plan').addEventListener('click',()=>{update({...structuredClone(DEFAULT_STATE),courseId:state.courseId,plans:state.plans});toast('現在の編成をリセットしました。保存プランは保持しています。');});
$('sample-button').addEventListener('click',()=>{update({characterId:107601,style:'差し',eventChoices:{},supplied:[],prepared:[],excluded:[]},{force:true});toast('操作例を入力しました。イベントの選択予定も設定できます。');});
for(const id of ['picker-dialog','info-dialog'])$(id).addEventListener('click',event=>{if(event.target===$(id)){const rect=$(id).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$(id).close();}});

async function boot() {
  const startupButtons=[...document.querySelectorAll('button')];
  startupButtons.forEach(button=>button.disabled=true);
  $('skill-list').innerHTML='<p class="loading">データを読み込んでいます…</p>';
  try {
    const response=await fetch(new URL('./data/catalog.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    catalog=await response.json();
    Object.assign(SOURCES,MAIN_DECK_GUIDE.sources);
    const live=await loadLiveData(catalog,{storage:liveStorage});
    if(live.data)applyLiveData(live.data);liveSource=live.source;
    supportUsage=createSupportUsageIndex(catalog);
    let saved;try{saved=JSON.parse(localStorage.getItem(STORE)??'null');}catch{saved=null;}
    state=normalizeState(saved,catalog);
    state=applyMainDeck(state,catalog,MAIN_DECK_GUIDE);persist();
    factorUI=createFactorUI({catalog,getState:()=>state,update,openPicker});
    lineageUI=createLineageUI({catalog,getState:()=>state,update,openPicker,openFactor:name=>factorUI.open(name)});
    tierUI=createTierUI({catalog,getCourse:()=>analysis.course,getCharacterId:()=>state.characterId,onSelect:(characterId,style)=>{
      const old=state.supports.filter(Boolean).length;
      update({characterId,style},{force:true});
      toast(state.supports.filter(Boolean).length<old?'本育成に選択しました。本人のサポートは編成から外しました。':'本育成のウマ娘と作戦を選択しました。');
    }});
    startupButtons.forEach(button=>button.disabled=false);render();
    if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  } catch(error) { $('skill-list').innerHTML='<div class="empty-state"><h3>データを読み込めませんでした</h3><p>接続を確認してページを再読み込みしてください。ローカルで使う場合は、npm startで起動します。</p></div>';console.error(error); }
}
boot();
