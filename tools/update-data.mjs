import fs from 'node:fs/promises';
import path from 'node:path';
const folder = path.resolve(import.meta.dirname, '../research');
await fs.mkdir(folder, { recursive: true });
const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}: ${url}`); return r.text(); };
const manifestText = await get('https://gametora.com/data/manifests/umamusume.json');
const manifest = JSON.parse(manifestText);
await fs.writeFile(path.join(folder, 'gametora-manifest.json'), manifestText);
for (const key of ['skills', 'character-cards', 'support-cards']) {
  if (!/^[a-f0-9]{8}$/.test(manifest[key])) throw new Error(`Invalid manifest hash: ${key}`);
  await fs.writeFile(path.join(folder, `gametora-${key}.json`), await get(`https://gametora.com/data/umamusume/${key}.${manifest[key]}.json`));
}
for (const key of ['skills', 'events']) await fs.writeFile(path.join(folder, `${key}.json`), await get(`https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/main/data/${key}.json`));
console.log('Data downloaded. Update the cutoff date and verify new course/skill rules before running npm run data:build.');
