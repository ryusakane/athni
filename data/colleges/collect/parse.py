"""Roster and coaching-staff parsers for athletics sites (WMT Digital / Nuxt, Sidearm, plain tables)."""
import html as htmllib
import re

from bs4 import BeautifulSoup

import geo
import nuxt

CLASS = [
    (r"^(r-?|rs-?|redshirt\s*)?(fr|freshman|first[- ]year|1st( year)?|fy)\.?$", "FR"),
    (r"^(r-?|rs-?|redshirt\s*)?(so|soph|sophomore|second[- ]year|2nd( year)?)\.?$", "SO"),
    (r"^(r-?|rs-?|redshirt\s*)?(jr|junior|third[- ]year|3rd( year)?)\.?$", "JR"),
    (r"^(r-?|rs-?|redshirt\s*)?(sr|senior|fourth[- ]year|4th( year)?)\.?$", "SR"),
    (r"^(r-?|rs-?|redshirt\s*)?(gr|grad|graduate|graduate student|5th|fifth[- ]year|5th[- ]year|5th year|6th year|super senior|gs|g|graduate student-athlete|grad student)\.?$", "GR"),
]
COACH_TITLE = re.compile(r"coach|director of (golf )?operations|golf operations|director of golf|head|assistant|volunteer", re.I)
NOT_COACH = re.compile(r"trainer|strength|performance|dietitian|manager|sport administrator|communications|nutrition|academic|equipment|sport psych|psycholog|athletic director|\bAD\b|sports information|video|creative|media|marketing|ticket|compliance|administrat", re.I)


def class_year(s):
    if not s:
        return None, False
    t = re.sub(r"\s+", " ", str(s)).strip().lower().replace("–", "-")
    t = t.replace("redshirt-", "redshirt ")
    for rx, code in CLASS:
        m = re.match(rx, t)
        if m:
            return code, bool(m.group(1))
    return None, False


def clean(s):
    if s is None:
        return None
    s = re.sub(r"\s+", " ", htmllib.unescape(str(s))).strip()
    return s or None


def player(name, cy, hometown=None, prev=None, high_school=None):
    code, rs = class_year(cy)
    hometown = clean(hometown)
    return {"name": clean(name), "class_year": code, "redshirt": rs, "hometown": hometown,
            "country": geo.country(hometown), "previous_school": clean(prev) or clean(high_school),
            "class_raw": clean(cy)}


def is_coach(title, kind=None):
    title = title or ""
    if NOT_COACH.search(title) and not re.search(r"golf operations|director of operations", title, re.I):
        return False
    if kind in ("coach", "coaching_staff", "coaches"):
        return True
    return bool(COACH_TITLE.search(title)) and not NOT_COACH.search(title)


# --- WMT Digital (Nuxt) ------------------------------------------------------------------------

def _season_key(s):
    m = re.search(r"(\d{4})", s or "")
    return int(m.group(1)) if m else 0


def parse_wmt(text, gender):
    data = nuxt.decode(text)
    if data is None:
        return None
    rosters = {}
    for o in nuxt.walk(data):
        if isinstance(o.get("player"), dict) and "class_level" in o and o.get("roster_id"):
            rosters.setdefault(str(o["roster_id"]), {"players": [], "staff": [], "season": None, "sport": None})["players"].append(o)
        elif isinstance(o.get("staff_member"), dict) and o.get("roster_id") and "type" in o:
            rosters.setdefault(str(o["roster_id"]), {"players": [], "staff": [], "season": None, "sport": None})["staff"].append(o)
    for o in nuxt.walk(data):
        rid = str(o.get("id")) if o.get("id") is not None else None
        if rid in rosters and isinstance(o.get("season"), dict) and "sport_id" in o:
            m = re.search(r"(20\d\d)[-–/]?(?:20)?(\d\d)", o["season"].get("name") or "")
            rosters[rid]["season"] = f"{m.group(1)}-{m.group(2)}" if m else o["season"].get("name")
            sp = o.get("sport")
            rosters[rid]["sport"] = sp.get("name") if isinstance(sp, dict) else o.get("name")
    if not rosters:
        return None
    golf = [r for r in rosters.values() if "golf" in (r["sport"] or "golf").lower()]
    best = max(golf or rosters.values(), key=lambda r: (_season_key(r["season"]), len(r["players"])))
    players, seen = [], set()
    for o in best["players"]:
        p = o["player"]
        name = p.get("full_name") or f"{p.get('first_name', '')} {p.get('last_name', '')}"
        if name in seen:
            continue
        seen.add(name)
        cl = o.get("class_level")
        cy = cl.get("name") if isinstance(cl, dict) else None
        players.append(player(name, cy, p.get("hometown"), p.get("previous_school"), p.get("high_school")))
    staff, seen = [], set()
    for o in sorted(best["staff"], key=lambda o: int(o.get("order") or 0)):
        m = o["staff_member"]
        name = clean(m.get("full_name") or f"{m.get('first_name', '')} {m.get('last_name', '')}")
        title = clean(o.get("position") or m.get("position"))
        if name in seen or not is_coach(title, o.get("type")):
            continue
        seen.add(name)
        staff.append({"name": name, "title": title, "email": clean(o.get("email") or m.get("email")),
                      "phone": clean(o.get("phone") or m.get("phone"))})
    return {"season": best["season"], "players": players, "coaches": staff, "parser": "wmt"}


# --- Sidearm (classic list markup) -------------------------------------------------------------

def _txt(el, sel):
    x = el.select_one(sel)
    return clean(x.get_text(" ", strip=True)) if x else None


