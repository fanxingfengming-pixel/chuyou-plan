import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
const errors=[],events=[];
const server=await createServer({configFile:fileURLToPath(new URL("../vite.config.ts",import.meta.url)),server:{middlewareMode:true},logLevel:"silent"});
try{
 server.watcher.on("error",e=>errors.push(e.code||"WATCH_ERROR"));
 server.watcher.on("all",(_,file)=>{if(/[\\/]artifacts[\\/]|[\\/]data[\\/]/.test(file))events.push(file);});
 await new Promise(resolve=>{const timer=setTimeout(resolve,1000);server.watcher.once("ready",()=>{clearTimeout(timer);resolve();});});
 const watched=Object.keys(server.watcher.getWatched());
 assert.ok(!watched.some(d=>/[\\/]artifacts(?:[\\/]|$)|[\\/]data(?:[\\/]|$)/.test(d)));
 await fs.writeFile("artifacts/stability/watch-probe.txt","Generated output is ignored.");
 await new Promise(resolve=>setTimeout(resolve,200));
 assert.deepEqual(errors,[]);assert.deepEqual(events,[]);
 const health=await(await fetch("http://127.0.0.1:5173/api/travel/health")).json();
 assert.equal(health.localService,"ready");
 const evidence={checkedAt:new Date().toISOString(),lockedPdf:"artifacts/stability/watch-locked.pdf",errors,generatedEvents:events.length,artifactsAndDataIgnored:true,stableServiceReady:health.localService==="ready"};
 await fs.writeFile("artifacts/stability/watch-lock-check.json",JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await server.close();}

