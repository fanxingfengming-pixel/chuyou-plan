import fs from "node:fs";
import { fileURLToPath } from "node:url";
const envFile = fileURLToPath(new URL("../.env.server", import.meta.url));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const required = [
  "DASHSCOPE_API_KEY",
  "BAILIAN_WORKSPACE_ID",
  "BAILIAN_AGENT_ID",
  "BAILIAN_ENVIRONMENT_ID",
];
export function loadConfig(env = process.env) {
  const workspace = env.BAILIAN_WORKSPACE_ID || "",
    region = env.BAILIAN_REGION || "cn-beijing";
  if (workspace && !/^[a-zA-Z0-9-]{1,100}$/.test(workspace))
    throw new Error("Invalid workspace configuration");
  return {
    apiKey: env.DASHSCOPE_API_KEY || "",
    workspace,
    region,
    agentId: env.BAILIAN_AGENT_ID || "",
    environmentId: env.BAILIAN_ENVIRONMENT_ID || "",
    agentVersion: Number(env.BAILIAN_AGENT_VERSION) || undefined,
    baseUrl: workspace
      ? "https://" +
        workspace +
        "." +
        region +
        ".maas.aliyuncs.com/api/v1/agentstudio"
      : "",
    timeoutMs: Math.min(
      240000,
      Math.max(1000, Number(env.AGENT_TIMEOUT_MS) || 180000),
    ),
    configured: required.every((k) => !!env[k]),
    port: Number(env.TRAVEL_API_PORT) || 3001,
    dataMode: env.TRAVEL_DATA_MODE || "live",
    amapKey: env.AMAP_MAPS_API_KEY || "",
  };
}
