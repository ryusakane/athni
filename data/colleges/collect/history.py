#!/usr/bin/env python3
"""Collect past-season rosters and coaching staffs (default 2016-17 to 2025-26) for every program.

Uses the golf page found by collect_sites.py (sites/<slug>.json) and tries the athletics platforms'
past-season roster URLs: <golf>/roster/<season> (Sidearm, most WMT) and <golf>/roster/season/<season>.
Season links offered on the current roster page (e.g. ?season=2016-17) are tried first.
A page counts only when it really is that season: WMT pages must hold a roster for that season,
other pages must have the season in their final URL and not name a different one.
Each player keeps name, class, hometown, previous school, major (when listed) and profile link.
Writes history/<slug>.json.

Run: python3 data/colleges/collect/history.py [slug ...]   (no args = all schools)
Env: ATHNI_WORKERS (parallel hosts, default 8), ATHNI_SEASONS (e.g. "2016-2025", first-last start years).
"""
import concurrent.futures as cf
import datetime
import glob
import json
import os
import re
import sys
from urllib.parse import urljoin, urlsplit

import fetch
import parse
import profiles

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "history")
TODAY = datetime.date.today().isoformat()
first, last = map(int, os.environ.get("ATHNI_SEASONS", "2016-2025").split("-"))
SEASONS = [f"{y}-{str(y + 1)[2:]}" for y in range(last, first - 1, -1)]


def get(url, log):
    try:
        final, status, text = fetch.get(url)
    except fetch.Blocked:
        log.append({"url": url, "status": "robots-disallowed"})
        return None, None, None
    log.append({"url": url, "status": "bot-wall" if fetch.is_bot_wall(status, text) else status})
    return final, status, text


SEASON = re.compile(r"(20[0-3]\d)(?:[-–_/](?:20)?(\d\d))?")
HREF = re.compile(r'(?:href|value)="([^"]+)"')


def norm_season(s):
    m = SEASON.search(s or "")
    if not m:
        return None
    y = int(m.group(1))
    # a bare year names the spring the season ends in on most sites ("2017" = 2016-17)
    return f"{y}-{m.group(2)}" if m.group(2) else f"{y - 1}-{str(y)[2:]}"


def season_links(prog, log):
    """Past-season roster links offered on the current roster page (links or a season dropdown)."""
    url = prog.get("roster_source_url") or prog.get("roster_url")
    if not url:
        return {}
    final, status, text = get(url, log)
    if status != 200:
        return {}
    out = {}
    for h in HREF.findall(text):
        u = urljoin(final, h.replace("&amp;", "&"))
        if "roster" not in u.lower() or urlsplit(u).netloc != urlsplit(final).netloc:
            continue
        tail = u[len(final.split("?")[0].rstrip("/")):] if u.startswith(final.split("?")[0].rstrip("/")) else ""
        if re.search(r"/(staff|player|coaches)/", tail):
            continue
        s = norm_season(tail)
        if s and s not in out:
            out[s] = u
    return out


def season_page(golf, gender, season, log, offered=None):
    urls = [offered] if offered else []
    # WMT names a season by the year it starts (/roster/season/2016 = 2016-17)
    urls += [f"{golf}/roster/{season}", f"{golf}/roster/season/{season}", f"{golf}/roster/season/{season[:4]}"]
    for url in dict.fromkeys(urls):
        final, status, text = get(url, log)
        if status == 403 and fetch.is_bot_wall(status, text):
            return {"blocked": True}
        if status != 200:
            continue
        r = parse.parse_roster(text, gender, season)
        if not r or not r["players"]:
            continue
        if "__NUXT_DATA__" in text and "sidearm" not in text.lower() and r["parser"] != "wmt":
            continue  # a WMT page without that season's roster
        if r["parser"] != "wmt" and (norm_season(url[len(golf):]) != season or (r["season"] and r["season"] != season)):
            continue  # redirected to the current roster
        links = profiles.links(url)
        for p in r["players"]:
            p["profile_url"] = profiles.find(p["name"], links, "player")
        for c in r["coaches"]:
            c["profile_url"] = profiles.find(c["name"], links, "coach")
        return {"url": final, "parser": r["parser"], "players": r["players"], "coaches": r["coaches"]}
    return None


def collect(path):
    with open(path, encoding="utf-8") as fh:
        site = json.load(fh)
    log, programs = [], []
    for prog in site.get("programs", []):
        golf = (prog.get("golf_url") or "").rstrip("/")
        out = {"gender": prog["gender"], "golf_url": golf or None, "seasons": {}}
        programs.append(out)
        if not golf:
            continue
        misses = 0
        offered = season_links(prog, log)
        for season in SEASONS:
            r = season_page(golf, prog["gender"], season, log, offered.get(season))
            if r and r.get("blocked"):
                out["blocked"] = True
                break
            if r:
                out["seasons"][season] = r
                misses = 0
            else:
                misses += 1
                if misses >= 3 and not out["seasons"]:
                    break  # this site publishes no past rosters at these URLs
    res = {"slug": site["slug"], "checked_at": TODAY, "programs": programs, "requests": log}
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, site["slug"] + ".json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    got = sum(len(p["seasons"]) for p in programs)
    return f"{site['slug']}: seasons={got}" + (" blocked" if any(p.get("blocked") for p in programs) else "")


def main():
    paths = sorted(glob.glob(os.path.join(HERE, "sites", "*.json")))
    if len(sys.argv) > 1:
        paths = [p for p in paths if os.path.basename(p)[:-5] in sys.argv[1:]]
    with cf.ThreadPoolExecutor(int(os.environ.get("ATHNI_WORKERS", "8"))) as ex:
        for line in ex.map(collect, paths):
            print(line, flush=True)


if __name__ == "__main__":
    main()
