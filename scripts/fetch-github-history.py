#!/usr/bin/env python3
import html
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


USER = "TechnicalDree"
CURRENT_YEAR = datetime.now(timezone.utc).year
YEARS = list(range(CURRENT_YEAR, CURRENT_YEAR - 5, -1))
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "github-history.json"
OUT_JS = ROOT / "assets" / "github-history.js"


def curl_json(url):
    text = subprocess.check_output(
        [
            "curl", "-fsSL", "--max-time", "30",
            "-H", "Accept: application/json",
            "-H", "User-Agent: personal-website-history-fetcher",
            url,
        ],
        text=True,
    )
    return json.loads(text)


def curl_text(url):
    return subprocess.check_output(
        [
            "curl", "-fsSL", "--max-time", "30",
            "-H", "Accept: text/html",
            "-H", "User-Agent: personal-website-history-fetcher",
            url,
        ],
        text=True,
    )


def parse_attrs(tag):
    return dict(re.findall(r'([a-zA-Z0-9_-]+)="([^"]*)"', tag))


def fetch_year(year):
    url = f"https://github.com/users/{USER}/contributions?from={year}-01-01&to={year}-12-31"
    text = curl_text(url)
    total_match = re.search(r'<h2[^>]*>\s*([0-9,]+)\s+contributions\s+in\s+' + str(year), text)
    total = int(total_match.group(1).replace(",", "")) if total_match else 0
    days = []

    day_tags = re.finditer(r'<td\b[^>]*class="ContributionCalendar-day"[^>]*>', text)
    for match in day_tags:
        attrs = parse_attrs(match.group(0))
        date = attrs.get("data-date")
        if not date:
            continue
        cell_id = attrs.get("id", "")
        coord_match = re.search(r"contribution-day-component-(\d+)-(\d+)", cell_id)
        row = int(coord_match.group(1)) if coord_match else None
        week = int(coord_match.group(2)) if coord_match else None
        level = int(attrs.get("data-level", "0"))
        count = 0
        tip_match = re.search(
            rf'for="{re.escape(cell_id)}"[^>]*>(.*?)</tool-tip>',
            text[match.end(): match.end() + 600],
            re.S,
        )
        if tip_match:
            label = html.unescape(re.sub(r"\s+", " ", tip_match.group(1))).strip()
            count_match = re.match(r"([0-9,]+) contributions?", label)
            if count_match:
                count = int(count_match.group(1).replace(",", ""))
        days.append({"date": date, "count": count, "level": level, "row": row, "week": week})

    return {"year": year, "total": total, "days": days}


def fetch_repos():
    repos = []
    page = 1
    while True:
        batch = curl_json(
            f"https://api.github.com/users/{USER}/repos?per_page=100&page={page}&sort=pushed"
        )
        if not batch:
            break
        repos.extend(repo for repo in batch if not repo.get("archived"))
        if len(batch) < 100:
            break
        page += 1
    return repos


def fetch_commits(repos):
    commits_by_year = {str(year): [] for year in YEARS}
    since = f"{min(YEARS)}-01-01T00:00:00Z"
    until = f"{max(YEARS)}-12-31T23:59:59Z"
    for repo in repos:
        full_name = repo["full_name"]
        url = (
            f"https://api.github.com/repos/{quote(full_name, safe='/')}/commits"
            f"?per_page=100&author={USER}&since={since}&until={until}"
        )
        try:
            commits = curl_json(url)
        except Exception:
            continue
        if isinstance(commits, dict):
            continue
        for item in commits:
            commit = item.get("commit", {})
            date = (commit.get("author") or {}).get("date") or (commit.get("committer") or {}).get("date")
            if not date:
                continue
            year = date[:4]
            if year not in commits_by_year:
                continue
            commits_by_year[year].append({
                "date": date,
                "repo": full_name,
                "message": (commit.get("message") or "commit").splitlines()[0],
                "url": item.get("html_url", f"https://github.com/{full_name}"),
            })

    for commits in commits_by_year.values():
        commits.sort(key=lambda item: item["date"], reverse=True)
    return commits_by_year


def main():
    try:
      years = [fetch_year(year) for year in YEARS]
    except subprocess.CalledProcessError as exc:
      print(f"calendar fetch failed: {exc}", file=sys.stderr)
      return 1

    try:
      commits_by_year = fetch_commits(fetch_repos())
    except subprocess.CalledProcessError as exc:
      print(f"commit fetch failed, preserving existing commits: {exc}", file=sys.stderr)
      if OUT.exists():
          old = json.loads(OUT.read_text())
          commits_by_year = old.get("commitsByYear", {str(year): [] for year in YEARS})
      else:
          commits_by_year = {str(year): [] for year in YEARS}

    payload = {
        "user": USER,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "years": years,
        "commitsByYear": commits_by_year,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    OUT_JS.write_text(
        "window.GITHUB_HISTORY = "
        + json.dumps(payload, separators=(",", ":"))
        + ";\n"
    )
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"Wrote {OUT_JS.relative_to(ROOT)}")
    for year in years:
        print(f"{year['year']}: {year['total']} contributions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
