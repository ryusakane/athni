"""Find each school's golf pages (landing, roster) and golf-team social accounts from its athletics homepage."""
import re
from urllib.parse import urljoin, urlsplit

import fetch

MEN = re.compile(r"(mens-golf|/mgolf|m-golf|mens/golf|men-s-golf|path=mgolf)", re.I)
WOMEN = re.compile(r"(womens-golf|/wgolf|w-golf|womens/golf|women-s-golf|path=wgolf)", re.I)
SOCIAL = {
    "instagram_url": re.compile(r"instagram\.com/([A-Za-z0-9_.]+)", re.I),
    "x_url": re.compile(r"(?:twitter|x)\.com/@?([A-Za-z0-9_]+)", re.I),
    "facebook_url": re.compile(r"facebook\.com/((?:pages/)?[A-Za-z0-9_.\-]+(?:/\d+)?)", re.I),
    "tiktok_url": re.compile(r"tiktok\.com/@([A-Za-z0-9_.]+)", re.I),
    "youtube_url": re.compile(r"youtube\.com/((?:@|c/|channel/|user/)[A-Za-z0-9_\-]+)", re.I),
}
SOCIAL_BASE = {"instagram_url": "https://www.instagram.com/{}", "x_url": "https://x.com/{}",
               "facebook_url": "https://www.facebook.com/{}", "tiktok_url": "https://www.tiktok.com/@{}",
               "youtube_url": "https://www.youtube.com/{}"}


def links(html, base):
    html = html.replace("\\/", "/").replace("&amp;", "&")
    out = []
    for l in re.findall(r'(?:href=|"href":|"url":|"link":)\s*"([^"]+)"', html, re.I):
        if l.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        out.append(urljoin(base, l))
    return out


def sport_root(url, gender):
    """Normalize a golf link to the sport's landing page (…/sports/mens-golf)."""
    p = urlsplit(url)
    if "path=" in p.query:
        m = re.search(r"path=(\w+)", p.query)
        return f"{p.scheme}://{p.netloc.removesuffix(':443')}/sports/{'mens' if gender == 'male' else 'womens'}-golf" if m else None
    m = re.match(r"(.*?/sports?/(?:mens-golf|womens-golf|mgolf|wgolf|m-golf|w-golf|mens/golf|womens/golf|golf))", p.path)
    if not m:
        return None
    return f"{p.scheme}://{p.netloc.removesuffix(':443')}{m.group(1)}"


def classify_social(handle):
    h = handle.lower()
    if "golf" not in h:
        return None
    if re.search(r"(women|wgolf|w_golf|wgolf|ladies|wmn|w\.golf|_wg|wgo)", h) or re.search(r"w(omens)?golf", h):
        return "female"
    if re.search(r"(mens|mgolf|m_golf|m\.golf|men)", h):
        return "male"
    return "both"


def socials(all_links, genders):
    out = {g: {} for g in genders}
    shared = {g: {} for g in genders}  # accounts that don't say men's or women's
    for l in all_links:
        for field, rx in SOCIAL.items():
            m = rx.search(l)
            if not m:
                continue
            handle = m.group(1).rstrip("/")
            g = classify_social(handle)
            if g is None:
                continue
            if g == "both":
                for t in genders:
                    shared[t].setdefault(field, SOCIAL_BASE[field].format(handle))
            elif g in genders:
                out[g].setdefault(field, SOCIAL_BASE[field].format(handle))
    for g in genders:
        for field, url in shared[g].items():
            out[g].setdefault(field, url)
    return out


CANDIDATES = {
    "male": ["/sports/mens-golf", "/sports/mgolf", "/sports/m-golf", "/sport/m-golf"],
    "female": ["/sports/womens-golf", "/sports/wgolf", "/sports/w-golf", "/sport/w-golf"],
}


def probe_paths(base, gender, single):
    paths = CANDIDATES[gender] + (["/sports/golf"] if single else [])
    for p in paths:
        try:
            final, status, html = fetch.get(base.rstrip("/") + p)
        except fetch.Blocked:
            continue
        if status == 200 and "golf" in html.lower():
            return sport_root(final, gender) or final.rstrip("/")
    return None


def discover(athletics_url, genders):
    try:
        final, status, html = fetch.get(athletics_url)
    except fetch.Blocked:
        return {"home_status": None, "robots_blocked": True, "programs": {}}
    res = {"home_status": status, "home_url": final, "bot_wall": fetch.is_bot_wall(status, html), "programs": {}}
    if status != 200:
        return res
    ls = links(html, final)
    host = urlsplit(final).netloc.replace("www.", "")
    for g in genders:
        rx = MEN if g == "male" else WOMEN
        roots = [sport_root(l, g) for l in ls if rx.search(l)]
        if len(genders) == 1:  # schools with one golf team often use /sports/golf
            roots += [sport_root(l, g) for l in ls if re.search(r"/sports?/golf\b", l)]
        roots = [r for r in roots if r]
        # prefer the athletics site's own host
        roots.sort(key=lambda r: (host not in r, len(r)))
        url = roots[0] if roots else probe_paths(f"https://{urlsplit(final).netloc}", g, len(genders) == 1)
        res["programs"][g] = {"golf_url": url}
    for g, soc in socials(ls, genders).items():
        res["programs"].setdefault(g, {}).update(soc)
    return res
