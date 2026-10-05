#!/usr/bin/env python3
"""Write ranking tables to data/colleges/rankings/.

- GCAA (Bushnell/Golfweek) Division I men's coaches poll, top 25, from gcaa.coach
- NCAA Division I championship final team standings (men and women), from the Wikipedia
  article for that year's championship (CC BY-SA 4.0)

Clippd Scoreboard (the NCAA's official rankings) is not collected: its terms forbid
automated access. The WGCA women's coaches poll site blocks automated access.

Run: python3 data/colleges/collect/rankings.py [year]
"""
import html
import json
import os
import re
import sys

import fetch

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "rankings")
MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August",
                                       "September", "October", "November", "December"], 1)}


def save(table):
    name = f"{table['slug']}-{'men' if table['gender'] == 'male' else 'women'}-d1-{table['as_of']}.json"
    del table["slug"]
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        json.dump(table, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(name, len(table["entries"]))


def gcaa_men():
    url = "https://gcaa.coach/coaches-poll/division-i"
    _, status, text = fetch.get(url, refresh=True)
    assert status == 200, status
    body = html.unescape(re.sub(r"<[^>]+>", "|", re.sub(r"<(script|style).*?</\1>", "", text, flags=re.S)))
    body = " | ".join(c for c in (re.sub(r"\s+", " ", c).strip() for c in body.split("|")) if c) + " |"
    title = re.search(r"(20\d\d-\d\d) Bushnell/Golfweek DI Coaches.{1,2}Poll - (\w+) (\d+)", body)
    season, month, day = title.groups()
    year = int(season[:4]) + (1 if MONTHS[month] < 8 else 0)
    start = body.find("PREVIOUS", title.end())
    end = body.find("Dropped Out", start)
    rows = re.findall(r"\| (\d+) \| ([^|(]+?)(?:(?: \|)? \((\d+)\))? \| (\d+) \| (\d+|RV|NR) (?=\|)", body[start:end])
    entries = [{"rank": int(r), "team": t.strip(), "points": int(p), "first_place_votes": int(v) if v else 0,
                "previous": int(pr) if pr.isdigit() else pr} for r, t, v, p, pr in rows]
    assert len(entries) == 25, entries
    rv = re.search(r"Receiving Votes \(Points\): \| (.*?)\.? \|", body)
    save({"slug": "gcaa", "source": "GCAA Coaches Poll", "as_of": f"{year}-{MONTHS[month]:02d}-{int(day):02d}",
          "source_url": url, "division": "D1", "gender": "male",
          "note": f"Bushnell/Golfweek Division I Coaches' Poll ({season}). Receiving votes: {rv.group(1) if rv else ''}",
          "reuse_status": "unknown", "entries": entries})


def wiki(page):
    _, status, text = fetch.get(f"https://en.wikipedia.org/wiki/{page}?action=raw")
    assert status == 200, status
    return text


def link_text(s):
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", s)
    return re.sub(r"<[^>]+>|'''", "", s).strip()


def championship(year, gender):
    page = f"{year}_NCAA_Division_I_{'men' if gender == 'male' else 'women'}%27s_golf_championship"
    w = wiki(page)
    # Match play bracket: final, semifinal and quarterfinal results
    br = dict(re.findall(r"^\|\s*(RD\d-(?:team|score)\d)\s*=\s*(.*?)\s*$", w, re.M))

    def pair(rd, i):
        a, b = link_text(br[f"RD{rd}-team{2 * i - 1}"]), link_text(br[f"RD{rd}-team{2 * i}"])
        sa, sb = float(br[f"RD{rd}-score{2 * i - 1}"]), float(br[f"RD{rd}-score{2 * i}"])
        return (a, b) if sa > sb else (b, a)
    place = {}
    win, lose = pair(3, 1)
    place[win], place[lose] = 1, 2
    for i in (1, 2):
        place.setdefault(pair(2, i)[1], 3)
    for i in (1, 2, 3, 4):
        place.setdefault(pair(1, i)[1], 5)
    assert len(place) == 8, place
    # Stroke play leaderboard (places 9-15); a tied row without a total shares the previous total
    lb = w[w.find("Leaderboard"):w.find("Match-play bracket")]
    table = lb[:lb.find("|}")]
    totals, prev = {}, None
    for r in re.split(r"\n\|-[^\n]*", table)[1:]:
        team = re.search(r"\[\[[^\]]+\]\]", r)
        total = re.findall(r"\b(1[01]\d\d)\b", r)
        if team:
            prev = int(total[0]) if total else prev
            totals[link_text(team.group(0))] = prev
    rest = {t: tot for t, tot in totals.items() if t not in place}
    for t, tot in rest.items():
        place[t] = 9 + sum(1 for x in rest.values() if x < tot)
    # Teams cut after 54 holes (16-30)
    elim = re.search(r"'''(?:Eliminated|Remaining) teams''':(.*?)(?:<ref|\n)", lb, re.S)
    cut = {link_text(n): int(s) for n, s in re.findall(r"(\[\[[^\]]+\]\])\s*\((\d+)\)", elim.group(1))} if elim else {}
    for t, sc in cut.items():
        place[t] = 16 + sum(1 for x in cut.values() if x < sc)
    assert len(place) == 30, len(place)
    dates = re.search(r"dates\s*=\s*([A-Z][a-z]+) (\d+)\s*[–-]\s*(?:([A-Z][a-z]+) )?(\d+), (\d{4})", w)
    m1, d1, m2, d2, y = dates.groups()
    as_of = f"{y}-{MONTHS[m2 or m1]:02d}-{int(d2):02d}"
    entries = sorted(({"rank": r, "team": t} for t, r in place.items()), key=lambda e: (e["rank"], e["team"]))
    save({"slug": "ncaa-championship", "source": f"NCAA Championship {year} finish", "as_of": as_of,
          "source_url": f"https://en.wikipedia.org/wiki/{page}", "division": "D1", "gender": gender,
          "note": "Final team standings of the NCAA Division I Championship: 1 champion, 2 runner-up, 3 semifinalists, "
                  "5 quarterfinalists, 9-15 by 72-hole stroke play, 16-30 by 54-hole score (cut). "
                  "From Wikipedia (CC BY-SA 4.0), which cites the NCAA/Clippd scoreboard.",
          "reuse_status": "ok", "entries": entries})


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    gcaa_men()
    for g in ("male", "female"):
        championship(year, g)
