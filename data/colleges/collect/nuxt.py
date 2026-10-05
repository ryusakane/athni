"""Decode Nuxt 3 payloads (<script id="__NUXT_DATA__">, devalue format) used by WMT Digital athletics sites."""
import json
import re

SPECIAL = {-1: None, -2: None, -3: float("nan"), -4: float("inf"), -5: float("-inf"), -6: 0}


def decode(text):
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', text, re.S)
    if not m:
        return None
    arr = json.loads(m.group(1))
    memo = {}

    def hyd(i, depth=0):
        if isinstance(i, int) and i < 0:
            return SPECIAL.get(i)
        if i in memo:
            return memo[i]
        v = arr[i]
        if isinstance(v, list):
            if v and isinstance(v[0], str) and v[0] in ("Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "Set", "Map", "Date", "NuxtError", "Object", "BigInt", "RegExp"):
                if v[0] in ("Reactive", "ShallowReactive", "Ref", "ShallowRef"):
                    out = hyd(v[1], depth + 1)
                elif v[0] == "Set":
                    out = [hyd(x, depth + 1) for x in v[1:]]
                elif v[0] == "Map":
                    out = {str(hyd(v[k], depth + 1)): hyd(v[k + 1], depth + 1) for k in range(1, len(v) - 1, 2)}
                elif v[0] == "Date":
                    out = v[1]
                else:
                    out = None
                memo[i] = out
                return out
            out = []
            memo[i] = out
            out.extend(hyd(x, depth + 1) for x in v)
            return out
        if isinstance(v, dict):
            out = {}
            memo[i] = out
            for k, x in v.items():
                out[k] = hyd(x, depth + 1)
            return out
        memo[i] = v
        return v

    return hyd(0)


def walk(obj, seen=None):
    """Yield every dict in a decoded payload (cycle-safe)."""
    seen = set() if seen is None else seen
    stack = [obj]
    while stack:
        o = stack.pop()
        if id(o) in seen:
            continue
        if isinstance(o, dict):
            seen.add(id(o))
            yield o
            stack.extend(o.values())
        elif isinstance(o, list):
            seen.add(id(o))
            stack.extend(o)