def parse_sidearm(text, gender):
    soup = BeautifulSoup(text, "lxml")
    items = soup.select("li.sidearm-roster-player")
    if not items:
        return None
    players = []
    for it in items:
        name = _txt(it, ".sidearm-roster-player-name h3") or _txt(it, ".sidearm-roster-player-name")
        name = re.sub(r"^\d+\s+", "", name or "")
        cy = _txt(it, ".sidearm-roster-player-academic-year")
        home = _txt(it, ".sidearm-roster-player-hometown")
        hs = _txt(it, ".sidearm-roster-player-highschool")
        prev = _txt(it, ".sidearm-roster-player-previous-school")
        players.append(player(name, cy, home, prev, hs))
    coaches = []
    for it in soup.select("li.sidearm-roster-coach, .sidearm-roster-coaches tr"):
        name = _txt(it, ".sidearm-roster-coach-name") or _txt(it, "th a") or _txt(it, "td a")
        title = _txt(it, ".sidearm-roster-coach-title") or _txt(it, "td:nth-of-type(2)")
        email = next((a["href"][7:].split("?")[0] for a in it.select('a[href^="mailto:"]')), None)
        phone = next((clean(a.get_text()) for a in it.select('a[href^="tel:"]')), None) or _txt(it, ".sidearm-roster-coach-phone")
        if name and is_coach(title, "coach"):
            coaches.append({"name": name, "title": title, "email": email, "phone": phone})
    season = None
    sel = soup.select_one("#ddl_past_rosters option[selected], select option[selected]")
    m = re.search(r"(20\d\d)[-–](\d\d)", clean(sel.get_text()) if sel else "") or re.search(r"(20\d\d)[-–](\d\d)\s+[^<]{0,40}Roster", text)
    if m:
        season = f"{m.group(1)}-{m.group(2)}"
    return {"season": season, "players": players, "coaches": coaches, "parser": "sidearm"}


# --- Plain tables (fallback) ------------------------------------------------------------------

HEAD = {"name": re.compile(r"^(full )?name$|^player$", re.I), "class": re.compile(r"^(cl\.?|class|yr\.?|year|academic year|elig\.?)$", re.I),
        "hometown": re.compile(r"hometown", re.I), "prev": re.compile(r"previous school|last school|high school|prev", re.I),
        "title": re.compile(r"^(title|position)$", re.I), "email": re.compile(r"e-?mail", re.I), "phone": re.compile(r"phone", re.I)}


def parse_tables(text, gender):
    soup = BeautifulSoup(text, "lxml")
    players, coaches = [], []
    for table in soup.select("table"):
        heads = [clean(th.get_text(" ", strip=True)) or "" for th in table.select("thead th")] or \
                [clean(c.get_text(" ", strip=True)) or "" for c in (table.select_one("tr") or soup.new_tag("tr")).find_all(["th", "td"])]
        col = {}
        for k, rx in HEAD.items():
            for i, h in enumerate(heads):
                if rx.search(h) and k not in col:
                    col[k] = i
        if "name" not in col:
            continue
        for tr in table.select("tbody tr") or table.select("tr")[1:]:
            cells = tr.find_all(["td", "th"])
            if len(cells) < len(heads) - 1:
                continue
            get = lambda k: clean(cells[col[k]].get_text(" ", strip=True)) if k in col and col[k] < len(cells) else None
            if "class" in col or "hometown" in col:
                players.append(player(get("name"), get("class"), get("hometown"), get("prev")))
            elif "title" in col:
                email = next((a["href"][7:].split("?")[0] for a in tr.select('a[href^="mailto:"]')), None)
                if is_coach(get("title")):
                    coaches.append({"name": get("name"), "title": get("title"), "email": email or get("email"), "phone": get("phone")})
    if not players:
        return None
    return {"season": None, "players": players, "coaches": coaches, "parser": "table"}


def parse_roster(text, gender):
    for fn in (parse_wmt, parse_sidearm, parse_tables):
        try:
            r = fn(text, gender)
        except Exception as e:  # keep going with the next parser
            r = None
        if r and r["players"]:
            return r
    return None


# --- Staff directory (emails / phones for golf staff) ----------------------------------------

def parse_staff_directory(text, gender):
    """Rows under a golf heading in a staff directory table: name, title, email, phone."""
    soup = BeautifulSoup(text, "lxml")
    want = re.compile(r"women'?s golf|w\.? ?golf|golf,? women" if gender == "female" else r"(?<!wo)men'?s golf|m\.? ?golf|golf,? men(?!'?s,? wo)", re.I)
    either = re.compile(r"golf", re.I)
    out = []
    for table in soup.select("table"):
        section = None
        for tr in table.select("tr"):
            cells = tr.find_all(["td", "th"])
            texts = [clean(c.get_text(" ", strip=True)) or "" for c in cells]
            mail = next((a["href"][7:].split("?")[0].strip() for a in tr.select('a[href^="mailto:"]')), None)
            if (len(cells) == 1 or tr.get("class") and any("category" in c or "header" in c for c in tr.get("class"))) and not mail:
                section = texts[0] if texts else None
                continue
            if not section or not either.search(section):
                continue
            if "women" in section.lower() and gender == "male" or ("men" in section.lower() and "women" not in section.lower() and gender == "female"):
                continue
            tel = next((clean(a.get_text()) for a in tr.select('a[href^="tel:"]')), None)
            if not tel:
                tel = next((t for t in texts if re.fullmatch(r"\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}( ext\.? ?\d+)?", t)), None)
            name = texts[0] if texts else None
            title = texts[1] if len(texts) > 1 else None
            if name:
                out.append({"name": name, "title": title, "email": mail, "phone": tel})
    return out
