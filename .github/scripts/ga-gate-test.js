// Runs the GA gate from index.html and 404.html in a stub browser and checks that gtag.js is
// requested only on the public, signed-out root view AFTER opt-in ('actm.analytics.consent' = 'granted'),
// never with Global Privacy Control or Do Not Track ('1'/'yes'), never before a choice or after "No thanks",
// never on signed-in views, app paths or sign-in return URLs, that Google signals / ad personalization are off,
// and that page_view and events never carry query, hash, email or user_id.
'use strict';
const fs = require('fs'), vm = require('vm');
let failed = 0;
function check(ok, msg) { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed++; }

function run(file, url, storage, nav) {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script>\s*\(function \(\) \{\s*var ID = 'G-WKF5HQXHB1'[\s\S]*?<\/script>/);
  if (!m) throw new Error(file + ': GA gate script not found');
  const code = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  const u = new URL(url);
  const loaded = [], store = Object.assign({}, storage || {});
  const fetchCalls = [];
  const win = {
    location: { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, href: u.href },
    localStorage: { get length() { return Object.keys(store).length; }, key: i => Object.keys(store)[i], getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { readyState: 'loading', addEventListener() {}, getElementById: () => null, referrer: 'https://example.com/path?x=1#y', title: 'T', head: { appendChild: s => loaded.push(s.src) }, createElement: () => ({}) },
    history: { pushState() {}, replaceState() {} },
    navigator: Object.assign({}, nav || {}), Event: function () {}, dispatchEvent() {},
    addEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() {},
    fetch: function () { fetchCalls.push(arguments); return Promise.resolve({ ok: true }); },
    URL,
  };
  win.window = win;
  vm.runInNewContext(code, win);
  return { win, loaded };
}

const PUBLIC = ['https://app.coachsalimheyaime.com/', 'https://app.coachsalimheyaime.com/?cb=1&utm_source=x', 'https://app.coachsalimheyaime.com/index.html'];
const BLOCKED = [
  'https://app.coachsalimheyaime.com/?code=abc123',
  'https://app.coachsalimheyaime.com/#access_token=abc&refresh_token=def&type=magiclink',
  'https://app.coachsalimheyaime.com/?token_hash=abc&type=magiclink',
  'https://app.coachsalimheyaime.com/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
  'https://app.coachsalimheyaime.com/day/1',
  'https://app.coachsalimheyaime.com/day/1/timer',
  'https://app.coachsalimheyaime.com/safety',
];
const GRANTED = { 'actm.analytics.consent': 'granted' };
const SESSION = { 'sb-olncfwohfpgpmygxjpcm-auth-token': JSON.stringify({ access_token: 'x', user: { id: 'u', email: 'a@b.co' } }) };

for (const file of ['index.html', '404.html']) {
  for (const url of PUBLIC) {
    const { win, loaded } = run(file, url, Object.assign({ 'sb-olncfwohfpgpmygxjpcm-auth-token-code-verifier': 'v' }, GRANTED));
    check(loaded.length === 1 && /googletagmanager\.com\/gtag\/js\?id=G-WKF5HQXHB1$/.test(loaded[0]), `${file} ${url}: gtag.js loads once`);
    const dl = win.dataLayer.map(a => Array.from(a));
    const cfg = dl.find(a => a[0] === 'config');
    check(cfg && cfg[2].send_page_view === false, `${file} ${url}: automatic page_view off`);
    check(cfg && cfg[2].allow_google_signals === false && cfg[2].allow_ad_personalization_signals === false, `${file} ${url}: Google signals and ad personalization off`);
    const pv = dl.filter(a => a[0] === 'event' && a[1] === 'page_view');
    check(pv.length === 1 && pv[0][2].page_location === 'https://app.coachsalimheyaime.com' + new URL(url).pathname && !/[?#]/.test(pv[0][2].page_referrer), `${file} ${url}: one manual page_view, no query or hash`);
    win.fetch('https://olncfwohfpgpmygxjpcm.supabase.co/auth/v1/otp?redirect_to=x', { method: 'POST', body: '{"email":"a@b.co"}' });
    const ev = win.dataLayer.map(a => Array.from(a)).filter(a => a[0] === 'event' && a[1] === 'magic_link_requested');
    check(ev.length === 1, `${file} ${url}: magic_link_requested on submit`);
    check(!/a@b\.co|user_id|"email"/.test(JSON.stringify(win.dataLayer.map(a => Array.from(a)))), `${file} ${url}: no email or user_id in dataLayer`);
  }
  for (const url of BLOCKED) {
    const { win, loaded } = run(file, url, GRANTED);
    check(loaded.length === 0 && !win.gtag && win['ga-disable-G-WKF5HQXHB1'] === true, `${file} ${url}: GA not loaded`);
  }
  for (const url of PUBLIC) {
    let r = run(file, url, {});
    check(r.loaded.length === 0 && !r.win.gtag, `${file} ${url} no choice yet: GA not loaded`);
    r = run(file, url, { 'actm.analytics.consent': 'denied' });
    check(r.loaded.length === 0 && !r.win.gtag, `${file} ${url} declined: GA not loaded`);
    for (const [label, nav] of [['GPC on', { globalPrivacyControl: true }], ["DNT '1'", { doNotTrack: '1' }], ["DNT 'yes'", { doNotTrack: 'yes' }]]) {
      r = run(file, url, GRANTED, nav);
      check(r.loaded.length === 0 && !r.win.gtag && r.win['ga-disable-G-WKF5HQXHB1'] === true, `${file} ${url} ${label} (even with consent granted): GA not loaded`);
    }
  }
  for (const url of PUBLIC) {
    const { win, loaded } = run(file, url, Object.assign({}, SESSION, GRANTED));
    check(loaded.length === 0 && !win.gtag, `${file} ${url} signed in: GA not loaded`);
  }
}
if (failed) { console.log(failed + ' check(s) failed'); process.exit(1); }
console.log('all GA gate checks passed');
