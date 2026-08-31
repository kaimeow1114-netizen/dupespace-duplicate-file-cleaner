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

test("English missing pages remain English and are not indexable", async () => {
  const response = await render("/en/this-page-does-not-exist/");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /This page could not be found/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /這裡沒有重複檔案/);
});

test("renders the DUPESPACE product landing page with canonical SEO metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>DUPESPACE｜開源的 Google Drive 與 Windows 重複檔案清理工具<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/dupespace\.app"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /FAQPage/);
  assert.match(html, /site\.webmanifest/);
  assert.match(html, /開始極速安全掃描/);
  assert.match(html, /motion-steps/);
  assert.match(html, /ca-pub-7998471640181666/);
  assert.match(html, /<a[^>]+href="\/#features"[^>]*>功能特色<\/a>/);
  assert.match(html, /translate="no"[^>]*lang="en"[^>]*>DUPE<em>SPACE<\/em>/);
  assert.match(html, /class="headline-line">精確比對內容，<\/span>/);
  assert.match(html, /class="hero"[\s\S]{0,200}class="shell hero-grid"/);
  assert.doesNotMatch(html, /class="hero shell"/);
  assert.match(html, /DUPESPACE 是一套免費、開源的重複檔案清理工具/);
  assert.match(html, /重複檔案與重複資料夾/);
  assert.match(html, /href="\/privacy">隱私權政策<\/a>/);
  assert.match(html, /FREE • OPEN SOURCE • PRIVACY-FIRST/);
  assert.match(html, /href="\/cleaner"[\s\S]{0,300}開始極速安全掃描/);
  assert.match(html, /class="hero-actions"[\s\S]*?href="\/cleaner"[\s\S]*?開始極速安全掃描[\s\S]*?href="\/download"[\s\S]*?下載 Windows 用戶端/);
  assert.match(html, /都有清楚的安全邊界/);
  assert.match(html, /代碼專案自動排除/);
  assert.match(html, /專案與套件環境硬性排除/);
  assert.match(html, /預設移至垃圾桶/);
  assert.match(html, /dashboard-demo/);
  assert.match(html, /Google Limited Use 承諾/);
  assert.match(html, /資料不出售、不提供給 AdSense、不用於廣告個人化/);
  assert.doesNotMatch(html, /DupeSpace|DUPESWEEP/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("renders independent trash and permanent-delete safety controls", async () => {
  const response = await render("/cleaner");
  const html = await response.text();
  assert.match(html, /移至垃圾桶/);

  const clientSource = await readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8");
  assert.match(clientSource, /立即永久刪除/);
  assert.match(clientSource, /垃圾桶失敗絕不會自動改成永久刪除/);
  assert.match(clientSource, /我了解以上重複檔案會永久刪除/);
  assert.match(clientSource, /disabled=\{!acknowledged \|\| countdown > 0\}/);
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
  assert.doesNotMatch(workerSource, /keeperCache/);
  assert.match(workerSource, /result\.trashed !== true/);
  assert.match(workerSource, /path: paths\.get\(file\.id\)/);
  assert.match(workerSource, /folderManifests/);
  assert.match(workerSource, /資料夾內容已變更，操作已取消/);
  assert.match(workerSource, /資料夾只能移至 Google Drive 垃圾桶/);
  assert.match(workerSource, /SYSTEM_METADATA_NAMES/);
  assert.match(clientSource, /SIDE-BY-SIDE TREE DIFF/);
  assert.match(clientSource, /100% 鏡像對齊/);
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
  const html = await (await render()).text();
  assert.match(html, /<a href="\/#features">功能特色<\/a>/);
  assert.match(html, /<a href="\/download">Windows 客戶端<\/a>/);
  assert.doesNotMatch(source, /href=\{download\}>免費下載/);
  assert.match(html, /<a class="nav-cta" href="\/cleaner">/);
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
  assert.match(css, /\.shell\s*\{[^}]*1360px/);
  assert.match(css, /\.hero-grid\s*\{[^}]*grid-template-columns/);
  assert.match(css, /\.hero\s*\{[^}]*width:100%/);
  assert.doesNotMatch(css, /\.hero\s*\{[^}]*border-radius/);

  const operationBody = cleanerSource.slice(
    cleanerSource.indexOf("async function executeOperation"),
    cleanerSource.indexOf("async function undoTrash"),
  );
  assert.equal((operationBody.match(/play\(/g) ?? []).length, 2);
  assert.match(operationBody, /for \(const chunk of chunks\)/);
  assert.doesNotMatch(operationBody, /for \(const outcome of body\.outcomes\)[\s\S]{0,180}play\(/);
});

test("ships the high-fidelity motion system with an accessible static fallback", async () => {
  const [dashboard, showcase, lowerPage, css] = await Promise.all([
    readFile(new URL("../app/components/hero-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/motion-showcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/lower-page-motion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /scale: 0\.9/);
  assert.match(dashboard, /type: "spring"/);
  assert.match(dashboard, /animate\(0, 18\.6/);
  assert.match(dashboard, /className="hash-particles"/);
  assert.match(dashboard, /useReducedMotion/);
  assert.match(showcase, /viewport=\{\{ once: true, amount: 0\.25 \}\}/);
  assert.match(showcase, /staggerChildren: 0\.1/);
  assert.match(showcase, /whileHover=\{reducedMotion \? undefined : \{ y: -3 \}\}/);
  assert.match(showcase, /--glow-x/);
  assert.match(showcase, /useSpring/);
  assert.match(lowerPage, /export function StorageIntelligenceMotion/);
  assert.match(lowerPage, /className="trend-line"/);
  assert.match(lowerPage, /export function PrivacyFlowMotion/);
  assert.match(lowerPage, /DATA BOUNDARY/);
  assert.match(lowerPage, /export function TrustMatrixMotion/);
  assert.match(lowerPage, /AnimatePresence/);
  assert.match(lowerPage, /useReducedMotion/);
  assert.match(css, /\.hash-particles/);
  assert.match(css, /\.intelligence-bento/);
  assert.match(css, /\.privacy-flow-card/);
  assert.match(css, /\.faq-motion-list/);
  assert.match(css, /\.magnetic-surface::before/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);

  const response = await render();
  const html = await response.text();
  assert.match(html, /DUPESPACE 是一套免費、開源的重複檔案清理工具/);
  assert.match(html, /代碼專案自動排除/);
  assert.match(html, /儀表板示意 · 可安全釋放/);
});

test("ships health scoring, persistent session status and a real trash restore path", async () => {
  const [healthSource, clientSource, workerSource] = await Promise.all([
    readFile(new URL("../lib/health-score.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/google-drive.ts", import.meta.url), "utf8"),
  ]);
  assert.match(healthSource, /const bands/);
  assert.match(clientSource, /scan && <motion.div className="scan-insights"/);
  assert.match(clientSource, /AnimatedNumber/);
  assert.doesNotMatch(healthSource, /duplicateGroups >= 50/);
  assert.match(clientSource, /fetch\("\/api\/auth\/session"/);
  assert.match(clientSource, /expiresAt: Date\.now\(\) \+ 10_000/);
  assert.match(clientSource, /readJsonWithTimeout\("\/api\/google\/restore"/);
  assert.match(workerSource, /url\.pathname === "\/api\/auth\/session"/);
  assert.match(workerSource, /url\.pathname === "\/api\/google\/restore"/);
  assert.match(workerSource, /verifyProof\(item\.proof/);
  assert.match(workerSource, /JSON\.stringify\(\{ trashed: false \}\)/);
  assert.match(workerSource, /protectedProfile !== "strict"/);
  assert.match(workerSource, /protectedProfile === "project"/);
  assert.doesNotMatch(workerSource, /restore[\s\S]{0,1800}method: "DELETE"/);
});

test("keeps large duplicate results typed, ordered and preview-light", async () => {
  const [clientSource, css] = await Promise.all([
    readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(clientSource, /\["video", "image", "pdf", "document", "audio", "folder", "archive", "other"\]/);
  assert.match(clientSource, /categoryDifference[\s\S]{0,180}right\.reclaimableBytes - left\.reclaimableBytes/);
  assert.match(clientSource, /expanded && <div className="group-body">/);
  assert.match(clientSource, /keeper\?\.thumbnailLink/);
  assert.doesNotMatch(clientSource, /record\.thumbnailLink/);
  assert.match(clientSource, /current\.has\(key\) \? new Set\(\) : new Set\(\[key\]\)/);
  assert.match(clientSource, /recordLimits\[key\] \?\? 40/);
  assert.match(clientSource, /setVisibleGroups\(18\)/);
  assert.match(css, /\.cleaner-wrap\s*\{[^}]*1680px/);
  assert.match(css, /\.group-comparison\s*\{[^}]*grid-template-columns/);
  assert.match(css, /\.keeper-visual\s*\{[^}]*aspect-ratio:4\/3/);
  assert.match(clientSource, /\/\^\[=\+\\-@\\t\\r\\n\]\//);
});

test("presents Google Drive and recoverable Windows cleanup without an alarming metadata toggle", async () => {
  const [response, cleanerSource, css] = await Promise.all([
    render("/cleaner"),
    readFile(new URL("../app/components/cleaner-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  assert.match(html, /Google Drive 線上清理/);
  assert.match(html, /Windows 本機資料夾/);
  assert.match(html, /href="\/download"/);
  assert.match(html, /不在瀏覽器中永久移除 Windows 檔案/);
  assert.doesNotMatch(html, /進階：忽略系統暫存檔/);
  assert.doesNotMatch(cleanerSource, /setIgnoreSystemMetadata|className="metadata-option"/);
  assert.match(cleanerSource, /ignoreSystemMetadata: false/);
  assert.match(css, /\.cleaner-source-switch\s*\{[^}]*grid-template-columns:1fr 1fr/);
});

test("renders a valid English alternate and keeps interface source free of emoji", async () => {
  const redirect = await render("/en");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "http://localhost/en/");
  const response = await render("/en/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /DUPESPACE is a free, open-source/);
  assert.match(html, /hrefLang="en" href="https:\/\/dupespace\.app\/en\/"/);
  assert.match(html, /<html lang="en"/);
  const sources = await Promise.all([
    "page.tsx", "components/cleaner-client.tsx", "components/hero-dashboard.tsx",
    "components/motion-showcase.tsx", "components/lower-page-motion.tsx", "components/site-shell.tsx", "components/github-stars.tsx",
  ].map((path) => readFile(new URL(`../app/${path}`, import.meta.url), "utf8")));
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const source of sources) assert.doesNotMatch(source, emoji);
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

test("English routes have real server-rendered content, matching alternates and no cleaner ads", async () => {
  for (const path of ["cleaner", "download", "privacy", "support", "terms"]) {
    const response = await render(`/en/${path}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html lang="en"/);
    assert.ok(html.includes(`rel="canonical" href="https://dupespace.app/en/${path}/"`));
    assert.ok(html.includes(`hrefLang="zh-TW" href="https://dupespace.app/${path}"`));
    assert.match(html, /<h1[^>]*>[^<]+/);
    if (path === "cleaner") assert.doesNotMatch(html, /pagead2\.googlesyndication\.com\/pagead\/js/);
  }
  const redirect = await render("/en/cleaner?connected=1");
  assert.equal(redirect.headers.get("location"), "http://localhost/en/cleaner/?connected=1");
});

test("excludes AdSense from the cleaner and safely redirects legacy hosts", async () => {
  const homepage = await render("/");
  const homepageHtml = await homepage.text();
  assert.match(homepageHtml, /https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-7998471640181666/);
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

test("publishes explicit Google Limited Use disclosures", async () => {
  const [homepage, privacy] = await Promise.all([render("/"), render("/privacy")]);
  const [homepageHtml, privacyHtml] = await Promise.all([homepage.text(), privacy.text()]);
  assert.match(homepageHtml, /Google API Services User Data Policy/);
  assert.match(homepageHtml, /不提供給 AdSense/);
  assert.match(privacyHtml, /Google API Services User Data Policy 與 Limited Use/);
  assert.match(privacyHtml, /不會提供給 AdSense 或其他廣告系統/);
  assert.match(privacyHtml, /不會用於個人化廣告/);
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
  assert.match(workerSource, /SESSION_MAX_AGE_SECONDS = 30 \* 86400/);
  assert.match(workerSource, /https:\/\/oauth2\.googleapis\.com\/revoke/);

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
  assert.match(html, /每組鎖定最舊檔/);
  assert.match(html, /子資料夾設為永遠不可勾選/);
  assert.match(html, /程式碼專案硬性排除/);
  assert.match(html, /v1\.1\.0 起可在側邊欄檢查更新/);
  assert.match(html, /核對 GitHub Release 的檔案大小與 SHA-256/);
  assert.match(html, /rel="canonical" href="https:\/\/dupespace\.app\/download"/);
});

async function oauthHarness() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("oauth-test", crypto.randomUUID());
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "not-a-real-secret",
    SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters",
  };
  return (path, init) => worker.fetch(
    new Request(`https://dupespace.example${path}`, init),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function responseCookie(response, name) {
  const value = response.headers.getSetCookie().find((item) => item.startsWith(`${name}=`));
  assert.ok(value, `Expected ${name} cookie`);
  assert.match(value, /; HttpOnly;/);
  assert.match(value, /; SameSite=Lax;/);
  assert.match(value, /; Secure/);
  return value.split(";")[0];
}

test("requests only Drive access without unused identity or incremental scopes", async () => {
  const request = await oauthHarness();
  const response = await request("/api/google/start");
  assert.equal(response.status, 302);
  const auth = new URL(response.headers.get("location"));
  assert.equal(auth.origin, "https://accounts.google.com");
  assert.equal(auth.searchParams.get("scope"), "https://www.googleapis.com/auth/drive");
  assert.equal(auth.searchParams.get("include_granted_scopes"), "false");
  assert.equal(auth.searchParams.get("access_type"), "offline");
  assert.equal(auth.searchParams.get("redirect_uri"), "https://dupespace.example/api/google/callback");
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  assert.match(auth.searchParams.get("code_challenge"), /^[\w-]{43}$/);
  assert.match(auth.searchParams.get("state"), /^[\w-]{43}$/);
  responseCookie(response, "dupespace_oauth");
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("Drive-only login refreshes, displays the account, disconnects and reconnects without ID tokens", async (t) => {
  const request = await oauthHarness();
  const start = await request("/api/google/start");
  const auth = new URL(start.headers.get("location"));
  const calls = [];
  const user = { displayName: "Demo User", emailAddress: "demo@example.com" };
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.origin}${url.pathname}`);
    if (url.href === "https://oauth2.googleapis.com/token") {
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("client_id"), "test.apps.googleusercontent.com");
      if (body.get("grant_type") === "authorization_code") {
        const verifier = body.get("code_verifier");
        assert.ok(verifier);
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
        assert.equal(Buffer.from(digest).toString("base64url"), auth.searchParams.get("code_challenge"));
        return Response.json({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: 0 });
      }
      assert.equal(body.get("grant_type"), "refresh_token");
      assert.equal(body.get("refresh_token"), "synthetic-refresh");
      return Response.json({ access_token: "synthetic-refreshed", expires_in: 3600 });
    }
    if (url.origin === "https://www.googleapis.com" && url.pathname === "/drive/v3/about") {
      assert.equal(url.searchParams.get("fields"), "user(permissionId,displayName,emailAddress,photoLink)");
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer synthetic-refreshed");
      return Response.json({ user });
    }
    if (url.href === "https://oauth2.googleapis.com/revoke") {
      assert.equal(new URLSearchParams(init.body).get("token"), "synthetic-refresh");
      return new Response(null, { status: 200 });
    }
    assert.fail(`Unexpected outbound request: ${url.origin}${url.pathname}`);
  });
  const callback = await request(`/api/google/callback?code=synthetic-code&state=${auth.searchParams.get("state")}`, {
    headers: { cookie: responseCookie(start, "dupespace_oauth") },
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "https://dupespace.example/cleaner?connected=1");
  const sessionCookie = responseCookie(callback, "dupespace_session");
  assert.doesNotMatch(sessionCookie, /synthetic|demo@example/);
  const account = await request("/api/auth/session", { headers: { cookie: sessionCookie } });
  assert.equal(account.status, 200);
  assert.deepEqual(await account.json(), { connected: true, configured: true, user, cacheKey: null });
  assert.match(account.headers.get("cache-control"), /no-store/);
  const renewedCookie = responseCookie(account, "dupespace_session");
  const revisited = await request("/api/auth/session", { headers: { cookie: renewedCookie } });
  assert.deepEqual(await revisited.json(), { connected: true, configured: true, user, cacheKey: null });
  const disconnected = await request("/api/google/disconnect", {
    method: "POST",
    headers: { cookie: renewedCookie, origin: "https://dupespace.example" },
  });
  assert.deepEqual(await disconnected.json(), { connected: false });
  assert.match(disconnected.headers.get("set-cookie"), /Max-Age=0/);
  const signedOut = await request("/api/auth/session");
  assert.deepEqual(await signedOut.json(), { connected: false, configured: true, user: null });
  const reconnect = await request("/api/google/start");
  const reauth = new URL(reconnect.headers.get("location"));
  assert.equal(reauth.searchParams.get("scope"), "https://www.googleapis.com/auth/drive");
  assert.notEqual(reauth.searchParams.get("state"), auth.searchParams.get("state"));
  assert.deepEqual(calls, [
    "POST https://oauth2.googleapis.com/token",
    "POST https://oauth2.googleapis.com/token",
    "GET https://www.googleapis.com/drive/v3/about",
    "GET https://www.googleapis.com/drive/v3/about",
    "POST https://oauth2.googleapis.com/revoke",
  ]);
});

test("rejects an OAuth callback with mismatched state before token exchange", async (t) => {
  const request = await oauthHarness();
  const start = await request("/api/google/start");
  const outbound = t.mock.method(globalThis, "fetch", async () => assert.fail("Must not exchange an invalid callback"));
  const response = await request("/api/google/callback?code=synthetic-code&state=invalid", {
    headers: { cookie: responseCookie(start, "dupespace_oauth") },
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://dupespace.example/cleaner?error=oauth_state");
  assert.equal(outbound.mock.callCount(), 0);
});
