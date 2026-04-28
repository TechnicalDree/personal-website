#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOTS_JS = ROOT / "assets" / "dashboard-snapshots.js"

CURSOR_WEEKS = {
    20: [[6, 3]],
    22: [[1, 1], [3, 1], [4, 1], [6, 1], [7, 2]],
    23: [[1, 3]],
    24: [[4, 1], [5, 1], [6, 1], [7, 1]],
    26: [[1, 1], [2, 2], [3, 1], [4, 1], [5, 2], [6, 1], [7, 1]],
    27: [[1, 1], [2, 2], [4, 1], [5, 1]],
    28: [[4, 2], [7, 1]],
    29: [[7, 1]],
    30: [[1, 1], [3, 1], [5, 2]],
    31: [[2, 1], [3, 1], [5, 1]],
    32: [[3, 1], [5, 1], [6, 1]],
    39: [[7, 2]],
    40: [[1, 2], [7, 1]],
    41: [[1, 1], [2, 2], [6, 3], [7, 2]],
    42: [[2, 1], [3, 1], [4, 2], [5, 1], [6, 1], [7, 1]],
    43: [[3, 1], [4, 1], [5, 3], [6, 2]],
    44: [[1, 1], [5, 2]],
    45: [[1, 1], [3, 1], [4, 1], [5, 1], [6, 2]],
    46: [[1, 4], [3, 4], [5, 1], [7, 1]],
    47: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 3], [6, 1]],
    48: [[1, 1], [4, 1], [5, 2], [6, 1], [7, 1]],
    49: [[4, 3], [5, 1], [6, 4]],
    50: [[1, 2], [2, 1], [5, 3], [6, 1]],
    51: [[2, 1], [3, 1], [6, 2], [7, 1]],
    52: [[5, 1], [6, 1]],
    53: [[1, 4], [2, 2]],
}

WISPR_WEEKS = {
    14: [[2, 3], [3, 4], [4, 4], [5, 4], [6, 4], [7, 3]],
    15: [[1, 1], [2, 1], [3, "muted"], [4, 1], [5, 3], [6, 3], [7, "muted"]],
    16: [[1, 1], [2, 1], [3, 2], [4, 2], [5, 2], [6, "muted"], [7, 2]],
    17: [[1, "muted"], [2, 1, True], [3, 1, True], [4, 1, True], [5, 4, True], [6, 4, True], [7, 2, True]],
    18: [[1, 2, True], [2, 2, True]],
}


def run(label, args, required=True):
    print(f"==> {label}")
    result = subprocess.run(args, cwd=ROOT)
    if result.returncode != 0 and required:
        raise SystemExit(result.returncode)
    if result.returncode != 0:
        print(f"warning: {label} skipped or failed", file=sys.stderr)


def env_int(name, fallback):
    value = os.environ.get(name)
    if not value:
        return fallback
    return int(value.replace(",", ""))


def write_snapshots():
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "generatedAt": now,
        "cursor": {
            "source": "snapshot",
            "updatedAt": os.environ.get("CURSOR_UPDATED_AT", now),
            "dashboardUrl": "https://cursor.com/dashboard",
            "totalLineEdits": env_int("CURSOR_AI_LINE_EDITS", 49999),
            "mostActiveMonth": os.environ.get("CURSOR_MOST_ACTIVE_MONTH", "April"),
            "mostActiveDay": os.environ.get("CURSOR_MOST_ACTIVE_DAY", "Mar 10, 2026"),
            "longestStreak": os.environ.get("CURSOR_LONGEST_STREAK", "9d"),
            "currentStreak": os.environ.get("CURSOR_CURRENT_STREAK", "2d"),
            "weeks": CURSOR_WEEKS,
        },
        "wispr": {
            "source": "snapshot",
            "updatedAt": os.environ.get("WISPR_UPDATED_AT", now),
            "dashboardUrl": "https://admin.wisprflow.ai/",
            "account": "adrianm2003az@gmail.com",
            "currentStreak": os.environ.get("WISPR_CURRENT_STREAK", "8 day streak"),
            "longestStreak": os.environ.get("WISPR_LONGEST_STREAK", "18 DAYS"),
            "weeks": WISPR_WEEKS,
        },
    }
    SNAPSHOTS_JS.write_text(
        "window.DASHBOARD_SNAPSHOTS = "
        + json.dumps(payload, separators=(",", ":"))
        + ";\n"
    )
    print(f"Wrote {SNAPSHOTS_JS.relative_to(ROOT)}")


def main():
    run("refresh GitHub contribution history", [sys.executable, "scripts/fetch-github-history.py"])
    run("refresh Monkeytype history", [sys.executable, "scripts/fetch-monkeytype-history.py"], required=False)
    write_snapshots()
    print("Cursor and Wispr Flow are private dashboard snapshots. Set CURSOR_* and WISPR_* env vars, or update this script when official export/API access is available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

