#!/usr/bin/env python3
"""Build the D1 golf school list from the NCAA directory.

Reads the NCAA directory's sport-sponsorship lists (men's golf MGO, women's golf WGO, Division I)
and writes collect/schools.json: one row per school with slug, names, conference, state, URLs and
which golf programs it sponsors. Slugs already used in raw/d1/ are kept.

Run: python3 data/colleges/collect/schools.py
"""
import glob
import json
import os
import re

import fetch
import names

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(os.path.dirname(HERE), "raw", "d1")
OUT = os.path.join(HERE, "schools.json")
API = "https://web3.ncaa.org/directory/api/directory/memberList?type=12&division=I&sportCode={}"
SOURCE = "https://web3.ncaa.org/directory/memberList?type=12&division=I&sportCode={}"

CONF = {
    "Southeastern Conference": "SEC", "Atlantic Coast Conference": "ACC", "Big Ten Conference": "Big Ten",
    "Big 12 Conference": "Big 12", "BIG EAST Conference": "Big East", "Pac-12 Conference": "Pac-12",
    "Mountain West Conference": "Mountain West", "American Conference": "American", "Sun Belt Conference": "Sun Belt",
    "Conference USA": "Conference USA", "Mid-American Conference": "MAC", "West Coast Conference": "WCC",
    "Atlantic 10 Conference": "Atlantic 10", "Southwestern Athletic Conf.": "SWAC", "Mid-Eastern Athletic Conf.": "MEAC",
    "Coastal Athletic Association": "CAA", "Atlantic Sun Conference": "ASUN", "The Ivy League": "Ivy League",
    "The Summit League": "Summit League", "Metro Conference": "MAAC", "Missouri Valley Conference": "Missouri Valley",
}

# Extra names rankings and results use for a school (matched by build_colleges.py)
ALIASES = {
    "North Carolina State": ["NC State"], "Ole Miss": ["Mississippi"], "Miami (FL)": ["Miami", "Miami (Fla.)"],
    "Miami (OH)": ["Miami (Ohio)", "Miami University"], "UNCG": ["UNC Greensboro"], "UNCW": ["UNC Wilmington"],
    "USC": ["Southern California"], "TCU": ["Texas Christian"], "UCF": ["Central Florida"], "BYU": ["Brigham Young"],
    "LSU": ["Louisiana State"], "SMU": ["Southern Methodist"], "UNLV": ["Nevada-Las Vegas"], "CSUN": ["Cal State Northridge"],
    "Hawaii": ["Hawai'i"], "East Tennessee State": ["ETSU"], "Kansas City": ["UMKC"], "Stephen F. Austin": ["SFA"],
    "Louisiana-Monroe": ["UL Monroe", "ULM"], "Louisiana": ["Louisiana-Lafayette", "UL Lafayette"], "Cal": ["California"],
    "UConn": ["Connecticut"], "UTRGV": ["UT Rio Grande Valley"], "UIC": ["Illinois Chicago"], "VCU": ["Virginia Commonwealth"],
    "FIU": ["Florida International"], "UAB": ["Alabama-Birmingham"], "UTSA": ["UT San Antonio"], "UTEP": ["Texas-El Paso"],
    "Middle Tennessee": ["MTSU", "Middle Tennessee State"], "Sam Houston": ["Sam Houston State"], "Penn": ["Pennsylvania"],
    "Seattle U": ["Seattle"], "Little Rock": ["Arkansas-Little Rock"], "Southern Miss": ["Southern Mississippi"],
    "Charlotte": ["UNC Charlotte"], "Long Beach State": ["Cal State Long Beach"], "CSU Bakersfield": ["Cal State Bakersfield"],
    "SIUE": ["SIU Edwardsville"], "Purdue Fort Wayne": ["PFW"], "Texas A&M-Corpus Christi": ["Texas A&M Corpus Christi"],
    "Loyola Marymount": ["LMU"], "Omaha": ["Nebraska Omaha"], "IU Indy": ["IUPUI"], "LIU": ["Long Island"],
    "UC Santa Barbara": ["UCSB"], "UC San Diego": ["UCSD"], "UC Riverside": ["UCR"], "Arkansas-Pine Bluff": ["UAPB"],
}


def slugify(s):
    s = s.lower().replace("&", "").replace("'", "").replace(".", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def existing_slugs():
    out = {}
    for path in glob.glob(os.path.join(RAW, "*.json")):
        with open(path, encoding="utf-8") as fh:
            c = json.load(fh)
        for n in [c["name_en"], c.get("short_name"), *c.get("aliases", [])]:
            if n:
                out[n.lower()] = c["slug"]
    return out


def main():
    known = existing_slugs()
    schools = {}
    for code, gender in [("MGO", "male"), ("WGO", "female")]:
        _, status, text = fetch.get(API.format(code), refresh=True)
        assert status == 200, status
        for d in json.loads(text):
            s = schools.get(d["orgId"])
            if s is None:
                name = d["nameOfficial"].strip()
                short = names.short(name)
                s = schools[d["orgId"]] = {
                    "ncaa_org_id": d["orgId"],
                    "slug": known.get(short.lower()) or known.get(name.lower()) or slugify(short),
                    "name_en": name,
                    "short_name": short,
                    "aliases": ALIASES.get(short, []),
                    "conference": CONF.get(d["conferenceName"].strip(), d["conferenceName"].strip()),
                    "state": (d.get("memberOrgAddress") or {}).get("state"),
                    "private": d.get("privateFlag") == "Y",
                    "website_url": fetch.norm_url(d.get("webSiteUrl")),
                    "athletics_url": fetch.norm_url(d.get("athleticWebUrl")),
                    "genders": [],
                    "sources": [],
                }
            s["genders"].append(gender)
            s["sources"].append(SOURCE.format(code))
    rows = sorted(schools.values(), key=lambda s: s["slug"])
    dupes = {s["slug"] for s in rows if sum(r["slug"] == s["slug"] for r in rows) > 1}
    assert not dupes, dupes
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(len(rows), "schools;", sum("male" in s["genders"] for s in rows), "men's,",
          sum("female" in s["genders"] for s in rows), "women's")


if __name__ == "__main__":
    main()
