import json
import re
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache


WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "MiniGPT-ResearchAssistant/2.0 (local-research-assistant; Python/urllib)"
REQUEST_TIMEOUT_SECONDS = 5


def _normalize_query(query: str) -> str:
    """Convert natural-language questions into clean Wikipedia search terms."""
    cleaned = " ".join(query.strip().split())
    cleaned = re.sub(
        r"^(what\s+is|what\s+are|who\s+is|who\s+was|where\s+is|when\s+was|explain|define|tell\s+me\s+about)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = cleaned.strip(" ?!.,;:\"'")
    return cleaned or " ".join(query.strip().split())


def _clean_extract(text: str, max_chars: int = 700) -> str:
    """Trim whitespace and truncate at a sentence boundary if needed."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= max_chars:
        return cleaned

    truncated = cleaned[:max_chars]
    last_period = truncated.rfind(". ")
    if last_period > max_chars // 2:
        return truncated[: last_period + 1]
    return truncated.rstrip() + "..."


@lru_cache(maxsize=128)
def _cached_wikipedia_lookup(normalized_query: str):
    if not normalized_query:
        return None

    params = urllib.parse.urlencode({
        "action": "query",
        "generator": "search",
        "gsrsearch": normalized_query,
        "gsrlimit": 1,
        "prop": "extracts|info",
        "inprop": "url",
        "exintro": 1,
        "explaintext": 1,
        "redirects": 1,
        "format": "json",
    })
    url = f"{WIKIPEDIA_API_URL}?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            if resp.status != 200:
                print(f"[Wikipedia] HTTP {resp.status} for query={normalized_query!r}")
                return None
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError) as err:
        print(f"[Wikipedia] Request failed for query={normalized_query!r}: {err}")
        return None

    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return None

    page = next(iter(pages.values()), None)
    if not page or "missing" in page:
        return None

    extract = page.get("extract", "").strip()
    title = page.get("title", "").strip()
    page_url = page.get("fullurl", "").strip()

    if not extract or not title or not page_url:
        return None

    return {
        "response": _clean_extract(extract),
        "mode": "wikipedia",
        "match_type": "wikipedia",
        "sources": [
            {
                "type": "wikipedia",
                "title": title,
                "url": page_url,
                "attribution": "Source: Wikipedia (CC BY-SA 4.0)",
            }
        ],
    }


def search_wikipedia(query: str):
    """Search Wikipedia for a concise summary with URL and attribution."""
    normalized = _normalize_query(query)
    if not normalized:
        return None
    print(f"[Wikipedia] Searching for normalized query={normalized!r}")
    result = _cached_wikipedia_lookup(normalized)
    if result is None:
        print(f"[Wikipedia] No article found for query={normalized!r}")
    else:
        print(f"[Wikipedia] Found article: {result['sources'][0]['title']!r}")
    return result
