/* Coach Salim Heyaime LLC: shared Health and safety acknowledgement (one time, before first use).
   GENERATED from /workspace/legacy-access/src/content.py (build.py). Same text in every app and on https://achallengetomove.com/health-safety/.
   Shown once per app and text version; the tick is stored only on this device (localStorage). No network calls. */
(function () {
  "use strict";
  var VERSION = "hs-2026-10-18.1-draft";
  var T = {"en": {"title": "Health and safety", "lead": "This applies to every app from Coach Salim Heyaime LLC: the 22-Day 7-Minute Workout, Doing a 5K, the 30-Day Whole Food Plan, the 75-day apps (75 Adaptive and 75 All-In) and A Challenge to Move: 30 Days Before X-mas Challenge. Please read it before you start.", "sections": [["wellness", "General wellness education only. Not medical advice.", "Our apps provide general fitness, nutrition and habit information for healthy adults 18 and older. They don't diagnose, treat, cure, mitigate or prevent any disease or condition, and they make no weight-loss, medical or health-outcome claims. They are not physical therapy, rehabilitation or a medical program, and they are not a substitute for care from a doctor or other qualified healthcare provider."], ["adults", "Adults only", "You must be 18 or older to use our apps."], ["doctor", "Check with your doctor first", "Check with your doctor or a qualified healthcare provider before starting, especially if you have a heart condition, high blood pressure, diabetes, joint or bone problems, a recent injury or surgery, are pregnant or postpartum, take medication for a chronic condition, or have been inactive for a while. Before you change how you eat, also check with them if you have a medical condition, food allergies or a history of disordered eating. In an emergency, call 911 (or your local emergency number)."], ["stop", "Stop if you feel pain", "STOP right away if you feel pain, or if you have: chest pain, pressure or tightness (or pain spreading to the arm, jaw, neck or back); unusual shortness of breath that doesn't settle with rest; dizziness, light-headedness, fainting or confusion; an irregular or racing heartbeat; sharp, stabbing or joint pain; numbness, tingling or loss of coordination; nausea or vomiting during effort. If symptoms are severe or don't settle quickly with rest, call 911 (or your local emergency number). Otherwise, contact a healthcare provider before you exercise again."], ["space", "Your space and your pace", "You are responsible for your space and any equipment you use, and for checking that it is safe and in good condition. You control your pace and intensity. Never hold your breath during effort."], ["results", "Results vary", "Individual experiences vary. We don't promise any weight, body, fitness or health outcome."]], "ack": "I am 18 or older, and I have read and understand this health and safety information.", "btn": "Continue", "screenTitle": "Before you start", "langBtn": "Leer en español", "links": ["Health and safety", "App Terms"]}, "es": {"title": "Salud y seguridad", "lead": "Esto aplica a todas las apps de Coach Salim Heyaime LLC: 22-Day 7-Minute Workout, Doing a 5K, 30-Day Whole Food Plan, las apps de 75 días (75 Adaptive y 75 All-In) y A Challenge to Move: Reto 30 Días Antes de X-mas. Léelo antes de empezar.", "sections": [["wellness", "Solo educación general sobre bienestar. No es consejo médico.", "Nuestras apps ofrecen información general sobre ejercicio, alimentación y hábitos para adultos sanos de 18 años o más. No diagnostican, tratan, curan, mitigan ni previenen ninguna enfermedad o afección, y no hacen afirmaciones sobre pérdida de peso, afirmaciones médicas ni afirmaciones sobre resultados de salud. No son fisioterapia, rehabilitación ni un programa médico, y no sustituyen la atención de un médico u otro profesional de la salud calificado."], ["adults", "Solo adultos", "Debes tener 18 años o más para usar nuestras apps."], ["doctor", "Consulta primero a tu médico", "Consulta a tu médico o a un profesional de la salud calificado antes de empezar, sobre todo si tienes una enfermedad del corazón, presión arterial alta, diabetes, problemas en las articulaciones o los huesos, una lesión o cirugía reciente, si estás embarazada o en el posparto, si tomas medicamentos para una enfermedad crónica o si llevas un tiempo sin hacer actividad física. Antes de cambiar tu forma de comer, consúltalo también si tienes una afección médica, alergias alimentarias o antecedentes de trastornos de la conducta alimentaria. En una emergencia, llama al 911 (o al número local de emergencias)."], ["stop", "Detente si sientes dolor", "DETENTE de inmediato si sientes dolor o si tienes: dolor, presión u opresión en el pecho (o dolor que se extiende al brazo, la mandíbula, el cuello o la espalda); falta de aire inusual que no mejora con el descanso; mareo, sensación de desmayo, desmayo o confusión; latidos irregulares o muy acelerados; dolor agudo, punzante o en las articulaciones; entumecimiento, hormigueo o pérdida de coordinación; náuseas o vómitos durante el esfuerzo. Si los síntomas son graves o no mejoran pronto con el descanso, llama al 911 (o al número local de emergencias). En los demás casos, comunícate con un profesional de la salud antes de volver a hacer ejercicio."], ["space", "Tu espacio y tu ritmo", "Tú eres responsable de tu espacio y de cualquier equipo que uses, y de revisar que sea seguro y esté en buen estado. Tú controlas tu ritmo y la intensidad. No contengas la respiración durante el esfuerzo."], ["results", "Los resultados varían", "Las experiencias individuales varían. No prometemos ningún resultado de peso, cuerpo, condición física ni salud."]], "ack": "Tengo 18 años o más, y leí y entiendo esta información de salud y seguridad.", "btn": "Continuar", "screenTitle": "Antes de empezar", "langBtn": "Read in English", "links": ["Salud y seguridad", "Términos de las apps"]}};
  var LINKS = { safety: "https://achallengetomove.com/health-safety/", terms: "https://achallengetomove.com/purchase-terms/" };
  var script = document.currentScript;
  var APP = (script && script.getAttribute("data-app")) || location.pathname.split("/").filter(Boolean)[0] || "app";
  var KEY = "actm.healthAck." + APP;

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function done() { var v = read(); return !!(v && v.version === VERSION); }
  window.ACTM_HEALTH_ACK = { version: VERSION, key: KEY, done: done };
  if (done()) return;

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function block(lang) {
    var t = T[lang];
    var secs = t.sections.map(function (s) { return "<h3>" + esc(s[1]) + "</h3><p>" + esc(s[2]) + "</p>"; }).join("");
    return '<div class="hs-ack-lang" lang="' + lang + '"' + (lang === "es" ? " hidden" : "") + ">" +
      '<h2 id="hs-ack-title-' + lang + '">' + esc(t.screenTitle) + ": " + esc(t.title) + "</h2>" +
      "<p>" + esc(t.lead) + "</p>" + secs +
      '<p class="hs-ack-links"><a href="' + LINKS.safety + (lang === "es" ? "#es" : "") + '" target="_blank" rel="noopener">' + esc(t.links[0]) + "</a> · " +
      '<a href="' + LINKS.terms + (lang === "es" ? "#es" : "") + '" target="_blank" rel="noopener">' + esc(t.links[1]) + "</a></p>" +
      '<label class="hs-ack-check"><input type="checkbox" data-hs="tick"> <span>' + esc(t.ack) + "</span></label>" +
      '<div class="hs-ack-actions"><button type="button" class="hs-ack-go" data-hs="go" disabled>' + esc(t.btn) + "</button>" +
      '<button type="button" class="hs-ack-lang-btn" data-hs="lang">' + esc(t.langBtn) + "</button></div></div>";
  }
  var CSS = ".hs-ack{position:fixed;inset:0;z-index:2147483000;background:rgba(20,20,20,.72);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:16px;box-sizing:border-box}" +
    ".hs-ack-card{background:#fff;color:#1e1e1e;max-width:560px;width:100%;border-radius:14px;padding:20px 20px 16px;box-sizing:border-box;font:15px/1.5 Lato,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:left}" +
    ".hs-ack-card h2{font-size:1.25rem;line-height:1.25;margin:0 0 .6rem}.hs-ack-card h3{font-size:1rem;margin:.9rem 0 .2rem}.hs-ack-card p{margin:0 0 .4rem}" +
    ".hs-ack-card a{color:#1e1e1e;text-decoration:underline}.hs-ack-links{margin-top:.8rem!important}" +
    ".hs-ack-check{display:flex;gap:.6rem;align-items:flex-start;margin:1rem 0 .8rem;font-weight:700}.hs-ack-check input{width:22px;height:22px;flex:0 0 auto;margin-top:1px}" +
    ".hs-ack-actions{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}" +
    ".hs-ack-go{background:#1e1e1e;color:#fff;border:0;border-radius:999px;padding:.75rem 1.4rem;font:inherit;font-weight:700;min-height:44px;cursor:pointer}.hs-ack-go:disabled{opacity:.45;cursor:not-allowed}" +
    ".hs-ack-lang-btn{background:none;border:0;padding:.5rem;font:inherit;text-decoration:underline;color:#1e1e1e;cursor:pointer;min-height:44px}";

  var obs = null, others = [];
  function show() {
    if (document.querySelector(".hs-ack")) return;
    var style = document.getElementById("hs-ack-style"); if (!style) { style = document.createElement("style"); style.id = "hs-ack-style"; style.textContent = CSS; document.head.appendChild(style); }
    var wrap = document.createElement("div");
    wrap.className = "hs-ack"; wrap.setAttribute("data-hs", "screen");
    wrap.innerHTML = '<div class="hs-ack-card" role="dialog" aria-modal="true" aria-labelledby="hs-ack-title-en">' + block("en") + block("es") + "</div>";
    others = [].slice.call(document.body.children);
    others.forEach(function (el) { el.setAttribute("inert", ""); el.setAttribute("aria-hidden", "true"); });
    document.body.appendChild(wrap);
    // If the app replaces <body> children before the tick, put the screen back.
    if (!obs) {
      obs = new MutationObserver(function (muts) {
        if (done()) return;
        if (!document.querySelector(".hs-ack")) { show(); return; }
        // Anything the app adds behind the screen stays inert until the tick.
        muts.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && !n.classList.contains("hs-ack")) { n.setAttribute("inert", ""); n.setAttribute("aria-hidden", "true"); others.push(n); } }); });
      });
      obs.observe(document.body, { childList: true });
    }
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    var card = wrap.firstChild;
    function current() { return [].slice.call(card.querySelectorAll(".hs-ack-lang")).filter(function (b) { return !b.hidden; })[0]; }
    function focusables() { return [].slice.call(current().querySelectorAll("a,input,button:not([disabled])")); }
    wrap.addEventListener("change", function (e) {
      if (e.target.getAttribute("data-hs") !== "tick") return;
      [].forEach.call(card.querySelectorAll('[data-hs="tick"]'), function (c) { c.checked = e.target.checked; });
      [].forEach.call(card.querySelectorAll('[data-hs="go"]'), function (b) { b.disabled = !e.target.checked; });
    });
    wrap.addEventListener("click", function (e) {
      var w = e.target.closest && e.target.closest("[data-hs]"); if (!w) return;
      var k = w.getAttribute("data-hs");
      if (k === "lang") {
        var blocks = card.querySelectorAll(".hs-ack-lang");
        [].forEach.call(blocks, function (b) { b.hidden = !b.hidden; });
        var cur = current(); card.setAttribute("aria-labelledby", cur.querySelector("h2").id);
        var ch = cur.querySelector("h2"); ch.setAttribute("tabindex", "-1"); ch.focus({ preventScroll: true }); wrap.scrollTop = 0;
      } else if (k === "go" && !w.disabled) {
        try { localStorage.setItem(KEY, JSON.stringify({ version: VERSION, lang: current().getAttribute("lang"), at: new Date().toISOString() })); } catch (err) {}
        others.forEach(function (el) { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); });
        document.documentElement.style.overflow = prevOverflow;
        if (obs) { obs.disconnect(); obs = null; }
        wrap.remove(); style.remove();
        try { document.dispatchEvent(new CustomEvent("actm:health-ack", { detail: { version: VERSION } })); } catch (err) {}
      }
    });
    wrap.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = focusables(); if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    // Start at the top: focus the heading (not the tick box, which would scroll past the text).
    var h2 = current().querySelector("h2"); h2.setAttribute("tabindex", "-1");
    try { h2.focus({ preventScroll: true }); } catch (err) { h2.focus(); }
    wrap.scrollTop = 0;
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();
