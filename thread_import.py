#!/usr/bin/env python3
# 把 Gmail get_thread 的結果檔（JSON）整理成信件往來全文，寫入 queue.json 對應任務的 thread 欄位。
# 用法：python3 thread_import.py <get_thread結果檔路徑> <task_id>
import json, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
MAX_CHARS = 2500  # 每封訊息保留上限

def clean_body(text):
    if not text:
        return ""
    # 去除引用尾巴（回信附帶的舊信內容）
    cut_patterns = [
        r"\nOn .{5,80} wrote:\s*\n", r"\n於 .{5,80}寫道：", r"\n.{0,40}於\s?20\d\d年.{2,40}寫道：",
        r"\n>{1,} ", r"\nFrom: ", r"\n寄件者[:：]",
    ]
    cut = len(text)
    for p in cut_patterns:
        m = re.search(p, text)
        if m:
            cut = min(cut, m.start())
    text = text[:cut].rstrip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS] + "\n…（截斷）"
    return text

src, task_id = sys.argv[1], sys.argv[2]
data = json.load(open(src))
msgs = []
for m in data.get("messages", []):
    body = clean_body(m.get("plaintextBody") or m.get("plaintext_body") or m.get("snippet") or "")
    msgs.append({
        "date": (m.get("date") or "")[:16].replace("T", " "),
        "from": m.get("sender") or "",
        "body": body,
    })

qpath = os.path.join(BASE, "queue.json")
queue = json.load(open(qpath))
hit = False
for t in queue:
    if t["task_id"] == task_id:
        t["thread"] = msgs
        hit = True
if not hit:
    raise SystemExit(f"找不到任務 {task_id}")
json.dump(queue, open(qpath, "w"), ensure_ascii=False, indent=1)
print(f"OK: {task_id} 寫入 {len(msgs)} 封訊息")
