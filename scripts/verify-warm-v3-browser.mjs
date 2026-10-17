
import {createRequire} from "node:module";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const require=createRequire("C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/");
const {chromium}=require("playwright");
const browser=await chromium.launch({headless:true,channel:"msedge"});
const origin="http://127.0.0.1:4173",reports=[];
await fs.mkdir("artifacts/warm-v3/browser",{recursive:true});
async function assertNoOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"horizontal overflow");const visible=await page.evaluate(()=>{const nav=document.querySelector('.planning-progress'),a=nav?.querySelector('[aria-current="step"]');if(!a)return true;const n=nav.getBoundingClientRect(),b=a.getBoundingClientRect();return b.left>=n.left-2&&b.right<=n.right+2;});assert.ok(visible,"current step visible in progress navigation");}
async function save(page,name){for(const image of await page.locator("img").all()){await image.scrollIntoViewIfNeeded();await image.evaluate(async i=>{await i.decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:"instant"});});await page.waitForFunction(()=>scrollY===0);await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:"artifacts/warm-v3/browser/"+name+".png",fullPage:true});await assertNoOverflow(page);}
try {
 for(const width of (process.env.WARM_QA_WIDTH?[Number(process.env.WARM_QA_WIDTH)]:[1440,390])){
  for(const mode of (process.env.WARM_QA_MODE?[process.env.WARM_QA_MODE]:["area","hotel"])){
   const ctx=await browser.newContext({viewport:{width,height:width===1440?1000:844},acceptDownloads:true,reducedMotion:"reduce"});
   const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultTimeout(15000);
   if(mode==="area"){await page.goto(origin+"/");const skip=page.getByRole("button",{name:"跳过开场",exact:true});if(await skip.isVisible())await skip.click();await save(page,width+"-home");}
   await page.goto(origin+"/plan/mode");
   await page.getByPlaceholder("例如：长沙").waitFor();
   assert.match(await page.locator(".route-notice").innerText(),/补齐旅行信息/);
   await page.getByRole("button",{name:"选择住宿方式",exact:true}).click();
   assert.equal(await page.locator('[data-field="originCity"]').evaluate(e=>e===document.activeElement),true);
   await page.getByPlaceholder("例如：长沙").fill("长沙");
   await page.getByPlaceholder("例如：北京").fill("杭州");
   await page.getByPlaceholder("11月上旬 / 国庆期间").fill("11月上旬");
   await page.locator('[data-field="tripDays"]').fill("3");
   await page.getByRole("button",{name:"选择住宿方式",exact:true}).click();
   await page.getByRole("button",{name:"比较城际交通",exact:true}).click();
   await page.getByText("请选择「先选区域」或「先找酒店」。",{exact:true}).waitFor();
   await save(page,width+"-"+mode+"-mode");
   await page.locator(".mode-choice").nth(mode==="area"?0:1).click();
   await page.getByRole("button",{name:"比较城际交通",exact:true}).click();
   await page.locator(".transport-choice").first().waitFor();
   await page.locator(".transport-choice").first().click();
   await page.getByRole("button",{name:mode==="area"?"选择住宿区域":"选择品牌偏好",exact:true}).click();
   if(mode==="area"){
    await page.locator(".area-group .place-choice").first().waitFor();
    assert.equal(await page.locator(".area-group .place-choice").count(),6);
    const images=await page.locator(".area-group img").evaluateAll(imgs=>imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.getAttribute("src")})));
    assert.equal(images.filter(i=>i.loaded).length,6);
    assert.equal(images.filter(i=>i.src?.includes("fallback")).length,0);
    await page.getByRole("button",{name:"设置酒店条件",exact:true}).click();
    await page.getByText("请先选择一个位置，再设为核心地点。",{exact:true}).waitFor();
    await page.locator(".area-group .place-choice button").first().click();
    await page.getByRole("button",{name:/设为核心/}).click();
    await save(page,width+"-area");
    await page.getByRole("button",{name:"设置酒店条件",exact:true}).click();
   }else{
    await page.getByRole("button",{name:"跳过品牌偏好",exact:true}).click();
   }
   await page.getByRole("button",{name:"搜索适合的酒店",exact:true}).waitFor();
   await save(page,width+"-"+mode+"-filters");
   await page.getByRole("button",{name:"搜索适合的酒店",exact:true}).click();
   await page.getByRole("button",{name:"我已选择这家酒店",exact:true}).first().waitFor();
   await save(page,width+"-"+mode+"-results");
   await page.getByRole("button",{name:"我已选择这家酒店",exact:true}).first().click();
   await page.getByRole("button",{name:"接着选择景点",exact:true}).click();
   if(mode==="area"){
    assert.equal(await page.locator(".chosen-places li").count(),1);
    await page.getByRole("button",{name:/移除行程/}).first().click();
    await page.reload();
    assert.equal(await page.locator(".chosen-places li").count(),0);
   }
   await page.getByRole("textbox",{name:"搜索地点",exact:true}).fill("灵隐");
   await page.getByRole("button",{name:"搜索地点",exact:true}).click();
   await page.locator(".place-search-results .place-choice button").first().click();
   await page.getByRole("button",{name:"选择市内交通",exact:true}).click();
   await page.locator(".local-choice").first().click();
   await page.getByRole("button",{name:"安排行程路线",exact:true}).click();
   await page.getByRole("button",{name:"开始规划路线",exact:true}).click();
   await page.getByRole("button",{name:"确认开始规划",exact:true}).click();
   await page.getByRole("textbox",{name:"新增物品",exact:true}).fill("相机");
   await page.getByRole("button",{name:"添加物品",exact:true}).click();
   await page.getByRole("textbox",{name:"相机备注",exact:true}).fill("备两张卡");
   await page.getByRole("checkbox",{name:"已备好相机",exact:true}).check();
   await page.reload();
   await page.getByRole("textbox",{name:"相机备注",exact:true}).waitFor();
   assert.equal(await page.getByRole("textbox",{name:"相机备注",exact:true}).inputValue(),"备两张卡");
   assert.equal(await page.getByRole("checkbox",{name:"已备好相机",exact:true}).isChecked(),true);
   await save(page,width+"-"+mode+"-route");
   const promise=page.waitForEvent("download");
   await page.getByRole("button",{name:"下载行程 PDF",exact:true}).click();
   const download=await promise;await download.saveAs("artifacts/warm-v3/browser/"+width+"-"+mode+".pdf");
   await page.goBack();await page.goForward();await assertNoOverflow(page);
   await page.locator('.route-stop-actions select').first().selectOption('2');
   await page.reload();
   assert.equal(await page.locator('[data-route-day="2"] .route-stop-actions select').count(),1);
   await page.getByRole('button',{name:'重新优化路线',exact:true}).click();
   assert.equal(await page.locator('[data-route-day="2"] .route-stop-actions select').count(),1);
   assert.equal(await page.getByRole('checkbox',{name:'已备好相机',exact:true}).isChecked(),true);
   await page.getByRole('textbox',{name:'物品名称 相机',exact:true}).fill('相机包');
   await page.getByRole('button',{name:'删除物品相机包',exact:true}).click();
   await page.getByRole('button',{name:'删除物品身份证件',exact:true}).click();
   await page.reload();
   assert.equal(await page.getByRole('textbox',{name:'物品名称 相机包',exact:true}).count(),0);
   assert.equal(await page.getByRole('textbox',{name:'物品名称 身份证件',exact:true}).count(),0);
   await page.goto(origin+'/');
   await page.getByRole('button',{name:'全部重置',exact:true}).click();
   await page.getByRole('button',{name:'保留草稿',exact:true}).click();
   assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('tripDraft')).packingItems.length>0));
   await page.getByRole('button',{name:'全部重置',exact:true}).click();
   await page.getByRole('button',{name:'确认全部重置',exact:true}).click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('tripDraft')),null);
   reports.push({width,mode,source:"explicit mock",errors,pdf:download.suggestedFilename(),routeMoveRestoreOptimize:true,packingEditDeleteRestore:true,resetCancelConfirm:true,passed:errors.length===0});
   assert.equal(errors.length,0);await ctx.close();
   console.log(JSON.stringify(reports.at(-1)));
  }
 }
}finally{let previous=[];try{previous=JSON.parse(await fs.readFile("artifacts/warm-v3/browser/report.json","utf8"));}catch{}const merged=[...previous.filter(p=>!reports.some(r=>r.width===p.width&&r.mode===p.mode)),...reports];await fs.writeFile("artifacts/warm-v3/browser/report.json",JSON.stringify(merged,null,2));await browser.close();}
