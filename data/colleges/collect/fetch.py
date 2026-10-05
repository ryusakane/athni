"""Polite HTTP fetcher with an on-disk cache and robots.txt checks.

Every request identifies itself as AthniDataBot, waits between requests to the same host,
and skips URLs that the host's robots.txt disallows for that user agent.
"""
import hashlib
import os
import re
import threading
import time
import urllib.robotparser
from urllib.parse import urlsplit

import requests

UA = "Mozilla/5.0 (compatible; AthniDataBot/0.1; +https://athtouni.com; ryu@athtouni.com)"
CACHE = os.environ.get("ATHNI_CACHE", os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache"))
HOST_DELAY = float(os.environ.get("ATHNI_HOST_DELAY", "1.5"))

_session = requests.Session()
_session.headers["User-Agent"] = UA
_locks: dict = {}
_last: dict = {}
_robots: dict = {}
_glock = threading.Lock()


class Blocked(Exception):
    pass


def _host_lock(host):
    with _glock:
        return _locks.setdefault(host, threading.Lock())


def robots_ok(url):
    parts = urlsplit(url)
    base = f"{parts.scheme}://{parts.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            r = _session.get(base + "/robots.txt", timeout=20)
            rp.parse(r.text.splitlines() if r.status_code == 200 else [])
        except requests.RequestException:
            rp.parse([])
        _robots[base] = rp
    return _robots[base].can_fetch("AthniDataBot", url)


def get(url, refresh=False):
    """Return (final_url, status, text). Cached by URL. Raises Blocked if robots.txt disallows."""
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(CACHE, key[:2], key)
    if not refresh and os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            final, status, text = fh.read().split("\n", 2)
        return final, int(status), text
    if not robots_ok(url):
        raise Blocked(url)
    host = urlsplit(url).netloc
    with _host_lock(host):
        wait = _last.get(host, 0) + HOST_DELAY - time.time()
        if wait > 0:
            time.sleep(wait)
        try:
            r = _session.get(url, timeout=40)
            final, status, text = r.url, r.status_code, r.text
        except requests.RequestException as e:
            final, status, text = url, 0, str(e)
        _last[host] = time.time()
    if status in (0, 403, 429) or status >= 500:
        return final, status, text  # don't cache transient failures
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"{final}\n{status}\n{text}")
    return final, status, text


def is_bot_wall(status, text):
    return status == 403 and ("Incapsula" in text or "_Incapsula_Resource" in text or "cf-chl" in text)


def norm_url(u):
    u = (u or "").strip()
    if not u:
        return None
    u = re.sub(r"^(https?:)?//", "", u)
    u = re.sub(r"/(index\.(aspx|html))?$", "", u)
    return "https://" + u
