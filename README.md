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

部署方式：`python3 vibehost_deploy.py`（經由 REST API 上傳；CLI 的串流上傳與這個環境的 proxy 不相容，故不用 `vibehost deploy`）。新成員第一次部署會自動建 app 並授權其 email。

認證優先序（`vibehost_deploy.py` 開頭）：

1. `VIBEHOST_TOKEN` 環境變數（PAT，`vh_pat_*`，不會過期）— **建議設在 CCR 環境變數，容器重建才不會遺失**
2. `~/.config/vibehost/pat` 檔案（同樣放 PAT；容器重建會消失）
3. 都沒有時才回頭用 CLI 裝置登入 token（`vibehost login`，約三天過期，排程撞到就會中斷部署）

workspace 預設讀 `~/.config/vibehost/config.json`；該檔不存在時用 `VIBEHOST_WORKSPACE_ID` / `VIBEHOST_WORKSPACE` 環境變數（目前值：`r1igkcoyt2yx0kjt7y91zv21` / `dcard`）。**PAT 本身不進 git。**

## Google Sheet 後台

試算表「個人經紀信件網頁後台」（每日排程會讀取；若不存在且 Google Drive 已授權會自動建立）：

- 成員表：成員名稱 / key / Email / 別名 / 啟用(Y/N) — 新增一列成員會多產生一個成員頁
- 狀態覆寫表：thread_id / status / launch_month / summary 備註 / 隱藏(Y/N) — 用來手動修正邀約狀態

限制：目前工具只能「讀取」與「建立」試算表，無法回寫既有儲存格，所以邀約資料本身不會自動寫進 Sheet；Sheet 是設定與人工修正的單向輸入。

## 委刊單自動化

案件進入「行政流程」（對方來信確認合作）且委刊單由我們開立時，每日排程會自動：

1. 從信件串萃取欄位寫成 spec JSON（格式見 `weikan_generate.py` 開頭註解），執行 `python3 weikan_generate.py <spec.json>` 產出填好的 xlsx＋PDF（輸出到 `weikan_out/`，不進 git）。金額用雙方已確認的報價；查不到的欄位留空（客戶簽回時手填）或以【請確認：XXX】標示。
2. PDF 上傳 Google Drive，在原信串建立回覆草稿（不寄出）：內文請窗口用印回傳，草稿最上方附【內部備註】含 Drive 連結——Gmail 工具建草稿無法夾帶附件，寄出前需手動下載夾帶並刪除該備註段。
3. 記錄到 `queue.json`（type: 委刊單），避免重複產生。

相關檔案：

- `weikan_template.xlsx`：委刊單範本（來源：「Dcard Video委刊單」，已修正簽章欄合併格與頁尾頁碼）
- `weikan_generate.py`：填範本＋轉 PDF（LibreOffice；容器缺 libreoffice-calc 時會自動補裝）
- `weikan_config.json`：乙方（狄卡）固定資料、匯款資訊、經紀人聯絡資料（contacts：jasmine／oliver 各自的名片欄位＋負責成員清單；spec 給 member_key 會自動挑對負責人）

由對方開立委刊單的案子（如和泰 HINO）跳過此流程。

Jasmine／Oliver 各自信箱的委刊單草稿：同一套檔案已上傳 Google Drive 資料夾「委刊單自動化」（folder id `1ZD0zGP6MIVv1vEq9qxaY_ufJUP4Y_mKV`，需分享給兩位），他們的個人排程從 Drive 下載執行（依檔名在資料夾內取最新一份），升級指令見 `經紀人自動報價設定包.md`。**repo 內檔案更新後要同步上傳一份新檔到該 Drive 資料夾**（Drive 工具無法覆寫舊檔，直接同名新增即可，排程會抓最新；舊檔可手動清掉）。

## 回信速度統計

- `response_log.json`：觀測記錄。每筆是一個「對方來信 → Jasmine／彼得回覆」配對（`thread_id` / `responder` / `case` / `inbound_at` / `replied_at` / `confident`），另有 `pending` 陣列記錄對方來信後我方仍未回覆的案子。每日排程步驟 5b 會 append 新配對。
- `response_times.py`：統計。`python3 response_times.py`（加 `--list` 逐筆列出）會更新 `response_times.json`。
- 兩種延遲都算：`raw` 是實際經過時間，`work` 只計台北週一～五 09:00–19:00 的上班時間 —— 晚上來信隔天早上回，raw 看起來很久，work 才是真正的反應速度。

**注意 Gmail 的日期截斷假影**：部分訊息的 metadata 時間戳會回傳 `T00:00:00Z`（只有日期、時間被截掉）。這類配對必須標 `confident: false`，統計時會自動排除，否則會嚴重高估回信時間。

## 排程（兩條）

| Routine | cron (UTC) | 台北時間 | 做什麼 |
|---|---|---|---|
| 個人社群合作邀約網頁每日更新 | `7 1 * * *` | 每天 09:07 | 完整流程：後台 Sheet、業績重建、Gmail 撈近 3 天、records.json、委刊單草稿、generate.py、部署、commit |
| 報價草稿快線（上班時間每小時） | `0 1-11 * * 1-5` | 週一～五 09:00–19:00 每小時 | **只做報價草稿**：撈近 3 小時來信，對「最新一封是對方來信且在等報價」的案子建 Gmail 草稿、寫 queue.json、push。不碰 revenue/records/generate/部署 |

為什麼要拆：來信到 Jasmine／彼得自己回覆的落差中位數約 4–5 小時（最快 43 分鐘），一天只跑一次的排程結構上追不上，草稿幾乎都會被搶先。快線把最大延遲壓到 1 小時。

兩條都是「喚回同一個 session」模式（persist_session），這樣才會帶到 Gmail／Google Drive 的 connector 工具；用 create_new_session_on_fire 建的排程不會帶 connector，撈不到信也建不了草稿。

去重靠 queue.json 的 `draft.replied_to_message_id`（**要回覆的那封來信 message id**，不是 thread_id）：快線建完草稿會立刻 commit＋push，每日排程看到同一個來信 id 就跳過。

為什麼不用 thread_id：同一個信件串來回多輪是常態。若以 thread 去重，一個案子只會享有一次草稿服務——舊草稿作廢後，同串再來新的報價需求就會被永久跳過。2026-08-21 發現此漏洞後改掉（羅技活動出席案觸發）。2026-08-21 之前建立的 queue 紀錄沒有這個欄位，已回填為 null 並標註。

## 分析儀表板與業績資料

總覽頁與每個成員頁都有兩個分頁：「合作邀約」（邀約列表）與「分析儀表板」；成員頁業績用 O+P 欄（成員收入），總覽頁團隊業績用 J 欄（成交價未稅）（業績卡片、月別收入、收入明細、邀約品牌分類、狀態與案源分佈）。

業績資料來源：`revenue.json`，由「營收大表(Video)-2026」Excel 的 D（成員）、O（成員收入，業績<80 萬 5/5 分）、P（成員收入，業績>80 萬 6/4 分）欄產生。每日排程會自動從 Google 試算表「Video 營收大表」下載並執行 `revenue_import.py` 重建（表格結構異常或筆數異常偏低時會中止並保留舊資料）。
