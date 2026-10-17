import test from "node:test";
import assert from "node:assert/strict";
import { decodeMcpResult, queryAmap } from "../../server/amap-service.js";
import { AppError, publicError } from "../../server/errors.js";
const config = { amapKey: "server-only-test-key" };
const fail = async () => {
  throw new AppError("AMAP_CONNECTION_FAILED", "连接失败");
};
test("高德与铁路错误独立；上游原文和密钥不会进入公开错误", () => {
  const raw = {
    isError: true,
    content: [
      {
        type: "text",
        text: "Error: INVALID_USER_KEY key=server-only-test-key",
      },
    ],
  };
  for (const [provider, code] of [
    ["AMAP", "AMAP_KEY_INVALID"],
    ["RAIL", "RAIL_QUERY_FAILED"],
  ]) {
    assert.throws(
      () => decodeMcpResult(raw, provider),
      (e) => {
        assert.equal(e.code, code);
        assert.ok(!JSON.stringify(publicError(e)).includes(config.amapKey));
        return true;
      },
    );
  }
  assert.throws(
    () =>
      decodeMcpResult({
        content: [{ type: "text", text: '{"status":"0","infocode":"10003"}' }],
      }),
    (e) => e.code === "AMAP_RATE_LIMITED",
  );
  assert.throws(
    () =>
      decodeMcpResult({
        content: [{ type: "text", text: "<html>bad gateway</html>" }],
      }),
    (e) => e.code === "AMAP_INVALID_OUTPUT",
  );
  assert.deepEqual(decodeMcpResult({ structuredContent: { pois: [] } }), {
    pois: [],
  });
});
test("MCP断连后查询同一官方HTTP服务；参数与坐标保持经度在前，细节城市字段归一化", async () => {
  let calls = 0;
  const result = await queryAmap(
    "maps_search_detail",
    { id: "B0123456" },
    new AbortController().signal,
    fail,
    config,
    async (url) => {
      calls++;
      assert.equal(url.hostname, "restapi.amap.com");
      assert.equal(url.searchParams.get("key"), config.amapKey);
      assert.equal(url.searchParams.get("id"), "B0123456");
      return Response.json({
        status: "1",
        pois: [
          {
            id: "B0123456",
            cityname: "杭州市",
            adname: "上城区",
            location: "120.166521,30.253702",
          },
        ],
      });
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.city, "杭州市");
  assert.equal(result.district, "上城区");
});
test("Key/权限/额度错误不重试；主动取消不触发后备查询", async () => {
  for (const code of [
    "AMAP_KEY_INVALID",
    "AMAP_PERMISSION_DENIED",
    "AMAP_RATE_LIMITED",
  ]) {
    await assert.rejects(
      queryAmap(
        "maps_text_search",
        {},
        undefined,
        async () => {
          throw new AppError(code, "安全错误");
        },
        config,
        () => {
          throw Error("must not run");
        },
      ),
      (e) => e.code === code,
    );
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    queryAmap(
      "maps_text_search",
      {},
      controller.signal,
      () => {
        throw Error("must not run");
      },
      config,
    ),
  );
});
test("官方HTTP错误/非JSON/超时保持可恢复失败，绝不伪造路线", async () => {
  for (const [response, code] of [
    [new Response("bad gateway", { status: 502 }), "AMAP_HTTP_ERROR"],
    [new Response("<html>login</html>"), "AMAP_INVALID_OUTPUT"],
    [
      Response.json({
        status: "0",
        infocode: "10009",
        info: "USERKEY_PLAT_NOMATCH",
      }),
      "AMAP_KEY_INVALID",
    ],
  ])
    await assert.rejects(
      queryAmap(
        "maps_text_search",
        {},
        undefined,
        fail,
        config,
        async () => response,
      ),
      (e) => e.code === code,
    );
  await assert.rejects(
    queryAmap("maps_text_search", {}, undefined, fail, config, async () => {
      throw new DOMException("timeout", "TimeoutError");
    }),
    (e) => e.code === "AMAP_TIMEOUT",
  );
});
