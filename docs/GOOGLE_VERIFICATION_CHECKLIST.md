# DUPESPACE Google 資料存取權驗證

更新：2026-09-01。申請已正式送出並進入審查，不代表資料存取權已通過核准。

## 已查證狀態

- 專案 `dupespace-app` 的品牌已完成驗證並發布。
- 資料存取權尚未驗證；範圍用途說明與新影片 `https://youtu.be/F1SJ4HhlEvw` 已儲存並正式送審，驗證中心顯示「正在審核應用程式的資料存取權」。
- 已在 Google Cloud 移除 `userinfo.email`；目前保留受限制的 `drive` 範圍。
- 現有用戶端是 `DUPESPACE Web` 與 `DUPESPACE Desktop`；影片應涵蓋兩者。
- 這不是 Gmail 收信驗證。不需要新增 Gmail API 或 Gmail 讀取權限。

## 最小權限檢查

原本網頁在授權時要求 `openid email https://www.googleapis.com/auth/drive`，但沒有使用 OpenID ID token 或 userinfo endpoint；帳號名稱與電子郵件透過 Drive `about.get` 取得。2026-09-01 查核發現桌面原始碼仍要求 `userinfo.email`，與 Cloud 宣告不一致；經使用者同意，本次已將原始碼改為僅要求 `drive`。既有已發布安裝檔尚不能視為已更新，仍須完成新建置及真人登入驗收。

使用者已同意移除網頁未使用的 `openid email` 與 Google Cloud 的 `userinfo.email` 宣告。正式網站已部署為只要求 `drive`，並關閉 `include_granted_scopes`，不主動合併過去無關的授權。帳號顯示仍使用 Drive `about.get`。已實測正式 `/api/google/start` 的範圍與 callback；Google Cloud 已儲存 967 字元用途說明與新影片，並正式提交資料存取權審查。

網站正式 build、lint 與 78 項測試通過。桌面版 `v1.5.3` 的 Python 測試、Windows 安裝、升級、實際回收筒整合及 GitHub Actions 均已通過，正式安裝檔已發布。

新增的自動化測試使用合成憑證與模擬 Google 回應，涵蓋要求的範圍、PKCE、state 防護、登入回呼、權杖更新、帳號顯示、重訪與中斷連線；不會存取或刪除真實 Drive 資料。這些測試不能取代正式環境的真人授權與示範影片。

縮小新請求的 scope 不會自動撤銷使用者過去已授予的權限。不要為了本次調整強制撤銷所有既有使用者的憑證。Google 的撤銷動作會影響該使用者對同一專案所有 Client 的既有授權；拍攝中斷連線時，Web 與 Desktop 可能都需要重新授權。

Drive scope 仍需審核：掃描既有檔案、垃圾桶、復原及明確確認的永久刪除都需要目前功能所使用的存取能力。`drive.file` 僅能存取使用者逐項授予應用程式的檔案，不能直接取代目前全域掃描。

## 已儲存的範圍用途說明

適用於「您預計如何使用這些範圍？」欄位，少於 1,000 個字元。提交前須確認最終部署行為與影片相符。

```text
DUPESPACE finds exact duplicates in a user's Google Drive. It reads file and folder IDs, names, parents, sizes, timestamps, versions, ownership, capabilities, thumbnail links and checksums to compare files and protect one keeper per group. Small Google-generated previews may transit the web service for authenticated review; they are not stored or shared with advertisers. Original file contents are not downloaded or uploaded. Only user-selected, revalidated copies are trashed and can be restored. Permanent deletion is separate, explicitly confirmed and limited to regular files. drive.file cannot discover existing Drive-wide duplicates; read-only scopes cannot trash, restore or delete selected copies. Web tokens use encrypted HttpOnly cookies; desktop tokens remain on the PC under Windows DPAPI. Google API data is used only for these user-facing features, never advertising or sale. Drive about.get identifies the account. CSV reports are generated locally.
```

2026-09-01 已將用途分類改為僅「雲端硬碟效率提升」，Console 顯示「已儲存資料存取權變更」。沒有新增範圍、修改 OAuth Client 或 Secret。DUPESPACE 的實際用途是生產力／檔案整理，不應聲稱提供未實作的同步或備份功能。

## 本次送審檢查

