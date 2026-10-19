import { getCourseTier, TIER_LABELS, TIER_ORDER, TIER_SOURCES, TIER_VERIFIED_AT } from './character-tiers.js';
import { artwork, escape } from './ui.js';

export function createTierUI({catalog,getCourse,getCharacterId,onSelect}) {
  const $=id=>document.getElementById(id);
  const dialog=$('tier-dialog'), trigger=$('tier-button');
  const characters=new Map(catalog.characters.map(c=>[c.id,c]));
  const courseLabel=c=>c.month+'月 '+c.type+' / '+c.venue+' 芝'+c.distance.toLocaleString()+'m';
  const sourceLink=(id,note)=>'<a href="'+escape(TIER_SOURCES[id].url)+'" target="_blank" rel="noopener noreferrer">'+escape(TIER_SOURCES[id].name)+' ↗</a>'+(note?'<span>'+escape(note)+'</span>':'');
  function card(entry) {
    const char=characters.get(entry.characterId);
    const selected=char.id===getCharacterId();
    return '<details class="tier-card '+(selected?'tier-card-selected':'')+'" name="tier-character">'+
      '<summary aria-label="'+escape(char.characterName)+'（'+escape(entry.costume)+'）の評価理由・出典">'+
      artwork(char)+'<strong>'+escape(char.characterName)+'</strong><span class="tier-costume">'+escape(entry.costume)+'</span>'+
      '<span class="tier-style">'+entry.styles.join(' / ')+(selected?' · 選択中':'')+'</span><span class="tier-more">理由・出典 <span aria-hidden="true">＋</span></span></summary>'+
      '<div class="tier-card-detail"><p class="tier-full-title">'+escape(char.title)+'</p><p>'+escape(entry.reason)+'</p>'+
      '<p class="tier-caution">'+escape(entry.caution)+'</p>'+(entry.mixed?'<span class="tier-mixed">資料間で評価差あり</span>':'')+(entry.limitedEvidence?'<span class="tier-mixed">比較資料が少ない候補</span>':'')+
      '<ul class="tier-opinions">'+entry.opinions.map(o=>'<li>'+sourceLink(o.source,o.note)+'</li>').join('')+'</ul>'+
      entry.styles.map(style=>'<button class="tier-select" data-tier-character="'+char.id+'" data-tier-style="'+style+'">'+style+'で本育成に選ぶ</button>').join('')+
      '</div></details>';
  }
  function renderTrigger() {
    const c=getCourse(),board=getCourseTier(c);
    const published=board?.status==='published';
    const pending=board?.status==='withheld'?'評価保留':c.confirmed?'このコースは調査待ち':'コース詳細発表待ち';
    trigger.innerHTML='<span class="tier-trigger-title"><span class="tier-trigger-symbol" aria-hidden="true">S<span>A B</span></span><span><strong>有力ウマTier</strong><small>'+
      (published?c.venue+' '+c.distance.toLocaleString()+'m · '+board.entries.length+'衣装':pending)+
      '</small></span></span><span class="tier-trigger-arrow" aria-hidden="true">↗</span>';
    trigger.setAttribute('aria-label',published?'有力ウマTier：'+c.venue+c.distance+'mの'+board.entries.length+'衣装を見る':'有力ウマTier：'+pending);
    if(dialog.open)renderDialog();
  }
  function renderDialog() {
    const c=getCourse(),board=getCourseTier(c);
    $('tier-course').textContent=board?courseLabel(c):c.month+'月 '+c.type;
    if(!board) {
      $('tier-content').innerHTML=c.confirmed?'<div class="tier-pending"><h3>このコースは調査待ち</h3><p>現在の開催条件に対応するTierはまだ掲載していません。</p></div>':'<div class="tier-pending"><h3>コース詳細発表待ち</h3><p>競馬場・距離が未発表のため、有力ウマのTierはまだ掲載していません。</p></div>';
      return;
    }
    if(board.status==='withheld') {
      $('tier-content').innerHTML='<div class="tier-pending"><h3>評価保留</h3><p>'+escape(board.pendingReason)+'</p><p>'+escape(board.pendingDetail)+'</p></div>';
      return;
    }
    $('tier-content').innerHTML='<div class="tier-intro"><div class="tier-meta"><span>'+board.entries.length+'衣装 · '+board.sourceIds.length+
      '資料</span><span>確認 '+TIER_VERIFIED_AT.replaceAll('-','.')+' · 暫定</span></div>'+
      '<p class="tier-editorial">note 2名＋ウマ娘ラボを比較したUMAPLANの編集評価。同Tierは順不同。</p></div>'+
      '<table class="tier-table"><caption>顔アイコンを押すと、評価理由・出典・本育成への選択を表示</caption><tbody>'+
      TIER_ORDER.map(tier=>'<tr class="tier-row tier-row-'+tier.toLowerCase()+'"><th scope="row"><strong>'+tier+'</strong><span>'+TIER_LABELS[tier]+
        '</span></th><td><div class="tier-cards">'+board.entries.filter(e=>e.tier===tier).map(card).join('')+'</div></td></tr>').join('')+
      '</tbody></table><div class="tier-bottom"><p class="tier-disagreement">'+escape(board.context)+' '+escape(board.disagreement)+
      '</p><details class="tier-sources"><summary>参照した攻略情報・公開日（'+board.sourceIds.length+'資料）</summary><p>今回の開催を対象とする公開記事のみを参照。更新日の新しさだけで採用せず、本文の対象・衣装を確認。自動更新ではありません。</p>'+
      board.sourceIds.map(id=>{const s=TIER_SOURCES[id];return '<div>'+sourceLink(id)+'<small>'+escape(s.title)+'</small><small>公開 '+escape(s.publishedAt)+' / 内容の基準日 '+escape(s.contentAsOf)+' / '+escape(s.scope)+'</small><p>'+escape(s.note)+'</p></div>';}).join('')+
      '</details></div>';
  }
  trigger.addEventListener('click',()=>{renderDialog();dialog.showModal();});
  $('close-tier').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-tier-character]');
    if(button) {
      const board=getCourseTier(getCourse());
      const entry=board?.entries.find(e=>e.characterId===Number(button.dataset.tierCharacter));
      if(entry&&entry.styles.includes(button.dataset.tierStyle)) {
        const style=button.dataset.tierStyle;
        dialog.close();onSelect(entry.characterId,style);
      }
    } else if(event.target===dialog) {
      const r=dialog.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
    }
  });
  return {render:renderTrigger};
}
