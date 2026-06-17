// GrabGallery v0.5 — collects, records mouse/scroll/clicks, replays with jitter.
// All data in chrome.storage.local. Auto-dumps every 10 sites to clipboard.
const S = chrome.storage.local;
const load = (k, fb) => S.get(k).then(d => d[k] ?? fb);
const save = (k, v) => S.set({ [k]: v });

async function collected() { return load('collected', []); }
async function addCollected(url) {
  const list = await collected();
  list.push(url);
  await save('collected', list);
  // Auto-dump to clipboard every 10
  if (list.length % 10 === 0) await dumpToClipboard();
  return list.length;
}

async function dumpToClipboard() {
  const list = await collected();
  if (!list.length) return;
  const text = list.join('\n');
  try {
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['CLIPBOARD'], justification: 'auto-dump' });
    chrome.runtime.sendMessage({ type: 'copy', text });
  } catch {}
}

// ── Recording state ──
async function recording() { return load('recording', false); }
async function startRecording() {
  const sessions = await load('sessions', []);
  sessions.push({ id: Date.now(), events: [], start: Date.now() });
  await save('sessions', sessions);
  await save('recording', true);
  chrome.action.setBadgeText({ text: 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
}
async function stopRecording() {
  await save('recording', false);
  chrome.action.setBadgeText({ text: '' });
}

// ── Grab site URL from page ──
async function grab(tabId) {
  const siteSel = await load('siteSel', '#website-modal a.btn.btn-secondary.btn-sm');
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      const qs = s => s.startsWith('/') ? document.evaluate(s,document,null,9,null).singleNodeValue : document.querySelector(s);
      try { const el = qs(sel); if (el?.href?.startsWith('http')) { const d = new URL(el.href).hostname.replace(/^www\./,''); if (!/framer\.com|shopify\.com|webflow\.com|squarespace\.com|stripe\.com|mobbin\.com|readymag\.com/.test(d)) return el.href; } } catch {}
      for (const a of document.querySelectorAll('a[href^=http]')) {
        try { const d = new URL(a.href).hostname.replace(/^www\./,''); if (/framer\.|shopify\.|webflow\.|squarespace\.|stripe\.|mobbin\.|readymag\./.test(d)) continue; if (d===location.hostname.replace(/^www\./,'')) continue; if (href.includes('ref=')) return href; if (/\.(png|jpg|svg|css|js)(\?|$)/.test(a.href)) continue; return a.href; } catch {}
      }
      return null;
    },
    args: [siteSel]
  });
  return r?.result;
}

// ── Detail page detection ──
function isDetail(p) { return p!=='/'&&p!==''&&!p.startsWith('/page/')&&!p.startsWith('/category/')&&!p.startsWith('/tag/')&&!p.startsWith('/wp-')&&!p.startsWith('/cdn-'); }

// ── Tab visits: grab after delay ──
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url?.startsWith('http')) return;
  const p = new URL(tab.url).pathname;
  if (!isDetail(p)) return;
  const delay = 4000 + Math.random() * 8000;
  setTimeout(async () => {
    const url = await grab(tabId);
    if (url) {
      const c = await addCollected(url);
      chrome.action.setBadgeText({ text: String(c) });
      chrome.action.setBadgeBackgroundColor({ color: '#00ff00' });
    }
  }, delay);
});

// ── Icon click: dump to clipboard ──
chrome.action.onClicked.addListener(async () => {
  const rec = await recording();
  if (rec) { await stopRecording(); return; }
  await dumpToClipboard();
  const list = await collected();
  chrome.action.setBadgeText({ text: String(list.length) });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
});

// ── Messages from popup & content script ──
chrome.runtime.onMessage.addListener((msg, sender, sendR) => {
  (async () => {
    if (msg.type === 'copy') { /* offscreen handles */ sendR({ ok: true }); }
    else if (msg.type === 'status') {
      const [c, r, sessions] = await Promise.all([collected(), recording(), load('sessions',[])]);
      const last = sessions[sessions.length-1];
      sendR({ collected: c.length, recording: r, sessions: sessions.length, events: last?.events?.length || 0 });
    }
    else if (msg.type === 'startRecording') { await startRecording(); sendR({ ok: true }); }
    else if (msg.type === 'stopRecording') { await stopRecording(); sendR({ ok: true }); }
    else if (msg.type === 'recording') {
      if (!(await recording())) return;
      const sessions = await load('sessions', []);
      if (!sessions.length) return;
      sessions[sessions.length-1].events.push({ url: msg.url, batch: msg.events, t: Date.now() });
      await save('sessions', sessions);
    }
    else if (msg.type === 'clear') { await save('collected', []); chrome.action.setBadgeText({ text: '' }); sendR({ ok: true }); }
    else if (msg.type === 'replay') {
      sendR({ ok: true });
      chrome.action.setBadgeText({ text: '▶' });
      chrome.action.setBadgeBackgroundColor({ color: '#0ff' });
      replayLastSession();
    }
  })();
  return true;
});

// ── Replay engine ──
async function replayLastSession() {
  const sessions = await load('sessions', []);
  if (!sessions.length) return;
  const session = sessions[sessions.length-1];
  const visits = session.events.filter(e => e.url); // every batch carries a URL
  // For now, use the collected visited URLs
  const detailUrls = [...new Set(visits.map(e => e.url))];
  if (!detailUrls.length) return;
  
  await save('collected', []);
  const siteSel = await load('siteSel', '#website-modal a.btn.btn-secondary.btn-sm');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let count = 0;

  for (const url of detailUrls) {
    await chrome.tabs.update(tab.id, { url });
    await new Promise(r => setTimeout(r, 4000 + Math.random() * 8000));
    const siteUrl = await grab(tab.id);
    if (siteUrl) count = await addCollected(siteUrl);
    chrome.action.setBadgeText({ text: String(count) });
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 4000));
  }
  chrome.action.setBadgeBackgroundColor({ color: '#00ff00' });
}
