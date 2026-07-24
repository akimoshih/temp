#!/usr/bin/env python3
# 以 VibeHost REST API 部署 site/ 頁面（走 HTTPS_PROXY，繞過 CLI 串流上傳與 proxy 不相容的問題）。
# 用法：python3 vibehost_deploy.py [app1 app2 ...]（不帶參數＝部署全部 PAGES）
import hashlib, json, os, sys, time
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
API = "https://api.vibehost.com"

PAGES = {
    "collab-overview": "overview.html",
    "collab-rio": "member-rio.html",
    "collab-andrew": "member-andrew.html",
    "collab-agen": "member-agen.html",
    "collab-roy": "member-roy.html",
    "collab-meber": "member-meber.html",
    "collab-yy": "member-yy.html",
    "collab-lauren": "member-lauren.html",
    "collab-royce": "member-royce.html",
    "collab-ellie": "member-ellie.html",
    "collab-nakaw": "member-nakaw.html",
    "collab-leo": "member-leo.html",
}

# 先讓 CLI 刷新 token（失敗就中止，避免拿過期 token 部署到一半才炸）
import subprocess
whoami = subprocess.run(["vibehost", "whoami"], capture_output=True, text=True,
                        env={**os.environ, "PATH": os.environ["PATH"] + ":" + os.path.expanduser("~/.local/bin")})
if whoami.returncode != 0:
    raise SystemExit(f"DEPLOY ABORTED: vibehost 登入失效，請重新 vibehost login（{whoami.stderr.strip()[:200]}）")

cfg = json.load(open(os.path.expanduser("~/.config/vibehost/config.json")))
TOKEN, WS, WS_SLUG = cfg["token"], cfg["currentWorkspaceId"], cfg["currentWorkspace"]

import ssl, urllib.error
proxy = os.environ.get("HTTPS_PROXY")
handlers = []
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
if proxy:
    handlers.append(urllib.request.ProxyHandler({"https": proxy}))
handlers.append(urllib.request.HTTPSHandler(context=ctx))
opener = urllib.request.build_opener(*handlers)

def call(method, path, body=None, headers=None, raw=False):
    url = API + path
    data = body if raw else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("x-vibehost-workspace", WS_SLUG)
    if not raw and body is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with opener.open(req, timeout=120) as r:
            out = json.loads(r.read().decode() or "{}")
            if isinstance(out, dict) and out.get("ok") is True and "data" in out:
                return out["data"]
            return out
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} {method} {path}: {e.read().decode()[:400]}")

def ws_path(suffix):
    return f"/api/v1/workspaces/{WS}/{suffix}"

apps = call("GET", ws_path("apps"))
app_ids = {a["name"]: a["id"] for a in (apps.get("data") if isinstance(apps, dict) and "data" in apps else apps)}

targets = sys.argv[1:] or list(PAGES)
results = {}
for app in targets:
    src = os.path.join(BASE, "site", PAGES[app])
    content = open(src, "rb").read()
    sha = hashlib.sha256(content).hexdigest()
    manifest = [{"path": "index.html", "sha256": sha, "size": len(content)}]
    if app not in app_ids:
        created = call("POST", ws_path("apps"), {"name": app, "runtime": "static"})
        app_ids[app] = (created.get("data") or created)["id"]
    missing = call("POST", "/api/v1/blobs/missing", {"shas": [sha]})["missing"]
    if sha in missing:
        call("PUT", f"/api/v1/blobs/{sha}", content, raw=True,
             headers={"Content-Type": "application/octet-stream", "Content-Length": str(len(content))})
    dep = call("POST", ws_path(f"apps/{app_ids[app]}/deploy-manifest"),
               {"manifest": manifest, "channel": "production"})
    dep_id = dep.get("deploymentId") or dep.get("id") or (dep.get("data") or {}).get("deploymentId")
    status, cur = dep.get("status", "starting"), dep
    deadline = time.time() + 300
    while status not in ("healthy", "failed", "rolled_back", "superseded") and time.time() < deadline:
        time.sleep(4)
        cur = call("GET", ws_path(f"deployments/{dep_id}"))
        status = str(cur.get("status", ""))
    url = cur.get("url") or cur.get("aliasUrl") or dep.get("url")
    results[app] = {"status": status, "url": url, "immutableUrl": cur.get("immutableUrl") or dep.get("immutableUrl")}
    print(f"{app}: {status} {url or ''}", flush=True)

# 權限：成員頁授權給該成員的 email；所有頁面都授權給 EXTRA_VIEWERS（viewer）。已授權過會回錯誤，忽略即可
EXTRA_VIEWERS = ["jasmine.wang@dcard.cc"]
members = json.load(open(os.path.join(BASE, "members.json")))
email_by_app = {f"collab-{m['key']}": m["email"] for m in members}
for app in targets:
    if app not in app_ids:
        continue
    emails = [email_by_app[app]] if app in email_by_app else []
    emails += EXTRA_VIEWERS
    for email in emails:
        try:
            call("POST", ws_path(f"apps/{app_ids[app]}/grants/email"), {"email": email, "role": "viewer"})
            print(f"{app}: granted viewer to {email}", flush=True)
        except SystemExit as e:
            print(f"{app}: grant {email} skipped ({str(e)[:100]})", flush=True)

print(json.dumps(results, ensure_ascii=False, indent=1))
bad = [a for a, r in results.items() if r["status"] != "healthy"]
if bad:
    raise SystemExit(f"DEPLOY FAILED: {', '.join(bad)}")
print(f"ALL OK {len(results)}/{len(targets)}")
