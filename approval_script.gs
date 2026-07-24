/**
 * 個人經紀審批表單 — 提交當下自動建立 Gmail 草稿
 * 安裝位置：Google 表單編輯頁 → ⋮ → Apps Script（表單綁定指令碼）
 * 觸發條件：onSubmit，事件來源「表單」，事件類型「提交表單時」
 *
 * 行為：決定＝「核准」時，立即在原信件串下建立回信草稿（永遠只建草稿、不寄出）。
 *       決定＝「退回」不在此處理（由每小時排程依修改意見重擬）。
 */
function onSubmit(e) {
  var answers = {};
  e.response.getItemResponses().forEach(function (ir) {
    answers[ir.getItem().getTitle()] = ir.getResponse();
  });

  var taskId = String(answers['任務ID'] || '').trim();
  var decision = String(answers['決定'] || '').trim();
  if (!taskId || taskId === 'TEST' || decision !== '核准') return;

  var meta;
  try {
    meta = JSON.parse(String(answers['系統參數（請勿修改）'] || '{}'));
  } catch (err) {
    console.error('系統參數解析失敗：' + err);
    return;
  }
  var body = String(answers['草稿內容（可修改）'] || '');
  if (!meta.thread_id || !body) return;

  var thread = GmailApp.getThreadById(meta.thread_id);
  if (!thread) {
    console.error('找不到信件串：' + meta.thread_id);
    return;
  }
  var options = {};
  if (meta.cc && meta.cc.length) options.cc = meta.cc.join(',');
  thread.createDraftReply(body, options);
  console.log('已建立草稿：' + taskId);
}
