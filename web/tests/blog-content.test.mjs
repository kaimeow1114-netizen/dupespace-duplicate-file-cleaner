import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Space Notes has bilingual original articles and transparent editorial ownership", async () => {
  const blog = await source("../lib/blog.ts");
  const home = await source("../app/components/blog-home.tsx");
  const article = await source("../app/components/blog-article.tsx");
  const policy = await source("../app/components/blog-editorial-policy.tsx");
  for (const slug of [
    "find-renamed-duplicate-files",
    "cloud-sync-is-not-backup",
    "how-to-choose-a-file-cleaner",
  ]) {
    assert.equal((blog.match(new RegExp('slug: "' + slug + '"', "g")) ?? []).length, 2, slug);
  }
  assert.match(home, /No manufactured rankings|不做假排名/);
  assert.match(article, /Ownership and advertising disclosure|網站所有權與廣告揭露/);
  assert.match(policy, /No paid ranking positions|不販售排名位置/);
  assert.doesNotMatch(home + article + policy, /fake review|假評論|2\.1k Stars/);
});

test("blog routes, navigation and sitemap expose reciprocal language paths", async () => {
  const nav = await source("../app/components/site-shell.tsx");
  const sitemap = await source("../public/sitemap.xml");
  assert.match(nav, /href=\{en \? "\/en\/blog\/" : "\/blog"\}/);
  for (const slug of [
    "find-renamed-duplicate-files",
    "cloud-sync-is-not-backup",
    "how-to-choose-a-file-cleaner",
  ]) {
    assert.match(sitemap, new RegExp("dupespace\\.app/blog/" + slug));
    assert.match(sitemap, new RegExp("dupespace\\.app/en/blog/" + slug + "/"));
  }
  assert.match(sitemap, /dupespace\.app\/blog\/editorial-policy/);
  assert.match(sitemap, /dupespace\.app\/en\/blog\/editorial-policy\//);
});

test("blog typography keeps reading copy at or above 16px", async () => {
  const css = await source("../app/globals.css");
  assert.match(css, /\.blog-article-body p,[^{]+\{[^}]*font-size:17px/);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*\.blog-article-body p,[^{]+\{[^}]*font-size:16px/);
});
