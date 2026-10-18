/* Coach Salim Heyaime LLC · 22-Day 7-Minute Workout: privacy rights add-on (unminified on purpose).
   Hooks into the built bundle from the outside, the same way reminders-*.js does:
   - consent gate before saving a day (Terms required; check-ins only with separate CHD consent)
   - consent screen on app open for any signed-in user with no consent record (existing users);
     leaving the check-in box unticked records "declined" and nulls their past check-ins under their own session
     (after a confirm step when they have saved energy, mood or reflections)
   - strips energy/mood/reflection from day_logs writes when CHD consent is not given
   - "Your account": Download my data, Withdraw consent, Delete my account and data
   - reflections hint, policy links
   Talks only to app.coachsalimheyaime.com and the project's Supabase URL. No trackers. */
(function () {
  "use strict";

  var SB = "https://olncfwohfpgpmygxjpcm.supabase.co";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbmNmd29oZnBncG15Z3hqcGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzQ0ODgsImV4cCI6MjEwNzMxMDQ4OH0.rcjQ4E2oPVyth1bboHvwRFqUtwAAAkmUw1TGwF20_Uc";
  var DELETE_FN = SB + "/functions/v1/delete-account";
  var EMAIL = "coachsalimheyaime@gmail.com";
  var BUSINESS = "Coach Salim Heyaime LLC";

  var APP_NAME = "22-Day 7-Minute Workout";
  // Bump these whenever the policy text changes; the version is stored with every consent record.
  var CHD_VERSION = "chd-2026-10-18.2-draft";
  var TERMS_VERSION = "terms-2026-10-18.2-draft";
  var LATER_KEY = "actm.consent.later"; // sessionStorage: "Decide later" hides the consent screen for this visit only
  var CHD_TEXT = "I consent to Coach Salim Heyaime LLC collecting and storing my energy, mood, and reflections to run my 22-day program";
  // The release must be conspicuous: the negligence clause is shown (and recorded) in bold caps, as in the holiday app.
  var TERMS_LEAD = "I am 18 or older and agree to the Terms of Use, including the Assumption of Risk and the Release of Liability, ";
  var TERMS_RELEASE = "WHICH COVERS CLAIMS BASED ON THE NEGLIGENCE OF COACH SALIM HEYAIME LLC";
  var TERMS_TEXT = TERMS_LEAD + TERMS_RELEASE + ".";
  var DECLINE_CONFIRM_TEXT = "This will delete your saved energy, mood and reflections. Continue?";
  var HINT = "Private notes about how today\u2019s movement went. Please don\u2019t enter medical details (diagnoses, medications, test results) or other people\u2019s information.";
  var DELETE_EMAIL_TEXT = "You can also email " + EMAIL + " to request deletion; we complete requests within 45 days.";
  var POLICY = { privacy: "/privacy/", chd: "/consumer-health-data/", terms: "/terms/" };
  var CHD_FIELDS = ["energy_before", "energy_after", "mood", "reflection"];
  var SAVE_LABELS = /^(I completed my 7 minutes|Save notes)$/;

  var initialPath = location.pathname; // captured before the app's router can redirect

  /* ---------------- helpers ---------------- */
  var nativeFetch = window.fetch.bind(window);
  var nativeSetItem = Storage.prototype.setItem;

  function lsGet(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { nativeSetItem.call(localStorage, k, JSON.stringify(v)); } catch (e) {} }
  function session() {
    try {
      var k = Object.keys(localStorage).find(function (k) { return /^sb-.*-auth-token$/.test(k); });
      if (!k) return null;
      var s = JSON.parse(localStorage.getItem(k));
      return s && s.access_token && s.user ? s : null;
    } catch (e) { return null; }
  }
  function headers(s, extra) {
    var h = { apikey: ANON, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" };
    for (var k in extra || {}) h[k] = extra[k];
    return h;
  }
  function rest(path, opts) {
    var s = session();
    if (!s) return Promise.reject(new Error("Not signed in"));
    opts = opts || {};
    return nativeFetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: headers(s, opts.headers), body: opts.body });
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "on") for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function termsLabel() { return el("span", { class: "pr-terms-label" }, [TERMS_LEAD, el("strong", { class: "pr-release", text: TERMS_RELEASE }), "."]); }
  function policyLink(key, label) { return el("a", { href: POLICY[key], target: "_blank", rel: "noopener", text: label }); }
  function fmt(iso) {
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); } catch (e) { return iso; }
  }
  function isMissingTable(status, body) {
    return status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(body || "");
  }

  /* ---------------- consent state ----------------
     Server (public.consents) is the record. localStorage keeps a copy so the gate
     works offline and before the server answers; unsynced events are retried. */
  var state = { uid: null, known: false, server: "unknown", chd: null, terms: null, loading: null };

  function localKey(uid) { return "actm.consent." + uid; }
  function readLocal(uid) { return lsGet(localKey(uid)) || { events: [] }; }
  function writeLocal(uid, v) { lsSet(localKey(uid), v); }
  function latest(events, kind) {
    var list = events.filter(function (e) { return e.kind === kind; })
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
    return list[0] || null;
  }
  function chdGranted() { return !!(state.chd && state.chd.action === "granted"); }
  function termsGranted() { return !!(state.terms && state.terms.action === "granted"); }

  function applyEvents(events) {
    state.chd = latest(events, "chd");
    state.terms = latest(events, "terms");
  }

  function loadConsent() {
    var s = session();
    var uid = s ? s.user.id : null;
    if (!uid) { state.uid = null; state.known = true; state.chd = state.terms = null; return Promise.resolve(); }
    if (state.uid === uid && state.loading) return state.loading;
    state.uid = uid;
    var local = readLocal(uid);
    applyEvents(local.events);
    if (local.events.length) state.known = true; // a local copy is enough to decide synchronously
    var p = rest("consents?select=kind,action,version,created_at&order=created_at.desc&limit=100")
      .then(function (r) {
        return r.text().then(function (t) {
          if (!r.ok) {
            state.server = isMissingTable(r.status, t) ? "missing" : "error";
            return;
          }
          state.server = "ok";
          var serverEvents = JSON.parse(t || "[]").map(function (e) { e.synced = true; return e; });
          var pending = local.events.filter(function (e) { return !e.synced; });
          var merged = serverEvents.concat(pending);
          writeLocal(uid, { events: merged });
          applyEvents(merged);
          return Promise.all(pending.map(pushEvent));
        });
      })
      .catch(function () { state.server = "error"; })
      .then(function () { state.known = true; refresh(); });
    state.loading = p;
    return p;
  }
  function ready() {
    var s = session();
    if (!s) return Promise.resolve();
    if (state.uid !== s.user.id || !state.loading) loadConsent();
    if (state.known) return Promise.resolve();
    return Promise.race([state.loading, new Promise(function (res) { setTimeout(res, 4000); })]).then(function () { state.known = true; });
  }

  function pushEvent(ev) {
    var row = { user_id: state.uid, kind: ev.kind, action: ev.action, version: ev.version, consent_text: ev.consent_text, client_created_at: ev.created_at };
    return rest("consents", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) })
      .then(function (r) {
        return r.text().then(function (t) {
          if (r.ok) {
            state.server = "ok";
            var saved = (JSON.parse(t || "[]")[0]) || {};
            ev.synced = true;
            if (saved.created_at) ev.server_created_at = saved.created_at;
          } else if (isMissingTable(r.status, t)) state.server = "missing";
          else state.server = "error";
        });
      })
      .catch(function () { state.server = "error"; })
      .then(function () {
        var local = readLocal(state.uid);
        local.events = local.events.map(function (e) { return e.id === ev.id ? ev : e; });
        writeLocal(state.uid, local);
        refresh();
      });
  }

  function record(kind, action) {
    var s = session();
    if (!s) return Promise.resolve();
    state.uid = s.user.id;
    var ev = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      kind: kind, action: action,
      version: kind === "chd" ? CHD_VERSION : TERMS_VERSION,
      consent_text: kind === "chd" ? CHD_TEXT : TERMS_TEXT,
      created_at: new Date().toISOString(), synced: false
    };
    var local = readLocal(state.uid);
    local.events.push(ev);
    writeLocal(state.uid, local);
    applyEvents(local.events);
    state.known = true;
    refresh();
    return pushEvent(ev);
  }

  /* ---------------- data guards ----------------
     1) Every write to day_logs (insert/upsert/update) loses the CHD columns unless consent is granted.
     2) The local log cache (actm.logs.<uid>) drops them too, so nothing unsent lingers on the device. */
  function stripRow(row) {
    if (!row || typeof row !== "object") return row;
    CHD_FIELDS.forEach(function (f) { if (f in row) row[f] = null; });
    return row;
  }
  function stripBody(body) {
    try {
      var d = JSON.parse(body);
      d = Array.isArray(d) ? d.map(stripRow) : stripRow(d);
      return JSON.stringify(d);
    } catch (e) { return body; }
  }
  // Check-in values the server already holds, by calendar date (read from the app's own day_logs reads).
  // While a user hasn't decided yet, the device copy may keep these, but nothing new.
  var serverChd = {};
  function rememberServerRows(text) {
    try {
      var rows = JSON.parse(text);
      if (!Array.isArray(rows)) return;
      rows.forEach(function (r) {
        if (r && r.calendar_date) serverChd[r.calendar_date] = { energyBefore: r.energy_before, energyAfter: r.energy_after, mood: r.mood, reflection: r.reflection || "" };
      });
    } catch (e) {}
  }
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (url.indexOf(SB + "/rest/v1/day_logs") === 0 && method === "GET") {
        return nativeFetch(input, init).then(function (r) {
          if (!r.ok) return r;
          return r.clone().text().then(function (t) { rememberServerRows(t); return r; }, function () { return r; });
        });
      }
      if (url.indexOf(SB + "/rest/v1/day_logs") === 0 && /^(POST|PATCH|PUT)$/.test(method) && init && typeof init.body === "string") {
        return ready().then(function () {
          if (!chdGranted()) init = Object.assign({}, init, { body: stripBody(init.body) });
          return nativeFetch(input, init);
        });
      }
    } catch (e) {}
    return nativeFetch(input, init);
  };
  // keepServer: undecided users keep what the server already has (until they decline or the 30 days run out),
  // but nothing new. Declined / withdrawn: everything goes.
  function stripLocalLogs(raw, keepServer) {
    try {
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return raw;
      return JSON.stringify(list.map(function (l) {
        var srv = keepServer && serverChd[l.calendarDate];
        l.energyBefore = srv ? srv.energyBefore : null; l.energyAfter = srv ? srv.energyAfter : null;
        l.mood = srv ? srv.mood : null; l.reflection = srv ? srv.reflection : "";
        return l;
      }));
    } catch (e) { return raw; }
  }
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage && /^actm\.logs\./.test(String(k)) && state.known && state.uid && !chdGranted()) {
      v = stripLocalLogs(String(v), !state.chd);
    }
    return nativeSetItem.call(this, k, v);
  };
  function scrubLocalLogsNow() {
    Object.keys(localStorage).forEach(function (k) {
      if (/^actm\.logs\./.test(k)) nativeSetItem.call(localStorage, k, stripLocalLogs(localStorage.getItem(k)));
    });
  }

  /* Block the save buttons (capture phase, before React sees the click) until Terms are accepted. */
  window.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("button");
    if (b && b.closest('[data-pr="gate"]')) return;
    if (!b || !SAVE_LABELS.test(b.textContent.trim())) return;
    if (session() && !termsGranted()) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      var card = document.querySelector(".pr-consent");
      if (card) { card.classList.add("pr-shake"); setTimeout(function () { card.classList.remove("pr-shake"); }, 500); card.scrollIntoView({ block: "center", behavior: "smooth" }); }
    }
  }, true);

  /* ---------------- consent card (day page + end-of-workout screen) ---------------- */
  function buildCard() {
    var terms = el("input", { type: "checkbox", "data-k": "terms", id: "pr-terms" });
    var chd = el("input", { type: "checkbox", "data-k": "chd", id: "pr-chd" });
    terms.addEventListener("change", function () { if (terms.checked) record("terms", "granted"); });
    chd.addEventListener("change", function () { if (chd.checked) record("chd", "granted"); });
    return el("div", { class: "pr-consent", "data-pr": "card" }, [
      el("p", { class: "pr-eyebrow", text: "Before you keep a day" }),
      el("div", { class: "pr-row pr-row-terms" }, [
        el("label", { class: "pr-check", for: "pr-terms" }, [terms, termsLabel()]),
        el("p", { class: "pr-small" }, ["Required to keep days. Read the ", policyLink("terms", "Terms of Use"), "."]),
        el("p", { class: "pr-need", role: "alert", text: "Tick this box to keep today." })
      ]),
      el("div", { class: "pr-row pr-row-chd" }, [
        el("label", { class: "pr-check", for: "pr-chd" }, [chd, el("span", { text: CHD_TEXT })]),
        el("p", { class: "pr-small" }, [
          "Optional. Your energy and mood ratings and reflections are stored with your account on Supabase\u2019s servers, only to show them back to you here. Never sold or used for advertising. Withdraw or delete them any time in Your account. ",
          policyLink("chd", "Consumer Health Data Privacy Policy")
        ]),
        el("p", { class: "pr-small pr-off", text: "Without this box ticked you can still keep the day. Energy, mood and reflection stay off and are saved blank." })
      ])
    ]);
  }
  function syncCard(card) {
    var t = termsGranted(), c = chdGranted();
    card.querySelector(".pr-row-terms").hidden = t;
    card.querySelector(".pr-row-chd").hidden = c;
    card.hidden = t && c;
    card.querySelector(".pr-eyebrow").hidden = t;
  }

  /* ---------------- Your account panel ---------------- */
  function consentStatusText() {
    if (!state.known) return "Checking your consent record\u2026";
    var where = state.server === "ok" ? "saved on our server" : state.server === "missing" ? "saved on this device only (server record not set up yet)" : "saved on this device; will sync to the server";
    var parts = [];
    if (chdGranted()) parts.push("Check-ins: consent given " + fmt(state.chd.server_created_at || state.chd.created_at));
    else if (state.chd && state.chd.action === "declined") parts.push("Check-ins: declined " + fmt(state.chd.server_created_at || state.chd.created_at));
    else if (state.chd) parts.push("Check-ins: consent withdrawn " + fmt(state.chd.server_created_at || state.chd.created_at));
    else parts.push("Check-ins: off (no consent given)");
    if (termsGranted()) parts.push("Terms accepted " + fmt(state.terms.server_created_at || state.terms.created_at));
    return parts.join(". ") + (state.chd || state.terms ? " (" + where + ")." : ".");
  }

  function buildPanel() {
    var flow = el("div", { class: "pr-flow", "aria-live": "polite" });
    var status = el("p", { class: "pr-status" });
    var panel = el("section", { class: "pr-panel", "data-pr": "panel", "aria-label": "Your data and privacy" }, [
      el("h3", { class: "pr-h", text: "Your data and privacy" }),
      status,
      el("button", { type: "button", class: "pr-btn pr-btn-outline", "data-a": "download", text: "Download my data", on: { click: function () { downloadData(flow); } } }),
      el("button", { type: "button", class: "pr-btn pr-btn-outline", "data-a": "withdraw", text: "Withdraw consent", on: { click: function () { withdrawFlow(flow); } } }),
      el("button", { type: "button", class: "pr-btn pr-btn-danger", "data-a": "delete", text: "Delete my account and data", on: { click: function () { deleteFlow(flow); } } }),
      el("p", { class: "pr-small", text: DELETE_EMAIL_TEXT }),
      flow,
      el("p", { class: "pr-links" }, [policyLink("privacy", "Privacy Policy"), " \u00b7 ", policyLink("chd", "Consumer Health Data Privacy Policy"), " \u00b7 ", policyLink("terms", "Terms of Use")])
    ]);
    panel._status = status;
    return panel;
  }

  function msg(flow, cls, text) { flow.innerHTML = ""; var p = el("p", { class: "pr-msg " + (cls || ""), text: text }); flow.appendChild(p); return p; }

  /* Null energy/mood/reflection in every day_logs row of the signed-in user (RLS limits it to their own rows). */
  function nullServerCheckins() {
    var s = session();
    if (!s) return Promise.reject(new Error("Not signed in"));
    var body = JSON.stringify({ energy_before: null, energy_after: null, mood: null, reflection: null });
    return rest("day_logs?user_id=eq." + encodeURIComponent(s.user.id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: body });
  }

  /* ---------------- consent screen on app open (no consent record yet) ---------------- */
  function hadLocalCheckins() {
    var s = session();
    var logs = s ? lsGet("actm.logs." + s.user.id) : null;
    return Array.isArray(logs) && logs.length > 0;
  }
  // Energy, mood or reflections the user has saved (device copy or what the server returned).
  function hasValue(v) { return v !== null && v !== undefined && String(v).trim() !== ""; }
  function hasSavedCheckins() {
    var s = session();
    var logs = s ? lsGet("actm.logs." + s.user.id) : null;
    var local = Array.isArray(logs) && logs.some(function (l) { return l && (hasValue(l.energyBefore) || hasValue(l.energyAfter) || hasValue(l.mood) || hasValue(l.reflection)); });
    var server = Object.keys(serverChd).some(function (d) { var r = serverChd[d]; return hasValue(r.energyBefore) || hasValue(r.energyAfter) || hasValue(r.mood) || hasValue(r.reflection); });
    return local || server;
  }
  function needsGate() {
    if (!session() || !state.known || state.chd || state.terms) return false;
    if (/^\/(privacy|consumer-health-data|terms|unsubscribe)\//.test(initialPath.replace(/\/?$/, "/"))) return false;
    try { if (sessionStorage.getItem(LATER_KEY)) return false; } catch (e) {}
    return true;
  }
  var GATE_TEXT = {
    existing: { h: "We\u2019ve updated our privacy policies", lead: "Please make two choices before your next check-in. Read the ",
      warn: "If you leave the check-in box unticked, the energy, mood and reflections you saved before are deleted when you continue. If you don\u2019t choose within 30 days of our email notice, we delete them then. Your kept days stay either way." },
    fresh: { h: "Before you start", lead: "Two choices before you keep your first day. Read the ",
      warn: "Without the check-in box you can still keep your days. Energy, mood and reflection stay off." }
  };
  function syncGate(gate) {
    var t = GATE_TEXT[hadLocalCheckins() ? "existing" : "fresh"];
    gate.querySelector(".pr-gate-h").textContent = t.h;
    gate.querySelector(".pr-gate-lead").firstChild.textContent = t.lead;
    gate.querySelector(".pr-warn").textContent = t.warn;
  }
  function buildGate() {
    var existing = hadLocalCheckins();
    var terms = el("input", { type: "checkbox", id: "pr-gate-terms" });
    var chd = el("input", { type: "checkbox", id: "pr-gate-chd" });
    var go = el("button", { type: "button", class: "pr-btn pr-btn-dark", "data-a": "gate-continue", disabled: "disabled", text: "Continue" });
    var later = el("button", { type: "button", class: "pr-btn pr-btn-ghost", "data-a": "gate-later", text: "Decide later" });
    var note = el("p", { class: "pr-msg", "aria-live": "polite" });
    var warn = el("p", { class: "pr-small pr-warn", text: existing
      ? "If you leave the check-in box unticked, the energy, mood and reflections you saved before are deleted when you continue. If you don\u2019t choose within 30 days of our email notice, we delete them then. Your kept days stay either way."
      : "Without the check-in box you can still keep your days. Energy, mood and reflection stay off." });
    terms.addEventListener("change", function () { go.disabled = !terms.checked; });
    var gate = el("div", { class: "pr-gate", role: "dialog", "aria-modal": "true", "aria-labelledby": "pr-gate-h", "data-pr": "gate" }, [
      el("div", { class: "pr-gate-card" }, [
        el("p", { class: "pr-eyebrow", text: APP_NAME }),
        el("h2", { class: "pr-gate-h", id: "pr-gate-h", text: existing ? "We\u2019ve updated our privacy policies" : "Before you start" }),
        el("p", { class: "pr-small pr-gate-lead" }, [
          existing ? "Please make two choices before your next check-in. Read the " : "Two choices before you keep your first day. Read the ",
          policyLink("privacy", "Privacy Policy"), ", the ", policyLink("chd", "Consumer Health Data Privacy Policy"), " and the ", policyLink("terms", "Terms of Use"), "."
        ]),
        el("div", { class: "pr-consent pr-consent-gate" }, [
          el("div", { class: "pr-row" }, [
            el("label", { class: "pr-check", for: "pr-gate-terms" }, [terms, termsLabel()]),
            el("p", { class: "pr-small", text: "Required to keep days." })
          ]),
          el("div", { class: "pr-row" }, [
            el("label", { class: "pr-check", for: "pr-gate-chd" }, [chd, el("span", { text: CHD_TEXT })]),
            el("p", { class: "pr-small" }, [
              "Optional. Stored with your account on Supabase\u2019s servers, only to show them back to you here. Never sold or used for advertising. Withdraw or delete them any time in Your account. ",
              policyLink("chd", "Consumer Health Data Privacy Policy")
            ]),
            warn
          ])
        ]),
        note,
        el("div", { class: "pr-actions" }, [go, later])
      ])
    ]);
    later.addEventListener("click", function () {
      try { sessionStorage.setItem(LATER_KEY, "1"); } catch (e) {}
      gate.remove();
    });
    gate.addEventListener("keydown", function (e) { if (e.key === "Escape") later.click(); });
    var card = gate.querySelector(".pr-gate-card");
    // Declining check-ins with saved check-ins asks first; nothing is recorded or nulled until confirmed.
    function confirmDecline() {
      var q = el("p", { class: "pr-q", id: "pr-decline-q", text: DECLINE_CONFIRM_TEXT });
      var yes = el("button", { type: "button", class: "pr-btn pr-btn-danger", "data-a": "decline-confirm", text: "Yes, delete and continue" });
      var back = el("button", { type: "button", class: "pr-btn pr-btn-outline", "data-a": "decline-cancel", text: "Go back" });
      var box = el("div", { class: "pr-confirm-card", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "pr-decline-q" }, [q, el("div", { class: "pr-actions" }, [yes, back])]);
      var layer = el("div", { class: "pr-confirm-layer", "data-pr": "decline-confirm" }, [box]);
      function close() {
        layer.remove();
        card.removeAttribute("inert"); card.removeAttribute("aria-hidden");
      }
      back.addEventListener("click", function () { close(); go.focus(); });
      yes.addEventListener("click", function () { close(); submit(); });
      layer.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); back.click(); return; }
        if (e.key === "Tab") { // keep focus inside the two buttons
          var first = yes, last = back;
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          else if (document.activeElement !== first && document.activeElement !== last) { e.preventDefault(); first.focus(); }
        }
      });
      card.setAttribute("inert", ""); card.setAttribute("aria-hidden", "true");
      gate.appendChild(layer);
      back.focus(); // the safe choice has focus first
    }
    var submitted = false;
    go.addEventListener("click", function () {
      if (!terms.checked || submitted) return;
      if (!chd.checked && hasSavedCheckins()) { confirmDecline(); return; }
      submit();
    });
    function submit() {
      if (!terms.checked || submitted) return;
      submitted = true;
      go.disabled = true; later.disabled = true; go.textContent = "Saving\u2026";
      var granted = chd.checked;
      var jobs = [record("terms", "granted"), record("chd", granted ? "granted" : "declined")];
      if (!granted) {
        scrubLocalLogsNow();
        jobs.push(nullServerCheckins().then(function (r) { return r.ok; }).catch(function () { return false; }));
      }
      Promise.all(jobs).then(function (res) {
        if (!granted && res[2] === false) {
          note.className = "pr-msg pr-err";
          note.textContent = "Your choices are saved. We couldn\u2019t reach the server to delete your earlier check-ins just now; they\u2019ll be deleted automatically within a day.";
          go.textContent = "Close"; go.disabled = false;
          go.onclick = function () { gate.remove(); };
          return;
        }
        gate.remove();
        refresh();
      });
    }
    return gate;
  }

  function withdrawFlow(flow) {
    var was = chdGranted();
    var done = was ? record("chd", "withdrawn") : Promise.resolve();
    scrubLocalLogsNow(); // nothing unsent with check-ins stays on this device
    flow.innerHTML = "";
    flow.appendChild(el("p", { class: "pr-msg", text: was
      ? "Consent withdrawn. We\u2019ve stopped collecting energy, mood and reflections. New days are saved without them."
      : "Check-ins are already off. Nothing new is being collected." }));
    flow.appendChild(el("p", { class: "pr-q", text: "Also delete the check-ins you\u2019ve already saved?" }));
    var yes = el("button", { type: "button", class: "pr-btn pr-btn-outline", text: "Yes, delete my saved check-ins" });
    var no = el("button", { type: "button", class: "pr-btn pr-btn-ghost", text: "No, keep them" });
    var del = el("button", { type: "button", class: "pr-btn pr-btn-danger", text: "Delete my account and data instead" });
    yes.addEventListener("click", function () {
      yes.disabled = true; yes.textContent = "Deleting check-ins\u2026";
      done.then(nullServerCheckins).then(function (r) {
        msg(flow, r.ok ? "" : "pr-err", r.ok ? "Your saved check-ins are deleted. Your kept days stay on the calendar." : "We couldn\u2019t reach the server, so your saved check-ins weren\u2019t deleted. Try again, or email " + EMAIL + ".");
      }).catch(function () { msg(flow, "pr-err", "We couldn\u2019t reach the server, so your saved check-ins weren\u2019t deleted. Try again, or email " + EMAIL + "."); });
    });
    no.addEventListener("click", function () { msg(flow, "", "Your saved check-ins are kept. You can delete them, or your whole account, any time."); });
    del.addEventListener("click", function () { deleteFlow(flow); });
    flow.appendChild(el("div", { class: "pr-actions" }, [yes, no, del]));
  }

  function deleteFlow(flow) {
    flow.innerHTML = "";
    var input = el("input", { type: "text", class: "pr-input", id: "pr-confirm", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-describedby": "pr-confirm-help", placeholder: "DELETE" });
    var go = el("button", { type: "button", class: "pr-btn pr-btn-danger", disabled: "disabled", text: "Permanently delete everything" });
    var cancel = el("button", { type: "button", class: "pr-btn pr-btn-ghost", text: "Cancel", on: { click: function () { flow.innerHTML = ""; } } });
    input.addEventListener("input", function () { go.disabled = input.value.trim() !== "DELETE"; });
    flow.appendChild(el("div", { class: "pr-confirm" }, [
      el("p", { class: "pr-q", text: "Delete your account and all your data?" }),
      el("p", { class: "pr-small", id: "pr-confirm-help", text: "This permanently deletes your account, kept days, check-ins and reflections, streaks, reminder settings, push subscriptions, consent records and profile. It can\u2019t be undone. Type DELETE to confirm." }),
      el("label", { class: "pr-label", for: "pr-confirm", text: "Type DELETE" }),
      input,
      el("div", { class: "pr-actions" }, [go, cancel])
    ]));
    go.addEventListener("click", function () {
      if (input.value.trim() !== "DELETE") return;
      var s = session();
      if (!s) { msg(flow, "pr-err", "You\u2019re signed out. Sign in again, then try again."); return; }
      go.disabled = true; go.textContent = "Deleting\u2026"; cancel.disabled = true;
      nativeFetch(DELETE_FN, { method: "POST", headers: headers(s), body: JSON.stringify({ confirm: "DELETE" }) })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = {}; try { j = JSON.parse(t); } catch (e) {}
            if (r.ok && j.ok) return finishDeletion(flow);
            if (r.status === 401) return msg(flow, "pr-err", "Your sign-in has expired. Sign out, sign back in, and try again. Nothing was deleted.");
            if (r.status === 404) return unavailable(flow);
            msg(flow, "pr-err", "Deletion didn\u2019t finish (" + (j.error || ("error " + r.status)) + "). Please try again, or email " + EMAIL + " and we\u2019ll delete your account within 45 days.");
          });
        })
        .catch(function () { unavailable(flow); });
    });
    input.focus();
  }
  function unavailable(flow) {
    msg(flow, "pr-err", "Account deletion isn\u2019t available right now, so nothing was deleted. Please email " + EMAIL + " to request deletion; we complete requests within 45 days.");
  }
  function finishDeletion(flow) {
    msg(flow, "pr-ok", "Your account and data are deleted. Signing you out\u2026");
    var unsub = Promise.resolve();
    try {
      if ("serviceWorker" in navigator) {
        unsub = navigator.serviceWorker.getRegistration().then(function (reg) {
          return reg && reg.pushManager ? reg.pushManager.getSubscription() : null;
        }).then(function (sub) { return sub ? sub.unsubscribe() : null; }).catch(function () {});
      }
    } catch (e) {}
    function wipe() {
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (/^actm[.-]/.test(k) || /^sb-/.test(k) || /^supabase\./.test(k)) localStorage.removeItem(k);
        });
        sessionStorage.clear();
      } catch (e) {}
    }
    return unsub.then(function () {
      wipe();
      // wipe again right before leaving: the reminders script may rewrite its cache in between
      setTimeout(function () { wipe(); location.replace("/"); }, 2500);
    });
  }

  function downloadData(flow) {
    var s = session();
    if (!s) { msg(flow, "pr-err", "Sign in first."); return; }
    var uid = s.user.id;
    msg(flow, "", "Preparing your file\u2026");
    var q = {
      profile: "profiles?select=*&id=eq." + uid,
      day_logs: "day_logs?select=*&user_id=eq." + uid + "&order=calendar_date.asc",
      streaks: "streaks?select=*&user_id=eq." + uid,
      workout_prefs: "workout_prefs?select=*&user_id=eq." + uid,
      push_subscriptions: "push_subscriptions?select=endpoint,created_at&user_id=eq." + uid,
      consents: "consents?select=kind,action,version,consent_text,created_at,client_created_at&user_id=eq." + uid + "&order=created_at.asc"
    };
    var out = {
      export_format: "22-day-app-export/1",
      exported_at: new Date().toISOString(),
      provider: BUSINESS,
      app: APP_NAME + " (app.coachsalimheyaime.com)",
      account: { user_id: uid, email: s.user.email || null, created_at: s.user.created_at || null },
      errors: {}
    };
    var keys = Object.keys(q);
    Promise.all(keys.map(function (k) {
      return rest(q[k]).then(function (r) {
        return r.text().then(function (t) {
          if (r.ok) { out[k] = JSON.parse(t || "[]"); }
          else { out[k] = []; out.errors[k] = isMissingTable(r.status, t) ? "table not set up" : "error " + r.status; }
        });
      }).catch(function () { out[k] = []; out.errors[k] = "network error"; });
    })).then(function () {
      out.this_device = { consent_record: readLocal(uid).events, cached_day_logs: lsGet("actm.logs." + uid) || [] };
      if (!Object.keys(out.errors).length) delete out.errors;
      var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      var a = el("a", { href: URL.createObjectURL(blob), download: "22-day-my-data-" + new Date().toISOString().slice(0, 10) + ".json" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      msg(flow, out.errors ? "pr-err" : "pr-ok", out.errors
        ? "Downloaded, but some parts couldn\u2019t be read: " + Object.keys(out.errors).map(function (k) { return k + " (" + out.errors[k] + ")"; }).join(", ") + "."
        : "Downloaded. The JSON file has everything stored with your account.");
    });
  }

  /* ---------------- DOM wiring ---------------- */
  function legalNav() {
    return el("nav", { class: "pr-legal", "aria-label": "Legal", "data-pr": "legal" }, [
      policyLink("privacy", "Privacy Policy"), el("span", { "aria-hidden": "true", text: " \u00b7 " }),
      policyLink("chd", "Consumer Health Data Privacy Policy"), el("span", { "aria-hidden": "true", text: " \u00b7 " }),
      policyLink("terms", "Terms of Use"),
      el("p", { text: "\u00a9 " + BUSINESS })
    ]);
  }

  var lastUid = null;
  function refresh() {
    var s = session();
    var uid = s ? s.user.id : null;
    if (uid !== lastUid) { lastUid = uid; state.loading = null; state.known = false; if (uid) loadConsent(); }

    // Consent screen for signed-in users with no consent record (existing users on their next open)
    var gate = document.querySelector('[data-pr="gate"]');
    if (needsGate()) {
      if (!gate) { gate = buildGate(); document.body.appendChild(gate); var f = gate.querySelector("input"); if (f) f.focus(); }
      syncGate(gate);
    } else if (gate && !gate.contains(document.activeElement) && (state.chd || state.terms || !session())) gate.remove();

    // Account dialog
    document.querySelectorAll('[role="dialog"]').forEach(function (d) {
      var h = d.querySelector("h2");
      var title = h ? h.textContent.trim() : "";
      var panel = d.querySelector('[data-pr="panel"]');
      if (title === "Your account") {
        if (!panel) { panel = buildPanel(); d.appendChild(panel); }
        panel.hidden = false;
        panel._status.textContent = consentStatusText();
      } else if (panel) panel.hidden = true;
    });

    // Reflection hint + check-in inputs + consent card
    var ta = document.getElementById("reflection");
    if (ta && ta.tagName === "TEXTAREA") {
      if (!ta.parentNode.querySelector(".pr-hint")) {
        var hint = el("p", { class: "pr-hint", id: "pr-reflection-hint", text: HINT });
        ta.insertAdjacentElement("afterend", hint);
        ta.setAttribute("aria-describedby", "pr-reflection-hint");
      }
      var box = ta.closest(".space-y-5") || ta.parentNode;
      box.classList.toggle("pr-chd-off", !chdGranted());
      box.setAttribute("aria-hidden", chdGranted() ? "false" : "true");
      var card = box.parentNode.querySelector(':scope > [data-pr="card"]');
      if (s && !card) { card = buildCard(); box.insertAdjacentElement("afterend", card); }
      if (card) syncCard(card);
    }
    document.querySelectorAll("button").forEach(function (b) {
      if (!SAVE_LABELS.test(b.textContent.trim())) return;
      var blocked = !!s && !termsGranted();
      b.classList.toggle("pr-blocked", blocked);
      if (blocked) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
    });

    // Legal links under the app (login and home screens; hidden on the full-screen timer)
    var nav = document.querySelector('[data-pr="legal"]');
    var root = document.getElementById("root");
    if (!nav && root) { nav = legalNav(); root.insertAdjacentElement("afterend", nav); }
    if (nav) nav.hidden = /\/timer\/?$/.test(location.pathname);
  }

  var queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; refresh(); }); }

  /* If an old service worker served the app shell for a policy URL, show the real page anyway. */
  function policyFallback() {
    var p = initialPath.replace(/\/?$/, "/");
    var hit = Object.keys(POLICY).some(function (k) { return POLICY[k] === p; });
    if (!hit) return;
    nativeFetch(p + "index.html", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
      if (!html) return;
      var frame = el("iframe", { class: "pr-policy-frame", title: "Policy" });
      frame.srcdoc = html.replace(/<head>/i, '<head><base href="' + location.origin + p + '" target="_top">');
      var close = el("a", { class: "pr-policy-close", href: "/", text: "Back to the app" });
      document.body.appendChild(el("div", { class: "pr-policy" }, [close, frame]));
      history.replaceState({}, "", p);
    }).catch(function () {});
    try { navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(function (r) { r && r.update(); }); } catch (e) {}
  }

  function start() {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", schedule);
    window.addEventListener("popstate", schedule);
    policyFallback();
    refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
