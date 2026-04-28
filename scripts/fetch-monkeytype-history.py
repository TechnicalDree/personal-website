#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode


USER = os.environ.get("MONKEYTYPE_USER", "TechnicalDree")
APE_KEY = os.environ.get("MONKEYTYPE_APE_KEY")
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "monkeytype-history.json"
OUT_JS = ROOT / "assets" / "monkeytype-history.js"
PB_MODES = {
    "time": ["15", "30", "60", "120"],
    "words": ["10", "25", "50", "100"],
}
AUTH_ERRORS = {
    470: "Invalid ApeKey. Regenerate it in Monkeytype settings.",
    471: "ApeKey is inactive. In Monkeytype settings, check the Active box next to the key.",
    472: "ApeKey is malformed. Make sure MONKEYTYPE_APE_KEY contains only the copied key.",
    479: "ApeKey rate limit exceeded. Wait and try again.",
}


class MonkeytypeApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(f"Monkeytype API {status}: {message}")


def curl_json(url, ape_key=None):
    args = [
        "curl", "-sS", "-L", "--max-time", "30",
        "-H", "Accept: application/json",
        "-H", "User-Agent: personal-website-monkeytype-fetcher",
        "-w", "\n%{http_code}",
    ]
    if ape_key:
        args.extend(["-H", f"Authorization: ApeKey {ape_key}"])
    args.append(url)
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise MonkeytypeApiError(0, result.stderr.strip() or "request failed")

    body, _, status_text = result.stdout.rpartition("\n")
    status = int(status_text) if status_text.isdigit() else 0
    try:
        payload = json.loads(body) if body.strip() else {}
    except json.JSONDecodeError:
        payload = {"message": body.strip()}
    if status >= 400:
        message = AUTH_ERRORS.get(status) or payload.get("message") or "request failed"
        raise MonkeytypeApiError(status, message)
    return payload


def try_public_profile(username):
    url = f"https://api.monkeytype.com/users/{username}/profile?isUid=false"
    try:
        payload = curl_json(url)
    except MonkeytypeApiError:
        return None
    data = payload.get("data")
    return data if isinstance(data, dict) and data.get("name") else None


def fetch_personal_bests():
    personal_bests = {}
    for mode, mode2_values in PB_MODES.items():
        personal_bests[mode] = {}
        for mode2 in mode2_values:
            query = urlencode({"mode": mode, "mode2": mode2})
            payload = curl_json(f"https://api.monkeytype.com/users/personalBests?{query}", APE_KEY)
            results = payload.get("data", [])
            if isinstance(results, dict):
                results = results.get("personalBests") or results.get("results") or [results]
            if not isinstance(results, list):
                results = []
            personal_bests[mode][mode2] = results
    return personal_bests


def fetch_results():
    try:
        payload = curl_json("https://api.monkeytype.com/results?limit=1000&offset=0", APE_KEY)
    except MonkeytypeApiError as exc:
        if exc.status in AUTH_ERRORS:
            raise
        return []
    data = payload.get("data", [])
    if isinstance(data, dict):
        data = data.get("results") or data.get("data") or []
    return data if isinstance(data, list) else []


def activity_days(results):
    counts = Counter()
    for result in results:
        timestamp = result.get("timestamp")
        if not timestamp:
            continue
        if timestamp > 10_000_000_000:
            timestamp = timestamp / 1000
        day = datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()
        counts[day] += 1

    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=370)
    days = []
    total = 0
    for offset in range(371):
        day = start + timedelta(days=offset)
        count = counts[day.isoformat()]
        total += count
        days.append({
            "date": day.isoformat(),
            "count": count,
            "level": activity_level(count),
            "row": ((day.weekday() + 1) % 7) + 1,
        })
    return days, total


def activity_level(count):
    if count <= 0:
        return 0
    if count <= 1:
        return 1
    if count <= 3:
        return 2
    if count <= 6:
        return 3
    return 4


def main():
    profile = try_public_profile(USER)
    if not profile and not APE_KEY:
        print(
            "Monkeytype public profile was not found. Set MONKEYTYPE_USER to the exact public username, "
            "or set MONKEYTYPE_APE_KEY to generate an authenticated local export.",
            file=sys.stderr,
        )
        return 1

    if APE_KEY:
        results = fetch_results()
        days, total = activity_days(results)
        profile = profile or {"name": USER}
        profile["personalBests"] = fetch_personal_bests()
        profile.setdefault("typingStats", {})
        profile["typingStats"]["completedTests"] = max(len(results), profile["typingStats"].get("completedTests", 0))
        profile["testActivity"] = {
            "days": days,
            "testsByDays": [day["count"] for day in days],
            "total": total,
        }

    payload = {
        "user": USER,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "profile": profile,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    OUT_JS.write_text("window.MONKEYTYPE_HISTORY = " + json.dumps(payload, separators=(",", ":")) + ";\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"Wrote {OUT_JS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MonkeytypeApiError as exc:
        print(f"Monkeytype export failed: {exc.message}", file=sys.stderr)
        print("No ApeKey was printed. If you already pasted one into a terminal or chat, revoke it and create a new active key.", file=sys.stderr)
        raise SystemExit(1)

