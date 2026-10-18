import { COURSES, STYLES, CATEGORIES, SOURCES, VERIFIED_AT } from './recommendations.js';
import { DEFAULT_STATE, normalizeState, analyze, TYPE_LABELS, PRIORITIES, exportChecklist } from './engine.js';

const $ = id => document.getElementById(id);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE = 'umaplan.v1';
const glyph = { '加速':'↗', '速度':'»', '緑スキル':'✦', '回復':'+', '継承':'◇' };
const statusLabels = { factor:'白因子で補う候補', inheritance:'親から継承', available:'編成から取得候補', manual:'別ルートで取得', 'own-unique':'本体固有・継承不要', 'event-check':'イベント条件を確認', incompatible:'同キャラの継承不可' };
let catalog, state, analysis;
let view = 'all', category = 'すべて', query = '', showExcluded = false;
let picker = { kind:'character', slot:0, type:'すべて' };
let toastTimer;

function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4300); }
function persist() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { toast('保存できませんでした。JSON書き出しでプランを保管してください。'); } }
function update(patch = {}) { state = normalizeState({ ...state, ...patch }, catalog); persist(); render(); }
function toggle(array, value) { return array.includes(value) ? array.filter(v => v !== value) : [...array, value]; }

function render() {
  analysis = analyze(state, catalog);
  renderCourses(); renderSetup(); renderResults(); renderSaved();
}
function renderCourses() {
  const c = analysis.course;
  $('course-tabs').innerHTML = COURSES.map(course => `<button class="course-tab ${course.id === c.id ? 'active' : ''} ${course.confirmed ? '' : 'pending'}" data-course="${course.id}" aria-pressed="${course.id === c.id}"><span class="course-tab-top"><span class="course-month">${course.month}<small>${course.year}</small></span><span class="tag ${course.type === 'LoH' ? 'tag-loh' : 'tag-cm'}">${course.type}</span></span><strong>${course.confirmed ? `${course.venue} ${course.surface}${course.distance.toLocaleString()}m` : `${course.surface}・${course.distanceType}`}</strong><span class="course-tab-bottom">${course.confirmed ? '<span class="status-dot"></span>コース確定' : 'コース詳細発表待ち'}<span> / ${course.date}</span></span></button>`).join('');
  $('course-banner').classList.toggle('pending-banner', !c.confirmed);
  $('course-banner').innerHTML = c.confirmed ? `<div><p class="banner-caption">${c.year}.${c.month} <span aria-hidden="true">/</span> ${escape(c.title)}</p><div class="banner-title"><h2>${c.venue}</h2><strong>${c.distance.toLocaleString()}<small>m</small></strong><span class="condition">${c.surface}・${c.distanceType}</span></div><div class="banner-conditions">${[c.turn,c.season,c.weather === 'ランダム' ? '天候ランダム' : c.weather,c.going === 'ランダム' ? 'バ場ランダム' : c.going,c.time,`${c.runners}人立て`].map(v => `<span class="condition">${escape(v)}</span>`).join('')}</div></div><div class="banner-aside"><p>${escape(c.summary)}</p><a href="${SOURCES.official.url}" target="_blank" rel="noopener noreferrer">公式の開催条件を見る ↗</a></div>` : `<div><p class="banner-caption">${c.year}.${c.month} / ${escape(c.date)}</p><div class="banner-title"><h2>コース詳細の発表待ち</h2></div><div class="banner-conditions"><span class="condition">${c.type}</span><span class="condition">${c.surface}・${c.distanceType}</span>${c.rule ? `<span class="condition">${c.rule}</span>` : ''}</div></div><div class="banner-aside"><p>競馬場・距離が未発表のため、コース別スキルの推奨は保留しています。</p><a href="${SOURCES.official.url}" target="_blank" rel="noopener noreferrer">公式スケジュール ↗</a></div>`;
}
function renderSetup() {
  const char = analysis.index.characters.get(state.characterId);
  $('character-label').textContent = char?.name ?? 'ウマ娘を選択';
  const aptitude = char?.aptitude;
  const styleIndex = STYLES.indexOf(state.style) + 6;
  $('character-note').textContent = char ? `初期適性：長距離 ${aptitude?.[5] ?? '不明'} / ${state.style} ${aptitude?.[styleIndex] ?? '不明'}。適性の改造は別途判断してください。` : 'キャラを選ぶと、自前の取得スキルを照合します。';
  const maxLevel = char ? char.awakening.length + 1 : 5;
  $('awakening').innerHTML = Array.from({length:maxLevel}, (_,i) => `<option value="${i+1}" ${state.awakening === i+1 ? 'selected' : ''}>Lv ${i+1}</option>`).join('');
  $('style-buttons').innerHTML = STYLES.map(style => `<button class="style-button ${style === state.style ? 'active' : ''}" data-style="${style}" aria-pressed="${style === state.style}">${style}</button>`).join('');
  $('support-count').textContent = `${state.supports.filter(Boolean).length} / 6`;
  $('support-slots').innerHTML = state.supports.map((id,i) => {
    const support = analysis.index.supports.get(id);
    const events = support?.events.filter(e => e.selection === 'single') ?? [];
    return `<div class="support-slot"><div class="support-slot-main"><span class="slot-number">${String(i+1).padStart(2,'0')}</span><span class="slot-type ${support ? 'type-'+support.type : ''}" aria-hidden="true">${support ? TYPE_LABELS[support.type]?.[0] ?? '他' : '+'}</span><button class="slot-select" data-slot="${i}" aria-label="サポート${i+1}を選択">${support ? `<span class="slot-title">${escape(support.title)} <span>${support.rarity}</span></span><strong>${escape(support.characterName)}</strong>` : `<strong class="empty-title">サポートを選択${i === 5 ? ' / レンタル' : ''}</strong>`}</button>${support ? `<button class="remove-support" data-remove="${i}" aria-label="サポート${i+1}を外す">×</button>` : ''}</div>${events.map(event => `<div class="event-choices"><label for="${event.id}">イベントの選択予定</label><select id="${event.id}" data-event="${event.id}" aria-label="${escape(support.characterName)} ${escape(event.label)}"><option value="">未指定（択のスキルは計上しない）</option>${event.choices.map(choice => `<option value="${escape(choice.id)}" ${state.eventChoices[event.id] === choice.id ? 'selected' : ''}>${escape(choice.label)}</option>`).join('')}</select></div>`).join('')}</div>`;
  }).join('');
}
function renderResults() {
  const { counts, course } = analysis;
  $('stats').innerHTML = [['取得候補',counts.all],['編成・自前のルート',counts.available],['白因子で補う候補',counts.factor],['継承候補',counts.inheritance]].map(([label,n]) => `<div class="stat"><span class="stat-label">${label}</span><strong class="stat-number">${n}<small>件</small></strong></div>`).join('');
  const blanks = state.supports.filter(s => !s).length;
  $('results-notice').innerHTML = `<span class="notice-dot">•</span><span>${!course.confirmed ? 'コース未確定のため、推奨・不足判定は表示しません。' : blanks || !state.characterId ? `育成キャラ${!state.characterId ? 'は未選択' : 'を選択済み'}・サポート${6-blanks}/6枠。選択に合わせて因子候補が絞られます。` : '取得候補はヒント・イベントの発生を確約しません。シナリオ経由は各スキルの「別ルートで取得」で補えます。'}</span>`;
  $('todo-count').textContent = counts.factor + counts.inheritance;
  document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-selected', String(button.dataset.view === view)); });
  $('category-filters').innerHTML = ['すべて',...CATEGORIES].map(c => `<button class="category-button ${category === c ? 'active' : ''}" data-category="${c}" aria-pressed="${category === c}">${c}</button>`).join('');
  const rows = analysis.rows.filter(r => (showExcluded || !r.excluded) && (category === 'すべて' || r.category === category) && (!query || `${r.name} ${r.gold ?? ''} ${r.ownerName ?? ''} ${r.reason}`.toLowerCase().includes(query.toLowerCase())) && (view === 'all' || ['factor','inheritance'].includes(r.status)));
  $('result-count').textContent = course.confirmed ? `${rows.length}件を表示 / 優先度順` : '詳細発表待ち';
  if (!course.confirmed) $('skill-list').innerHTML = `<div class="empty-state"><span class="empty-icon">◇</span><h3>コースが決まったら、準備を。</h3><p>現在発表されているのは「${course.surface}・${course.distanceType}」。競馬場や距離が判明した時点で、対応コースと推奨データを追加できます。</p><a href="${SOURCES.official.url}" target="_blank" rel="noopener noreferrer">公式の予定を確認する ↗</a></div>`;
  else if (!rows.length) $('skill-list').innerHTML = `<div class="empty-state"><span class="empty-icon">✓</span><h3>該当するスキルはありません</h3><p>検索・カテゴリ・見送り設定を確認してください。</p></div>`;
  else $('skill-list').innerHTML = rows.map(renderSkill).join('');
}
function renderSkill(row) {
  const key = escape(row.name);
  const routeText = [...row.goldRoutes.map(r => `${row.gold}：${r.label}`), ...row.routes.map(r => `${row.name}：${r.label}`)];
  const owner = row.ownerName ?? '取得元を資料で確認';
  const goldText = row.gold ? row.goldRoutes.length ? `金：${row.gold}の取得候補あり` : `金：${row.gold}は取得経路を要確認（白因子では補えません）` : '';
  return `<article class="skill-card ${row.prepared ? 'prepared' : ''} ${row.excluded ? 'excluded' : ''}"><div class="skill-main"><span class="skill-icon category-${row.category}" aria-hidden="true">${glyph[row.category]}</span><div class="skill-body"><div class="skill-title-line"><h3 class="skill-title">${key}</h3><span class="priority priority-${row.priority}">${PRIORITIES[row.priority]}</span></div><p class="skill-reason">${escape(row.reason)}${row.note ? ` <strong>${escape(row.note)}</strong>` : ''}</p>${goldText ? `<p class="gold-note">${escape(goldText)}</p>` : ''}<div class="skill-category"><span>${row.evolvedInheritance ? '継承進化' : row.category}</span>${row.inherited ? `<span>${escape(owner)}</span>` : ''}</div></div><div class="skill-status"><span class="route-badge route-${row.status}">${statusLabels[row.status]}</span>${['factor','inheritance'].includes(row.status) ? `<label class="prepare-checkbox"><input type="checkbox" data-prepared="${key}" ${row.prepared ? 'checked' : ''}> 準備済み</label>` : ''}</div></div><details class="skill-details"><summary>取得ルート・採用条件</summary><div class="detail-content">${row.inherited ? `<p>継承元：${escape(owner)}。${row.sameCharacter ? '育成キャラと同じキャラのため、この衣装からの継承はできません。' : row.ownUnique ? '本体の固有・進化条件を確認してください。継承枠としての準備は不要です。' : '継承元の固有と、継承元・育成先の組み合わせを確認してください。'}</p>${row.evolvedInheritance ? '<p>継承進化には該当ウマ娘本人の所持と、直接の親からの継承が必要です。祖父母経由では進化できません。育成内の進化条件も満たしてください。</p>' : ''}` : `<p>${routeText.length ? 'この編成で見つかった取得候補：' : '選択中のキャラ・編成に取得経路が見つかっていません。白因子やシナリオ・イベント経由を確認してください。'}</p>${routeText.length ? `<ul>${routeText.map(t => `<li>${escape(t)}</li>`).join('')}</ul>` : ''}<p>所持ヒントは抽選です。イベントは選択肢・成功・完走などの条件があります。</p>${row.status === 'manual' ? '<p>シナリオなどの別経路で取得する予定として、手動で補っています。</p>' : ''}`}${row.category === '加速' ? '<p>主加速と補助加速をすべて積む必要はありません。本体固有や進化の加速を確認して、不要な候補は見送れます。</p>' : ''}<div class="source-links">${[...new Set(row.sources)].filter(id => SOURCES[id]).map(id => `<a href="${SOURCES[id].url}" target="_blank" rel="noopener noreferrer">${id === 'database' ? 'スキルDB' : id === 'november' ? '11月解説' : id === 'december' ? '12月解説' : id === 'inheritance' ? '継承条件' : SOURCES[id].name.split('｜')[0]} ↗</a>`).join('')}</div><div class="detail-actions">${!row.inherited ? `<button class="text-button" data-supplied="${key}">${state.supplied.includes(row.name) ? '別ルートの設定を解除' : '別ルートで取得する予定にする'}</button>` : '<span></span>'}<button class="text-button muted" data-excluded="${key}">${row.excluded ? '候補に戻す' : '今回は見送る'}</button></div></div></details></article>`;
}
function renderSaved() {
  $('saved-plans').innerHTML = state.plans.map((plan,i) => `<div class="saved-plan"><button data-load-plan="${i}">${escape(plan.label)}</button><button data-delete-plan="${i}" aria-label="保存プラン${i+1}を削除">×</button></div>`).join('');
}
function openPicker(kind,slot=0) {
  picker = {kind,slot,type:'すべて'};
  $('picker-title').textContent = kind === 'character' ? '育成ウマ娘を選択' : `サポート ${slot+1} を選択`;
  $('picker-eyebrow').textContent = kind === 'character' ? 'SELECT TRAINEE' : 'BUILD YOUR DECK';
  $('picker-search').value = '';
  renderPicker(); $('picker-dialog').showModal(); $('picker-search').focus();
}
function renderPicker() {
  const kind = picker.kind;
  const text = $('picker-search').value.toLowerCase().replace(/[\s\[\]「」]/g,'');
  const char = analysis.index.characters.get(state.characterId);
  const selectedChars = new Set(state.supports.filter((_,i) => i !== picker.slot).map(id => analysis.index.supports.get(id)?.characterId));
  const candidates = (kind === 'character' ? catalog.characters : catalog.supports).filter(c => (kind !== 'support' || (!selectedChars.has(c.characterId) && c.characterId !== char?.characterId)) && (picker.type === 'すべて' || c.type === picker.type) && c.name.toLowerCase().replace(/[\s\[\]「」]/g,'').includes(text));
  candidates.sort((a,b) => a.characterName.localeCompare(b.characterName,'ja') || (b.rarity ?? '').localeCompare(a.rarity ?? '') || a.id-b.id);
  $('picker-filters').innerHTML = kind === 'support' ? ['すべて','speed','stamina','power','guts','wit','friend','group'].map(type => `<button class="category-button ${picker.type === type ? 'active' : ''}" data-picker-type="${type}">${TYPE_LABELS[type] ?? type}</button>`).join('') : '';
  $('picker-results').innerHTML = `<p class="picker-summary">${candidates.length}件${kind === 'support' ? ' / 併用できないカードは除外' : ''}</p>` + candidates.map(c => `<button class="picker-result" data-pick="${c.id}">${kind === 'support' ? `<span class="slot-type type-${c.type}">${TYPE_LABELS[c.type]?.[0] ?? '他'}</span>` : '<span class="slot-type">U</span>'}<span class="picker-result-name"><small>${escape(c.title)}</small><strong>${escape(c.characterName)}</strong></span>${kind === 'support' ? `<span class="picker-result-rarity">${c.rarity}</span>` : ''}</button>`).join('');
}
function openInfo(title, html) { $('info-title').textContent = title; $('info-content').innerHTML = html; $('info-dialog').showModal(); }
function showSources() {
  openInfo('データ・出典と判定の範囲', `<p>開催条件はCygamesの公式発表、推奨は各攻略資料を確認しています。スキル・編成の対応は非公式データベースに基づきます。</p><h3>データの範囲</h3><p>取得日 ${VERIFIED_AT}。育成キャラ ${catalog.characters.length}衣装 / サポート ${catalog.supports.length}枚 / 詳細なイベント選択肢 ${catalog.supports.filter(s => s.events.length).length}枚。10月チャンミは含めません。1〜3月の未発表条件は推測しません。</p><h3>取得判定について</h3><ul><li>初期・選択した覚醒Lvまでの自前スキル、育成キャラのイベント、サポートヒント・イベントを照合します。</li><li>詳細データがあるイベントは選択予定の択だけ計上します。それ以外は「イベント条件を確認」と表示します。</li><li>キャラの進化スキルは加速量などを自動比較しません。本体で足りるものは「今回は見送る」で調整してください。</li><li>シナリオ固有・共通イベント等は自動計上しません。各スキルの「別ルートで取得する予定にする」で補えます。</li><li>白因子候補は、この編成の登録済み取得経路に見つからない白スキルです。因子発動や取得を保証する表示ではありません。</li><li>推奨はすべてを必須とするものではありません。最終スタミナ、対戦相手、所持キャラに応じて判断してください。</li></ul><h3>参照元</h3>${Object.values(SOURCES).map(s => `<div class="source-row"><small>${escape(s.kind)}</small><a href="${s.url}" target="_blank" rel="noopener noreferrer">${escape(s.name)} ↗</a></div>`).join('')}<h3>保存と更新</h3><p>プランはこのブラウザーのlocalStorageに保存します。サーバーへの送信は行いません。データや開催条件は自動追従しません。GitHub上のデータ更新を反映してください。</p><p>「ウマ娘 プリティーダービー」の権利は株式会社Cygames等の権利者に帰属します。本ツールは非公式です。</p>`);
}
function download(name,text,type='text/plain;charset=utf-8') { const url = URL.createObjectURL(new Blob([text],{type})); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }

