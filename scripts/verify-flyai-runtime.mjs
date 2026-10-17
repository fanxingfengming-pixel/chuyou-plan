import fs from "node:fs";
import { createFlyaiRunner, cliDiagnostics } from "../server/flyai.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
let responseShape = null;
const run = createFlyaiRunner(async (...args) => {
  const result = await execute(...args);
  if (args[1]?.[0]?.includes("flyai-bundle")) {
    try {
      const data = JSON.parse(result.stdout.trim());
      responseShape = {
        rootKeys: Object.keys(data),
        dataType: typeof data.data,
        dataKeys:
          data.data && typeof data.data === "object"
            ? Object.keys(data.data)
            : [],
        status: data.status,
      };
    } catch {
      responseShape = { completeJson: false };
    }
  }
  return result;
});
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 2 * 86400000));
const checkout = new Date(Date.parse(date) + 3 * 86400000)
  .toISOString()
  .slice(0, 10);
const evidence = {
  checkedAt: new Date().toISOString(),
  parentNode: process.version,
  date,
  checks: [],
};
const tasks = [
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
      "--sort",
      "rate_desc",
      "--max-price",
      "1000",
    ],
  ],
  [
    "flight",
    "search-flight",
    [
      "--origin",
      "长沙",
      "--destination",
      "北京",
      "--dep-date",
      date,
      "--sort-type",
      "4",
    ],
  ],
];
for (let round = 1; round <= 3; round++) {
  for (const [operation, command, args] of tasks) {
    const start = Date.now();
    responseShape = null;
    let record;
    try {
      const result = await run(command, args, AbortSignal.timeout(70000));
      record = {
        round,
        operation,
        ok: true,
        status: result.status,
        count: result.data.itemList.length,
      };
    } catch (error) {
      record = {
        round,
        operation,
        ok: false,
        errorCode: error.code || "PROBE_FAILED",
        responseShape,
      };
    }
    record = {
      ...record,
      elapsedMs: Date.now() - start,
      diagnostics: { ...cliDiagnostics },
    };
    evidence.checks.push(record);
    fs.writeFileSync(
      "artifacts/integration/flyai-runtime-verification.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(record));
  }
}
evidence.passed =
  evidence.checks.every(
    (c) =>
      c.ok &&
      c.diagnostics.runtimeVersion === "v24.20.0" &&
      c.diagnostics.lastExitCode === 0 &&
      !c.diagnostics.lastStderrHadAssertion,
  ) && cliDiagnostics.failedProcessCount === 0;
fs.writeFileSync(
  "artifacts/integration/flyai-runtime-verification.json",
  JSON.stringify(evidence, null, 2),
);
if (!evidence.passed) process.exitCode = 1;
