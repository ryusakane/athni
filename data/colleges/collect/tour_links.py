#!/usr/bin/env python3
"""Official tour profile links for each pro alumnus, read from their Wikipedia article.

Wikipedia's external-link templates ({{PGATour player|46442}}, {{LPGA player|rose-zhang/99390}}, ...)
carry each tour's player id. A template written without an id takes it from Wikidata, so those ids
are read from the person's Wikidata page. Tour sites themselves are never fetched: their terms forbid
automated access, and only the link is published, not results.

Input alumni/d1.json (from alumni.py). Writes alumni/tour_links.json: {wikipedia url: [{tour, url}]}.
Run: python3 data/colleges/collect/tour_links.py
"""
import json
import os
import re

import fetch

HERE = os.path.dirname(os.path.abspath(__file__))

# template name (lower case, spaces) → (tour, Wikidata property, url builder)
TOURS = {
    "pgatour player": ("PGA Tour", "P2811", lambda i: f"https://www.pgatour.com/player/{i}"),
    "pga tour player": ("PGA Tour", "P2811", lambda i: f"https://www.pgatour.com/player/{i}"),
    "eurotour player": ("DP World Tour", "P3521", lambda i: f"https://www.europeantour.com/players/{i}/"),
    "european tour player": ("DP World Tour", "P3521", lambda i: f"https://www.europeantour.com/players/{i}/"),
    "lpga player": ("LPGA Tour", "P2810", lambda i: f"https://www.lpga.com/players/{'-/' if i.isdigit() else ''}{i}/overview"),
    "lpga tour player": ("LPGA Tour", "P2810", lambda i: f"https://www.lpga.com/players/{'-/' if i.isdigit() else ''}{i}/overview"),
    "ladieseurotour player": ("Ladies European Tour", "P3897", lambda i: f"https://ladieseuropeantour.com/player-profiles/{i}"),
    "ladies european tour player": ("Ladies European Tour", "P3897", lambda i: f"https://ladieseuropeantour.com/player-profiles/{i}"),
    "japantour player": ("Japan Golf Tour (JGTO)", "P3535", lambda i: f"https://www.jgto.org/en/player/{i}/profile"),
    "jlpga player": ("JLPGA Tour", "P12108", lambda i: f"https://www.lpga.or.jp/en/members/info/{i}"),
    "asiantour player": ("Asian Tour", "P11141", lambda i: f"https://asiantour.com/playerprofile/{i}"),
    "asian tour player": ("Asian Tour", "P11141", lambda i: f"https://asiantour.com/playerprofile/{i}"),
    "sunshinetour player": ("Sunshine Tour", "P3582", lambda i: f"https://sunshinetour.com/playerprofile/{i}"),
    "owgr": ("Official World Golf Ranking", "P3568", lambda i: f"https://www.owgr.com/playerprofile/{i}"),
    "official world golf ranking": ("Official World Golf Ranking", "P3568", lambda i: f"https://www.owgr.com/playerprofile/{i}"),
    "wwgr": ("Women's World Golf Rankings", "P12018", lambda i: f"https://www.rolexrankings.com/players/{i}"),
    "women's world golf rankings": ("Women's World Golf Rankings", "P12018", lambda i: f"https://www.rolexrankings.com/players/{i}"),
}
# profile URLs written out in the article (e.g. LIV Golf, which has no template)
URL_TOURS = [
    (re.compile(r"https?://(?:www\.)?livgolf\.com/player/[a-z0-9-]+", re.I), "LIV Golf"),
    (re.compile(r"https?://(?:www\.)?kpga\.co\.kr/[^\s|\]}]+", re.I), "KPGA Tour"),
    (re.compile(r"https?://(?:www\.)?klpga\.co\.kr/[^\s|\]}]+", re.I), "KLPGA Tour"),
]
ORDER = ["PGA Tour", "LIV Golf", "DP World Tour", "Asian Tour", "Japan Golf Tour (JGTO)", "Sunshine Tour", "KPGA Tour",
         "LPGA Tour", "Ladies European Tour", "JLPGA Tour", "KLPGA Tour",
         "Official World Golf Ranking", "Women's World Golf Rankings"]
TEMPLATE = re.compile(r"^\*\s*\{\{\s*([^|}]+?)\s*(?:\|([^}]*))?\}\}", re.M)


def wikidata_ids(title_url):
    """Property → first value from the person's Wikidata page (only for templates without an id)."""
    _, status, text = fetch.get(title_url)
    m = re.search(r'"wgWikibaseItemId":"(Q\d+)"', text or "") if status == 200 else None
    if not m:
        return {}
    _, status, text = fetch.get(f"https://www.wikidata.org/wiki/{m.group(1)}")
    out = {}
    if status != 200:
        return out
    for pid in {t[1] for t in TOURS.values()}:
        block = re.search(rf'id="{pid}" data-property-id.*?variation-valuesnak">(.*?)</div>', text, re.S)
        if block:
            out[pid] = re.sub(r"<[^>]+>", "", block.group(1)).strip()
    return out


def links_for(url):
    _, status, raw = fetch.get(url + "?action=raw")
    if status != 200:
        return []
    found, wd = {}, None
    for m in TEMPLATE.finditer(raw):
        t = TOURS.get(m.group(1).strip().lower().replace("_", " "))
        if not t:
            continue
        tour, pid, build = t
        args = [a.strip() for a in (m.group(2) or "").split("|")]
        ident = next((a for a in args if a and "=" not in a), None) or \
            next((a.split("=", 1)[1].strip() for a in args if a.startswith("id=")), None)
        if any(a.startswith("archive=") for a in args):
            continue  # profile only survives in the web archive
        if not ident:
            wd = wd if wd is not None else wikidata_ids(url)
            ident = wd.get(pid)
        if ident and tour not in found:
            found[tour] = build(ident.strip())
    for rx, tour in URL_TOURS:
        m = rx.search(raw)
        if m and tour not in found:
            found[tour] = m.group(0)
    return [{"tour": t, "url": found[t]} for t in ORDER if t in found]


def main():
    with open(os.path.join(HERE, "alumni", "d1.json"), encoding="utf-8") as fh:
        alumni = json.load(fh)
    out = {}
    for a in alumni:
        if a["source_url"] not in out:
            out[a["source_url"]] = links_for(a["source_url"])
    with open(os.path.join(HERE, "alumni", "tour_links.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    n = sum(1 for v in out.values() if any(x["tour"] not in ORDER[-2:] for x in v))
    print(f"{len(out)} people, {n} with a tour profile link")


if __name__ == "__main__":
    main()
