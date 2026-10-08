#!/usr/bin/env python3
"""data/*.csv から Supabase 投入用の SQL (data/supabase/seed.sql) を生成する。

- 各行の id は *_key から作る決定的な UUID (uuid5)。作り直しても同じ選手・大会は同じ id になり、
  `on conflict (id) do update` なので何度流しても重複しない。
- 利用条件で公開に許諾が必要な大会 (reuse_status=restricted、関東高ゴ連) は既定で除外する。
  含めるときは --include-restricted。
- 載せる大会は supabase/published_tournaments.txt に絞る (サイトの静的ファイル数を Cloudflare の無料枠に収めるため)。
  全大会は --all。
- 団体戦はスキーマに表がないため含めない。個人成績のない大会 (団体のみ) も除外。
- 不出場 (dns) の行は除外。

実行: python3 data/scripts/build.py && python3 data/scripts/to_sql.py
サイト用: 同じ行を src/data/seed.json にも書く (Supabase 未接続時のサイトの表示データ。--include-restricted のときは書かない)。
投入: Supabase の SQL Editor に貼る、または psql "$DATABASE_URL" -f data/supabase/seed.sql
前提: supabase/migrations/0001_init.sql (field_size / rank_percentile / score_differential 入りの版) と 0002 が適用済み。
"""
import csv
import json
import os
import sys
import uuid
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "supabase", "seed.sql")
# サイトが Supabase 未接続のときに読む同じ内容の JSON (列名はテーブルと同じ)
SITE_OUT = os.path.join(os.path.dirname(ROOT), "src", "data", "seed.json")
NS = uuid.UUID("6f1c2a52-6a0e-4c35-9a35-2f0f4c3e7b10")  # athni data namespace
BATCH = 500


def uid(*parts):
    return str(uuid.uuid5(NS, "|".join(parts)))


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def published_tournaments():
    """サイトと Supabase に載せる大会 (supabase/published_tournaments.txt)。ファイルがなければ全大会。"""
    path = os.path.join(ROOT, "supabase", "published_tournaments.txt")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return {l.strip() for l in fh if l.strip() and not l.startswith("#")}


def lit(v, kind="text"):
    if v is None or v == "":
        return "null"
    if kind == "num":
        return str(v)
    if kind == "int":
        return str(int(float(v)))
    if kind == "bool":
        return "true" if v in ("True", "true", True) else "false"
    return "'" + str(v).replace("'", "''") + "'"


def typed(v, kind):
    """lit() と同じ規則で JSON 用の値にする。"""
    if v is None or v == "":
        return None
    if kind == "num":
        return float(v)
    if kind == "int":
        return int(float(v))
    if kind == "bool":
        return v in ("True", "true", True)
    return str(v)


def inserts(table, cols, rows):
    """cols: [(name, kind)]. 500行ずつの upsert 文を返す。"""
    out = []
    names = ", ".join(c for c, _ in cols)
    updates = ", ".join(f"{c} = excluded.{c}" for c, _ in cols if c != "id")
    for i in range(0, len(rows), BATCH):
        values = ",\n".join("(" + ", ".join(lit(r.get(c), k) for c, k in cols) + ")"
                            for r in rows[i:i + BATCH])
        out.append(f"insert into {table} ({names}) values\n{values}\n"
                   f"on conflict (id) do update set {updates};\n")
    return out


