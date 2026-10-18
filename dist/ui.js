export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function artwork(item,className='') {
  return item?.image?`<span class="artwork ${item.image.includes('/supports/')?'support-art':'character-art'} ${className}"><img src="./${escape(item.image)}" alt="${escape(item.name)}" loading="lazy" decoding="async" width="${item.image.includes('/supports/')?60:56}" height="${item.image.includes('/supports/')?80:56}"></span>`:'';
}
