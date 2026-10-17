import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const {chromium}=require('playwright');
const code=ts.transpileModule(await fs.readFile('src/planning/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {initialDraft}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const base='http://127.0.0.1:5173';
const before=await (await fetch(base+'/api/travel/health')).json();assert.equal(before.mode,'live');
async function readCities(){const result=[];for(const city of ['北京','上海','广州','深圳','杭州']){const response=await fetch(base+'/api/travel/area-recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city,catalogOnly:true})});assert.equal(response.status,200);const places=await response.json();assert.equal(places.length,6);const images=[];for(const p of places){assert.equal(p.loadedFrom,'catalog');const r=await fetch(base+p.image);assert.equal(r.status,200);images.push(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'));}result.push({city,ids:places.map(p=>p.id),images});}return result;}
function service(action){return new Promise((resolve,reject)=>{const c=spawn('cmd.exe',['/d','/s','/c','npm.cmd run '+action],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';c.stdout.on('data',d=>output+=d);c.stderr.on('data',d=>output+=d);c.on('error',reject);c.on('exit',code=>code===0?resolve(output):reject(new Error('Service '+action+' failed')));});}
const citiesBefore=await readCities();
const browser=await chromium.launch({headless:true,channel:'msedge'}),ctx=await browser.newContext({reducedMotion:'reduce'}),page=await ctx.newPage();
try{
 await page.goto(base+'/');
 const draft={...initialDraft(),originCity:'长沙',destinationCity:'杭州',fuzzyDateText:'11月上旬',tripDays:3,planningMode:'area',selectedTransportMode:'rail',packingItems:[{id:'custom-restart',name:'相机',note:'备两张卡',packed:true,origin:'custom'}]};
 await page.evaluate(d=>localStorage.setItem('tripDraft',JSON.stringify(d)),draft);
 await page.goto(base+'/plan/area');await page.locator('.area-group img').first().waitFor();
 await service('stop');await service('start');
 const after=await (await fetch(base+'/api/travel/health')).json();assert.equal(after.mode,'live');assert.notEqual(after.runtimeId,before.runtimeId);
 const citiesAfter=await readCities();assert.deepEqual(citiesAfter,citiesBefore);
 await page.reload();await page.locator('.catalog-notice').waitFor();
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tripDraft')));assert.equal(restored.destinationCity,'杭州');assert.deepEqual(restored.packingItems,draft.packingItems);
 await page.goto(base+'/');await page.locator('.command-bar input').waitFor({state:'visible'});await page.locator('.command-bar input').focus();await page.keyboard.press('ArrowLeft');
 const focus=await page.locator('.command-bar input').evaluate(e=>({color:getComputedStyle(e).outlineColor,offset:getComputedStyle(e).outlineOffset}));assert.equal(focus.color,'rgb(167, 75, 53)');
 await page.screenshot({path:'artifacts/warm-v3/browser/home-keyboard-focus.png',fullPage:true});
 const report={mode:'live',beforeRuntimeId:before.runtimeId,afterRuntimeId:after.runtimeId,newProcess:true,cities:citiesAfter.map(p=>({city:p.city,places:6,identicalImagesAcrossRestart:true})),draftRestore:{destination:'杭州',customItemAndNoteAndChecked:true},homeKeyboardFocus:focus,supplierQueryCount:after.flyai.queryCount};
 await fs.writeFile('artifacts/warm-v3/restart-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
