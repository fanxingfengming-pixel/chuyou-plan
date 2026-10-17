import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const DIST_ROOT = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
};
export async function serveStaticSite(req, res, pathname, root = DIST_ROOT) {
  if (pathname.startsWith("/api/")) return false;
  if (!["GET", "HEAD"].includes(req.method)) return false;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = "";
  }
  const parts = decoded.split("/");
  const forbidden =
    !decoded.startsWith("/") ||
    decoded.includes("\\") ||
    decoded.includes("\0") ||
    parts.some(
      (p) =>
        p === ".." ||
        p.startsWith(".") ||
        [
          "server",
          "scripts",
          "data",
          "artifacts",
          "node_modules",
          "@fs",
        ].includes(p),
    );
  if (forbidden) {
    res.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    res.end("此文件不可访问。");
    return true;
  }
  const base = await fs.realpath(root);
  let target = path.resolve(base, "." + decoded);
  if (target !== base && !target.startsWith(base + path.sep)) return false;
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) target = path.join(target, "index.html");
  } catch {
    if (path.extname(decoded)) return false;
    target = path.join(base, "index.html");
  }
  let real, stat;
  try {
    real = await fs.realpath(target);
    stat = await fs.stat(real);
  } catch {
    return false;
  }
  if (!real.startsWith(base + path.sep) || !stat.isFile()) return false;
  const ext = path.extname(real).toLowerCase();
  if (!types[ext]) return false;
  res.writeHead(200, {
    "Content-Type": types[ext],
    "Content-Length": stat.size,
    "Cache-Control":
      ext === ".html"
        ? "no-store"
        : decoded.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  const stream = createReadStream(real);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
  return true;
}