- 新增桌面授權 URL 測試，確認只有 `drive`、使用 S256 PKCE、包含 state、不主動合併舊 scope，也不將 Client Secret 放入授權 URL。
- 新增 Drive-only 與舊 Drive/email 憑證的有效／過期更新測試，避免額外 email 授權提示；帳號資訊仍走 Drive `about.get`。測試使用合成 Token，不讀取真實使用者憑證。
- 不撤銷既有 Google 授權；縮減新請求不代表過去已授予的 email 權限被撤銷。
- 新影片已提供並完成基本核對，涵蓋 Desktop Client 的 OAuth 授權、回到程式後的帳號狀態與 Drive 功能；Console 已儲存正確網址。
- 影片說明中的 GitHub 連結應為 `https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner`。
- 送審文字必須區分原始檔案內容與 Google 產生的預覽縮圖，不應將縮圖代理描述成完全沒有圖像資料傳輸。
- Google 若要求 CASA 或付費安全評估，先取得使用者同意，不擅自承諾費用。

### 2026-09-01 Desktop 真人驗收

- 使用 Actions run `33435717324` 的可攜式驗證版本進行，程式路徑與執行中視窗已核對；不是先前缺少 Desktop OAuth 配套值的舊建置。
- 使用者親自在 Google 頁面完成授權。DUPESPACE 成功顯示帳號名稱、信箱、頭像及「掃描 Google Drive」，沒有再產生 `client_secret is missing` 診斷事件。
- 關閉並重新啟動同一版本後，沒有再次開啟授權頁，帳號自動恢復；DPAPI 權杖只檢查檔案存在、大小與修改時間，未讀取或輸出內容。
- 執行只讀 Drive 掃描後成功檢查 243 個檔案並顯示結果；沒有執行垃圾桶、復原或永久刪除。
- 真人驗收證明目前程式可用；本次改用 6:27 的新影片，同時展示 Web 與 Desktop OAuth Client，不再使用缺少 Desktop OAuth 示範的舊影片。
- Console 的用途說明已改成 967 字元的精確資料流敘述並顯示「已儲存資料存取權變更」；新影片網址已儲存。四項適用性問卷均如實回答「否」，內容驗證與 CASA／年度重新認證聲明已由產品擁有者明確授權後勾選，申請已正式送出。

## 真實示範影片清單

本次送審影片：<https://youtu.be/F1SJ4HhlEvw>（不公開，6:27）。影片標題與說明明確標示
Web 與 Desktop Client；舊影片不再用於本次資料存取權送審。

請使用專門建立的測試檔案，避免暴露私人檔名、內容、密碼、OAuth Secret 或 Token。上傳至 YouTube 時使用「不公開」，不是「私人」。

1. 開啟公開首頁，顯示 DUPESPACE 名稱、產品用途、隱私權政策與條款。
2. 以英文顯示 Google OAuth 授權流程，展示應用程式名稱、實際要求的權限，以及網址列中的 Client ID；不要顯示 Client Secret。
3. 展示連線後帳號顯示、測試副本掃描、父資料夾路徑、keeper 保護與選取結果。
4. 將已核對的測試副本移至垃圾桶，在 Google Drive 檢查結果，再展示復原。
5. 另以明確指定的測試檔案展示永久刪除獨立模式與高風險確認；資料夾不永久刪除。
6. 展示 CSV 稽核報告、中斷連線與重新登入。
7. 對 Desktop OAuth Client 重複必要的授權與 Drive 功能展示。只展示已實際發布或供審查員使用的版本。
8. 加上英文字幕或說明，解釋每項 scope 對應的功能及資料流向。

沒有真實影片時，不得以首頁、GitHub、文字文件、模擬畫面或虛構影片網址代替。

### 建議拍攝腳本

建議總長約 6–10 分鐘，不是 Google 規定的片長。使用螢幕錄影即可，不需要人像、配樂或宣傳剪輯。全程以實際可用功能為準；失敗時先修復再重拍，不隱藏錯誤來表示通過。

