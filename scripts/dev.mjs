import path from "node:path";
import { supervise } from "./supervisor.mjs";
const cwd = process.cwd();
let manager,
  ending = false;
const finish = async (failed = false) => {
  if (ending) return;
  ending = true;
  await manager?.stop();
  process.exitCode = failed ? 1 : 0;
};
manager = supervise(
  [
    {
      name: "查询服务",
      command: process.execPath,
      args: ["server/app.js"],
      cwd,
      env: process.env,
    },
    {
      name: "开发网页",
      command: process.execPath,
      args: [
        path.resolve("node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
      ],
      cwd,
      env: process.env,
    },
  ],
  {
    log: (name, line) => console.log("[" + name + "] " + line),
    onExhausted: () => void finish(true),
  },
);
process.on("SIGINT", () => void finish());
process.on("SIGTERM", () => void finish());
