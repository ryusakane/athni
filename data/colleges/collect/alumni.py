#!/usr/bin/env python3
"""Professional golfers who played for each D1 program, from Wikipedia (CC BY-SA 4.0).

Walks Wikipedia's "College men's/women's golfers in the United States" category tree down to the
team categories ("Auburn Tigers men's golfers"), matches each team to a school in schools.json,
then reads each golfer's article categories: a golfer counts as a pro alumnus when the article is
in a tour category (PGA Tour golfers, LPGA Tour golfers, Korn Ferry Tour golfers, ...).
Also records the team nickname found in the category name.

Uses only /wiki/ pages (category listings and ?action=raw), which Wikipedia's robots.txt allows.
Category listings longer than 200 members are only read up to their first page.

Writes alumni/d1.json and alumni/nicknames.json.
Run: python3 data/colleges/collect/alumni.py
"""
import concurrent.futures as cf
import json
import os
import re
from urllib.parse import quote, unquote

import fetch

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "alumni")
ROOTS = {"male": "College_men's_golfers_in_the_United_States", "female": "College_women's_golfers_in_the_United_States"}
TOURS = {
    "PGA Tour golfers": "PGA Tour", "Korn Ferry Tour golfers": "Korn Ferry Tour", "European Tour golfers": "DP World Tour",
    "LIV Golf players": "LIV Golf", "PGA Tour Champions golfers": "PGA Tour Champions", "Japan Golf Tour golfers": "JGTO",
    "Asian Tour golfers": "Asian Tour", "Challenge Tour golfers": "Challenge Tour", "PGA Tour Canada golfers": "PGA Tour Americas",
    "PGA Tour Latinoamérica golfers": "PGA Tour Americas", "PGA Tour Americas golfers": "PGA Tour Americas",
    "PGA Tour of Australasia golfers": "PGA Tour of Australasia", "Sunshine Tour golfers": "Sunshine Tour",
    "Korean Tour golfers": "Korean Tour", "LPGA Tour golfers": "LPGA Tour", "Epson Tour golfers": "Epson Tour",
    "Symetra Tour golfers": "Epson Tour", "Ladies European Tour golfers": "LET", "LPGA of Japan Tour golfers": "JLPGA",
    "LPGA of Korea Tour golfers": "KLPGA", "ALPG Tour golfers": "WPGA Tour of Australasia",
}
WOMEN_TOURS = {"LPGA Tour", "Epson Tour", "LET", "JLPGA", "KLPGA", "WPGA Tour of Australasia"}
NATIONALITY = {
    "American": "US", "Japanese": "JP", "South Korean": "KR", "Canadian": "CA", "English": "GB", "Scottish": "GB",
    "Welsh": "GB", "Northern Irish": "GB", "Irish": "IE", "Australian": "AU", "New Zealand": "NZ", "South African": "ZA",
    "Swedish": "SE", "Norwegian": "NO", "Danish": "DK", "Finnish": "FI", "German": "DE", "French": "FR", "Spanish": "ES",
    "Italian": "IT", "Dutch": "NL", "Belgian": "BE", "Austrian": "AT", "Swiss": "CH", "Mexican": "MX", "Colombian": "CO",
    "Argentine": "AR", "Venezuelan": "VE", "Chilean": "CL", "Thai": "TH", "Chinese": "CN", "Taiwanese": "TW",
    "Filipino": "PH", "Indian": "IN", "Malaysian": "MY", "Paraguayan": "PY", "Puerto Rican": "PR", "Zimbabwean": "ZW",
    "Namibian": "NA", "Icelandic": "IS", "Czech": "CZ", "Slovak": "SK", "Polish": "PL", "Portuguese": "PT",
    "Brazilian": "BR", "Peruvian": "PE", "Ecuadorian": "EC", "Indonesian": "ID", "Vietnamese": "VN", "Singaporean": "SG",
    "Hong Kong": "HK", "Israeli": "IL", "Turkish": "TR", "Bermudian": "BM", "Bahamian": "BS", "Jamaican": "JM",
    "Costa Rican": "CR", "Panamanian": "PA", "Guatemalan": "GT", "Dominican Republic": "DO", "Uruguayan": "UY",
}


def wiki_url(title):
    return "https://en.wikipedia.org/wiki/" + quote(title.replace(" ", "_"), safe="_():,'&!-.")


def category(title):
    """Return (subcategories, member pages) from the first page of a category listing."""
    _, status, text = fetch.get(wiki_url("Category:" + title))
    if status != 200:
        return [], []
    sub_part = text[text.find('id="mw-subcategories"'):text.find('id="mw-pages"')] if 'id="mw-subcategories"' in text else ""
    page_part = text[text.find('id="mw-pages"'):] if 'id="mw-pages"' in text else ""
    page_part = page_part[:page_part.find('class="printfooter"')] if 'class="printfooter"' in page_part else page_part
    subs = [unquote(x).replace("_", " ") for x in re.findall(r'href="/wiki/Category:([^"#]+)"', sub_part)]
    pages = [unquote(x).replace("_", " ") for x in re.findall(r'<li><a href="/wiki/([^"#:]+)"', page_part)]
    return subs, pages


