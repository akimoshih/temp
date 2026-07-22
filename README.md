# 個人社群合作邀約網頁

每天自動從 Gmail 撈「成員個人社群合作」邀約，更新總覽頁與各成員專屬頁。

## 收錄條件

只挑「成員個人社群合作」邀約：品牌邀 Dcard Video 成員做個人社群內容（IG 貼文/Story/Reels、Threads、個人 YT、活動出席、社群推廣出演）。公司影音業配（Dcard 調查局、中插廣告、節目置入）不收。

每件邀約萃取：members（別名正規化成正式名）、brand、agency（代理商公司名，從寄件人網域/署名判斷，直客或無法判斷為 null，不寫進 summary）、date（最初來信日期，既有紀錄不可改）、summary、launch_month（YYYY-MM，未知為 null）、status（洽談中/執行中/行政流程/完成/取消）、subject、thread_id。

## 檔案

- `records.json`：邀約紀錄主檔（每日排程增量更新，date 欄位不可回改）
- `members.json`：成員名單（key、別名、Email、啟用）
- `generate.py`：讀取上面兩個檔案產生 `site/*.html`
- `site/`：產出的頁面（overview + 每位成員一頁）

## 網頁網址對照表

| 頁面 | 網址 |
|---|---|
| 總覽（僅供 Akimo） | https://claude.ai/code/artifact/7a02d760-cbb5-48a7-9221-bcec8055a9fc |
| Rio（壹比零） | https://claude.ai/code/artifact/67fa1dfd-4578-4ef3-922a-4416412081b3 |
| Andrew（安主） | https://claude.ai/code/artifact/1de6b202-0f38-4a08-9992-d12faeca4404 |
| 阿根 | https://claude.ai/code/artifact/94b2cbda-915b-4a4b-b2be-4ddb13e3d2f5 |
| Roy（主委） | https://claude.ai/code/artifact/46d09b57-317d-4a97-950d-3c8728a0fa9c |
| 梅伯 | https://claude.ai/code/artifact/08223c11-6f41-40cd-88b3-0dc08f1c8cbf |
| YY | https://claude.ai/code/artifact/94bc648b-26b7-482f-8125-95483060ef33 |
| Lauren | https://claude.ai/code/artifact/0f00042d-377b-4f00-82c4-b6fb28b5f907 |
| Royce | https://claude.ai/code/artifact/f81a7dd2-137f-4873-9787-dad683bc5475 |
| Ellie | https://claude.ai/code/artifact/1b578260-179e-4cfb-9e7c-b98fdb477aff |
| Nakaw | https://claude.ai/code/artifact/1c58c4c3-4dcf-4399-86d0-9383cb595499 |
| Leo（Leo道仙人） | https://claude.ai/code/artifact/8c7d243e-99e6-4df6-8688-d8f2c8a082e6 |

成員頁不含 Gmail 連結；總覽頁的品牌名可點回 Gmail 原信。

## Google Sheet 後台

試算表「個人經紀信件網頁後台」（每日排程會讀取；若不存在且 Google Drive 已授權會自動建立）：

- 成員表：成員名稱 / key / Email / 別名 / 啟用(Y/N) — 新增一列成員會多產生一個成員頁
- 狀態覆寫表：thread_id / status / launch_month / summary 備註 / 隱藏(Y/N) — 用來手動修正邀約狀態

限制：目前工具只能「讀取」與「建立」試算表，無法回寫既有儲存格，所以邀約資料本身不會自動寫進 Sheet；Sheet 是設定與人工修正的單向輸入。