document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || !catalog) return;
  const d = button.dataset;
  if (d.course) { category='すべて'; update({courseId:d.course}); }
  else if (d.style) update({style:d.style});
  else if (d.slot !== undefined) openPicker('support',Number(d.slot));
  else if (d.remove !== undefined) { const supports=[...state.supports];supports[Number(d.remove)]=null;update({supports}); }
  else if (d.view) { view=d.view;renderResults(); }
  else if (d.category) { category=d.category;renderResults(); }
  else if (d.pickerType) { picker.type=d.pickerType;renderPicker(); }
  else if (d.pick) {
    const id=Number(d.pick);
    if (picker.kind === 'character') { const old=state.supports.filter(Boolean).length;update({characterId:id});if(state.supports.filter(Boolean).length<old)toast('育成キャラ本人のサポートを編成から外しました。'); }
    else { const supports=[...state.supports];supports[picker.slot]=id;update({supports}); }
    $('picker-dialog').close();
  }
  else if (d.supplied) { update({supplied:toggle(state.supplied,d.supplied)});toast('取得予定を更新しました。'); }
  else if (d.excluded) update({excluded:toggle(state.excluded,d.excluded)});
  else if (d.loadPlan !== undefined) {const saved=state.plans[Number(d.loadPlan)];if(saved)update({...saved.state,plans:state.plans});toast('プランを読み込みました。');}
  else if (d.deletePlan !== undefined) update({plans:state.plans.filter((_,i)=>i!==Number(d.deletePlan))});
});
document.addEventListener('change', event => {
  if (!catalog) return;
  const target=event.target;
  if(target.dataset.event)update({eventChoices:{...state.eventChoices,[target.dataset.event]:target.value}});
  else if(target.dataset.prepared)update({prepared:toggle(state.prepared,target.dataset.prepared)});
});
$('character-picker').addEventListener('click',()=>openPicker('character'));
$('awakening').addEventListener('change',e=>update({awakening:Number(e.target.value)}));
$('skill-search').addEventListener('input',e=>{query=e.target.value;renderResults();});
$('picker-search').addEventListener('input',renderPicker);
$('show-excluded').addEventListener('change',e=>{showExcluded=e.target.checked;renderResults();});
$('close-picker').addEventListener('click',()=>$('picker-dialog').close());
$('close-info').addEventListener('click',()=>$('info-dialog').close());
for(const id of ['sources-button','footer-sources'])$(id).addEventListener('click',showSources);
$('help-button').addEventListener('click',()=>openInfo('使い方', '<h3>1. コースと育成条件を選ぶ</h3><p>上の開催予定からコースを選び、育成する衣装・覚醒Lv・作戦を設定します。</p><h3>2. サポートを6枚選ぶ</h3><p>イベントの選択予定があるカードは、今回取りたい択を指定します。「未指定」の択のスキルは取得経路に含めません。</p><h3>3. 継承・因子の準備を確認する</h3><p>「継承・因子の準備」タブで、編成にない白スキルと継承元を確認します。シナリオ等で取れるものは「別ルートで取得」、不要な加速などは「今回は見送る」に設定できます。</p><h3>4. 保存する</h3><p>準備できたものにチェックし、リストをコピー。複数プランの保存とJSONでの持ち運びもできます。スマートフォンはブラウザーの「ホーム画面に追加」からアプリとして使えます。</p>'));
$('copy-checklist').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(exportChecklist(state,analysis));toast('チェックリストをコピーしました。');}catch{download('umaplan-checklist.txt',exportChecklist(state,analysis));toast('コピーできなかったため、テキストで保存しました。');}});
$('download-checklist').addEventListener('click',()=>download('umaplan-checklist.txt',exportChecklist(state,analysis)));
$('save-plan').addEventListener('click',()=>{const char=analysis.index.characters.get(state.characterId);const {plans,...snapshot}=state;const label=`${analysis.course.month}月 ${analysis.course.venue??'未定'} / ${char?.characterName??'キャラ未選択'} / ${state.style}`;update({plans:[{label,state:snapshot},...plans].slice(0,20)});toast('プランを保存しました（最大20件）。');});
$('export-json').addEventListener('click',()=>download('umaplan-plans.json',JSON.stringify({app:'umaplan',version:1,state},null,2),'application/json'));
$('import-json').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>3_000_000)throw new Error('large');const raw=JSON.parse(await file.text());if(raw.app!=='umaplan'||raw.version!==1||!raw.state)throw new Error('format');update(raw.state);toast('プランを読み込みました。');}catch{toast('UMAPLANで書き出した有効なJSONを選んでください。');}finally{event.target.value='';}});
$('reset-plan').addEventListener('click',()=>{update({...structuredClone(DEFAULT_STATE),courseId:state.courseId,plans:state.plans});toast('現在の編成をリセットしました。保存プランは保持しています。');});
$('sample-button').addEventListener('click',()=>{update({characterId:107601,style:'差し',awakening:5,supports:[30317,30304,30306,30302,30287,30305],eventChoices:{},supplied:[],prepared:[],excluded:[]});toast('操作例を入力しました。イベントの選択予定も設定できます。');});
for(const id of ['picker-dialog','info-dialog'])$(id).addEventListener('click',event=>{if(event.target===$(id)){const rect=$(id).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$(id).close();}});

async function boot() {
  $('skill-list').innerHTML='<p class="loading">データを読み込んでいます…</p>';
  try {
    const response=await fetch(new URL('./data/catalog.json',import.meta.url));if(!response.ok)throw new Error(`HTTP ${response.status}`);
    catalog=await response.json();
    let saved;try{saved=JSON.parse(localStorage.getItem(STORE)??'null');}catch{saved=null;}
    state=normalizeState(saved,catalog);render();
    if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  } catch(error) { $('skill-list').innerHTML='<div class="empty-state"><h3>データを読み込めませんでした</h3><p>接続を確認してページを再読み込みしてください。ローカルで使う場合は、npm startで起動します。</p></div>';console.error(error); }
}
boot();
