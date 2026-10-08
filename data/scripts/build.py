#!/usr/bin/env python3
"""data/raw/**/*.json (大会ごとの書き起こし) と data/reference/*.json から、
supabase/migrations/0001_init.sql の各テーブルに対応する CSV を data/ に生成する。

UUID の代わりに人が読める *_key を主キー/外部キーに使う。投入時に key → uuid を引き当てる。

  schools.csv            schools
  players.csv            players
  courses.csv            courses
  course_tees.csv        course_tees
  tournaments.csv        tournaments
  tournament_results.csv tournament_results
  rounds.csv             rounds
  team_results.csv       (スキーマ未対応の団体戦。拡張用)
  team_members.csv       (同上)
  player_name_review.csv 同姓同名でまとめなかった選手の組 (人が判断する)
  ISSUES.md              書き起こし・名寄せの要確認事項

実行: python3 data/scripts/build.py   (要 pykakasi)
"""
import csv
import datetime as dt
import glob
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
REF = os.path.join(ROOT, "reference")

try:
    import pykakasi
    _kks = pykakasi.kakasi()
except ImportError:  # 英語表記なしで続行
    _kks = None
try:
    from namedivider import BasicNameDivider
    _divider = BasicNameDivider()
except ImportError:  # 姓名分割なしで続行
    _divider = None


