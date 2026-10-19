/* Coach Salim Heyaime LLC · 22-Day 7-Minute Workout: check-in fields paused (interim build).
   Until the consent screen ships, the app does not collect energy (before/after), mood or reflections:
   - the four check-in inputs are hidden and replaced by a short paused note (EN + ES);
   - every write to day_logs (insert, upsert, update) has energy_before, energy_after, mood and reflection
     REMOVED from the request body (not set to null), so new writes never touch those columns and
     anything already stored stays exactly as it is. Nothing is deleted, on the server or on this device.
   Workouts, kept days, streaks, reminders and sign-in are unchanged. No trackers, no new origins. */
(function () {
  "use strict";
  var SB_REST = "https://olncfwohfpgpmygxjpcm.supabase.co/rest/v1/day_logs";
  var FIELDS = ["energy_before", "energy_after", "mood", "reflection"];
  var NOTE_EN = "Check-in notes are paused while we update our privacy settings.";
  var NOTE_ES = "Las notas de registro están en pausa mientras actualizamos nuestra configuración de privacidad.";

  function dropFields(row) {
    if (row && typeof row === "object") FIELDS.forEach(function (f) { delete row[f]; });
    return row;
  }
  function cleanBody(body) {
    try {
      var d = JSON.parse(body);
      d = Array.isArray(d) ? d.map(dropFields) : dropFields(d);
      return JSON.stringify(d);
    } catch (e) { return body; }
  }
  // PostgREST bulk upserts may list columns in ?columns=...; drop the paused ones there too.
  function cleanUrl(url) {
    try {
      var u = new URL(url);
      var c = u.searchParams.get("columns");
      if (c) {
        u.searchParams.set("columns", c.split(",").filter(function (x) { return FIELDS.indexOf(x.replace(/"/g, "").trim()) < 0; }).join(","));
        return u.toString();
      }
    } catch (e) {}
    return url;
  }

  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || String(input || "");
      var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (url.indexOf(SB_REST) === 0 && /^(POST|PATCH|PUT)$/.test(method)) {
        if (typeof input === "string" && init && typeof init.body === "string") {
          return nativeFetch(cleanUrl(input), Object.assign({}, init, { body: cleanBody(init.body) }));
        }
        if (input && typeof input === "object" && input.url) {
          // Request object: rebuild it with a cleaned body.
          return input.clone().text().then(function (t) {
            var r = new Request(cleanUrl(input.url), input);
            return nativeFetch(new Request(r, Object.assign({}, init || {}, { body: t ? cleanBody(t) : undefined })));
          });
        }
      }
    } catch (e) {}
    return nativeFetch(input, init);
  };

  /* UI: hide the check-in block (ratings + reflection) and show the paused note in its place. */
  function note() {
    var box = document.createElement("div");
    box.className = "co-note";
    box.setAttribute("data-co", "note");
    box.setAttribute("role", "note");
    var en = document.createElement("p"); en.textContent = NOTE_EN;
    var es = document.createElement("p"); es.lang = "es"; es.className = "co-es"; es.textContent = NOTE_ES;
    box.appendChild(en); box.appendChild(es);
    return box;
  }
  // Copy that invites a note is trimmed while notes are paused.
  var COPY = [
    ["You showed up. Keep today on the calendar, or add a note first.", "You showed up. Keep today on the calendar."],
    ["Notes are optional. Keeping this movement records today on the calendar.", "Keeping this movement records today on the calendar."]
  ];
  function trimCopy() {
    document.querySelectorAll("p").forEach(function (p) {
      var t = p.textContent.trim();
      COPY.forEach(function (c) { if (t === c[0]) p.textContent = c[1]; });
    });
  }
  function refresh() {
    trimCopy();
    var ta = document.getElementById("reflection");
    if (!ta) return;
    var block = ta.closest(".space-y-5") || ta.parentNode;
    if (!block || block.getAttribute("data-co") === "hidden") return;
    block.setAttribute("data-co", "hidden");
    block.hidden = true;
    block.setAttribute("aria-hidden", "true");
    block.querySelectorAll("button, textarea, input").forEach(function (n) { n.setAttribute("tabindex", "-1"); n.disabled = true; });
    block.insertAdjacentElement("beforebegin", note());
  }
  var queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; refresh(); }); }
  var css = document.createElement("style");
  css.textContent = '[data-co="hidden"]{display:none!important}' +
    '.co-note{border-radius:1rem;background:#fff;border:2px solid #e8e2d6;padding:.75rem 1rem;font-size:.9rem;line-height:1.45;color:#1e1e1e;overflow-wrap:anywhere}' +
    '.co-note p{margin:0}.co-note .co-es{margin-top:.35rem;color:#5c5c5c}';
  function start() {
    document.head.appendChild(css);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
