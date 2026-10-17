import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadConfig} from '../server/config.js';
const documents=['README.md','DESIGN.md','docs/README.md','docs/FUNCTIONAL_REQUIREMENTS.md','docs/FROZEN_RULES.md','docs/USER_FLOWS.md','docs/STATE_AND_DATA_CONTRACT.md','docs/PROJECT_ARCHITECTURE.md','docs/PROJECT_STANDARDS.md','docs/DESIGN_SYSTEM.md','docs/ACCEPTANCE_MATRIX.md','docs/KNOWN_GAPS.md','docs/DECISION_LOG.md','docs/CHANGELOG.md','docs/PLACE_CATALOG.md','docs/PRODUCT_GOALS.md','docs/WARM_V3_DELIVERY.md'];
const broken=[];let links=0;
for(const f of documents){const text=await fs.readFile(f,'utf8');for(const m of text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)){let target=m[1].replace(/^<|>$/g,'').split('#')[0];if(!target||/^[a-z][a-z0-9+.-]*:/i.test(target))continue;links++;try{await fs.access(path.resolve(path.dirname(f),decodeURIComponent(target)));}catch{broken.push({file:f,target});}}}
assert.deepEqual(broken,[],'broken current documentation links');
const config=loadConfig(),secrets=[config.apiKey,config.amapKey].filter(v=>typeof v==='string'&&v.length>7);let scanned=0;const hits=[];
async function scan(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await scan(f);else{const bytes=await fs.readFile(f);scanned++;if(secrets.some(k=>bytes.includes(Buffer.from(k))))hits.push(f);}}}
for(const dir of ['src','public','dist','docs','artifacts/warm-v3'])await scan(dir);
assert.deepEqual(hits,[],'configured secret found in deliverables');
const cache=JSON.parse(await fs.readFile('.impeccable/design.json','utf8'));assert.ok(cache);
const report={documents:documents.length,localLinksChecked:links,brokenLinks:broken,configuredSecretValuesChecked:secrets.length,deliverableFilesScanned:scanned,secretHits:hits,designCacheValidJson:true,scope:'Deliverables and current docs, excludes private config and runtime logs'};
await fs.writeFile('artifacts/warm-v3/integrity-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
