// Supabase Edge Function: delete-account
// Coach Salim Heyaime LLC · 22-Day app (app.coachsalimheyaime.com)
//
// Deletes the CALLER's own account and data. The caller is identified only by the JWT
// in the Authorization header; no user id is accepted from the request body.
//
// Deploy:  supabase functions deploy delete-account --project-ref olncfwohfpgpmygxjpcm
//          (keep JWT verification ON: do NOT pass --no-verify-jwt)
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
//          The service-role key is read from the environment only. Never hard-code it or ship it to the browser.
//
// Idempotent: deleting an already-deleted user's rows is a no-op; a missing auth user is treated as done.
// Logs only the user id and a timestamp, never row contents.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://app.coachsalimheyaime.com",
]);
// Tables holding the user's rows, and the column that points at auth.users.id.
const TABLES: Array<{ table: string; column: string; optional?: boolean }> = [
  { table: "day_logs", column: "user_id" },
  { table: "streaks", column: "user_id" },
  { table: "workout_prefs", column: "user_id" },
  { table: "push_subscriptions", column: "user_id" },
  { table: "consents", column: "user_id", optional: true }, // exists once 20261018_consents.sql is applied
  { table: "profiles", column: "id" },
];

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}
function isMissingTable(e: { code?: string; message?: string } | null) {
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|Could not find the table/i.test(e.message ?? ""));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "origin not allowed" }, 403, origin);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) return json({ ok: false, error: "server not configured" }, 500, origin);

  // 1) Verify the caller's JWT with Supabase Auth (not just decode it).
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "missing token" }, 401, origin);
  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoErr } = await userClient.auth.getUser(jwt);
  if (whoErr || !who?.user?.id) return json({ ok: false, error: "invalid or expired token" }, 401, origin);
  const uid = who.user.id;

  // Optional explicit confirmation from the client UI.
  try {
    const body = await req.json().catch(() => ({}));
    if (body && body.confirm !== undefined && body.confirm !== "DELETE") return json({ ok: false, error: "confirmation missing" }, 400, origin);
  } catch { /* empty body is fine */ }

  // 2) Service role: delete the user's rows, then the auth user.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const t of TABLES) {
    const { error } = await admin.from(t.table).delete().eq(t.column, uid);
    if (error) {
      if (t.optional && isMissingTable(error)) continue;
      console.error(JSON.stringify({ event: "delete-account-failed", uid, step: t.table, at: new Date().toISOString() }));
      return json({ ok: false, error: `could not delete ${t.table}` }, 500, origin);
    }
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr && !/not found/i.test(delErr.message ?? "")) {
    console.error(JSON.stringify({ event: "delete-account-failed", uid, step: "auth.users", at: new Date().toISOString() }));
    return json({ ok: false, error: "could not delete the sign-in account" }, 500, origin);
  }
  console.log(JSON.stringify({ event: "delete-account", uid, at: new Date().toISOString() }));
  return json({ ok: true, deleted_at: new Date().toISOString() }, 200, origin);
});
