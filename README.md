# 個人社群合作邀約網頁

每天自動從 Gmail 撈「成員個人社群合作」邀約，更新總覽頁與各成員專屬頁。

## 收錄條件

只挑「成員個人社群合作」邀約：成員做個人社群內容（IG 貼文/Story/Reels、Threads、個人 YT、活動出席、社群推廣出演）。**以合作內容判斷，不看案源**：品牌/代理商直接來信＝「自來案」，Dcard 內部業務/同事轉介＝「業務提案」，兩者都收，每筆記錄有 source 欄位（自來/業務）並顯示在網頁卡片上。不收：成員出演公司拍攝的影音（Dcard 調查局、中插廣告、節目置入、AD 影音拍攝，如元大證券 AD 短影音）。

每件邀約萃取：members（別名正規化成正式名）、brand、agency（代理商公司名，從寄件人網域/署名判斷，直客或無法判斷為 null，不寫進 summary）、date（最初來信日期，既有紀錄不可改）、summary、launch_month（YYYY-MM，未知為 null）、status（洽談中/執行中/行政流程/完成/取消）、subject、thread_id。

## 檔案

- `records.json`：邀約紀錄主檔（每日排程增量更新，date 欄位不可回改）
- `members.json`：成員名單（key、別名、Email、啟用）
- `generate.py`：讀取上面兩個檔案產生 `site/*.html`
- `site/`：產出的頁面（overview + 每位成員一頁）

## 網頁網址對照表（VibeHost，workspace: dcard）

所有站點 private-by-default：開啟需 Google 登入，只有 workspace owner 與被授權的 email 看得到。每個成員頁已授權該成員的 @dcard.cc email（viewer）。

| 頁面 | 網址 | 已授權 |
|---|---|---|
| 總覽（僅供 Akimo） | https://collab-overview-dcard.vibehost.space | （owner） |
| Rio（壹比零） | https://collab-rio-dcard.vibehost.space | rio@dcard.cc |
| Andrew（安主） | https://collab-andrew-dcard.vibehost.space | andrew.wang@dcard.cc |
| 阿根 | https://collab-agen-dcard.vibehost.space | anthony@dcard.cc |
| Roy（主委） | https://collab-roy-dcard.vibehost.space | roy.wu@dcard.cc |
| 梅伯 | https://collab-meber-dcard.vibehost.space | paul.mei@dcard.cc |
| YY | https://collab-yy-dcard.vibehost.space | yy@dcard.cc |
| Lauren | https://collab-lauren-dcard.vibehost.space | lauren@dcard.cc |
| Royce | https://collab-royce-dcard.vibehost.space | royce@dcard.cc |
| Ellie | https://collab-ellie-dcard.vibehost.space | ellie.yu@dcard.cc |
| Nakaw | https://collab-nakaw-dcard.vibehost.space | nakaw@dcard.cc |
| Leo（Leo道仙人） | https://collab-leo-dcard.vibehost.space | leo.lin@dcard.cc |

成員頁不含 Gmail 連結；總覽頁的品牌名可點回 Gmail 原信。

部署方式：`python3 vibehost_deploy.py`（讀 `~/.config/vibehost/config.json` 的登入 token，經由 REST API 上傳；CLI 的串流上傳與這個環境的 proxy 不相容，故不用 `vibehost deploy`）。新成員第一次部署會自動建 app 並授權其 email。

## Google Sheet 後台

試算表「個人經紀信件網頁後台」（每日排程會讀取；若不存在且 Google Drive 已授權會自動建立）：

- 成員表：成員名稱 / key / Email / 別名 / 啟用(Y/N) — 新增一列成員會多產生一個成員頁
- 狀態覆寫表：thread_id / status / launch_month / summary 備註 / 隱藏(Y/N) — 用來手動修正邀約狀態

限制：目前工具只能「讀取」與「建立」試算表，無法回寫既有儲存格，所以邀約資料本身不會自動寫進 Sheet；Sheet 是設定與人工修正的單向輸入。

## 分析儀表板與業績資料

每個成員頁有兩個分頁：「合作邀約」（邀約列表）與「分析儀表板」（業績卡片、月別收入、收入明細、邀約品牌分類、狀態與案源分佈）。

業績資料來源：`revenue.json`，由「營收大表(Video)-2026」Excel 的 D（成員）、O（成員收入，業績<80 萬 5/5 分）、P（成員收入，業績>80 萬 6/4 分）欄產生。每日排程會自動從 Google 試算表「Video 營收大表」下載並執行 `revenue_import.py` 重建（表格結構異常或筆數異常偏低時會中止並保留舊資料）。
