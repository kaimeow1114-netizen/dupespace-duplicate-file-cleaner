import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the DUPESPACE product landing page with canonical SEO metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>DUPESPACE｜重複檔案刪除與清理工具<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/dupespace\.app"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /FAQPage/);
  assert.match(html, /site\.webmanifest/);
  assert.match(html, /線上清理 Google Drive/);
  assert.match(html, /DupeSpace-Setup\.exe/);
  assert.match(html, /ca-pub-7998471640181666/);
  assert.match(html, /<a[^>]+href="\/#features"[^>]*>功能<\/a>/);
  assert.match(html, /translate="no"[^>]*lang="en"[^>]*>DUPE<em>SPACE<\/em>/);
  assert.match(html, /class="headline-line">找出重複檔案，<\/span>/);
  assert.match(html, /FREE • OPEN SOURCE • PRIVACY-FIRST/);
  assert.match(html, /href="\/cleaner"[^>]*>線上清理 Google Drive/);
  assert.match(html, /class="hero-actions"[\s\S]*?href="\/cleaner"[^>]*>線上清理 Google Drive[\s\S]*?href="\/download"[^>]*>了解 Windows 版/);
  assert.match(html, /class="heading-phrase">先確認每份用途，<\/span><wbr\/><span class="heading-phrase">再放心清出空間。<\/span>/);
  assert.match(html, /程式碼專案不碰/);
  assert.match(html, /專案檔案硬性排除，不能解鎖/);
  assert.match(html, /預設移至垃圾桶/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("renders independent trash and permanent-delete safety controls", async () => {
  const response = await render("/cleaner");
  const html = await response.text();
  assert.match(html, /移至垃圾桶/);

  const clientSource = await readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8");
  assert.match(clientSource, /立即永久刪除/);
  assert.match(clientSource, /垃圾桶失敗絕不會自動改成永久刪除/);
  assert.match(clientSource, /永久刪除 \$\{confirmation\.records\.length\} 個檔案/);
  assert.match(clientSource, /records\.length >= 500/);
  assert.match(clientSource, />= GIB/);
  assert.match(clientSource, /MUTATION_BATCH_SIZE = 10/);
  assert.match(clientSource, /downloadCsv/);
  assert.match(clientSource, /!record\.keeper && record\.canTrash/);
  assert.match(clientSource, /選取全部重複副本/);
  assert.match(clientSource, /OPERATION_TIMEOUT_MS = 45_000/);
  assert.match(clientSource, /removeSuccessfulRecords/);
  assert.doesNotMatch(clientSource, /dupespace-muted|dupespace-volume|sound-control/);
  const requestBody = clientSource.slice(clientSource.indexOf("function requestOperation"), clientSource.indexOf("function acceptConfirmation"));
  assert.match(requestBody, /mode === "trash"[\s\S]*executeOperation\("trash", selectedRecords\)/);
  assert.match(requestBody, /return;[\s\S]*setConfirmation/);

  const workerSource = await readFile(new URL("../worker/google-drive.ts", import.meta.url), "utf8");
  assert.match(workerSource, /\/api\/google\/trash/);
  assert.match(workerSource, /\/api\/google\/delete/);
  assert.match(workerSource, /method: "DELETE"/);
  assert.doesNotMatch(workerSource, /trash.*catch[\s\S]{0,200}DELETE/i);
  assert.match(workerSource, /"webViewLink", "thumbnailLink", "parents"/);
  assert.match(workerSource, /driveProjectProtectedIds\(listed\)/);
  assert.match(workerSource, /projectProtected: protectedIds\.size/);
  assert.match(workerSource, /MAX_MUTATION_ITEMS = 20/);
  assert.match(workerSource, /keeperCache/);
  assert.match(workerSource, /result\.trashed !== true/);
  assert.match(workerSource, /path: paths\.get\(file\.id\)/);
});

test("ships PWA, crawler, sitemap and ad declarations", async () => {
  const [manifest, robots, sitemap, ads] = await Promise.all([
    readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
    readFile(new URL("../public/ads.txt", import.meta.url), "utf8"),
  ]);
  assert.match(manifest, /maskable-512x512\.png/);
  assert.match(robots, /Sitemap: https:\/\/dupespace\.app\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/dupespace\.app\/cleaner/);
  assert.match(ads, /google\.com, pub-7998471640181666, DIRECT, f08c47fec0942fa0/);
});

test("uses native navigation links that work in the deployed Worker", async () => {
  const source = await readFile(new URL("../app/components/site-shell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /next\/link|<Link/);
  assert.match(source, /<a href="\/#features">功能<\/a>/);
  assert.match(source, /<a href="\/download">Windows 版<\/a>/);
  assert.doesNotMatch(source, /href=\{download\}>免費下載/);
  assert.match(source, /<a className="nav-cta" href="\/cleaner">/);
});

test("keeps responsive layouts stable and batch sounds bounded", async () => {
  const [css, cleanerSource] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /body\s*\{[^}]*overflow-x:clip/);
  assert.match(css, /@media \(max-width:900px\)/);
  assert.match(css, /@media \(max-width:650px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.brand-name\s*\{[^}]*white-space:nowrap/);
  assert.match(css, /\.headline-line\s*\{[^}]*white-space:nowrap/);
  assert.match(css, /\.heading-phrase\s*\{[^}]*white-space:nowrap/);
  assert.match(css, /line-break:strict/);

  const operationBody = cleanerSource.slice(
    cleanerSource.indexOf("async function executeOperation"),
    cleanerSource.indexOf("function downloadCsv"),
  );
  assert.equal((operationBody.match(/play\(/g) ?? []).length, 3);
  assert.match(operationBody, /for \(const chunk of chunks\)/);
  assert.doesNotMatch(operationBody, /for \(const outcome of body\.outcomes\)[\s\S]{0,180}play\(/);
});

test("renders legal and cleaner routes with security headers", async () => {
  for (const path of ["/cleaner", "/download", "/privacy", "/terms", "/support"]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.match(response.headers.get("x-content-type-options") ?? "", /nosniff/);
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  }
});

test("excludes AdSense from the cleaner and safely redirects legacy hosts", async () => {
  const cleaner = await render("/cleaner");
  assert.doesNotMatch(await cleaner.text(), /adsbygoogle\.js/);

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("redirect-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const redirect = await worker.fetch(new Request("https://dupesweep.app/support?q=1"), env, ctx);
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "https://dupespace.app/support?q=1");
  const rejected = await worker.fetch(new Request("https://dupesweep.app/api/google/scan", { method: "POST" }), env, ctx);
  assert.equal(rejected.status, 409);
  const newSite = await worker.fetch(new Request("https://dupespace.app/"), env, ctx);
  assert.equal(newSite.status, 200);
});

test("keeps Google Drive API disconnected until an encrypted session exists", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("https://dupespace.example/api/google/status"),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "not-a-real-secret",
      SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters",
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { connected: false, configured: true, user: null });
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);

  const workerSource = await readFile(new URL("../worker/google-drive.ts", import.meta.url), "utf8");
  assert.match(workerSource, /SESSION_MAX_AGE_SECONDS = 30 \* 60/);
  assert.doesNotMatch(workerSource, /30 \* 86400/);

  const unconfigured = await worker.fetch(
    new Request("https://dupespace.example/api/google/status"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(unconfigured.status, 200);
  assert.deepEqual(await unconfigured.json(), { connected: false, configured: false });
});

test("renders a dedicated Windows download explanation page", async () => {
  const response = await render("/download");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /下載 DupeSpace-Setup\.exe/);
  assert.match(html, /保留區永遠不刪/);
  assert.match(html, /程式碼專案硬性排除/);
  assert.match(html, /rel="canonical" href="https:\/\/dupespace\.app\/download"/);
});
