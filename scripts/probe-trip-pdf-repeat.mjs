import {createRequire} from 'node:module'; import {readFileSync} from 'node:fs';
const require=createRequire('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const {chromium}=require('playwright'); const browser=await chromium.launch({headless:true,channel:'msedge'});
const ctx=await browser.newContext({acceptDownloads:true});
await ctx.addInitScript(d=>localStorage.setItem('tripDraft',JSON.stringify(d)), JSON.parse(readFileSync('artifacts/pdf/sample-draft.json','utf8')));
const page=await ctx.newPage();page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(m.type(),m.text())});page.on('pageerror',e=>console.log('pageerror',e.message));let downloads=0;page.on('download',d=>console.log('download',++downloads,d.suggestedFilename()));
await page.goto('http://127.0.0.1:4173/plan/route');
for (let i=0;i<2;i++) {
 if(i===1){const d=JSON.parse(readFileSync('artifacts/pdf/sample-draft.json','utf8'));await page.getByLabel('移动'+d.routeDraft.days[0].stops[0].name+'到',{exact:true}).selectOption('3');}
 await page.getByRole('button',{name:'下载行程 PDF',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.trip-pdf-export [role=alert]') || document.querySelector('.trip-pdf-export [role=status]')?.textContent.includes('PDF 已生成'),null,{timeout:30000});
 console.log('pass',i,await page.locator('.trip-pdf-export').innerText());
 await page.getByRole('button',{name:'下载行程 PDF',exact:true}).waitFor({state:'visible'});
}
console.log('downloads',downloads); await browser.close();
