import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(
  "C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/",
);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const origin = process.env.PDF_QA_ORIGIN || "http://127.0.0.1:5173";
const draft = JSON.parse(
  readFileSync("artifacts/pdf/sample-draft.json", "utf8"),
);
const results = [];
async function context(width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    acceptDownloads: true,
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(
    (draft) => localStorage.setItem("tripDraft", JSON.stringify(draft)),
    draft,
  );
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(origin + "/plan/route");
  await page
    .getByRole("button", { name: "下载行程 PDF", exact: true })
    .waitFor();
  return { ctx, page };
}
try {
  for (const width of [1440, 390]) {
    const { ctx, page } = await context(width, width === 1440 ? 1050 : 844);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const fontRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("/fonts/Noto"))
        fontRequests.push(request.url());
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(fontRequests.length, 0);
    const section = page.locator(".trip-pdf-export");
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/pdf/export-${width}.png` });
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem("tripDraft")).routeDraft,
    );
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "下载行程 PDF", exact: true })
      .click();
    const download = await downloadPromise;
    assert.match(
      download.suggestedFilename(),
      /^出游plan_杭州行程_2026-10-18\.pdf$/,
    );
    await download.saveAs(`artifacts/pdf/browser-${width}.pdf`);
    await page
      .getByRole("status")
      .filter({ hasText: "PDF 已生成并发起下载" })
      .waitFor();
    assert.deepEqual(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("tripDraft")).routeDraft,
      ),
      before,
    );
    assert.equal(fontRequests.length, 1);
    assert.deepEqual(errors, []);
    // A user move must be preserved by the next export, without regenerating.
    if (width === 1440) {
      const name = draft.routeDraft.days[0].stops[0].name;
      await page
        .getByLabel("移动" + name + "到", { exact: true })
        .selectOption("3");
      const changed = await page.evaluate(
        () => JSON.parse(localStorage.getItem("tripDraft")).routeDraft,
      );
      assert.equal(changed.days[2].stops[0].name, name);
      await section.scrollIntoViewIfNeeded();
      const [nextDownload] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "下载行程 PDF", exact: true }).press("Enter"),
      ]);
      await nextDownload.saveAs("artifacts/pdf/browser-edited.pdf");
      assert.deepEqual(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("tripDraft")).routeDraft,
        ),
        changed,
      );
      assert.equal(fontRequests.length, 1, "reuse font on subsequent export");
    }
    results.push({
      width,
      noHorizontalOverflow: true,
      actualDownload: true,
      routeUnchangedByExport: true,
      fontLoadedOnlyOnExport: true,
      consoleErrors: errors,
    });
    await ctx.close();
  }
  // Recover from a real failed font request, then download successfully.
  const { ctx, page } = await context(390, 844);
  let failFont = true;
  await page.route("**/fonts/NotoSansSC-Regular.ttf", (route) =>
    failFont
      ? route.fulfill({ status: 503, body: "temporarily unavailable" })
      : route.continue(),
  );
  await page.getByRole("button", { name: "下载行程 PDF", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "中文字体加载失败" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "下载行程 PDF", exact: true })
      .isEnabled(),
    true,
  );
  failFont = false;
  const retryPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载行程 PDF", exact: true }).click();
  await (await retryPromise).saveAs("artifacts/pdf/browser-retry.pdf");
  results.push({ fontFailureShown: true, retryDownloadPassed: true });
  await ctx.close();
  // Before route generation the export action must stay unavailable.
  const empty = await browser.newContext();
  await empty.addInitScript(
    (d) =>
      localStorage.setItem(
        "tripDraft",
        JSON.stringify({ ...d, routeDraft: null }),
      ),
    draft,
  );
  const emptyPage = await empty.newPage();
  await emptyPage.goto(origin + "/plan/route");
  await emptyPage
    .getByRole("button", { name: "开始规划路线", exact: true })
    .waitFor();
  assert.equal(
    await emptyPage
      .getByRole("button", { name: "下载行程 PDF", exact: true })
      .count(),
    0,
  );
  results.push({ noExportBeforeRoute: true });
  await empty.close();
  writeFileSync(
    "artifacts/pdf/browser-checks.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
 } catch (error) {
  for (const ctx of browser.contexts()) for (const page of ctx.pages()) console.log("Failure state:", await page.locator(".trip-pdf-export").innerText().catch(() => "missing export section"));
  throw error;
} finally {
  await browser.close();
}
