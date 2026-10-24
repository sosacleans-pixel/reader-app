/* Coach Salim Heyaime LLC · 22-Day / 7-Minute Workout Challenge: book-code gate (PREVIEW).
   After email sign-in, the app asks the server (rpc book_access_status) whether this account has access.
   Accounts with access (existing accounts are grandfathered, or a code was redeemed) go straight in.
   Accounts without access see "Have the book?" and enter the code printed in the paperback (rpc redeem_book_code).
   No code is stored here: the server keeps only a hash and rate limits wrong tries.
   If the server functions are not installed yet, the app stays open (no lockout). No trackers, no new origins. */
(function () {
  "use strict";
  var SB = "https://olncfwohfpgpmygxjpcm.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbmNmd29oZnBncG15Z3hqcGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzQ0ODgsImV4cCI6MjEwNzMxMDQ4OH0.rcjQ4E2oPVyth1bboHvwRFqUtwAAAkmUw1TGwF20_Uc";
  var STORE = "sb-olncfwohfpgpmygxjpcm-auth-token";
  var OK_KEY = "actm.bookgate.ok.";
  var WHERE = "page 10";                                   // where the code is printed (confirm with Book Publisher)
  var BUY = "https://www.amazon.com/dp/B0HN22P5F4";
  var SITE = "https://book.coachsalimheyaime.com/";
  var HELP = "coachsalimheyaime@gmail.com";

  var nativeFetch = window.fetch.bind(window);
  var state = { uid: null, shown: false, busy: false, checking: false, lockTimer: null };

  function session() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || "null");
      s = s && (s.currentSession || s);
      return s && s.access_token && s.user && s.user.id ? s : null;
    } catch (e) { return null; }
  }
  function rpc(name, body, s) {
    return nativeFetch(SB + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {}), cache: "no-store"
    });
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function css() {
    if (document.getElementById("bg-style")) return;
    var st = el("style", { id: "bg-style" });
    st.textContent =
      "#bg-gate{position:fixed;inset:0;z-index:2147483000;overflow:auto;background:#fff7e8;color:#1e1e1e;font-family:Lato,system-ui,sans-serif;-webkit-text-size-adjust:100%}" +
      "#bg-gate .bg-in{max-width:440px;margin:0 auto;padding:max(28px,env(safe-area-inset-top)) 22px 40px}" +
      "#bg-gate .bg-tag{display:inline-block;background:#ffc700;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:999px}" +
      "#bg-gate h1{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:40px;line-height:1.05;text-transform:uppercase;margin:18px 0 10px}" +
      "#bg-gate p{font-size:16px;line-height:1.5;margin:0 0 12px}" +
      "#bg-gate .bg-card{background:#fffdf8;border:1px solid #e6dcc0;border-radius:16px;padding:18px;margin:18px 0}" +
      "#bg-gate label{display:block;font-weight:700;font-size:14px;margin-bottom:8px}" +
      "#bg-gate input{box-sizing:border-box;width:100%;font:700 20px/1.2 Lato,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:14px;border:2px solid #1e1e1e;border-radius:12px;background:#fff;color:#1e1e1e}" +
      "#bg-gate input:focus{outline:3px solid #ffc700;outline-offset:2px}" +
      "#bg-gate button{font:700 17px Lato,system-ui,sans-serif;cursor:pointer;border-radius:999px;border:2px solid #1e1e1e}" +
      "#bg-gate .bg-go{display:block;width:100%;margin-top:12px;padding:14px;background:#ffc700;color:#1e1e1e}" +
      "#bg-gate .bg-go[disabled]{opacity:.55;cursor:default}" +
      "#bg-gate .bg-msg{min-height:22px;font-size:15px;margin:10px 0 0}" +
      "#bg-gate .bg-err{color:#bf3404;font-weight:700}" +
      "#bg-gate .bg-links a{display:block;text-align:center;text-decoration:none;font-weight:700;color:#1e1e1e;border:2px solid #1e1e1e;border-radius:999px;padding:12px;margin:10px 0;background:#fff}" +
      "#bg-gate .bg-small{font-size:14px;color:#5e584c}" +
      "#bg-gate .bg-small a{color:#1e1e1e}" +
      "#bg-gate .bg-out{background:none;border:none;padding:0;text-decoration:underline;font-size:14px;color:#1e1e1e}";
    document.head.appendChild(st);
  }
  function root() { return document.getElementById("root"); }
  function hideApp(on) {
    var r = root(); if (!r) return;
    if (on) { r.setAttribute("inert", ""); r.setAttribute("aria-hidden", "true"); }
    else { r.removeAttribute("inert"); r.removeAttribute("aria-hidden"); }
  }
  function remove() {
    var g = document.getElementById("bg-gate"); if (g) g.remove();
    hideApp(false); state.shown = false; document.documentElement.style.overflow = "";
    if (state.lockTimer) { clearInterval(state.lockTimer); state.lockTimer = null; }
  }
  function mins(sec) { var m = Math.ceil(sec / 60); return m <= 1 ? "about a minute" : (m >= 90 ? "about " + Math.round(m / 60) + " hours" : "about " + m + " minutes"); }

  function render(s, st, mode) {
    css();
    var g = document.getElementById("bg-gate");
    if (g) g.remove();
    g = el("div", { id: "bg-gate", role: "dialog", "aria-modal": "true", "aria-labelledby": "bg-h" });
    var inner = el("div", { class: "bg-in" });
    var email = (s.user.email || "").toLowerCase();
    if (mode === "checking") {
      inner.appendChild(el("p", { class: "bg-small", text: "Checking your access…" }));
    } else if (mode === "offline") {
      inner.appendChild(el("h1", { id: "bg-h", text: "You’re offline" }));
      inner.appendChild(el("p", { text: "We need a connection once to check your access. Connect to the internet and try again." }));
      var rb = el("button", { class: "bg-go", type: "button", text: "Try again" });
      rb.addEventListener("click", function () { check(true); });
      inner.appendChild(rb);
    } else {
      inner.appendChild(el("span", { class: "bg-tag", text: "A Challenge to Move" }));
      inner.appendChild(el("h1", { id: "bg-h", text: "Have the book?" }));
      inner.appendChild(el("p", { text: "This app comes with the paperback A Challenge to Move. Enter the access code from " + WHERE + " of your book to unlock all 22 days." }));
      var card = el("div", { class: "bg-card" });
      var form = el("form", { novalidate: "" });
      var input = el("input", { id: "bg-code", name: "code", type: "text", inputmode: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", maxlength: "40", placeholder: "Access code" });
      var go = el("button", { class: "bg-go", type: "submit", text: "Unlock the app" });
      var msg = el("p", { class: "bg-msg", id: "bg-msg", role: "status", "aria-live": "polite" });
      form.appendChild(el("label", { for: "bg-code", text: "Access code from " + WHERE }));
      form.appendChild(input); form.appendChild(go); form.appendChild(msg);
      card.appendChild(form);
      inner.appendChild(card);
      form.addEventListener("submit", function (ev) { ev.preventDefault(); redeem(input, go, msg); });
      if (st && st.locked) lockout(go, msg, st.retry_after_seconds);

      inner.appendChild(el("p", { style: "font-weight:700;margin-top:22px", text: "Don’t have the book yet?" }));
      inner.appendChild(el("div", { class: "bg-links" }, [
        el("a", { href: BUY, target: "_blank", rel: "noopener", "data-bg": "buy", text: "Get the paperback on Amazon" }),
        el("a", { href: SITE, target: "_blank", rel: "noopener", "data-bg": "site", text: "Visit the book site" })
      ]));
      var mail = "mailto:" + HELP + "?subject=" + encodeURIComponent("App access for my book") +
        "&body=" + encodeURIComponent("Amazon order number: \nEmail I signed in with: " + email + "\n");
      inner.appendChild(el("p", { class: "bg-small" }, [
        "No code on " + WHERE + " of your copy? Email ",
        el("a", { href: mail, "data-bg": "help", text: HELP }),
        " with your Amazon order number and we’ll unlock your account."
      ]));
      var out = el("button", { class: "bg-out", type: "button", text: "Use a different email" });
      out.addEventListener("click", function () { signOut(); });
      inner.appendChild(el("p", { class: "bg-small", style: "margin-top:18px" }, ["Signed in as " + email + ". ", out]));
    }
    g.appendChild(inner);
    document.body.appendChild(g);
    hideApp(true); state.shown = true; document.documentElement.style.overflow = "hidden";
  }

  function lockout(go, msg, sec) {
    var until = Date.now() + Math.max(1, sec || 60) * 1000;
    go.disabled = true;
    function tick() {
      var left = Math.ceil((until - Date.now()) / 1000);
      if (left <= 0) { go.disabled = false; msg.textContent = "You can try again now."; msg.className = "bg-msg"; clearInterval(state.lockTimer); state.lockTimer = null; return; }
      msg.textContent = "Too many tries. Please wait " + mins(left) + ", then try again.";
      msg.className = "bg-msg bg-err";
    }
    if (state.lockTimer) clearInterval(state.lockTimer);
    tick(); state.lockTimer = setInterval(tick, 15000);
  }

  function redeem(input, go, msg) {
    var s = session(); if (!s || state.busy) return;
    var code = (input.value || "").trim();
    if (!code) { msg.textContent = "Enter the code from " + WHERE + "."; msg.className = "bg-msg bg-err"; input.focus(); return; }
    state.busy = true; go.disabled = true; msg.textContent = "Checking…"; msg.className = "bg-msg";
    rpc("redeem_book_code", { p_code: code }, s).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, j: j }; });
    }).then(function (res) {
      state.busy = false; go.disabled = false;
      var j = res.j || {};
      if (res.status === 200 && j.ok) { localStorage.setItem(OK_KEY + s.user.id, "1"); remove(); return; }
      if (j.error === "rate_limited" || (j.error === "invalid" && j.locked)) { lockout(go, msg, j.retry_after_seconds); return; }
      if (j.error === "code_full") { msg.textContent = "This code can’t be used again. Email " + HELP + " and we’ll help."; msg.className = "bg-msg bg-err"; return; }
      if (j.error === "invalid") {
        var left = Number(j.attempts_left);
        msg.textContent = "That code didn’t work. Check it against " + WHERE + " and try again." +
          (left >= 1 && left <= 3 ? " " + left + (left === 1 ? " try" : " tries") + " left before a short wait." : "");
        msg.className = "bg-msg bg-err"; input.select(); return;
      }
      msg.textContent = "Something went wrong. Please try again."; msg.className = "bg-msg bg-err";
    }).catch(function () {
      state.busy = false; go.disabled = false;
      msg.textContent = "Couldn’t reach the server. Check your connection and try again."; msg.className = "bg-msg bg-err";
    });
  }

  function signOut() {
    var s = session();
    var done = function () { try { localStorage.removeItem(STORE); } catch (e) {} location.replace("/"); };
    if (!s) return done();
    nativeFetch(SB + "/auth/v1/logout?scope=local", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + s.access_token } })
      .then(done, done);
  }

  var tries = 0;
  function check(force) {
    var s = session();
    if (!s) { state.uid = null; if (state.shown) remove(); return; }
    if (!force && s.user.id === state.uid) return;
    state.uid = s.user.id;
    if (localStorage.getItem(OK_KEY + s.user.id) === "1") { if (state.shown) remove(); verify(s, true); return; }
    render(s, null, "checking");
    verify(s, false);
  }
  function verify(s, cached) {
    if (state.checking) return; state.checking = true;
    rpc("book_access_status", {}, s).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, j: j }; });
    }).then(function (res) {
      state.checking = false;
      if (session() == null || session().user.id !== s.user.id) return;
      var j = res.j || {};
      if (res.status === 200 && j.entitled) { tries = 0; localStorage.setItem(OK_KEY + s.user.id, "1"); if (state.shown) remove(); return; }
      if (res.status === 200 && j.signed_in && !j.entitled) { localStorage.removeItem(OK_KEY + s.user.id); render(s, j, "code"); return; }
      // Server gate not installed yet (function missing): keep the app open, as it is today.
      if (res.status === 404 || (j && j.code === "PGRST202")) { if (state.shown) remove(); return; }
      // Token expired or refreshing: try again shortly with the refreshed session.
      if ((res.status === 401 || res.status === 403) && tries++ < 5) { setTimeout(function () { state.uid = null; check(true); }, 1500); return; }
      if (!cached) render(s, null, "offline");
    }).catch(function () {
      state.checking = false;
      if (!cached) render(s, null, "offline");
    });
  }

  function start() {
    check(false);
    setInterval(function () { check(false); }, 1500);
    window.addEventListener("storage", function (e) { if (!e.key || e.key === STORE) { state.uid = null; check(true); } });
    window.addEventListener("online", function () { if (state.shown) { state.uid = null; check(true); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
