#!/usr/bin/env python3
"""Write data/colleges/raw/d1/<slug>.json from schools.json + sites/<slug>.json (+ alumni/*.json, history/<slug>.json).

Keeps hand-entered values already in a raw file (nickname, name_ja, city, extra aliases) and
replaces collected fields. Run after schools.py and collect_sites.py:
  python3 data/colleges/collect/merge.py && python3 data/scripts/build_colleges.py
"""
import glob
import json
import os
import re

import parse

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(os.path.dirname(HERE), "raw", "d1")
SOCIAL = ["instagram_url", "x_url", "facebook_url", "tiktok_url", "youtube_url"]
NCAA_NOTE = ("NCAA Directory sport-sponsorship list (men's/women's golf, Division I): used for which schools sponsor golf, "
             "conference, state and official URLs. NCAA.org terms say its content may not be reposted without consent; "
             "only these facts are used.")
SITE_NOTE = "Official athletics site, public roster/staff pages. Site terms not reviewed individually."
BLOCKED_NOTE = {
    "bot-wall": "Athletics site blocks automated access (bot protection); roster, coaches and team socials not collected yet.",
    "robots-disallowed": "Athletics site's robots.txt disallows crawling; roster, coaches and team socials not collected.",
    0: "Athletics site did not respond to our requests; roster, coaches and team socials not collected yet.",
    403: "Athletics site refused automated requests; roster, coaches and team socials not collected yet.",
}
UNREAD_NOTE = "Roster and coaches could not be read from the athletics site (the page loads them in a way we can't parse yet)."


def program_note(site, gender):
    """Why a program with neither roster nor coaches has none, from the site's request log."""
    path = "/womens-golf" if gender == "female" else "/mens-golf"
    statuses = [r["status"] for r in site.get("requests", []) if path in r["url"]]
    if any(st in ("bot-wall", 403) for st in statuses):
        return BLOCKED_NOTE["bot-wall"]
    return UNREAD_NOTE


def key(name):
    return re.sub(r"[^a-z]", "", (name or "").lower())


def load_history():
    """slug → gender → {"players": {key: person}, "coaches": {key: person}} from history/<slug>.json.

    A person keeps the newest season's details (class, major, hometown, profile) and every season listed."""
    out = {}
    for path in glob.glob(os.path.join(HERE, "history", "*.json")):
        h = load(path, {})
        for prog in h.get("programs", []):
            agg = out.setdefault(h["slug"], {}).setdefault(prog["gender"], {"players": {}, "coaches": {}})
            for season in sorted(prog.get("seasons", {}), reverse=True):
                page = prog["seasons"][season]
                for kind, rows in (("players", page["players"]), ("coaches", page["coaches"])):
                    for r in rows:
                        k = key(r["name"])
                        if not k:
                            continue
                        person = agg[kind].setdefault(k, {"name": r["name"], "seasons": [], "source_url": page["url"]})
                        if season not in person["seasons"]:
                            person["seasons"].append(season)
                        for f in (["class_year", "major", "hometown", "country", "previous_school", "profile_url"]
                                  if kind == "players" else ["title", "profile_url"]):
                            if person.get(f) is None and r.get(f):
                                person[f] = r[f]
    for progs in out.values():
        for agg in progs.values():
            for kind in agg:
                for person in agg[kind].values():
                    person["seasons"].sort()
    return out


