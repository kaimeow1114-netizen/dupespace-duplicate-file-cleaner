import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const { default: worker } = await import("../dist/server/index.js");
  return worker.fetch(new Request(`https://dupespace.app${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}
test("home purpose is server rendered, local-first, full bleed and preserves motion", async () => {
  const response = await render(); assert.equal(response.status, 200);
  const html = await response.text();
  for (const value of ["DUPESPACE", "免費", "免登入", "不上傳到伺服器", "功能特色", "線上檔案工具", "hero-grid", "dashboard-demo", "motion-steps", "FAQPage", "SoftwareApplication", "href=\"/privacy\""]) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /Google Drive|DUPESWEEP|DupeSpace/);
  assert.match(html, /href="\/local"/);
  assert.match(html, /rel="canonical" href="https:\/\/dupespace\.app\/?"/);
  assert.match(html, /translate="no"/);
});
test("all English content pages are real localized HTML with canonical alternates", async () => {
  for (const path of ["/en/", "/en/merge/", "/en/local/", "/en/download/", "/en/support/", "/en/privacy/", "/en/terms/"]) {
    const response = await render(path); assert.equal(response.status, 200, path);
    const html = await response.text(); assert.match(html, /<html lang="en"/, path); assert.ok(html.includes(`href="https://dupespace.app${path}"`), path);
    assert.match(html, /hreflang="zh-TW"/i, path); assert.doesNotMatch(html, /Google Drive duplicate file cleaner/, path);
  }
});
test("private analyzer routes including trailing slash exclude ads and external scripts", async () => {
  for (const path of ["/local", "/local/", "/en/local/", "/merge", "/en/merge/"]) {
    const response = await render(path);
    const csp = response.headers.get("content-security-policy"); assert.match(csp, /connect-src 'self';/); assert.match(csp, /frame-src 'none'/); assert.match(csp, /worker-src 'self'/); assert.doesNotMatch(csp, /strict-dynamic|unsafe-inline.*script-src/);
    if (path === "/local/") { assert.equal(response.status, 308); assert.equal(response.headers.get("location"), "/local"); continue; }
    assert.equal(response.status, 200, path);
    const html = await response.text(); assert.doesNotMatch(html, /src="https:\/\/pagead2|src="https:\/\/.*\.js/); assert.match(html, /webkitdirectory/);
  }
});
test("ads on public content routes use fresh CSP nonces", async () => {
  for (const path of ["/", "/download", "/support", "/en/", "/en/download/", "/en/support/"]) {
    const response = await render(path); const html = await response.text();
    assert.match(html, /adsbygoogle\.js\?client=ca-pub-7998471640181666/, path);
    const nonce = response.headers.get("content-security-policy").match(/'nonce-([^']+)'/)[1];
    assert.match(response.headers.get("content-security-policy"), /strict-dynamic/);
    assert.ok(html.includes(`nonce="${nonce}"`), path);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(scripts.every((script) => script.includes(`nonce="${nonce}"`)), `script missing nonce: ${path}`);
  }
  const a = await render(); const b = await render(); assert.notEqual(a.headers.get("content-security-policy"), b.headers.get("content-security-policy"));
});
test("old cleaner is noindex migration, not a working cloud client", async () => {
  for (const path of ["/cleaner", "/en/cleaner/"]) {
    const response = await render(path); const html = await response.text(); assert.equal(response.status, 200); assert.match(html, /noindex/); assert.doesNotMatch(html, /adsbygoogle\.js/);
  }
  for (const path of ["/api/google/scan", "/api/google/trash", "/api/google/delete"]) assert.equal((await render(path)).status, 410);
});
test("PWA, crawler and publisher assets retain correct declarations", async () => {
  assert.equal((await readFile(new URL("../public/ads.txt", import.meta.url), "utf8")).trim(), "google.com, pub-7998471640181666, DIRECT, f08c47fec0942fa0");
  const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"); assert.match(sitemap, /dupespace.app\/merge/); assert.match(sitemap, /dupespace.app\/en\/merge/); assert.match(sitemap, /dupespace.app\/local/); assert.match(sitemap, /dupespace.app\/en\/local/); assert.doesNotMatch(sitemap, /dupesweep|\/cleaner/);
  const manifest = JSON.parse(await readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8")); assert.equal(manifest.start_url, "/merge");
});
test("download pages expose accurate SoftwareApplication data without invented ratings", async () => {
  for (const path of ["/download", "/en/download/"]) {
    const response = await render(path); assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /SoftwareApplication/); assert.match(html, /UtilitiesApplication/);
    assert.match(html, /DupeSpace-Setup\.exe/); assert.doesNotMatch(html, /aggregateRating|reviewRating/);
  }
});
test("bounded previews, pagination and cancellation remain explicit", async () => {
  const source = await readFile(new URL("../app/components/local-analyzer.tsx", import.meta.url), "utf8");
  assert.match(source, /groups\.slice\(page \* 20, \(page \+ 1\) \* 20\)/); assert.match(source, /controller.current \|\| !selected.length/); assert.match(source, /loading="lazy"/); assert.match(source, /12 \* 1024 \* 1024/);
  assert.doesNotMatch(source, /<video|fetch\(/);
  assert.match(source, /findLocalDuplicatesInWorker/);
  const workerSource = await readFile(new URL("../workers/local-analysis.worker.ts", import.meta.url), "utf8");
  assert.match(workerSource, /findLocalDuplicates/);
  assert.doesNotMatch(workerSource, /fetch\(|XMLHttpRequest|sendBeacon|createWritable|removeEntry|indexedDB|localStorage/);
});
test("folder merge preview is server rendered, bilingual, private and clearly read-only", async () => {
  for (const [path, phrase] of [["/merge", "合併資料夾前"], ["/en/merge/", "before you merge"]]) {
    const response = await render(path); assert.equal(response.status, 200, path);
    const html = await response.text(); assert.ok(html.includes(phrase), path);
    assert.equal((html.match(/webkitdirectory/g) ?? []).length, 2, path);
    assert.doesNotMatch(html, /adsbygoogle\.js|Google Drive/, path);
    assert.match(html, /唯讀預演|Read-only preview/, path);
  }
  const source = await readFile(new URL("../app/components/merge-analyzer.tsx", import.meta.url), "utf8");
  assert.match(source, /shown\.slice\(page \* PAGE_SIZE, \(page \+ 1\) \* PAGE_SIZE\)/);
  assert.match(source, /12 \* 1024 \* 1024/);
  assert.doesNotMatch(source, /<video|fetch\(/);
  assert.match(source, /compareFoldersInWorker/);
  const workerSource = await readFile(new URL("../workers/folder-merge.worker.ts", import.meta.url), "utf8");
  assert.match(workerSource, /compareFolders/);
  assert.doesNotMatch(workerSource, /fetch\(|XMLHttpRequest|sendBeacon|createWritable|removeEntry|indexedDB|localStorage/);
});
test("English 404 remains English, noindex, and safely framed", async () => {
  const response = await render("/en/not-a-real-page/"); assert.equal(response.status, 404);
  const html = await response.text(); assert.match(html, /This page could not be found/); assert.match(html, /noindex/); assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("bilingual guides have article-specific metadata, breadcrumbs and reciprocal language links", async () => {
  for (const slug of ["duplicate-photos", "safe-windows-cleanup", "merge-folders-without-duplicates"]) {
    for (const prefix of ["", "/en"]) {
      const path = `${prefix}/guides/${slug}${prefix ? "/" : ""}`;
      const response = await render(path); assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.ok(html.includes(`rel="canonical" href="https://dupespace.app${path}"`), path);
      assert.match(html, /BreadcrumbList/); assert.match(html, /"@type":"Article"/);
      assert.match(html, /hreflang="zh-TW"/i); assert.match(html, /hreflang="en"/i);
      assert.doesNotMatch(html, /property="og:image"|name="twitter:image"/);
      assert.ok(html.includes(prefix ? `href="/guides/${slug}"` : `href="/en/guides/${slug}/"`));
      assert.match(html, /adsbygoogle\.js\?client=ca-pub-7998471640181666/);
      assert.ok((html.match(/<h2/g) ?? []).length >= 4);
    }
  }
  assert.equal((await render("/guides/not-real")).status, 404);
});

test("each Chinese content page has its own share URL and purpose-specific description", async () => {
  const descriptions = new Set();
  for (const path of ["/local", "/download", "/support", "/privacy", "/terms"]) {
    const html = await (await render(path)).text();
    assert.ok(html.includes(`property="og:url" content="https://dupespace.app${path}"`), path);
    const description = html.match(/name="description" content="([^"]+)"/)?.[1];
    assert.ok(description, path); descriptions.add(description);
    assert.ok(html.includes(`href="/en${path}/"`), path);
  }
  assert.equal(descriptions.size, 5);
});

test("marketing stays accurate and vendor details stay in the privacy policy", async () => {
  const home = await (await render()).text();
  assert.doesNotMatch(home, /也不載入 AdSense 或第三方分析程式|本機檔案智慧工具|傳統清理工具/);
  assert.match(home, /資料夾合併核對與重複檔案工具/);
  assert.match(home, /FILE INTELLIGENCE/);
  assert.doesNotMatch(home, /規劃中/);
  assert.match(home, /目前不提供相似照片搜尋/);
  assert.match(await (await render("/en/")).text(), /Not another duplicate list/);
  const privacy = await (await render("/privacy")).text();
  assert.match(privacy, /AdSense/); assert.match(privacy, /Cookie/);
});

test("Space Notes routes render bilingual articles, metadata, disclosure and ads", async () => {
  const paths = [
    ["/blog", "把檔案與軟體問題"],
    ["/en/blog/", "Practical guidance"],
    ["/blog/find-renamed-duplicate-files", "檔案改名後還是同一份"],
    ["/en/blog/find-renamed-duplicate-files/", "Are renamed files still duplicates"],
    ["/blog/editorial-policy", "信任不是口號"],
    ["/en/blog/editorial-policy/", "Trust starts with a visible method"],
  ];
  for (const entry of paths) {
    const response = await render(entry[0]);
    assert.equal(response.status, 200, entry[0]);
    const html = await response.text();
    assert.ok(html.includes(entry[1]), entry[0]);
    assert.match(html, /adsbygoogle\.js\?client=ca-pub-7998471640181666/, entry[0]);
    assert.match(html, /href="\/(?:en\/)?blog/, entry[0]);
  }
  const article = await (await render("/blog/find-renamed-duplicate-files")).text();
  assert.match(article, /BlogPosting/);
  assert.match(article, /BreadcrumbList/);
  assert.match(article, /網站所有權與廣告揭露/);
  assert.match(article, /hreflang="en"/i);
  assert.doesNotMatch(article, /property="og:image"|name="twitter:image"/);
});
