"""Hometown string -> ISO 3166-1 alpha-2 country (US for US states / AP abbreviations)."""
import re

US_STATES = """Alabama Ala. AL|Alaska AK|Arizona Ariz. AZ|Arkansas Ark. AR|California Calif. Cal. CA|Colorado Colo. CO|
Connecticut Conn. CT|Delaware Del. DE|Florida Fla. FL|Georgia Ga. GA|Hawaii HI|Idaho ID|Illinois Ill. IL|Indiana Ind. IN|
Iowa IA|Kansas Kan. Kans. KS|Kentucky Ky. KY|Louisiana La. LA|Maine Me. ME|Maryland Md. MD|Massachusetts Mass. MA|
Michigan Mich. MI|Minnesota Minn. MN|Mississippi Miss. MS|Missouri Mo. MO|Montana Mont. MT|Nebraska Neb. Nebr. NE|
Nevada Nev. NV|New Hampshire N.H. NH|New Jersey N.J. NJ|New Mexico N.M. N.Mex. NM|New York N.Y. NY|North Carolina N.C. NC|
North Dakota N.D. N.Dak. ND|Ohio OH|Oklahoma Okla. OK|Oregon Ore. Oreg. OR|Pennsylvania Pa. Penn. PA|Rhode Island R.I. RI|
South Carolina S.C. SC|South Dakota S.D. S.Dak. SD|Tennessee Tenn. TN|Texas Tex. TX|Utah UT|Vermont Vt. VT|Virginia Va. VA|
Washington Wash. WA|West Virginia W.Va. W.V. WV|Wisconsin Wis. Wisc. WI|Wyoming Wyo. WY|District of Columbia D.C. DC|
Puerto Rico P.R. PR|Guam GU|U.S. Virgin Islands USVI"""
US = set()
for row in US_STATES.replace("\n", "").split("|"):
    parts = row.strip().split(" ")
    # multi-word names: everything before the first abbreviation-looking token
    full = []
    for p in parts:
        if p.endswith(".") or p.isupper():
            US.add(p.lower())
        else:
            full.append(p)
    US.add(" ".join(full).lower())
US |= {"usa", "u.s.a.", "united states", "us", "u.s."}

COUNTRIES = {
    "JP": "japan", "KR": "korea|south korea|republic of korea", "CN": "china|people's republic of china",
    "TW": "taiwan|chinese taipei", "HK": "hong kong", "TH": "thailand", "PH": "philippines", "MY": "malaysia",
    "SG": "singapore", "ID": "indonesia", "VN": "vietnam", "IN": "india", "AU": "australia", "NZ": "new zealand",
    "CA": "canada|ontario|ont.|british columbia|b.c.|alberta|alta.|quebec|que.|manitoba|man.|saskatchewan|sask.|nova scotia|n.s.|new brunswick|n.b.|newfoundland|prince edward island|p.e.i.|on|bc|ab|qc|mb|sk|ns|nb|nl|pe",
    "MX": "mexico|méxico", "GB": "england|scotland|wales|northern ireland|united kingdom|u.k.|uk|great britain",
    "IE": "ireland|republic of ireland", "FR": "france", "DE": "germany", "ES": "spain", "IT": "italy", "PT": "portugal",
    "NL": "netherlands|the netherlands|holland", "BE": "belgium", "CH": "switzerland", "AT": "austria", "SE": "sweden",
    "NO": "norway", "DK": "denmark", "FI": "finland", "IS": "iceland", "PL": "poland", "CZ": "czech republic|czechia",
    "SK": "slovakia", "SI": "slovenia", "HU": "hungary", "HR": "croatia", "RS": "serbia", "GR": "greece", "TR": "turkey|türkiye|turkiye",
    "RU": "russia", "UA": "ukraine", "EE": "estonia", "LV": "latvia", "LT": "lithuania", "LU": "luxembourg", "MT": "malta",
    "CY": "cyprus", "BG": "bulgaria", "RO": "romania", "IL": "israel", "AE": "united arab emirates|uae|dubai",
    "SA": "saudi arabia", "QA": "qatar", "ZA": "south africa", "ZW": "zimbabwe", "NA": "namibia", "KE": "kenya",
    "NG": "nigeria", "EG": "egypt", "MA": "morocco", "AR": "argentina", "BR": "brazil", "CL": "chile", "CO": "colombia",
    "PE": "peru", "VE": "venezuela", "EC": "ecuador", "UY": "uruguay", "PY": "paraguay", "BO": "bolivia",
    "PA": "panama", "CR": "costa rica", "GT": "guatemala", "SV": "el salvador", "HN": "honduras", "NI": "nicaragua",
    "DO": "dominican republic", "JM": "jamaica", "BS": "bahamas|the bahamas", "BB": "barbados", "TT": "trinidad and tobago|trinidad",
    "BM": "bermuda", "KY": "cayman islands", "AW": "aruba", "CW": "curacao|curaçao", "PK": "pakistan", "LK": "sri lanka",
    "BD": "bangladesh", "NP": "nepal", "FJ": "fiji", "MU": "mauritius", "ZM": "zambia", "UG": "uganda", "GH": "ghana", "KZ": "kazakhstan", "RE": "réunion|reunion", "UZ": "uzbekistan",
}
LOOKUP = {}
for code, names in COUNTRIES.items():
    for n in names.split("|"):
        LOOKUP[n] = code


def country(hometown):
    if not hometown:
        return None
    parts = [p.strip().strip(".").lower() for p in re.split(r"[,/]", hometown) if p.strip()]
    raw = [p.strip().lower() for p in re.split(r"[,/]", hometown) if p.strip()]
    for p, r in zip(reversed(parts), reversed(raw)):
        if r in LOOKUP or p in LOOKUP:
            return LOOKUP.get(r) or LOOKUP.get(p)
        if r in US or p in US or (p + ".") in US:
            return "US"
    last = raw[-1] if raw else ""
    for n, code in LOOKUP.items():
        if re.search(r"\b" + re.escape(n) + r"\b", last):
            return code
    return None
