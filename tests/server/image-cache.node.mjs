import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  createImageCache,
  trustedImageUrl,
  downloadImage,
  FALLBACK_IMAGE,
} from "../../server/image-cache.js";
const base = path.resolve("artifacts");
await fs.mkdir(base, { recursive: true });
const root = await fs.mkdtemp(path.join(base, "image-cache-test-"));
after(async () => {
  const target = path.resolve(root);
  assert.ok(target.startsWith(base + path.sep + "image-cache-test-"));
  await fs.rm(target, { recursive: true, force: true });
});
const png = await sharp({
  create: { width: 12, height: 8, channels: 3, background: "#bfd8d0" },
})
  .png()
  .toBuffer();
const response = () =>
  new Response(png, { headers: { "Content-Type": "image/png" } });
test("只接受可信图片域名，拒绝内网、伪装域名、凭据和特殊端口", () => {
  assert.ok(
    trustedImageUrl("http://store.is.autonavi.com/showpic/abc")?.startsWith(
      "https:",
    ),
  );
  for (const url of [
    "http://127.0.0.1/x",
    "https://img.alicdn.com.evil.example/a",
    "https://user:key@img.alicdn.com/a",
    "https://img.alicdn.com:9999/a",
    "https://img.alicdn.com/a?key=private",
    "data:image/png,abc",
  ])
    assert.equal(trustedImageUrl(url), null);
});
test("同地点并发只下载一次，重新加载缓存仍沿用原图", async () => {
  let requests = 0,
    lookups = 0;
  const dir = path.join(root, "persistent");
  const cache = createImageCache({
    root: dir,
    fetchImpl: async () => {
      requests++;
      return response();
    },
  });
  const find = async () => {
    lookups++;
    return [
      { url: "https://img.alicdn.com/test.png", sourceLabel: "供应方图片" },
    ];
  };
  const [a, b] = await Promise.all([
    cache.resolve("place:1", find),
    cache.resolve("place:1", find),
  ]);
  assert.equal(a.image, b.image);
  assert.equal(requests, 1);
  assert.equal(lookups, 1);
  const restarted = createImageCache({
    root: dir,
    fetchImpl: async () => {
      throw new Error("must not download");
    },
  });
  const again = await restarted.resolve("place:1", async () => {
    throw new Error("must not search");
  });
  assert.equal(again.image, a.image);
  assert.equal(again.imageFallback, false);
});
test("确定没有图片的结果也持久缓存，后续不重复搜索", async () => {
  const cache = createImageCache({ root: path.join(root, "missing") });
  let searches = 0;
  const a = await cache.resolve("place:none", async () => {
    searches++;
    return [];
  });
  const b = await cache.resolve("place:none", async () => {
    searches++;
    return [{ url: "https://img.alicdn.com/later.png" }];
  });
  assert.equal(a.image, FALLBACK_IMAGE);
  assert.equal(b.imageFallback, true);
  assert.equal(searches, 1);
});
test("临时下载失败只临时兜底，允许下次正常取得图片", async () => {
  let calls = 0;
  const cache = createImageCache({
    root: path.join(root, "transient"),
    fetchImpl: async () => {
      if (++calls === 1) throw new Error("network");
      return response();
    },
  });
  const find = async () => [{ url: "https://img.alicdn.com/test.png" }];
  assert.equal((await cache.resolve("place:retry", find)).imageFallback, true);
  assert.equal((await cache.resolve("place:retry", find)).imageFallback, false);
});
test("图片重定向不能访问内网或未知站点", async () => {
  let calls = 0;
  await assert.rejects(() =>
    downloadImage("https://img.alicdn.com/a", {
      fetchImpl: async () => {
        calls++;
        return new Response(null, {
          status: 302,
          headers: { Location: "http://127.0.0.1/private" },
        });
      },
    }),
  );
  assert.equal(calls, 1);
});

test("酒店缩略图只改写已验证供应方 CDN，不改写签名地址或伪装域名", async () => {
  const { hotelPhotoCandidates } =
    await import("../../server/image-sources.js");
  const photos = hotelPhotoCandidates(
    "https://img.alicdn.com/imgextra/real-hotel.jpg",
  );
  assert.equal(
    photos[0].url,
    "https://img.alicdn.com/imgextra/real-hotel.jpg_1200x1200.jpg",
  );
  assert.equal(photos[1].url, "https://img.alicdn.com/imgextra/real-hotel.jpg");
  assert.equal(
    hotelPhotoCandidates(
      "https://img.alicdn.com/imgextra/hotel.jpg?signature=keep",
    ).length,
    1,
  );
  assert.equal(
    hotelPhotoCandidates(
      "https://img.alicdn.com/imgextra/hotel.jpg_600x600.jpg",
    ).length,
    1,
  );
  assert.deepEqual(
    hotelPhotoCandidates("https://img.alicdn.com.evil.example/hotel.jpg"),
    [],
  );
  assert.deepEqual(
    hotelPhotoCandidates("https://img.alicdn.com/hotel.jpg?key=private"),
    [],
  );
});
