import fs from "node:fs";
import { runFlyai, cliDiagnostics } from "../server/flyai.js";
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 2 * 86400000));
const checkout = new Date(Date.parse(date) + 3 * 86400000)
  .toISOString()
  .slice(0, 10);
const checks = [];
for (const [operation, command, args] of [
  [
    "hotel",
    "search-hotel",
    [
      "--dest-name",
      "北京",
      "--check-in-date",
      date,
      "--check-out-date",
      checkout,
      "--max-price",
      "1000",
    ],
  ],
  [
    "flight",
    "search-flight",
    ["--origin", "长沙", "--destination", "北京", "--dep-date", date],
  ],
]) {
  try {
    const data = await runFlyai(command, args);
    checks.push({
      operation,
      ok: true,
      status: data.status,
      count: data.data.itemList.length,
      diagnostics: { ...cliDiagnostics },
    });
  } catch (error) {
    checks.push({
      operation,
      ok: false,
      code: error.code,
      diagnostics: { ...cliDiagnostics },
    });
  }
}
fs.writeFileSync(
  "artifacts/integration/flyai-probe-current.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2),
);
console.log(JSON.stringify(checks));
if (checks.some((check) => !check.ok)) process.exitCode = 1;
