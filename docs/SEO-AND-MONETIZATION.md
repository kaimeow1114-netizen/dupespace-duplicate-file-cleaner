# DUPESPACE local-first SEO and monetization

Status: publicly deployed on September 3, 2026 after owner approval. On September 28, 2026 the
public AdSense loader and `/ads.txt` were reachable, but AdSense still classified `dupespace.app` as
"needs attention" for low-value content. Ads are therefore not serving and no revenue is claimed.

## Positioning and copy rules

- Primary promise: free duplicate file analysis in a browser, protected cleanup on Windows.
- Say “duplicate file finder / duplicate file cleaner”, not an unexplained “file intelligence” category.
- Browser analysis is read-only. Do not promise browser deletion, original creation-time detection,
  similar-photo search, complete backup certification, or universal NAS Recycle Bin support.
- Safety rules reduce risk; they cannot determine every file’s purpose. Never claim zero risk.
- Keep the existing teal motion identity. Product statistics are clearly labelled demonstrations.
- Do not disparage all competing products or invent users, ratings, downloads or saved capacity.
- Remove advertising-vendor implementation jargon from product pitches, not from privacy disclosures.

## Implemented search-intent map

| Intent | Chinese | English |
| --- | --- | --- |
| Product and duplicate finder | `/` | `/en/` |
| Browser folder comparison (exact duplicate files) | `/local` | `/en/local/` |
| Windows duplicate cleaner | `/download` | `/en/download/` |
| Safe cleanup and support | `/support` | `/en/support/` |
| Duplicate photos vs similar images | `/guides/duplicate-photos` | `/en/guides/duplicate-photos/` |
| Protect Windows projects and backups | `/guides/safe-windows-cleanup` | `/en/guides/safe-windows-cleanup/` |

Pages contain real server-rendered text, unique titles/descriptions, self-referencing canonicals,
reciprocal hreflang and useful internal links. Language switching preserves the current content page.
Article metadata describes the specific article and does not inherit an unrelated homepage image.
Breadcrumb and Article JSON-LD use the visible content; homepage FAQ markup shares its visible FAQ data.
Sitemap dates reflect this content revision. Retired cloud entries remain noindex migration pages.

## Rollout order

1. Publish the validated local-first site and matching desktop release after owner confirmation.
2. Submit the updated sitemap through the existing Search Console and Bing properties. Do not create
   duplicate properties or claim submission without seeing the actual confirmation.
3. After indexing, compare aggregate impressions, relevant search queries, CTR and indexed pages over
   comparable 28-day windows. No file names, file lists or reports belong in analytics.
4. Improve titles and guide content based on actual query intent, not keyword stuffing or mass pages.
5. Expand into media organization and backup verification only when usable functionality exists.
   Japanese pages wait until the complete journey and support material are translated.

## Content growth plan for AdSense re-review

The goal is not to manufacture a page count. Every new URL must answer a different user question,
contain first-hand evidence or a usable workflow, and leave the reader able to complete a task. Google
does not prescribe a preferred word count, so completeness and originality are the publication gate.

### Content model

Use three page types with different jobs:

1. **Solution pages** answer “Is this the right tool for my situation?” and lead to one clear workflow.
2. **Tested use cases** show a reproducible before/after scenario, test data, limitations and actual
   results. They must never invent download counts, time savings, users or reclaimed capacity.
3. **Practical guides** explain a decision that remains useful even when the reader does not use
   DUPESPACE. Product links appear only where they are the natural next step.

Every article has a Traditional Chinese and an independently edited English version. English pages are
not literal translations: examples, search terms and UI labels are localized while factual meaning and
safety limits remain identical.

### Release 1: six pages that prove immediate utility

These are the minimum new content set before requesting another AdSense review.

Implementation status on September 28, 2026: all six topics and `/about` are implemented in
Traditional Chinese and English. The two tested use cases publish reproducible synthetic inputs,
visible limitations and downloadable redacted CSV samples. They intentionally do not publish
screenshots or benchmark numbers that have not been captured from a controlled test run.

