#!/usr/bin/env python3
"""Write data/colleges/raw/d1/<slug>.json from schools.json + sites/<slug>.json (+ alumni/*.json).

Keeps hand-entered values already in a raw file (nickname, name_ja, city, extra aliases) and
replaces collected fields. Run after schools.py and collect_sites.py:
  python3 data/colleges/collect/merge.py && python3 data/scripts/build_colleges.py
"""
import glob
import json
import os

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
}


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main():
    schools = load(os.path.join(HERE, "schools.json"))
    alumni = {}
    for path in glob.glob(os.path.join(HERE, "alumni", "*.json")):
        for a in load(path, []):
            alumni.setdefault((a["slug"], a["gender"]), []).append({k: a.get(k) for k in
                                                                   ["name", "tours", "final_college_year", "country", "source_url"]})
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
            "nickname": old.get("nickname"),
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
            prog["roster"] = [{k: r.get(k) for k in ["name", "class_year", "redshirt", "hometown", "country", "previous_school"]}
                              for r in roster]
            coaches = sp.get("coaches") or op.get("coaches") or []
            prog["coaches"] = [{k: c.get(k) for k in ["name", "title", "email", "phone", "source_url"]} for c in coaches]
            prog["alumni_pros"] = alumni.get((s["slug"], g), op.get("alumni_pros", []))
            if status in BLOCKED_NOTE and not prog["roster"]:
                prog["collection_note"] = BLOCKED_NOTE[status]
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
