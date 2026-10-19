export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const SUPPORT_ART_TYPES={speed:{label:'スピード',icon:'00'},stamina:{label:'スタミナ',icon:'01'},power:{label:'パワー',icon:'02'},guts:{label:'根性',icon:'03'},wit:{label:'賢さ',icon:'04'},friend:{label:'友人',icon:'05'},group:{label:'グループ',icon:'06'}};
export function artwork(item,className='') {
  if(!item?.image)return '';
  const support=item.image.includes('/supports/'),type=support?SUPPORT_ART_TYPES[item.type]:null;
  const badge=type?`<span class="support-type-badge support-type-${item.type}" role="img" aria-label="${type.label}" title="${type.label}"><img class="support-type-icon" src="./assets/support-types/${item.type}.png" alt="" loading="lazy" width="24" height="24"></span>`:'';
  return `<span class="artwork ${support?'support-art':'character-art'} ${className}"><img src="./${escape(item.image)}" alt="${escape(item.name)}" loading="lazy" decoding="async" width="${support?60:56}" height="${support?80:56}">${badge}</span>`;
}