def team_categories(gender):
    word = "men's golfers" if gender == "male" else "women's golfers"
    seen, teams, queue = set(), [], [ROOTS[gender].replace("_", " ")]
    while queue:
        c = queue.pop()
        if c in seen:
            continue
        seen.add(c)
        subs, _ = category(c)
        for s in subs:
            if s.startswith("College " + word.split()[0]) and "golfers in" in s:
                queue.append(s)
            elif s.startswith(("College ", "Junior college")):
                pass
            elif s.endswith(word):
                teams.append(s)
            elif s.endswith(" golfers") and "men's" not in s and not s.endswith("American golfers"):
                teams.append(s)  # team category without a gender ("Oklahoma State Cowboys golfers")
    return sorted(set(teams))


def match_school(team, schools):
    """'Auburn Tigers men's golfers' -> (slug, nickname)."""
    prefix = re.sub(r" ((wo)?men's )?golfers$", "", team)
    special = {"Miami RedHawks": "miami-oh", "Miami Hurricanes": "miami-fl", "Hawaii Rainbow Warriors": "hawaii",
               "Hawaiʻi Rainbow Warriors": "hawaii", "Hawaii Rainbow Wahine": "hawaii", "Loyola Ramblers": "loyola-chicago",
               "Loyola Greyhounds": "loyola-maryland", "St. John's Red Storm": "st-johns", "UTEP Miners": "utep",
               "Omaha Mavericks": "omaha", "Southern Jaguars": "southern", "California Golden Bears": "california",
               "Saint Mary's Gaels": "saint-marys", "Penn Quakers": "penn", "Seattle Redhawks": "seattle-u"}
    if prefix in special:
        slug = special[prefix]
        short = next(x["short_name"] for x in schools if x["slug"] == slug)
        nick = prefix[len(short) + 1:] if prefix.startswith(short + " ") else prefix.split(" ", 1)[1]
        return slug, nick
    best = None
    for s in schools:
        for n in [s["short_name"], *s["aliases"], s["name_en"]]:
            if prefix.startswith(n + " ") and (best is None or len(n) > len(best[1])):
                best = (s["slug"], n)
    if not best:
        return None, None
    nick = prefix[len(best[1]) + 1:]
    if prefix == "Providence Argonauts" or nick.split()[0] in {"State", "Western", "City", "Panhandle", "Aiken", "Wesleyan", "Southern", "Monterey",
                                                                 "Christian"}:
        return None, None
    return best[0], nick


def golfer(title):
    _, status, text = fetch.get(wiki_url(title) + "?action=raw")
    if status != 200:
        return None
    if text.lstrip().upper().startswith("#REDIRECT"):
        m = re.search(r"\[\[([^\]|#]+)", text)
        return golfer(m.group(1)) if m else None
    cats = re.findall(r"\[\[Category:([^\]|]+)", text)
    tours = sorted({TOURS[c] for c in cats if c in TOURS})
    country = None
    for c in cats:
        m = re.match(r"(.+?) (male |female )?golfers$", c)
        if m and m.group(1) in NATIONALITY:
            country = NATIONALITY[m.group(1)]
            break
    female = any(re.search(r"(female|women's) golfers$", c) for c in cats) or bool(set(tours) & WOMEN_TOURS)
    return {"title": title, "tours": tours, "country": country, "gender": "female" if female else "male"}


def main():
    with open(os.path.join(HERE, "schools.json"), encoding="utf-8") as fh:
        schools = json.load(fh)
    genders = {s["slug"]: s["genders"] for s in schools}
    rows, nicknames, unmatched, members = [], {}, [], []
    done = set()
    for gender in ("male", "female"):
        for team in team_categories(gender):
            if team in done:
                continue  # a gender-neutral team category can sit in both trees
            done.add(team)
            slug, nick = match_school(team, schools)
            if not slug or ("men's" in team and gender not in genders[slug]):
                unmatched.append(team)
                continue
            if nick:
                nicknames.setdefault(slug, nick)
            _, pages = category(team)
            members += [(slug, gender, team, p) for p in pages]
            if "men's" not in team:
                print("gender-neutral team category:", team, "->", slug, len(pages))
    titles = sorted({m[3] for m in members})
    print(len(titles), "golfer articles to read")
    with cf.ThreadPoolExecutor(2) as ex:
        info = dict(zip(titles, ex.map(golfer, titles)))
    for slug, gender, team, title in members:
        g = info.get(title)
        if not g or not g["tours"]:
            continue
        if "men's" not in team:
            gender = g["gender"]  # gender-neutral team category: take it from the article
            if gender not in genders[slug]:
                continue
        rows.append({"slug": slug, "gender": gender, "name": re.sub(r" \(.*\)$", "", title), "tours": g["tours"],
                     "final_college_year": None, "country": g["country"], "source_url": wiki_url(title),
                     "team_category": wiki_url("Category:" + team)})
    rows.sort(key=lambda r: (r["slug"], r["gender"], r["name"]))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "d1.json"), "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    with open(os.path.join(OUT, "nicknames.json"), "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(nicknames.items())), fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(len(rows), "pro alumni;", len(nicknames), "nicknames; unmatched teams:", unmatched)


if __name__ == "__main__":
    main()