def career(person, slug, gender, history, current):
    """Estimated end of a former player's time on the team: graduated, transferred (to another D1 team) or left."""
    last = person["seasons"][-1]
    for other, progs in history.items():
        later = progs.get(gender, {}).get("players", {}).get(key(person["name"]))
        if other != slug and later and later["seasons"][0] > last:
            return "transferred", other
    if key(person["name"]) in current:
        return "current", None
    if person.get("class_year") in ("SR", "GR"):
        return "graduated", None
    return "left", None


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main():
    schools = load(os.path.join(HERE, "schools.json"))
    alumni = {}
    nicknames = load(os.path.join(HERE, "alumni", "nicknames.json"), {})
    for path in glob.glob(os.path.join(HERE, "alumni", "d*.json")):
        for a in load(path, []):
            alumni.setdefault((a["slug"], a["gender"]), []).append({k: a.get(k) for k in
                                                                   ["name", "tours", "final_college_year", "country", "source_url"]})
    links = load(os.path.join(HERE, "alumni", "tour_links.json"), {})
    for rows in alumni.values():
        for a in rows:
            a["tour_links"] = links.get(a["source_url"], [])
    history = load_history()
    os.makedirs(RAW, exist_ok=True)
    counts = {"files": 0, "rosters": 0, "coaches": 0}
    for s in schools:
        path = os.path.join(RAW, s["slug"] + ".json")
        old = load(path, {})
        site = load(os.path.join(HERE, "sites", s["slug"] + ".json"), {})
        rec = {
            "slug": s["slug"],
            "name_en": s["name_en"],
            "name_ja": old.get("name_ja"),
            "short_name": s["short_name"],
            "aliases": sorted(set(s["aliases"]) | set(old.get("aliases", [])) - {s["short_name"], s["name_en"]}),
            "nickname": old.get("nickname") or nicknames.get(s["slug"]),
            "division": "D1",
            "conference": s["conference"],
            "city": old.get("city"),
            "state": s["state"],
            "website_url": s["website_url"],
            "athletics_url": (site.get("athletics_url_final") or s["athletics_url"] or "").rstrip("/") or None,
            "programs": [],
            "sources": [{"url": u, "reuse_status": "unknown", "note": NCAA_NOTE} for u in sorted(set(s["sources"]))],
        }
        status = site.get("home_status")
        old_progs = {p["gender"]: p for p in old.get("programs", [])}
        site_progs = {p["gender"]: p for p in site.get("programs", [])}
        used = set()
        for g in s["genders"]:
            sp = site_progs.get(g, {})
            op = old_progs.get(g, {})
            prog = {"gender": g}
            for k in ["golf_url", "roster_url", "coaches_url", *SOCIAL, "roster_season", "roster_source_url", "collected_at"]:
                prog[k] = sp.get(k) if sp.get(k) is not None else op.get(k)
            roster = sp.get("roster") or op.get("roster") or []
            prog["roster"] = [{k: r.get(k) for k in ["name", "class_year", "redshirt", "hometown", "country", "previous_school", "major", "profile_url"]}
                              for r in roster]
            coaches = sp.get("coaches") or op.get("coaches") or []
            prog["coaches"] = []
            for c in coaches:
                c = {k: c.get(k) for k in ["name", "title", "email", "phone", "source_url", "profile_url"]}
                c["title"] = re.sub(r"\s*<br\s*/?>\s*", " / ", c["title"]) if c["title"] else None
                if c["title"] and not parse.is_coach(c["title"], "coach"):
                    continue
                prog["coaches"].append(c)
            prog["alumni_pros"] = alumni.get((s["slug"], g), op.get("alumni_pros", []))
            hist = history.get(s["slug"], {}).get(g)
            if hist:
                current = {key(r["name"]) for r in prog["roster"]}
                for r in prog["roster"]:
                    # majors are on past-season pages more often than on the current one
                    r["major"] = r.get("major") or hist["players"].get(key(r["name"]), {}).get("major")
                pros = {key(a["name"]): a for a in prog["alumni_pros"]}
                former = []
                newest = max((p["seasons"][-1] for p in hist["players"].values()), default=None)
                for k, person in hist["players"].items():
                    if not prog["roster"] and person["seasons"][-1] == newest:
                        continue  # no current roster to tell whether they are still on the team
                    status, to = career(person, s["slug"], g, history, current)
                    if status == "current":
                        continue
                    pro = pros.get(k)
                    former.append({**{f: person.get(f) for f in ["name", "seasons", "class_year", "major", "hometown", "country",
                                                                "previous_school", "profile_url", "source_url"]},
                                   "career_status": status, "transferred_to": to,
                                   "tour_links": pro["tour_links"] if pro else []})
                prog["former_players"] = sorted(former, key=lambda p: (p["seasons"][-1], p["name"]), reverse=True)
                now = {key(c["name"]) for c in prog["coaches"]}
                prog["past_coaches"] = sorted(
                    ({f: c.get(f) for f in ["name", "title", "seasons", "profile_url", "source_url"]}
                     for k, c in hist["coaches"].items() if k not in now),
                    key=lambda c: (c["seasons"][-1], c["name"]), reverse=True)
            else:
                prog["former_players"] = op.get("former_players", [])
                prog["past_coaches"] = op.get("past_coaches", [])
            if status in BLOCKED_NOTE and not prog["roster"]:
                prog["collection_note"] = BLOCKED_NOTE[status]
            elif not prog["roster"] and not prog["coaches"]:
                prog["collection_note"] = program_note(site, g)
            counts["rosters"] += bool(prog["roster"])
            counts["coaches"] += bool(prog["coaches"])
            for k in ["roster_source_url", "coaches_url"]:
                if prog.get(k):
                    used.add(prog[k])
            for c in prog["coaches"]:
                if c.get("source_url"):
                    used.add(c["source_url"])
            for a in prog["alumni_pros"]:
                if a.get("source_url"):
                    used.add(a["source_url"])
            rec["programs"].append(prog)
        for u in sorted(used):
            if "wikipedia.org" in u:
                rec["sources"].append({"url": u, "reuse_status": "ok", "note": "Wikipedia, CC BY-SA 4.0 (attribution required)"})
            elif not any(x["url"] == u for x in rec["sources"]):
                rec["sources"].append({"url": u, "reuse_status": "unknown", "note": SITE_NOTE})
        for src in old.get("sources", []):
            if not any(x["url"] == src["url"] for x in rec["sources"]):
                rec["sources"].append(src)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(rec, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        counts["files"] += 1
    print(counts)


if __name__ == "__main__":
    main()
