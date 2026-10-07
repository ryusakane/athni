#!/usr/bin/env python3
"""data/colleges/ の大学データをまとめて、サイト用 JSON と Supabase 投入用 SQL を作る。

入力:
  data/colleges/raw/<division>/<slug>.json   大学ごとの記録 (src/lib/colleges/types.ts の College と同じ形。
                                             rankings は空でよい。aliases: ランキング表での別名)
  data/colleges/rankings/*.json              ランキング表 (source, as_of, source_url, division, gender, entries[{rank, team}])
出力:
  src/data/colleges.json                     サイトがビルド時に読む
  data/supabase/colleges_seed.sql            supabase/migrations/0003_colleges.sql の表に入れる SQL
  data/colleges/ISSUES.md                    ランキングの照合漏れ・欠けている項目

実行: python3 data/scripts/build_colleges.py
"""
import glob
import json
import os
import re
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone

DATA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(DATA)
COLLEGES = os.path.join(DATA, "colleges")
SITE_OUT = os.path.join(ROOT, "src", "data", "colleges.json")
SQL_OUT = os.path.join(DATA, "supabase", "colleges_seed.sql")
ISSUES_OUT = os.path.join(COLLEGES, "ISSUES.md")
NS = uuid.UUID("6f1c2a52-6a0e-4c35-9a35-2f0f4c3e7b10")  # same namespace as to_sql.py

CLASS_YEARS = {"FR", "SO", "JR", "SR", "GR"}
CAREER_STATUSES = {"graduated", "transferred", "left"}
FORMER_FIELDS = ["name", "seasons", "class_year", "major", "hometown", "country", "previous_school", "profile_url",
                 "source_url", "career_status", "transferred_to"]
SOCIAL = ["instagram_url", "x_url", "facebook_url", "tiktok_url", "youtube_url"]
PROGRAM_FIELDS = ["golf_url", "roster_url", "coaches_url", "roster_season", "roster_source_url", "collected_at",
                  "players_by_country"]
# サイトだけで使う項目 (seed.sql には入れない)
SITE_ONLY_FIELDS = ["collection_note"]
COLLEGE_FIELDS = ["name_ja", "short_name", "nickname", "conference", "city", "state", "website_url", "athletics_url"]


def uid(*parts):
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def norm(name):
    """ランキング表の校名照合用 (大小・記号・"University" などの揺れを吸収)。"""
    name = name.lower().replace("&", " and ").replace("st.", "state")
    name = re.sub(r"\b(the|university|of|college)\b", " ", name)
    return re.sub(r"[^a-z0-9]+", "", name)