| Priority | URL | Reader problem | Original value required |
| --- | --- | --- | --- |
| 1 | `/solutions/photo-library-cleanup` | Photo folders contain exports, downloads and backups | A decision tree separating exact copies, similar photos and intentional backups; one real sample folder walkthrough |
| 2 | `/solutions/downloads-folder-cleanup` | Downloads contain renamed installers, documents and media | A safe triage workflow by file type and age; explain why installers and project files need separate review |
| 3 | `/solutions/old-pc-file-migration` | Moving files from an old computer creates duplicate folders | A two-folder comparison workflow with renamed matches, missing files and same-path conflicts |
| 4 | `/use-cases/renamed-photo-merge` | The same photo has different names in two folders | Reproducible test set, screenshots of each result class and a downloadable redacted CSV example |
| 5 | `/use-cases/project-files-must-stay` | Identical plug-ins or configs appear in separate code projects | Demonstrate why content equality is not permission to delete and how project protection changes the result |
| 6 | `/guides/which-duplicate-file-should-i-keep` | A user cannot tell which identical copy is the original | A clear priority order: protected purpose, creation time when reliable, path context, backup status and manual review |

Each solution page should use this reader-facing structure:

- A one-sentence answer above the fold.
- “This is suitable when” and “Do not use this when” lists.
- A concrete example using disposable test data.
- Three to five steps with screenshots or diagrams produced from the current release.
- A result interpretation section, including what DUPESPACE cannot decide.
- Recovery and backup checks before any file action.
- A short, visible FAQ based on questions actually answered on the page.
- One primary CTA and one relevant next article; no wall of promotional buttons.

### Release 2: tested evidence and difficult edge cases

Publish only after each scenario has been run against the current release and its evidence has been
recorded.

| URL | Working title | Evidence to collect before writing |
| --- | --- | --- |
| `/use-cases/ten-thousand-file-scan` | 10,000 個檔案的重複掃描實測：時間、記憶體與限制 | Hardware, storage type, file mix, cold/warm run timings, peak memory, cancellations and failures |
| `/use-cases/changed-file-protection` | 掃描後檔案被修改，DUPESPACE 會怎麼處理？ | A controlled TOCTOU test, UI message and audit-report outcome |
| `/use-cases/recycle-bin-failure` | 資源回收筒失敗時，為什麼不應自動永久刪除？ | Local, removable and unsupported-location test results without destructive fallback |
| `/guides/windows-recycle-bin-usb-nas` | USB、外接硬碟與 NAS 都能使用資源回收筒嗎？ | Verified Windows behavior for NTFS, exFAT and UNC paths; clearly state device-specific variation |
| `/guides/duplicate-files-keep-coming-back` | 刪掉重複檔案後又出現？先檢查同步、還原與匯入流程 | A diagnosis flow covering sync clients, phone imports, messaging downloads and backup restore jobs |
| `/guides/read-dupespace-csv-report` | 如何看懂 DUPESPACE CSV 稽核報告 | One redacted example for success, skipped change, permission failure and trash failure |

### Release 3: authority-building technical explanations

These pages strengthen trust but come after the task-oriented pages above.

| URL | Working title | Reader outcome |
| --- | --- | --- |
| `/guides/file-hash-sha256-blake3` | SHA-256、BLAKE3 與逐位元比對：重複檔案工具如何確認內容 | Understand fast filtering versus final proof without treating a hash as permission to delete |
| `/guides/duplicate-vs-similar-photos` | 完全重複、相似照片與不同畫質版本，有什麼差別？ | Choose the correct class of tool and avoid deleting a higher-quality version |
| `/guides/storage-sense-vs-duplicate-cleaner` | Windows 儲存空間感知和重複檔案工具，該用哪一個？ | Separate system temporary-file cleanup from personal-file deduplication |
| `/guides/prepare-files-before-new-pc` | 換新電腦前，如何整理檔案又不破壞備份？ | Produce a migration checklist, folder map and verified backup before copying |

### Existing content upgrades

Do not create new URLs that compete with current pages. Improve the existing six entries instead:

- `find-renamed-duplicate-files`: add one real renamed-file example, expected hashes and a screenshot.
- `cloud-sync-is-not-backup`: add a restore-test checklist and a service-neutral retention table.
- `how-to-choose-a-file-cleaner`: add a printable evaluation checklist and current-version screenshots.
- `duplicate-photos`: add file-format limitations and an exact-versus-similar decision diagram.
- `safe-windows-cleanup`: add a tested folder-selection example and a protected-project counterexample.
- `merge-folders-without-duplicates`: add a five-result-class example and redacted CSV excerpt.

### Trust pages and authorship

Add `/about` and `/en/about/` before re-review. They should explain:

- who maintains DUPESPACE and how to contact the project through GitHub;
- why the project exists and which file problems it intentionally does not solve;
- how examples are tested and when an article is updated;
- that AI assistance, when used, is reviewed against product behavior and original test evidence;
- the open-source repository, release history and security-reporting path.

Article pages show an honest byline, reviewed/updated date, test environment when relevant and a link to
the editorial policy. “Reviewed” must identify what was checked; it is not a decorative trust badge.

