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

// ---- Reminder copy: edit all reminder text here. Keyed by the user's current streak. ----
const BTN = (label: string) => `<p><a href="https://app.coachsalimheyaime.com" style="display:inline-block;background:#FFC700;color:#000;padding:14px 22px;border-radius:10px;font-weight:bold;text-decoration:none">${label}</a></p>`;
const wrap = (h: string, p: string, btn: string) => `<div style="font-family:Arial,sans-serif;background:#000;color:#fff;padding:28px;border-top:6px solid #FFC700">
<h1 style="color:#FFC700;margin:0 0 8px;text-transform:uppercase">${h}</h1>
<p style="font-size:16px;line-height:1.5">${p}</p>${BTN(btn)}
<p style="color:#999;font-size:12px">Coach Salim · coachsalimheyaime.com<br>Turn off email reminders anytime in the app under the ⏰ button.</p></div>`;
type Txt = string | ((streak: number) => string);
type Copy = { pushTitle: Txt; pushBody: Txt; emailSubject: Txt; emailHtml: Txt };
export const REMINDER_COPY: { day1: Copy; comeback: Copy; day2: Copy; day3: Copy; generic: Copy } = {
  // streak 0 and no completed workouts ever: day 1
  day1: {
    pushTitle: "Day 1 starts now 💪",
    pushBody: "Just 7 minutes. Press play and let's move — Coach Salim",
    emailSubject: "Your first 7 minutes are waiting",
    emailHtml: wrap("Day 1 starts now", "Just 7 minutes. No gym, no gear, no excuses. Press play and let's move.<br><br>— Coach Salim", "Start Day 1"),
  },
  // streak 0 but has worked out before (missed yesterday): no-guilt comeback
  comeback: {
    pushTitle: "Welcome back 👋",
    pushBody: "Missed a day? No problem. 7 minutes today and your streak starts again — Coach Salim",
    emailSubject: "Let's pick it back up today",
    emailHtml: wrap("Welcome back 👋", "Missed a day? That's life, and it doesn't erase the work you've already put in. No guilt, no catching up. Just 7 minutes today and your streak starts again.<br><br>— Coach Salim", "Pick it back up"),
  },
  // streak 1: worked out yesterday
  day2: {
    pushTitle: "Day 2 — keep it going 🔥",
    pushBody: "You showed up yesterday. Do it again today and you're one day from a 3-day streak.",
    emailSubject: "Day 2: don't break the chain",
    emailHtml: wrap("Day 2: keep it going 🔥", "You showed up yesterday. Do it again today and you're one day from a 3-day streak. Seven minutes. Let's go.<br><br>— Coach Salim", "Start today's workout"),
  },
  // streak 2: today unlocks the first 3-day streak
  day3: {
    pushTitle: "Day 3 — your first streak is today 🏆",
    pushBody: "Two days down. Finish today's 7 minutes and unlock your 3-day streak!",
    emailSubject: "Today you hit your first 3-day streak",
    emailHtml: wrap("Day 3: your first streak is today 🏆", "Two days down. Finish today's 7 minutes and unlock your 3-day streak. You've already done the hard part. Let's finish it.<br><br>— Coach Salim", "Unlock my streak"),
  },
  // streak 3+
  generic: {
    pushTitle: "Time to move 💪",
    pushBody: (s) => `🔥 ${s}-day streak on the line. 7 minutes keeps it alive.`,
    emailSubject: (s) => `🔥 Keep your ${s}-day streak alive`,
    emailHtml: (s) => wrap("Time to move", `Your 7-minute workout is ready. You're on a <b style="color:#FFC700">${s}-day streak</b>. Keep it alive.<br><br>— Coach Salim`, "Start today's workout"),
  },
};
function copyFor(streak: number, hasHistory: boolean) {
  const c = streak <= 0 ? (hasHistory ? REMINDER_COPY.comeback : REMINDER_COPY.day1) : streak === 1 ? REMINDER_COPY.day2 : streak === 2 ? REMINDER_COPY.day3 : REMINDER_COPY.generic;
  const v = (t: Txt) => (typeof t === "function" ? t(streak) : t);
  return { pushTitle: v(c.pushTitle), pushBody: v(c.pushBody), emailSubject: v(c.emailSubject), emailHtml: v(c.emailHtml) };
}

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
    const { data: st } = await db.from("streaks").select("current_streak,last_workout_date,total_workouts").eq("user_id", p.user_id).maybeSingle();
    // Stored streak is only fresh if the last workout was yesterday (local); otherwise they're starting over.
    const y = new Date(lp.date + "T12:00:00Z"); y.setUTCDate(y.getUTCDate() - 1);
    const streak = st && st.last_workout_date === y.toISOString().slice(0, 10) ? st.current_streak ?? 0 : 0;
    // Any past workout? Prefer streaks.total_workouts/last_workout_date, fall back to the app's day_logs table.
    let hasHistory = !!(st && ((st.total_workouts ?? 0) > 0 || st.last_workout_date));
    if (!hasHistory) {
      const { count: past } = await db.from("day_logs").select("*", { count: "exact", head: true }).eq("user_id", p.user_id);
      hasHistory = (past ?? 0) > 0;
    }
    const copy = copyFor(streak, hasHistory);
    let delivered = false;
    if (p.push_enabled) {
      const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", p.user_id);
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: copy.pushTitle, body: copy.pushBody, url: "/" }), { TTL: 3600 });
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
          body: JSON.stringify({ from: "Coach Salim <no-reply@coachsalimheyaime.com>", to, subject: copy.emailSubject, html: copy.emailHtml }) });
        if (r.ok) mailed++;
      }
    }
    void delivered;
  }
  return Response.json({ ok: true, pushed, mailed });
});