def load_colleges():
    colleges = []
    for path in sorted(glob.glob(os.path.join(COLLEGES, "raw", "*", "*.json"))):
        with open(path, encoding="utf-8") as fh:
            c = json.load(fh)
        slug = os.path.splitext(os.path.basename(path))[0]
        assert c["slug"] == slug, f"{path}: slug {c['slug']!r} does not match file name"
        assert c["division"] in {"D1", "D2", "D3", "NAIA", "NJCAA"}, path
        # 再利用不可の出典 (sources[].reuse_status == "restricted") の大学はサイトに出さない
        c["publishable"] = all(s.get("reuse_status") != "restricted" for s in c.get("sources", []))
        for f in COLLEGE_FIELDS:
            c.setdefault(f, None)
        programs = []
        for p in c.get("programs", []):
            assert p["gender"] in {"male", "female"}, path
            for f in PROGRAM_FIELDS + SOCIAL + SITE_ONLY_FIELDS:
                p.setdefault(f, None)
            p["rankings"] = []
            p.setdefault("coaches", [])
            p.setdefault("alumni_pros", [])
            roster = []
            for r in p.get("roster", []):
                cy = r.get("class_year")
                assert cy is None or cy in CLASS_YEARS, f"{path}: class_year {cy!r}"
                roster.append({
                    "name": r["name"],
                    "class_year": cy,
                    "redshirt": bool(r.get("redshirt")),
                    "hometown": r.get("hometown"),
                    "country": r.get("country"),
                    "previous_school": r.get("previous_school"),
                    "major": r.get("major"),
                    "profile_url": r.get("profile_url"),
                })
            p["roster"] = roster
            for k in p["coaches"]:
                for f in ["title", "email", "phone", "source_url", "profile_url"]:
                    k.setdefault(f, None)
            for a in p["alumni_pros"]:
                a.setdefault("tours", [])
                a.setdefault("tour_links", [])
                for f in ["final_college_year", "country", "source_url"]:
                    a.setdefault(f, None)
            p.setdefault("former_players", [])
            for f in p["former_players"]:
                assert f["career_status"] in CAREER_STATUSES, f"{path}: career_status {f['career_status']!r}"
                assert f.get("class_year") is None or f["class_year"] in CLASS_YEARS, path
                f.setdefault("tour_links", [])
                for k in FORMER_FIELDS:
                    f.setdefault(k, None)
            # 2016-17 以降に在籍した選手 (現役 + 元選手) の出身国別人数。サイトは1か国だけ表示し、全体はデータとして持つ
            by_country = Counter()
            for x in {re.sub(r"[^a-z]", "", r["name"].lower()): r for r in roster + p["former_players"]}.values():
                if x.get("country"):
                    by_country[x["country"]] += 1
            p["players_by_country"] = dict(sorted(by_country.items(), key=lambda kv: (-kv[1], kv[0])))
            p.setdefault("past_coaches", [])
            for k in p["past_coaches"]:
                for f in ["title", "profile_url", "source_url"]:
                    k.setdefault(f, None)
            programs.append(p)
        c["programs"] = sorted(programs, key=lambda p: p["gender"] != "male")
        colleges.append(c)
    return colleges


def attach_rankings(colleges, issues):
    index = defaultdict(list)
    for c in colleges:
        for name in [c["name_en"], c["short_name"], *c.get("aliases", [])]:
            if name:
                index[(c["division"], norm(name))].append(c)
    for path in sorted(glob.glob(os.path.join(COLLEGES, "rankings", "*.json"))):
        with open(path, encoding="utf-8") as fh:
            table = json.load(fh)
        missing = []
        for e in table["entries"]:
            matches = {c["slug"]: c for c in index.get((table["division"], norm(e["team"])), [])}
            if len(matches) != 1:
                missing.append(f"{e['rank']}. {e['team']}" + (" (ambiguous)" if matches else ""))
                continue
            c = next(iter(matches.values()))
            program = next((p for p in c["programs"] if p["gender"] == table["gender"]), None)
            if program is None:
                missing.append(f"{e['rank']}. {e['team']} (no {table['gender']} program in raw)")
                continue
            program["rankings"].append({
                "source": table["source"],
                "rank": e["rank"],
                "as_of": table["as_of"],
                "source_url": table.get("source_url"),
            })
        if missing:
            issues.append(f"## {os.path.basename(path)}: unmatched teams\n\n" + "\n".join(f"- {m}" for m in missing))


def report_gaps(colleges, issues):
    gaps = Counter()
    for c in colleges:
        if not c["conference"]:
            gaps["college without conference"] += 1
        for p in c["programs"]:
            if not p["coaches"]:
                gaps[f"{p['gender']} program without coaches"] += 1
            elif not any(k["email"] for k in p["coaches"]):
                gaps[f"{p['gender']} program without any coach email"] += 1
            if not p["roster"]:
                gaps[f"{p['gender']} program without roster"] += 1
    if gaps:
        issues.append("## Missing fields\n\n" + "\n".join(f"- {k}: {v}" for k, v in sorted(gaps.items())))


