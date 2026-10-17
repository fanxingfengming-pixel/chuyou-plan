import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createPlaceCatalog,
  sharePlaceQuery,
} from "../../server/place-catalog.js";
import { createTravelServer } from "../../server/app.js";
const base = path.resolve("artifacts/warm-v3");
fs.mkdirSync(base, { recursive: true });
test("资料库跨重开复用，按城市隔离，成功查询可记忆", () => {
  const root = fs.mkdtempSync(path.join(base, "catalog-test-")),
    file = path.join(root, "places.sqlite");
  const p = {
    id: "BTEST100",
    city: "北京市",
    name: "测试地点",
    type: "景点",
    district: "东城区",
    lat: 39.9,
    lng: 116.4,
    source: "live",
    description: "fixture",
    address: "fixture",
  };
  let c = createPlaceCatalog(file);
  c.setAreas("北京", [p]);
  c.remember("北京", "别名", [p]);
  c.close();
  c = createPlaceCatalog(file);
  assert.equal(c.areas("北京")[0].loadedFrom, "catalog");
  assert.equal(c.search("北京市", "别名")[0].id, p.id);
  assert.equal(c.search("上海", "别名").length, 0);
  assert.throws(() => c.put({ ...p, lat: NaN }));
  assert.throws(() => c.put({ ...p, source: "mock" }));
  c.close();
  assert.ok(root.startsWith(base + path.sep + "catalog-test-"));
  fs.rmSync(root, { recursive: true });
});
test("同查询并发只做一次，单个使用者取消不影响另一位", async () => {
  const a = new AbortController(),
    b = new AbortController();
  let count = 0;
  const work = () =>
    new Promise((resolve) => {
      count++;
      setTimeout(() => resolve(["ok"]), 25);
    });
  const first = sharePlaceQuery("test-cancel", a.signal, work).catch(
    (e) => e.name,
  );
  const second = sharePlaceQuery("test-cancel", b.signal, work);
  a.abort();
  assert.equal(await first, "AbortError");
  assert.deepEqual(await second, ["ok"]);
  assert.equal(count, 1);
});
test("真实进度与结果使用同一请求，JSON兼容，流内错误保留分类", async () => {
  let calls = 0;
  const server = createTravelServer({
    handlers: {
      "test-progress": async (p, s, progress) => {
        calls++;
        progress({ stage: "正在核对", completed: 1, total: 2 });
        return { ok: true };
      },
      "test-error": async () => {
        throw Object.assign(new Error("private upstream"), {});
      },
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/travel";
  try {
    const query = (service, accept) =>
      fetch(url + "/" + service, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: accept },
        body: "{}",
      });
    const stream = await (
      await query("test-progress", "text/event-stream")
    ).text();
    assert.match(stream, /event: progress/);
    assert.match(stream, /"completed":1/);
    assert.match(stream, /event: result/);
    assert.equal(calls, 1);
    assert.deepEqual(
      await (await query("test-progress", "application/json")).json(),
      { ok: true },
    );
    const error = await (await query("test-error", "text/event-stream")).text();
    assert.match(error, /event: error/);
    assert.doesNotMatch(error, /private upstream/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
