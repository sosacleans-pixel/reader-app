// Supabase Edge Function: sends daily workout reminders (web push + optional Resend email).
// Invoked every 15 min by pg_cron. Deploy with: supabase functions deploy send-reminders --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, RESEND_API_KEY, CRON_SECRET
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const env = (k: string) => Deno.env.get(k) ?? "";
webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:no-reply@coachsalimheyaime.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const WINDOW_MIN = 15;

function localParts(tz: string, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (+p.hour % 24) * 60 + +p.minute };
}

const html = (streak: number) => `<div style="font-family:Arial,sans-serif;background:#000;color:#fff;padding:28px;border-top:6px solid #FFC700">
<h1 style="color:#FFC700;margin:0 0 8px;text-transform:uppercase">Time to move</h1>
<p style="font-size:16px;line-height:1.5">Your 7-minute workout is ready.${streak >= 1 ? ` You're on a <b style="color:#FFC700">${streak}-day streak</b>. Keep it alive.` : ""}</p>
<p><a href="https://app.coachsalimheyaime.com/" style="display:inline-block;background:#FFC700;color:#000;padding:14px 22px;border-radius:10px;font-weight:bold;text-decoration:none">Start today's workout</a></p>
<p style="color:#999;font-size:12px">Coach Salim · coachsalimheyaime.com<br>Turn off email reminders anytime in the app under the ⏰ button.</p></div>`;

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const { data: prefs, error } = await db.from("workout_prefs").select("*").not("slot", "is", null);
  if (error) return new Response(error.message, { status: 500 });
  let pushed = 0, mailed = 0;
  for (const p of prefs ?? []) {
    if (!p.push_enabled && !p.email_enabled) continue;
    let lp; try { lp = localParts(p.timezone); } catch { lp = localParts("UTC"); }
    const [h, m] = String(p.local_time).split(":").map(Number);
    const target = h * 60 + m;
    if (lp.minutes < target || lp.minutes >= target + WINDOW_MIN) continue;
    if (p.last_sent_date === lp.date) continue;
    // Skip if they already worked out today.
    const { count } = await db.from("day_logs").select("*", { count: "exact", head: true }).eq("user_id", p.user_id).eq("calendar_date", lp.date);
    await db.from("workout_prefs").update({ last_sent_date: lp.date }).eq("user_id", p.user_id);
    if (count && count > 0) continue;
    const { data: st } = await db.from("streaks").select("current_streak").eq("user_id", p.user_id).maybeSingle();
    const streak = st?.current_streak ?? 0;
    const body = streak >= 1 ? `🔥 ${streak}-day streak on the line. 7 minutes keeps it alive.` : "Your 7-minute workout is waiting. Let's go.";
    let delivered = false;
    if (p.push_enabled) {
      const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", p.user_id);
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: "Time to move 💪", body, url: "/" }), { TTL: 3600 });
          pushed++; delivered = true;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    if (p.email_enabled) {
      const { data: u } = await db.auth.admin.getUserById(p.user_id);
      const to = u?.user?.email;
      if (to) {
        const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Coach Salim <no-reply@coachsalimheyaime.com>", to, subject: streak >= 1 ? `🔥 Keep your ${streak}-day streak alive` : "Time for today's 7-minute workout", html: html(streak) }) });
        if (r.ok) mailed++;
      }
    }
    void delivered;
  }
  return Response.json({ ok: true, pushed, mailed });
});
