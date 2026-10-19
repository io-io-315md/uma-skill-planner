import { INHERITED_FACTOR_NOTE } from './farming-policy.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function inheritedFactorSection(rows,context='') {
  if(!rows.length)return '';
  return `<section class="inherited-factor-note"><h4>既存因子から引き継ぐ白因子</h4><p>${escape(INHERITED_FACTOR_NOTE)}</p>${rows.map(row=>`<div class="inherited-factor-row"><span class="priority priority-${row.priority}">優先度 ${['','高','中','低'][row.priority]}</span><strong>${escape(row.name)}</strong>${context?`<label class="prepare-checkbox"><input type="checkbox" data-${context}-learned="${escape(row.name)}" ${row.learned?'checked':''}> 継承後に習得済み</label>`:''}</div>`).join('')}<p>周回に使う親・祖父母にこの白因子を用意し、継承ヒントから習得して再び白因子を狙います。継承・因子化は確定ではありません。</p>${rows.some(row=>row.farmingRoutes?.length)?'<p>この編成には追加の取得経路もあります。上の前提と分け、カバー件数には含めません。</p>':''}</section>`;
}
export const SUPPORT_ART_TYPES={speed:{label:'スピード',icon:'00'},stamina:{label:'スタミナ',icon:'01'},power:{label:'パワー',icon:'02'},guts:{label:'根性',icon:'03'},wit:{label:'賢さ',icon:'04'},friend:{label:'友人',icon:'05'},group:{label:'グループ',icon:'06'}};
export function artwork(item,className='') {
  if(!item?.image)return '';
  const support=item.image.includes('/supports/'),type=support?SUPPORT_ART_TYPES[item.type]:null;
  const badge=type?`<span class="support-type-badge support-type-${item.type}" role="img" aria-label="${type.label}" title="${type.label}"><img class="support-type-icon" src="./assets/support-types/${item.type}.png" alt="" loading="lazy" width="24" height="24"></span>`:'';
  return `<span class="artwork ${support?'support-art':'character-art'} ${className}"><img src="./${escape(item.image)}" alt="${escape(item.name)}" loading="lazy" decoding="async" width="${support?60:56}" height="${support?80:56}">${badge}</span>`;
}
