#!/usr/bin/env python3
# 從「Video 營收大表」重建 revenue.json。
# 用法：python3 revenue_import.py <輸入檔>
#   輸入檔可以是：
#   (a) Google Drive download_file_content 的 JSON 結果檔（content 欄位為 base64 xlsx）
#   (b) 直接的 .xlsx 檔
# 解析「營收大表(Video)-2026」分頁：D=成員、C=合作名稱、E=產品項目、R=走期開始、
# O=成員收入(業績<80萬 5/5分)、P=成員收入(業績>80萬 6/4分)。
import base64, json, os, sys, tempfile
import openpyxl

BASE = os.path.dirname(os.path.abspath(__file__))
SHEET = "營收大表(Video)-2026"
MAP = {"Rio": "rio", "Andrew": "andrew", "Ellie": "ellie", "YY": "yy", "梅伯": "meber",
       "Leo": "leo", "Nakaw": "nakaw", "Roy": "roy", "Royce": "royce",
       "主委": "roy", "吳至晟": "roy", "Lauren": "lauren", "阿根": "agen", "Anthony": "agen"}

src = sys.argv[1]
if src.endswith(".xlsx"):
    xlsx_path = src
else:
    data = json.load(open(src))
    xlsx_path = os.path.join(tempfile.gettempdir(), "revenue_export.xlsx")
    with open(xlsx_path, "wb") as f:
        f.write(base64.b64decode(data["content"]))

wb = openpyxl.load_workbook(xlsx_path, data_only=True)
if SHEET not in wb.sheetnames:
    raise SystemExit(f"IMPORT ABORTED: 找不到分頁「{SHEET}」，實際分頁：{wb.sheetnames[:8]}")
ws = wb[SHEET]

hdr_d = str(ws.cell(1, 4).value or "")
hdr_o = str(ws.cell(1, 15).value or "")
hdr_p = str(ws.cell(1, 16).value or "")
if "成員" not in hdr_d or "成員收入" not in hdr_o or "成員收入" not in hdr_p:
    raise SystemExit(f"IMPORT ABORTED: 欄位不符（D={hdr_d!r} O={hdr_o!r} P={hdr_p!r}），表格結構可能變了，請人工確認")

out, skipped = {}, set()
for r in ws.iter_rows(min_row=2):
    d = r[3].value
    if d is None:
        continue
    key = MAP.get(str(d).strip())
    if not key:
        skipped.add(str(d).strip())
        continue
    o, p = r[14].value or 0, r[15].value or 0
    out.setdefault(key, []).append({
        "name": r[2].value, "item": r[4].value,
        "start": str(r[17].value)[:10] if r[17].value else None,
        "o": float(o) if isinstance(o, (int, float)) else 0,
        "p": float(p) if isinstance(p, (int, float)) else 0,
    })
for v in out.values():
    v.sort(key=lambda x: x["start"] or "9999")

total_rows = sum(len(v) for v in out.values())
if total_rows < 50:  # 目前 150+ 筆；掉到 50 以下代表來源異常，不要覆蓋
    raise SystemExit(f"IMPORT ABORTED: 只解析到 {total_rows} 筆（異常偏低），不覆蓋 revenue.json")

from datetime import datetime, timedelta, timezone
today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
json.dump({"year": 2026, "updated": today,
           "note": "來源：Google 試算表「Video 營收大表」營收大表(Video)-2026 分頁，O/P 欄",
           "by_member": out},
          open(os.path.join(BASE, "revenue.json"), "w"), ensure_ascii=False, indent=1)
print(f"OK: {total_rows} 筆、{len(out)} 位成員；未列入成員名單而略過：{sorted(skipped) or '無'}")
for k in sorted(out):
    print(f"  {k}: {len(out[k])} 筆, 合計 {int(sum(x['o']+x['p'] for x in out[k])):,}")
