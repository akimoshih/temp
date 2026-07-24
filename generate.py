#!/usr/bin/env python3
# 個人經紀「成員個人社群合作」邀約網頁產生器
# 讀取 records.json（每日排程從 Gmail 撈信萃取）與 members.json（成員名單，未來由 Google Sheet 後台同步），
# 產生 site/overview.html（總覽，僅供管理者）與 site/member-<key>.html（各成員專屬頁）。
import json, html, os
from datetime import datetime, timedelta, timezone

TPE = timezone(timedelta(hours=8))
BASE = os.path.dirname(os.path.abspath(__file__))

def load(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return json.load(f)

RECORDS = load("records.json")
MEMBERS = load("members.json")
MEMBER_BY_KEY = {m["key"]: m for m in MEMBERS}

STATUS_ORDER = ["執行中", "行政流程", "洽談中", "完成", "取消"]
STATUS_CLASS = {"洽談中": "talk", "執行中": "run", "行政流程": "admin", "完成": "done", "取消": "off"}

CSS = """
:root{
  --bg:#F5F8FA; --surface:#FFFFFF; --ink:#182531; --muted:#5B6C79; --line:#DBE4EB;
  --accent:#0A6FA8; --chip-bg:rgba(10,111,168,.08);
  --st-talk:#0A6FA8; --st-run:#0E7C66; --st-admin:#6B4FBB; --st-done:#2E7D32; --st-off:#8A97A2;
}
@media (prefers-color-scheme: dark){:root{
  --bg:#0E161D; --surface:#161F28; --ink:#DEE8F0; --muted:#93A5B3; --line:#2A3B49;
  --accent:#63B7E6; --chip-bg:rgba(99,183,230,.12);
  --st-talk:#63B7E6; --st-run:#4CC2A9; --st-admin:#B39DEB; --st-done:#7CC47F; --st-off:#7C8B97;
}}
:root[data-theme="dark"]{
  --bg:#0E161D; --surface:#161F28; --ink:#DEE8F0; --muted:#93A5B3; --line:#2A3B49;
  --accent:#63B7E6; --chip-bg:rgba(99,183,230,.12);
  --st-talk:#63B7E6; --st-run:#4CC2A9; --st-admin:#B39DEB; --st-done:#7CC47F; --st-off:#7C8B97;
}
:root[data-theme="light"]{
  --bg:#F5F8FA; --surface:#FFFFFF; --ink:#182531; --muted:#5B6C79; --line:#DBE4EB;
  --accent:#0A6FA8; --chip-bg:rgba(10,111,168,.08);
  --st-talk:#0A6FA8; --st-run:#0E7C66; --st-admin:#6B4FBB; --st-done:#2E7D32; --st-off:#8A97A2;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,-apple-system,sans-serif;
  line-height:1.65;}
.wrap{max-width:820px;margin:0 auto;padding:40px 20px 72px;}
header.page{border-bottom:2px solid var(--accent);padding-bottom:20px;margin-bottom:20px;}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:600;}
h1{font-size:clamp(24px,4.5vw,32px);margin:6px 0 4px;text-wrap:balance;}
.sub{color:var(--muted);font-size:14px;display:flex;flex-wrap:wrap;gap:6px 16px;font-variant-numeric:tabular-nums;}
.privnote{margin-top:10px;font-size:13px;color:var(--muted);background:var(--chip-bg);
  border-left:3px solid var(--accent);padding:8px 12px;border-radius:0 6px 6px 0;}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px;}
.stat{font:inherit;font-size:13px;color:var(--muted);background:var(--surface);border:1px solid var(--line);
  border-radius:99px;padding:3px 12px;font-variant-numeric:tabular-nums;cursor:pointer;}
.stat b{color:var(--ink);}
.stat[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff;}
.stat[aria-pressed="true"] b{color:#fff;}
.stat:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;
  padding:16px 18px;margin-bottom:12px;}
.card:hover{border-color:var(--accent);}
.row1{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;}
.brand{font-weight:700;font-size:16px;overflow-wrap:anywhere;}
.brand a{color:inherit;text-decoration:none;border-bottom:1px solid var(--line);}
.brand a:hover,.brand a:focus-visible{border-color:var(--accent);color:var(--accent);outline:none;}
.status{font-size:11.5px;font-weight:700;letter-spacing:.06em;padding:1px 9px;border-radius:99px;
  background:var(--chip-bg);}
.status.talk{color:var(--st-talk)} .status.run{color:var(--st-run)}
.status.admin{color:var(--st-admin)} .status.done{color:var(--st-done)} .status.off{color:var(--st-off)}
.src{font-size:11.5px;font-weight:600;letter-spacing:.06em;padding:0 8px;border-radius:99px;
  border:1px solid var(--line);color:var(--muted);background:transparent;}
.src.biz{border-color:var(--st-admin);color:var(--st-admin);}
.mchip{font-size:12px;font-weight:600;color:var(--accent);background:var(--chip-bg);
  border-radius:99px;padding:1px 9px;}
.meta{font-size:13px;color:var(--muted);margin-top:4px;display:flex;flex-wrap:wrap;gap:2px 14px;
  font-variant-numeric:tabular-nums;}
.summary{font-size:14px;margin:8px 0 0;color:var(--ink);}
.subj{font-size:12.5px;color:var(--muted);margin-top:6px;overflow-wrap:anywhere;}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 16px;}
.fbtn{font:inherit;font-size:13px;padding:4px 14px;border-radius:99px;cursor:pointer;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);}
.fbtn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff;}
.fbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.empty{color:var(--muted);text-align:center;padding:48px 0;}
footer{margin-top:40px;font-size:12.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px;}
"""

def member_names(keys):
    return [MEMBER_BY_KEY[k]["name"] for k in keys if k in MEMBER_BY_KEY]

def render_card(r, with_link):
    brand = html.escape(r["brand"])
    if with_link:
        brand = f'<a href="https://mail.google.com/mail/u/0/#all/{r["thread_id"]}" target="_blank" rel="noopener">{brand}</a>'
    chips = "".join(f'<span class="mchip">{html.escape(n)}</span>' for n in member_names(r["members"]))
    scls = STATUS_CLASS.get(r["status"], "talk")
    meta = [f'<span>來信 {r["date"]}</span>']
    if r.get("launch_month"):
        meta.append(f'<span>預計上線 {r["launch_month"]}</span>')
    if r.get("agency"):
        meta.append(f'<span>代理商：{html.escape(r["agency"])}</span>')
    mem_attr = html.escape(",".join(r["members"]))
    src = r.get("source", "自來")
    src_chip = f'<span class="src{" biz" if src == "業務" else ""}">{"業務提案" if src == "業務" else "自來案"}</span>'
    return f'''<article class="card" data-members="{mem_attr}" data-status="{html.escape(r["status"])}" data-source="{src}">
  <div class="row1"><span class="status {scls}">{html.escape(r["status"])}</span>{src_chip}<span class="brand">{brand}</span>{chips}</div>
  <div class="meta">{"".join(meta)}</div>
  <p class="summary">{html.escape(r["summary"])}</p>
  <div class="subj">{html.escape(r["subject"])}</div>
</article>'''

def render_page(title, subtitle, records, with_link, filters=False, privnote=None):
    now = datetime.now(TPE).strftime("%Y/%m/%d %H:%M")
    records = sorted(records, key=lambda r: (r["date"], r["thread_id"]), reverse=True)
    counts = {s: sum(1 for r in records if r["status"] == s) for s in STATUS_ORDER}
    stats = "".join(f'<button class="stat" aria-pressed="false" data-fs="{s}">{s} <b>{n}</b></button>'
                    for s, n in counts.items() if n)
    stats += "".join(
        f'<button class="stat" aria-pressed="false" data-fo="{key}">{lbl} <b>{n}</b></button>'
        for key, lbl in [("自來", "自來案"), ("業務", "業務提案")]
        if (n := sum(1 for r in records if r.get("source", "自來") == key)))
    body = "".join(render_card(r, with_link) for r in records) or '<div class="empty">目前沒有相關邀約。</div>'
    fhtml = ""
    if filters:
        btns = ['<button class="fbtn" aria-pressed="true" data-f="">全部</button>'] + [
            f'<button class="fbtn" aria-pressed="false" data-f="{m["key"]}">{html.escape(m["name"])}</button>'
            for m in MEMBERS if m["enabled"]]
        fhtml = '<div class="filters" role="group" aria-label="依成員篩選">' + "".join(btns) + "</div>"
    script = """<script>
var fs='',fo='',fm='';
function apply(){
  document.querySelectorAll('.card').forEach(function(c){
    var ok=(!fs||c.dataset.status===fs)&&(!fo||c.dataset.source===fo)&&(!fm||(c.dataset.members||'').split(',').indexOf(fm)>=0);
    c.style.display=ok?'':'none';});
}
document.querySelectorAll('.stat[data-fs]').forEach(function(b){b.addEventListener('click',function(){
  fs=(fs===b.dataset.fs)?'':b.dataset.fs;
  document.querySelectorAll('.stat[data-fs]').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.fs===fs&&fs!==''));});
  apply();});});
document.querySelectorAll('.stat[data-fo]').forEach(function(b){b.addEventListener('click',function(){
  fo=(fo===b.dataset.fo)?'':b.dataset.fo;
  document.querySelectorAll('.stat[data-fo]').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.fo===fo&&fo!==''));});
  apply();});});
document.querySelectorAll('.fbtn').forEach(function(b){b.addEventListener('click',function(){
  fm=b.dataset.f;
  document.querySelectorAll('.fbtn').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});
  apply();});});
</script>"""
    pn = f'<div class="privnote">{privnote}</div>' if privnote else ""
    return f'''<title>{html.escape(title)}</title>
<style>{CSS}</style>
<div class="wrap">
<header class="page">
  <div class="eyebrow">Dcard Video・個人經紀</div>
  <h1>{html.escape(title)}</h1>
  <div class="sub"><span>{subtitle}</span><span>共 {len(records)} 件</span><span>更新於 {now}（台北時間）</span></div>
  {pn}
</header>
<div class="stats">{stats}</div>
{fhtml}
{body}
<footer>只收「成員個人社群合作」邀約（IG 貼文/Story/Reels、Threads、個人 YT、活動出席、社群推廣出演），含品牌直接來信（自來案）與 Dcard 業務轉介（業務提案）；成員出演公司拍攝的影音（Dcard 調查局、中插廣告、節目置入、AD 影音拍攝）不收。本頁由每日排程自動更新；成員名單與狀態修正請編輯 Google Sheet「個人經紀信件網頁後台」。</footer>
</div>
{script}'''

os.makedirs(os.path.join(BASE, "site"), exist_ok=True)

def write(name, content):
    with open(os.path.join(BASE, "site", name), "w", encoding="utf-8") as f:
        f.write(content)

write("overview.html", render_page(
    "個人社群合作邀約 – 總覽", "全部成員", RECORDS, with_link=True, filters=True))

for m in MEMBERS:
    if not m["enabled"]:
        continue
    mine = [r for r in RECORDS if m["key"] in r["members"]]
    write(f"member-{m['key']}.html", render_page(
        f"個人社群合作邀約 – {m['name']}", f"{m['name']} 的合作邀約", mine, with_link=False,
        privnote="此頁僅整理與你相關的個人社群合作邀約，內容含報價等敏感資訊，連結請勿轉發。"))

print("generated:", ", ".join(sorted(os.listdir(os.path.join(BASE, "site")))))
