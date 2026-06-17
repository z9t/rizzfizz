// replay.js — injected replay script. Scrolls, picks random cards, grabs URLs.
// Called from background: chrome.scripting.executeScript({ func: replayPass })

async function replayPass(siteSel, nextSel) {
  const qs = s => s.startsWith('/') ? document.evaluate(s,document,null,9,null).singleNodeValue : document.querySelector(s);

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Scroll like a human ──
  async function humanScroll() {
    const h = document.body.scrollHeight;
    const current = window.scrollY;
    // Scroll down 40-80% of viewport, sometimes back up 10-20%
    const target = current + (window.innerHeight * (0.4 + Math.random() * 0.4));
    const final = Math.min(target, h - window.innerHeight);
    
    window.scrollTo({ top: final, behavior: 'smooth' });
    await sleep(800 + Math.random() * 1500);

    // Sometimes scroll back up a bit
    if (Math.random() < 0.3) {
      window.scrollTo({ top: final - 150 - Math.random() * 300, behavior: 'smooth' });
      await sleep(400 + Math.random() * 800);
    }
  }

  // ── Pick a random gallery card ──
  function pickCard() {
    const cards = [...document.querySelectorAll('a[href]')].filter(a => {
      try {
        const u = new URL(a.href);
        if (u.origin !== location.origin) return false;
        const p = u.pathname;
        if (p === '/' || p.startsWith('/page/') || p.startsWith('/category/') || p.startsWith('/tag/') || p.startsWith('/wp-') || p.startsWith('/cdn-')) return false;
        if (/\.(png|jpg|svg|css|js)/.test(p)) return false;
        return true;
      } catch { return false; }
    });
    if (!cards.length) return null;
    return cards[Math.floor(Math.random() * cards.length)];
  }

  // ── Main loop ──
  const visited = new Set();
  let pageClicks = 0;
  const maxClicksPerPage = 5 + Math.floor(Math.random() * 5);

  while (pageClicks < maxClicksPerPage) {
    await humanScroll();

    const card = pickCard();
    if (!card || visited.has(card.href)) {
      // Try scrolling more
      await humanScroll();
      continue;
    }

    visited.add(card.href);
    card.click();
    pageClicks++;
    
    // Return the detail page URL so background can navigate
    return { action: 'visit', url: card.href };
  }

  // All cards clicked — try next page
  const nextBtn = qs(nextSel || 'button:has(svg)');
  if (nextBtn && !nextBtn.disabled && nextBtn.offsetParent) {
    nextBtn.click();
    return { action: 'next' };
  }

  return { action: 'done' };
}

// Export for use in scripting.executeScript
if (typeof window !== 'undefined') window.__replayPass = replayPass;
