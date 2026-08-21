#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""統計 Jasmine／彼得的回信速度。

資料來源：response_log.json（觀測記錄，每筆一個「對方來信 → 我方回覆」配對）。
每日排程撈信時順手 append 新配對即可，這支只做統計。

用法：
  python3 response_times.py              # 印出統計並更新 response_times.json
  python3 response_times.py --list       # 另外列出每一筆觀測

兩種延遲都算：
  raw   實際經過時間
  work  只算上班時間（台北週一～五 09:00–19:00），跨夜與週末不計入
        —— 晚上 10 點來信、隔天早上 9 點回，raw 是 11 小時，work 只有 0 分鐘
"""
import json, os, sys
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
TPE = timezone(timedelta(hours=8))
WORK_START, WORK_END = 9, 19          # 台北時間
NAMES = {"jasmine": "Jasmine", "oliver": "彼得 Oliver"}


def parse(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def work_minutes(a, b):
    """a→b 之間的上班分鐘數（台北週一～五 09:00–19:00）。"""
    a, b = a.astimezone(TPE), b.astimezone(TPE)
    if b <= a:
        return 0.0
    total, day = 0.0, a.date()
    while day <= b.date():
        if day.weekday() < 5:
            s = datetime.combine(day, datetime.min.time(), TPE).replace(hour=WORK_START)
            e = datetime.combine(day, datetime.min.time(), TPE).replace(hour=WORK_END)
            lo, hi = max(a, s), min(b, e)
            if hi > lo:
                total += (hi - lo).total_seconds() / 60
        day += timedelta(days=1)
    return total


def pct(vals, p):
    if not vals:
        return None
    vals = sorted(vals)
    if len(vals) == 1:
        return vals[0]
    k = (len(vals) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(vals) - 1)
    return vals[lo] + (vals[hi] - vals[lo]) * (k - lo)


def human(mins):
    if mins is None:
        return "—"
    mins = round(mins)
    if mins < 60:
        return f"{mins} 分"
    if mins < 60 * 24:
        return f"{mins // 60}h{mins % 60:02d}m"
    d, rem = divmod(mins, 60 * 24)
    return f"{d}天{rem // 60}h"


def main():
    log = json.load(open(os.path.join(BASE, "response_log.json")))
    obs = log["observations"]
    used = [o for o in obs if o.get("confident", True)]
    dropped = len(obs) - len(used)

    for o in used:
        a, b = parse(o["inbound_at"]), parse(o["replied_at"])
        o["_raw"] = (b - a).total_seconds() / 60
        o["_work"] = work_minutes(a, b)

    out = {"updated": datetime.now(TPE).strftime("%Y-%m-%d"),
           "note": "回信速度統計。raw=實際經過時間；work=只計台北週一～五 09:00–19:00 的上班時間。"
                   "資料為 Gmail 觀測樣本，時間戳為 T00:00:00Z 的訊息（日期截斷假影）已排除。",
           "sample_size": len(used), "excluded_low_confidence": dropped, "by_person": {}}

    print(f"樣本 {len(used)} 筆（排除 {dropped} 筆低信度時間戳）\n")
    hdr = f"{'':12} {'n':>3}  {'中位數':>9} {'平均':>9} {'p90':>9}   {'上班時間中位數':>12}  {'4h 內':>6}"
    print(hdr)
    print("-" * len(hdr))

    for key in ("jasmine", "oliver"):
        rows = [o for o in used if o["responder"] == key]
        if not rows:
            continue
        raw = [o["_raw"] for o in rows]
        work = [o["_work"] for o in rows]
        within4 = sum(1 for v in raw if v <= 240) / len(raw) * 100
        st = {"n": len(rows),
              "median_min": round(pct(raw, 50), 1), "mean_min": round(sum(raw) / len(raw), 1),
              "p90_min": round(pct(raw, 90), 1),
              "work_median_min": round(pct(work, 50), 1),
              "work_mean_min": round(sum(work) / len(work), 1),
              "within_4h_pct": round(within4, 1),
              "fastest_min": round(min(raw), 1), "slowest_min": round(max(raw), 1)}
        out["by_person"][key] = st
        print(f"{NAMES[key]:12} {len(rows):>3}  {human(pct(raw,50)):>9} {human(sum(raw)/len(raw)):>9} "
              f"{human(pct(raw,90)):>9}   {human(pct(work,50)):>12}  {within4:>5.0f}%")

    allraw = [o["_raw"] for o in used]
    allwork = [o["_work"] for o in used]
    out["overall"] = {"n": len(used), "median_min": round(pct(allraw, 50), 1),
                      "mean_min": round(sum(allraw) / len(allraw), 1),
                      "work_median_min": round(pct(allwork, 50), 1),
                      "within_4h_pct": round(sum(1 for v in allraw if v <= 240) / len(allraw) * 100, 1)}
    print(f"{'合計':12} {len(used):>3}  {human(pct(allraw,50)):>9} {human(sum(allraw)/len(allraw)):>9} "
          f"{human(pct(allraw,90)):>9}   {human(pct(allwork,50)):>12}  "
          f"{out['overall']['within_4h_pct']:>5.0f}%")

    pend = log.get("pending", [])
    if pend:
        now = datetime.now(timezone.utc)
        print(f"\n尚未回覆（{len(pend)} 件）：")
        for p in sorted(pend, key=lambda x: x["inbound_at"]):
            print(f"  {human((now - parse(p['inbound_at'])).total_seconds()/60):>10}  {p['case']}")
    out["pending"] = pend

    json.dump(out, open(os.path.join(BASE, "response_times.json"), "w"),
              ensure_ascii=False, indent=1)

    if "--list" in sys.argv:
        print("\n逐筆：")
        for o in sorted(used, key=lambda x: x["_raw"]):
            print(f"  {human(o['_raw']):>10} (上班 {human(o['_work']):>8})  "
                  f"{NAMES[o['responder']]:12} {o['case']}")


if __name__ == "__main__":
    main()
