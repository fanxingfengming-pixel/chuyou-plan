import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
if (path.resolve(process.cwd()) !== path.resolve(root)) {
  throw new Error("Run from the existing 出游plan project directory.");
}
const env = { ...process.env, VITE_TRAVEL_DATA_MODE: "mock", VITE_PUBLIC_DEMO: "true", VITE_TRAVEL_API_BASE: "" };
for (const args of [
  ["node_modules/typescript/bin/tsc", "-b"],
  ["node_modules/vite/bin/vite.js", "build", "--mode", "public-demo", "--outDir", "work/online-demo/dist"],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
const directory = path.join(root, "work/online-demo/dist");
const index = path.join(directory, "index.html");
let html = fs.readFileSync(index, "utf8");
html = html.replace("出游plan · 让旅行更从容", "出游plan · 模拟数据交互演示");
fs.writeFileSync(index, html);
// The archive carries only public static assets, never the Node API or local data.
fs.writeFileSync(path.join(directory, "demo.json"), JSON.stringify({ mode: "mock", liveServices: false, builtAt: new Date().toISOString() }, null, 2));
console.log("Public demo built with explicit mock mode; local live configuration is unchanged.");