def main():
    include_restricted = "--include-restricted" in sys.argv
    published = None if "--all" in sys.argv else published_tournaments()
    tournaments = [t for t in read("tournaments.csv")
                   if t["format"] != "team" and (include_restricted or t["reuse_status"] != "restricted")
                   and (published is None or t["tournament_key"] in published)]
    tkeys = {t["tournament_key"] for t in tournaments}
    results = [r for r in read("tournament_results.csv") if r["tournament_key"] in tkeys and r["status"] != "dns"]
    rkeys = {(r["tournament_key"], r["player_key"]) for r in results}
    tkeys = {r["tournament_key"] for r in results}
    tournaments = [t for t in tournaments if t["tournament_key"] in tkeys]
    rounds = [r for r in read("rounds.csv") if (r["tournament_key"], r["player_key"]) in rkeys]
    pkeys = {r["player_key"] for r in results}
    players = [p for p in read("players.csv") if p["player_key"] in pkeys]
    skeys = {p["school_key"] for p in players if p["school_key"]}
    schools = [s for s in read("schools.csv") if s["school_key"] in skeys]
    ckeys = {t["course_key"] for t in tournaments if t["course_key"]}
    courses = [c for c in read("courses.csv") if c["course_key"] in ckeys]
    tees = [t for t in read("course_tees.csv") if t["course_key"] in ckeys]
    teekeys = {t["course_tee_key"] for t in tees}

    # 大会ごとの集計 (スキーマの tournaments.field_size / winning_score)
    by_t = defaultdict(list)
    for r in results:
        by_t[r["tournament_key"]].append(r)

    for s in schools:
        s["id"] = uid("school", s["school_key"])
    for p in players:
        p["id"] = uid("player", p["player_key"])
        p["school_id"] = uid("school", p["school_key"]) if p["school_key"] else None
    for c in courses:
        c["id"] = uid("course", c["course_key"])
    for t in tees:
        t["id"] = uid("tee", t["course_tee_key"])
        t["course_id"] = uid("course", t["course_key"])
    for t in tournaments:
        k = t["tournament_key"]
        t["id"] = uid("tournament", k)
        t["course_id"] = uid("course", t["course_key"]) if t["course_key"] else None
        t["start_date"] = t["start_date"] or t["end_date"]
        rs = by_t[k]
        t["field_size"] = int(t["field_size_total"]) if t.get("field_size_total") else len(rs)
        fin = [int(r["total_score"]) for r in rs if r["status"] == "finished" and r["total_score"] and r["position"]]
        # 高校生だけを書き起こした一般・プロ大会では、優勝者が含まれるときだけ優勝スコアがわかる
        partial = t["field_size"] > len(rs) and not any(r["position"] == "1" for r in rs)
        t["winning_score"] = min(fin) if fin and not partial else None
    for r in results:
        r["id"] = uid("result", r["tournament_key"], r["player_key"])
        r["tournament_id"] = uid("tournament", r["tournament_key"])
        r["player_id"] = uid("player", r["player_key"])
    for r in rounds:
        r["id"] = uid("round", r["tournament_key"], r["player_key"], r["round_number"])
        r["result_id"] = uid("result", r["tournament_key"], r["player_key"])
        r["course_tee_id"] = uid("tee", r["course_tee_key"]) if r["course_tee_key"] in teekeys else None

    tables = [
        ("schools", [("id", "text"), ("name_ja", "text"), ("name_en", "text"), ("prefecture", "text")],
         [dict(s, prefecture=s["prefecture"] or "不明") for s in schools]),
        ("players", [("id", "text"), ("school_id", "text"), ("name_ja", "text"), ("name_kana", "text"),
                     ("name_en", "text"), ("gender", "text"), ("graduation_year", "int"),
                     ("prefecture", "text")], players),
        ("courses", [("id", "text"), ("name_ja", "text"), ("name_en", "text"), ("prefecture", "text"),
                     ("latitude", "num"), ("longitude", "num")], courses),
        ("course_tees", [("id", "text"), ("course_id", "text"), ("tee_name", "text"), ("gender", "text"),
                         ("par", "int"), ("yardage", "int"), ("course_rating", "num"),
                         ("slope_rating", "int")], tees),
        ("tournaments", [("id", "text"), ("name_ja", "text"), ("name_en", "text"), ("organizer", "text"),
                         ("level", "text"), ("gender", "text"), ("course_id", "text"),
                         ("start_date", "text"), ("end_date", "text"), ("field_size", "int"),
                         ("winning_score", "int"), ("source_url", "text")], tournaments),
        ("tournament_results", [("id", "text"), ("tournament_id", "text"), ("player_id", "text"),
                                ("position", "int"), ("tied", "bool"), ("total_score", "int"),
                                ("to_par", "int"), ("rank_percentile", "num"), ("status", "text")],
         [dict(r, rank_percentile=r["percentile"]) for r in results]),
        ("rounds", [("id", "text"), ("result_id", "text"), ("round_number", "int"),
                    ("played_on", "text"), ("course_tee_id", "text"), ("score", "int"), ("holes", "int"),
                    ("score_differential", "num"), ("weather", "text"), ("weather_en", "text"),
                    ("temperature_c", "num"), ("wind_speed_ms", "num"), ("precipitation_mm", "num")],
         [dict(r, score_differential=r["differential"]) for r in rounds]),
    ]

    parts = ["-- 自動生成: data/scripts/to_sql.py。手で編集しない。\nbegin;\n"]
    for table, cols, rows in tables:
        parts += inserts(table, cols, rows)
    parts.append("commit;\n")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts))
    if not include_restricted:
        site = {table: [{c: typed(r.get(c), k) for c, k in cols} for r in rows] for table, cols, rows in tables}
        os.makedirs(os.path.dirname(SITE_OUT), exist_ok=True)
        with open(SITE_OUT, "w", encoding="utf-8") as fh:
            json.dump(site, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"schools={len(schools)} players={len(players)} courses={len(courses)} tees={len(tees)} "
          f"tournaments={len(tournaments)} results={len(results)} rounds={len(rounds)} -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
