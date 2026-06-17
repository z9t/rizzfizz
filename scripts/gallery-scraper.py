#!/usr/bin/env python3
"""
Gallery scraper — grabs real site URLs from gallery detail pages.
Supports: minimal.gallery, land-book.com (same modal button selector).
Usage: python3 gallery-scraper.py <gallery-url> [--max 50]
"""

import sys, re, json, time, random, urllib.request
from urllib.parse import urljoin, urlparse

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
SITE_BTN = 'a.btn.btn-secondary.btn-sm'  # the "Visit site" button in the modal


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")


def detail_urls_from_listing(gallery_url: str) -> list[str]:
    """Scrape detail page URLs from a gallery listing page."""
    html = fetch(gallery_url)
    base_domain = urlparse(gallery_url).netloc
    found = set()

    for match in re.finditer(r'href="(/[^"]+)"', html):
        path = match.group(1)
        if path in ("/", "") or path.startswith("/cdn-"):
            continue
        full = urljoin(gallery_url, path)
        parsed = urlparse(full)
        if parsed.netloc != base_domain:
            continue
        if "/page/" in path or "/category/" in path or "/tag/" in path:
            continue
        if path.endswith((".png", ".jpg", ".css", ".js", ".xml")):
            continue
        # Gallery detail pages typically look like /slug/ or /websites/slug
        segments = path.strip("/").split("/")
        if len(segments) in (1, 2) and segments[-1]:
            found.add(full)

    return sorted(found)


def site_url_from_detail(detail_url: str) -> str | None:
    """Extract the real site URL from a gallery detail page."""
    html = fetch(detail_url)

    # Method 1: find the modal button's href
    # The button is in a modal: #website-modal > ... > a.btn.btn-secondary.btn-sm
    # Look for href in the modal's button
    modal_links = re.findall(r'id="website-modal".*?</div>\s*</div>\s*</div>', html, re.DOTALL)
    if modal_links:
        # Find the btn-secondary inside the modal
        btn_match = re.search(r'<a[^>]*btn-secondary[^>]*href="([^"]+)"', modal_links[0] | html)
        if btn_match:
            return btn_match.group(1)

    # Method 2: look for any btn-secondary with an external link
    for m in re.finditer(r'<a[^>]*btn-secondary[^>]*href="([^"]+)"', html):
        href = m.group(1)
        if href.startswith("http") and not any(
            x in href
            for x in [urlparse(detail_url).netloc, "framer.", "shopify.", "webflow.", "stripe."]
        ):
            return href

    # Method 3: look for the trailing /visit pattern common on these galleries
    visit_match = re.search(r'href="(https?://[^"]+)"[^>]*>\s*Visit', html)
    if visit_match:
        return visit_match.group(1)

    return None


def main():
    gallery_url = sys.argv[1]
    max_sites = int(sys.argv[2]) if len(sys.argv) > 2 else 50

    print(f"Scraping listing: {gallery_url}")
    detail_urls = detail_urls_from_listing(gallery_url)
    print(f"Found {len(detail_urls)} detail pages")

    if not detail_urls:
        print("No detail pages found. Try a gallery listing URL.")
        return

    sites = []
    for i, detail_url in enumerate(detail_urls[:max_sites]):
        delay = random.uniform(0.8, 2.0)
        print(f"[{i+1}/{min(len(detail_urls), max_sites)}] {detail_url}")
        site_url = site_url_from_detail(detail_url)
        if site_url:
            print(f"  → {site_url}")
            sites.append({"gallery_detail": detail_url, "site_url": site_url})
        time.sleep(delay)

    print(f"\nExtracted {len(sites)} real site URLs")

    out_file = "/tmp/gallery-sites.txt"
    with open(out_file, "w") as f:
        for s in sites:
            f.write(s["site_url"] + "\n")
    print(f"Wrote {out_file}")


if __name__ == "__main__":
    main()
