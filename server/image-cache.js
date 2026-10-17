import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

export const FALLBACK_IMAGE = "/images/fallback-landscape.webp";
export const IMAGE_ROOT = fileURLToPath(
  new URL("../data/image-cache/", import.meta.url),
);
const allowedDomains = [
  "alicdn.com",
  "amap.com",
  "autonavi.com",
  "images.unsplash.com",
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
];
export function trustedImageUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const u = new URL(value);
    if (u.username || u.password || (u.port && u.port !== "443")) return null;
    if (
      !allowedDomains.some(
        (d) => u.hostname === d || u.hostname.endsWith("." + d),
      )
    )
      return null;
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (
      [...u.searchParams.keys()].some((k) =>
        /^(api[_-]?key|key|token|secret|authorization)$/i.test(k),
      )
    )
      return null;
    u.protocol = "https:";
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}
export async function downloadImage(value, { signal, fetchImpl = fetch } = {}) {
  let url = trustedImageUrl(value);
  if (!url) throw new Error("untrusted image");
  const deadline = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
    : AbortSignal.timeout(12000);
  for (let hops = 0; hops < 4; hops++) {
    const response = await fetchImpl(url, {
      signal: deadline,
      redirect: "manual",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      await response.body?.cancel();
      url = next ? trustedImageUrl(new URL(next, url).href) : null;
      if (!url) throw new Error("untrusted redirect");
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("image unavailable");
    }
    if (
      !/^image\/(jpeg|png|webp|avif|gif)/i.test(
        response.headers.get("content-type") || "",
      )
    ) {
      await response.body?.cancel();
      throw new Error("not a raster image");
    }
    if (Number(response.headers.get("content-length")) > 5 * 1024 * 1024) {
      await response.body?.cancel();
      throw new Error("image too large");
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.byteLength;
      if (length > 5 * 1024 * 1024) throw new Error("image too large");
      chunks.push(Buffer.from(chunk));
    }
    const data = await sharp(Buffer.concat(chunks), {
      limitInputPixels: 36_000_000,
      animated: false,
    })
      .rotate()
      .resize({
        width: 1200,
        height: 900,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return { data, url };
  }
  throw new Error("too many redirects");
}
const fallback = () => ({
  image: FALLBACK_IMAGE,
  imageSource: "通用风景示意图 · 非实景",
  imageFallback: true,
});
export function createImageCache({
  root = IMAGE_ROOT,
  fetchImpl = fetch,
} = {}) {
  let entries,
    loading,
    writes = Promise.resolve();
  const pending = new Map();
  const stats = { hits: 0, misses: 0, downloads: 0, fallbacks: 0 };
  async function load() {
    if (entries) return;
    if (!loading)
      loading = (async () => {
        await fs.mkdir(root, { recursive: true });
        try {
          const raw = JSON.parse(
            await fs.readFile(path.join(root, "index.json"), "utf8"),
          );
          entries =
            raw.version === 1 && raw.entries && typeof raw.entries === "object"
              ? raw.entries
              : {};
        } catch {
          entries = {};
        }
      })();
    await loading;
  }
  async function save() {
    writes = writes
      .catch(() => {})
      .then(async () => {
        await fs.writeFile(
          path.join(root, "index.tmp"),
          JSON.stringify({ version: 1, entries }, null, 2),
        );
        await fs.rename(
          path.join(root, "index.tmp"),
          path.join(root, "index.json"),
        );
      });
    await writes;
  }
  async function resolve(key, findCandidates, signal) {
    if (typeof key !== "string" || !key.length || key.length > 180)
      return fallback();
    await load();
    const old = Object.hasOwn(entries, key) ? entries[key] : null;
    if (old?.status === "missing") {
      stats.hits++;
      return fallback();
    }
    if (
      old?.status === "ready" &&
      /^[a-f0-9]{64}\.webp$/.test(old.file || "")
    ) {
      try {
        await fs.access(path.join(root, old.file));
        stats.hits++;
        return {
          image: "/api/travel/media/" + old.file,
          imageSource: old.sourceLabel,
          imageFallback: false,
        };
      } catch {}
    }
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      stats.misses++;
      let candidates;
      try {
        candidates = await findCandidates();
      } catch {
        stats.fallbacks++;
        return fallback();
      }
      candidates = (Array.isArray(candidates) ? candidates : [])
        .filter((c) => trustedImageUrl(c?.url))
        .slice(0, 3);
      if (!candidates.length) {
        entries[key] = {
          status: "missing",
          checkedAt: new Date().toISOString(),
        };
        await save();
        stats.fallbacks++;
        return fallback();
      }
      for (const candidate of candidates) {
        if (signal?.aborted) break;
        try {
          const { data, url } = await downloadImage(candidate.url, {
            signal,
            fetchImpl,
          });
          const file =
            createHash("sha256").update(data).digest("hex") + ".webp";
          await fs.writeFile(path.join(root, file), data);
          entries[key] = {
            status: "ready",
            file,
            sourceUrl: url,
            sourceLabel: String(candidate.sourceLabel || "供应方图片").slice(
              0,
              100,
            ),
            cachedAt: new Date().toISOString(),
          };
          await save();
          stats.downloads++;
          return {
            image: "/api/travel/media/" + file,
            imageSource: entries[key].sourceLabel,
            imageFallback: false,
          };
        } catch {
          /* Transient failures use fallback without poisoning the persistent entry. */
        }
      }
      stats.fallbacks++;
      return fallback();
    })().finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }
  async function retryMissing(key) { await load(); if(entries[key]?.status === "missing"){delete entries[key];await save();} }
  return { resolve, stats, retryMissing };
}
export const imageCache = createImageCache();
export async function serveCachedImage(req, res, pathname) {
  const match = pathname.match(/^\/api\/travel\/media\/([a-f0-9]{64}\.webp)$/);
  if (req.method !== "GET" || !match) return false;
  try {
    const data = await fs.readFile(path.join(IMAGE_ROOT, match[1]));
    res.writeHead(200, {
      "Content-Type": "image/webp",
      "Content-Length": data.length,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  } catch {
    res.writeHead(404, {
      "Content-Type": "text/plain",
      "X-Content-Type-Options": "nosniff",
    });
    res.end("Image not found");
  }
  return true;
}