def load_ref(name, default):
    p = os.path.join(REF, name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


TRANS = load_ref("translations.json", {})
# 読み推定 (name_parts.json: {漢字: {"en": ..., "kana": ..., "confidence": ...}}) と学校英語名 (school_names.json)
TRANS.setdefault("name_parts", {}).update(
    {k: v["en"] for k, v in load_ref("name_parts.json", {}).items() if v.get("en")})
NAME_KANA = {k: v.get("kana") for k, v in load_ref("name_parts.json", {}).items()}
NAME_CONF = {k: v.get("confidence") for k, v in load_ref("name_parts.json", {}).items()}
SCHOOL_REF = load_ref("school_names.json", {})
TERMS = {k: v for k, v in load_ref("source_terms.json", {}).items() if not k.startswith("_")}


def terms_for(tid):
    for prefix in sorted(TERMS, key=len, reverse=True):
        if tid.startswith(prefix):
            return TERMS[prefix]
    return {"reuse_status": "check", "note": None}
COURSES = load_ref("courses.json", [])
WEATHER = load_ref("weather.json", {})

ROUND_DIGITS = str.maketrans("０１２３４５６７８９①②③", "0123456789123")


# 異体字セレクタ (辻󠄀 の U+E0100 など)。名寄せ・読み推定では無視する
VARIATION_SELECTORS = re.compile("[\ufe00-\ufe0f\U000e0100-\U000e01ef]")


def squash(s):
    return re.sub(r"[\s　]+", "", VARIATION_SELECTORS.sub("", s or ""))


def school_core(s):
    s = squash(s)
    s = re.sub(r"(高等学校|高校|中等教育学校)$", "", s)
    return re.sub(r"(?<=[^一二三四五六七八九十])高$", "", s)  # 「滝川第二高」→「滝川第二」


def canonical_school(name):
    """略称の表記ゆれ (拓大紅陵 / 拓殖大学紅陵) を正式名にまとめる。正式名不明なら略称のまま。"""
    core = school_core(name)
    ref = SCHOOL_REF.get(core) or {}
    return squash(ref.get("full_name_ja")) or core


def key(prefix, *parts):
    return prefix + "_" + hashlib.sha1("|".join(parts).encode()).hexdigest()[:12]


def romaji(text):
    if not _kks or not text:
        return None
    text = VARIATION_SELECTORS.sub("", text)
    return " ".join(w["hepburn"].capitalize() for w in _kks.convert(text) if w["hepburn"].strip())


def kana(text):
    if not _kks or not text:
        return None
    text = VARIATION_SELECTORS.sub("", text)
    return "".join(w["hira"] for w in _kks.convert(text))


def passport(r, join=False):
    """旅券式ヘボン: 長音の ou/uu を o/u に (Kouki -> Koki)。join=True なら1語にまとめる。"""
    if not r:
        return None
    words = r.lower().split()
    words = [re.sub(r"uu", "u", re.sub(r"ou", "o", w)) for w in words]
    return "".join(words).capitalize() if join else " ".join(w.capitalize() for w in words)


def split_name(name_ja):
    """姓・名に分ける。空白があればそれに従い、なければ namedivider で推定。"""
    parts = re.split(r"[\s\u3000]+", (name_ja or "").strip())
    if len(parts) != 2 and _divider:
        r = _divider.divide_name(squash(name_ja))
        parts = [r.family, r.given]
    return parts


def name_kana(name_ja):
    if re.fullmatch(r"[A-Za-z .'-]+", name_ja or ""):
        return None
    parts = split_name(name_ja)
    if len(parts) == 2:
        return " ".join(NAME_KANA.get(x) or kana(x) or "" for x in parts).strip() or None
    return kana(squash(name_ja))


def player_name_en(name_ja):
    """'沖田雫' -> 'Shizuku Okita' (名・姓の順)。

    読みは漢字から機械的に推定しているため誤りを含む (例: 滉司 → Kotsukasa、正しくは Koji 等)。
    本人確認済みの表記は reference/translations.json の players に入れると優先される。
    """
    o = TRANS.get("players", {}).get(squash(name_ja))
    if o:
        return o, "manual"
    if re.fullmatch(r"[A-Za-z .'-]+", name_ja or ""):  # 海外選手など既に英字
        return name_ja.strip(), "as-published"
    parts = split_name(name_ja)
    if len(parts) == 2:
        np_ = TRANS.get("name_parts", {})
        fam = np_.get(parts[0]) or passport(romaji(parts[0]), True)
        giv = np_.get(parts[1]) or passport(romaji(parts[1]), True)
        if fam and giv:
            conf = [NAME_CONF.get(x) for x in parts]
            src = ("estimated-" + min(conf, key=["low", "medium", "high"].index)
                   if all(conf) else "auto-unverified")
            return f"{giv} {fam}", src
    return passport(romaji(squash(name_ja)), True), "auto-unverified"


def school_name_en(core):
    o = TRANS.get("schools", {}).get(core)
    if o:
        return o, "manual"
    ref = SCHOOL_REF.get(core)
    if ref and ref.get("name_en"):
        return ref["name_en"], {"official": "official", "web": "web"}.get(ref.get("source"), "estimated-unverified")
    if re.fullmatch(r"[A-Za-z0-9 .&'-]+", core):  # 既に英字 (例: RSJ)
        return f"{core} High School", "auto-unverified"
    r = passport(romaji(core))
    return (f"{r} High School" if r else None), "auto-unverified"


# event_type がない既存の書き起こし用 (id の接頭辞から推定)
EVENT_TYPE_BY_PREFIX = [("jga-junior-", "junior"), ("kokusupo-", "amateur"), ("kougoren-", "high_school"),
                        ("-kougoren-", "high_school")]


def event_type(t):
    if t.get("event_type"):
        return t["event_type"]
    for prefix, et in EVENT_TYPE_BY_PREFIX:
        if t["id"].startswith(prefix) or (prefix.startswith("-") and prefix in t["id"]):
            return et
    return None


def tournament_name_en(t):
    if t.get("name_en"):
        return t["name_en"]
    for rule in TRANS.get("tournaments", []):
        if re.match(rule["id_pattern"], t["id"]):
            year = (t.get("start_date") or t.get("end_date") or str(t.get("season_year")))[:4]
            return rule["name_en"].format(year=year,
                                          category="Boys" if t.get("category") == "boys" else "Girls",
                                          format="Team" if t.get("format") == "team" else "Individual")
    return None


def find_course(venue):
    """会場名に最も長く一致するコースを返す (「サンヒルズCC」より「サンヒルズCC ウエストコース」を優先)。"""
    v = squash(venue)
    best, best_len = None, 0
    for c in COURSES:
        for n in [c["name_ja"]] + c.get("aliases", []):
            n = squash(n)
            if n and (n in v or v in n) and len(n) > best_len:
                best, best_len = c, len(n)
    return best


def find_tee(course, gender, yardage):
    """大会のヤーデージで使用ティーを特定。わからなければ同性別のティーが1つだけの時にそれを使う。"""
    cands = [x for x in course.get("tees", []) if x["gender"] == gender]
    if yardage:
        for x in cands:
            if yardage in (x.get("tournament_yardages") or []) or x.get("yardage") == yardage:
                return x
    return cands[0] if len(cands) == 1 else None


def parse_rank(rank):
    """'T3'/'3T'/'3' → (3, tied?), 'cut'/'WD'/'DQ' → (None, status)."""
    r = str(rank or "").strip().translate(ROUND_DIGITS)
    low = r.lower()
    if re.match(r"r\d+:", low):  # 途中ラウンド時点の順位 (最終順位が取れていない大会)
        return None, False, "finished"
    if low in ("dns", "ns") or "欠場" in r:  # 不出場
        return None, False, "dns"
    for s in ("cut", "wd", "dq"):
        if s in low or {"cut": "予選落", "wd": "棄権", "dq": "失格"}[s] in r:
            return None, False, s
    m = re.search(r"\d+", r)
    if not m:
        return None, False, "finished"
    return int(m.group()), ("t" in low or "タイ" in r), "finished"


def school_year(date_str, season_year):
    """日本の学年度 (4月始まり)。日付がなければ season_year。"""
    try:
        d = dt.date.fromisoformat(date_str)
        return d.year if d.month >= 4 else d.year - 1
    except (TypeError, ValueError):
        return season_year


# --- 選手の名寄せ (同姓同名) ---
# 名前が同じで、学校・県・卒業年度のうち2つ以上が一致すれば同一人物とみなして1人にまとめる。
# まとめなかった同姓同名は player_name_review.csv に出し、人が判断する。
# 判断結果は reference/player_merge_decisions.csv (player_key_a, player_key_b, decision=same|different) に書くと、
# 次の build から反映される (same はまとめる、different はまとめない)。
NAME_VARIANTS = str.maketrans("髙﨑德濵邊邉齋齊嶋櫻澤廣藏眞", "高崎徳浜辺辺斎斉島桜沢広蔵真")
SCHOOL_PREFIX = re.compile(r"^(東京都立|都立|道立|府立|私立|.{2,3}?[県市]立)")


def name_norm(name):
    return squash(name).translate(NAME_VARIANTS)


def pref_norm(pref):
    pref = squash(pref)
    if pref == "東京都":
        return "東京"
    return re.sub(r"(?<=.)[県府]$", "", pref) if pref != "北海道" else pref


def school_pref(name):
    """「東京都立駒場」「愛知県立岡崎北」のように校名に入っている都道府県。"""
    m = re.match(r"^(東京都立|都立)", squash(name))
    if m:
        return "東京"
    m = re.match(r"^(.{2,3}?)県立", squash(name))
    return m.group(1) if m else ""


def school_norm(name):
    s = re.sub(r"[0-9０-９]年$", "", school_core(name))  # 「開志国際２年」
    s = s.replace("附属", "付属").translate(str.maketrans("1２2３3", "一二二三三")).replace("１", "一")
    return SCHOOL_PREFIX.sub("", s) or s


def same_school(a, b):
    """同じ校名か、短い方が長い方の略称 (「岐阜聖徳」「日体荏原」→ 正式名) になっている。"""
    if not a or not b:
        return False
    short, long_ = sorted((a, b), key=len)
    if short == long_ or (len(short) >= 2 and short in long_):
        return True
    it = iter(long_)  # 頭文字が同じで、短い方の字が順に全部入っている
    return len(short) >= 3 and short[0] == long_[0] and all(c in it for c in short)


def load_merge_decisions():
    path = os.path.join(REF, "player_merge_decisions.csv")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        return {frozenset((r["player_key_a"], r["player_key_b"])): r["decision"].strip()
                for r in csv.DictReader(fh) if r.get("player_key_a") and r.get("player_key_b")}


def dedup_players(players, schools, results, rounds, members):
    """同姓同名の選手をまとめ、成績を残す方の選手に付け替える。返り値は人の確認が要る同姓同名の一覧。"""
    decisions = load_merge_decisions()
    events = defaultdict(set)
    for r in results:
        events[r["player_key"]].add(r["tournament_key"])
    for m in members:
        if m["player_key"]:
            events[m["player_key"]].add(m["tournament_key"])

    def attrs(p):
        sch = schools.get(p["school_key"]) or {}
        school = school_norm(sch.get("name_ja") or "")
        pref = pref_norm(p["prefecture"] or sch.get("prefecture") or school_pref(sch.get("name_short_ja") or ""))
        return {"school": school, "prefecture": pref, "graduation_year": p["graduation_year"] or None}

    def matches(a, b):
        out = []
        if same_school(a["school"], b["school"]):
            out.append("school")
        if a["prefecture"] and a["prefecture"] == b["prefecture"]:
            out.append("prefecture")
        if a["graduation_year"] and str(a["graduation_year"]) == str(b["graduation_year"]):
            out.append("graduation_year")
        return out

    by_name = defaultdict(list)
    for p in players.values():
        by_name[name_norm(p["name_ja"])].append(p["player_key"])

    parent = {}

    def find(k):
        while parent.get(k, k) != k:
            k = parent[k]
        return k

    review, merged_into = [], {}
    for name, keys in by_name.items():
        if len(keys) < 2:
            continue
        a = {k: attrs(players[k]) for k in keys}
        # 情報の多い記録を残す (学校・県・卒業年度があり、出場大会が多い方)
        keys.sort(key=lambda k: (-sum(bool(v) for v in a[k].values()), -len(events[k]), k))
        groups = {k: {k} for k in keys}
        pairs = []
        for i, x in enumerate(keys):
            for y in keys[i + 1:]:
                m = matches(a[x], a[y])
                decision = decisions.get(frozenset((x, y)))
                gx, gy = players[x]["gender"], players[y]["gender"]
                compatible = gx == gy or "mixed" in (gx, gy)
                pairs.append((x, y, m, decision, compatible))
        # 人の判断 → ルール (2項目以上一致) の順に、同じ大会に両方出ている組は除いてまとめる
        for x, y, m, decision, compatible in sorted(pairs, key=lambda p: (p[3] != "same", -len(p[2]))):
            rx, ry = find(x), find(y)
            if rx == ry or decision == "different" or not compatible:
                continue
            if decision != "same" and len(m) < 2:
                continue
            ex = set().union(*(events[k] for k in groups[rx]))
            ey = set().union(*(events[k] for k in groups[ry]))
            if ex & ey:
                continue
            keep, drop = (rx, ry) if keys.index(rx) < keys.index(ry) else (ry, rx)
            parent[drop] = keep
            groups[keep] |= groups.pop(drop)
        def ev(root):
            return set().union(*(events[k] for k in groups[root]))

        def row(x, y, m, status, why):
            return {"status": status, "name_ja": players[x]["name_ja"],
                    "player_key_a": x, "player_key_b": y,
                    "school_a": (schools.get(players[x]["school_key"]) or {}).get("name_ja", ""),
                    "school_b": (schools.get(players[y]["school_key"]) or {}).get("name_ja", ""),
                    "prefecture_a": a[x]["prefecture"], "prefecture_b": a[y]["prefecture"],
                    "graduation_year_a": players[x]["graduation_year"] or "",
                    "graduation_year_b": players[y]["graduation_year"] or "",
                    "gender_a": players[x]["gender"], "gender_b": players[y]["gender"],
                    "matched": " ".join(m), "reason": why,
                    "tournaments_a": " ".join(sorted(ev(find(x)))), "tournaments_b": " ".join(sorted(ev(find(y)))),
                    "decision": ""}

        # 学校・県・卒業年度のうち1つ以下しかわからない記録 (日本ジュニア・国スポなど) はルールでは決められない。
        # 同名・同性別で2項目以上わかっている相手のうち、食い違わないのが1人だけなら仮にまとめ、
        # 確認リストに「統合済み (要確認)」で出す。学校のない記録の県は国スポの代表県なので比べない。
        def conflict(x, y):
            ax, ay = a[x], a[y]
            if ax["school"] and ay["school"] and not same_school(ax["school"], ay["school"]):
                return True
            if ax["graduation_year"] and ay["graduation_year"] \
                    and str(ax["graduation_year"]) != str(ay["graduation_year"]):
                return True
            return bool(ax["school"] and ay["school"] and ax["prefecture"] and ay["prefecture"]
                        and ax["prefecture"] != ay["prefecture"])

        sparse = {k for k in keys if sum(bool(v) for v in a[k].values()) < 2}
        for x in [k for k in reversed(keys) if find(k) == k and k in sparse]:
            cands = [y for y in {find(k) for k in keys if k not in sparse}
                     if (players[x]["gender"] == players[y]["gender"] or "mixed" in
                         (players[x]["gender"], players[y]["gender"]))
                     and not (ev(x) & ev(y)) and not any(conflict(x, k) for k in groups[y])
                     and decisions.get(frozenset((x, y))) != "different"]
            if len(cands) == 1:
                y = cands[0]
                review.append(row(y, x, matches(a[y], a[x]), "統合済み (要確認)",
                                  "わかっている項目が1つ以下の記録を、食い違いのない同名の1人にまとめた"))
                parent[x] = y
                groups[y] |= groups.pop(x)

        for k in keys:
            if find(k) != k:
                merged_into[k] = find(k)
        left = [k for k in keys if find(k) == k]
        for x, y, m, decision, compatible in pairs:
            if x in left and y in left and decision != "different":
                why = ("同じ大会に両方出場" if ev(x) & ev(y) else "性別が違う" if not compatible
                       else "一致が2項目未満")
                review.append(row(x, y, m, "未統合", why))

    # まとめた選手の空欄を、まとめられた側の情報で埋めてから消す
    for drop, keep in merged_into.items():
        p, q = players[keep], players.pop(drop)
        for col in ("school_key", "name_kana", "graduation_year", "prefecture"):
            if not p[col] and q[col]:
                p[col] = q[col]
    for rows in (results, rounds, members):
        for r in rows:
            if r["player_key"] in merged_into:
                r["player_key"] = merged_into[r["player_key"]]
    return merged_into, review


def round_dates(t, n):
    try:
        start = dt.date.fromisoformat(t.get("start_date"))
    except (TypeError, ValueError):
        try:  # 開始日不明なら最終日から逆算 (1日1ラウンド想定)
            end = dt.date.fromisoformat(t.get("end_date"))
        except (TypeError, ValueError):
            return [None] * n
        return [(end - dt.timedelta(days=n - 1 - i)).isoformat() for i in range(n)]
    try:
        end = dt.date.fromisoformat(t.get("end_date") or t["start_date"])
    except ValueError:
        end = start
    return [min(start + dt.timedelta(days=i), end).isoformat() for i in range(n)]


def differential(score, tee):
    if not isinstance(score, int) or not tee or not tee.get("course_rating") or not tee.get("slope_rating"):
        return None
    return round(113 / tee["slope_rating"] * (score - tee["course_rating"]), 1)


def main():
    files = sorted(f for f in glob.glob(os.path.join(RAW, "**", "*.json"), recursive=True)
                   if not os.path.basename(f).startswith("_"))
    # 学校名のある大会を先に処理し、学校名のない大会 (国スポ・2026 JGA) の選手を名寄せできるようにする
    def has_schools(f):
        with open(f, encoding="utf-8") as fh:
            rows = json.load(fh).get("results", [])
        return any(r.get("school") or any(m.get("school") for m in r.get("members") or []) for r in rows)
    files.sort(key=lambda f: not has_schools(f))
    schools, players, tournaments, results, rounds = {}, {}, [], [], []
    teams, members, issues = [], [], []
    tees_used = defaultdict(set)

    def school_row(name, pref):
        core = school_core(name)
        if not core:
            return None
        canon = canonical_school(name)
        # 同名校が複数県にある場合は区別できない (現データでは未確認)
        k = key("s", canon)
        if k not in schools:
            en, src = school_name_en(core)
            ref = SCHOOL_REF.get(core) or {}
            schools[k] = {"school_key": k, "name_ja": canon, "name_short_ja": core,
                          "name_en": en, "name_en_source": src, "kind": ref.get("kind"),
                          "name_en_source_url": ref.get("source_url"),
                          "prefecture": pref or ""}
        elif pref and not schools[k]["prefecture"]:
            schools[k]["prefecture"] = pref
        return k

    def player_row(name, school, pref, grade, gender, t):
        if not name:
            return None
        sk = school_row(school, pref)
        k = key("p", squash(name), canonical_school(school) if school_core(school) else "", gender)
        if not sk:
            # 学校名のない大会 (国スポ等): 同名・同性別・同県の既存選手が1人だけなら同一人物とみなす
            cands = [p for p in players.values() if squash(p["name_ja"]) == squash(name)
                     and p["gender"] == gender and (not pref or p["prefecture"] in ("", pref))]
            if len(cands) == 1:
                return cands[0]["player_key"]
        sy = school_year(t.get("start_date"), t.get("season_year"))
        grad = sy + 4 - int(grade) if grade else None
        if k not in players:
            en, src = player_name_en(name)
            players[k] = {"player_key": k, "school_key": sk, "name_ja": name.strip(),
                          "name_kana": name_kana(name), "name_en": en, "name_en_source": src,
                          "gender": gender, "graduation_year": grad, "prefecture": pref or ""}
        p = players[k]
        p["prefecture"] = p["prefecture"] or pref or ""
        if grad and p["graduation_year"] and grad != p["graduation_year"]:
            issues.append((t["id"], f"卒業年度が一致しない: {name} ({school}) {p['graduation_year']} vs {grad}"))
        p["graduation_year"] = p["graduation_year"] or grad
        return k

    for f in files:
        with open(f, encoding="utf-8") as fh:
            d = json.load(fh)
        t, q = d["tournament"], d.get("quality", {})
        tid = t["id"]
        gender = {"boys": "male", "girls": "female"}.get(t.get("category"), "mixed")
        course = find_course(t.get("venue"))
        if not course and t.get("venue"):
            issues.append((tid, f"コース情報未登録: {t.get('venue')}"))
        tee = None
        if course:
            tee = find_tee(course, gender, t.get("yardage"))
            if not tee:
                issues.append((tid, f"使用ティー不明: {course['course_key']} {t.get('yardage')}y"))
            if tee:
                tees_used[course["course_key"]].add(tee["tee_name"])
        tournaments.append({
            "tournament_key": tid, "name_ja": t.get("name"), "name_en": tournament_name_en(t),
            "organizer": t.get("organizer"), "level": t.get("level"), "gender": gender,
            "event_type": event_type(t),
            "course_key": course["course_key"] if course else None,
            "start_date": t.get("start_date"), "end_date": t.get("end_date"),
            "source_url": t.get("source_url"),
            # 以下はスキーマ外の補足列
            "season_year": t.get("season_year"), "region": t.get("region"), "format": t.get("format"),
            "venue_ja": t.get("venue"), "par": t.get("par"), "yardage": t.get("yardage"),
            "result_pdf_urls": " ".join(t.get("result_pdf_urls") or []),
            "complete": q.get("complete"), "row_count": len(d.get("results", [])),
            # 大会全体の出場人数 (一般アマ・プロ大会では高校生以外も含む)。不明なら空
            "field_size_total": t.get("field_size_total"),
            "reuse_status": terms_for(tid)["reuse_status"], "reuse_note": terms_for(tid)["note"],
        })
        for i in q.get("issues") or []:
            issues.append((tid, i))

        if t.get("format") == "team":
            for r in d.get("results", []):
                team = r.get("team_name") or r.get("school")
                pos, tied, status = parse_rank(r.get("rank"))
                teams.append({"tournament_key": tid, "team_name": team, "position": pos, "tied": tied,
                              "status": status, "prefecture": r.get("school_prefecture"),
                              "total_score": r.get("total")})
                for m in r.get("members") or []:
                    school = m.get("school") or r.get("school")
                    members.append({"tournament_key": tid, "team_name": team,
                                    "player_key": player_row(m.get("player_name"), school,
                                                             r.get("school_prefecture"), m.get("grade"), gender, t),
                                    "score": m.get("score"), "counted": m.get("counted")})
            continue

        rows = d.get("results", [])
        rank_counts = Counter(parse_rank(r.get("rank"))[0] for r in rows)
        seen = set()
        for r in rows:
            pk = player_row(r.get("player_name"), r.get("school"), r.get("school_prefecture"),
                            r.get("grade"), gender, t)
            if not pk:
                continue
            if pk in seen:
                issues.append((tid, f"同一選手が重複: {r.get('player_name')}"))
                continue
            seen.add(pk)
            pos, tied, status = parse_rank(r.get("rank"))
            tied = tied or (pos is not None and rank_counts[pos] > 1)
            rs = r.get("rounds") or []
            scored = [x for x in rs if isinstance(x, int)]
            if scored and isinstance(r.get("total"), int) and sum(scored) != r["total"]:
                issues.append((tid, f"合計不一致: {r.get('player_name')} {rs} != {r['total']}"))
            results.append({"tournament_key": tid, "player_key": pk, "position": pos, "tied": tied,
                            "total_score": r.get("total"), "to_par": r.get("to_par"), "status": status,
                            "amateur": r.get("amateur", True),
                            # 以下はスキーマ外の派生列 (後で埋める)
                            "field_size": None, "percentile": None, "strokes_behind_winner": None,
                            "avg_differential": None})
            res = results[-1]
            dates = round_dates(t, len(rs))
            holes = t.get("round_holes") or [18] * len(rs)
            for n, (sc, day) in enumerate(zip(rs, dates), 1):
                h = holes[n - 1] if n <= len(holes) else 18
                w = (WEATHER.get(course["course_key"], {}) if course else {}).get(day or "", {})
                rounds.append({"tournament_key": tid, "player_key": pk, "round_number": n,
                               "played_on": day,
                               "course_tee_key": f"{course['course_key']}:{tee['tee_name']}:{gender}" if tee else None,
                               "score": sc, "holes": h, "weather": w.get("weather"),
                               "weather_en": w.get("weather_en"),
                               "temperature_c": w.get("temperature_c"),
                               "wind_speed_ms": w.get("wind_speed_ms"),
                               "precipitation_mm": w.get("precipitation_mm"),
                               # スキーマ外: WHS式スコアディファレンシャル (113/slope × (score − CR))
                               "differential": differential(sc, tee) if h == 18 else None,
                               "weather_station": w.get("station"),
                               "temp_min_c": w.get("temp_min_c"), "weather_source_url": w.get("source_url")})
            diffs = [x["differential"] for x in rounds[-len(rs):] if rs and x["differential"] is not None]
            res["avg_differential"] = round(sum(diffs) / len(diffs), 1) if diffs else None
        finished = [x for x in results if x["tournament_key"] == tid and x["status"] != "dns"]
        # 一般アマ・プロ大会は高校生だけを書き起こしているので、順位・上位%は大会全体の人数で見る
        field = t.get("field_size_total") or len(finished)
        if field < len(finished):
            issues.append((tid, f"field_size_total ({field}) が書き起こし人数 ({len(finished)}) より少ない"))
            field = len(finished)
        win = min((x["total_score"] for x in finished
                   if x["status"] == "finished" and isinstance(x["total_score"], int)), default=None)
        if field > len(finished) and not any(x["position"] == 1 for x in finished):
            win = None  # 優勝者が書き起こしに含まれない (高校生以外が優勝) ので差は出せない
        for x in finished:
            x["field_size"] = field
            if x["position"]:
                x["percentile"] = round(100 * (1 - (x["position"] - 1) / field), 1)
            if win is not None and x["status"] == "finished" and isinstance(x["total_score"], int):
                x["strokes_behind_winner"] = x["total_score"] - win

    for p in players.values():  # 県が出ていない大会 (JGA) の選手は学校の県で補う
        if not p["prefecture"] and p["school_key"]:
            p["prefecture"] = schools[p["school_key"]]["prefecture"]

    merged, review = dedup_players(players, schools, results, rounds, members)
    for drop, keep in sorted(merged.items()):
        issues.append(("player-dedup", f"同一人物としてまとめた: {drop} → {keep} ({players[keep]['name_ja']})"))

    course_rows, tee_rows = [], []
    for c in COURSES:
        course_rows.append({k: c.get(k) for k in
                            ("course_key", "name_ja", "name_en", "prefecture", "latitude", "longitude", "source_url")})
        for x in c.get("tees", []):
            tee_rows.append({"course_tee_key": f"{c['course_key']}:{x['tee_name']}:{x['gender']}",
                             "course_key": c["course_key"], "tee_name": x["tee_name"], "gender": x["gender"],
                             "par": x.get("par"), "yardage": x.get("yardage"),
                             "course_rating": x.get("course_rating"), "slope_rating": x.get("slope_rating"),
                             "tournament_yardages": " ".join(map(str, x.get("tournament_yardages") or [])),
                             "men_course_rating": x.get("men_course_rating"),
                             "source_url": x.get("source_url")})

    def write(name, rows):
        path = os.path.join(ROOT, name)
        if not rows:
            if os.path.exists(path):
                os.remove(path)
            return
        with open(path, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)

    write("schools.csv", sorted(schools.values(), key=lambda s: (s["prefecture"], s["name_ja"])))
    write("players.csv", sorted(players.values(), key=lambda p: (p["prefecture"], p["name_ja"])))
    write("courses.csv", course_rows)
    write("course_tees.csv", tee_rows)
    write("tournaments.csv", tournaments)
    write("tournament_results.csv", results)
    write("rounds.csv", rounds)
    write("team_results.csv", teams)
    write("team_members.csv", members)
    write("player_name_review.csv", review)
    with open(os.path.join(ROOT, "ISSUES.md"), "w", encoding="utf-8") as fh:
        fh.write("# 要確認事項 (build.py が自動生成)\n\n")
        for tid, i in issues:
            fh.write(f"- `{tid}`: {i}\n")
    print(f"schools={len(schools)} players={len(players)} courses={len(course_rows)} tees={len(tee_rows)} "
          f"tournaments={len(tournaments)} results={len(results)} rounds={len(rounds)} "
          f"teams={len(teams)} issues={len(issues)} merged={len(merged)} review_pairs={len(review)}", file=sys.stderr)


if __name__ == "__main__":
    main()
