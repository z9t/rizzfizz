#!/usr/bin/env python3
"""
Gallery pipeline — reads URLs from clipboard or a file, runs design quality scorer
and designlang on each with 1.5–6s random delay. Writes results to JSONL.
"""

import sys, json, subprocess, random, time, os
from pathlib import Path

SCORER = Path(__file__).resolve().parent.parent.parent / "design-quality-scorer/score.py"
OUT_DIR = Path.home() / ".gallery-scans"
OUT_DIR.mkdir(parents=True, exist_ok=True)


import urllib.request

def resolve_url(url: str) -> str:
    """Follow redirects to get the final destination URL."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.geturl()
    except Exception:
        return url

def score_url(url: str) -> dict | None:
    """Run design quality scorer against a URL."""
    resolved = resolve_url(url)
    if resolved != url:
        print(f"  → resolved to {resolved}")
    try:
        result = subprocess.run(
            [sys.executable, str(SCORER), "--url", resolved, "--json"],
            capture_output=True, text=True, timeout=45
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout)
            data["short_url"] = url
            data["resolved_url"] = resolved
            return data
    except Exception as e:
        print(f"  scorer error: {e}")
    return None


def designlang_url(url: str) -> dict | None:
    """Run designlang extract against a URL (lightweight, no screenshots)."""
    out_dir = OUT_DIR / "designlang" / url.replace("https://", "").replace("/", "_")
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            ["npx", "designlang", url, "--no-prompts", "--no-design-md", "-o", str(out_dir)],
            capture_output=True, text=True, timeout=120
        )
        # Parse summary from stdout
        summary = {}
        for line in result.stdout.split("\n") + result.stderr.split("\n"):
            if "Colors:" in line or "Fonts:" in line or "Design Score:" in line or "Spacing:" in line:
                key, _, val = line.strip().partition(":")
                summary[key.strip()] = val.strip()
        return {"output_dir": str(out_dir), "summary": summary}
    except Exception as e:
        print(f"  designlang error: {e}")
    return None


def process(urls: list[str], delay_range=(1.5, 6.0)):
    """Run scorer on all URLs with random delays."""
    results = []
    total = len(urls)
    
    for i, url in enumerate(urls):
        delay = random.uniform(*delay_range)
        print(f"[{i+1}/{total}] {url[:70]}  (delay: {delay:.1f}s)")
        
        score = score_url(url)
        # dl = designlang_url(url)  # uncomment for full extraction
        
        entry = {
            "url": url,
            "scored_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "score": score
        }
        results.append(entry)
        
        # Append to running log immediately
        with open(OUT_DIR / "results.jsonl", "a") as f:
            f.write(json.dumps(entry) + "\n")
        
        if i < total - 1:
            time.sleep(delay)
    
    print(f"\nDone. {total} URLs scored. Results: {OUT_DIR / 'results.jsonl'}")
    
    # Summary
    scores = [r["score"]["score"] for r in results if r["score"]]
    if scores:
        print(f"  Min: {min(scores):.2%}  Max: {max(scores):.2%}  Mean: {sum(scores)/len(scores):.2%}")
    
    return results


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Read from file
        with open(sys.argv[1]) as f:
            urls = [line.strip() for line in f if line.strip() and line.startswith("http")]
    else:
        # Read from clipboard
        import subprocess
        urls = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout.strip().split("\n")
        urls = [u.strip() for u in urls if u.strip().startswith("http")]
    
    if not urls:
        print("No URLs found. Copy gallery links to clipboard first (use GrabGallery bookmarklet).")
        sys.exit(1)
    
    print(f"Processing {len(urls)} URLs...")
    process(urls)