def lit(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, dict) or (isinstance(v, list) and v and isinstance(v[0], dict)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if isinstance(v, list):
        return "array[" + ",".join(lit(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def insert(table, cols, rows):
    if not rows:
        return ""
    values = ",\n".join("(" + ",".join(lit(r[c]) for c in cols) + ")" for r in rows)
    updates = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "id")
    return f"insert into {table} ({','.join(cols)}) values\n{values}\non conflict (id) do update set {updates};\n\n"


def write_sql(colleges):
    t = defaultdict(list)
    for c in colleges:
        cid = uid("college", c["slug"])
        t["colleges"].append({"id": cid, **{k: c[k] for k in ["slug", "name_en", "division", *COLLEGE_FIELDS]}})
        for p in c["programs"]:
            pid = uid("program", c["slug"], p["gender"])
            t["college_programs"].append(
                {"id": pid, "college_id": cid, "gender": p["gender"], **{k: p[k] for k in PROGRAM_FIELDS + SOCIAL}})
            for r in p["rankings"]:
                t["college_rankings"].append({"id": uid("ranking", pid, r["source"], r["as_of"]), "program_id": pid, **r})
            for i, k in enumerate(p["coaches"]):
                t["college_coaches"].append({"id": uid("coach", pid, k["name"]), "program_id": pid, "sort_order": i,
                                             **{f: k[f] for f in ["name", "title", "email", "phone", "source_url", "profile_url"]}})
            for r in p["roster"]:
                t["college_roster_players"].append({"id": uid("roster", pid, r["name"]), "program_id": pid, **r})
            for a in p["alumni_pros"]:
                t["college_alumni_pros"].append({"id": uid("alum", cid, p["gender"], a["name"]), "college_id": cid,
                                                 "gender": p["gender"], **{f: a[f] for f in
                                                 ["name", "tours", "final_college_year", "country", "source_url", "tour_links"]}})
            for f in p["former_players"]:
                t["college_former_players"].append({"id": uid("former", pid, f["name"]), "program_id": pid,
                                                    **{k: f[k] for k in FORMER_FIELDS + ["tour_links"]}})
            for i, k in enumerate(p["past_coaches"]):
                t["college_past_coaches"].append({"id": uid("pastcoach", pid, k["name"]), "program_id": pid, "sort_order": i,
                                                  **{f: k[f] for f in ["name", "title", "seasons", "profile_url", "source_url"]}})
    out = ["-- Generated by data/scripts/build_colleges.py. Requires supabase/migrations/0003_colleges.sql, 0005_college_profile_urls.sql, 0007_college_history.sql and 0008_players_by_country.sql.\n",
           "begin;\n\n"]
    # 子表は作り直す (名簿・コーチは年ごとに入れ替わるため、消えた人を残さない)
    for table in ["college_rankings", "college_coaches", "college_roster_players", "college_alumni_pros",
                  "college_former_players", "college_past_coaches"]:
        out.append(f"delete from {table};\n")
    out.append("\n")
    for table, rows in t.items():
        cols = list(rows[0].keys()) if rows else []
        out.append(insert(table, cols, rows))
    out.append("commit;\n")
    with open(SQL_OUT, "w", encoding="utf-8") as fh:
        fh.write("".join(out))
    return {k: len(v) for k, v in t.items()}


def main():
    issues = []
    colleges = load_colleges()
    attach_rankings(colleges, issues)
    report_gaps(colleges, issues)
    notes = [f"- {c['slug']} ({p['gender']}): {p['collection_note']}" for c in colleges for p in c["programs"]
             if p.get("collection_note")]
    if notes:
        issues.append("## Not collected (reason, internal only)\n\n" + "\n".join(notes))
    published = [c for c in colleges if c.pop("publishable")]
    for c in published:
        c.pop("aliases", None)
        c.pop("sources", None)
        # 未収集の理由は社内用 (ISSUES.md) にだけ残し、サイトには「未収集」の印だけを渡す
        for p in c["programs"]:
            if p.get("collection_note"):
                p["collection_note"] = "not collected"
    counts = write_sql(published)
    with open(SITE_OUT, "w", encoding="utf-8") as fh:
        json.dump({"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "colleges": published},
                  fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    with open(ISSUES_OUT, "w", encoding="utf-8") as fh:
        fh.write("# College data issues (generated)\n\n" + ("\n\n".join(issues) if issues else "None.") + "\n")
    print(f"{len(colleges)} colleges ({len(published)} publishable)", counts)


if __name__ == "__main__":
    main()