### Plain-language copy rules

- Lead with the answer, then explain the mechanism. Prefer “先找出可能相同的檔案，再完整確認內容”
  over an unexplained “multi-stage fingerprint pipeline”.
- Use “你” consistently. Reserve formal warnings for irreversible actions.
- Explain a technical term the first time it appears. Put hashes, workers and filesystem details in a
  secondary “How it works” section when they are not necessary for the task.
- A warning must say what happened, whether files are safe and what the reader can do next.
- Never call a file “safe to delete” based only on matching content. Say “內容相同的副本候選”.
- Avoid absolute claims such as “zero risk”, “the original file”, “all duplicates” or “guaranteed faster”.
- Titles describe the problem and outcome without alarmism or keyword repetition.
- Proofread Chinese punctuation and line breaks; keep `DUPESPACE`, file extensions and paths from being
  split or translated.

### Internal linking and technical publication checklist

- One hub page links to all solution pages; blog categories remain descriptive rather than keyword lists.
- Each new page links to one tool, one prerequisite guide and one next-step guide.
- Add reciprocal `zh-TW`, `en` and `x-default` hreflang entries, self-referencing canonicals and sitemap
  entries only after both language versions return HTTP 200.
- Use `Article` for editorial pieces and `HowTo` only when the visible page contains complete, ordered
  steps. FAQ structured data must match visible questions and answers.
- Every screenshot gets useful alt text, a stated app version and personal paths redacted.
- Reserve image and ad dimensions to prevent layout shift. Public articles may have one in-content ad
  after the reader has received substantive content and one near related reading; private `/local` and
  `/merge` workspaces remain ad-free.
- Run mobile, tablet and desktop checks for navigation, line wrapping, contrast and horizontal overflow.

### Publication cadence and review gate

Release 1 and `/about` were completed in two reviewed batches on September 28, 2026. The next editorial
cycle upgrades the existing six articles and submits the refreshed sitemap after the new bilingual URLs
are deployed. Further Release 2 pages remain gated on controlled test evidence; they are not created in
bulk merely to increase page count.

Request AdSense re-review only when:

- all six Release 1 pages and `/about` are live in both languages;
- examples, screenshots and downloads have been manually verified;
- Search Console shows the important pages are crawlable or indexed, with no canonical/hreflang errors;
- navigation exposes the articles without relying on search or a hidden sitemap;
- `ads.txt` is still reachable and AdSense has had time to recrawl it;
- there are no placeholder sections, unfinished pages or ads inside analysis workspaces.

Passing AdSense review, ranking positions and the time required for recrawl remain external decisions and
cannot be guaranteed.

Rankings, indexing speed, traffic and revenue are not guaranteed. FAQ JSON-LD does not promise a
Google rich result. The old “Google Drive cleaner” keyword is not a substitute for a retired feature.

## Advertising boundaries

- Public home, download and editorial guide pages retain the publisher’s AdSense code.
- `/local`, `/en/local/` and retired cleaner routes exclude third-party advertising code; private file
  lists, previews and reports must not become advertising context or be sent to another origin.
- A static, first-party promotion after results can be appropriate. Results and CSV must remain
  immediately usable; no countdown, forced click, pop-under, misleading download button or fake ad.
- Owner-provided house ads or directly sold placements are possible. Require the actual creative,
  landing URL and disclosure before publication. Paid links use `rel="sponsored noopener"`; externally
  hosted tracking pixels and ad scripts need a separate privacy review.
- Do not put a regular AdSense unit in a home-made blocking completion popup. A blank success/thank-you
  page is not a useful publisher-content page. Public editorial content is the safer initial placement.
- Desktop applications do not embed AdSense. Ads must be clearly separated from file actions.
- Current last observed AdSense status (September 28, 2026): `dupespace.app` needs attention for
  low-value content and cannot serve ads. The account UI still showed `ads.txt` as not found based on an
  older crawl, while the public file returned HTTP 200 with the correct publisher line. A new crawl and
  successful site review are required before advertising revenue is possible.
- Account-level page exclusions and overlay-format changes are pending specific owner approval.

Primary references checked September 3, 2026:

- [Ad placement policies](https://support.google.com/adsense/answer/1346295?hl=en)
- [Non-Google ads alongside AdSense](https://support.google.com/adsense/answer/9728?hl=en)
- [Screens without publisher content](https://support.google.com/publisherpolicies/answer/11112688?hl=en)
- [Localized versions and hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Focus on your users' goals](https://support.google.com/adsense/answer/2892971)
- [Google publisher policies](https://support.google.com/adsense/answer/10502938)
