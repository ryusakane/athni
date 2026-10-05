#!/usr/bin/env python3
"""Add profile_url to each roster player and coach in sites/*.json.

Reads only pages already in the fetch cache (the roster page and the staff directory a program
was collected from), so it makes no requests. A person's profile is the link on those pages whose
path ends in the person's name slug, e.g. /sports/mens-golf/roster/player/kris-kim (WMT),
/sports/womens-golf/roster/amber-li/18046 (Sidearm) or /staff-directory/blaine-woodruff/562.

Pages cached on another machine can be supplied as ATHNI_LINKS, a JSON file mapping the cache key
(sha1 of the URL) to the person links on that page.

Run: python3 data/colleges/collect/profiles.py [slug ...]
"""
import glob
import hashlib
import json
import os
import re
import sys
import unicodedata
from urllib.parse import urljoin, urlsplit

import fetch

HERE = os.path.dirname(os.path.abspath(__file__))
HREF = re.compile(r'href="([^"#?]+)"')
PERSON_PATH = re.compile(r"/(roster|coaches|staff|staff-directory)/", re.I)


def cached(url):
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(fetch.CACHE, key[:2], key)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        final, status, text = fh.read().split("\n", 2)
    return (final, text) if status == "200" else None


def slug(name):
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


EXTRA = {}
if os.environ.get("ATHNI_LINKS"):
    with open(os.environ["ATHNI_LINKS"], encoding="utf-8") as fh:
        EXTRA = json.load(fh)


def links(url):
    page = cached(url) if url else None
    if not page:
        return EXTRA.get(hashlib.sha1(url.encode()).hexdigest(), []) if url else []
    final, text = page
    host = urlsplit(final).netloc
    out = []
    for h in HREF.findall(text):
        u = urljoin(final, h.replace("&amp;", "&"))
        if urlsplit(u).netloc == host and PERSON_PATH.search(urlsplit(u).path):
            out.append(u.replace(":443", ""))
    return list(dict.fromkeys(out))


def find(name, urls, kind):
    s = slug(name)
    if not s:
        return None
    hits = []
    for u in urls:
        segs = urlsplit(u).path.rstrip("/").split("/")
        # the name slug is the last segment, or the one before a numeric id
        if s not in (segs[-1], segs[-2] if len(segs) > 1 and segs[-1].isdigit() else None):
            continue
        p = urlsplit(u).path.lower()
        is_staff = any(x in p for x in ("/coaches/", "/staff/", "staff-directory/"))
        if (kind == "coach") == is_staff:
            hits.append(u)
    return hits[0] if hits else None


def main():
    only = set(sys.argv[1:])
    counts = {"players": 0, "player_links": 0, "coaches": 0, "coach_links": 0}
    for path in sorted(glob.glob(os.path.join(os.environ.get("ATHNI_SITES", os.path.join(HERE, "sites")), "*.json"))):
        with open(path, encoding="utf-8") as fh:
            site = json.load(fh)
        if only and site["slug"] not in only:
            continue
        for prog in site.get("programs", []):
            roster_links = links(prog.get("roster_source_url"))
            staff_links = roster_links + links(prog.get("coaches_url"))
            for r in prog.get("roster") or []:
                r["profile_url"] = find(r["name"], roster_links, "player")
                counts["players"] += 1
                counts["player_links"] += bool(r["profile_url"])
            for c in prog.get("coaches") or []:
                c["profile_url"] = find(c["name"], staff_links + links(c.get("source_url")), "coach")
                counts["coaches"] += 1
                counts["coach_links"] += bool(c["profile_url"])
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(site, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
    print(counts)


if __name__ == "__main__":
    main()
