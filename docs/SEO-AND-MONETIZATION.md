# DUPESPACE local-first SEO and monetization

Status: implementation prepared on September 3, 2026; public rollout requires confirmation.

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
- Current last observed AdSense status: under review, ads.txt authorized; Ready and actual fill have
  not been verified. Do not promise passive income just because the script exists.
- Account-level page exclusions and overlay-format changes are pending specific owner approval.

Primary references checked September 3, 2026:

- [Ad placement policies](https://support.google.com/adsense/answer/1346295?hl=en)
- [Non-Google ads alongside AdSense](https://support.google.com/adsense/answer/9728?hl=en)
- [Screens without publisher content](https://support.google.com/publisherpolicies/answer/11112688?hl=en)
- [Localized versions and hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
