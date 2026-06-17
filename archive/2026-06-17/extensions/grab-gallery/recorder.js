// recorder.js — content script injected into every page.
// Records mouse position, scroll depth, clicks, and dwell time.
// Sends batched events to background worker every second.

const events = [];
let lastMouse = { x: 0, y: 0, t: 0 };
let lastScroll = { y: 0, t: 0 };
let pageEnter = Date.now();

// Mouse tracking (throttled)
document.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - lastMouse.t < 250) return; // throttle to 4 samples/sec
  lastMouse = { x: e.clientX, y: e.clientY, t: now };
  events.push({ type: 'mouse', x: e.clientX, y: e.clientY, t: now, w: window.innerWidth });
}, { passive: true });

// Scroll tracking
document.addEventListener('scroll', () => {
  const now = Date.now();
  if (now - lastScroll.t < 500) return;
  lastScroll = { y: window.scrollY, t: now };
  events.push({ type: 'scroll', y: window.scrollY, h: document.body.scrollHeight, t: now });
}, { passive: true });

// Click tracking
document.addEventListener('click', (e) => {
  const target = e.target;
  const tag = target.tagName?.toLowerCase() || '';
  const href = target.closest('a')?.href || '';
  const text = (target.textContent || '').trim().slice(0, 60);
  const sel = getSelector(target);
  events.push({
    type: 'click',
    x: e.clientX, y: e.clientY,
    tag, text, href, sel,
    ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey,
    button: e.button,
    t: Date.now()
  });
}, { capture: true });

// Auxclick (middle-click) — open in new tab pattern
document.addEventListener('auxclick', (e) => {
  if (e.button !== 1) return; // middle click only
  const target = e.target;
  const href = target.closest('a')?.href || '';
  events.push({
    type: 'middleclick',
    href,
    sel: getSelector(target),
    t: Date.now()
  });
}, { capture: true });

// Flush to background every second
setInterval(() => {
  if (events.length === 0) return;
  const batch = events.splice(0, events.length);
  batch.push({ type: 'dwell', ms: Date.now() - pageEnter, t: Date.now() });
  pageEnter = Date.now();
  chrome.runtime.sendMessage({ type: 'recording', events: batch, url: location.href }).catch(() => {});
}, 1000);

// Build a simple unique selector for an element
function getSelector(el) {
  if (!el || el === document.body) return 'body';
  if (el.id) return '#' + el.id;
  const tag = el.tagName.toLowerCase();
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  return tag + cls;
}
