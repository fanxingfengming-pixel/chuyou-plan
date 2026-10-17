import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const {chromium}=require('playwright');
const code=ts.transpileModule(await fs.readFile('src/planning/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {initialDraft}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const base='http://127.0.0.1:5173';
const report={scope:'Local production build; actual catalog API and images. Travel prerequisite state is seeded, no supplier quote acceptance.',health:await (await fetch(base+'/api/travel/health')).json(),performance:[],slow:null,error:null,motion:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
async function context(city='杭州',width=1440,reducedMotion='reduce'){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion});
 const draft={...initialDraft(),originCity:'长沙',destinationCity:city,fuzzyDateText:'11月上旬',tripDays:3,planningMode:'area',selectedTransportMode:'rail'};
 await ctx.addInitScript(d=>localStorage.setItem('tripDraft',JSON.stringify(d)),draft);return ctx;
}
try{
 for(const city of ['北京','上海','广州','深圳','杭州']){
  const ctx=await context(city),page=await ctx.newPage(),external=[];
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(new URL(r.url()).host);});
  const began=performance.now();await page.goto(base+'/plan/area');
  await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.area-group img')];return images.length===6&&images.every(i=>i.complete&&i.naturalWidth>0);});
  const elapsedMs=performance.now()-began;
  assert.match(await page.locator('.catalog-notice').innerText(),/本地收录资料/);assert.equal(external.length,0);
  report.performance.push({city,elapsedMs:Math.round(elapsedMs),images:6,externalBrowserRequests:0});await ctx.close();
 }
 {
  const ctx=await context(),page=await ctx.newPage();
  await page.route('**/api/travel/area-recommendations',async route=>{await new Promise(r=>setTimeout(r,1800));await route.continue();});
  await page.goto(base+'/plan/area');await page.locator('.place-skeleton').first().waitFor();
  assert.equal(await page.getByText('当前城市暂未取得推荐地点，你可以自行搜索。',{exact:true}).count(),0);
  await page.waitForFunction(()=>document.querySelector('.query-progress')?.textContent?.includes('已等待 1 秒'));
  const progress=await page.locator('.query-progress').innerText();const ariaNow=await page.getByRole('progressbar').getAttribute('aria-valuenow');assert.equal(ariaNow,null);
  await page.waitForFunction(()=>document.querySelectorAll('.area-group img').length===6);
  report.slow={injectedDelayMs:1800,skeleton:true,prematureEmpty:false,elapsedVisible:true,fabricatedPercentage:false,progress};await ctx.close();
 }
 {
  const ctx=await context(),page=await ctx.newPage();
  await page.route('**/api/travel/area-recommendations',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'测试故障'}})}));
  await page.goto(base+'/plan/area');await page.getByRole('textbox',{name:'搜索地点',exact:true}).fill('保留的输入');
  await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'搜索地点',exact:true}).inputValue(),'保留的输入');
  assert.equal(await page.getByText('当前城市暂未取得推荐地点，你可以自行搜索。',{exact:true}).count(),0);
  report.error={injectedStatus:503,retryVisible:true,inputPreserved:true,misreportedAsEmpty:false};await ctx.close();
 }
 for(const [width,motion] of [[1440,'no-preference'],[390,'no-preference'],[390,'reduce']]){
  const ctx=await context('杭州',width,motion),page=await ctx.newPage();
  await page.goto(base+'/plan/details');await page.getByRole('button',{name:'选择住宿方式',exact:true}).click();
  await page.waitForURL('**/plan/mode');assert.equal(await page.locator('.wizard-page-curl.back').count(),0);
  await page.waitForFunction(()=>!document.querySelector('.wizard-content')?.style.transform);
  const forwardFocus=await page.locator('h1').evaluate(e=>document.activeElement===e);assert.equal(forwardFocus,true);
  const curlDisplay=await page.locator('.wizard-page-curl').evaluate(e=>getComputedStyle(e).display);
  if(width===390||motion==='reduce')assert.equal(curlDisplay,'none');
  await page.getByRole('link',{name:'上一步',exact:true}).click();await page.waitForURL('**/plan/details');
  assert.equal(await page.locator('.wizard-page-curl.back').count(),1);
  await page.waitForFunction(()=>!document.querySelector('.wizard-content')?.style.transform);
  report.motion.push({width,preference:motion,forwardAndBackDirection:true,headingFocused:true,curlDisplay,settledTransform:true});await ctx.close();
 }
}finally{await browser.close();await fs.writeFile('artifacts/warm-v3/browser/focused-checks.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
