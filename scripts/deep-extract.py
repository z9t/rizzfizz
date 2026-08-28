#!/usr/bin/env python3
"""Deep HTML extract for RizzFizz --allcopy escalation.

Tries scrapely → scrapy Response+selector → stdlib html.parser.
Purpose: one script any agent can call when Node fetch/wigolo/playwright is thin.
Does not own crawl policy (RizzFizz deep-pull.ts does).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip = False

    def handle_data(self, data: str) -> None:
        if not self._skip:
            t = data.strip()
            if t:
                self._chunks.append(t)

    def text(self) -> str:
        return "\n".join(self._chunks)


def fetch(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "RizzFizzPull/0.2 (+local; polite Python extract)"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_scrapely(html: str) -> str | None:
    try:
        from scrapely import Scraper  # type: ignore
    except Exception:
        return None
    # scrapely needs training examples; probe import so escalation reports availability.
    _ = Scraper
    return None


def extract_scrapy(html: str, url: str) -> str | None:
    try:
        from scrapy.http import HtmlResponse  # type: ignore
        from scrapy.selector import Selector  # type: ignore
    except Exception:
        return None
    response = HtmlResponse(url=url, body=html.encode("utf-8"), encoding="utf-8")
    sel = Selector(response=response)
    parts = sel.css("h1::text, h2::text, p::text, li::text, footer::text").getall()
    text = "\n".join(p.strip() for p in parts if p and p.strip())
    return text or None


def extract_stdlib(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    return parser.text()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--out", help="Optional dir to write extract.json")
    args = ap.parse_args()

    try:
        html = fetch(args.url)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1

    tool = "html.parser"
    text = extract_scrapely(html)
    if text:
        tool = "scrapely"
    else:
        text = extract_scrapy(html, args.url)
        if text:
            tool = "scrapy"
        else:
            text = extract_stdlib(html)

    text = re.sub(r"\n{3,}", "\n\n", text).strip()[:200_000]
    payload = {
        "ok": True,
        "tool": tool,
        "text": text,
        "note": f"deep-extract.py via {tool} (scrapely tried first; Gallery Parser uses scrapy)",
        "chars": len(text),
    }
    if args.out:
        Path(args.out).mkdir(parents=True, exist_ok=True)
        Path(args.out, "python-extract.json").write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
