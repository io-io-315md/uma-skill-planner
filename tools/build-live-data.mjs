import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSES, RECOMMENDATIONS, SOURCES } from '../dist/recommendations.js';
import { MAIN_DECK_GUIDE } from '../dist/main-deck-data.js';
import { validateLiveData } from '../dist/live-data.js';
import { PRIORITY_RULES } from '../dist/priorities.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url)));
const payload={schemaVersion:1,verifiedAt:MAIN_DECK_GUIDE.verifiedAt,courses:COURSES,recommendations:RECOMMENDATIONS,priorityRules:PRIORITY_RULES,sources:{...SOURCES,...MAIN_DECK_GUIDE.sources},mainDeckGuide:MAIN_DECK_GUIDE};
const revision=createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0,16);
const data=validateLiveData({...payload,revision},catalog);
const output=new URL('../dist/data/live-planner.json',import.meta.url),text=JSON.stringify(data)+'\n';
if(process.argv.includes('--check')){if(!fs.existsSync(output)||JSON.stringify(JSON.parse(fs.readFileSync(output,'utf8')))!==JSON.stringify(data))throw new Error('Run npm run data:live to refresh published planner data.');}
else fs.writeFileSync(output,text);
console.log(`Live planner data: ${revision}, ${COURSES.length} events, ${MAIN_DECK_GUIDE.events.length} reviewed deck guides.`);
