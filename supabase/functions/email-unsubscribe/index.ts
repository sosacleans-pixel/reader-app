// Supabase Edge Function: email-unsubscribe
// Coach Salim Heyaime LLC · 22-Day app
// Turns OFF reminder emails for one user: sets workout_prefs.email_enabled = false.
// Links are signed per user with HMAC-SHA256(UNSUBSCRIBE_SECRET, "unsubscribe:<user_id>"), made by send-reminders.
//
//  POST ?u=<uid>&t=<token>               RFC 8058 one-click (List-Unsubscribe-Post), returns 200 text
//  POST (form) u=<uid>&t=<token>         from https://app.coachsalimheyaime.com/unsubscribe/, 303 back to the page
//  GET                                   never changes anything (link scanners prefetch GETs); redirects to the page
//
// Deploy:  supabase functions deploy email-unsubscribe --no-verify-jwt --project-ref olncfwohfpgpmygxjpcm
//          (public link: no JWT. The HMAC token is the authorization.)
// Secrets: UNSUBSCRIBE_SECRET (same value as for send-reminders). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected.
// Idempotent. Logs only the user id and a timestamp.
import { createClient } from "npm:@supabase/supabase-js@2";

const PAGE = "https://app.coachsalimheyaime.com/unsubscribe/";
const ORIGIN = "https://app.coachsalimheyaime.com";
const env = (k: string) => Deno.env.get(k) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function expected(uid: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("UNSUBSCRIBE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsubscribe:${uid}`)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const cors = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET") return Response.redirect(`${PAGE}${url.search}`, 303);
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });
  if (!env("UNSUBSCRIBE_SECRET")) return new Response("not configured", { status: 500, headers: cors });

  let uid = url.searchParams.get("u") ?? "";
  let token = url.searchParams.get("t") ?? "";
  const ctype = req.headers.get("content-type") ?? "";
  const isForm = ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data");
  let fromPage = false;
  if (isForm) {
    const f = await req.formData().catch(() => null);
    // RFC 8058 one-click sends "List-Unsubscribe=One-Click" as the form body; the page sends u and t.
    if (f && f.get("u")) { uid = String(f.get("u")); token = String(f.get("t") ?? ""); fromPage = true; }
  } else if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (j?.u) { uid = String(j.u); token = String(j.t ?? ""); }
  }
  if (!UUID.test(uid) || !token || !safeEqual(token, await expected(uid))) {
    return fromPage ? Response.redirect(`${PAGE}?error=invalid`, 303) : new Response("invalid link", { status: 400, headers: cors });
  }

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { error } = await db.from("workout_prefs").update({ email_enabled: false, updated_at: new Date().toISOString() }).eq("user_id", uid);
  if (error) {
    console.error(JSON.stringify({ event: "email-unsubscribe-failed", uid, at: new Date().toISOString() }));
    return fromPage ? Response.redirect(`${PAGE}?error=server`, 303) : new Response("error", { status: 500, headers: cors });
  }
  console.log(JSON.stringify({ event: "email-unsubscribe", uid, at: new Date().toISOString() }));
  return fromPage ? Response.redirect(`${PAGE}?done=1`, 303) : new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