| 章節 | 畫面與操作 | 可用英文字幕 |
| --- | --- | --- |
| 1. 用途，約 30 秒 | 未登入開啟 `https://dupespace.app/`，展示全大寫品牌、用途說明、隱私權政策和 Limited Use 段落。 | DUPESPACE finds exact duplicate files in Google Drive and on Windows. |
| 2. Web 授權，約 1 分鐘 | 以英文顯示 Google 同意畫面，展開實際要求的 Drive 權限，保留網址列與 Web Client ID 可讀。若出現未驗證應用程式警告，也必須錄下。登入密碼與雙重驗證過程暫停錄影。 | Drive access is needed to find existing duplicates and manage only the copies the user selects. |
| 3. 比對與保護，約 1 分鐘 | 使用專屬測試資料夾內兩份大小至少 1 MiB 的相同測試檔，以及一份不同檔。展示掃描、完整父路徑、內容相同的依據、不可選取的 keeper；只勾選明確的測試副本。 | Each duplicate group keeps a protected original. Matching content does not mean every copy is unnecessary. |
| 4. 垃圾桶與復原，約 1 分鐘 | 執行移至垃圾桶，再切到 Google Drive 垃圾桶驗證。在 DUPESPACE 的復原功能可用時展示復原，回到 Drive 確認檔案恢復。 | Selected copies go to Trash. The protected original remains. The user can restore the trashed copies. |
| 5. 資料夾與高風險功能，約 1 分鐘 | 若正式版本支援重複資料夾，展示鏡像樹、keeper 和整資料夾移至垃圾桶。另用無價值的普通測試檔展示永久刪除必須手動選取與高風險確認；永遠不永久刪除資料夾。 | Folder cleanup uses Trash only. Permanent file deletion is a separate, explicitly confirmed action and cannot be undone. |
| 6. 報告與資料用途，約 30 秒 | 匯出只含測試資料的 CSV，展示結果與操作模式。說明檔案內容不經網站伺服器，必要中繼資料及權杖會經過服務處理；Google API 資料不用於廣告。 | Necessary metadata passes through the web service. File contents do not. Google API data is not used for advertising. |
| 7. Desktop，約 2–3 分鐘 | 開啟實際發布版本，以 Desktop Client 完整展示英文授權、可讀 Client ID、Drive 掃描、keeper、垃圾桶／復原途徑及永久刪除確認。功能不支援時如實說明；不要以未完成的畫面代替。 | The desktop client accesses Google Drive directly. OAuth credentials stay on the user's computer. |
| 8. 連線生命週期，約 30 秒 | 展示重新開啟網頁後辨識既有登入，以及中斷連線後變成未連線；必要時重新授權。 | Users can reconnect or disconnect their Google account. |

上傳標題可用 `DUPESPACE OAuth Verification — Web and Desktop — Drive Scope`。可合併成一部影片並加入 Web／Desktop 時間章節，方便單一「YouTube 連結」欄位使用。影片設為「不公開」，另用未登入的瀏覽器確認知道連結的人可以直接播放；不要設成「私人」。

只錄 Google 同意畫面的公開 Client ID，不錄 Cloud Console 的 Client Secret、瀏覽器 Cookie、Token、密碼、復原碼或私人檔案。不要為了拍片新增 Gmail、Contacts 或其他不需要的 scope。若影片帳號仍有舊授權，先協調中斷／重新授權；不要直接撤銷其他使用者的權限。

這次不要求新增範圍。若日後需要新增尚未驗證的範圍，應先在預備環境或測試專案展示，不直接部署到正式流量。影片應涵蓋送審專案中每一個 OAuth Client；尚未可供審查的 Client 應先與產品擁有者決定送審範圍，不能假裝已測試。

## 安全評估與資料說明

網頁伺服器會接收並處理 Google Drive 中繼資料與 OAuth Token；「不下載檔案內容」不等於「伺服器不接觸受限制範圍資料」。應按 Google 要求準備受限制範圍的安全評估（CASA）及年度複驗，不能自行宣稱豁免。

提交前確認隱私權政策如實描述資料的存取、使用、儲存、轉移、刪除方式；Google API 資料不得用於廣告。AdSense 必須與登入帳號與清理操作資料隔離。

## AdSense / ads.txt 狀態

已實測 `https://dupespace.app/ads.txt` 為 HTTP 200、`text/plain`，內容：

```text
google.com, pub-7998471640181666, DIRECT, f08c47fec0942fa0
```

HTTP 會轉至 HTTPS；www 網址與模擬 Googlebot / Mediapartners-Google User-Agent 測試也返回相同內容。這些測試不能替代 Google 真實爬蟲的後台記錄，但目前未重現 404 或爬蟲封鎖。

AdSense 網站審查於 2026-08-29 00:10 提出，目前仍為「正在接受審查」，尚不能放送廣告；
ads.txt 狀態已由「找不到」更新為「已授權」。網站已載入官方 Auto Ads 程式碼，但清理、登入、
確認與檔案操作頁維持完全無廣告。只有 AdSense 核准狀態變成 Ready／審查完成後，才能宣稱
廣告已正式放送或產生收益。

## 官方參考

- [Google 受限制範圍驗證](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive about.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get)
- [AdSense ads.txt 檢索排查](https://support.google.com/adsense/answer/7679060?hl=zh-Hant)
- [AdSense ads.txt 指南與檢查更新](https://support.google.com/adsense/answer/12171612?hl=zh-Hant)
