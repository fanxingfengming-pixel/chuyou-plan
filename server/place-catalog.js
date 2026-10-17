import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
const normalize = (s) =>
  String(s || "")
    .trim()
    .replace(/市$/, "");
export function createPlaceCatalog(
  file = path.resolve("data/place-catalog.sqlite"),
) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file, { timeout: 3000 });
  db.exec(
    "PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, city TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, checked_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS places_city ON places(city); CREATE TABLE IF NOT EXISTS areas (city TEXT PRIMARY KEY, ids TEXT NOT NULL); CREATE TABLE IF NOT EXISTS queries (city TEXT NOT NULL, query TEXT NOT NULL, ids TEXT NOT NULL, PRIMARY KEY(city,query)); CREATE TABLE IF NOT EXISTS timings (operation TEXT NOT NULL, elapsed REAL NOT NULL)",
  );
  const read = (row) => {
    if (!row) return null;
    try {
      return {
        ...JSON.parse(row.payload),
        loadedFrom: "catalog",
        checkedAt: row.checked_at,
      };
    } catch {
      return null;
    }
  };
  const valid = (p) =>
    p &&
    typeof p.id === "string" &&
    p.source === "live" &&
    typeof p.name === "string" &&
    p.name.trim() &&
    typeof p.city === "string" &&
    typeof p.district === "string" &&
    p.district &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    ["景点", "商圈"].includes(p.type);
  function put(p) {
    if (!valid(p)) throw new Error("INVALID_CATALOG_PLACE");
    const date = new Date().toISOString();
    db.prepare(
      "INSERT INTO places VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET city=excluded.city,name=excluded.name,type=excluded.type,payload=excluded.payload,checked_at=excluded.checked_at",
    ).run(p.id, normalize(p.city), p.name, p.type, JSON.stringify(p), date);
    return get(p.id);
  }
  function get(id) {
    return read(db.prepare("SELECT * FROM places WHERE id=?").get(id));
  }
  function byIds(ids) {
    return ids.map(get).filter(Boolean);
  }
  function areas(city) {
    const row = db
      .prepare("SELECT ids FROM areas WHERE city=?")
      .get(normalize(city));
    return row ? byIds(JSON.parse(row.ids)) : [];
  }
  function setAreas(city, places) {
    if (!places.length) return;
    db.exec("BEGIN");
    try {
      places.forEach(put);
      db.prepare("INSERT OR REPLACE INTO areas VALUES (?,?)").run(
        normalize(city),
        JSON.stringify([...new Set(places.map((p) => p.id))]),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function search(city, query) {
    const c = normalize(city),
      q = String(query || "").trim();
    if (!q) return [];
    const row = db
      .prepare("SELECT ids FROM queries WHERE city=? AND query=?")
      .get(c, q);
    if (row) return byIds(JSON.parse(row.ids));
    return db
      .prepare("SELECT * FROM places WHERE city=? ORDER BY name")
      .all(c)
      .filter((r) => r.name.includes(q))
      .map(read)
      .filter(Boolean);
  }
  function remember(city, query, places) {
    if (!places.length) return;
    places.forEach(put);
    db.prepare("INSERT OR REPLACE INTO queries VALUES (?,?,?)").run(
      normalize(city),
      String(query).trim(),
      JSON.stringify(places.map((p) => p.id)),
    );
  }
  function timing(operation, elapsed) {
    db.prepare("INSERT INTO timings VALUES (?,?)").run(operation, elapsed);
    db.prepare(
      "DELETE FROM timings WHERE operation=? AND rowid NOT IN (SELECT rowid FROM timings WHERE operation=? ORDER BY rowid DESC LIMIT 30)",
    ).run(operation, operation);
  }
  function estimate(operation) {
    const a = db
      .prepare("SELECT elapsed FROM timings WHERE operation=? ORDER BY elapsed")
      .all(operation)
      .map((r) => r.elapsed);
    return a.length < 5
      ? null
      : [
          a[Math.floor((a.length - 1) * 0.25)],
          a[Math.ceil((a.length - 1) * 0.85)],
        ];
  }
  return {
    put,
    get,
    areas,
    setAreas,
    search,
    remember,
    timing,
    estimate,
    all: () =>
      db
        .prepare("SELECT * FROM places ORDER BY city,type,name")
        .all()
        .map(read),
    close: () => db.close(),
  };
}
let singleton;
export const getPlaceCatalog = () => (singleton ||= createPlaceCatalog());
const pending = new Map();
export function sharePlaceQuery(key, signal, work) {
  if (signal?.aborted)
    return Promise.reject(new DOMException("查询已取消", "AbortError"));
  let entry = pending.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, users: 0 };
    entry.promise = work(controller.signal).finally(() => pending.delete(key));
    pending.set(key, entry);
  }
  entry.users++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      entry.users--;
      if (!entry.users) entry.controller.abort();
      fn(value);
    };
    const abort = () =>
      finish(reject, new DOMException("查询已取消", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    entry.promise.then(
      (v) => finish(resolve, v),
      (e) => finish(reject, e),
    );
  });
}
