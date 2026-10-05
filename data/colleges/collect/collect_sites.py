#!/usr/bin/env python3
"""Collect golf program details from each school's official athletics site.

For every school in schools.json: golf page URL, golf-team social accounts, current roster
(name, class year, hometown, previous school) and coaching staff (title, email, phone as published),
plus the athletics staff directory to fill in emails/phones. Writes sites/<slug>.json.

Run: python3 data/colleges/collect/collect_sites.py [slug ...]   (no args = all schools)
Env: ATHNI_WORKERS (parallel hosts, default 8), ATHNI_HOST_DELAY (seconds between requests per host).
"""
import concurrent.futures as cf
import datetime
import json
import os
import re
import sys
from urllib.parse import urljoin, urlsplit

import discover
import fetch
import parse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "sites")
TODAY = datetime.date.today().isoformat()


def get(url, log):
    try:
        final, status, text = fetch.get(url)
    except fetch.Blocked:
        log.append({"url": url, "status": "robots-disallowed"})
        return None, None, None
    log.append({"url": url, "status": "bot-wall" if fetch.is_bot_wall(status, text) else status})
    return final, status, text


def find_roster_url(golf_url, log):
    final, status, text = get(golf_url, log)
    if status != 200:
        return None
    for l in discover.links(text, final):
        if re.search(r"/roster/?$", l) and "golf" in l.lower():
            return l
    return None


def same_person(a, b):
    na = re.sub(r"[^a-z]", "", a.lower())
    nb = re.sub(r"[^a-z]", "", b.lower())
    return na == nb or (na[-6:] == nb[-6:] and na[:3] == nb[:3])


def collect_program(home, gender, prog, log):
    out = {"gender": gender, "golf_url": prog.get("golf_url"), "collected_at": TODAY}
    for k in discover.SOCIAL:
        out[k] = prog.get(k)
    golf = prog.get("golf_url")
    if not golf:
        return out
    # Socials on the team's own page are the most reliable
    final, status, text = get(golf, log)
    if status == 200:
        soc = discover.socials(discover.links(text, final), [gender])[gender]
        for k, v in soc.items():
            out[k] = v
    roster_url = golf.rstrip("/") + "/roster"
    final, status, text = get(roster_url, log)
    if status != 200:
        alt = find_roster_url(golf, log)
        if alt and alt != roster_url:
            roster_url = alt
            final, status, text = get(roster_url, log)
    if status == 200:
        r = parse.parse_roster(text, gender)
        if r:
            out.update(roster_url=final, roster_source_url=final, roster_season=r["season"], parser=r["parser"],
                       roster=r["players"], coaches=[dict(c, source_url=final) for c in r["coaches"]])
    # Staff directory: fill emails/phones, or supply the coaches if the roster page had none
    base = f"https://{urlsplit(home).netloc}"
    final, status, text = get(base + "/staff-directory", log)
    if status == 200:
        directory = parse.parse_staff_directory(text, gender)
        coaches = out.setdefault("coaches", [])
        for d in directory:
            match = next((c for c in coaches if same_person(c["name"], d["name"])), None)
            if match:
                for f in ("email", "phone"):
                    if not match.get(f) and d.get(f):
                        match[f] = d[f]
                        match.setdefault("field_sources", {})[f] = final
            elif not any(c.get("source_url", "").endswith("/roster") for c in coaches) and parse.is_coach(d["title"]):
                coaches.append(dict(d, source_url=final))
        out["coaches_url"] = final if directory else None
    return out


def collect(school):
    log = []
    res = {"slug": school["slug"], "athletics_url": school["athletics_url"], "checked_at": TODAY, "programs": []}
    d = discover.discover(school["athletics_url"], school["genders"])
    res["home_status"] = "robots-disallowed" if d.get("robots_blocked") else \
        "bot-wall" if d.get("bot_wall") else d.get("home_status")
    res["athletics_url_final"] = d.get("home_url")
    if res["home_status"] == 200:
        for g in school["genders"]:
            res["programs"].append(collect_program(d["home_url"], g, d["programs"].get(g, {}), log))
    res["requests"] = log
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, school["slug"] + ".json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    n = sum(len(p.get("roster", [])) for p in res["programs"])
    return f"{school['slug']}: {res['home_status']} players={n}"


def main():
    with open(os.path.join(HERE, "schools.json"), encoding="utf-8") as fh:
        schools = json.load(fh)
    if len(sys.argv) > 1:
        schools = [s for s in schools if s["slug"] in sys.argv[1:]]
    with cf.ThreadPoolExecutor(int(os.environ.get("ATHNI_WORKERS", "8"))) as ex:
        for line in ex.map(collect, schools):
            print(line, flush=True)


if __name__ == "__main__":
    main()
